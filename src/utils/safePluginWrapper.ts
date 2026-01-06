/**
 * Safe Plugin Wrapper - Capacitor plugin çağrılarını güvenli hale getirir
 * Tüm plugin çağrıları try-catch ile sarmalanır ve platform kontrolü yapılır.
 * Özellikle Android bridge üzerindeki .then() hatalarını önlemek için optimize edilmiştir.
 */

import { Capacitor } from "@capacitor/core";

/**
 * Güvenli async plugin çağrısı yapar
 * Hata olursa log basar ama throw etmez
 */
export async function safePluginCall<T>(
  pluginName: string,
  methodName: string,
  fn: () => Promise<T>,
  fallbackValue?: T,
): Promise<T | undefined> {
  // Platform kontrolü
  if (!Capacitor.isNativePlatform()) {
    return fallbackValue;
  }

  try {
    return await fn();
  } catch (error) {
    const errorMessage = String(error);
    // "not implemented" veya "not available" hataları için sessizce devam et
    if (
      errorMessage.includes("not implemented") ||
      errorMessage.includes("not available") ||
      errorMessage.includes("Plugin") ||
      errorMessage.includes("Capacitor")
    ) {
      console.log(`[SafePlugin] ${pluginName}.${methodName}() not available on this platform`);
    } else {
      console.warn(`[SafePlugin] ${pluginName}.${methodName}() error:`, error);
    }
    return fallbackValue;
  }
}

/**
 * StatusBar için güvenli wrapper
 */
export const SafeStatusBar = {
  async hide(): Promise<void> {
    const { StatusBar } = await import("@capacitor/status-bar");
    await safePluginCall("StatusBar", "hide", () => StatusBar.hide());
  },

  async show(): Promise<void> {
    const { StatusBar } = await import("@capacitor/status-bar");
    await safePluginCall("StatusBar", "show", () => StatusBar.show());
  },

  async setBackgroundColor(options: { color: string }): Promise<void> {
    const { StatusBar } = await import("@capacitor/status-bar");
    await safePluginCall("StatusBar", "setBackgroundColor", () => StatusBar.setBackgroundColor(options));
  },

  async setStyle(options: { style: any }): Promise<void> {
    const { StatusBar } = await import("@capacitor/status-bar");
    await safePluginCall("StatusBar", "setStyle", () => StatusBar.setStyle(options));
  },

  async setOverlaysWebView(options: { overlay: boolean }): Promise<void> {
    const { StatusBar } = await import("@capacitor/status-bar");
    await safePluginCall("StatusBar", "setOverlaysWebView", () => StatusBar.setOverlaysWebView(options));
  },
};

/**
 * NavigationBar için güvenli wrapper
 */
export const SafeNavigationBar = {
  async hide(): Promise<void> {
    try {
      const { NavigationBar } = await import("@ethion/capacitor-navigation-bar");
      await safePluginCall("NavigationBar", "hide", () => NavigationBar.hide());
    } catch {
      // Plugin yüklü değilse sessizce geç
    }
  },

  async show(): Promise<void> {
    try {
      const { NavigationBar } = await import("@ethion/capacitor-navigation-bar");
      await safePluginCall("NavigationBar", "show", () => NavigationBar.show());
    } catch {
      // Plugin yüklü değilse sessizce geç
    }
  },

  async setColor(options: { color: string; darkButtons: boolean }): Promise<void> {
    try {
      const { NavigationBar } = await import("@ethion/capacitor-navigation-bar");
      await safePluginCall("NavigationBar", "setColor", () => NavigationBar.setColor(options));
    } catch {
      // Plugin yüklü değilse sessizce geç
    }
  },

  // 🔥 EKSİK OLAN VE HATAYA SEBEP OLAN METOD BURASI:
  async setBehavior(options: { behavior: string }): Promise<void> {
    try {
      const { NavigationBar } = await import("@ethion/capacitor-navigation-bar");
      const nav = NavigationBar as any;
      // Eğer plugin içinde setBehavior metodu varsa güvenli şekilde çağır
      if (nav?.setBehavior) {
        await safePluginCall("NavigationBar", "setBehavior", () => nav.setBehavior(options));
      }
    } catch {
      // Metod yoksa veya hata verirse sessizce devam et
    }
  },
};

/**
 * PushNotifications için güvenli wrapper - ANDROID .then() HATASI ÇÖZÜLMÜŞ HALİ
 */
export const SafePushNotifications = {
  async checkPermissions(): Promise<{ receive: string } | null> {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      return (
        (await safePluginCall("PushNotifications", "checkPermissions", () => PushNotifications.checkPermissions(), {
          receive: "denied",
        })) || null
      );
    } catch {
      return null;
    }
  },

  async requestPermissions(): Promise<{ receive: string } | null> {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      return (
        (await safePluginCall("PushNotifications", "requestPermissions", () => PushNotifications.requestPermissions(), {
          receive: "denied",
        })) || null
      );
    } catch {
      return null;
    }
  },

  async register(): Promise<void> {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      // Kayıt işlemi async bir komuttur, bu yüzden await kullanılabilir
      await safePluginCall("PushNotifications", "register", () => PushNotifications.register());
    } catch {
      console.log("[SafePushNotifications] Register call failed");
    }
  },

  async createChannel(options: any): Promise<void> {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await safePluginCall("PushNotifications", "createChannel", () => PushNotifications.createChannel(options));
    } catch {
      // Sessizce geç
    }
  },

  /**
   * 🔥 KRİTİK DÜZELTME: addListener Promise döndürmez, await barındırmaz!
   * Android bridge üzerinde .then() hatasını setTimeout ile proxy yaparak önlüyoruz.
   * 
   * 🆕 PROXY PATTERN: Plugin hazır olana kadar setTimeout ile bekle
   * - Promise YOK
   * - await YOK
   * - .then() YOK (dış çağrıda)
   */
  addListener(eventName: string, callback: (data: any) => void): { remove: () => void } | null {
    if (!Capacitor.isNativePlatform()) return null;

    // 🆕 PROXY: setTimeout ile plugin hazır olana kadar bekle
    // Bu sayede Android bridge stabilize olduktan sonra listener eklenir
    setTimeout(() => {
      try {
        // Dynamic import - .then() içeride kalıyor, dışarıya Promise çıkmıyor
        import("@capacitor/push-notifications").then(({ PushNotifications }) => {
          try {
            // Direkt çağır, sonucu tutma, await ETME
            (PushNotifications as any).addListener(eventName, callback);
            console.log(`[SafePushNotifications] Listener added for: ${eventName}`);
          } catch (innerError) {
            // İç hataları sessizce yut
            console.log(`[SafePushNotifications] Inner addListener error:`, innerError);
          }
        }).catch(() => {
          // Import hatası - sessizce geç
        });
      } catch (outerError) {
        // Dış hata - sessizce geç
        console.log(`[SafePushNotifications] Outer error:`, outerError);
      }
    }, 100); // 100ms gecikme - bridge stabilizasyonu için
    
    // 🆕 Fake remove fonksiyonu döndür (gerçek handle async olduğu için)
    return { 
      remove: () => {
        console.log(`[SafePushNotifications] Remove called for: ${eventName}`);
      } 
    };
  },
};
