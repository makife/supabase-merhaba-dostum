import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { SafeStatusBar, SafeNavigationBar } from "@/utils/safePluginWrapper";

const HIDE_DELAY_MS = 3000; // 3 saniye sonra gizle
const BLACK_HEX = "#000000";

/**
 * useImmersiveBars - Stabil Immersive Mode
 * 
 * - Uygulama açıldığında status bar ve navigation bar gizli
 * - Parmak kaydırıldığında siyah zemin + beyaz font ile görünür
 * - 3 saniye sonra otomatik gizlenir
 * - TÜM PLUGIN ÇAĞRILARI TRY-CATCH İLE SARMALANMIŞ
 */
export function useImmersiveBars() {
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Barları gizle - Safe wrapper kullanır
  const hideBars = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await SafeStatusBar.hide();
      
      if (Capacitor.getPlatform() === "android") {
        await SafeNavigationBar.hide();
      }
    } catch (error) {
      console.log("[ImmersiveBars] hideBars hatası tolere edildi:", error);
    }
  }, []);

  // Barları göster (siyah zemin, beyaz font) - Safe wrapper kullanır
  const showBars = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      await SafeStatusBar.setBackgroundColor({ color: BLACK_HEX });
      await SafeStatusBar.setStyle({ style: "Dark" });
      await SafeStatusBar.show();
      
      if (Capacitor.getPlatform() === "android") {
        await SafeNavigationBar.setColor({ color: BLACK_HEX, darkButtons: false });
        await SafeNavigationBar.show();
      }
    } catch (error) {
      console.log("[ImmersiveBars] showBars hatası tolere edildi:", error);
    }
  }, []);

  // 3 saniye sonra otomatik gizle
  const scheduleHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    hideTimeoutRef.current = setTimeout(() => {
      hideBars();
    }, HIDE_DELAY_MS);
  }, [hideBars]);

  // Immersive mode kurulumu - Safe wrapper kullanır
  const setupImmersiveMode = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      // 1. Status bar overlay mode
      await SafeStatusBar.setOverlaysWebView({ overlay: true });
      await SafeStatusBar.setBackgroundColor({ color: BLACK_HEX });
      await SafeStatusBar.setStyle({ style: "Dark" });
      
      // 2. Android Navigation Bar ayarları
      if (Capacitor.getPlatform() === "android") {
        await SafeNavigationBar.setColor({ color: BLACK_HEX, darkButtons: false });
        await SafeNavigationBar.setBehavior({ behavior: "immersive-sticky" });
      }
      
      // 3. İlk başta barları gizle
      await hideBars();
      
      isInitializedRef.current = true;
    } catch (error) {
      console.log("[ImmersiveBars] setupImmersiveMode hatası tolere edildi:", error);
      // Hata olsa bile initialized say ki tekrar denemesin
      isInitializedRef.current = true;
    }
  }, [hideBars]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // İlk kurulum
    setupImmersiveMode();

    // Touch event listener - kullanıcı ekrana dokunduğunda
    const handleUserInteraction = () => {
      if (!isInitializedRef.current) return;
      
      // 🛡️ OYUN SAYFASINDA İSEK SWIPE İLE BAR AÇMA!
      const currentPath = window.location.pathname;
      const isGamePage = currentPath.includes('/game') || 
                         currentPath.includes('/random-match') ||
                         currentPath.includes('/tournament');
      
      if (isGamePage) {
        console.log("[ImmersiveBars] Oyun sayfasında, swipe ile bar açılmayacak");
        return;
      }
      
      // Barları göster
      showBars();
      
      // 3 saniye sonra gizle
      scheduleHide();
    };

    // 🛡️ Swipe gesture detection - ÇOK KATKI EŞİKLER (deltaY: 100px)
    let touchStartY = 0;
    let touchStartX = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndX = e.changedTouches[0].clientX;
      const deltaY = touchEndY - touchStartY;
      const deltaX = Math.abs(touchEndX - touchStartX);
      const screenHeight = window.innerHeight;
      
      // 🛡️ Eğer oyun alanında tıklama ise (X ekseni hareketi az), status bar açma
      // Sadece gerçek swipe gesture'ları için aç (dikey hareket > 100px VE yatay hareket < 20px)
      if (deltaX > 20) return; // Yatay hareket varsa status bar açma
      
      // Ekranın alt %5'inden yukarı kaydırma algıla (çok küçük alan)
      if (touchStartY > screenHeight * 0.95 && deltaY < -100) {
        handleUserInteraction();
      }
      
      // Ekranın üst %5'inden aşağı kaydırma algıla (çok küçük alan)
      if (touchStartY < screenHeight * 0.05 && deltaY > 100) {
        handleUserInteraction();
      }
    };

    // Uygulama arka plandan döndüğünde
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Kısa gecikme ile yeniden kur
        setTimeout(() => {
          setupImmersiveMode();
        }, 200);
      }
    };

    // Resume event (Capacitor specific)
    const handleResume = () => {
      setTimeout(() => {
        setupImmersiveMode();
      }, 200);
    };

    // Event listeners
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleResume);
    document.addEventListener("resume", handleResume);

    // Cleanup
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("resume", handleResume);
    };
  }, [setupImmersiveMode, showBars, scheduleHide]);

  return { 
    showBars, 
    hideBars,
    manualShowBars: showBars,
    manualHideBars: hideBars
  };
}
