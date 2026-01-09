import { useCallback, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

// 🔧 GLOBAL STATE - Module scope'da, tüm instance'lar paylaşıyor
let isForegroundServiceRunning = false;
let backgroundKillTimer: ReturnType<typeof setTimeout> | null = null;

// 🔥 Arka planda kalma süresi: 60 saniye sonra FS kapanır ve app kill olur
const BACKGROUND_KILL_TIMEOUT_MS = 60000;

// 🔧 Lazy import - sadece gerektiğinde yükle
let CapacitorForegroundService: any = null;

const loadForegroundServicePlugin = async (): Promise<boolean> => {
  if (CapacitorForegroundService) return true;
  
  try {
    const module = await import("capacitor-foreground-service");
    CapacitorForegroundService = module.CapacitorForegroundService;
    return true;
  } catch (error) {
    console.warn("[ForegroundService] Plugin yüklenemedi:", error);
    return false;
  }
};

interface ForegroundServiceConfig {
  title: string;
  description: string;
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
  console.log(`[ForegroundService] ${action} | running=${isForegroundServiceRunning}`);
};

// --- Standalone Fonksiyonlar (hook dışından çağrılabilir) ---

export const startForegroundServiceStandalone = async (config?: Partial<ForegroundServiceConfig>): Promise<boolean> => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";
  
  if (!isNative || !isAndroid) {
    return false;
  }
  
  if (isForegroundServiceRunning) {
    logFSState("⏭️ Zaten çalışıyor, atlıyorum");
    return true;
  }

  const loaded = await loadForegroundServicePlugin();
  if (!loaded || !CapacitorForegroundService) {
    console.warn("[ForegroundService] Standalone: Plugin mevcut değil");
    return false;
  }

  try {
    logFSState("▶️ BAŞLATILIYOR");
    
    await CapacitorForegroundService.startService({
      title: config?.title || "Kelimele",
      description: config?.description || "🎮 Oyun aktif",
      icon: config?.icon || "ic_stat_notification",
      notificationId: config?.notificationId || 1001,
    });
    
    isForegroundServiceRunning = true;
    logFSState("✅ BAŞLATILDI");

    return true;
  } catch (error) {
    console.warn("[ForegroundService] Başlatma hatası (tolere):", error);
    return false;
  }
};

export const stopForegroundServiceStandalone = async (): Promise<void> => {
  if (!isForegroundServiceRunning) {
    return;
  }
  
  clearBackgroundKillTimer();

  const loaded = await loadForegroundServicePlugin();
  if (!loaded || !CapacitorForegroundService) {
    isForegroundServiceRunning = false;
    return;
  }
  
  try {
    logFSState("⏹️ DURDURULUYOR");
    await CapacitorForegroundService.stopService();
    isForegroundServiceRunning = false;
    logFSState("✅ DURDURULDU");
  } catch (error) {
    console.warn("[ForegroundService] Durdurma hatası (tolere):", error);
    isForegroundServiceRunning = false;
  }
};

// 🔥 Uygulama ÖN PLANA geldiğinde çağrılır
export const onAppEnteredForeground = async (): Promise<void> => {
  const isAndroid = Capacitor.getPlatform() === "android";
  if (!isAndroid) return;

  console.log("[ForegroundService] ☀️ Ön plana gelindi");
  
  // Kill timer'ı iptal et
  clearBackgroundKillTimer();
  
  // FS zaten çalışıyorsa devam et, çalışmıyorsa başlat
  if (!isForegroundServiceRunning) {
    await startForegroundServiceStandalone({
      description: "🎮 Oyun aktif",
    });
  }
};

// 🔥 Uygulama ARKA PLANA geçtiğinde çağrılır
export const onAppEnteredBackground = (): void => {
  const isAndroid = Capacitor.getPlatform() === "android";
  if (!isAndroid) return;

  console.log("[ForegroundService] 🌙 Arka plana geçildi");
  
  // Zaten bir timer varsa temizle
  clearBackgroundKillTimer();
  
  // 60 saniye sonra FS kapat ve app'i kill et
  backgroundKillTimer = setTimeout(async () => {
    console.log("[ForegroundService] ⏰ 60 saniye doldu - FS kapatılıyor ve app kill ediliyor");
    
    // Önce FS'i kapat
    await stopForegroundServiceStandalone();
    
    // Sonra app'i kill et
    try {
      await App.exitApp();
    } catch (e) {
      console.warn("[ForegroundService] App.exitApp hatası:", e);
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
    async (config?: Partial<ForegroundServiceConfig>) => {
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
