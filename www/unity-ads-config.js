// Fill these values from Unity Monetization > Apps > Tiliq > Network/Placements.
// Empty IDs keep the existing ad-disabled fallback active.
window.TILIQ_UNITY_ADS = {
  // 2026-09-16: Geçici olarak false — test kreatifi hiç render olmadan donuyordu
  // (watchdog dışında Unity'den hiçbir callback gelmiyordu), gerçek reklamla
  // aynı davranış olup olmadığını görmek için kapatıldı. Teşhis bitince true'ya
  // geri al.
  testMode: false,
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
