/**
 * StoreManager — Tiliq Mağaza ve Ekonomi Yöneticisi
 * Coin sistemi, ürün kataloğu, IAP, günlük görevler, streak.
 * localStorage prefix: 'tiliq_'
 */

const PRODUCTS = [
  { id:'bomb_1',     type:'consumable',   price:10,   currency:'coin', icon:'💣', name:'1 Bomba',    reward:{bombs:1} },
  { id:'bomb_5',     type:'consumable',   price:40,   currency:'coin', icon:'💣', name:'5 Bomba',    reward:{bombs:5} },
  { id:'undopack',   type:'consumable',   price:25,   currency:'coin', icon:'↩️',  name:'3 Geri Al',  reward:{undos:3} },
  { id:'theme_neon', type:'permanent',    price:200,  currency:'coin', icon:'💡', name:'Neon Tema',  reward:{theme:'neon'} },
  { id:'theme_retro',type:'permanent',    price:200,  currency:'coin', icon:'🕹️', name:'Retro Tema', reward:{theme:'retro'} },
  { id:'no_ads',     type:'permanent',    price:4.99, currency:'usd',  icon:'🚫', name:'Reklamsız',  reward:{premium:true} },
  { id:'vip_month',  type:'subscription', price:9.99, currency:'usd',  icon:'👑', name:'VIP Aylık',  reward:{premium:true,weeklyCoins:100} },
];

const TASK_POOL = [
  { id:'score_1000',  desc:'1.000 puan kazan',         target:1000, type:'score',     reward:15 },
  { id:'score_3000',  desc:'3.000 puan kazan',         target:3000, type:'score',     reward:20 },
  { id:'score_5000',  desc:'5.000 puan kazan',         target:5000, type:'score',     reward:30 },
  { id:'clear_5',     desc:'5 satır temizle',          target:5,    type:'lines',     reward:15 },
  { id:'clear_10',    desc:'10 satır temizle',         target:10,   type:'lines',     reward:25 },
  { id:'combo_3',     desc:'×3 kombo yap',             target:3,    type:'combo',     reward:20 },
  { id:'play_2',      desc:'2 oyun oyna',              target:2,    type:'games',     reward:15 },
  { id:'play_3',      desc:'3 oyun oyna',              target:3,    type:'games',     reward:20 },
  { id:'watch_ad',    desc:'1 reklam izle',            target:1,    type:'ads',       reward:10 },
  { id:'place_50',    desc:'50 parça yerleştir',       target:50,   type:'pieces',    reward:15 },
  { id:'no_undo',     desc:'Geri al kullanmadan kazan',target:1,    type:'clean_win', reward:25 },
];

const K = {
  coins:'tiliq_coins', bombs:'tiliq_bombs', undos:'tiliq_undos',
  premium:'tiliq_premium', owned:'tiliq_owned', theme:'tiliq_theme',
  streak:'tiliq_streak', lastLogin:'tiliq_last_login',
  weeklyCoins:'tiliq_weekly_coins', taskDate:'tiliq_task_date',
  taskList:'tiliq_task_list', taskProgress:'tiliq_task_progress',
};

const today = () => new Date().toISOString().slice(0,10);

function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

class StoreManager {
  constructor() {
    this._iap      = null;
    this._isNative = false;
    this.onCoinsChanged  = null;
    this.onPurchaseError = null;
    this.onTaskCompleted = null;
    this._log = (...a) => { if (window.TILIQ_DEBUG) console.log('[StoreManager]', ...a); };
  }

