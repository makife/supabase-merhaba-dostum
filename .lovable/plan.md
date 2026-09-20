# Android tam ekran sıçrama düzeltmesi

## Amaç
Android’in navigasyon çubuğu geçici olarak açılıp kapanırken oyun alanının yeniden boyutlanmasını ve alt menü/jokerlerin yukarı-aşağı sıçramasını engellemek.

## Yapılacaklar
- Android ana ekranını gerçek kenardan kenara, sabit yerleşim alanında çalıştıracağım; sistem çubukları içerik ölçüsünü değiştirmeyecek.
- Uygulamanın yerel Android yüksekliğini ilk kararlı tam ekran ölçüsüne sabitleyen bir CSS değişkeni ekleyeceğim.
- Maç ekranındaki dinamik `100dvh` kullanımını Android’de bu sabit yüksekliğe bağlayacağım; klavye gereken ekranların davranışını bozmayacağım.
- Navigasyon çubuğu geri gizlendiğinde immersive görünümü yeniden uygulayacağım, fakat React arayüzünü yeniden ölçülendirmeyeceğim.
- Derlemeyi kontrol edeceğim; bu yerel Android değişiklikleri için cihazda `git pull` ardından `npx cap sync android` gerekecek.

## Teknik not
Çözüm, Android `WindowInsets`/edge-to-edge ayarı ile WebView’in geçici sistem çubuğu yüksekliğini viewport değişikliği olarak uygulamasını önleyecek; yalnızca Android native görünümü etkilenecek.
