import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import type { Database } from "./types";

const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

const isNative = Capacitor.isNativePlatform();

// 🔧 TEK STORAGE KEY - HER YERDE BU KULLANILACAK
export const SESSION_STORAGE_KEY = "kelimele-session-v3";

// ============================================================
// 🔥 SESSION STORAGE - TEK KAYNAK TEK DOĞRULUK
// ============================================================

/**
 * Session'ı Preferences'a kaydet
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
      // 🔥 Kayıt zamanı - debug için
      saved_at: Date.now(),
    });
    
    await Preferences.set({ key: SESSION_STORAGE_KEY, value: data });
    console.log("[Storage] ✅ Session kaydedildi:", session.user?.email?.slice(0, 10) + "...");
  } catch (e) {
    console.error("[Storage] ❌ Session kaydetme hatası:", e);
  }
};

/**
 * Session'ı Preferences'tan oku
 */
export const loadSessionFromStorage = async (): Promise<Session | null> => {
  console.log("[Storage] 🔍 Session yükleme başlıyor...");
  
  try {
    const { value } = await Preferences.get({ key: SESSION_STORAGE_KEY });
    console.log("[Storage] 🔍 Preferences.get sonucu:", value ? "VAR" : "YOK");
    
    if (!value) {
      // Eski key'leri kontrol et (migration)
      const oldKeys = ["kelimele-auth-token-v2", "kelimele-auth-token", "sb-nnlvtqmuwmrqfinsgvwc-auth-token"];
      
      for (const oldKey of oldKeys) {
        console.log("[Storage] 🔍 Eski key kontrol:", oldKey);
        const { value: oldValue } = await Preferences.get({ key: oldKey });
        if (oldValue) {
          console.log("[Storage] 🔄 Eski key'den migration:", oldKey);
          const parsed = JSON.parse(oldValue);
          
          // Yeni key'e kaydet
          await Preferences.set({ key: SESSION_STORAGE_KEY, value: oldValue });
          // Eski key'i sil
          await Preferences.remove({ key: oldKey });
          
          return {
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
            expires_at: parsed.expires_at,
            expires_in: parsed.expires_in || 3600,
            token_type: parsed.token_type || "bearer",
            user: parsed.user,
          } as Session;
        }
      }
      
      console.log("[Storage] ⚠️ Hiçbir key'de session yok!");
      return null;
    }
    
    const parsed = JSON.parse(value);
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
 * Storage'ı tamamen temizle
 */
export const clearSessionStorage = async (): Promise<void> => {
  const allKeys = [
    SESSION_STORAGE_KEY,
    "kelimele-auth-token-v2",
    "kelimele-auth-token",
    "sb-nnlvtqmuwmrqfinsgvwc-auth-token",
    "persistent_cached_session", // Eski ProtectedRoute cache'i
  ];
  
  for (const key of allKeys) {
    await Preferences.remove({ key });
  }
  
  console.log("[Storage] 🗑️ Tüm session storage temizlendi");
};

// ============================================================
// 🔥 SUPABASE CLIENT
// ============================================================

const createSupabaseClient = (): SupabaseClient<Database> => {
  console.log("[SupabaseClient] 🆕 Yeni Supabase client oluşturuluyor...");
  
  const isNativePlatform = Capacitor.isNativePlatform();
  
  // Native'de Realtime DEVRE DIŞI - Kotlin WebSocket kullanılacak
  const realtimeConfig = isNativePlatform ? {
    params: { eventsPerSecond: 0 },
    reconnectAfterMs: () => 999999999,
  } : {
    params: { eventsPerSecond: 10 },
    heartbeatIntervalMs: 15000,
    reconnectAfterMs: (tries: number) => Math.min(1000 * Math.pow(2, tries), 30000),
  };
  
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // 🔥🔥🔥 NATIVE'DE persistSession: FALSE
      // Session'ı biz Preferences ile yönetiyoruz
      persistSession: !isNativePlatform,
      autoRefreshToken: true,
      detectSessionInUrl: false,
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
          const response = await fetch(url, { ...optionsWithoutSignal, signal: controller.signal });
          return response;
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            throw new Error(`Request timeout after ${TIMEOUT_MS}ms`);
          }
          throw error;
        } finally {
          clearTimeout(timeoutId);
        }
      },
    },
  });

  if (isNativePlatform) {
    console.log("[SupabaseClient] 🚫 Native platform - persistSession: false, JS Realtime pasif");
  } else {
    // Web'de realtime kontrol
    if (typeof document !== "undefined") {
      setInterval(() => {
        try {
          const state = (client.realtime as any).connectionState?.();
          if (state !== "open" && state !== "connecting") {
            (client.realtime as any).connect?.();
          }
        } catch {}
      }, 10000);
    }
  }

  return client;
};

// Global client instance
let supabaseInstance: SupabaseClient<Database> = createSupabaseClient();

// Helper functions
export const recreateSupabaseClient = async (): Promise<SupabaseClient<Database>> => {
  console.log("🔄 [SupabaseClient] Soft reconnect...");
  
  try {
    const { data: { session } } = await supabaseInstance.auth.getSession();
    if (session?.access_token) {
      supabaseInstance.realtime.setAuth(session.access_token);
    }
  } catch {}
  
  return supabaseInstance;
};

export const hardReconnect = async (): Promise<SupabaseClient<Database>> => supabaseInstance;
export const getSupabaseClient = (): SupabaseClient<Database> => supabaseInstance;
export const startProactiveTokenRefresh = (): void => {};
export const stopProactiveTokenRefresh = (): void => {};

export const getRealtimeConnectionState = (): string => {
  try {
    return (supabaseInstance.realtime as any).connectionState?.() || "unknown";
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

// Ana export
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get: (_, prop) => (supabaseInstance as any)[prop],
});
