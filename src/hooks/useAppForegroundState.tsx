import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import {
  startForegroundServiceStandalone,
  stopForegroundServiceStandalone,
} from "@/hooks/useForegroundService";
import { updateForegroundTime } from "@/utils/coldStartTime";

// Global app foreground state - accessible from anywhere
let isAppInForeground = true;
const listeners: Set<(inForeground: boolean) => void> = new Set();

export const getIsAppInForeground = () => isAppInForeground;

export const subscribeToForegroundState = (callback: (inForeground: boolean) => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

// 🆕 Arka plana geçiş sayacı - sadece 1 kez start et
let hasStartedFSThisBackground = false;

// 🔥 CORE FUNCTION: Foreground state değişikliği yönetimi
const handleForegroundStateChange = async (inForeground: boolean) => {
  const wasInBackground = !isAppInForeground;
  isAppInForeground = inForeground;

  // Tüm listener'ları bilgilendir
  listeners.forEach((cb) => cb(inForeground));

  console.log(`[AppForegroundState] 📱 State: ${inForeground ? 'FOREGROUND' : 'BACKGROUND'}`);

  // 🆕 FOREGROUND SERVICE YÖNETİMİ - SADECE ANDROID
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    if (inForeground) {
      // 📱 ÖN PLANA GELDİ
      // 1. İLK ÖNCE: __appForegroundTime'ı güncelle (AuthContext koruması için KRİTİK!)
      updateForegroundTime();
      console.log("[AppForegroundState] ✅ Foreground time güncellendi");

      // 2. FS DURDUR: 3.5 saniye sonra (Bridge rahatlasın)
      hasStartedFSThisBackground = false; // Reset flag
      
      setTimeout(() => {
        console.log("[AppForegroundState] 🛑 FS STOP komutu (ön planda ihtiyaç yok)");
        stopForegroundServiceStandalone()
          .then(() => console.log("[AppForegroundState] ✅ FS başarıyla durduruldu"))
          .catch((e) => console.log("[AppForegroundState] ⚠️ FS durdurma hatası (tolere):", e));
      }, 3500);
      
    } else {
      // 🔙 ARKA PLANA GEÇTİ: Servisi başlat (bağlantıyı koru)
      if (!hasStartedFSThisBackground) {
        hasStartedFSThisBackground = true;
        console.log("[AppForegroundState] 🚀 FS START komutu (arka plan - max 60s)");

        startForegroundServiceStandalone({
          title: "Kelimele",
          description: "🎮 Oyun bağlantısı korunuyor...",
          maxDurationMs: 60000,
        })
          .then((started) => console.log(`[AppForegroundState] ${started ? '✅ FS başlatıldı' : '⚠️ FS başlatılamadı'}`))
          .catch((e) => console.log("[AppForegroundState] ⚠️ FS başlatma hatası (tolere):", e));
      } else {
        console.log("[AppForegroundState] ⏭️ FS zaten başlatıldı, atlanıyor");
      }
    }
  }

  // 🔧 Ön plana gelince event dispatch et
  if (inForeground && wasInBackground) {
    console.log("[AppForegroundState] 🔔 supabase-reconnected event dispatch");
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

// 🔥 GLOBAL LISTENER - Sadece 1 kez kurulur (module scope)
let globalListenerInitialized = false;

const initGlobalListener = () => {
  if (globalListenerInitialized) return;
  globalListenerInitialized = true;
  
  if (Capacitor.isNativePlatform()) {
    console.log("[AppForegroundState] 🔧 Native global listener kuruluyor...");
    
    App.addListener("appStateChange", ({ isActive }) => {
      console.log(`[AppForegroundState] 📡 Native appStateChange: ${isActive ? 'ACTIVE' : 'INACTIVE'}`);
      handleForegroundStateChange(isActive);
    }).then(() => {
      console.log("[AppForegroundState] ✅ Native listener kuruldu");
    }).catch((err) => {
      console.error("[AppForegroundState] ❌ Native listener hatası:", err);
    });
  } else {
    console.log("[AppForegroundState] 🔧 Web visibility listener kuruluyor...");
    
    document.addEventListener("visibilitychange", () => {
      const isVisible = document.visibilityState === "visible";
      console.log(`[AppForegroundState] 👁️ Web visibility: ${isVisible ? 'VISIBLE' : 'HIDDEN'}`);
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
      if (inForeground) {
        updateLastSeen();
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
