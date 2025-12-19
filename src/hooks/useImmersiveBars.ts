import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
// @ts-ignore - Third-party plugin tip desteği eksik olabilir
import { NavigationBar } from "@ethion/capacitor-navigation-bar";

const HIDE_DELAY_MS = 3000; // 3 saniye sonra gizle
const BLACK_HEX = "#000000";

/**
 * useImmersiveBars - Stabil Immersive Mode
 * 
 * - Uygulama açıldığında status bar ve navigation bar gizli
 * - Parmak kaydırıldığında siyah zemin + beyaz font ile görünür
 * - 3 saniye sonra otomatik gizlenir
 */
export function useImmersiveBars() {
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Barları gizle
  const hideBars = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      // Status bar gizle
      await StatusBar.hide();
      
      // Navigation bar gizle (sadece Android)
      if (Capacitor.getPlatform() === "android") {
        const Nav = NavigationBar as any;
        if (Nav?.hide) {
          await Nav.hide();
        }
      }
    } catch (error) {
      console.warn("Barları gizleme hatası:", error);
    }
  }, []);

  // Barları göster (siyah zemin, beyaz font)
  const showBars = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      // Status bar: siyah zemin, beyaz ikonlar
      await StatusBar.setBackgroundColor({ color: BLACK_HEX });
      await StatusBar.setStyle({ style: Style.Dark }); // Dark = beyaz ikonlar
      await StatusBar.show();
      
      // Navigation bar (sadece Android)
      if (Capacitor.getPlatform() === "android") {
        const Nav = NavigationBar as any;
        // Siyah zemin, beyaz butonlar (darkButtons: false = beyaz)
        if (Nav?.setColor) {
          await Nav.setColor({ color: BLACK_HEX, darkButtons: false });
        }
        if (Nav?.show) {
          await Nav.show();
        }
      }
    } catch (error) {
      console.warn("Barları gösterme hatası:", error);
    }
  }, []);

  // 3 saniye sonra otomatik gizle
  const scheduleHide = useCallback(() => {
    // Önceki timeout'u temizle
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    
    hideTimeoutRef.current = setTimeout(() => {
      hideBars();
    }, HIDE_DELAY_MS);
  }, [hideBars]);

  // Immersive mode kurulumu
  const setupImmersiveMode = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    const Nav = NavigationBar as any;
    
    try {
      // 1. Status bar overlay mode (içerik barın altına geçer)
      await StatusBar.setOverlaysWebView({ overlay: true });
      await StatusBar.setBackgroundColor({ color: BLACK_HEX });
      await StatusBar.setStyle({ style: Style.Dark });
      
      // 2. Android Navigation Bar ayarları
      if (Capacitor.getPlatform() === "android") {
        // Renk ayarı: siyah zemin, beyaz butonlar
        if (Nav?.setColor) {
          await Nav.setColor({ color: BLACK_HEX, darkButtons: false });
        }
        
        // Immersive Sticky Modu - kritik ayar
        // Bu mod sayesinde kullanıcı kaydırdığında barlar gelir
        // ve sistem otomatik gizler
        if (Nav?.setBehavior) {
          await Nav.setBehavior({ behavior: "immersive-sticky" });
        }
      }
      
      // 3. İlk başta barları gizle
      await hideBars();
      
      isInitializedRef.current = true;
    } catch (error) {
      console.warn("Immersive mode kurulum hatası:", error);
    }
  }, [hideBars]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // İlk kurulum
    setupImmersiveMode();

    // Touch event listener - kullanıcı ekrana dokunduğunda
    const handleUserInteraction = () => {
      if (!isInitializedRef.current) return;
      
      // Barları göster
      showBars();
      
      // 3 saniye sonra gizle
      scheduleHide();
    };

    // Swipe gesture detection için touch events
    let touchStartY = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY;
      const deltaY = touchEndY - touchStartY;
      const screenHeight = window.innerHeight;
      
      // Ekranın alt %20'sinden yukarı kaydırma algıla
      if (touchStartY > screenHeight * 0.8 && deltaY < -30) {
        handleUserInteraction();
      }
      
      // Ekranın üst %20'sinden aşağı kaydırma algıla
      if (touchStartY < screenHeight * 0.2 && deltaY > 30) {
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
