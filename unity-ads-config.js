// Fill these values from Unity Monetization > Apps > Tiliq > Network/Placements.
// Empty IDs keep the existing ad-disabled fallback active.
window.TILIQ_UNITY_ADS = {
  // TestFlight verification build. Keep test inventory enabled so device tests
  // never create live impressions; switch this to false for the store release.
  testMode: true,
  android: {
    gameId: '',
    interstitial: '',
    rewarded: '',
    banner: '',
  },
  ios: {
    gameId: '800374323',
    interstitial: 'BP_Interstitial_iOS',
    rewarded: 'BP_Rewarded_iOS',
    banner: 'BP_Banner_iOS',
  },
};
