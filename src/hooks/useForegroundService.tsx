import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
// ÜCRETSİZ PLUGIN IMPORTU
import { ForegroundService } from "capacitor-foreground-service";

let isForegroundServiceRunning = false;

interface ForegroundServiceConfig {
  title: string;
  body: string;
  id?: number;
  smallIcon?: string;
}

export const useForegroundService = () => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";

  const startForegroundService = useCallback(
    async (config?: Partial<ForegroundServiceConfig>) => {
      if (!isNative || !isAndroid) return false;
      if (isForegroundServiceRunning) return true;

      try {
        // Ücretsiz plugin'in başlatma metodu
        await ForegroundService.start({
          id: config?.id || 1001,
          title: config?.title || "Kelimele",
          body: config?.body || "🔗 Bağlantı aktif",
          smallIcon: config?.smallIcon || "ic_stat_notification",
        });

        isForegroundServiceRunning = true;
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
      await ForegroundService.stop();
      isForegroundServiceRunning = false;
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

  try {
    await ForegroundService.start({
      id: config?.id || 1001,
      title: config?.title || "Kelimele",
      body: config?.body || "🔗 Bağlantı aktif",
      smallIcon: config?.smallIcon || "ic_stat_notification",
    });
    isForegroundServiceRunning = true;
    return true;
  } catch (error) {
    return false;
  }
};

export const stopForegroundServiceStandalone = async (): Promise<void> => {
  if (isForegroundServiceRunning) {
    await ForegroundService.stop();
    isForegroundServiceRunning = false;
  }
};
