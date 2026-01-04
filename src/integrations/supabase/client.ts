import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import type { Database } from "./types";

const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

// Native cihazlar için özel depolama adaptörü
const CapacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return localStorage.getItem(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  },
};

// Supabase client oluşturma fonksiyonu
const createSupabaseClient = (): SupabaseClient<Database> => {
  console.log("[SupabaseClient] 🆕 Yeni Supabase client oluşturuluyor...");
  
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: CapacitorStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Native çakışmalarını önlemek için kilidi kapatıyoruz
      lock: Capacitor.isNativePlatform() ? (false as any) : undefined,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
      // 🔧 KRİTİK: Daha kısa heartbeat - bağlantı kopmasını hemen algıla
      heartbeatIntervalMs: 5000, // 5 saniye - hızlı tespit
      // 🔧 KRİTİK: Çok agresif reconnect - hemen yeniden bağlan
      reconnectAfterMs: (tries: number) => {
        // Native'de çok hızlı reconnect - 500ms, 1s, 2s, max 5s
        if (Capacitor.isNativePlatform()) {
          const delay = Math.min(500 * Math.pow(2, tries), 5000);
          console.log(`[SupabaseClient] 🔄 Native reconnect attempt ${tries + 1}, waiting ${delay}ms`);
          return delay;
        }
        // Web'de normal backoff
        const delay = Math.min(1000 * Math.pow(2, tries), 30000);
        console.log(`[SupabaseClient] 🔄 Reconnect attempt ${tries + 1}, waiting ${delay}ms`);
        return delay;
      },
    },
    // 🔧 İYİLEŞTİRME: Global fetch timeout
    global: {
      fetch: (url, options) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout
        
        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));
      },
    },
  });

  // 🔧 KRİTİK: Native'de visibility change'i IGNORE et
  // Android WebView arka plana geçince WebSocket'i kapatmaya çalışabilir
  // Bunu engelleyemeyiz ama en azından hızlı reconnect yapabiliriz
  if (Capacitor.isNativePlatform() && typeof document !== "undefined") {
    // Supabase'in kendi disconnect mantığını override etmek için
    // realtime connection state'ini izle
    const checkAndReconnect = async () => {
      try {
        const state = (client.realtime as any).connectionState?.();
        if (state !== "open" && state !== "connecting") {
          console.log("[SupabaseClient] 🔄 Native bağlantı kopuk, yeniden bağlanıyor...");
          (client.realtime as any).connect?.();
        }
      } catch (e) {
        // Sessizce devam
      }
    };

    // Her 3 saniyede bir bağlantıyı kontrol et (native'de agresif)
    setInterval(checkAndReconnect, 3000);
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

// Sadece realtime bağlantısını yenile - MEVCUT BAĞLANTIYI KESME!
// Bu fonksiyon sadece bağlantı gerçekten koptuysa çağrılmalı
export const recreateSupabaseClient = async (): Promise<SupabaseClient<Database>> => {
  console.log("🔄 [SupabaseClient] ========== SOFT RECONNECT ==========");
  
  try {
    // 1. SESSION TOKEN GÜNCELLE (bağlantıyı kesmeden)
    console.log("[SupabaseClient] 1️⃣ Session kontrol (2s timeout)...");
    try {
      const sessionResult = await withTimeout(
        supabaseInstance.auth.getSession(),
        2000,
        { data: { session: null }, error: null }
      );
      
      if (sessionResult?.data?.session?.access_token) {
        supabaseInstance.realtime.setAuth(sessionResult.data.session.access_token);
        console.log("[SupabaseClient] ✅ Token ayarlandı");
      } else {
        console.log("[SupabaseClient] ⚠️ Session yok, refresh deneniyor...");
        const refreshResult = await withTimeout(
          supabaseInstance.auth.refreshSession(),
          2000,
          { data: { session: null, user: null }, error: null }
        );
        
        if (refreshResult?.data?.session?.access_token) {
          supabaseInstance.realtime.setAuth(refreshResult.data.session.access_token);
          console.log("[SupabaseClient] ✅ Token yenilendi");
        }
      }
    } catch (e) {
      console.log("[SupabaseClient] ⚠️ Session hatası:", e);
    }
    
    // 2. REALTIME DURUMUNU KONTROL ET
    const realtimeState = (supabaseInstance.realtime as any).connectionState?.();
    console.log("[SupabaseClient] 2️⃣ Realtime durumu:", realtimeState);
    
    // 3. SADECE bağlantı kapalıysa yeniden bağlan
    if (realtimeState !== 'open' && realtimeState !== 'connecting') {
      console.log("[SupabaseClient] 3️⃣ Bağlantı kapalı, yeniden bağlanılıyor...");
      try { 
        (supabaseInstance.realtime as any).connect?.(); 
      } catch {}
    } else {
      console.log("[SupabaseClient] 3️⃣ Bağlantı zaten açık, dokunulmuyor");
    }
    
    console.log("🎉 [SupabaseClient] ========== SOFT RECONNECT TAMAM ==========");
    
  } catch (error) {
    console.error("[SupabaseClient] ❌ Reconnect hatası:", error);
  }
  
  return supabaseInstance;
};

// ⚠️ KRİTİK: hardReconnect DEVRE DIŞI - bu fonksiyon disconnect() çağırıyor ve tüm bağlantıyı öldürüyordu
// Artık sadece soft reconnect kullanıyoruz
export const hardReconnect = async (): Promise<SupabaseClient<Database>> => {
  console.log("⚠️ [SupabaseClient] hardReconnect DEVRE DIŞI - soft reconnect kullanılıyor");
  
  // Hard reconnect yerine soft reconnect yap
  return recreateSupabaseClient();
};

// Client getter (her zaman güncel instance'ı döndürür)
export const getSupabaseClient = (): SupabaseClient<Database> => {
  return supabaseInstance;
};

// 🆕 Proaktif token yenileme - session expire olmadan önce yenile
let tokenRefreshInterval: NodeJS.Timeout | null = null;

export const startProactiveTokenRefresh = (): void => {
  if (tokenRefreshInterval) return;
  
  console.log("[SupabaseClient] 🔐 Proaktif token yenileme başlatıldı");
  
  tokenRefreshInterval = setInterval(async () => {
    try {
      const { data: sessionData } = await supabaseInstance.auth.getSession();
      const session = sessionData?.session;
      
      if (!session) return;
      
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      
      // 5 dakikadan az kaldıysa yenile
      if (timeUntilExpiry > 0 && timeUntilExpiry < 5 * 60 * 1000) {
        console.log("[SupabaseClient] 🔄 Token süresi dolmak üzere, yenileniyor...");
        const { data, error } = await supabaseInstance.auth.refreshSession();
        
        if (!error && data.session) {
          supabaseInstance.realtime.setAuth(data.session.access_token);
          console.log("[SupabaseClient] ✅ Token proaktif olarak yenilendi");
        }
      }
    } catch (e) {
      console.error("[SupabaseClient] Token yenileme hatası:", e);
    }
  }, 60000); // Her 1 dakikada bir kontrol et
};

export const stopProactiveTokenRefresh = (): void => {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
    console.log("[SupabaseClient] 🔐 Proaktif token yenileme durduruldu");
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
