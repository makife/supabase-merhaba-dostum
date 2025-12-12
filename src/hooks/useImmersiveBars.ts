import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - third-party plugin may not ship full types
import { NavigationBar } from '@ethion/capacitor-navigation-bar';

const DARK_HEX = '#000000';
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
          // 1. Renk ayarla - koyu arka plan, beyaz butonlar
          if (Nav?.setColor) {
            await Nav.setColor({ color: DARK_HEX, darkButtons: false });
          }
          
          // 2. Transparency'yi KAPALI tut (koyu arka plan görünsün)
          if (Nav?.setTransparency) {
            try {
              await Nav.setTransparency({ isTransparent: false });
            } catch (e) {
              console.log('Transparency setting not supported');
            }
          }
          
          // 3. Tam immersive mod için behavior ayarla
          if (Nav?.setBehavior) {
            try {
              // İlk olarak immersive sticky modunu dene (en agresif gizleme)
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

          // 4. Renk ayarlarını pekiştir (behavior sonrası bazı cihazlarda resetleniyor)
          if (Nav?.setColor) {
            await Nav.setColor({ color: DARK_HEX, darkButtons: false });
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
        
        // Android için navigation bar'ı gizle - birden fazla yöntem dene (cihaz uyumluluğu için)
        if (Capacitor.getPlatform() === 'android') {
          // 1. Önce hide metodunu dene
          if (Nav?.hide) {
            await Nav.hide();
          }
          
          // 2. setVisibility ile de gizle (bazı cihazlarda sadece bu çalışıyor)
          if (Nav?.setVisibility) {
            await Nav.setVisibility({ visibility: 'hidden' });
          }
          
          // 3. Immersive sticky behavior'ı yeniden uygula (bazı cihazlarda gerekli)
          if (Nav?.setBehavior) {
            try {
              await Nav.setBehavior({ behavior: 'immersive-sticky' });
            } catch {
              // Sessizce devam et
            }
          }
          
          // 4. Kısa bir gecikme sonra tekrar gizle (bazı cihazlarda ilk seferde tutmuyor)
          setTimeout(async () => {
            try {
              if (Nav?.hide) await Nav.hide();
              if (Nav?.setVisibility) await Nav.setVisibility({ visibility: 'hidden' });
            } catch {}
          }, 100);
        }
        
        barsVisible.current = false;
        console.log('Bars hidden (multi-attempt)');
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
      if (touchStartY.current === null) return;
      
      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY.current;
      const screenHeight = window.innerHeight;
      
      // Sadece alt kenardan yukarı kaydırma - her iki bar'ı da göster
      const isBottomEdgeSwipe = touchStartY.current > (screenHeight - EDGE_SWIPE_THRESHOLD) && 
                               deltaY < -SWIPE_DISTANCE_THRESHOLD;

      if (isBottomEdgeSwipe) {
        console.log('Bottom edge swipe detected - showing both bars');
        await showBars();
        scheduleAutoHide();
        // Bir kez tetiklendikten sonra tekrar tetiklenmesini önle
        touchStartY.current = null;
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
