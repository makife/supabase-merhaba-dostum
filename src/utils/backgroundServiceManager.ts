import { NativeRealtime } from "@/plugins/NativeRealtime";
import { Capacitor } from "@capacitor/core";

/**
 * 🔥 Background Service Manager
 * Arka plan servisini ve 1 dakikalık zamanlayıcıyı yönetir.
 * 
 * ⚠️ KRİTİK: Bu sınıfın metodları appStateChange callback'inden çağrılıyor!
 * Native plugin çağrıları asenkron ve GÜVENLİ olmalı - hata fırlatmamalı!
 */

let isServiceRunning = false;

export const BackgroundServiceManager = {
  // Uygulama ARKA PLANA geçtiğinde
  onAppBackground: () => {
    if (!Capacitor.isNativePlatform()) return;

    console.log("[ServiceManager] 🌑 Arka plan modu: Bildirim açılıyor");
    
    // 🔥 KRİTİK: Native çağrısı ASYNC ve GÜVENLİ - hata fırlatmaz
    // Promise'i await etmiyoruz çünkü callback bloke olmamalı
    NativeRealtime.enterBackgroundMode()
      .then(() => {
        isServiceRunning = true;
        console.log("[ServiceManager] ✅ Background mode aktif");
      })
      .catch((e) => {
        console.warn("[ServiceManager] ⚠️ Background mode hatası (sessiz):", e);
      });
  },

  // Uygulama ÖN PLANA geldiğinde
  onAppForeground: () => {
    if (!Capacitor.isNativePlatform()) return;

    console.log("[ServiceManager] ☀️ Ön plan modu: Bildirim gizleniyor");
    
    // 🔥 KRİTİK: Native çağrısı ASYNC ve GÜVENLİ - hata fırlatmaz
    NativeRealtime.enterForegroundMode()
      .then(() => {
        isServiceRunning = false;
        console.log("[ServiceManager] ✅ Foreground mode aktif");
        
        // 500ms sonra durumu kontrol et (opsiyonel)
        setTimeout(async () => {
          try {
            const { state } = await NativeRealtime.getConnectionState();
            console.log("[ServiceManager] 🔎 Bağlantı durumu:", state);
          } catch (e) {
            // Sessizce devam
          }
        }, 500);
      })
      .catch((e) => {
        console.warn("[ServiceManager] ⚠️ Foreground mode hatası (sessiz):", e);
      });
  },

  // Uygulama ilk açıldığında
  init: () => {
    if (!Capacitor.isNativePlatform()) return;
    
    console.log("[ServiceManager] 🚀 Başlatılıyor...");
    
    // Cold start sonrası temizlik için ön plan modunu zorla
    NativeRealtime.enterForegroundMode()
      .then(() => {
        console.log("[ServiceManager] ✅ Init tamamlandı");
      })
      .catch((e) => {
        console.warn("[ServiceManager] ⚠️ Init hatası (sessiz):", e);
      });
  },

  // Servis durumu
  isRunning: () => isServiceRunning,
};
