import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase, getSupabaseClient } from "@/integrations/supabase/client";

// Global app foreground state - accessible from anywhere
let isAppInForeground = true;
const listeners: Set<(inForeground: boolean) => void> = new Set();

export const getIsAppInForeground = () => isAppInForeground;

export const subscribeToForegroundState = (callback: (inForeground: boolean) => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const setForegroundState = (inForeground: boolean) => {
  const wasInBackground = !isAppInForeground;
  isAppInForeground = inForeground;
  listeners.forEach(cb => cb(inForeground));

  // 🔧 KRİTİK: Native'de JS Supabase Realtime KULLANILMIYOR
  // Kotlin WebSocket arka planda çalışmaya devam ediyor
  // Bu yüzden burada reconnect yapmaya GEREK YOK
  if (inForeground && wasInBackground && Capacitor.isNativePlatform()) {
    console.log("[AppForegroundState] 📱 Ön plana gelindi - Kotlin WebSocket zaten aktif, JS reconnect ATLANIYОР");
    // Sadece event dispatch et - useNativeRealtime dinliyor
    window.dispatchEvent(new CustomEvent("supabase-reconnected"));
  }
};

// Update last_seen in database to track user activity
const updateLastSeen = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", user.id);
  } catch (error) {
    // Sessizce devam et - bağlantı sorunları olabilir
  }
};

export function useAppForegroundState() {
  const [isInForeground, setIsInForeground] = useState(true);
  const isNative = Capacitor.isNativePlatform();
  const lastSeenIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const handleStateChange = (inForeground: boolean) => {
      if (!isMountedRef.current) return;
      
      setIsInForeground(inForeground);
      
      // When app comes to foreground, update last_seen immediately
      if (inForeground) {
        updateLastSeen();
      }
    };

    // Subscribe to global state changes
    const unsubscribe = subscribeToForegroundState(handleStateChange);

    // Start periodic last_seen updates (every 30 seconds when in foreground)
    const startLastSeenUpdates = () => {
      // Clear any existing interval
      if (lastSeenIntervalRef.current) {
        clearInterval(lastSeenIntervalRef.current);
      }

      // Initial update
      updateLastSeen();

      // Periodic updates every 30 seconds
      lastSeenIntervalRef.current = setInterval(() => {
        if (getIsAppInForeground() && isMountedRef.current) {
          updateLastSeen();
        }
      }, 30000);
    };

    startLastSeenUpdates();

    // Initialize listeners - SADECE global state güncellemesi için
    // ⚠️ NOT: Kotlin sayaç metotları (startBackgroundTimer/stopBackgroundTimer) 
    // henüz implement edilmemiş, bu yüzden çağırmıyoruz.
    const initializeListeners = async () => {
      if (isNative) {
        try {
          const { App } = await import("@capacitor/app");
          
          const listener = await App.addListener("appStateChange", ({ isActive }) => {
            console.log("[AppForegroundState] Native state:", isActive ? "foreground" : "background");
            setForegroundState(isActive);
            // ⚠️ Native bağlantıyı ASLA kesme - Kotlin Foreground Service devam ediyor
          });

          return () => {
            listener.remove();
          };
        } catch (error) {
          console.error("[AppForegroundState] Error setting up native listener:", error);
        }
      } else {
        // Web: Use visibility change
        const handleVisibilityChange = () => {
          const isVisible = document.visibilityState === "visible";
          console.log("[AppForegroundState] Web visibility:", isVisible ? "visible" : "hidden");
          setForegroundState(isVisible);
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
      }
    };

    let cleanup: (() => void) | undefined;
    initializeListeners().then(cleanupFn => {
      cleanup = cleanupFn;
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
      cleanup?.();
      if (lastSeenIntervalRef.current) {
        clearInterval(lastSeenIntervalRef.current);
      }
    };
  }, [isNative]);

  return { isInForeground, isNative };
}
