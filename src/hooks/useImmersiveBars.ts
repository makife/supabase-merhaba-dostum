import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - third-party plugin may not ship full types
import { NavigationBar } from '@ethion/capacitor-navigation-bar';

const DARK_HEX = '#1a1a1a';
const AUTO_HIDE_MS = 3000;
const EDGE_SWIPE_THRESHOLD = 50;
const SWIPE_DISTANCE_THRESHOLD = 30;

export function useImmersiveBars() {
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const barsVisible = useRef<boolean>(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const Nav: any = NavigationBar as any;

    const applyDarkBars = async () => {
      try {
        // StatusBar ayarları
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setBackgroundColor({ color: DARK_HEX });
        await StatusBar.setStyle({ style: StatusBarStyle.Light });
      } catch (error) {
        console.log('StatusBar error:', error);
      }

      try {
        // NavigationBar ayarları (sadece Android)
        if (Capacitor.getPlatform() === 'android') {
          // Önce rengi ayarla
          if (Nav?.setColor) {
            await Nav.setColor({ color: DARK_HEX, darkButtons: false });
          }
          
          // Tam immersive mod için farklı behavior'lar dene
          if (Nav?.setBehavior) {
            try {
              // İlk olarak immersive sticky modunu dene
              await Nav.setBehavior({ behavior: 'immersive-sticky' });
            } catch {
              try {
                await Nav.setBehavior({ behavior: 'immersive' });
              } catch {
                try {
                  await Nav.setBehavior({ behavior: 'overlay-swipe' });
                } catch {
                  await Nav.setBehavior({ behavior: 'inset-swipe' });
                }
              }
            }
          }

          // Tam gizleme için ek ayarlar
          if (Nav?.setTransparency) {
            await Nav.setTransparency({ isTransparent: true });
          }
        }
      } catch (error) {
        console.log('NavigationBar error:', error);
      }
    };

    const showBars = async () => {
      if (barsVisible.current) return;
      
      try {
        await StatusBar.show();
        
        // Android için navigation bar'ı göster
        if (Capacitor.getPlatform() === 'android' && Nav?.show) {
          await Nav.show();
        }
        
        barsVisible.current = true;
        console.log('Bars shown');
      } catch (error) {
        console.log('Show bars error:', error);
      }
    };

    const hideBars = async () => {
      if (!barsVisible.current && hideTimer.current === null) return;
      
      try {
        await StatusBar.hide();
        
        // Android için navigation bar'ı gizle
        if (Capacitor.getPlatform() === 'android') {
          if (Nav?.hide) {
            await Nav.hide();
          } else if (Nav?.setVisibility) {
            await Nav.setVisibility({ visibility: 'hidden' });
          }
        }
        
        barsVisible.current = false;
        console.log('Bars hidden');
      } catch (error) {
        console.log('Hide bars error:', error);
      }
    };

    const scheduleAutoHide = () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(async () => {
        await hideBars();
        hideTimer.current = null;
      }, AUTO_HIDE_MS);
    };

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartY.current = touch.clientY;
      touchStartX.current = touch.clientX;
    };

    const handleTouchMove = async (e: TouchEvent) => {
      if (touchStartY.current === null || touchStartX.current === null) return;
      
      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY.current;
      const deltaX = Math.abs(touch.clientX - touchStartX.current);
      const screenHeight = window.innerHeight;
      const screenWidth = window.innerWidth;
      
      // Dikey hareket mi kontrolü
      const isVerticalSwipe = Math.abs(deltaY) > deltaX;
      
      // Üst kenardan aşağı kaydırma (status bar için)
      const isTopEdgeSwipe = touchStartY.current < EDGE_SWIPE_THRESHOLD && 
                            deltaY > SWIPE_DISTANCE_THRESHOLD && 
                            isVerticalSwipe;
      
      // Alt kenardan yukarı kaydırma (navigation bar için)
      const isBottomEdgeSwipe = touchStartY.current > (screenHeight - EDGE_SWIPE_THRESHOLD) && 
                               deltaY < -SWIPE_DISTANCE_THRESHOLD && 
                               isVerticalSwipe;
      
      // Yan kenarlardan kaydırma (navigation gesture hint için)
      const isSideEdgeSwipe = (touchStartX.current < EDGE_SWIPE_THRESHOLD || 
                              touchStartX.current > (screenWidth - EDGE_SWIPE_THRESHOLD)) &&
                             Math.abs(deltaX) > SWIPE_DISTANCE_THRESHOLD;

      if (isTopEdgeSwipe || isBottomEdgeSwipe || isSideEdgeSwipe) {
        console.log('Edge swipe detected:', { isTopEdgeSwipe, isBottomEdgeSwipe, isSideEdgeSwipe });
        await showBars();
        scheduleAutoHide();
      }
    };

    const handleTouchEnd = () => {
      touchStartY.current = null;
      touchStartX.current = null;
    };

    // Sayfa yüklendiğinde immersive modu etkinleştir
    const initializeImmersiveMode = async () => {
      console.log('Initializing immersive mode...');
      await applyDarkBars();
      
      // Kısa bir gecikme sonrası bar'ları gizle
      setTimeout(async () => {
        await hideBars();
      }, 500);
    };

    // Sayfa odağı değiştiğinde immersive modu yeniden aktifleştir
    const handleVisibilityChange = async () => {
      if (!document.hidden) {
        console.log('Page visible, reapplying immersive mode');
        setTimeout(async () => {
          await applyDarkBars();
          await hideBars();
        }, 100);
      }
    };

    // Event listener'ları ekle
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // İlk kurulumu yap
    initializeImmersiveMode();

    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Manuel kontrol fonksiyonları
  const manualShowBars = async () => {
    const Nav: any = NavigationBar as any;
    try {
      await StatusBar.show();
      if (Capacitor.getPlatform() === 'android' && Nav?.show) {
        await Nav.show();
      }
      barsVisible.current = true;
    } catch (error) {
      console.log('Manual show error:', error);
    }
  };

  const manualHideBars = async () => {
    const Nav: any = NavigationBar as any;
    try {
      await StatusBar.hide();
      if (Capacitor.getPlatform() === 'android' && Nav?.hide) {
        await Nav.hide();
      }
      barsVisible.current = false;
    } catch (error) {
      console.log('Manual hide error:', error);
    }
  };

  return { manualShowBars, manualHideBars };
}
