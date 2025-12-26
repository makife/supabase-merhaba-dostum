import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// Global app foreground state - accessible from anywhere
let isAppInForeground = true;
const listeners: Set<(inForeground: boolean) => void> = new Set();

export const getIsAppInForeground = () => isAppInForeground;

export const subscribeToForegroundState = (callback: (inForeground: boolean) => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const setForegroundState = (inForeground: boolean) => {
  isAppInForeground = inForeground;
  listeners.forEach(cb => cb(inForeground));
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

    console.log("[AppState] Updated last_seen");
  } catch (error) {
    console.error("[AppState] Failed to update last_seen:", error);
  }
};

export function useAppForegroundState() {
  const [isInForeground, setIsInForeground] = useState(true);
  const isNative = Capacitor.isNativePlatform();
  const lastSeenIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleStateChange = (inForeground: boolean) => {
      setIsInForeground(inForeground);
      
      // When app comes to foreground, update last_seen immediately
      if (inForeground) {
        updateLastSeen();
      }
    };

    // Subscribe to global state changes
    const unsubscribe = subscribeToForegroundState(handleStateChange);

    // Start periodic last_seen updates (every 20 seconds when in foreground)
    const startLastSeenUpdates = () => {
      // Clear any existing interval
      if (lastSeenIntervalRef.current) {
        clearInterval(lastSeenIntervalRef.current);
      }

      // Initial update
      updateLastSeen();

      // Periodic updates every 20 seconds
      lastSeenIntervalRef.current = setInterval(() => {
        if (getIsAppInForeground()) {
          updateLastSeen();
        }
      }, 20000);
    };

    startLastSeenUpdates();

    // Initialize listeners
    const initializeListeners = async () => {
      if (isNative) {
        try {
          const { App } = await import("@capacitor/app");
          
          const listener = await App.addListener("appStateChange", ({ isActive }) => {
            console.log("[AppState] Native state changed:", isActive ? "foreground" : "background");
            setForegroundState(isActive);
          });

          return () => {
            listener.remove();
          };
        } catch (error) {
          console.error("[AppState] Error setting up native listener:", error);
        }
      } else {
        // Web: Use visibility change
        const handleVisibilityChange = () => {
          const isVisible = document.visibilityState === "visible";
          console.log("[AppState] Web visibility changed:", isVisible ? "visible" : "hidden");
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
      unsubscribe();
      cleanup?.();
      if (lastSeenIntervalRef.current) {
        clearInterval(lastSeenIntervalRef.current);
      }
    };
  }, [isNative]);

  return { isInForeground, isNative };
}
