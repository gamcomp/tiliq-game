# Tiliq 1.3.98 — reklam ödülü sonuçlandırma

Sorun: Dismissal bildirimi reward/promise sonucundan önce gelince dinleyiciler erken kaldırılıyor ve kazanılmış ödül kaybolabiliyordu.

- Tek reklam oturumu, kendi dinleyicileri ve tek sonuçlandırma noktası kullanılır.
- Kapanış tek başına sonuç değildir; geç gelen ödül ve native promise sonucu aynı oturumda birleştirilir.
- Native promise beklenirken oturum kilitli kalır. Eksik ödül bildirimi için promise sonrası 2.5 sn tolerans; sonuçsuz işlem için toplam 90 sn hata sınırı. Zaman aşımı ödül kazandırmaz.
- Doğrulanmış ödül hemen uygulanır; tekrar bildirimi ve eski callback tekrar ödül vermez.
- Banner/audio/analytics temizliği ödül uygulamasını engellemez.
- Günlük bonus ve coin butonları 45 sn sayacı yerine gerçek reklam sonucu ile sıfırlanır.
- Unity SDK, plugin kaynakları, provider, reklam ID ve ayarları değiştirilmedi.
- Otomatik kontroller: gecikmiş ödül olayı, gecikmiş promise (2.8 sn), yinelenen bildirim, eski callback, erken kapama, no-proof, hata, eşzamanlı dokunma ve UI temizliği hatası.
- Gerçek oyun callback kontrolleri: çekiç, devam, coin, günlük bonus; tek ödül ve başarısız günlük talep sonrası düğme kontrolü.
- Oyun frame döngüsüne ek işlem yok; yalnızca etkin reklam sırasında sınırlı dinleyici/zamanlayıcı. Fiziksel iPhone FPS/RAM ve canlı SDK gösterimi ölçülmedi.
