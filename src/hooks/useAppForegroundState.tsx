import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { updateForegroundTime } from "@/utils/coldStartTime";
import { BackgroundServiceManager } from "@/utils/backgroundServiceManager";
import { 
  startSequentialForegroundRecovery, 
  abortAllPendingForegroundTasks,
  isOrchestrationRunning 
} from "@/utils/foregroundOrchestrator";

// Global app foreground state - accessible from anywhere
let isAppInForeground = true;
const listeners: Set<(inForeground: boolean) => void> = new Set();

// Sequential recovery tamamlandığında çağrılacak listener'lar
const recoveryCompleteListeners: Set<() => void> = new Set();

export const getIsAppInForeground = () => isAppInForeground;

export const subscribeToForegroundState = (callback: (inForeground: boolean) => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

/**
 * Sequential recovery tamamlandığında bildirim al
 * Hook'lar subscription'larını bu event'te açabilir
 */
export const subscribeToRecoveryComplete = (callback: () => void) => {
  recoveryCompleteListeners.add(callback);
  return () => recoveryCompleteListeners.delete(callback);
};

/**
 * Recovery tamamlandığında tüm listener'ları bilgilendir
 */
const notifyRecoveryComplete = () => {
  console.log(`[AppForegroundState] 🔔 Recovery complete - ${recoveryCompleteListeners.size} listener bilgilendiriliyor`);
  recoveryCompleteListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.warn("[AppForegroundState] Recovery listener hatası:", e);
    }
  });
};

// 🔥 CORE FUNCTION: Foreground state değişikliği yönetimi
const handleForegroundStateChange = (inForeground: boolean) => {
  const wasInBackground = !isAppInForeground;
  isAppInForeground = inForeground;

  console.log(`[AppForegroundState] 📱 State: ${inForeground ? "FOREGROUND" : "BACKGROUND"}`);

  if (inForeground && wasInBackground) {
    // 🚀 ARKA PLANDAN ÖN PLANA GEÇİŞ - Sequential Recovery başlat!
    console.log("[AppForegroundState] 🔄 Arka plandan dönüş - Sequential Recovery başlatılıyor...");
    
    // Native platformda sequential recovery kullan
    if (Capacitor.isNativePlatform()) {
      startSequentialForegroundRecovery({
        onCleanupStart: () => {
          console.log("[AppForegroundState] 🧹 Cleanup başladı");
        },
        onSessionRecoveryStart: () => {
          console.log("[AppForegroundState] 🔐 Session recovery başladı");
        },
        onSessionRecoveryComplete: (success) => {
          console.log(`[AppForegroundState] 🔐 Session recovery: ${success ? "✅" : "❌"}`);
        },
        onProfileFetchStart: () => {
          console.log("[AppForegroundState] 👤 Profile fetch başladı");
        },
        onProfileFetchComplete: (success) => {
          console.log(`[AppForegroundState] 👤 Profile fetch: ${success ? "✅" : "❌"}`);
        },
        onSubscriptionsReady: () => {
          console.log("[AppForegroundState] 📡 Subscription'lar açılabilir");
          // 🔔 Tüm hook'lara "subscription açabilirsiniz" sinyali gönder
          notifyRecoveryComplete();
        },
        onComplete: () => {
          console.log("[AppForegroundState] ✅ Sequential Recovery tamamlandı!");
          // Listener'ları bilgilendir
          listeners.forEach((cb) => {
            try {
              cb(true);
            } catch (e) {
              console.warn(e);
            }
          });
        },
        onError: (error) => {
          console.error("[AppForegroundState] ❌ Recovery hatası:", error);
          // Hata olsa bile listener'ları bilgilendir
          listeners.forEach((cb) => {
            try {
              cb(true);
            } catch (e) {
              console.warn(e);
            }
          });
        }
      });
      
      // Native plugin çağrılarını defer et
      setTimeout(() => {
        updateForegroundTime();
        BackgroundServiceManager.onAppForeground();
      }, 0);
      
    } else {
      // Web platformda eski davranış
      listeners.forEach((cb) => {
        try {
          cb(true);
        } catch (e) {
          console.warn(e);
        }
      });
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("supabase-reconnected"));
      }, 0);
    }
    
  } else if (inForeground) {
    // Zaten foreground'daydı
    listeners.forEach((cb) => {
      try {
        cb(true);
      } catch (e) {
        console.warn(e);
      }
    });
  } else {
    // 🔙 ARKA PLANA GEÇİŞ
    console.log("[AppForegroundState] 🔙 Arka plana geçiş");
    
    // Listener'ları bilgilendir
    listeners.forEach((cb) => {
      try {
        cb(false);
      } catch (e) {
        console.warn(e);
      }
    });
    
    // Native plugin çağrısı defer
    setTimeout(() => {
      BackgroundServiceManager.onAppBackground();
    }, 0);
  }
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
