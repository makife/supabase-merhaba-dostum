# Güncelleme Penceresi Dokunma Önceliği

## Yapılacaklar
- Güncelleme penceresini uygulamadaki tüm ödül ve bildirim pencerelerinden daha üst katmana taşı.
- Pencerenin arka kaplamasını ayrı ve tam ekran tutarak alttaki bütün dokunmaları engelle.
- iOS ve Android dokunmalarında üst pencerenin butonlarının güvenilir çalışmasını sağla.
- Güncelleme penceresi açıkken katman sırasını ve proje derlemesini doğrula.

## Teknik ayrıntı
- Güncelleme kartı için izole, en üst düzey portal katmanı kullanılacak.
- Dokunma olayları kaplama ve kartta tutulacak; alttaki Radix ödül pencerelerine geçmeyecek.
- Mevcut zorunlu/isteğe bağlı güncelleme davranışı değiştirilmeyecek.
