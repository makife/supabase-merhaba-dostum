import { useEffect, useState, useRef } from 'react';
import { App, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to manage app lifecycle (background/foreground states)
 * Works on native mobile apps (iOS/Android) via Capacitor
 * @param onBackground - Callback when app goes to background (executed after delay)
 * @param onForeground - Callback when app comes to foreground
 * @param backgroundDelay - Delay in ms before executing onBackground (default: 0)
 */
export const useAppState = (
  onBackground?: () => void,
  onForeground?: () => void,
  backgroundDelay: number = 0
) => {
  const [isActive, setIsActive] = useState(true);
  const [isNative] = useState(Capacitor.isNativePlatform());
  const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isNative) {
      // Web ortamında - visibility API kullan
      const handleVisibilityChange = () => {
        const isVisible = !document.hidden;
        setIsActive(isVisible);
        
        if (isVisible) {
          // Ön plana geldi - timer'ı iptal et
          if (backgroundTimerRef.current) {
            clearTimeout(backgroundTimerRef.current);
            backgroundTimerRef.current = null;
            console.log('⏰ Arka plan timer\'ı iptal edildi');
          }
          onForeground?.();
        } else {
          // Arka plana gitti - gecikmeyle callback çağır
          if (backgroundDelay > 0) {
            console.log(`⏰ ${backgroundDelay / 1000} saniye sonra arka plan callback çağrılacak`);
            backgroundTimerRef.current = setTimeout(() => {
              console.log('⏰ Arka plan callback çağrılıyor');
              onBackground?.();
              backgroundTimerRef.current = null;
            }, backgroundDelay);
          } else {
            onBackground?.();
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (backgroundTimerRef.current) {
          clearTimeout(backgroundTimerRef.current);
        }
      };
    }

    // Native platformda - Capacitor App plugin kullan
    let listener: any;

    const setupListener = async () => {
      listener = await App.addListener('appStateChange', (state: AppState) => {
        console.log('📱 App state changed:', state.isActive ? 'FOREGROUND' : 'BACKGROUND');
        setIsActive(state.isActive);

        if (state.isActive) {
          // Uygulama ön plana geldi - timer'ı iptal et
          if (backgroundTimerRef.current) {
            clearTimeout(backgroundTimerRef.current);
            backgroundTimerRef.current = null;
            console.log('⏰ Arka plan timer\'ı iptal edildi');
          }
          onForeground?.();
        } else {
          // Uygulama arka plana gitti - gecikmeyle callback çağır
          if (backgroundDelay > 0) {
            console.log(`⏰ ${backgroundDelay / 1000} saniye sonra arka plan callback çağrılacak`);
            backgroundTimerRef.current = setTimeout(() => {
              console.log('⏰ Arka plan callback çağrılıyor');
              onBackground?.();
              backgroundTimerRef.current = null;
            }, backgroundDelay);
          } else {
            onBackground?.();
          }
        }
      });
    };

    setupListener();

    return () => {
      listener?.remove();
      if (backgroundTimerRef.current) {
        clearTimeout(backgroundTimerRef.current);
      }
    };
  }, [isNative, onBackground, onForeground, backgroundDelay]);

  return { isActive, isNative };
};
