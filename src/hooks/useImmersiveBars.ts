import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar } from "@capacitor/status-bar";
// @ts-ignore - Third-party plugin tip desteği eksik olabilir
import { NavigationBar } from "@ethion/capacitor-navigation-bar";

/**
 * useImmersiveBars - Profesyonel Oyun Deneyimi
 * Android'in yerel Immersive Sticky modunu kullanarak navigasyon ve durum çubuklarını yönetir.
 * Manuel touch listener ve timer gerektirmez, sistemin yerel özelliğini tetikler.
 */
export function useImmersiveBars() {
  useEffect(() => {
    // Sadece gerçek cihazlarda (Android/iOS) çalıştır
    if (!Capacitor.isNativePlatform()) return;

    const setupImmersiveMode = async () => {
      const Nav = NavigationBar as any;
      const DARK_HEX = "#000000";

      try {
        // 1. StatusBar (Üst Bar) Ayarları
        // İçeriği barın altına yay (overlay) ve barı tamamen gizle
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.hide();

        // 2. NavigationBar (Alt Bar) Ayarları - Sadece Android
        if (Capacitor.getPlatform() === "android") {
          // A. Renk ve İkon Uyumu
          // Arka planı tam siyah, butonları/ikonları beyaz (darkButtons: false) yapar.
          if (Nav?.setColor) {
            await Nav.setColor({ color: DARK_HEX, darkButtons: false });
          }

          // B. EN KRİTİK AYAR: Immersive Sticky Modu
          // Kullanıcı ekranı kaydırdığında barlar gelir, etkileşim bitince
          // sistem (Android) KENDİLİĞİNDEN animasyonla gizler.
          // JS tarafında timer tutmaya gerek bırakmaz.
          if (Nav?.setBehavior) {
            await Nav.setBehavior({ behavior: "immersive-sticky" });
          }

          // C. İlk Gizleme Komutu
          if (Nav?.hide) {
            await Nav.hide();
          }
        }
      } catch (error) {
        console.warn("Immersive mode kurulum hatası:", error);
      }
    };

    // İlk açılışta modu etkinleştir
    setupImmersiveMode();

    /**
     * Uygulama arka plana gidip geldiğinde (Home tuşuna basıp dönmek gibi)
     * Android bazen barları geri getirebilir. Bu durumu yakalayıp modu tazeliyoruz.
     */
    const handleReactivate = () => {
      if (!document.hidden) {
        // Kısa bir bekleme (delay), native katmanla senkronizasyon için faydalıdır
        setTimeout(setupImmersiveMode, 300);
      }
    };

    document.addEventListener("visibilitychange", handleReactivate);
    window.addEventListener("focus", handleReactivate);

    // Temizlik
    return () => {
      document.removeEventListener("visibilitychange", handleReactivate);
      window.removeEventListener("focus", handleReactivate);
    };
  }, []);

  // Manuel kontrol fonksiyonları (ihtiyaç olursa diye boş bırakıldı veya basitleştirildi)
  const manualShowBars = async () => {
    await StatusBar.show();
    const Nav = NavigationBar as any;
    if (Capacitor.getPlatform() === "android" && Nav?.show) await Nav.show();
  };

  const manualHideBars = async () => {
    await StatusBar.hide();
    const Nav = NavigationBar as any;
    if (Capacitor.getPlatform() === "android" && Nav?.hide) await Nav.hide();
  };

  return { manualShowBars, manualHideBars };
}
