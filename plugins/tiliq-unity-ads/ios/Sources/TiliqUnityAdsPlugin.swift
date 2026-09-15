import Foundation
import UIKit
import Capacitor
import UnityAds

private final class InterstitialShowHandler: NSObject, UADSInterstitialShowDelegate {
    weak var plugin: TiliqUnityAdsPlugin?

    init(plugin: TiliqUnityAdsPlugin) { self.plugin = plugin }

    func showDidStart(_ unityAd: UADSInterstitialAd) {
        plugin?.notifyListeners("interstitialAdShowed", data: [:])
    }
    func showDidClick(_ unityAd: UADSInterstitialAd) {
        plugin?.notifyListeners("interstitialAdClicked", data: [:])
    }
    func showDidComplete(_ unityAd: UADSInterstitialAd, with state: UADSShowFinishState) {
        plugin?.interstitialDidComplete()
    }
    func showDidFail(_ unityAd: UADSInterstitialAd, error: UnityAdsError) {
        plugin?.interstitialDidFail(error)
    }
}

private final class RewardedShowHandler: NSObject, UADSRewardedShowDelegate {
    weak var plugin: TiliqUnityAdsPlugin?

    init(plugin: TiliqUnityAdsPlugin) { self.plugin = plugin }

    func showDidStart(_ unityAd: UADSRewardedAd) {
        plugin?.notifyListeners("onRewardedVideoAdShowed", data: [:])
    }
    func showDidClick(_ unityAd: UADSRewardedAd) {
        plugin?.notifyListeners("onRewardedVideoAdClicked", data: [:])
    }
    func showDidReceiveReward(_ unityAd: UADSRewardedAd) {
        plugin?.notifyListeners("onRewardedVideoAdReward", data: [:])
    }
    func showDidComplete(_ unityAd: UADSRewardedAd, with state: UADSShowFinishState) {
        plugin?.rewardedDidComplete()
    }
    func showDidFail(_ unityAd: UADSRewardedAd, error: UnityAdsError) {
        plugin?.rewardedDidFail(error)
    }
}

@objc(TiliqUnityAdsPlugin)
public class TiliqUnityAdsPlugin: CAPPlugin, CAPBridgedPlugin,
    UADSBannerAdDelegate {

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
    private var interstitial: UADSInterstitialAd?
    private var rewarded: UADSRewardedAd?
    private var banner: UADSBannerAd?
    private var interstitialLoading = false
    private var rewardedLoading = false
    private var interstitialCall: CAPPluginCall?
    private var rewardedCall: CAPPluginCall?
    private lazy var interstitialDelegate = InterstitialShowHandler(plugin: self)
    private lazy var rewardedDelegate = RewardedShowHandler(plugin: self)

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
        let config = UADSInitializationConfigurationBuilder(gameId: gameId)
            .with(testMode: call.getBool("testMode") ?? true)
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
        if interstitial != nil { call.resolve(); return }
        if interstitialLoading { call.reject("Interstitial load is already running"); return }
        interstitialLoading = true
        let config = UADSLoadConfigurationBuilder(placementId: id).build()
        UADSInterstitialAd.load(config) { [weak self] ad, error in
            guard let self = self else { call.reject("Ads bridge was released"); return }
            self.interstitialLoading = false
            guard let ad = ad, error == nil else {
                call.reject(error?.message ?? "No interstitial fill")
                return
            }
            self.interstitial = ad
            ad.onAdExpired = { [weak self] expired in
                if self?.interstitial === expired { self?.interstitial = nil }
            }
            call.resolve()
        }
    }

    @objc func showInterstitial(_ call: CAPPluginCall) {
        guard let ad = interstitial else { call.reject("Interstitial is not loaded"); return }
        guard let vc = bridge?.viewController else { call.reject("View controller is unavailable"); return }
        interstitial = nil
        interstitialCall = call
        let config = UADSShowConfigurationBuilder().with(viewController: vc).build()
        DispatchQueue.main.async { ad.show(config, delegate: self.interstitialDelegate) }
    }

    @objc func prepareRewardVideoAd(_ call: CAPPluginCall) {
        guard let id = placement(call) else { return }
        guard initialized else { call.reject("Unity Ads is not initialized"); return }
        if rewarded != nil { call.resolve(); return }
        if rewardedLoading { call.reject("Rewarded load is already running"); return }
        rewardedLoading = true
        let config = UADSLoadConfigurationBuilder(placementId: id).build()
        UADSRewardedAd.load(config) { [weak self] ad, error in
            guard let self = self else { call.reject("Ads bridge was released"); return }
            self.rewardedLoading = false
            guard let ad = ad, error == nil else {
                call.reject(error?.message ?? "No rewarded fill")
                return
            }
            self.rewarded = ad
            ad.onAdExpired = { [weak self] expired in
                if self?.rewarded === expired { self?.rewarded = nil }
            }
            call.resolve()
        }
    }

    @objc func showRewardVideoAd(_ call: CAPPluginCall) {
        guard let ad = rewarded else { call.reject("Rewarded ad is not loaded"); return }
        guard let vc = bridge?.viewController else { call.reject("View controller is unavailable"); return }
        rewarded = nil
        rewardedCall = call
        let config = UADSShowConfigurationBuilder().with(viewController: vc).build()
        DispatchQueue.main.async { ad.show(config, delegate: self.rewardedDelegate) }
    }

    fileprivate func interstitialDidComplete() {
        notifyListeners("interstitialAdDismissed", data: [:])
        interstitialCall?.resolve()
        interstitialCall = nil
    }
    fileprivate func interstitialDidFail(_ error: UnityAdsError) {
        notifyListeners("interstitialAdFailedToShow", data: ["message": error.message])
        interstitialCall?.reject(error.message)
        interstitialCall = nil
    }

    fileprivate func rewardedDidComplete() {
        notifyListeners("onRewardedVideoAdDismissed", data: [:])
        rewardedCall?.resolve()
        rewardedCall = nil
    }
    fileprivate func rewardedDidFail(_ error: UnityAdsError) {
        notifyListeners("onRewardedVideoAdFailedToShow", data: ["message": error.message])
        rewardedCall?.reject(error.message)
        rewardedCall = nil
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
        UADSBannerAd.load(config) { [weak self] ad, error in
            guard let self = self else { call.reject("Ads bridge was released"); return }
            guard let ad = ad, error == nil else {
                self.notifyListeners("bannerAdFailedToLoad", data: ["message": error?.message ?? "No banner fill"])
                call.reject(error?.message ?? "No banner fill")
                return
            }
            self.banner = ad
            ad.onAdExpired = { [weak self] expired in
                guard let self = self, self.banner === expired else { return }
                self.removeBannerView()
                self.notifyListeners("bannerAdFailedToLoad", data: ["message": "Banner expired"])
            }
            DispatchQueue.main.async {
                let view = ad.view
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
            }
        }
    }

    private func removeBannerView() {
        DispatchQueue.main.async { [weak self] in
            self?.banner?.view.removeFromSuperview()
            self?.banner = nil
        }
    }

    public func bannerImpression(_ banner: UADSBannerAd) {
        notifyListeners("bannerAdImpression", data: [:])
    }
    public func bannerDidClick(_ banner: UADSBannerAd) {
        notifyListeners("bannerAdClicked", data: [:])
    }
    public func bannerDidFailShow(_ banner: UADSBannerAd, error: UnityAdsError) {
        notifyListeners("bannerAdFailedToLoad", data: ["message": error.message])
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
