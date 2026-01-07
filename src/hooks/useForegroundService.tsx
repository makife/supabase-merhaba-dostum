import { useCallback, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";

// 🔧 GLOBAL STATE - Module scope'da, tüm instance'lar paylaşıyor
let isForegroundServiceRunning = false;
let autoStopTimer: ReturnType<typeof setTimeout> | null = null;

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

// 🆕 Maksimum foreground service çalışma süresi: 60 saniye
const MAX_FOREGROUND_SERVICE_DURATION_MS = 60000;

interface ForegroundServiceConfig {
  title: string;
  description: string;
  notificationId?: number;
  icon?: string;
  maxDurationMs?: number;
}

// 🔧 Timer'ı temizle
const clearAutoStopTimer = () => {
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
};

// 🔧 DEBUG: FS durumunu logla
const logFSState = (action: string) => {
  console.log(`[ForegroundService] ${action} | running=${isForegroundServiceRunning}`);
};

export const useForegroundService = () => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";

  const startForegroundService = useCallback(
    async (config?: Partial<ForegroundServiceConfig>) => {
      if (!isNative || !isAndroid) {
        return false;
      }
      if (isForegroundServiceRunning) {
        return true;
      }

      const loaded = await loadForegroundServicePlugin();
      if (!loaded || !CapacitorForegroundService) {
        console.warn("[ForegroundService] Plugin mevcut değil");
        return false;
      }

      try {
        logFSState("▶️ BAŞLATILIYOR");
        
        await CapacitorForegroundService.startService({
          title: config?.title || "Kelimele",
          description: config?.description || "🔗 Bağlantı aktif",
          icon: config?.icon || "ic_stat_notification",
          notificationId: config?.notificationId || 1001,
        });

        isForegroundServiceRunning = true;
        logFSState("✅ BAŞLATILDI");

        // 🔧 AUTO-STOP: Max süre sonunda otomatik durdur
        const maxDuration = config?.maxDurationMs || MAX_FOREGROUND_SERVICE_DURATION_MS;
        clearAutoStopTimer();
        autoStopTimer = setTimeout(async () => {
          console.log(`[ForegroundService] ⏰ ${maxDuration}ms doldu, durduruluyor...`);
          await stopForegroundServiceStandalone();
        }, maxDuration);

        return true;
      } catch (error) {
        console.warn("[ForegroundService] Başlatma hatası (tolere):", error);
        return false;
      }
    },
    [isNative, isAndroid],
  );

  const stopForegroundService = useCallback(async () => {
    if (!isNative || !isAndroid) return;
    if (!isForegroundServiceRunning) return;

    await stopForegroundServiceStandalone();
  }, [isNative, isAndroid]);

  return {
    startForegroundService,
    stopForegroundService,
    isRunning: isForegroundServiceRunning,
    isSupported: isNative && isAndroid,
  };
};

// --- Standalone Fonksiyonlar (hook dışından çağrılabilir) ---
// 🔥 KRİTİK: Bu fonksiyonlar ASYNC ve HATA-TOLERANSLI olmalı!

export const startForegroundServiceStandalone = async (config?: Partial<ForegroundServiceConfig>): Promise<boolean> => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";
  
  if (!isNative || !isAndroid) {
    return false;
  }
  
  if (isForegroundServiceRunning) {
    return true;
  }

  // 🔧 Lazy load plugin
  const loaded = await loadForegroundServicePlugin();
  if (!loaded || !CapacitorForegroundService) {
    console.warn("[ForegroundService] Standalone: Plugin mevcut değil");
    return false;
  }

  try {
    logFSState("▶️ STANDALONE BAŞLATILIYOR");
    
    await CapacitorForegroundService.startService({
      title: config?.title || "Kelimele",
      description: config?.description || "🔗 Bağlantı aktif",
      icon: config?.icon || "ic_stat_notification",
      notificationId: config?.notificationId || 1001,
    });
    
    isForegroundServiceRunning = true;
    logFSState("✅ STANDALONE BAŞLATILDI");

    // 🔧 AUTO-STOP: Max süre sonunda otomatik durdur
    const maxDuration = config?.maxDurationMs || MAX_FOREGROUND_SERVICE_DURATION_MS;
    clearAutoStopTimer();
    autoStopTimer = setTimeout(async () => {
      console.log(`[ForegroundService] ⏰ Standalone ${maxDuration}ms doldu, durduruluyor...`);
      await stopForegroundServiceStandalone();
    }, maxDuration);

    return true;
  } catch (error) {
    console.warn("[ForegroundService] Standalone başlatma hatası (tolere):", error);
    return false;
  }
};

export const stopForegroundServiceStandalone = async (): Promise<void> => {
  if (!isForegroundServiceRunning) {
    return;
  }
  
  clearAutoStopTimer();

  // 🔧 Lazy load plugin
  const loaded = await loadForegroundServicePlugin();
  if (!loaded || !CapacitorForegroundService) {
    isForegroundServiceRunning = false;
    return;
  }
  
  try {
    logFSState("⏹️ STANDALONE DURDURULUYOR");
    await CapacitorForegroundService.stopService();
    isForegroundServiceRunning = false;
    logFSState("✅ STANDALONE DURDURULDU");
  } catch (error) {
    console.warn("[ForegroundService] Standalone durdurma hatası (tolere):", error);
    // Hata olsa bile state'i güncelle
    isForegroundServiceRunning = false;
  }
};

// 🔧 Foreground service durumu kontrolü
export const isForegroundServiceActive = (): boolean => isForegroundServiceRunning;
