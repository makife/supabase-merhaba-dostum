import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { subscribeToForegroundState, getIsAppInForeground } from "@/hooks/useAppForegroundState";

interface UseAppStateOptions {
  onBackground?: () => void;
  onForeground?: () => void;
  backgroundDelay?: number;
  onBackgroundTimeout?: () => void;
}

export const useAppState = (options: UseAppStateOptions = {}) => {
  const { 
    onBackground, 
    onForeground, 
    backgroundDelay = 0,
    onBackgroundTimeout 
  } = options;
  
  // isNative'i useMemo ile memoize et - her render'da yeniden hesaplanmasın
  const isNative = useMemo(() => Capacitor.isNativePlatform(), []);
  
  const [isActive, setIsActive] = useState(true);
  const [backgroundStartTime, setBackgroundStartTime] = useState<number | null>(null);
  
  const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutFiredRef = useRef(false);
  const backgroundStartRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const clearBackgroundTimer = useCallback(() => {
    if (backgroundTimerRef.current) {
      clearTimeout(backgroundTimerRef.current);
      backgroundTimerRef.current = null;
    }
  }, []);

  // Mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const handleStateChange = (active: boolean) => {
      // Component unmount olduysa state güncelleme yapma
      if (!isMountedRef.current) return;
      
      setIsActive(active);

      if (active) {
        // Ön plana döndü
        clearBackgroundTimer();
        
        // Mobilde setTimeout çalışmaz, foreground'a döndüğümüzde kontrol et
        if (backgroundStartRef.current && backgroundDelay > 0 && onBackgroundTimeout && !timeoutFiredRef.current) {
          const timeInBackground = Date.now() - backgroundStartRef.current;
          console.log(`📱 Arka planda geçen süre: ${timeInBackground}ms (limit: ${backgroundDelay}ms)`);
          
          if (timeInBackground >= backgroundDelay) {
            console.log("⚠️ Arka plan limiti aşıldı - timeout tetikleniyor!");
            timeoutFiredRef.current = true;
            
            // State güncellemelerini güvenli şekilde yap
            if (isMountedRef.current) {
              setBackgroundStartTime(null);
            }
            backgroundStartRef.current = null;
            
            // Callback'leri en son çağır
            onBackgroundTimeout();
            onForeground?.();
            return;
          }
        }
        
        // Normal foreground dönüşü
        timeoutFiredRef.current = false;
        if (isMountedRef.current) {
          setBackgroundStartTime(null);
        }
        backgroundStartRef.current = null;
        onForeground?.();
      } else {
        // Arka plana alındı
        const now = Date.now();
        if (isMountedRef.current) {
          setBackgroundStartTime(now);
        }
        backgroundStartRef.current = now;
        onBackground?.();
        
        // Web için setTimeout (native'de çalışmaz ama zararsız)
        if (backgroundDelay > 0 && onBackgroundTimeout && !timeoutFiredRef.current) {
          clearBackgroundTimer();
          backgroundTimerRef.current = setTimeout(() => {
            if (!timeoutFiredRef.current && isMountedRef.current) {
              timeoutFiredRef.current = true;
              onBackgroundTimeout();
            }
          }, backgroundDelay);
        }
      }
    };

    // 🔥 KRİTİK: Global listener'ı kullan - AYRI appStateChange listener KURMA!
    // Bu sayede Android'de multiple listener çakışması OLMAZ!
    const unsubscribe = subscribeToForegroundState(handleStateChange);

    return () => {
      clearBackgroundTimer();
      unsubscribe();
    };
  }, [onBackground, onForeground, onBackgroundTimeout, backgroundDelay, clearBackgroundTimer]);

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
