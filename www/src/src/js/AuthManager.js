/**
 * AuthManager — Firebase Google + Apple Sign-In
 *
 * Kullanım:
 *   import AuthManager from './AuthManager.js';
 *   await AuthManager.init(firebaseConfig);
 *   AuthManager.onAuthChanged = user => { ... };
 *   await AuthManager.signInWithGoogle();
 *   await AuthManager.signInWithApple();
 *   await AuthManager.signOut();
 *   AuthManager.getUser()  → { uid, name, email, photo } | null
 */

import { initializeApp, getApps }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInAnonymously,
         onAuthStateChanged, signOut,
         signInWithCredential,
         GoogleAuthProvider,
         OAuthProvider }                 from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

class AuthManager {
  constructor() {
    this._auth      = null;
    this._user      = null;
    this._isNative  = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform?.();
    this.onAuthChanged = null; // callback(user | null)
  }

  async init(config) {
    const app  = getApps().length ? getApps()[0] : initializeApp(config);
    this._auth = getAuth(app);

    onAuthStateChanged(this._auth, u => {
      this._user = u ? this._mapUser(u) : null;
      this.onAuthChanged?.(this._user);
    });

    // İlk açılışta anonim hesap — kayıt olmadan oynamak için
    if (!this._auth.currentUser) {
      await signInAnonymously(this._auth).catch(() => {});
    }
  }

  getUser() { return this._user; }
  isSignedIn() { return !!this._user && !this._auth?.currentUser?.isAnonymous; }
  isAnonymous() { return !!this._auth?.currentUser?.isAnonymous; }

  // ── Google Sign-In ──────────────────────────────────────────────────────────

  async signInWithGoogle() {
    if (this._isNative) return this._nativeGoogle();
    // Web fallback (dev/test)
    const { signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const result = await signInWithPopup(this._auth, new GoogleAuthProvider());
    return this._mapUser(result.user);
  }

  async _nativeGoogle() {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithGoogle();
    const cred   = GoogleAuthProvider.credential(result.credential?.idToken);
    const fb     = await signInWithCredential(this._auth, cred);
    return this._mapUser(fb.user);
  }

  // ── Apple Sign-In ───────────────────────────────────────────────────────────

  async signInWithApple() {
    if (this._isNative) return this._nativeApple();
    // Web fallback
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email'); provider.addScope('name');
    const { signInWithPopup } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const result = await signInWithPopup(this._auth, provider);
    return this._mapUser(result.user);
  }

  async _nativeApple() {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithApple();
    const provider = new OAuthProvider('apple.com');
    const cred   = provider.credential({
      idToken:   result.credential?.idToken,
      rawNonce:  result.credential?.nonce,
    });
    const fb = await signInWithCredential(this._auth, cred);
    return this._mapUser(fb.user);
  }

  // ── Sign Out ─────────────────────────────────────────────────────────────────

  async signOut() {
    await signOut(this._auth);
    // Oturumu kapatınca tekrar anonim giriş yap
    await signInAnonymously(this._auth).catch(() => {});
  }

  // ── Kullanıcı adı güncelle ────────────────────────────────────────────────

  async updateDisplayName(name) {
    const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    if (this._auth.currentUser) {
      await updateProfile(this._auth.currentUser, { displayName: name });
      if (this._user) this._user.name = name;
    }
  }

  // ── UID (anonim dahil her zaman var) ─────────────────────────────────────

  getUID() { return this._auth?.currentUser?.uid ?? null; }

  _mapUser(u) {
    if (!u) return null;
    return { uid: u.uid, name: u.displayName || 'Misafir', email: u.email || '', photo: u.photoURL || '' };
  }
}

const authManager = new AuthManager();
export default authManager;
