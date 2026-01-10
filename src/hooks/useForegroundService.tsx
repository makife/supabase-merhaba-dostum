import { useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

// 🔧 GLOBAL STATE - Module scope'da, tüm instance'lar paylaşıyor
let isForegroundServiceRunning = false;
let backgroundKillTimer: ReturnType<typeof setTimeout> | null = null;
let isAppInitialized = false; // 🔥 Uygulama başlatıldı mı?

// 🔥 Arka planda kalma süresi: 60 saniye sonra FS kapanır ve app kill olur
const BACKGROUND_KILL_TIMEOUT_MS = 60000;

// 🔧 Plugin referansı - eagerly load edeceğiz
let CapacitorForegroundService: any = null;
let pluginLoadPromise: Promise<boolean> | null = null;

const loadForegroundServicePlugin = async (): Promise<boolean> => {
  if (CapacitorForegroundService) return true;
  
  // Eğer zaten yükleme devam ediyorsa, aynı promise'i bekle
  if (pluginLoadPromise) return pluginLoadPromise;
  
  pluginLoadPromise = (async () => {
    try {
      console.log("[ForegroundService] 📦 Plugin yükleniyor...");
      
      // 🔥 Timeout ile sarmalayarak sonsuz beklemeyi önle (3 saniye)
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error("Plugin load timeout")), 3000)
      );
      
      const importPromise = import("capacitor-foreground-service");
      const module = await Promise.race([importPromise, timeoutPromise]);
      
      if (!module) {
        console.warn("[ForegroundService] ❌ Plugin timeout");
        pluginLoadPromise = null; // Tekrar denenmesine izin ver
        return false;
      }
      
      CapacitorForegroundService = (module as any).CapacitorForegroundService;
      console.log("[ForegroundService] ✅ Plugin yüklendi");
      return true;
    } catch (error) {
      console.warn("[ForegroundService] ❌ Plugin yüklenemedi:", error);
      pluginLoadPromise = null; // Tekrar denenmesine izin ver
      return false;
    }
  })();
  
  return pluginLoadPromise;
};

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
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = Capacitor.getPlatform() === "android";
  
  if (!isNative || !isAndroid) {
    console.log("[ForegroundService] ⏭️ Native Android değil, atlıyorum");
    return false;
  }
  
  if (isForegroundServiceRunning) {
    logFSState("⏭️ Zaten çalışıyor, atlıyorum");
    return true;
  }

  const loaded = await loadForegroundServicePlugin();
  if (!loaded || !CapacitorForegroundService) {
    console.warn("[ForegroundService] ❌ Plugin mevcut değil, başlatılamıyor");
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
    console.warn("[ForegroundService] ⚠️ Durdurma hatası:", error);
    isForegroundServiceRunning = false;
  }
};

// 🔥 Uygulama İLK BAŞLATILDIĞINDA çağrılır (sadece 1 kez)
export const initForegroundService = async (): Promise<boolean> => {
  const isAndroid = Capacitor.getPlatform() === "android";
  if (!isAndroid) {
    console.log("[ForegroundService] ⏭️ Android değil, init atlıyorum");
    isAppInitialized = true; // Non-Android'de de initialized say ki lifecycle çalışsın
    return false;
  }
  
  if (isAppInitialized) {
    console.log("[ForegroundService] ⏭️ Zaten initialize edilmiş, atlıyorum");
    return true;
  }
  
  console.log("[ForegroundService] 🚀 İlk başlatma...");
  
  try {
    // Plugin'i önceden yükle (timeout korumalı)
    const loaded = await loadForegroundServicePlugin();
    
    if (!loaded) {
      console.warn("[ForegroundService] ⚠️ Plugin yüklenemedi, init başarısız ama app devam edecek");
      isAppInitialized = true; // Yine de initialized say
      return false;
    }
    
    // Foreground service'i başlat
    const success = await startForegroundServiceStandalone({
      description: "🎮 Oyun başlatılıyor...",
    });
    
    isAppInitialized = true; // Başarılı olsun olmasın, initialized olarak işaretle
    console.log(`[ForegroundService] ${success ? "✅" : "⚠️"} İlk başlatma tamamlandı (success=${success})`);
    
    return success;
  } catch (error) {
    console.warn("[ForegroundService] ❌ Init hatası (tolere edildi):", error);
    isAppInitialized = true; // Hata olsa bile initialized say
    return false;
  }
};

// 🔥 Uygulama ÖN PLANA geldiğinde çağrılır
export const onAppEnteredForeground = async (): Promise<void> => {
  const isAndroid = Capacitor.getPlatform() === "android";
  if (!isAndroid) return;

  // Uygulama henüz initialize edilmediyse, bu çağrıyı atla
  // (init fonksiyonu bunu halledecek)
  if (!isAppInitialized) {
    console.log("[ForegroundService] ⏭️ Henüz init edilmedi, foreground atlıyorum");
    return;
  }

  console.log("[ForegroundService] ☀️ Ön plana gelindi");
  
  // Kill timer'ı iptal et
  clearBackgroundKillTimer();
  
  // FS çalışmıyorsa başlat
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

  // Uygulama henüz initialize edilmediyse, bu çağrıyı atla
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
    
    // Önce FS'i kapat
    await stopForegroundServiceStandalone();
    
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
