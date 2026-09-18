// Matches the small AdMob API surface used by Tiliq while using Unity's native SDK.
(function(){
  function platform(){
    return window.Capacitor?.getPlatform?.() || 'web';
  }
  function ids(){
    return window.TILIQ_UNITY_ADS?.[platform()] || null;
  }
  function native(){
    return window.Capacitor?.Plugins?.TiliqUnityAds || null;
  }
  function tracking(){
    // Keep the existing ATT bridge; it does not request AdMob inventory.
    return window.Capacitor?.Plugins?.AdMob || null;
  }
  const provider = {
    get active(){
      const config = ids();
      return !!(native() && config?.gameId && config?.interstitial &&
        config?.rewarded && config?.banner);
    },
    async initialize(options={}){
      const config = ids();
      if(!provider.active) throw new Error('Unity Ads IDs or native bridge are missing');
      // 2026-09-16: `options.initializeForTesting` OR'landığı için buradaki
      // `testMode` her zaman true'ya sabitleniyordu — TestFlight/sandbox
      // dağıtımında game.html sandbox algılayınca _useAdMobTestAds'i (AdMob'un
      // kendi mantığı) true yapıyor ve bu OR sayesinde unity-ads-config.js'teki
      // testMode değeri hiçbir zaman etkili olamıyordu ("gerçek reklamla test
      // edelim" denemesi bu yüzden config'i false yapmak yeterli olmazdı).
      // Unity için testMode artık YALNIZCA bizim config dosyamızdan geliyor.
      await native().initialize({
        gameId: config.gameId,
        testMode: window.TILIQ_UNITY_ADS.testMode !== false,
      });
    },
    // Unity handles its own default consent flow when Developer Consent is not enabled.
    // Missing consent signals result in contextual ads; we never fabricate opt-in.
    async requestConsentInfo(){
      return {canRequestAds:true,privacyOptionsRequirementStatus:'NOT_REQUIRED'};
    },
    trackingAuthorizationStatus(){ return tracking()?.trackingAuthorizationStatus(); },
    requestTrackingAuthorization(){ return tracking()?.requestTrackingAuthorization(); },
    setApplicationMuted(){ return Promise.resolve(); },
    setApplicationVolume(){ return Promise.resolve(); },
    addListener(event,callback){ return native().addListener(event,callback); },
    prepareInterstitial(){ return native().prepareInterstitial({adId:ids().interstitial}); },
    showInterstitial(){ return native().showInterstitial(); },
    prepareRewardVideoAd(){ return native().prepareRewardVideoAd({adId:ids().rewarded}); },
    showRewardVideoAd(){ return native().showRewardVideoAd(); },
    showBanner(){ return native().showBanner({adId:ids().banner}); },
    hideBanner(){ return native().hideBanner(); },
    resumeBanner(){ return native().resumeBanner(); },
    removeBanner(){ return native().removeBanner(); },
  };
  window.TiliqUnityAdsProvider = provider;
})();
