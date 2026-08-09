# Native node_modules Patches (uygulanmış, git'e işlenmemiş)

`node_modules` `.gitignore`'da olduğu için buradaki değişiklikler git'e işlenmiyor.
`npm install` sıfırdan çalıştırılırsa bu patch'ler KAYBOLUR — aşağıdaki dosyayı
tekrar elle düzeltmek gerekir.

## @capacitor-community/admob — BannerExecutor.java NPE fix (2026-08-09)

**Dosya:** `node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/banner/BannerExecutor.java`

**Sorun:** `initialize()` içinde `mViewGroup`, `getChildAt(0)` ile BİR KERE
önbelleğe alınıyordu. WebView henüz content view'a child olarak eklenmemişken
bu çağrı gelirse `mViewGroup` kalıcı olarak `null` kalıyor, sonraki banner
ekleme (`createNewAdView()`) `NullPointerException` ile çöküyordu
(Crashlytics: `BannerExecutor.lambda$createNewAdView$5`, "güncelleme sonrası
splash'ten hemen sonra kapanıyor" raporu).

**Düzeltme:**
1. `initialize()` içindeki tek seferlik `getChildAt(0)` çağrısı `resolveRootViewGroup()`
   adlı yeniden kullanılabilir bir yardımcı metoda taşındı (null-güvenli).
2. `createNewAdView()` içinde, `mViewGroup.addView(mAdViewLayout)` çağrısından
   hemen önce `mViewGroup` hâlâ null ise `resolveRootViewGroup()` ile TEKRAR
   denenir. Yine null ise banner sessizce atlanır (log yazılır), UYGULAMA ÇÖKMEZ.
3. `removeBanner()` ve `onAdFailedToLoad()` içindeki `mViewGroup.removeView(...)`
   çağrıları da null-check ile korundu.

Tam diff için: bu commit'ten önceki konuşma geçmişine veya
`prototipler/tiliq/node_modules/...BannerExecutor.java` içindeki (aynı şekilde
yamalı, ama o da git'e işlenmiyor) hâline bakılabilir.

**Yeniden uygulama:** `node_modules` sıfırdan kurulursa, yukarıdaki 3 maddeyi
tekrar uygulamak için Claude'a bu dosyayı gösterip "bu patch'i tekrar uygula"
demek yeterli.
