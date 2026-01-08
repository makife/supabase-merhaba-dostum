import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import type { Database } from "./types";

const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

const isNative = Capacitor.isNativePlatform();

// 🔧 STORAGE KEY - tek bir key kullan
export const SESSION_STORAGE_KEY = "kelimele-auth-token-v2";

// ============================================================
// 🔥 NATIVE STORAGE ONLY - localStorage KULLANMA!
// Android WebView localStorage'ı temizleyebilir
// Supabase persistSession: false ile session'ı biz yönetiyoruz
// ============================================================

/**
 * Session'ı Preferences'a kaydet (ASYNC)
 */
export const saveSessionToStorage = async (session: Session | null): Promise<void> => {
  if (!session) {
    console.log("[Storage] 🗑️ Session siliniyor...");
    await Preferences.remove({ key: SESSION_STORAGE_KEY });
    return;
  }
  
  try {
    const data = JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: session.user,
    });
    
    await Preferences.set({ key: SESSION_STORAGE_KEY, value: data });
    console.log("[Storage] ✅ Session kaydedildi:", session.user?.email?.slice(0, 10) + "...");
  } catch (e) {
    console.error("[Storage] ❌ Session kaydetme hatası:", e);
  }
};

/**
 * Session'ı Preferences'tan oku (ASYNC)
 */
export const loadSessionFromStorage = async (): Promise<Session | null> => {
  try {
    const { value } = await Preferences.get({ key: SESSION_STORAGE_KEY });
    
    if (!value) {
      console.log("[Storage] ⚠️ Storage'da session yok");
      return null;
    }
    
    const parsed = JSON.parse(value);
    
    // Token geçerli mi kontrol et (1 dakika tolerans)
    const nowSec = Math.floor(Date.now() / 1000);
    if (parsed.expires_at && parsed.expires_at < nowSec - 60) {
      console.log("[Storage] ⏰ Token süresi dolmuş, refresh gerekli");
      // Süresi dolmuş ama refresh_token varsa session'ı yine de dön
      // refreshSession ile yenilenecek
    }
    
    console.log("[Storage] ✅ Session yüklendi:", parsed.user?.email?.slice(0, 10) + "...");
    
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      expires_at: parsed.expires_at,
      expires_in: parsed.expires_in || 3600,
      token_type: parsed.token_type || "bearer",
      user: parsed.user,
    } as Session;
  } catch (e) {
    console.error("[Storage] ❌ Session okuma hatası:", e);
    return null;
  }
};

/**
 * Storage'ı temizle
 */
export const clearSessionStorage = async (): Promise<void> => {
  await Preferences.remove({ key: SESSION_STORAGE_KEY });
  // Eski key'leri de temizle (migration)
  await Preferences.remove({ key: "kelimele-auth-token" });
  await Preferences.remove({ key: "sb-nnlvtqmuwmrqfinsgvwc-auth-token" });
  console.log("[Storage] 🗑️ Tüm session storage temizlendi");
};

// Supabase client oluşturma fonksiyonu
const createSupabaseClient = (): SupabaseClient<Database> => {
  console.log("[SupabaseClient] 🆕 Yeni Supabase client oluşturuluyor...");
  
  const isNativePlatform = Capacitor.isNativePlatform();
  
  // 🔧 KRİTİK: Native'de Realtime DEVRE DIŞI - Kotlin WebSocket kullanılacak
  const realtimeConfig = isNativePlatform ? {
    params: {
      eventsPerSecond: 0,
    },
    reconnectAfterMs: () => {
      console.log("[SupabaseClient] 🚫 Native'de JS Realtime DEVRE DIŞI - Kotlin kullanılıyor");
      return 999999999;
    },
  } : {
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
      // 🔥🔥🔥 KRİTİK: Native'de persistSession FALSE!
      // Session'ı biz Preferences ile yönetiyoruz
      // Supabase'in async-uyumsuz localStorage denemesini engelliyor
      persistSession: !isNativePlatform,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // Web'de localStorage kullan (normal davranış)
      storage: isNativePlatform ? undefined : localStorage,
    },
    realtime: realtimeConfig,
    global: {
      fetch: async (url, options?: RequestInit) => {
        const TIMEOUT_MS = isNativePlatform ? 12000 : 15000;
        
        const { signal: _ignoredSignal, ...optionsWithoutSignal } = options || {};
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn(`[Supabase] ⏱️ Fetch timeout (${TIMEOUT_MS}ms): ${url}`);
          controller.abort();
        }, TIMEOUT_MS);
        
        try {
          const response = await fetch(url, {
            ...optionsWithoutSignal,
            signal: controller.signal,
          });
          return response;
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            console.warn(`[Supabase] ⚠️ Request aborted: ${url}`);
            throw new Error(`Request timeout after ${TIMEOUT_MS}ms - please try again`);
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      },
    },
  });

  if (isNativePlatform) {
    console.log("[SupabaseClient] 🚫 Native platform - JS Realtime pasif, persistSession: false");
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
      setInterval(checkAndReconnect, 10000);
    }
  }

  return client;
};

// Global client instance
let supabaseInstance: SupabaseClient<Database> = createSupabaseClient();

// Timeout helper
const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => {
      console.log(`[SupabaseClient] ⏱️ ${ms}ms timeout aşıldı!`);
      resolve(fallback);
    }, ms))
  ]);
};

// Soft reconnect - session refresh
export const recreateSupabaseClient = async (): Promise<SupabaseClient<Database>> => {
  console.log("🔄 [SupabaseClient] ========== SOFT RECONNECT ==========");
  
  try {
    const sessionResult = await withTimeout(
      supabaseInstance.auth.getSession(),
      2000,
      { data: { session: null }, error: null }
    );
    
    if (sessionResult?.data?.session?.access_token) {
      supabaseInstance.realtime.setAuth(sessionResult.data.session.access_token);
      console.log("[SupabaseClient] ✅ Token realtime'a set edildi");
    }
    
    if (!Capacitor.isNativePlatform()) {
      const realtimeState = (supabaseInstance.realtime as any).connectionState?.();
      if (realtimeState !== 'open' && realtimeState !== 'connecting') {
        try { 
          (supabaseInstance.realtime as any).connect?.(); 
        } catch {}
      }
    }
    
  } catch (error) {
    console.error("[SupabaseClient] ❌ Reconnect hatası:", error);
  }
  
  return supabaseInstance;
};

export const hardReconnect = async (): Promise<SupabaseClient<Database>> => {
  console.log("⚠️ [SupabaseClient] hardReconnect DEVRE DIŞI");
  return supabaseInstance;
};

export const getSupabaseClient = (): SupabaseClient<Database> => {
  return supabaseInstance;
};

// Proaktif token yenileme DEVRE DIŞI
export const startProactiveTokenRefresh = (): void => {
  console.log("[SupabaseClient] 🔐 Proaktif token yenileme DEVRE DIŞI");
};

export const stopProactiveTokenRefresh = (): void => {};

export const getRealtimeConnectionState = (): string => {
  try {
    const state = (supabaseInstance.realtime as any).connectionState?.();
    return state || "unknown";
  } catch {
    return "unknown";
  }
};

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
