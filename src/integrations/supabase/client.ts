import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import type { Database } from "./types";

const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

// Native cihazlar için özel depolama adaptörü
// 🔧 KRİTİK: Hem async hem sync erişim için fallback mekanizması
const CapacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        // Önce localStorage'dan dene (sync, hızlı)
        const localValue = localStorage.getItem(key);
        if (localValue) {
          return localValue;
        }
        
        // Sonra Preferences'dan (async, kalıcı)
        const { value } = await Preferences.get({ key });
        
        // Preferences'da varsa localStorage'a da kopyala (sync erişim için)
        if (value) {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            // localStorage doluysa sessizce devam et
          }
        }
        
        return value;
      }
      return localStorage.getItem(key);
    } catch (e) {
      console.error("[CapacitorStorage] getItem error:", e);
      return localStorage.getItem(key);
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      // Her zaman localStorage'a yaz (sync erişim için)
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        // localStorage doluysa sessizce devam et
      }
      
      if (Capacitor.isNativePlatform()) {
        // Preferences'a da yaz (kalıcılık için)
        await Preferences.set({ key, value });
      }
    } catch (e) {
      console.error("[CapacitorStorage] setItem error:", e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      localStorage.removeItem(key);
      
      if (Capacitor.isNativePlatform()) {
        await Preferences.remove({ key });
      }
    } catch (e) {
      console.error("[CapacitorStorage] removeItem error:", e);
    }
  },
};

// Supabase client oluşturma fonksiyonu
const createSupabaseClient = (): SupabaseClient<Database> => {
  console.log("[SupabaseClient] 🆕 Yeni Supabase client oluşturuluyor...");
  
  const isNativePlatform = Capacitor.isNativePlatform();
  
  // 🔧 KRİTİK: Native'de Realtime DEVRE DIŞI - Kotlin WebSocket kullanılacak
  // WebView'deki WebSocket arka plana geçince ölüyor, bu yüzden native'de hiç açmıyoruz
  const realtimeConfig = isNativePlatform ? {
    // Native'de Supabase Realtime'ı TAMAMEN DEVRE DIŞI birak
    // Kotlin NativeRealtimePlugin bağlantıyı yönetiyor
    params: {
      eventsPerSecond: 0, // Hiç event gönderme
    },
    // Bağlantıyı hemen kes ve yeniden bağlanma
    reconnectAfterMs: () => {
      console.log("[SupabaseClient] 🚫 Native'de JS Realtime DEVRE DIŞI - Kotlin kullanılıyor");
      return 999999999; // Asla reconnect etme
    },
  } : {
    // Web'de normal realtime
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 15000,
    reconnectAfterMs: (tries: number) => {
      const delay = Math.min(1000 * Math.pow(2, tries), 30000);
      console.log(`[SupabaseClient] 🔄 Web reconnect attempt ${tries + 1}, waiting ${delay}ms`);
      return delay;
    },
  };
  
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: CapacitorStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: isNativePlatform ? (false as any) : undefined,
    },
    realtime: realtimeConfig,
    global: {
      fetch: (url, options) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
      },
    },
  });

  // 🔧 Native'de sadece log - disconnect() ÇAĞIRMIYORUZ
  // reconnectAfterMs zaten 999999999 olduğu için JS Realtime hiç bağlanmayacak
  if (isNativePlatform) {
    console.log("[SupabaseClient] 🚫 Native platform - JS Realtime pasif (Kotlin WebSocket aktif)");
    // ❌ disconnect() ÇAĞIRMIYORUZ - gereksiz ve tehlikeli olabilir
  } else {
    // Sadece WEB'de realtime kontrol mekanizması
    if (typeof document !== "undefined") {
      const checkAndReconnect = async () => {
        try {
          const state = (client.realtime as any).connectionState?.();
          if (state !== "open" && state !== "connecting") {
            console.log("[SupabaseClient] 🔄 Web bağlantı kopuk, yeniden bağlanıyor...");
            (client.realtime as any).connect?.();
          }
        } catch (e) {
          // Sessizce devam
        }
      };
      setInterval(checkAndReconnect, 10000); // Web'de 10 saniyede bir kontrol
    }
  }

  return client;
};

// Global client instance
let supabaseInstance: SupabaseClient<Database> = createSupabaseClient();

