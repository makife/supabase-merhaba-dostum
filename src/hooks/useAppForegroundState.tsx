import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { updateForegroundTime } from "@/utils/coldStartTime";

// Global app foreground state - accessible from anywhere
let isAppInForeground = true;
const listeners: Set<(inForeground: boolean) => void> = new Set();

export const getIsAppInForeground = () => isAppInForeground;

export const subscribeToForegroundState = (callback: (inForeground: boolean) => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

// 🔥 Son arka plan zamanı - foreground'a gelince event tetiklemek için
let lastBackgroundTime: number | null = null;

// 🔥 CORE FUNCTION: Foreground state değişikliği yönetimi
const handleForegroundStateChange = (inForeground: boolean) => {
  const previousState = isAppInForeground;
  isAppInForeground = inForeground;

  console.log(
    `[AppForegroundState] 📱 State: ${inForeground ? "FOREGROUND" : "BACKGROUND"} (önceki: ${previousState ? "FG" : "BG"})`,
  );

  // 🔥 KRİTİK: Tüm listener'ları ÖNCE bilgilendir (senkron)
  listeners.forEach((cb) => {
    try {
      cb(inForeground);
    } catch (e) {
      console.warn(e);
    }
  });

  // 🔥 Async işlemler için setTimeout
  setTimeout(async () => {
    if (inForeground) {
      // Ön plana geldi
      updateForegroundTime();

      // 🔥 Foreground dönüşü eventleri
      const shouldDispatchResume = lastBackgroundTime !== null || !previousState;

      if (shouldDispatchResume) {
        console.log("[AppForegroundState] 🎯 Foreground dönüşü tespit edildi!");

        // 100ms sonra eventleri dispatch et
        setTimeout(async () => {
          // app-resumed eventi
          window.dispatchEvent(new CustomEvent("app-resumed"));
          console.log("[AppForegroundState] ✅ app-resumed eventi gönderildi");

          // data-ready dispatch et
          setTimeout(() => {
            console.log("[AppForegroundState] 🚀 data-ready eventi dispatch ediliyor...");
            window.dispatchEvent(
              new CustomEvent("data-ready", {
                detail: { source: "foreground-resume", timestamp: Date.now() },
              }),
            );
            console.log("[AppForegroundState] ✅ data-ready gönderildi");
          }, 200);

          // Reset
          lastBackgroundTime = null;
        }, 100);
      }
    } else {
      // Arka plana geçti - zamanı kaydet
      lastBackgroundTime = Date.now();
      console.log(`[AppForegroundState] 🌙 Arka plan zamanı kaydedildi: ${lastBackgroundTime}`);
    }
  }, 0);
};

// Update last_seen in database to track user activity
const updateLastSeen = async () => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
  } catch (error) {
    // Sessizce devam et
  }
};

// 🔥 GLOBAL LISTENER - Sadece 1 kez kurulur
let globalListenerInitialized = false;
let isListenerReady = false;
let pendingStateChanges: boolean[] = [];

// Listener'ı hazır hale getir
export const markListenerReady = () => {
  console.log("[AppForegroundState] ✅ Listener artık hazır!");
  isListenerReady = true;

  // Bekleyen state değişikliklerini işle
  if (pendingStateChanges.length > 0) {
    const lastState = pendingStateChanges[pendingStateChanges.length - 1];
    console.log(`[AppForegroundState] 📤 Bekleyen state işleniyor: ${lastState ? "FOREGROUND" : "BACKGROUND"}`);
    handleForegroundStateChange(lastState);
    pendingStateChanges = [];
  }
};

const initGlobalListener = () => {
  if (globalListenerInitialized) return;
  globalListenerInitialized = true;

  try {
    if (Capacitor.isNativePlatform()) {
      console.log("[AppForegroundState] 🔧 Native global listener kuruluyor...");

      setTimeout(() => {
        try {
          App.addListener("appStateChange", ({ isActive }) => {
            console.log(`[AppForegroundState] 📡 Native appStateChange: ${isActive ? "ACTIVE" : "INACTIVE"}`);

            if (!isListenerReady) {
              console.log("[AppForegroundState] ⏳ Listener henüz hazır değil, kuyruğa alındı");
              pendingStateChanges.push(isActive);
              return;
            }

            handleForegroundStateChange(isActive);
          })
            .then(() => {
              console.log("[AppForegroundState] ✅ Native listener kuruldu");
            })
            .catch((err) => {
              console.error("[AppForegroundState] ❌ Native listener hatası:", err);
            });
        } catch (e) {
          console.error("[AppForegroundState] ❌ App.addListener exception:", e);
        }
      }, 100);
    } else {
      console.log("[AppForegroundState] 🔧 Web visibility listener kuruluyor...");

      document.addEventListener("visibilitychange", () => {
        const isVisible = document.visibilityState === "visible";
        console.log(`[AppForegroundState] 👁️ Web visibility: ${isVisible ? "VISIBLE" : "HIDDEN"}`);

        if (!isListenerReady) {
          pendingStateChanges.push(isVisible);
          return;
        }

        handleForegroundStateChange(isVisible);
      });

      console.log("[AppForegroundState] ✅ Web listener kuruldu");
    }
  } catch (e) {
    console.error("[AppForegroundState] ❌ initGlobalListener exception:", e);
  }
};

// Listener'ı başlat
export const initAppStateListener = () => {
  initGlobalListener();
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

      if (inForeground) {
        setTimeout(() => updateLastSeen(), 0);
      }
    };

    // Subscribe to global state changes
    const unsubscribe = subscribeToForegroundState(handleStateChange);

    // Start periodic last_seen updates (every 30 seconds when in foreground)
    const startLastSeenUpdates = () => {
      if (lastSeenIntervalRef.current) {
        clearInterval(lastSeenIntervalRef.current);
      }

      updateLastSeen();

      lastSeenIntervalRef.current = setInterval(() => {
        if (getIsAppInForeground() && isMountedRef.current) {
          updateLastSeen();
        }
      }, 30000);
    };

    startLastSeenUpdates();

    return () => {
      isMountedRef.current = false;
      unsubscribe();
      if (lastSeenIntervalRef.current) {
        clearInterval(lastSeenIntervalRef.current);
      }
    };
  }, [isNative]);

  return { isInForeground, isNative };
}
