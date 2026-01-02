import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { CapacitorForegroundService } from "capacitor-foreground-service";

let isForegroundServiceRunning = false;

interface ForegroundServiceConfig {
  title: string;
  description: string;
  notificationId?: number;
  icon?: string;
}

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
    return true;
  } catch (error) {
    console.error("[ForegroundService] Standalone başlatma hatası:", error);
    return false;
  }
};

export const stopForegroundServiceStandalone = async (): Promise<void> => {
  if (!isForegroundServiceRunning) return;
  
  try {
    await CapacitorForegroundService.stopService();
    isForegroundServiceRunning = false;
    console.log("[ForegroundService] Standalone durduruldu");
  } catch (error) {
    console.error("[ForegroundService] Standalone durdurma hatası:", error);
  }
};
