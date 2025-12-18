import { useEffect, useState, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export const useAppState = (onBackground?: () => void, onForeground?: () => void, backgroundDelay: number = 0) => {
  const [isActive, setIsActive] = useState(true);
  const isNative = Capacitor.isNativePlatform(); // State yerine doğrudan değişken
  const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleStateChange = (active: boolean) => {
      setIsActive(active);

      if (active) {
        if (backgroundTimerRef.current) {
          clearTimeout(backgroundTimerRef.current);
          backgroundTimerRef.current = null;
        }
        onForeground?.();
      } else {
        if (backgroundDelay > 0) {
          backgroundTimerRef.current = setTimeout(() => {
            onBackground?.();
            backgroundTimerRef.current = null;
          }, backgroundDelay);
        } else {
          onBackground?.();
        }
      }
    };

    if (!isNative) {
      const handleVisibilityChange = () => handleStateChange(!document.hidden);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    } else {
      // Native tarafta listener'ı bir değişkende tutup temizliyoruz
      const listenerPromise = App.addListener("appStateChange", (state) => {
        handleStateChange(state.isActive);
      });

      return () => {
        listenerPromise.then((l) => l.remove());
        if (backgroundTimerRef.current) clearTimeout(backgroundTimerRef.current);
      };
    }
  }, [onBackground, onForeground, backgroundDelay, isNative]);

  return { isActive, isNative };
};
