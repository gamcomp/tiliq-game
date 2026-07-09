/**
 * game-integration.js — Tiliq Modül Entegrasyonu
 *
 * game.html'e şu tek satırı ekle:
 *   <script type="module" src="src/js/game-integration.js"></script>
 *
 * Tiliq'in mevcut global değişkenleri:
 *   score, best, combo, bombsLeft, undosLeft (game.html'de tanımlı)
 *
 * Bağlantı noktaları için oyun döngüsünde şunları çağır:
 *   window.tiliq.onPiecePlaced(currentScore)
 *   window.tiliq.onLinesCleared(linesCount, currentScore)
 *   window.tiliq.onGameOver(finalScore)
 *   window.tiliq.showContinueAd(callback)
 *   window.tiliq.showUndoAd(callback)
 *   window.tiliq.showBombAd(callback)
 */

import AdManager           from './AdManager.js';
import DifficultyManager   from './DifficultyManager.js';
import StoreManager        from './StoreManager.js';
import RewardDialog        from './ui/RewardDialog.js';
import ComboIndicator      from './ui/ComboIndicator.js';
import DailyTaskPanel      from './ui/DailyTaskPanel.js';
import StoreModal          from './ui/StoreModal.js';
import AdLoadingOverlay    from './ui/AdLoadingOverlay.js';
import AuthManager         from './AuthManager.js';
import LeaderboardManager  from './LeaderboardManager.js';

// ── Firebase Config — console.firebase.google.com'dan al ────────────────────
// TODO: Aşağıdaki değerleri kendi Firebase projenin bilgileriyle doldur
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCXfNxeDuZYfs0WgWEkfa5EyxK4WxWE8Fg",
  authDomain:        "tiliq-1c0a8.firebaseapp.com",
  projectId:         "tiliq-1c0a8",
  storageBucket:     "tiliq-1c0a8.firebasestorage.app",
  messagingSenderId: "158314507461",
  appId:             "1:158314507461:web:f086fb6fd8778221b314ac",
  measurementId:     "G-E10E6LL5P6",
};

// ── CSS'leri yükle ───────────────────────────────────────────────────────────

['src/css/dialogs.css','src/css/combo.css','src/css/store.css'].forEach(href => {
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = href;
  document.head.appendChild(link);
});

// ── Toast yardımcısı ─────────────────────────────────────────────────────────

function toast(msg, ms = 3000) {
  let el = document.getElementById('_tq_toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '_tq_toast';
    el.style.cssText = 'position:fixed;bottom:calc(env(safe-area-inset-bottom,20px) + 20px);left:50%;transform:translateX(-50%);background:#2E1810;border:1px solid rgba(255,190,120,.2);border-radius:12px;padding:11px 18px;font-size:13px;color:#FFF4E8;z-index:9998;max-width:88vw;text-align:center;pointer-events:none;opacity:0;transition:opacity .2s;white-space:nowrap;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, ms);
}

// ── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  window.TILIQ_DEBUG  = false;   // true yapınca console logları açılır
  window.AD_TEST_MODE = false;   // gerçek AdMob ID'leri aktif

  // 1. UI bileşenlerini DOM'a bağla
  AdLoadingOverlay.mount(document.body, () => AdManager.isPremium());
  RewardDialog.mount(document.body);
  ComboIndicator.mount(document.body);
  DailyTaskPanel.mount(document.body);
  StoreModal.mount(document.body);
  window._adLoadingOverlay = AdLoadingOverlay;

  // 2. StoreManager
  StoreManager.onCoinsChanged  = b  => { StoreModal.updateCoinDisplay(b); _syncHUDCoins(b); };
  StoreManager.onPurchaseError = msg => toast(`❌ ${msg}`);
  StoreManager.onTaskCompleted = (t,r) => {
    DailyTaskPanel.animateCoinReward(t.id, r);
    toast(`✅ Görev tamamlandı: +${r} 🪙`);
    DailyTaskPanel.refresh(StoreManager.getDailyTasks());
  };
  await StoreManager.init();

  // 3. DifficultyManager
  DifficultyManager.onComboWarning   = ()    => ComboIndicator.showWarning();
  DifficultyManager.onComboUpdate    = (m,c) => ComboIndicator.update(m, c);
  DifficultyManager.onComboHighlight = (on)  => window.dispatchEvent(new CustomEvent('tiliq:comboHighlight',{detail:{on}}));
  DifficultyManager.onSpeedTick      = t     => window.dispatchEvent(new CustomEvent('tiliq:speedTick',{detail:{t}}));
  DifficultyManager.onSpeedEnd       = ()    => window.dispatchEvent(new CustomEvent('tiliq:speedEnd'));
  DifficultyManager.init('classic');

  // 4. AdManager (ATT + AdMob)
  await AdManager.init();

  // 5. Firebase Auth + Leaderboard
  if (FIREBASE_CONFIG.apiKey !== 'BURAYA_API_KEY') {
    await AuthManager.init(FIREBASE_CONFIG);
    const { getApps } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    LeaderboardManager.init(getApps()[0], AuthManager);
    AuthManager.onAuthChanged = user => _updateAuthUI(user);
    _updateAuthUI(AuthManager.getUser());
    // game.html'nin renderLB fonksiyonu için global referanslar
    window._leaderboardManager = LeaderboardManager;
    window._authManager        = AuthManager;
  }
  // Tema sistemi için StoreManager referansı
  window._storeManager = StoreManager;

  // 6. Mevcut Tiliq butonlarına kancala
  _hookUI();

  // Başlangıçta görevleri güncelle
  DailyTaskPanel.refresh(StoreManager.getDailyTasks());

  // Satın alınan temayı uygula
  const savedTheme = StoreManager.getActiveTheme();
  if (savedTheme && savedTheme !== 'dark') {
    window.applyThemePalette?.(savedTheme);
  }

  console.log('[Tiliq] Modüller hazır.');
}

