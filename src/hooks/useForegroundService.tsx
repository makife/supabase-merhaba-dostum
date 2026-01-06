import { useCallback, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { CapacitorForegroundService } from "capacitor-foreground-service";

// 🔧 GLOBAL STATE - Module scope'da, tüm instance'lar paylaşıyor
let isForegroundServiceRunning = false;
let autoStopTimer: ReturnType<typeof setTimeout> | null = null;

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
  console.log(`[ForegroundService] ${action} | running=${isForegroundServiceRunning} | timer=${autoStopTimer !== null}`);
};

export const useForegroundService = () => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";

  const startForegroundService = useCallback(
    async (config?: Partial<ForegroundServiceConfig>) => {
      if (!isNative || !isAndroid) {
        console.log("[ForegroundService] ⏭️ Native değil, atlanıyor");
        return false;
      }
      if (isForegroundServiceRunning) {
        console.log("[ForegroundService] ⏭️ Zaten çalışıyor, tekrar başlatılmıyor");
        return true;
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
          console.log(`[ForegroundService] ⏰ ${maxDuration}ms doldu, otomatik durduruluyor...`);
          await stopForegroundServiceStandalone();
        }, maxDuration);

        return true;
      } catch (error) {
        console.error("[ForegroundService] ❌ Başlatma hatası:", error);
        return false;
      }
    },
    [isNative, isAndroid],
  );

  const stopForegroundService = useCallback(async () => {
    if (!isNative || !isAndroid) return;
    if (!isForegroundServiceRunning) {
      console.log("[ForegroundService] ⏭️ Zaten durdurulmuş, atlanıyor");
      return;
    }

    clearAutoStopTimer();

    try {
      logFSState("⏹️ DURDURULUYOR");
      await CapacitorForegroundService.stopService();
      isForegroundServiceRunning = false;
      logFSState("✅ DURDURULDU");
    } catch (error) {
      console.error("[ForegroundService] ❌ Durdurma hatası:", error);
      // Hata olsa bile state'i güncelle
      isForegroundServiceRunning = false;
    }
  }, [isNative, isAndroid]);

  return {
    startForegroundService,
    stopForegroundService,
    isRunning: isForegroundServiceRunning,
    isSupported: isNative && isAndroid,
  };
};

// --- Standalone Fonksiyonlar (hook dışından çağrılabilir) ---

export const startForegroundServiceStandalone = async (config?: Partial<ForegroundServiceConfig>): Promise<boolean> => {
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";
  
  if (!isNative || !isAndroid) {
    console.log("[ForegroundService] ⏭️ Standalone: Native değil, atlanıyor");
    return false;
  }
  
  if (isForegroundServiceRunning) {
    console.log("[ForegroundService] ⏭️ Standalone: Zaten çalışıyor");
    return true;
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
      console.log(`[ForegroundService] ⏰ Standalone ${maxDuration}ms doldu, otomatik durduruluyor...`);
      await stopForegroundServiceStandalone();
    }, maxDuration);

    return true;
  } catch (error) {
    console.error("[ForegroundService] ❌ Standalone başlatma hatası:", error);
    return false;
  }
};

export const stopForegroundServiceStandalone = async (): Promise<void> => {
  if (!isForegroundServiceRunning) {
    console.log("[ForegroundService] ⏭️ Standalone: Zaten durdurulmuş");
    return;
  }
  
  clearAutoStopTimer();
  
  try {
    logFSState("⏹️ STANDALONE DURDURULUYOR");
    await CapacitorForegroundService.stopService();
    isForegroundServiceRunning = false;
    logFSState("✅ STANDALONE DURDURULDU");
  } catch (error) {
    console.error("[ForegroundService] ❌ Standalone durdurma hatası:", error);
    // Hata olsa bile state'i güncelle
    isForegroundServiceRunning = false;
  }
};

// 🔧 Foreground service durumu kontrolü
export const isForegroundServiceActive = (): boolean => isForegroundServiceRunning;
