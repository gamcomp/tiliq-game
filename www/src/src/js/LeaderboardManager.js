/**
 * LeaderboardManager — Firestore Global Liderlik Tablosu
 *
 * Firestore koleksiyon yapısı:
 *   scores/{uid} → { uid, name, photo, score, updatedAt }
 *
 * Kullanım:
 *   import LeaderboardManager from './LeaderboardManager.js';
 *   await LeaderboardManager.init(firebaseApp, authManager);
 *   await LeaderboardManager.pushScore(1234);
 *   const top = await LeaderboardManager.getTopScores(100);
 */

import { getFirestore, doc, setDoc,
         collection, query, orderBy,
         limit, getDocs, getDoc }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

class LeaderboardManager {
  constructor() { this._db = null; this._auth = null; }

  init(app, authManager) {
    this._db   = getFirestore(app);
    this._auth = authManager;
  }

  // Skoru Firestore'a gönder — sadece kişisel rekor kırılınca yazar
  async pushScore(score) {
    const uid = this._auth?.getUID();
    if (!uid || !this._db) return;
    const ref  = doc(this._db, 'scores', uid);
    const snap = await getDoc(ref).catch(() => null);
    const prev = snap?.data()?.score ?? 0;
    if (score <= prev) return; // rekor kırılmadıysa yazma
    const user = this._auth.getUser();
    await setDoc(ref, {
      uid,
      name:      user?.name  || 'Misafir',
      photo:     user?.photo || '',
      score,
      updatedAt: Date.now(),
    });
  }

  // Top N skor — global
  async getTopScores(n = 100) {
    if (!this._db) return [];
    const q    = query(collection(this._db,'scores'), orderBy('score','desc'), limit(n));
    const snap = await getDocs(q).catch(() => null);
    if (!snap) return [];
    return snap.docs.map((d,i) => ({ rank: i+1, ...d.data() }));
  }

  // Kullanıcının kendi sırası
  async getMyRank() {
    const uid = this._auth?.getUID();
    if (!uid || !this._db) return null;
    const mySnap = await getDoc(doc(this._db,'scores',uid)).catch(() => null);
    if (!mySnap?.exists()) return null;
    const myScore = mySnap.data().score;
    const q = query(collection(this._db,'scores'), orderBy('score','desc'));
    const all = await getDocs(q).catch(() => null);
    if (!all) return null;
    const rank = all.docs.findIndex(d => d.id === uid) + 1;
    return { rank, score: myScore };
  }
}

const leaderboardManager = new LeaderboardManager();
export default leaderboardManager;