  async init() {
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      this._iap = Purchases;
      this._isNative = true;
      await this._fetchProductInfo();
    } catch { this._isNative = false; }
    this._updateStreak();
    this._refreshVipCoins();
    this._initDailyTasks();
    this._log(`Coin:${this.getCoins()} Streak:${this.getStreak()}`);
  }

  async _fetchProductInfo() {
    try {
      const offerings = await this._iap.getOfferings();
      const pkgs = offerings?.current?.availablePackages ?? [];
      pkgs.forEach(pkg => {
        const p = PRODUCTS.find(x => this._storeId(x.id) === pkg.product?.productIdentifier);
        if (p) p.price = pkg.product?.priceString ?? p.price;
      });
    } catch {}
  }

  // App Store / Play Store ürün ID formatı: com.tiliq.game.{id}
  _storeId(id) { return `com.tiliq.game.${id}`; }

  // ── Coin ─────────────────────────────────────────────────────────────────

  getCoins() { return parseInt(localStorage.getItem(K.coins) || '0'); }

  addCoins(n) {
    const b = this.getCoins() + Math.floor(n);
    localStorage.setItem(K.coins, String(b));
    this.onCoinsChanged?.(b);
    this._log(`+${n} coin → ${b}`);
    return b;
  }

  spendCoins(n) {
    const b = this.getCoins();
    if (b < n) return false;
    localStorage.setItem(K.coins, String(b - n));
    this.onCoinsChanged?.(b - n);
    return true;
  }

  addGameEndCoins(score) { const r = Math.floor(score / 100); if (r > 0) this.addCoins(r); return r; }
  addAdRewardCoins()     { return this.addCoins(10); }

  // ── Envanter ─────────────────────────────────────────────────────────────

  getBombs() { return parseInt(localStorage.getItem(K.bombs) || '0'); }
  getUndos()  { return parseInt(localStorage.getItem(K.undos)  || '3'); }

  useBomb()  { const n = this.getBombs(); if (!n) return false; localStorage.setItem(K.bombs, n-1); return true; }
  useUndo()  { const n = this.getUndos();  if (!n) return false; localStorage.setItem(K.undos,  n-1); return true; }

  _addBombs(n) { localStorage.setItem(K.bombs, this.getBombs() + n); }
  _addUndos(n) { localStorage.setItem(K.undos,  this.getUndos()  + n); }

  // ── Satın Alma ────────────────────────────────────────────────────────────

  async purchase(productId) {
    const p = PRODUCTS.find(x => x.id === productId);
    if (!p) { this._err('Ürün bulunamadı.'); return false; }
    if (p.type === 'permanent' && this.owns(productId)) { this._err('Bu ürüne zaten sahipsiniz.'); return false; }
    return p.currency === 'coin' ? this._coinPurchase(p) : this._iapPurchase(p);
  }

  _coinPurchase(p) {
    if (!this.spendCoins(p.price)) { this._err('Yetersiz coin! Reklam izleyerek kazanabilirsiniz.'); return false; }
    this._applyReward(p); return true;
  }

  async _iapPurchase(p) {
    if (!this._isNative) {
      const ok = window.confirm(`[SİMÜLASYON] "${p.name}" — ${p.price} USD\nSatın al?`);
      if (ok) { this._applyReward(p); return true; }
      return false;
    }
    try {
      const offerings = await this._iap.getOfferings();
      const pkg = (offerings?.current?.availablePackages ?? [])
        .find(x => x.product?.productIdentifier === this._storeId(p.id));
      if (!pkg) { this._err('Ürün bulunamadı.'); return false; }
      const { customerInfo } = await this._iap.purchasePackage({ aPackage: pkg });
      const active = customerInfo?.entitlements?.active ?? {};
      if (active[p.id] || active['premium']) { this._applyReward(p); return true; }
      return false;
    } catch (e) {
      if (!e.userCancelled) this._err(`Satın alma başarısız: ${e.message ?? 'Hata'}`);
      return false;
    }
  }

  _applyReward(p) {
    const r = p.reward;
    if (r.bombs)   this._addBombs(r.bombs);
    if (r.undos)   this._addUndos(r.undos);
    if (r.premium) localStorage.setItem(K.premium, '1');
    if (r.theme)   localStorage.setItem(K.theme, r.theme);
    if (p.type === 'permanent') {
      const o = this._getOwned();
      if (!o.includes(p.id)) { o.push(p.id); localStorage.setItem(K.owned, JSON.stringify(o)); }
    }
  }

  async restorePurchases() {
    if (!this._isNative) { alert('Satın almalarınız geri yüklendi. (Simülasyon)'); return; }
    try {
      const { customerInfo } = await this._iap.restorePurchases();
      const active = customerInfo?.entitlements?.active ?? {};
      const o = this._getOwned();
      PRODUCTS.filter(p => p.currency === 'usd').forEach(p => {
        if (active[p.id] || active['premium']) {
          this._applyReward(p);
          if (!o.includes(p.id)) o.push(p.id);
        }
      });
      localStorage.setItem(K.owned, JSON.stringify(o));
      alert('Satın almalarınız başarıyla geri yüklendi.');
    } catch (e) { this._err(`Geri yükleme başarısız: ${e.message ?? 'Hata'}`); }
  }

  owns(id)      { return this._getOwned().includes(id); }
  isPremium()   { return localStorage.getItem(K.premium) === '1'; }
  getActiveTheme() { return localStorage.getItem(K.theme) || 'dark'; }
  _getOwned()   { try { return JSON.parse(localStorage.getItem(K.owned) || '[]'); } catch { return []; } }

  getProducts() { return PRODUCTS.map(p => ({ ...p, owned: this.owns(p.id) })); }

  // ── Streak ────────────────────────────────────────────────────────────────

  getStreak() { return parseInt(localStorage.getItem(K.streak) || '0'); }

  _updateStreak() {
    const t = today(), last = localStorage.getItem(K.lastLogin);
    if (!last) { localStorage.setItem(K.streak,'1'); localStorage.setItem(K.lastLogin,t); this.addCoins(5); return; }
    const diff = Math.round((new Date(t) - new Date(last)) / 86400000);
    if (diff === 0) return;
    if (diff === 1) {
      const s = this.getStreak() + 1;
      localStorage.setItem(K.streak, String(s));
      localStorage.setItem(K.lastLogin, t);
      this.addCoins(5 + Math.floor(s / 7) * 5);
    } else {
      localStorage.setItem(K.streak,'1');
      localStorage.setItem(K.lastLogin, t);
      this.addCoins(5);
    }
  }

  _refreshVipCoins() {
    if (!this.isPremium()) return;
    const p = PRODUCTS.find(x => x.id === 'vip_month');
    if (!p?.reward?.weeklyCoins) return;
    const wk = this._weekStr();
    if (localStorage.getItem(K.weeklyCoins) !== wk) {
      localStorage.setItem(K.weeklyCoins, wk);
      this.addCoins(p.reward.weeklyCoins);
    }
  }

  _weekStr() {
    const d = new Date(), day = d.getDay(), diff = d.getDate() - day + (day===0?-6:1);
    return new Date(d.setDate(diff)).toISOString().slice(0,10);
  }

  // ── Günlük Görevler ───────────────────────────────────────────────────────

  getDailyTasks() {
    this._initDailyTasks();
    const list = JSON.parse(localStorage.getItem(K.taskList) || '[]');
    const prog = JSON.parse(localStorage.getItem(K.taskProgress) || '{}');
    return list.map(id => {
      const t = TASK_POOL.find(x => x.id === id);
      const p = prog[id] ?? 0;
      return { ...t, progress: p, completed: p >= t.target };
    });
  }

  _initDailyTasks() {
    const t = today();
    if (localStorage.getItem(K.taskDate) === t) return;
    const rng = seededRng(parseInt(t.replace(/-/g,''))), pool = [...TASK_POOL], sel = [];
    for (let i = 0; i < 3; i++) { const idx = Math.floor(rng() * pool.length); sel.push(pool[idx].id); pool.splice(idx,1); }
    localStorage.setItem(K.taskDate, t);
    localStorage.setItem(K.taskList, JSON.stringify(sel));
    localStorage.setItem(K.taskProgress, JSON.stringify({}));
  }

  progressTask(type, amount = 1) {
    const tasks = this.getDailyTasks();
    const prog  = JSON.parse(localStorage.getItem(K.taskProgress) || '{}');
    tasks.forEach(t => {
      if (t.type !== type || t.completed) return;
      prog[t.id] = Math.min((prog[t.id] ?? 0) + amount, t.target);
      if (prog[t.id] >= t.target) { this.addCoins(t.reward); this.onTaskCompleted?.(t, t.reward); }
    });
    localStorage.setItem(K.taskProgress, JSON.stringify(prog));
  }

  completeTask(taskId) {
    const t = TASK_POOL.find(x => x.id === taskId);
    if (!t) return false;
    const prog = JSON.parse(localStorage.getItem(K.taskProgress) || '{}');
    if ((prog[taskId] ?? 0) >= t.target) return false;
    prog[taskId] = t.target;
    localStorage.setItem(K.taskProgress, JSON.stringify(prog));
    this.addCoins(t.reward);
    this.onTaskCompleted?.(t, t.reward);
    return true;
  }

  _err(msg) { this._log('HATA:', msg); this.onPurchaseError?.(msg); }
}

const storeManager = new StoreManager();
export default storeManager;
