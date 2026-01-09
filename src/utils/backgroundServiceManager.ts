import { Capacitor } from "@capacitor/core";
import { 
  startForegroundServiceStandalone, 
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

export const BackgroundServiceManager = {
  // Uygulama ÖN PLANA geldiğinde
  onAppForeground: () => {
    if (!Capacitor.isNativePlatform()) return;

    console.log("[ServiceManager] ☀️ Ön plan modu");
    
    // Foreground service handler'ı çağır
    onAppEnteredForeground().catch((e) => {
      console.warn("[ServiceManager] ⚠️ Foreground handler hatası:", e);
    });
  },

  // Uygulama ARKA PLANA geçtiğinde
  onAppBackground: () => {
    if (!Capacitor.isNativePlatform()) return;

    console.log("[ServiceManager] 🌙 Arka plan modu");
    
    // Foreground service handler'ı çağır (kill timer başlatır)
    onAppEnteredBackground();
  },

  // Uygulama ilk açıldığında
  init: () => {
    if (!Capacitor.isNativePlatform()) return;
    
    console.log("[ServiceManager] 🚀 Başlatılıyor...");
    
    // Uygulama açıldığında hemen foreground service başlat
    startForegroundServiceStandalone({
      description: "🎮 Oyun aktif",
    }).then((success) => {
      if (success) {
        console.log("[ServiceManager] ✅ Init: Foreground service başlatıldı");
      } else {
        console.warn("[ServiceManager] ⚠️ Init: Foreground service başlatılamadı");
      }
    }).catch((e) => {
      console.warn("[ServiceManager] ⚠️ Init hatası:", e);
    });
  },
};
