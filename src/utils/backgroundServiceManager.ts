import { Capacitor } from "@capacitor/core";
import { 
  initForegroundService, 
  onAppEnteredForeground, 
  onAppEnteredBackground 
} from "@/hooks/useForegroundService";

/**
 * 🔥 Background Service Manager
 * 
 * YENİ MANTIK:
 * - Uygulama ÖN PLANDAYKEN → Foreground Service HER ZAMAN AÇIK
 * - Uygulama ARKA PLANA GEÇTİĞİNDE → 60 saniyelik sayaç başlar
 * - 60 saniye dolmadan ÖN PLANA dönerse → Sayaç iptal, FS çalışmaya devam
 * - 60 saniye dolarsa → FS kapanır ve uygulama kill olur
 */

let isInitialized = false;

export const BackgroundServiceManager = {
  // Uygulama ÖN PLANA geldiğinde
  onAppForeground: () => {
    if (!Capacitor.isNativePlatform()) return;
    if (!isInitialized) {
      console.log("[ServiceManager] ⏭️ Henüz init edilmedi, foreground atlıyorum");
      return;
    }

    console.log("[ServiceManager] ☀️ Ön plan modu");
    
    // Foreground service handler'ı çağır
    onAppEnteredForeground().catch((e) => {
      console.warn("[ServiceManager] ⚠️ Foreground handler hatası:", e);
    });
  },

  // Uygulama ARKA PLANA geçtiğinde
  onAppBackground: () => {
    if (!Capacitor.isNativePlatform()) return;
    if (!isInitialized) {
      console.log("[ServiceManager] ⏭️ Henüz init edilmedi, background atlıyorum");
      return;
    }

    console.log("[ServiceManager] 🌙 Arka plan modu");
    
    // Foreground service handler'ı çağır (kill timer başlatır)
    onAppEnteredBackground();
  },

  // Uygulama ilk açıldığında - ASYNC ve AWAIT ile çağrılmalı!
  init: async (): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      console.log("[ServiceManager] ⏭️ Native değil, init atlıyorum");
      return false;
    }
    
    if (isInitialized) {
      console.log("[ServiceManager] ⏭️ Zaten init edilmiş");
      return true;
    }
    
    console.log("[ServiceManager] 🚀 Başlatılıyor...");
    
    try {
      const success = await initForegroundService();
      
      if (success) {
        isInitialized = true;
        console.log("[ServiceManager] ✅ Init tamamlandı");
      } else {
        console.warn("[ServiceManager] ⚠️ Init başarısız");
      }
      
      return success;
    } catch (e) {
      console.error("[ServiceManager] ❌ Init hatası:", e);
      return false;
    }
  },
  
  // Init durumunu kontrol et
  isInitialized: () => isInitialized,
};
