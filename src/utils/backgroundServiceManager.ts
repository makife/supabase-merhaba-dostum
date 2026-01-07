import { NativeRealtime } from "@/plugins/NativeRealtime";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/**
 * 🔥 Background Service Manager
 * Arka plan servisini ve 1 dakikalık zamanlayıcıyı yönetir.
 */

// Servis Plugin ismini buraya yaz (Örn: 'BackgroundRunner', 'ForegroundService' vb.)
// Lovable/Capacitor projesinde muhtemelen özel bir plugin kullanıyorsun.
// Burayı senin kullandığın pluginin çağrılarına göre güncellemelisin.
const BACKGROUND_PLUGIN_NAME = "ForegroundService"; // Veya senin pluginin adı neyse

let stopTimer: NodeJS.Timeout | null = null;
let isServiceRunning = false;

// Native çağrıları güvenli hale getir
const nativeCall = async (action: "start" | "stop") => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // BURASI ÖNEMLİ: Kullandığın pluginin import ve metodlarını buraya bağla
    // Örnek: import { ForegroundService } from '...';
    // await ForegroundService.start(...);
    
    console.log(`[ServiceManager] ⚙️ Servis ${action} isteği gönderiliyor...`);
    
    // ⚠️ MOCKUP: Burayı kendi plugin metodunla değiştir
    // const { MyPlugin } = await import("my-plugin-path");
    // if (action === 'start') await MyPlugin.start();
    // else await MyPlugin.stop();
    
    isServiceRunning = (action === "start");
    
  } catch (e) {
    console.error(`[ServiceManager] ❌ ${action} hatası:`, e);
  }
};

export const BackgroundServiceManager = {
  // Uygulama ARKA PLANA geçtiğinde
  onAppBackground: async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    console.log("[ServiceManager] 🌑 Arka plan modu: Bildirim açılıyor + 1dk sayaç");
    try {
      // Servise "Arka plan moduna geç" emri ver
      // Bu komut servisi Foreground Service'e yükseltir ve bildirimi açar
      await NativeRealtime.enterBackgroundMode(); 
    } catch (e) {
      console.error("Background mode error:", e);
    }
  },

  // Uygulama ÖN PLANA geldiğinde
  onAppForeground: async () => {
    if (!Capacitor.isNativePlatform()) return;

    console.log("[ServiceManager] ☀️ Ön plan modu: Bildirim gizleniyor, sayaç iptal");
    try {
      // Servise "Ön plan moduna geç" emri ver
      // Bildirimi kaldırır, 1dk sayacını durdurur ama bağlantıyı KOPARMAZ
      await NativeRealtime.enterForegroundMode();
    } catch (e) {
      console.error("Foreground mode error:", e);
    }
  },
  
  // Uygulama ilk açıldığında
  init: async () => {
      // Cold start sonrası temizlik için ön plan modunu zorla
      if (Capacitor.isNativePlatform()) {
          await NativeRealtime.enterForegroundMode();
      }
  }
};
