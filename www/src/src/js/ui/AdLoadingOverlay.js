/**
 * AdLoadingOverlay — Reklam yükleme göstergesi
 * 8 sn timeout. Premium kullanıcıya gösterilmez.
 */

class AdLoadingOverlay {
  constructor() { this._el = null; this._timer = null; this._isPremium = () => false; }

  mount(container = document.body, isPremiumFn = () => false) {
    if (this._el) return;
    this._isPremium = isPremiumFn;
    this._el = document.createElement('div');
    this._el.className = 'tq-overlay ad-overlay hidden';
    this._el.setAttribute('role','status');
    this._el.innerHTML = `
      <div class="tq-dlg-card ad-card">
        <div id="alo-load">
          <div class="tq-spin-ring" style="width:44px;height:44px;border-width:4px;margin:0 auto 12px"></div>
          <p class="ad-load-txt">Reklam yükleniyor…</p>
          <button class="tq-btn tq-btn-sec" id="alo-cancel">İptal</button>
        </div>
        <div id="alo-timeout" class="hidden">
          <div style="font-size:44px;margin-bottom:10px">😕</div>
          <p style="font-size:16px;font-weight:800;margin-bottom:6px">Reklam Yüklenemedi</p>
          <p class="ad-load-txt">Şu an reklam mevcut değil. Lütfen daha sonra tekrar deneyin.</p>
          <button class="tq-btn tq-btn-primary" id="alo-retry" style="margin-bottom:8px">Tekrar Dene</button>
          <button class="tq-btn tq-btn-sec"     id="alo-close">Kapat</button>
        </div>
      </div>`;
    container.appendChild(this._el);
    document.getElementById('alo-cancel').onclick = () => this.hide();
    document.getElementById('alo-close').onclick  = () => this.hide();
    document.getElementById('alo-retry').onclick  = () => { this._showLoad(); this._startTimer(); };
  }

  show()        { if (this._isPremium()) return; if (!this._el) this.mount(); this._showLoad(); this._el.classList.remove('hidden'); this._startTimer(); }
  hide()        { this._clearTimer(); this._el?.classList.add('hidden'); this._showLoad(); }
  showTimeout() { this._clearTimer(); this._showTout(); this._el?.classList.remove('hidden'); }

  _startTimer() { this._clearTimer(); this._timer = setTimeout(() => this.showTimeout(), 8000); }
  _clearTimer() { if (this._timer) { clearTimeout(this._timer); this._timer = null; } }
  _showLoad()   { document.getElementById('alo-load')?.classList.remove('hidden'); document.getElementById('alo-timeout')?.classList.add('hidden'); }
  _showTout()   { document.getElementById('alo-load')?.classList.add('hidden');    document.getElementById('alo-timeout')?.classList.remove('hidden'); }
}

const adLoadingOverlay = new AdLoadingOverlay();
export default adLoadingOverlay;
