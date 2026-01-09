import { Capacitor } from "@capacitor/core";

/**
 * 🔥 Background Service Manager (Simplified)
 * 
 * Artık foreground service kullanmıyoruz.
 * Sequential cold-start simulation sayesinde arka plandan dönüşte
 * her şeyi temiz bir şekilde yeniden yüklüyoruz.
 * 
 * Bu dosya sadece loglama ve gelecekte gerekirse genişletme için tutuluyor.
 */

export const BackgroundServiceManager = {
  // Uygulama ARKA PLANA geçtiğinde
  onAppBackground: () => {
    if (!Capacitor.isNativePlatform()) return;
    console.log("[ServiceManager] 🌑 Arka plan modu");
    // Artık foreground service başlatmıyoruz
    // Sequential recovery ile ön plana dönüşte her şey yeniden yüklenecek
  },

  // Uygulama ÖN PLANA geldiğinde
  onAppForeground: () => {
    if (!Capacitor.isNativePlatform()) return;
    console.log("[ServiceManager] ☀️ Ön plan modu");
    // Foreground service durdurmaya gerek yok çünkü zaten başlatmıyoruz
  },

  // Uygulama ilk açıldığında
  init: () => {
    if (!Capacitor.isNativePlatform()) return;
    console.log("[ServiceManager] 🚀 Başlatıldı (simplified mode)");
  },

  // Geriye uyumluluk için
  isRunning: () => false,
};
