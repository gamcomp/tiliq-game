/**
 * AdManager — Tiliq Merkezi Reklam Yöneticisi
 * Capacitor + @capacitor-community/admob üzerinde çalışır.
 * Web/dev ortamında simülasyon modunda çalışır.
 */

const AD_IDS = {
  test: {
    rewarded:     'ca-app-pub-3940256099942544/1712485313',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
    banner:       'ca-app-pub-3940256099942544/2934735716',
  },
  ios: {
    rewarded:     'ca-app-pub-1366817286080705/8274070242',
    interstitial: 'ca-app-pub-1366817286080705/2069991062',
    banner:       'ca-app-pub-1366817286080705/7286658728',
  },
  android: {
    rewarded:     'ca-app-pub-1366817286080705/9010803939',
    interstitial: 'ca-app-pub-1366817286080705/5666042603',
    banner:       'ca-app-pub-1366817286080705/5782005360',
  }
};

const LOAD_TIMEOUT_MS           = 8000;
const INTERSTITIAL_EVERY_N      = 3;

class AdManager {
  constructor() {
    this._initialized  = false;
    this._admob        = null;
    this._isNative     = false;
    this._rewardedAds  = {};
    this._interstitial = { loaded: false, loading: false };
    this._bannerShown  = false;
    this._gameCount    = parseInt(localStorage.getItem('tiliq_game_count') || '0');
    this._log = (...a) => { if (window.TILIQ_DEBUG) console.log('[AdManager]', ...a); };
  }

  get _ids() {
    if (window.AD_TEST_MODE !== false) return AD_IDS.test;
    const platform = (typeof Capacitor !== 'undefined' ? Capacitor.getPlatform?.() : 'web') ?? 'web';
    return platform === 'android' ? AD_IDS.android : AD_IDS.ios;
  }

  isPremium() { return localStorage.getItem('tiliq_premium') === '1'; }

