import Foundation
import UIKit
import Capacitor
import UnityAds

@objc(TiliqUnityAdsPlugin)
public class TiliqUnityAdsPlugin: CAPPlugin, CAPBridgedPlugin,
    UADSBannerAdDelegate, UnityAdsLoadDelegate, UnityAdsShowDelegate {

    public let identifier = "TiliqUnityAdsPlugin"
    public let jsName = "TiliqUnityAds"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPrivacy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareInterstitial", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showInterstitial", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareRewardVideoAd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showRewardVideoAd", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showBanner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hideBanner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeBanner", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeBanner", returnType: CAPPluginReturnPromise)
    ]

    private var initialized = false
    private var banner: UADSBannerAd?
    private var interstitialPlacement: String?
    private var rewardedPlacement: String?
    private var interstitialReady = false
    private var rewardedReady = false
    private var interstitialLoading = false
    private var rewardedLoading = false
    private var interstitialLoadCall: CAPPluginCall?
    private var rewardedLoadCall: CAPPluginCall?
    private var interstitialCall: CAPPluginCall?
    private var rewardedCall: CAPPluginCall?

    // Watchdog: Unity Ads'in show() çağrısı çok nadiren (creative fetch sırasında
    // network kopması, ya da load() ile show() arasında reklamın sessizce expire
    // olması) ne showDidStart ne showDidFail çağırmadan tam ekran, siyah, kapatma
    // butonu olmayan bir view controller'ı ekranda asılı bırakabiliyor — kullanıcı
    // uygulamayı zorla kapatmak zorunda kalıyor (TestFlight raporu, 2026-09-15).
    // Bu durumda SDK'nın kendi kurtarma mekanizması yok; biz zorla kapatıyoruz.
    private static let showStartTimeout: TimeInterval = 8
    private static let showCompletionTimeout: TimeInterval = 75
    private static let bannerImpressionTimeout: TimeInterval = 15
    fileprivate var interstitialWatchdog: DispatchWorkItem?
    fileprivate var rewardedWatchdog: DispatchWorkItem?
    fileprivate var interstitialStarted = false
    fileprivate var rewardedStarted = false
    fileprivate var rewardedEarned = false
    private weak var interstitialPresenter: UIViewController?
    private weak var rewardedPresenter: UIViewController?
    private var bannerImpressionWatchdog: DispatchWorkItem?
    private var bannerImpressionReceived = false

    /// CAPPluginCall metotları Capacitor'ın kendi arka plan kuyruğunda çalışabilir;
    /// DispatchWorkItem/asyncAfter kullanmak Timer'ın gerektirdiği aktif RunLoop
    /// bağımlılığını (ve olası ana thread deadlock'unu) ortadan kaldırır.
    private func armWatchdog(started: @escaping () -> Bool, forceDismiss: @escaping (String) -> Void) -> DispatchWorkItem {
        let work = DispatchWorkItem {
            if !started() {
                forceDismiss("Ad show timed out before starting (frozen black screen)")
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.showStartTimeout, execute: work)
        return work
    }

    /// Bulunabilirse en üstteki sunulan (presented) view controller'ı kapatır —
    /// Unity'nin kendi view'ı `bridge.viewController` üzerinden modal sunulur.
    private func forceDismissPresentedAd(_ vc: UIViewController, reason: String) {
        DispatchQueue.main.async {
            guard let presented = vc.presentedViewController else { return }
            presented.dismiss(animated: false) {
                NSLog("[TiliqUnityAds] Force-dismissed hung ad view: \(reason)")
            }
        }
    }

    /// Unity Ads must be presented by the controller that is actually visible.
    /// Presenting from Capacitor's root while a native sheet is on top can leave
    /// Unity's ad controller behind an opaque black transition view.
    private func topViewController(from root: UIViewController?) -> UIViewController? {
        guard let root = root else { return nil }
        if let presented = root.presentedViewController, !presented.isBeingDismissed {
            return topViewController(from: presented)
        }
        if let navigation = root as? UINavigationController {
            return topViewController(from: navigation.visibleViewController)
        }
        if let tabs = root as? UITabBarController {
            return topViewController(from: tabs.selectedViewController)
        }
        return root
    }

    private func errorData(_ message: String, code: Int? = nil) -> [String: Any] {
        var data: [String: Any] = ["message": message]
        if let code = code { data["code"] = code }
        return data
    }

    private func placement(_ call: CAPPluginCall) -> String? {
        guard let id = call.getString("adId"), !id.isEmpty else {
            call.reject("Unity Ads placement ID is missing")
            return nil
        }
        return id
    }

    @objc func initialize(_ call: CAPPluginCall) {
        guard let gameId = call.getString("gameId"), !gameId.isEmpty else {
            call.reject("Unity Ads Game ID is missing")
            return
        }
        if initialized {
            call.resolve()
            return
        }
        let testMode = call.getBool("testMode") ?? true
        let config = UADSInitializationConfigurationBuilder(gameId: gameId)
            .with(testMode: testMode)
            .with(logLevel: testMode ? .debug : .error)
            .build()
        UnityAds.initialize(config) { [weak self] error in
            if let error = error {
                call.reject(error.message)
            } else {
                self?.initialized = true
                call.resolve()
            }
        }
    }

    @objc func setPrivacy(_ call: CAPPluginCall) {
        if let consent = call.getBool("userConsent") { UnityAds.setUserConsent(consent) }
        if let optOut = call.getBool("userOptOut") { UnityAds.setUserOptOut(optOut) }
        if let nonBehavioral = call.getBool("nonBehavioral") { UnityAds.setNonBehavioral(nonBehavioral) }
        call.resolve()
    }

    @objc func prepareInterstitial(_ call: CAPPluginCall) {
        guard let id = placement(call) else { return }
        guard initialized else { call.reject("Unity Ads is not initialized"); return }
        if interstitialReady && interstitialPlacement == id { call.resolve(); return }
        if interstitialLoading { call.reject("Interstitial load is already running"); return }
        interstitialPlacement = id
        interstitialLoading = true
        interstitialLoadCall = call
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.reject("Ads bridge was released"); return }
            UnityAds.load(id, loadDelegate: self)
        }
    }

    @objc func showInterstitial(_ call: CAPPluginCall) {
        guard interstitialReady, let id = interstitialPlacement else { call.reject("Interstitial is not loaded"); return }
        guard interstitialCall == nil && rewardedCall == nil else { call.reject("Another full-screen ad is already active"); return }
        guard let vc = topViewController(from: bridge?.viewController) else { call.reject("View controller is unavailable"); return }
        interstitialReady = false
        interstitialCall = call
        interstitialPresenter = vc
        interstitialStarted = false
        interstitialWatchdog?.cancel()
        interstitialWatchdog = armWatchdog(started: { [weak self] in self?.interstitialStarted ?? false }) { [weak self] reason in
            guard let self = self else { return }
            self.forceDismissPresentedAd(vc, reason: reason)
            self.interstitialDidFail(reason)
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.reject("Ads bridge was released"); return }
            UnityAds.show(vc, placementId: id, showDelegate: self)
        }
    }

    @objc func prepareRewardVideoAd(_ call: CAPPluginCall) {
        guard let id = placement(call) else { return }
        guard initialized else { call.reject("Unity Ads is not initialized"); return }
        if rewardedReady && rewardedPlacement == id { call.resolve(); return }
        if rewardedLoading { call.reject("Rewarded load is already running"); return }
        rewardedPlacement = id
        rewardedLoading = true
        rewardedLoadCall = call
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.reject("Ads bridge was released"); return }
            UnityAds.load(id, loadDelegate: self)
        }
    }

    @objc func showRewardVideoAd(_ call: CAPPluginCall) {
        guard rewardedReady, let id = rewardedPlacement else { call.reject("Rewarded ad is not loaded"); return }
        guard interstitialCall == nil && rewardedCall == nil else { call.reject("Another full-screen ad is already active"); return }
        guard let vc = topViewController(from: bridge?.viewController) else { call.reject("View controller is unavailable"); return }
        rewardedReady = false
        rewardedCall = call
        rewardedPresenter = vc
        rewardedStarted = false
        rewardedEarned = false
        rewardedWatchdog?.cancel()
        rewardedWatchdog = armWatchdog(started: { [weak self] in self?.rewardedStarted ?? false }) { [weak self] reason in
            guard let self = self else { return }
            self.forceDismissPresentedAd(vc, reason: reason)
            self.rewardedDidFail(reason)
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.reject("Ads bridge was released"); return }
            UnityAds.show(vc, placementId: id, showDelegate: self)
        }
    }

    // Full-screen ads intentionally use Unity's placement-based load/show path.
    // Banner rendering succeeds through UADSBannerAd, while the object-based
    // UADSInterstitialAd/UADSRewardedAd path produced an opaque black controller
    // on the same iPhone and Game ID. Keeping the formats on separate paths makes
    // the failing renderer the only changed variable in the device retest.
    public func unityAdsAdLoaded(_ placementId: String) {
        if placementId == interstitialPlacement {
            interstitialLoading = false
            interstitialReady = true
            interstitialLoadCall?.resolve()
            interstitialLoadCall = nil
        }
        if placementId == rewardedPlacement {
            rewardedLoading = false
            rewardedReady = true
            rewardedLoadCall?.resolve()
            rewardedLoadCall = nil
        }
    }

    public func unityAdsAdFailedToLoad(_ placementId: String, withError error: UnityAdsLoadError, withMessage message: String) {
        if placementId == interstitialPlacement {
            interstitialLoading = false
            interstitialReady = false
            interstitialLoadCall?.reject(message)
            interstitialLoadCall = nil
        }
        if placementId == rewardedPlacement {
            rewardedLoading = false
            rewardedReady = false
            rewardedLoadCall?.reject(message)
            rewardedLoadCall = nil
        }
        NSLog("[TiliqUnityAds] Load failed %d for %@: %@", error.rawValue, placementId, message)
    }

    public func unityAdsShowStart(_ placementId: String) {
        if placementId == interstitialPlacement { interstitialDidStart() }
        if placementId == rewardedPlacement { rewardedDidStart() }
    }

    public func unityAdsShowClick(_ placementId: String) {
        if placementId == interstitialPlacement {
            notifyListeners("interstitialAdClicked", data: [:])
        }
        if placementId == rewardedPlacement {
            notifyListeners("onRewardedVideoAdClicked", data: [:])
        }
    }

    public func unityAdsShowComplete(_ placementId: String, withFinishState state: UnityAdsShowCompletionState) {
        let completed = state.rawValue == 1
        if placementId == interstitialPlacement { interstitialDidComplete(completed) }
        if placementId == rewardedPlacement {
            if completed { rewardedDidEarn() }
            rewardedDidComplete(completed)
        }
    }

    public func unityAdsShowFailed(_ placementId: String, withError error: UnityAdsShowError, withMessage message: String) {
        let detail = "[\(error.rawValue)] \(message)"
        if placementId == interstitialPlacement { interstitialDidFail(detail) }
        if placementId == rewardedPlacement { rewardedDidFail(detail) }
    }

    fileprivate func interstitialDidStart() {
        guard interstitialCall != nil else { return }
        interstitialStarted = true
        interstitialWatchdog?.cancel()
        notifyListeners("interstitialAdShowed", data: [:])
        let work = DispatchWorkItem { [weak self] in
            guard let self = self, self.interstitialCall != nil else { return }
            let reason = "Interstitial did not complete within 75 seconds"
            if let vc = self.interstitialPresenter { self.forceDismissPresentedAd(vc, reason: reason) }
            self.interstitialDidFail(reason)
        }
        interstitialWatchdog = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.showCompletionTimeout, execute: work)
    }
    fileprivate func interstitialDidComplete(_ completed: Bool) {
        guard interstitialCall != nil else { return }
        interstitialWatchdog?.cancel()
        notifyListeners("interstitialAdDismissed", data: ["completed": completed])
        interstitialCall?.resolve()
        interstitialCall = nil
        interstitialPresenter = nil
    }
    fileprivate func interstitialDidFail(_ message: String) {
        guard interstitialCall != nil else { return }
        interstitialWatchdog?.cancel()
        notifyListeners("interstitialAdFailedToShow", data: ["message": message])
        interstitialCall?.reject(message)
        interstitialCall = nil
        interstitialPresenter = nil
    }

    fileprivate func rewardedDidStart() {
        guard rewardedCall != nil else { return }
        rewardedStarted = true
        rewardedWatchdog?.cancel()
        notifyListeners("onRewardedVideoAdShowed", data: [:])
        let work = DispatchWorkItem { [weak self] in
            guard let self = self, self.rewardedCall != nil else { return }
            let reason = "Rewarded ad did not complete within 75 seconds"
            if let vc = self.rewardedPresenter { self.forceDismissPresentedAd(vc, reason: reason) }
            self.rewardedDidFail(reason)
        }
        rewardedWatchdog = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.showCompletionTimeout, execute: work)
    }
    fileprivate func rewardedDidEarn() {
        guard rewardedStarted && rewardedCall != nil else { return }
        rewardedEarned = true
    }
    fileprivate func rewardedDidComplete(_ completed: Bool) {
        guard rewardedCall != nil else { return }
        rewardedWatchdog?.cancel()
        // Emit the reward immediately before dismissal only when the same show
        // both earned a reward and reached Unity's completed state. This blocks
        // stale/partial callbacks from granting a reward after a failed black view.
        if rewardedStarted && rewardedEarned && completed {
            notifyListeners("onRewardedVideoAdReward", data: ["completed": true])
        }
        notifyListeners("onRewardedVideoAdDismissed", data: ["completed": completed, "earned": rewardedEarned])
        rewardedCall?.resolve()
        rewardedCall = nil
        rewardedPresenter = nil
        rewardedEarned = false
    }
    fileprivate func rewardedDidFail(_ message: String) {
        guard rewardedCall != nil else { return }
        rewardedWatchdog?.cancel()
        notifyListeners("onRewardedVideoAdFailedToShow", data: ["message": message])
        rewardedCall?.reject(message)
        rewardedCall = nil
        rewardedPresenter = nil
        rewardedEarned = false
    }

    @objc func showBanner(_ call: CAPPluginCall) {
        guard let id = placement(call) else { return }
        guard initialized else { call.reject("Unity Ads is not initialized"); return }
        guard let vc = bridge?.viewController else { call.reject("View controller is unavailable"); return }
        if let banner = banner {
            DispatchQueue.main.async { banner.view.isHidden = false; call.resolve() }
            return
        }
        let config = UADSBannerLoadConfigurationBuilder(
            placementId: id, bannerSize: CGSize(width: 320, height: 50), delegate: self
        ).build()
        DispatchQueue.main.async {
            UADSBannerAd.load(config) { [weak self] ad, error in
                guard let self = self else { call.reject("Ads bridge was released"); return }
                guard let ad = ad, error == nil else {
                    let message = error?.message ?? "No banner fill"
                    self.notifyListeners("bannerAdFailedToLoad", data: self.errorData(message, code: error?.code))
                    call.reject(message)
                    return
                }
                self.banner = ad
                self.bannerImpressionReceived = false
                ad.onAdExpired = { [weak self] expired in
                    guard let self = self, self.banner === expired else { return }
                    self.removeBannerView()
                    self.notifyListeners("bannerAdFailedToLoad", data: ["message": "Banner expired"])
                }
                DispatchQueue.main.async {
                    let view = ad.view
                    view.isOpaque = false
                    view.backgroundColor = .clear
                    view.translatesAutoresizingMaskIntoConstraints = false
                    vc.view.addSubview(view)
                    NSLayoutConstraint.activate([
                        view.centerXAnchor.constraint(equalTo: vc.view.centerXAnchor),
                        view.bottomAnchor.constraint(equalTo: vc.view.safeAreaLayoutGuide.bottomAnchor),
                        view.widthAnchor.constraint(equalToConstant: 320),
                        view.heightAnchor.constraint(equalToConstant: 50)
                    ])
                    self.notifyListeners("bannerAdSizeChanged", data: ["height": 50])
                    self.notifyListeners("bannerAdLoaded", data: [:])
                    call.resolve()
                    self.armBannerImpressionWatchdog(ad)
                }
            }
        }
    }

    private func armBannerImpressionWatchdog(_ ad: UADSBannerAd) {
        bannerImpressionWatchdog?.cancel()
        let work = DispatchWorkItem { [weak self, weak ad] in
            guard let self = self, let ad = ad,
                  self.banner === ad, !self.bannerImpressionReceived else { return }
            self.removeBannerView()
            self.notifyListeners("bannerAdFailedToLoad", data: ["message": "Banner loaded but produced no impression"])
        }
        bannerImpressionWatchdog = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.bannerImpressionTimeout, execute: work)
    }

    private func removeBannerView() {
        bannerImpressionWatchdog?.cancel()
        bannerImpressionWatchdog = nil
        bannerImpressionReceived = false
        DispatchQueue.main.async { [weak self] in
            self?.banner?.view.removeFromSuperview()
            self?.banner = nil
        }
    }

    public func bannerImpression(_ banner: UADSBannerAd) {
        guard self.banner === banner else { return }
        bannerImpressionReceived = true
        bannerImpressionWatchdog?.cancel()
        bannerImpressionWatchdog = nil
        notifyListeners("bannerAdImpression", data: [:])
    }
    public func bannerDidClick(_ banner: UADSBannerAd) {
        notifyListeners("bannerAdClicked", data: [:])
    }
    public func bannerDidFailShow(_ banner: UADSBannerAd, error: UnityAdsError) {
        guard self.banner === banner else { return }
        removeBannerView()
        notifyListeners("bannerAdFailedToLoad", data: errorData(error.message, code: error.code))
    }

    @objc func hideBanner(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.banner?.view.isHidden = true; call.resolve() }
    }
    @objc func resumeBanner(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let banner = self.banner else { call.reject("Banner is not loaded"); return }
            banner.view.isHidden = false
            call.resolve()
        }
    }
    @objc func removeBanner(_ call: CAPPluginCall) {
        removeBannerView()
        call.resolve()
    }
}
