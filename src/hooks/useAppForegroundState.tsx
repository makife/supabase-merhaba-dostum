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

// 🔥 LAZY IMPORT - döngüsel bağımlılığı önlemek için
let BackgroundServiceManagerRef: any = null;

const getBackgroundServiceManager = async () => {
  if (!BackgroundServiceManagerRef) {
    try {
      const module = await import("@/utils/backgroundServiceManager");
      BackgroundServiceManagerRef = module.BackgroundServiceManager;
    } catch (e) {
      console.warn("[AppForegroundState] BackgroundServiceManager import hatası:", e);
    }
  }
  return BackgroundServiceManagerRef;
};

// 🔥 CORE FUNCTION: Foreground state değişikliği yönetimi
// ÖNEMLİ: Bu fonksiyon ÇOK HAFİF olmalı - hiçbir native plugin çağrısı YAPMA!
const handleForegroundStateChange = (inForeground: boolean) => {
  const wasInBackground = !isAppInForeground;
  isAppInForeground = inForeground;

  console.log(`[AppForegroundState] 📱 State: ${inForeground ? "FOREGROUND" : "BACKGROUND"}`);

  // 🔥 KRİTİK: Tüm listener'ları ÖNCE bilgilendir (senkron)
  listeners.forEach((cb) => {
    try {
      cb(inForeground);
    } catch (e) {
      console.warn(e);
    }
  });

  // 🔥 KRİTİK: Native plugin çağrıları ve diğer async işlemler DEFER edilmeli!
  // setTimeout(0) ile event loop'un sonraki tick'ine atıyoruz
  // Bu sayede appStateChange callback'i hemen tamamlanıyor ve bridge bloke olmuyor
  setTimeout(async () => {
    const manager = await getBackgroundServiceManager();
    
    if (inForeground) {
      // Ön plana geldi
      updateForegroundTime();
      
      // 🔥 Service manager çağrısı DEFER edildi
      if (manager) {
        manager.onAppForeground();
      }
      
      // Reconnect event'i
      if (wasInBackground) {
        window.dispatchEvent(new CustomEvent("supabase-reconnected"));
      }
    } else {
      // Arka plana geçti
      // 🔥 Service manager çağrısı DEFER edildi
      if (manager) {
        manager.onAppBackground();
      }
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
    // Sessizce devam et - bağlantı sorunları olabilir
  }
};

// 🔥 GLOBAL LISTENER - Sadece 1 kez kurulur (module scope)
let globalListenerInitialized = false;

const initGlobalListener = () => {
  if (globalListenerInitialized) return;
  globalListenerInitialized = true;

  if (Capacitor.isNativePlatform()) {
    console.log("[AppForegroundState] 🔧 Native global listener kuruluyor...");

    App.addListener("appStateChange", ({ isActive }) => {
      // 🔥 KRİTİK: Bu callback ÇOK HAFİF olmalı!
      // Sadece state güncelle, HİÇBİR ağır işlem yapma!
      console.log(`[AppForegroundState] 📡 Native appStateChange: ${isActive ? "ACTIVE" : "INACTIVE"}`);
      handleForegroundStateChange(isActive);
    })
      .then(() => {
        console.log("[AppForegroundState] ✅ Native listener kuruldu");
      })
      .catch((err) => {
        console.error("[AppForegroundState] ❌ Native listener hatası:", err);
      });
  } else {
    console.log("[AppForegroundState] 🔧 Web visibility listener kuruluyor...");

    document.addEventListener("visibilitychange", () => {
      const isVisible = document.visibilityState === "visible";
      console.log(`[AppForegroundState] 👁️ Web visibility: ${isVisible ? "VISIBLE" : "HIDDEN"}`);
      handleForegroundStateChange(isVisible);
    });

    console.log("[AppForegroundState] ✅ Web listener kuruldu");
  }
};

// 🔥 GLOBAL LISTENER'I HEMEN KUR (module load anında)
initGlobalListener();

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
      // 🔥 DEFER: setTimeout ile async işlemi defer et
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