  async init() {
    if (this._initialized) return;
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      this._admob    = AdMob;
      this._isNative = true;
      await this._waitForATT();
      await this._admob.initialize({ requestTrackingAuthorization: false, initializeForTesting: window.AD_TEST_MODE !== false });
      this._log('Başlatıldı (native)');
    } catch {
      this._isNative = false;
      this._log('Web simülasyon modu');
    }
    this._initialized = true;
    this.preloadInterstitial();
    ['geriAl','bomba','kurtarma','skorX2'].forEach(t => this.preloadRewarded(t));
  }

  _waitForATT() {
    return new Promise(resolve => {
      const t = setTimeout(resolve, 5000);
      window.addEventListener('attStatus', () => { clearTimeout(t); resolve(); }, { once: true });
    });
  }

  // ── Rewarded ─────────────────────────────────────────────────────────────

  async preloadRewarded(type) {
    if (this.isPremium() || this._rewardedAds[type]?.loading) return;
    this._rewardedAds[type] = { loaded: false, loading: true };
    if (!this._isNative) {
      setTimeout(() => { this._rewardedAds[type] = { loaded: true, loading: false }; }, 800);
      return;
    }
    try {
      await this._admob.prepareRewardVideoAd({ adId: this._ids.rewarded, isTesting: window.AD_TEST_MODE !== false });
      this._rewardedAds[type] = { loaded: true, loading: false };
    } catch { this._rewardedAds[type] = { loaded: false, loading: false }; }
  }

  async showRewarded(type, callback) {
    if (this.isPremium()) { callback(true); return; }

    window._adLoadingOverlay?.show();
    const loaded = await this._waitForRewardedLoad(type);

    if (!loaded) { window._adLoadingOverlay?.showTimeout(); return; }
    window._adLoadingOverlay?.hide();

    if (!this._isNative) {
      const ok = window.confirm(`[SİMÜLASYON] Reklam izle → ${type}\nTamam = izle, İptal = vazgeç`);
      this.preloadRewarded(type);
      callback(ok);
      return;
    }

    let rewarded = false;
    this._admob.addListener('onRewardedVideoAdRewarded', () => { rewarded = true; });
    try {
      await this._admob.showRewardVideoAd();
      this.preloadRewarded(type);
      callback(rewarded);
    } catch {
      this.preloadRewarded(type);
      callback(false);
    }
  }

  _waitForRewardedLoad(type) {
    return new Promise(resolve => {
      if (this._rewardedAds[type]?.loaded) { resolve(true); return; }
      if (!this._rewardedAds[type]?.loading) this.preloadRewarded(type);
      const deadline = Date.now() + LOAD_TIMEOUT_MS;
      const iv = setInterval(() => {
        if (this._rewardedAds[type]?.loaded) { clearInterval(iv); resolve(true); }
        else if (Date.now() >= deadline)      { clearInterval(iv); resolve(false); }
      }, 200);
    });
  }

  // ── Interstitial ──────────────────────────────────────────────────────────

  async preloadInterstitial() {
    if (this.isPremium() || this._interstitial.loading) return;
    this._interstitial = { loaded: false, loading: true };
    if (!this._isNative) {
      setTimeout(() => { this._interstitial = { loaded: true, loading: false }; }, 800);
      return;
    }
    try {
      await this._admob.prepareInterstitial({ adId: this._ids.interstitial, isTesting: window.AD_TEST_MODE !== false });
      this._interstitial = { loaded: true, loading: false };
    } catch { this._interstitial = { loaded: false, loading: false }; }
  }

  async showInterstitialIfEligible() {
    if (this.isPremium()) return;
    this._gameCount++;
    localStorage.setItem('tiliq_game_count', String(this._gameCount));
    if (this._gameCount % INTERSTITIAL_EVERY_N !== 0 || !this._interstitial.loaded) return;
    if (!this._isNative) { alert('[SİMÜLASYON] Interstitial reklam'); this.preloadInterstitial(); return; }
    try { await this._admob.showInterstitial(); this.preloadInterstitial(); } catch {}
  }

  // Her zaman interstitial göster — "Tekrar Oyna" gibi zorunlu noktalarda kullan
  async showInterstitial(onDone) {
    if (this.isPremium()) { onDone?.(); return; }
    if (!this._isNative) {
      // Web simülasyonu: overlay göster, 3 sn sonra kapat
      this._showInterstitialOverlay(onDone);
      return;
    }
    try {
      if (!this._interstitial.loaded) await this._waitForInterstitialLoad();
      await this._admob.showInterstitial();
      this.preloadInterstitial();
    } catch {}
    onDone?.();
  }

  _showInterstitialOverlay(onDone) {
    let el = document.getElementById('_tq_inter_sim');
    if (!el) {
      el = document.createElement('div');
      el.id = '_tq_inter_sim';
      el.style.cssText = 'position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:inherit;';
      el.innerHTML = `
        <div style="font-size:13px;opacity:.5;margin-bottom:8px">Reklam</div>
        <div style="font-size:28px;font-weight:900;margin-bottom:6px">📺</div>
        <div style="font-size:14px;opacity:.7;margin-bottom:24px">Reklam yükleniyor…</div>
        <button id="_tq_inter_skip" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:8px;padding:8px 20px;font-size:13px;color:#fff;cursor:pointer;display:none;">✕ Kapat</button>`;
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
    const skipBtn = document.getElementById('_tq_inter_skip');
    skipBtn.style.display = 'none';
    let closed = false;
    const close = () => { if (closed) return; closed = true; el.style.display = 'none'; onDone?.(); };
    setTimeout(() => { skipBtn.style.display = 'block'; skipBtn.onclick = close; }, 3000);
    setTimeout(close, 7000);
  }

  async _waitForInterstitialLoad(ms = 5000) {
    const t0 = Date.now();
    while (!this._interstitial.loaded && Date.now() - t0 < ms) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // ── Banner ────────────────────────────────────────────────────────────────

  async showBanner(location) {
    if (this.isPremium() || this._bannerShown) return;
    this._bannerShown = true;
    this._log(`Banner: ${location}`);
    if (!this._isNative) { this._showWebBanner(location); return; }
    try {
      const { BannerAdSize, BannerAdPosition } = await import('@capacitor-community/admob');
      await this._admob.showBanner({ adId: this._ids.banner, adSize: BannerAdSize.BANNER, position: BannerAdPosition.BOTTOM_CENTER, margin: 0, isTesting: window.AD_TEST_MODE !== false });
    } catch { this._bannerShown = false; }
  }

  async hideBanner() {
    if (!this._bannerShown) return;
    this._bannerShown = false;
    this._hideWebBanner();
    if (!this._isNative) return;
    try { await this._admob.hideBanner(); } catch {}
  }

  _showWebBanner(location) {
    let el = document.getElementById('_tiliq_banner_sim');
    if (!el) {
      el = document.createElement('div');
      el.id = '_tiliq_banner_sim';
      el.style.cssText = 'position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:min(320px,100vw);height:50px;background:rgba(212,168,67,.12);border:1px dashed rgba(212,168,67,.4);display:flex;align-items:center;justify-content:center;font-size:12px;color:rgba(212,168,67,.8);z-index:9999;pointer-events:none;';
      el.textContent = `[ BANNER — ${location.toUpperCase()} ]`;
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
  }
  _hideWebBanner() { const el = document.getElementById('_tiliq_banner_sim'); if (el) el.style.display = 'none'; }
}

const adManager = new AdManager();
export default adManager;
