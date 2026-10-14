// Fill these values from Unity Monetization > Apps > Tiliq > Network/Placements.
// Empty IDs keep the existing ad-disabled fallback active.
window.TILIQ_UNITY_ADS = {
  // Default for platforms without an override; retain the current iOS test setup.
  testMode: true,
  android: {
    enabled: true,
    testMode: false,
    gameId: '800393804',
    interstitial: 'BP_Interstitial_Android',
    rewarded: 'BP_Rewarded_Android',
    banner: 'BP_Banner_Android',
  },
  ios: {
    gameId: '800374323',
    interstitial: 'BP_Interstitial_iOS',
    rewarded: 'BP_Rewarded_iOS',
    banner: 'BP_Banner_iOS',
  },
};
