/**
 * StoreModal — Tiliq Mağaza Modalı
 * Tiliq'in mevcut modal stiline uyar (.modal / .modal-card)
 */

class StoreModal {
  constructor() { this._el = null; this._store = null; this._ad = null; this._tab = 'coin'; }

  mount(container = document.body) {
    if (this._el) return;
    this._el = document.createElement('div');
    this._el.className = 'modal tq-store-modal';
    this._el.id = 'tq-store-modal';
    this._el.setAttribute('role','dialog');
    this._el.innerHTML = `
      <div class="modal-card">
        <div class="modal-head">
          <h3>🛍️ Mağaza</h3>
          <div class="tq-coin-badge">🪙 <span id="sm-coins">0</span></div>
          <button class="tq-icon-btn" id="sm-close">✕</button>
        </div>
        <div class="tq-store-tabs">
          <button class="tq-stab active" data-tab="coin">Coin Harca</button>
          <button class="tq-stab"        data-tab="premium">Premium</button>
        </div>
        <div class="modal-body" id="sm-body"></div>
        <div style="padding:0 14px 14px">
          <button class="tq-restore-btn" id="sm-restore">Satın Almaları Geri Yükle (iOS)</button>
        </div>
      </div>`;
    container.appendChild(this._el);
    document.getElementById('sm-close').onclick   = () => this.hide();
    document.getElementById('sm-restore').onclick = () => this._store?.restorePurchases();
    this._el.querySelectorAll('.tq-stab').forEach(b => b.onclick = () => this._switchTab(b.dataset.tab));
    this._el.onclick = e => { if (e.target === this._el) this.hide(); };
  }

  show(store, ad) {
    if (!this._el) this.mount();
    this._store = store; this._ad = ad;
    this._render();
    this._el.classList.add('active');
  }

  hide() { this._el?.classList.remove('active'); }

  _switchTab(tab) {
    this._tab = tab;
    this._el.querySelectorAll('.tq-stab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    this._renderBody();
  }

  _render() {
    const el = document.getElementById('sm-coins');
    if (el) el.textContent = (this._store?.getCoins() ?? 0).toLocaleString('tr');
    this._renderBody();
  }

  _renderBody() {
    const body = document.getElementById('sm-body'); if (!body || !this._store) return;
    const all   = this._store.getProducts();
    const coins = this._store.getCoins();
    const items = this._tab === 'coin' ? all.filter(p => p.currency === 'coin') : all.filter(p => p.currency === 'usd');
    body.innerHTML = `<div class="tq-sg">${items.map(p => this._card(p, coins)).join('')}</div>`;
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => this._buy(b.dataset.buy));
    body.querySelectorAll('.tq-earn-btn').forEach(b => b.onclick = () => this._earnAd());
  }

  _card(p, coins) {
    const owned    = p.owned;
    const enough   = p.currency === 'usd' || coins >= p.price;
    const price    = p.currency === 'coin' ? `${p.price} 🪙`
                   : p.type === 'subscription' ? `${p.price}$/ay` : `${p.price}$`;
    const earn     = !owned && !enough && p.currency === 'coin'
                   ? `<button class="tq-earn-btn">📺 Reklam izle ile kazan</button>` : '';
    const btn      = !owned
                   ? `<button class="tq-buy-btn${enough?'':' tq-buy-dis'}" data-buy="${p.id}" ${!enough&&p.currency==='coin'?'disabled':''}>${enough?'Satın Al':'Yetersiz Coin'}</button>` : '';
    return `<div class="tq-sc${owned?' tq-owned':''}">
      <div class="tq-sc-icon">${p.icon}</div>
      <div class="tq-sc-name">${p.name}</div>
      <div class="tq-sc-price${owned?' tq-owned-lbl':''}">${owned?'✓ Sahipsiniz':price}</div>
      ${btn}${earn}
    </div>`;
  }

  async _buy(id) { if (await this._store?.purchase(id)) this._render(); }

  _earnAd() {
    this.hide();
    this._ad?.showRewarded('geriAl', ok => { if (ok) this._store?.addAdRewardCoins(); });
  }

  updateCoinDisplay(balance) {
    const el = document.getElementById('sm-coins');
    if (el) el.textContent = balance.toLocaleString('tr');
    this._renderBody();
  }
}

const storeModal = new StoreModal();
export default storeModal;