// ── Auth UI ────────────────────────────────────────────────────────────────────
function _updateAuthUI(user) {
  const signinArea  = document.getElementById('auth-signin-area');
  const signoutArea = document.getElementById('auth-signout-area');
  const userInfo    = document.getElementById('auth-user-info');
  const isReal      = user && !AuthManager.isAnonymous();
  if (signinArea)  signinArea.style.display  = isReal ? 'none' : 'block';
  if (signoutArea) signoutArea.style.display = isReal ? 'block' : 'none';
  if (userInfo && isReal) userInfo.textContent = `${user.name}${user.email ? ` (${user.email})` : ''}`;
}

// Global sign-in/out — game.html onclick'lerinden çağrılır
window._authSignIn = async provider => {
  try {
    if (provider === 'google') await AuthManager.signInWithGoogle();
    else                       await AuthManager.signInWithApple();
    toast('✅ Giriş yapıldı!');
  } catch (e) { toast(`❌ Giriş hatası: ${e.message}`); }
};
window._authSignOut = async () => {
  await AuthManager.signOut();
  toast('Çıkış yapıldı.');
};

// ── HUD coin göstergesi ───────────────────────────────────────────────────────
function _syncHUDCoins(balance) {
  // Tiliq'in HUD'unda coin chip varsa güncelle
  const el = document.getElementById('coin-chip-val') ?? document.querySelector('[data-coin-display]');
  if (el) el.textContent = balance.toLocaleString('tr');
}

// ── Mevcut Tiliq global fonksiyonlarını sar ──────────────────────────────────
function _hookUI() {
  // Tiliq'in kendi store modal'ını bizimkiyle değiştir
  window.showTmStoreModal = () => StoreModal.show(StoreManager, AdManager);
  window.hideTmStoreModal = () => StoreModal.hide();

  // Missions card tıklaması → görev panelini aç
  document.getElementById('missions-card')?.addEventListener('click', () => {
    DailyTaskPanel.refresh(StoreManager.getDailyTasks());
    DailyTaskPanel.show();
  });

  // Undo butonu — stoktaki hakkı önce kullan, yoksa reklam sor
  const _origUndo = window.doUndo?.bind(window);
  window.doUndo = () => {
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn?.disabled) return;
    if (StoreManager.useUndo()) { _origUndo?.(); return; }
    RewardDialog.show('geriAl',
      () => AdManager.showRewarded('geriAl', ok => {
        RewardDialog.hide();
        if (ok) { StoreManager.progressTask('ads',1); _origUndo?.(); }
        else    { toast('❌ Reklam tamamlanamadı.'); }
      }),
      () => {}
    );
  };

  // Game over hook — skoru Firestore'a gönder
  const _origGameOver = window.onGameOver?.bind(window);
  window.onGameOver = (s) => {
    _origGameOver?.(s);
    LeaderboardManager.pushScore(s).catch(e => console.warn('[LB]', e));
    StoreManager.addGameEndCoins(s);
    StoreManager.progressTask('games', 1);
    StoreManager.progressTask('score', s);
  };

  // Tekrar Oyna — her seferinde interstitial göster
  const _origRestart = window.restartGame?.bind(window);
  window.restartGame = () => AdManager.showInterstitial(_origRestart);

  // Rescue butonu (kurtarma hakkı)
  const _origRescue = window.doRescue?.bind(window);
  window.doRescue = () => {
    if (StoreManager.useUndo()) { _origRescue?.(); return; }
    RewardDialog.show('kurtarma',
      () => AdManager.showRewarded('kurtarma', ok => {
        RewardDialog.hide();
        if (ok) { StoreManager.progressTask('ads',1); _origRescue?.(); }
        else    { toast('❌ Reklam tamamlanamadı.'); }
      }),
      () => {}
    );
  };

  // Bomb butonu — stoktaki bombaları önce kullan, yoksa reklam sor
  const _origBomb = window.activateBomb?.bind(window);
  window.activateBomb = () => {
    if (StoreManager.useBomb()) { _origBomb?.(); return; }
    RewardDialog.show('bomba',
      () => AdManager.showRewarded('bomba', ok => {
        RewardDialog.hide();
        if (ok) { StoreManager.progressTask('ads',1); _origBomb?.(); }
        else    { toast('❌ Reklam tamamlanamadı.'); }
      }),
      () => {}
    );
  };
}

