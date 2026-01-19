/**
 * 🛡️ Foreground Service Hook
 * 
 * Camera/Gallery gibi native işlemler sırasında WebView'ın
 * OS tarafından öldürülmesini engeller.
 * 
 * Kullanım:
 * const { withForegroundService } = useForegroundService();
 * await withForegroundService(async () => { ... });
 */

import { useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { CapacitorForegroundService } from "capacitor-foreground-service";

// Global service state
let isServiceRunning = false;
let serviceRefCount = 0;

/**
 * Foreground service'i başlat
 */
export const startForegroundServiceStandalone = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    console.log("[ForegroundService] ⏭️ Web platform, skip");
    return false;
  }

  if (Capacitor.getPlatform() !== "android") {
    console.log("[ForegroundService] ⏭️ iOS doesn't need foreground service");
    return false;
  }

  try {
    serviceRefCount++;
    
    if (isServiceRunning) {
      console.log(`[ForegroundService] ♻️ Already running, refCount: ${serviceRefCount}`);
      return true;
    }

    console.log("[ForegroundService] 🚀 Starting foreground service...");
    
    await CapacitorForegroundService.startService({
      title: "İşlem Devam Ediyor",
      description: "Fotoğraf yükleniyor...",
      importance: 3, // HIGH - notification visible
      notificationId: 1001,
    });
    
    isServiceRunning = true;
    console.log("[ForegroundService] ✅ Foreground service started");
    return true;
  } catch (error) {
    console.error("[ForegroundService] ❌ Start failed:", error);
    serviceRefCount = Math.max(0, serviceRefCount - 1);
    return false;
  }
};

/**
 * Foreground service'i durdur
 */
export const stopForegroundServiceStandalone = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return;
  }

  serviceRefCount = Math.max(0, serviceRefCount - 1);
  
  if (serviceRefCount > 0) {
    console.log(`[ForegroundService] ⏳ Still in use, refCount: ${serviceRefCount}`);
    return;
  }

  if (!isServiceRunning) {
    console.log("[ForegroundService] ⏭️ Not running, skip stop");
    return;
  }

  try {
    console.log("[ForegroundService] ⏹️ Stopping foreground service...");
    await CapacitorForegroundService.stopService();
    isServiceRunning = false;
    console.log("[ForegroundService] ✅ Foreground service stopped");
  } catch (error) {
    console.error("[ForegroundService] ❌ Stop failed:", error);
    isServiceRunning = false;
  }
};

/**
 * Service aktif mi?
 */
export const isForegroundServiceActive = (): boolean => isServiceRunning;

/**
 * Foreground service hook
 */
export const useForegroundService = () => {
  const isRunningRef = useRef(false);

  /**
   * Foreground service'i başlat
   */
  const startForegroundService = useCallback(async (): Promise<boolean> => {
    const result = await startForegroundServiceStandalone();
    isRunningRef.current = result;
    return result;
  }, []);

  /**
   * Foreground service'i durdur
   */
  const stopForegroundService = useCallback(async (): Promise<void> => {
    await stopForegroundServiceStandalone();
    isRunningRef.current = false;
  }, []);

  /**
   * Bir işlemi foreground service koruması altında çalıştır
   * Service otomatik başlar ve işlem bitince durur
   */
  const withForegroundService = useCallback(async <T,>(
    operation: () => Promise<T>,
    options?: { title?: string; description?: string }
  ): Promise<T> => {
    const isAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
    
    if (isAndroid) {
      try {
        serviceRefCount++;
        
        if (!isServiceRunning) {
          console.log("[ForegroundService] 🛡️ Starting protection for operation...");
          await CapacitorForegroundService.startService({
            title: options?.title || "İşlem Devam Ediyor",
            description: options?.description || "Lütfen bekleyin...",
            importance: 3,
            notificationId: 1001,
          });
          isServiceRunning = true;
        }
      } catch (e) {
        console.warn("[ForegroundService] ⚠️ Could not start service:", e);
        serviceRefCount = Math.max(0, serviceRefCount - 1);
      }
    }

    try {
      // İşlemi çalıştır
      const result = await operation();
      return result;
    } finally {
      // İşlem bitince service'i kapat
      if (isAndroid) {
        serviceRefCount = Math.max(0, serviceRefCount - 1);
        
        if (serviceRefCount === 0 && isServiceRunning) {
          try {
            console.log("[ForegroundService] ✅ Operation complete, stopping service");
            await CapacitorForegroundService.stopService();
            isServiceRunning = false;
          } catch (e) {
            console.warn("[ForegroundService] ⚠️ Could not stop service:", e);
            isServiceRunning = false;
          }
        }
      }
    }
  }, []);

  return {
    startForegroundService,
    stopForegroundService,
    withForegroundService,
    isRunning: isRunningRef.current,
    isSupported: Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android",
  };
};
