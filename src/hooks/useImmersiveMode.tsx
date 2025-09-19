import { useEffect, useState } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { NavigationBar } from '@ethion/capacitor-navigation-bar';
import { App } from '@capacitor/app';

export const useImmersiveMode = () => {
  const [barsVisible, setBarsVisible] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let appListener: { remove: () => void } | undefined;
    let overlayApplied = false;

    const hideSystemUI = async (immediate = false) => {
      if (!Capacitor.isNativePlatform()) return;
      
      try {
        // Apply overlay only once to avoid layout issues
        if (!overlayApplied) {
          try { 
            await StatusBar.setOverlaysWebView({ overlay: true }); 
            await StatusBar.setStyle({ style: Style.Dark });
          } catch {}
          overlayApplied = true;
        }

        if (immediate) {
          await StatusBar.hide();
          if (Capacitor.getPlatform() === 'android') {
            try {
              await NavigationBar.hide();
            } catch (e) {
              console.warn('⚠️ NavigationBar hide failed:', e);
            }
          }
          setBarsVisible(false);
        }
      } catch (error) {
        console.warn('⚠️ Could not hide system UI:', error);
      }
    };

    const showSystemUI = async () => {
      if (!Capacitor.isNativePlatform()) return;
      
      try {
        await StatusBar.show();
        if (Capacitor.getPlatform() === 'android') {
          try {
            await NavigationBar.show();
          } catch (e) {
            console.warn('⚠️ NavigationBar show failed:', e);
          }
        }
        setBarsVisible(true);
      } catch (error) {
        console.warn('⚠️ Could not show system UI:', error);
      }
    };

    const scheduleHide = () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        hideSystemUI(true);
      }, 3000); // 3 saniye sonra gizle
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      setTouchStartY(touch.clientY);
      setTouchStartX(touch.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartY === null || touchStartX === null) return;
      
      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY;
      const deltaX = Math.abs(touch.clientX - touchStartX);
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      
      // Kenarlardan kaydırma kontrolü
      const isTopEdge = touchStartY < 50; // Üstten 50px
      const isBottomEdge = touchStartY > windowHeight - 50; // Alttan 50px
      const isVerticalSwipe = Math.abs(deltaY) > deltaX; // Dikey kaydırma
      
      // Üstten aşağı kaydırma veya alttan yukarı kaydırma
      if (isVerticalSwipe && ((isTopEdge && deltaY > 30) || (isBottomEdge && deltaY < -30))) {
        showSystemUI();
        scheduleHide();
      }
    };

    const handleTouchEnd = () => {
      setTouchStartY(null);
      setTouchStartX(null);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        hideSystemUI(true);
      }
    };

    const setupImmersiveMode = async () => {
      if (!Capacitor.isNativePlatform()) return;

      // Başlangıçta gizle
      await hideSystemUI(true);

      // Touch event listeners
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleTouchEnd, { passive: true });
      
      // Visibility change listener
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // App lifecycle listener
      try {
        appListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            hideSystemUI(true);
          }
        });
      } catch (e) {
        console.warn('⚠️ App plugin not available:', e);
      }
    };

    setupImmersiveMode();

    // Cleanup function
    return () => {
      if (hideTimer) clearTimeout(hideTimer);

      // Show bars on cleanup
      if (Capacitor.isNativePlatform()) {
        StatusBar.show().catch((error) => {
          console.warn('⚠️ Could not show status bar:', error);
        });
        if (Capacitor.getPlatform() === 'android') {
          try {
            NavigationBar.show();
          } catch {}
        }
      }

      // Remove event listeners
      document.removeEventListener('touchstart', handleTouchStart as any);
      document.removeEventListener('touchmove', handleTouchMove as any);
      document.removeEventListener('touchend', handleTouchEnd as any);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      appListener?.remove?.();
    };
  }, [touchStartY, touchStartX]);

  return { barsVisible };
};