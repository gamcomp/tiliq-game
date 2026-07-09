/**
 * ComboIndicator — Kombo çarpanı göstergesi
 * Tiliq'teki mevcut #combo-chip ile entegre çalışır.
 * Hem kendi DOM elemanını yönetir hem de mevcut chip'i günceller.
 */

class ComboIndicator {
  constructor() { this._el = null; this._visible = false; this._warnTimer = null; }

  mount(container = document.body) {
    if (this._el) return;
    this._el = document.createElement('div');
    this._el.id = 'tq-combo-indicator';
    this._el.className = 'tq-combo hidden';
    this._el.setAttribute('aria-live', 'polite');
    this._el.innerHTML = `
      <div class="tq-combo-inner">
        <div class="tq-combo-fire hidden" id="tq-fire">🔥</div>
        <div class="tq-combo-mult"        id="tq-mult">×1</div>
        <div class="tq-combo-lbl">KOMBO</div>
      </div>
      <div class="tq-combo-warn hidden"   id="tq-warn">⚠️ Kombo kırılacak!</div>`;
    container.appendChild(this._el);
  }

  update(multiplier, comboCount) {
    if (!this._el) this.mount();

    // Mevcut Tiliq chip'ini de güncelle
    const chip = document.getElementById('combo-chip');
    const chipVal = chip?.querySelector('.chip-val');
    if (chipVal) chipVal.textContent = `×${multiplier}`;
    if (chip) { chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop'); }

    if (comboCount === 0 || multiplier <= 1) { this.hide(); return; }

    this._visible = true;
    this._el.classList.remove('hidden');
    document.getElementById('tq-mult').textContent = `×${multiplier}`;
    document.getElementById('tq-warn')?.classList.add('hidden');

    const fire = document.getElementById('tq-fire');
    this._el.classList.remove('tq-fire-on','tq-mega');

    if (comboCount >= 5)      { this._el.classList.add('tq-mega');    if (fire) fire.classList.remove('hidden'); }
    else if (comboCount >= 3) { this._el.classList.add('tq-fire-on'); if (fire) fire.classList.remove('hidden'); }
    else                      { if (fire) fire.classList.add('hidden'); }

    this._el.classList.remove('tq-pop'); void this._el.offsetWidth; this._el.classList.add('tq-pop');
    this._clearWarn();
  }

  showWarning() {
    if (!this._visible) return;
    document.getElementById('tq-warn')?.classList.remove('hidden');
    this._el?.classList.add('tq-blink');
    this._warnTimer = setTimeout(() => this._clearWarn(), 3000);
  }

  _clearWarn() {
    if (this._warnTimer) { clearTimeout(this._warnTimer); this._warnTimer = null; }
    document.getElementById('tq-warn')?.classList.add('hidden');
    this._el?.classList.remove('tq-blink');
  }

  hide() {
    this._visible = false;
    this._el?.classList.add('hidden');
    this._el?.classList.remove('tq-fire-on','tq-mega','tq-blink','tq-pop');
    this._clearWarn();
  }
}

const comboIndicator = new ComboIndicator();
export default comboIndicator;
