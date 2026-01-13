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

// 🔥 Son arka plan zamanı - foreground'a gelince event tetiklemek için
let lastBackgroundTime: number | null = null;

// 🔥 CORE FUNCTION: Foreground state değişikliği yönetimi
// ÖNEMLİ: Bu fonksiyon ÇOK HAFİF olmalı - hiçbir native plugin çağrısı YAPMA!
const handleForegroundStateChange = (inForeground: boolean) => {
  const previousState = isAppInForeground;
  isAppInForeground = inForeground;

  console.log(`[AppForegroundState] 📱 State: ${inForeground ? "FOREGROUND" : "BACKGROUND"} (önceki: ${previousState ? "FG" : "BG"})`);

  // 🔥 KRİTİK: Tüm listener'ları ÖNCE bilgilendir (senkron)
  listeners.forEach((cb) => {
    try {
      cb(inForeground);
    } catch (e) {
      console.warn(e);
    }
  });

  // 🔥 KRİTİK: Native plugin çağrıları ve diğer async işlemler DEFER edilmeli!
  setTimeout(async () => {
    const manager = await getBackgroundServiceManager();
    
    if (inForeground) {
      // Ön plana geldi
      updateForegroundTime();
      
      // 🔥 Service manager çağrısı DEFER edildi
      if (manager) {
        manager.onAppForeground();
      }
      
      // 🔥 BASİT YAKLAŞIM: Tek bir "app-resumed" eventi dispatch et
      // Koşul: Daha önce arka plana gitmiştik (lastBackgroundTime != null)
      // VEYA önceki state background idi
      const shouldDispatchResume = lastBackgroundTime !== null || !previousState;
      
      if (shouldDispatchResume) {
        console.log("[AppForegroundState] 🎯 app-resumed eventi dispatch ediliyor...");
        console.log(`[AppForegroundState] 📊 lastBackgroundTime: ${lastBackgroundTime}, previousState: ${previousState}`);
        
        // 🔥 HIZLANDIRILDI: 500ms -> 100ms (Kotlin zaten bağlantıyı kurmuş durumda)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("app-resumed"));
          console.log("[AppForegroundState] ✅ app-resumed eventi gönderildi - tüm veriler yenilenecek");
          
          // Reset
          lastBackgroundTime = null;
        }, 100);
      } else {
        console.log("[AppForegroundState] ⏭️ app-resumed atlandı (ilk başlatma veya zaten FG)");
      }
    } else {
      // Arka plana geçti - zamanı kaydet
      lastBackgroundTime = Date.now();
      console.log(`[AppForegroundState] 🌙 Arka plan zamanı kaydedildi: ${lastBackgroundTime}`);
      
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

// 🔥 KRİTİK: Erken çağrıları önlemek için gecikme
let isListenerReady = false;
let pendingStateChanges: boolean[] = [];

// Listener'ı hazır hale getir (App.tsx'den çağrılacak)
export const markListenerReady = () => {
  console.log("[AppForegroundState] ✅ Listener artık hazır!");
  isListenerReady = true;
  
  // Bekleyen state değişikliklerini işle (sadece en sonuncusu önemli)
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

  // 🔥 KRİTİK: Native platform kontrolünü TRY-CATCH içinde yap
  // Bridge hazır olmayabilir!
  try {
    if (Capacitor.isNativePlatform()) {
      console.log("[AppForegroundState] 🔧 Native global listener kuruluyor...");

      // 🔥 KRİTİK: App.addListener'ı setTimeout içinde çağır
      // Bu sayede module load anında değil, event loop'ta çağrılır
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
      }, 100); // 100ms gecikme - bridge'in hazır olmasını bekle
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

// 🔥 KRİTİK: GLOBAL LISTENER'I HEMEN KURMA!
// App.tsx'den markListenerReady çağrıldığında kurulacak
// initGlobalListener(); // <- KALDIRILDI!

// Listener'ı başlat (App.tsx'den çağrılacak)
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
