import { useEffect, useState } from 'react';
import { App, AppState } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to manage app lifecycle (background/foreground states)
 * Works on native mobile apps (iOS/Android) via Capacitor
 */
export const useAppState = (
  onBackground?: () => void,
  onForeground?: () => void
) => {
  const [isActive, setIsActive] = useState(true);
  const [isNative] = useState(Capacitor.isNativePlatform());

  useEffect(() => {
    if (!isNative) {
      // Web ortamında - visibility API kullan
      const handleVisibilityChange = () => {
        const isVisible = !document.hidden;
        setIsActive(isVisible);
        
        if (isVisible) {
          onForeground?.();
        } else {
          onBackground?.();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    // Native platformda - Capacitor App plugin kullan
    let listener: any;

    const setupListener = async () => {
      listener = await App.addListener('appStateChange', (state: AppState) => {
        console.log('📱 App state changed:', state.isActive ? 'FOREGROUND' : 'BACKGROUND');
        setIsActive(state.isActive);

        if (state.isActive) {
          // Uygulama ön plana geldi
          onForeground?.();
        } else {
          // Uygulama arka plana gitti
          onBackground?.();
        }
      });
    };

    setupListener();

    return () => {
      listener?.remove();
    };
  }, [isNative, onBackground, onForeground]);

  return { isActive, isNative };
};