// Timeout helper - native'de getSession asılı kalabiliyor
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => {
      console.log(`[SupabaseClient] ⏱️ ${ms}ms timeout aşıldı!`);
      resolve(fallback);
    }, ms))
  ]);
};

// Sadece realtime bağlantısını kontrol et - TOKEN REFRESH YAPMA!
// Supabase client zaten autoRefreshToken: true ile token'ı yönetiyor
export const recreateSupabaseClient = async (): Promise<SupabaseClient<Database>> => {
  console.log("🔄 [SupabaseClient] ========== SOFT RECONNECT ==========");
  
  try {
    // 1. SADECE mevcut session'ı OKU (refresh YAPMA!)
    console.log("[SupabaseClient] 1️⃣ Session kontrol...");
    try {
      const sessionResult = await withTimeout(
        supabaseInstance.auth.getSession(),
        2000,
        { data: { session: null }, error: null }
      );
      
      if (sessionResult?.data?.session?.access_token) {
        // Sadece token'ı realtime'a set et, refresh YAPMA
        supabaseInstance.realtime.setAuth(sessionResult.data.session.access_token);
        console.log("[SupabaseClient] ✅ Mevcut token kullanıldı");
      } else {
        console.log("[SupabaseClient] ⚠️ Session yok - Supabase otomatik yenileyecek");
        // ❌ MANUEL REFRESH YAPMA - Supabase client autoRefreshToken ile hallediyor
      }
    } catch (e) {
      console.log("[SupabaseClient] ⚠️ Session okuma hatası:", e);
    }
    
    // 2. REALTIME DURUMUNU KONTROL ET (sadece web'de)
    if (!Capacitor.isNativePlatform()) {
      const realtimeState = (supabaseInstance.realtime as any).connectionState?.();
      console.log("[SupabaseClient] 2️⃣ Realtime durumu:", realtimeState);
      
      if (realtimeState !== 'open' && realtimeState !== 'connecting') {
        console.log("[SupabaseClient] 3️⃣ Bağlantı kapalı, yeniden bağlanılıyor...");
        try { 
          (supabaseInstance.realtime as any).connect?.(); 
        } catch {}
      }
    }
    
    console.log("🎉 [SupabaseClient] ========== SOFT RECONNECT TAMAM ==========");
    
  } catch (error) {
    console.error("[SupabaseClient] ❌ Reconnect hatası:", error);
  }
  
  return supabaseInstance;
};

// ⚠️ DEVRE DIŞI
export const hardReconnect = async (): Promise<SupabaseClient<Database>> => {
  console.log("⚠️ [SupabaseClient] hardReconnect DEVRE DIŞI");
  return supabaseInstance;
};

// Client getter (her zaman güncel instance'ı döndürür)
export const getSupabaseClient = (): SupabaseClient<Database> => {
  return supabaseInstance;
};

// 🚫 DEVRE DIŞI: Proaktif token yenileme - Supabase client zaten autoRefreshToken: true ile yapıyor
// Manuel refresh = race condition = "Invalid Refresh Token" hatası
let tokenRefreshInterval: NodeJS.Timeout | null = null;

export const startProactiveTokenRefresh = (): void => {
  // ❌ DEVRE DIŞI - Supabase autoRefreshToken zaten yapıyor
  console.log("[SupabaseClient] 🔐 Proaktif token yenileme DEVRE DIŞI (Supabase autoRefresh aktif)");
};

export const stopProactiveTokenRefresh = (): void => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
};

// 🆕 Bağlantı durumunu al
export const getRealtimeConnectionState = (): string => {
  try {
    const state = (supabaseInstance.realtime as any).connectionState?.();
    return state || "unknown";
  } catch {
    return "unknown";
  }
};

// 🆕 Aktif kanal sayısını al
export const getActiveChannelCount = (): number => {
  try {
    return supabaseInstance.getChannels().length;
  } catch {
    return 0;
  }
};

// Geriye dönük uyumluluk için - ana export
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get: (_, prop) => {
    return (supabaseInstance as any)[prop];
  },
});

// 🆕 Otomatik başlat (client yüklendiğinde)
if (typeof window !== "undefined") {
  // Sayfa yüklendiğinde proaktif yenileme başlat
  window.addEventListener("load", () => {
    startProactiveTokenRefresh();
  });
  
  // Sayfa kapatıldığında durdur
  window.addEventListener("beforeunload", () => {
    stopProactiveTokenRefresh();
  });
}
