/**
 * RewardDialog — Reklam izleme onay diyaloğu
 * Tiliq'in sıcak Akdeniz temasına uygun (--accent: #C4714A, --acc2: #D4A843)
 */

const LABELS = {
  geriAl:   { icon:'↩️',  text:'1 Geri Al hakkı' },
  bomba:    { icon:'💣',  text:'1 Bomba' },
  kurtarma: { icon:'🛟',  text:'Son satırı temizle' },
  skorX2:   { icon:'✖️2', text:'Skoru 2 katla' },
};

class RewardDialog {
  constructor() { this._el = null; this._onAccept = null; this._onCancel = null; }

  mount(container = document.body) {
    if (this._el) return;
    this._el = document.createElement('div');
    this._el.className = 'tq-overlay reward-dlg hidden';
    this._el.innerHTML = `
      <div class="tq-dlg-card">
        <div class="rdlg-icon"  id="rd-icon">📺</div>
        <div class="rdlg-title">Reklam İzle</div>
        <div class="rdlg-desc"  id="rd-desc">— kazan</div>
        <div class="rdlg-spinner hidden" id="rd-spin">
          <div class="tq-spin-ring"></div>
          <span>Reklam yükleniyor…</span>
        </div>
        <div class="rdlg-actions" id="rd-actions">
          <button class="tq-btn tq-btn-primary" id="rd-ok">📺 İzle ve Kazan</button>
          <button class="tq-btn tq-btn-sec"     id="rd-no">Vazgeç</button>
        </div>
      </div>`;
    container.appendChild(this._el);
    document.getElementById('rd-ok').onclick = () => { this._spin(true); this._onAccept?.(); };
    document.getElementById('rd-no').onclick = () => { this.hide(); this._onCancel?.(); };
    this._el.onclick = e => { if (e.target === this._el) { this.hide(); this._onCancel?.(); } };
  }

  show(type, onAccept, onCancel = null) {
    if (!this._el) this.mount();
    const info = LABELS[type] ?? { icon:'🎁', text:'Ödül' };
    document.getElementById('rd-icon').textContent = info.icon;
    document.getElementById('rd-desc').textContent = `${info.text} kazan`;
    this._spin(false);
    this._onAccept = onAccept; this._onCancel = onCancel;
    this._el.classList.remove('hidden');
  }

  hide() { this._el?.classList.add('hidden'); this._spin(false); }

  _spin(on) {
    document.getElementById('rd-spin')?.classList.toggle('hidden', !on);
    document.getElementById('rd-actions')?.classList.toggle('hidden', on);
    const ok = document.getElementById('rd-ok');
    if (ok) ok.disabled = on;
  }
}

const rewardDialog = new RewardDialog();
export default rewardDialog;
