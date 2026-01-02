import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";

let isForegroundServiceRunning = false;

interface ForegroundServiceConfig {
  title: string;
  description: string;
  notificationId?: number;
  icon?: string;
}

// Dinamik import - sadece Android'de yüklenir
const getForegroundServicePlugin = async () => {
  try {
    const { ForegroundService } = await import("capacitor-foreground-service");
    return ForegroundService;
  } catch (error) {
    console.error("[ForegroundService] Plugin yüklenemedi:", error);
    return null;
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
        const ForegroundService = await getForegroundServicePlugin();
        if (!ForegroundService) return false;

        await ForegroundService.startForegroundService({
          id: config?.notificationId || 1001,
          title: config?.title || "Kelimele",
          body: config?.description || "🔗 Bağlantı aktif",
          smallIcon: config?.icon || "ic_stat_notification",
        });

        isForegroundServiceRunning = true;
        console.log("✅ [ForegroundService] Başlatıldı");
        return true;
      } catch (error) {
        console.error("❌ [ForegroundService] Başlatma hatası:", error);
        return false;
      }
    },
    [isNative, isAndroid],
  );

  const stopForegroundService = useCallback(async () => {
    if (!isNative || !isAndroid || !isForegroundServiceRunning) return;

    try {
      const ForegroundService = await getForegroundServicePlugin();
      if (!ForegroundService) return;

      await ForegroundService.stopForegroundService();
      isForegroundServiceRunning = false;
      console.log("🛑 [ForegroundService] Durduruldu");
    } catch (error) {
      console.error("❌ [ForegroundService] Durdurma hatası:", error);
    }
  }, [isNative, isAndroid]);

  return {
    startForegroundService,
    stopForegroundService,
    isRunning: isForegroundServiceRunning,
    isSupported: isNative && isAndroid,
  };
};

// --- Standalone Fonksiyonlar (Context dışından çağrılabilir) ---
export const startForegroundServiceStandalone = async (config?: Partial<ForegroundServiceConfig>): Promise<boolean> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    console.log("[ForegroundService] Platform desteklenmiyor");
    return false;
  }
  
  if (isForegroundServiceRunning) {
    console.log("[ForegroundService] Zaten çalışıyor");
    return true;
  }

  try {
    const ForegroundService = await getForegroundServicePlugin();
    if (!ForegroundService) {
      console.error("[ForegroundService] Plugin bulunamadı");
      return false;
    }

    console.log("[ForegroundService] startForegroundService çağrılıyor...");
    
    await ForegroundService.startForegroundService({
      id: config?.notificationId || 1001,
      title: config?.title || "Kelimele",
      body: config?.description || "🔗 Bağlantı aktif",
      smallIcon: config?.icon || "ic_stat_notification",
    });
    
    isForegroundServiceRunning = true;
    console.log("✅ [ForegroundService] Standalone başarıyla başlatıldı");
    return true;
  } catch (error) {
    console.error("❌ [ForegroundService] Standalone başlatma hatası:", error);
    return false;
  }
};

export const stopForegroundServiceStandalone = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return;
  }
  
  if (!isForegroundServiceRunning) {
    console.log("[ForegroundService] Zaten durmuş");
    return;
  }
  
  try {
    const ForegroundService = await getForegroundServicePlugin();
    if (!ForegroundService) return;

    console.log("[ForegroundService] stopForegroundService çağrılıyor...");
    await ForegroundService.stopForegroundService();
    isForegroundServiceRunning = false;
    console.log("🛑 [ForegroundService] Standalone durduruldu");
  } catch (error) {
    console.error("❌ [ForegroundService] Standalone durdurma hatası:", error);
  }
};

export const isForegroundServiceActive = (): boolean => {
  return isForegroundServiceRunning;
};
