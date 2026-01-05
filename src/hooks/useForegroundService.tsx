import { useCallback, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { CapacitorForegroundService } from "capacitor-foreground-service";

let isForegroundServiceRunning = false;
let autoStopTimer: NodeJS.Timeout | null = null;

// 🆕 Maksimum foreground service çalışma süresi: 60 saniye
const MAX_FOREGROUND_SERVICE_DURATION_MS = 60000;

interface ForegroundServiceConfig {
  title: string;
  description: string;
  notificationId?: number;
  icon?: string;
  maxDurationMs?: number; // 🆕 Opsiyonel max süre
}

// 🆕 Timer'ı temizle
const clearAutoStopTimer = () => {
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
};

export const useForegroundService = () => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";

  const startForegroundService = useCallback(
    async (config?: Partial<ForegroundServiceConfig>) => {
      if (!isNative || !isAndroid) return false;
      if (isForegroundServiceRunning) return true;

      try {
        await CapacitorForegroundService.startService({
          title: config?.title || "Kelimele",
          description: config?.description || "🔗 Bağlantı aktif",
          icon: config?.icon || "ic_stat_notification",
          notificationId: config?.notificationId || 1001,
        });

        isForegroundServiceRunning = true;
        console.log("[ForegroundService] Başlatıldı");

        // 🆕 AUTO-STOP: Max süre sonunda otomatik durdur
        const maxDuration = config?.maxDurationMs || MAX_FOREGROUND_SERVICE_DURATION_MS;
        clearAutoStopTimer();
        autoStopTimer = setTimeout(async () => {
          console.log(`[ForegroundService] ⏰ ${maxDuration}ms doldu, otomatik durduruluyor...`);
          await stopForegroundServiceStandalone();
        }, maxDuration);

        return true;
      } catch (error) {
        console.error("[ForegroundService] Başlatma hatası:", error);
        return false;
      }
    },
    [isNative, isAndroid],
  );

  const stopForegroundService = useCallback(async () => {
    if (!isNative || !isAndroid || !isForegroundServiceRunning) return;

    clearAutoStopTimer();

    try {
      await CapacitorForegroundService.stopService();
      isForegroundServiceRunning = false;
      console.log("[ForegroundService] Durduruldu");
    } catch (error) {
      console.error("[ForegroundService] Durdurma hatası:", error);
    }
  }, [isNative, isAndroid]);

  return {
    startForegroundService,
    stopForegroundService,
    isRunning: isForegroundServiceRunning,
    isSupported: isNative && isAndroid,
  };
};

// --- Standalone Fonksiyonlar ---
export const startForegroundServiceStandalone = async (config?: Partial<ForegroundServiceConfig>): Promise<boolean> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return false;
  if (isForegroundServiceRunning) return true;

  try {
    await CapacitorForegroundService.startService({
      title: config?.title || "Kelimele",
      description: config?.description || "🔗 Bağlantı aktif",
      icon: config?.icon || "ic_stat_notification",
      notificationId: config?.notificationId || 1001,
    });
    isForegroundServiceRunning = true;
    console.log("[ForegroundService] Standalone başlatıldı");

    // 🆕 AUTO-STOP: Max süre sonunda otomatik durdur
    const maxDuration = config?.maxDurationMs || MAX_FOREGROUND_SERVICE_DURATION_MS;
    clearAutoStopTimer();
    autoStopTimer = setTimeout(async () => {
      console.log(`[ForegroundService] ⏰ ${maxDuration}ms doldu, otomatik durduruluyor...`);
      await stopForegroundServiceStandalone();
    }, maxDuration);

    return true;
  } catch (error) {
    console.error("[ForegroundService] Standalone başlatma hatası:", error);
    return false;
  }
};

export const stopForegroundServiceStandalone = async (): Promise<void> => {
  if (!isForegroundServiceRunning) return;
  
  clearAutoStopTimer();
  
  try {
    await CapacitorForegroundService.stopService();
    isForegroundServiceRunning = false;
    console.log("[ForegroundService] Standalone durduruldu");
  } catch (error) {
    console.error("[ForegroundService] Standalone durdurma hatası:", error);
  }
};

// 🆕 Foreground service durumu kontrolü
export const isForegroundServiceActive = (): boolean => isForegroundServiceRunning;
