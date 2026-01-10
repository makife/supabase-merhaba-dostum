import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import NativeRealtime, { isNativeRealtimeAvailable } from "@/plugins/NativeRealtime";

// 🔧 GLOBAL STATE - Module scope'da, tüm instance'lar paylaşıyor
let isForegroundServiceRunning = false;
let backgroundKillTimer: ReturnType<typeof setTimeout> | null = null;
let isAppInitialized = false;

// 🔥 Arka planda kalma süresi: 60 saniye sonra FS kapanır ve app kill olur
const BACKGROUND_KILL_TIMEOUT_MS = 60000;

interface ForegroundServiceConfig {
  title?: string;
  description?: string;
  notificationId?: number;
  icon?: string;
}

// 🔧 Kill timer'ı temizle
const clearBackgroundKillTimer = () => {
  if (backgroundKillTimer) {
    clearTimeout(backgroundKillTimer);
    backgroundKillTimer = null;
    console.log("[ForegroundService] ⏱️ Background kill timer iptal edildi");
  }
};

// 🔧 DEBUG: FS durumunu logla
const logFSState = (action: string) => {
  console.log(`[ForegroundService] ${action} | running=${isForegroundServiceRunning} | initialized=${isAppInitialized}`);
};

// --- Standalone Fonksiyonlar (hook dışından çağrılabilir) ---

export const startForegroundServiceStandalone = async (config?: ForegroundServiceConfig): Promise<boolean> => {
  if (!isNativeRealtimeAvailable()) {
    console.log("[ForegroundService] ⏭️ Native Android değil, atlıyorum");
    return false;
  }
  
  if (isForegroundServiceRunning) {
    logFSState("⏭️ Zaten çalışıyor, atlıyorum");
    return true;
  }

  try {
    logFSState("▶️ BAŞLATILIYOR (NativeRealtime.enterForegroundMode)");
    
    // 🔥 Senin native plugin'ini kullan
    await NativeRealtime.enterForegroundMode();
    
    isForegroundServiceRunning = true;
    logFSState("✅ BAŞLATILDI");

    return true;
  } catch (error) {
    console.error("[ForegroundService] ❌ Başlatma hatası:", error);
    return false;
  }
};

export const stopForegroundServiceStandalone = async (): Promise<void> => {
  if (!isForegroundServiceRunning) {
    logFSState("⏭️ Zaten durmuş, atlıyorum");
    return;
  }
  
  clearBackgroundKillTimer();

  if (!isNativeRealtimeAvailable()) {
    isForegroundServiceRunning = false;
    return;
  }
  
  try {
    logFSState("⏹️ DURDURULUYOR (NativeRealtime.enterBackgroundMode)");
    await NativeRealtime.enterBackgroundMode();
    isForegroundServiceRunning = false;
    logFSState("✅ DURDURULDU");
  } catch (error) {
    console.warn("[ForegroundService] ⚠️ Durdurma hatası:", error);
    isForegroundServiceRunning = false;
  }
};

// 🔥 Uygulama İLK BAŞLATILDIĞINDA çağrılır (sadece 1 kez)
export const initForegroundService = async (): Promise<boolean> => {
  const isAndroid = Capacitor.getPlatform() === "android";
  if (!isAndroid) {
    console.log("[ForegroundService] ⏭️ Android değil, init atlıyorum");
    isAppInitialized = true;
    return false;
  }
  
  if (isAppInitialized) {
    console.log("[ForegroundService] ⏭️ Zaten initialize edilmiş, atlıyorum");
    return true;
  }
  
  console.log("[ForegroundService] 🚀 İlk başlatma (NativeRealtime kullanılıyor)...");
  
  try {
    // NativeRealtime plugin'i ile foreground mode'a geç
    if (isNativeRealtimeAvailable()) {
      await NativeRealtime.enterForegroundMode();
      isForegroundServiceRunning = true;
      console.log("[ForegroundService] ✅ NativeRealtime foreground mode aktif");
    }
    
    isAppInitialized = true;
    return true;
  } catch (error) {
    console.warn("[ForegroundService] ⚠️ Init hatası (tolere edildi):", error);
    isAppInitialized = true;
    return false;
  }
};

// 🔥 Uygulama ÖN PLANA geldiğinde çağrılır
export const onAppEnteredForeground = async (): Promise<void> => {
  const isAndroid = Capacitor.getPlatform() === "android";
  if (!isAndroid) return;

  if (!isAppInitialized) {
    console.log("[ForegroundService] ⏭️ Henüz init edilmedi, foreground atlıyorum");
    return;
  }

  console.log("[ForegroundService] ☀️ Ön plana gelindi");
  
  // Kill timer'ı iptal et
  clearBackgroundKillTimer();
  
  // FS çalışmıyorsa başlat
  if (!isForegroundServiceRunning && isNativeRealtimeAvailable()) {
    try {
      await NativeRealtime.enterForegroundMode();
      isForegroundServiceRunning = true;
      console.log("[ForegroundService] ✅ Foreground mode yeniden aktif");
    } catch (e) {
      console.warn("[ForegroundService] ⚠️ Foreground mode hatası:", e);
    }
  }
};

// 🔥 Uygulama ARKA PLANA geçtiğinde çağrılır
export const onAppEnteredBackground = (): void => {
  const isAndroid = Capacitor.getPlatform() === "android";
  if (!isAndroid) return;

  if (!isAppInitialized) {
    console.log("[ForegroundService] ⏭️ Henüz init edilmedi, background atlıyorum");
    return;
  }

  console.log("[ForegroundService] 🌙 Arka plana geçildi");
  
  // Zaten bir timer varsa temizle
  clearBackgroundKillTimer();
  
  // 60 saniye sonra FS kapat ve app'i kill et
  backgroundKillTimer = setTimeout(async () => {
    console.log("[ForegroundService] ⏰ 60 saniye doldu - FS kapatılıyor ve app kill ediliyor");
    
    // Önce background mode'a geç (native service'e söyle)
    if (isNativeRealtimeAvailable()) {
      try {
        await NativeRealtime.enterBackgroundMode();
      } catch (e) {
        console.warn("[ForegroundService] ⚠️ Background mode hatası:", e);
      }
    }
    
    isForegroundServiceRunning = false;
    
    // Sonra app'i kill et
    try {
      await App.exitApp();
    } catch (e) {
      console.warn("[ForegroundService] ⚠️ App.exitApp hatası:", e);
    }
  }, BACKGROUND_KILL_TIMEOUT_MS);
  
  console.log(`[ForegroundService] ⏱️ Kill timer başlatıldı (${BACKGROUND_KILL_TIMEOUT_MS / 1000}s)`);
};

// 🔧 Foreground service durumu kontrolü
export const isForegroundServiceActive = (): boolean => isForegroundServiceRunning;

// 🔥 Hook - React bileşenlerinde kullanım için
export const useForegroundService = () => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";

  const startForegroundService = useCallback(
    async (config?: ForegroundServiceConfig) => {
      return startForegroundServiceStandalone(config);
    },
    [],
  );

  const stopForegroundService = useCallback(async () => {
    await stopForegroundServiceStandalone();
  }, []);

  return {
    startForegroundService,
    stopForegroundService,
    isRunning: isForegroundServiceRunning,
    isSupported: isNative && isAndroid,
  };
};
