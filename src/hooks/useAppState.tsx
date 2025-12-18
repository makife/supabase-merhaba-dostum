import { useEffect, useState, useRef, useCallback } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

interface UseAppStateOptions {
  onBackground?: () => void;
  onForeground?: () => void;
  backgroundDelay?: number; // ms cinsinden - bu süre sonunda onBackground tetiklenir
  onBackgroundTimeout?: () => void; // backgroundDelay sonunda tetiklenir (oyundan çıkış için)
}

export const useAppState = (options: UseAppStateOptions = {}) => {
  const { 
    onBackground, 
    onForeground, 
    backgroundDelay = 0,
    onBackgroundTimeout 
  } = options;
  
  const [isActive, setIsActive] = useState(true);
  const [backgroundStartTime, setBackgroundStartTime] = useState<number | null>(null);
  const isNative = Capacitor.isNativePlatform();
  const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutFiredRef = useRef(false);

  const clearBackgroundTimer = useCallback(() => {
    if (backgroundTimerRef.current) {
      clearTimeout(backgroundTimerRef.current);
      backgroundTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleStateChange = (active: boolean) => {
      setIsActive(active);

      if (active) {
        // Ön plana döndü
        clearBackgroundTimer();
        timeoutFiredRef.current = false;
        setBackgroundStartTime(null);
        onForeground?.();
      } else {
        // Arka plana alındı
        setBackgroundStartTime(Date.now());
        onBackground?.();
        
        // Eğer backgroundDelay ve onBackgroundTimeout varsa, timer başlat
        if (backgroundDelay > 0 && onBackgroundTimeout && !timeoutFiredRef.current) {
          clearBackgroundTimer();
          backgroundTimerRef.current = setTimeout(() => {
            // Hala arka plandaysa timeout'u tetikle
            if (!timeoutFiredRef.current) {
              timeoutFiredRef.current = true;
              onBackgroundTimeout();
            }
          }, backgroundDelay);
        }
      }
    };

    if (!isNative) {
      // Web için visibilitychange kullan
      const handleVisibilityChange = () => handleStateChange(!document.hidden);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        clearBackgroundTimer();
      };
    } else {
      // Native için Capacitor App listener kullan
      const listenerPromise = App.addListener("appStateChange", (state) => {
        handleStateChange(state.isActive);
      });

      return () => {
        listenerPromise.then((l) => l.remove());
        clearBackgroundTimer();
      };
    }
  }, [onBackground, onForeground, onBackgroundTimeout, backgroundDelay, isNative, clearBackgroundTimer]);

  // Arka planda geçen süreyi hesapla
  const getBackgroundDuration = useCallback(() => {
    if (!backgroundStartTime || isActive) return 0;
    return Date.now() - backgroundStartTime;
  }, [backgroundStartTime, isActive]);

  return { 
    isActive, 
    isNative, 
    backgroundStartTime,
    getBackgroundDuration,
    wasTimeoutFired: timeoutFiredRef.current
  };
};
