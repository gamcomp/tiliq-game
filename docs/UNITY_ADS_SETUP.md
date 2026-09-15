# Tiliq — Unity Ads doğrudan entegrasyon

Tiliq, Capacitor ile Android ve iOS için paketlenir. Reklam köprüsü resmi Unity Ads 4.20.0 SDK'sını kullanır; AdMob hesabı devre dışı olduğu için AdMob reklam isteği gönderilmez. Mevcut AdMob eklentisi yalnızca iOS ATT yetkilendirme akışı için korunur.

## Unity paneli

1. Unity Cloud'da **Tiliq** projesini oluştur; "primarily targeted to children" sorusunu **No** olarak işaretle. Bu, oyunun genel kitle olduğu bilgisine dayanır.
2. **Monetization > Add app / Enable Ads** bölümünde iOS **Store URL** alanına `https://apps.apple.com/tr/app/tiliq-block-puzzle/id6789283001?uo=4` bağlantısını gir ve mevcut **Tiliq - Block Puzzle Game** projesini seç. Doğrudan **Unity Ads** çözümünü seç. Android ve iOS uygulamalarını ayrı platform kayıtları olarak ekle; Android yayınlanmadıysa mağaza bağlantısını panel izin veriyorsa daha sonra tamamla.
3. iOS **Game ID**: `800374323`. iOS placement ID'leri: **rewarded** `BP_Rewarded_iOS`, **interstitial** `BP_Interstitial_iOS`, **banner** `BP_Banner_iOS` (Unity panelinden alındı). Android **Game ID** ve Android placement ID'leri hâlâ bekleniyor. Platformların ID'lerini birbirinin yerine kullanma.
4. iOS değerleri kökteki `unity-ads-config.js` dosyasına ve `www/unity-ads-config.js` kopyasına girildi. Android için aynı alanlar boş; Android'de mevcut reklamsız ödül akışı korunur.
5. Test sırasında `testMode: true` bırak ve Unity panelinde Test Mode'u etkinleştir. Gerçek cihazda tamamlanmış ödüllü reklamın ödül verdiğini, erken kapatmanın ödül vermediğini, oyun sonu menü dönüşünde tam ekran reklamın en fazla üç fırsatta bir gösterildiğini ve banner'ın oyun tepsisi/HUD üzerine gelmediğini doğrula.
6. Mağaza yayını öncesinde Unity'nin uygulama gizliliği/veri açıklama rehberine göre App Store Privacy ve Google Play Data Safety alanlarını gözden geçir. `privacy-policy.html` için Unity Ads metni yerel olarak hazırlandı; yayınlanmış sayfa henüz eski AdMob metnini gösteriyor. Unity'nin panelindeki `app-ads.txt` satırlarını mağaza kaydındaki geliştirici alan adı `gamcomp.github.io` köküne yayınla. Bu repo şu anda Unity satırlarını içermez.
7. Gerçek reklamları açarken `testMode: false` yap, dosyayı tekrar `www/` içine kopyala, `npx cap sync android` ve `npx cap sync ios` çalıştır, ardından iki platformda cihaz testi yap.

`index.html` kaynak sayfadır; `game.html` ve `www/index.html` aynı içerikte kalmalıdır. Yerel eklenti `plugins/tiliq-unity-ads/` altındadır. Codemagic iOS Podfile'ını yeniden yazdığı için pod kaydı `codemagic.yaml` şablonunda da bulunur.

Unity'nin varsayılan consent akışı kullanılır; uygulama SDK'ya kullanıcıdan alınmamış bir kişiselleştirme onayı göndermez. Bölgesel gizlilik gereksinimleri ve oyunun mağaza açıklamaları yayından önce ayrıca gözden geçirilmelidir.

Kaynaklar: [Unity Ads'i etkinleştirme](https://docs.unity.com/en-us/grow/dashboard/get-started/project/enable-unity-ads), [platform Game ID ve consent](https://docs.unity.com/en-us/monetization/getting-started/process-overview), [yerleşimler](https://docs.unity.com/en-us/monetization/dashboard/placements/create-manage-placements), [Android SDK](https://docs.unity.com/en-us/ads-android/4.20.0/sdk-integration), [iOS SDK](https://docs.unity.com/en-us/ads-ios/4.20.0/sdk-integration).
