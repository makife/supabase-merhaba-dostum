import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

// Foreground Service için global state
let isForegroundServiceRunning = false;

interface ForegroundServiceConfig {
  title: string;
  body: string;
  icon?: string;
  smallIcon?: string;
}

export const useForegroundService = () => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";
  const serviceRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // Foreground Service başlat
  const startForegroundService = useCallback(async (config?: Partial<ForegroundServiceConfig>) => {
    if (!isNative || !isAndroid) {
      console.log("[ForegroundService] Web veya iOS - Foreground Service desteklenmiyor");
      return false;
    }

    if (isForegroundServiceRunning) {
      console.log("[ForegroundService] Servis zaten çalışıyor");
      return true;
    }

    try {
      const { ForegroundService } = await import("@capawesome-team/capacitor-android-foreground-service");
      serviceRef.current = ForegroundService;

      // Önce permission kontrolü
      const permResult = await ForegroundService.checkPermissions();
      console.log("[ForegroundService] Permission durumu:", permResult);

      if (permResult.display !== "granted") {
        console.log("[ForegroundService] Bildirim izni isteniyor...");
        const reqResult = await ForegroundService.requestPermissions();
        if (reqResult.display !== "granted") {
          console.log("[ForegroundService] ❌ Bildirim izni verilmedi");
          return false;
        }
      }

      // Foreground Service'i başlat
      await ForegroundService.startForegroundService({
        id: 1001,
        title: config?.title || "Kelimeci",
        body: config?.body || "🔗 Bağlantı aktif - Oyun devam ediyor",
        smallIcon: config?.smallIcon || "ic_stat_notification",
        buttons: [
          {
            title: "Oyuna Dön",
            id: 1,
          }
        ],
      });

      isForegroundServiceRunning = true;
      console.log("[ForegroundService] ✅ Foreground Service başlatıldı!");
      return true;
    } catch (error) {
      console.error("[ForegroundService] ❌ Başlatma hatası:", error);
      return false;
    }
  }, [isNative, isAndroid]);

  // Foreground Service durdur
  const stopForegroundService = useCallback(async () => {
    if (!isNative || !isAndroid) {
      return;
    }

    if (!isForegroundServiceRunning) {
      console.log("[ForegroundService] Servis zaten kapalı");
      return;
    }

    try {
      const { ForegroundService } = await import("@capawesome-team/capacitor-android-foreground-service");
      await ForegroundService.stopForegroundService();
      isForegroundServiceRunning = false;
      console.log("[ForegroundService] ✅ Foreground Service durduruldu");
    } catch (error) {
      console.error("[ForegroundService] ❌ Durdurma hatası:", error);
    }
  }, [isNative, isAndroid]);

  // Bildirimi güncelle
  const updateNotification = useCallback(async (config: Partial<ForegroundServiceConfig>) => {
    if (!isNative || !isAndroid || !isForegroundServiceRunning) {
      return;
    }

    try {
      const { ForegroundService } = await import("@capawesome-team/capacitor-android-foreground-service");
      await ForegroundService.updateForegroundService({
        id: 1001,
        title: config.title || "Kelimeci",
        body: config.body || "🔗 Bağlantı aktif",
        smallIcon: config.smallIcon || "ic_stat_notification",
      });
      console.log("[ForegroundService] ✅ Bildirim güncellendi");
    } catch (error) {
      console.error("[ForegroundService] ❌ Güncelleme hatası:", error);
    }
  }, [isNative, isAndroid]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    startForegroundService,
    stopForegroundService,
    updateNotification,
    isRunning: isForegroundServiceRunning,
    isSupported: isNative && isAndroid,
  };
};

// Standalone fonksiyonlar (context dışında kullanım için)
export const startForegroundServiceStandalone = async (config?: Partial<ForegroundServiceConfig>): Promise<boolean> => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";

  if (!isNative || !isAndroid) {
    console.log("[ForegroundService] Web veya iOS - Foreground Service desteklenmiyor");
    return false;
  }

  if (isForegroundServiceRunning) {
    console.log("[ForegroundService] Servis zaten çalışıyor");
    return true;
  }

  try {
    const { ForegroundService } = await import("@capawesome-team/capacitor-android-foreground-service");

    // Permission kontrolü
    const permResult = await ForegroundService.checkPermissions();
    if (permResult.display !== "granted") {
      const reqResult = await ForegroundService.requestPermissions();
      if (reqResult.display !== "granted") {
        console.log("[ForegroundService] ❌ Bildirim izni verilmedi");
        return false;
      }
    }

    await ForegroundService.startForegroundService({
      id: 1001,
      title: config?.title || "Kelimeci",
      body: config?.body || "🔗 Bağlantı aktif - Oyun devam ediyor",
      smallIcon: config?.smallIcon || "ic_stat_notification",
      buttons: [
        {
          title: "Oyuna Dön",
          id: 1,
        }
      ],
    });

    isForegroundServiceRunning = true;
    console.log("[ForegroundService] ✅ Foreground Service başlatıldı!");
    return true;
  } catch (error) {
    console.error("[ForegroundService] ❌ Başlatma hatası:", error);
    return false;
  }
};

export const stopForegroundServiceStandalone = async (): Promise<void> => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";

  if (!isNative || !isAndroid || !isForegroundServiceRunning) {
    return;
  }

  try {
    const { ForegroundService } = await import("@capawesome-team/capacitor-android-foreground-service");
    await ForegroundService.stopForegroundService();
    isForegroundServiceRunning = false;
    console.log("[ForegroundService] ✅ Foreground Service durduruldu");
  } catch (error) {
    console.error("[ForegroundService] ❌ Durdurma hatası:", error);
  }
};

export const updateForegroundNotification = async (config: Partial<ForegroundServiceConfig>): Promise<void> => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";

  if (!isNative || !isAndroid || !isForegroundServiceRunning) {
    return;
  }

  try {
    const { ForegroundService } = await import("@capawesome-team/capacitor-android-foreground-service");
    await ForegroundService.updateForegroundService({
      id: 1001,
      title: config.title || "Kelimeci",
      body: config.body || "🔗 Bağlantı aktif",
      smallIcon: config.smallIcon || "ic_stat_notification",
    });
  } catch (error) {
    console.error("[ForegroundService] ❌ Güncelleme hatası:", error);
  }
};

export const getIsForegroundServiceRunning = () => isForegroundServiceRunning;
