/**
 * DifficultyManager — Tiliq Zorluk ve Mod Yöneticisi
 * Ağırlıklı parça üretimi, 4 oyun modu, kombo sistemi.
 */

// Tiliq'teki SHAPES dizisiyle birebir eşleşen indeksler
const SHAPES = [
  [[0,0]],
  [[0,0],[1,0]],
  [[0,0],[0,1]],
  [[0,0],[1,0],[2,0]],
  [[0,0],[0,1],[0,2]],
  [[0,0],[1,0],[0,1],[1,1]],
  [[0,0],[1,0],[2,0],[3,0]],
  [[0,0],[0,1],[0,2],[0,3]],
  [[0,0],[1,0],[0,1]],
  [[1,0],[0,1],[1,1]],
  [[0,0],[1,0],[1,1],[2,1]],
  [[1,0],[0,1],[1,1],[0,2]],
  [[0,0],[1,0],[2,0],[1,1]],
  [[0,0],[0,1],[1,1],[2,1]],
  [[0,0],[0,1],[0,2],[1,2]],
  [[1,0],[1,1],[0,2],[1,2]],
  [[0,0],[1,0],[2,0],[2,1]],
  [[1,0],[1,1],[1,2],[0,2]],
  [[0,1],[1,0],[1,1],[2,0]],
  [[0,0],[1,0],[0,1],[2,0]],
  [[0,0],[1,0],[0,1],[0,2]],
  [[0,0],[1,0],[2,0],[0,1]],
  // 3x3 kare — sadece skor 5000+
  [[0,0],[1,0],[2,0],[0,1],[1,1],[2,1],[0,2],[1,2],[2,2]],
];

const BANDS = [
  { min:    0, max:  500, weights: [[0,40],[1,20],[2,20],[8,10],[9,10]] },
  { min:  500, max: 2000, weights: [[1,10],[2,10],[8,20],[9,20],[12,25],[5,15]] },
  { min: 2000, max: 5000, weights: [[8,15],[9,15],[12,25],[10,15],[11,15],[3,15]] },
  { min: 5000, max: Infinity, weights: [[0,5],[3,8],[4,8],[5,8],[6,8],[7,8],[8,8],[9,8],[10,8],[11,8],[12,8],[13,8],[22,9]] },
];

const COMBO_MULTS = [1, 2, 3, 5, 8];

const PALETTE = ['#FF6B6B','#FF9F43','#FECA57','#48DBFB','#FF9FF3','#54A0FF','#A29BFE','#00D2D3','#55EFC4','#FD79A8','#E17055','#6C5CE7'];

function seededRng(seed) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
}

class DifficultyManager {
  constructor() {
    this._mode        = 'classic';
    this._combo       = 0;
    this._comboTimer  = null;
    this._speedLeft   = 90;
    this._speedIv     = null;
    this._dailyRng    = null;
    this._dailyIdx    = 0;

    this.onComboWarning   = null;
    this.onComboHighlight = null;
    this.onComboUpdate    = null;
    this.onSpeedTick      = null;
    this.onSpeedEnd       = null;

    this._log = (...a) => { if (window.TILIQ_DEBUG) console.log('[DifficultyManager]', ...a); };
  }

  init(mode = 'classic', opts = {}) {
    this._mode  = mode;
    this._combo = 0;
    if (mode === 'speed')  this.speedMode();
    if (mode === 'daily')  this.dailyMode(opts.seed ?? this._todaySeed());
    if (mode === 'target') this.targetMode(opts.level ?? 1);
    return this;
  }

  // ── Parça üretimi ─────────────────────────────────────────────────────────

  getNextPieces(score) {
    if (this._mode === 'daily') return [this._dailyPiece(), this._dailyPiece(), this._dailyPiece()];
    return [this._pick(score), this._pick(score), this._pick(score)];
  }

  _pick(score) {
    const band = BANDS.find(b => score >= b.min && score < b.max) ?? BANDS[BANDS.length - 1];
    const total = band.weights.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (const [i, w] of band.weights) { r -= w; if (r <= 0) { idx = i; break; } }
    return { cells: SHAPES[idx], color: PALETTE[Math.floor(Math.random() * PALETTE.length)], placed: false, _tx: 0, _ty: 0, _ts: 0 };
  }

  // ── Modlar ────────────────────────────────────────────────────────────────

  classicMode() { this._mode = 'classic'; if (this._speedIv) clearInterval(this._speedIv); }

  speedMode() {
    this._mode     = 'speed';
    this._speedLeft = 90;
    if (this._speedIv) clearInterval(this._speedIv);
    this._speedIv = setInterval(() => {
      this._speedLeft--;
      this.onSpeedTick?.(this._speedLeft);
      if (this._speedLeft <= 0) { clearInterval(this._speedIv); this._speedIv = null; this.onSpeedEnd?.(); }
    }, 1000);
  }

  dailyMode(seed) {
    this._mode     = 'daily';
    this._dailyRng = seededRng(seed);
    this._dailyIdx = 0;
  }

  _dailyPiece() {
    const rng  = this._dailyRng;
    const band = BANDS[Math.min(Math.floor(this._dailyIdx / 30), BANDS.length - 1)];
    const total = band.weights.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total, idx = 0;
    for (const [i, w] of band.weights) { r -= w; if (r <= 0) { idx = i; break; } }
    this._dailyIdx++;
    return { cells: SHAPES[idx], color: PALETTE[Math.floor(rng() * PALETTE.length)], placed: false, _tx: 0, _ty: 0, _ts: 0 };
  }

  targetMode(level = 1) {
    this._mode        = 'target';
    this._targetLevel = level;
    this._targetScore = level * 1000;
  }

  getTargetInfo() {
    const constraints = [null,'bomba_kullanma','geri_al_kullanma','sadece_L','bomba_kullanma,geri_al_kullanma'];
    return { level: this._targetLevel, targetScore: this._targetScore, constraint: constraints[Math.min(this._targetLevel - 1, constraints.length - 1)] };
  }

  _todaySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  // ── Kombo ─────────────────────────────────────────────────────────────────

  updateCombo(linesCleared) {
    if (linesCleared === 0) {
      if (this._combo > 0) this._scheduleWarning();
      return 1;
    }
    this._combo++;
    if (this._comboTimer) { clearTimeout(this._comboTimer); this._comboTimer = null; }
    const mult = this._mult(this._combo);
    this.onComboUpdate?.(mult, this._combo);
    if (this._combo >= 3) this.onComboHighlight?.(true);
    return mult;
  }

  breakCombo() {
    if (!this._combo) return;
    this._combo = 0;
    if (this._comboTimer) { clearTimeout(this._comboTimer); this._comboTimer = null; }
    this.onComboUpdate?.(1, 0);
    this.onComboHighlight?.(false);
  }

  _scheduleWarning() {
    if (this._comboTimer) clearTimeout(this._comboTimer);
    this._comboTimer = setTimeout(() => { if (this._combo > 0) this.onComboWarning?.(); }, 2000);
  }

  _mult(c) { return COMBO_MULTS[Math.min(c - 1, COMBO_MULTS.length - 1)]; }
  get currentMultiplier() { return this._mult(Math.max(this._combo, 1)); }
  get speedTimeLeft()     { return this._speedLeft; }

  destroy() {
    if (this._speedIv)  clearInterval(this._speedIv);
    if (this._comboTimer) clearTimeout(this._comboTimer);
  }
}

const difficultyManager = new DifficultyManager();
export default difficultyManager;
