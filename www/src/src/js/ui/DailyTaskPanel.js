/**
 * DailyTaskPanel — Günlük görevler paneli
 * Tiliq'teki .missions-card stilini yansıtır.
 * Ana menüde inline gösterim + modal detay paneli.
 */

class DailyTaskPanel {
  constructor() { this._el = null; this._tasks = []; }

  mount(container = document.body) {
    if (this._el) return;
    this._el = document.createElement('div');
    this._el.className = 'tq-overlay daily-panel hidden';
    this._el.setAttribute('role','dialog');
    this._el.innerHTML = `
      <div class="tq-modal-card">
        <div class="tq-modal-head">
          <h3>📋 Günlük Görevler</h3>
          <button class="tq-icon-btn" id="dtp-close">✕</button>
        </div>
        <div class="tq-modal-body" id="dtp-list"></div>
      </div>`;
    container.appendChild(this._el);
    document.getElementById('dtp-close').onclick = () => this.hide();
    this._el.onclick = e => { if (e.target === this._el) this.hide(); };
  }

  show()  { if (!this._el) this.mount(); this._el.classList.remove('hidden'); }
  hide()  { this._el?.classList.add('hidden'); }

  refresh(tasks) {
    this._tasks = tasks;
    this._renderList();
    this._renderMenuInline(tasks);
  }

  _renderList() {
    const el = document.getElementById('dtp-list');
    if (!el) return;
    el.innerHTML = this._tasks.map(t => {
      const pct  = Math.min(100, Math.round(t.progress / t.target * 100));
      const done = t.completed;
      return `
        <div class="dtp-item ${done?'dtp-done':''}" data-task="${t.id}">
          <div class="dtp-row">
            <span class="dtp-desc">${t.desc}</span>
            <span class="dtp-reward">+${t.reward} 🪙</span>
          </div>
          <div class="dtp-bar-wrap"><div class="dtp-bar" style="width:${pct}%"></div></div>
          <div class="dtp-count">${done?'<span class="dtp-check">✅ Tamamlandı</span>':`${t.progress} / ${t.target}`}</div>
        </div>`;
    }).join('');
  }

  // Ana menüdeki .missions-card elemanını güncelle
  _renderMenuInline(tasks) {
    const card = document.querySelector('.missions-card');
    if (!card) return;
    const rows = card.querySelectorAll('.mission-row');
    tasks.forEach((t, i) => {
      const row = rows[i]; if (!row) return;
      const lbl  = row.querySelector('.mission-lbl');
      const fill = row.querySelector('.mission-fill');
      const cnt  = row.querySelector('.mission-cnt');
      if (lbl)  { lbl.textContent = t.desc; lbl.classList.toggle('done', t.completed); }
      if (fill) fill.style.width = `${Math.min(100, Math.round(t.progress / t.target * 100))}%`;
      if (cnt)  cnt.textContent  = t.completed ? '✅' : `${t.progress}/${t.target}`;
    });
  }

  animateCoinReward(taskId, amount) {
    const el = this._el?.querySelector(`[data-task="${taskId}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const coin = document.createElement('div');
    coin.className = 'tq-coin-float';
    coin.textContent = `+${amount} 🪙`;
    coin.style.cssText = `position:fixed;left:${rect.left + rect.width/2}px;top:${rect.top}px;transform:translateX(-50%);z-index:9999;pointer-events:none;`;
    document.body.appendChild(coin);
    coin.addEventListener('animationend', () => coin.remove());
  }
}

const dailyTaskPanel = new DailyTaskPanel();
export default dailyTaskPanel;