// ── Dışa Açık API ────────────────────────────────────────────────────────────

window.tiliq = {

  /** Her hamle sonrası — yeni parçaları döndürür */
  onPiecePlaced(score) {
    StoreManager.progressTask('pieces', 1);
    return DifficultyManager.getNextPieces(score);
  },

  /** Satır/sütun temizlenince — kombo çarpanını döndürür */
  onLinesCleared(lines, score) {
    const mult = DifficultyManager.updateCombo(lines);
    if (lines > 0) {
      StoreManager.progressTask('lines', lines);
      StoreManager.progressTask('score', score);
    } else {
      DifficultyManager.breakCombo();
    }
    return mult;
  },

  /** Oyun bitti */
  async onGameOver(finalScore, opts = {}) {
    const earned = StoreManager.addGameEndCoins(finalScore);
    StoreManager.progressTask('games', 1);
    StoreManager.progressTask('score', finalScore);
    if (!opts.usedUndo) StoreManager.progressTask('clean_win', 1);
    if (earned > 0) toast(`+${earned} 🪙 kazandın!`);
    LeaderboardManager.pushScore(finalScore).catch(() => {});
    await AdManager.showInterstitialIfEligible();
    AdManager.showBanner('gameover');
  },

  /** Ana menüye dönüldüğünde */
  onReturnToMenu() {
    AdManager.hideBanner();
    ComboIndicator.hide();
    DifficultyManager.destroy();
    DifficultyManager.init('classic');
    DailyTaskPanel.refresh(StoreManager.getDailyTasks());
  },

  /** "Devam Et" reklamı (game over ekranı) */
  showContinueAd(onSuccess) {
    RewardDialog.show('kurtarma',
      () => AdManager.showRewarded('kurtarma', ok => {
        RewardDialog.hide();
        if (ok) { onSuccess(); } else { toast('❌ Reklam tamamlanamadı.'); }
      }),
      () => {}
    );
  },

  /** Geri al — önce stoktaki kullanır, yoksa reklam */
  showUndoAd(onSuccess) {
    if (StoreManager.useUndo()) { onSuccess(); return; }
    RewardDialog.show('geriAl',
      () => AdManager.showRewarded('geriAl', ok => {
        RewardDialog.hide();
        if (ok) { StoreManager.progressTask('ads',1); onSuccess(); }
        else    { toast('❌ Reklam tamamlanamadı.'); }
      })
    );
  },

  /** Bomba — önce stoktaki kullanır, yoksa reklam */
  showBombAd(onSuccess) {
    if (StoreManager.useBomb()) { onSuccess(); return; }
    RewardDialog.show('bomba',
      () => AdManager.showRewarded('bomba', ok => {
        RewardDialog.hide();
        if (ok) { StoreManager.progressTask('ads',1); onSuccess(); }
        else    { toast('❌ Reklam tamamlanamadı.'); }
      })
    );
  },

  getSpeedTimeLeft: () => DifficultyManager.speedTimeLeft,
  openStore:        () => StoreModal.show(StoreManager, AdManager),
  openTasks:        () => { DailyTaskPanel.refresh(StoreManager.getDailyTasks()); DailyTaskPanel.show(); },
};

// Başlat — DOM + game.html scriptleri yüklendikten sonra
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  // Oyunun kendi script'lerinin hook'ları tanımlaması için bir tick bekle
  setTimeout(bootstrap, 0);
}
