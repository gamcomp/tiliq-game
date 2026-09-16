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
    kind: 'unity',
    get active(){
      const config = ids();
      return !!(native() && config?.gameId && config?.interstitial &&
        config?.rewarded && config?.banner);
    },
    async initialize(options={}){
      const config = ids();
      if(!provider.active) throw new Error('Unity Ads IDs or native bridge are missing');
      // Unity test mode is controlled only by our own config. Capacitor's
      // distribution environment belongs to the old AdMob path and must not
      // silently change Unity's inventory mode.
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
