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
  // Cache the module so listeners and register use the same instance
  _module: null as any,
  
  async _getModule() {
    if (!this._module) {
      const mod = await import("@capacitor/push-notifications");
      this._module = mod.PushNotifications;
    }
    return this._module;
  },

  async checkPermissions(): Promise<{ receive: string } | null> {
    try {
      const PushNotifications = await this._getModule();
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
      const PushNotifications = await this._getModule();
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
      const PushNotifications = await this._getModule();
      await safePluginCall("PushNotifications", "register", () => PushNotifications.register());
    } catch {
      console.log("[SafePushNotifications] Register call failed");
    }
  },

  async createChannel(options: any): Promise<void> {
    try {
      const PushNotifications = await this._getModule();
      await safePluginCall("PushNotifications", "createChannel", () => PushNotifications.createChannel(options));
    } catch {
      // Sessizce geç
    }
  },

  /**
   * 🔥 v3: Listener'ları ASYNC olarak ekle ve Promise döndür
   * register() çağrılmadan ÖNCE listener'ların eklenmesini garanti eder
   */
  async addListenerAsync(eventName: string, callback: (data: any) => void): Promise<{ remove: () => void } | null> {
    if (!Capacitor.isNativePlatform()) return null;

    try {
      const PushNotifications = await this._getModule();
      const handle = await (PushNotifications.addListener as any)(eventName, callback);
      console.log(`[SafePushNotifications] Listener added for: ${eventName}`);
      return handle || { remove: () => {} };
    } catch (error) {
      console.log(`[SafePushNotifications] addListener error for ${eventName}:`, error);
      return null;
    }
  },

  // Legacy sync version kept for backward compat
  addListener(eventName: string, callback: (data: any) => void): { remove: () => void } | null {
    if (!Capacitor.isNativePlatform()) return null;
    const listenerHandle = { remove: () => {} };
    
    setTimeout(async () => {
      try {
        const PushNotifications = await this._getModule();
        const handle = await (PushNotifications.addListener as any)(eventName, callback);
        if (handle?.remove) {
          listenerHandle.remove = () => { try { handle.remove(); } catch {} };
        }
        console.log(`[SafePushNotifications] Listener added for: ${eventName}`);
      } catch (error) {
        console.log(`[SafePushNotifications] addListener error for ${eventName}:`, error);
      }
    }, 150);
    
    return listenerHandle;
  },
};
