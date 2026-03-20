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

// 🔥🔥🔥 KRİTİK: GLOBAL ACCESS TOKEN - Native'de her istek için kullanılacak!
let globalAccessToken: string | null = null;

/**
 * 🔥 Native'de her istek için token'ı set et
 * Bu fonksiyon AuthContext ve useSessionRecovery tarafından çağrılmalı
 */
export const setGlobalAccessToken = (token: string | null) => {
  globalAccessToken = token;
  console.log("[SupabaseClient] 🔐 Global access token", token ? "SET EDİLDİ" : "TEMİZLENDİ");
};

/**
 * Global token'ı al
 */
export const getGlobalAccessToken = (): string | null => globalAccessToken;

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
    setGlobalAccessToken(null); // 🔥 Token'ı da temizle
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
    
    // 🔥🔥🔥 KRİTİK: Token'ı global'e de kaydet!
    setGlobalAccessToken(session.access_token);
    
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
          
          // 🔥 Token'ı global'e set et!
          setGlobalAccessToken(parsed.access_token);
          
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
    
    // 🔥🔥🔥 KRİTİK: Token'ı global'e set et!
    setGlobalAccessToken(parsed.access_token);
    
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
  
  // 🔥 Global token'ı da temizle!
  setGlobalAccessToken(null);
  
  console.log("[Storage] 🗑️ Tüm session storage temizlendi");
};

// ============================================================
// 🔥 SUPABASE CLIENT
// ============================================================

const createSupabaseClient = (): SupabaseClient<Database> => {
  console.log("[SupabaseClient] 🆕 Yeni Supabase client oluşturuluyor...");
  
  const isNativePlatform = Capacitor.isNativePlatform();
  
  // 🔥🔥🔥 FIX: Native'de de Realtime AÇIK olmalı!
  // Kotlin WebSocket deprecate edildi, JS SDK Realtime kullanılacak
  const realtimeConfig = {
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
        
        // 🔥🔥🔥 KRİTİK FIX: Native'de TÜM header'ları doğru şekilde yönet
        // Supabase client farklı formatlarda header gönderebilir
        
        const originalHeaders = optionsWithoutSignal.headers;
        const method = optionsWithoutSignal.method?.toUpperCase() || 'GET';
        const hasBody = !!optionsWithoutSignal.body;
        
        // 🔥 Native için TAMAMEN yeni Headers objesi oluştur
        const finalHeaders = new Headers();
        
        // 1. Önce orijinal header'ları kopyala
        if (originalHeaders) {
          if (originalHeaders instanceof Headers) {
            originalHeaders.forEach((value, key) => {
              finalHeaders.set(key, value);
            });
          } else if (Array.isArray(originalHeaders)) {
            originalHeaders.forEach(([key, value]) => {
              finalHeaders.set(key, value);
            });
          } else if (typeof originalHeaders === 'object') {
            Object.entries(originalHeaders).forEach(([key, value]) => {
              if (value) finalHeaders.set(key, value as string);
            });
          }
        }
        
        if (isNativePlatform) {
          // 2. APIKEY - Yoksa ekle
          if (!finalHeaders.has('apikey')) {
            finalHeaders.set('apikey', SUPABASE_PUBLISHABLE_KEY);
          }

          // 3. AUTHORIZATION - Native'de anon bearer header'ını user token ile override et
          // Supabase SDK session'ı henüz hydrate etmeden önce Authorization: Bearer <anon-key>
          // gönderebiliyor; bu da RLS'li sorguların anonim gitmesine ve 0 veri / erişim hatasına yol açıyor.
          const currentAuthorization = finalHeaders.get('Authorization');
          const anonAuthorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
          const shouldOverrideAuthorization = !currentAuthorization || currentAuthorization === anonAuthorization;

          if (globalAccessToken && shouldOverrideAuthorization) {
            finalHeaders.set('Authorization', `Bearer ${globalAccessToken}`);
          }
          
          // 4. Content-Type - POST/PATCH/PUT için ZORUNLU application/json
          if (hasBody && ['POST', 'PATCH', 'PUT'].includes(method)) {
            // HER ZAMAN application/json olarak set et (override)
            finalHeaders.set('Content-Type', 'application/json');
          }
          
          // 5. Accept header - response için
          if (!finalHeaders.has('Accept')) {
            finalHeaders.set('Accept', 'application/json');
          }
          
          // Debug log
          const ct = finalHeaders.get('Content-Type');
          const resolvedAuthorization = finalHeaders.get('Authorization');
          const authMode = resolvedAuthorization === `Bearer ${globalAccessToken}` && globalAccessToken
            ? 'user'
            : resolvedAuthorization === anonAuthorization
              ? 'anon'
              : resolvedAuthorization
                ? 'custom'
                : 'none';
          console.log(`[Supabase] 🔐 ${method} | apikey=✓ | auth=${authMode} | ct=${ct || 'none'}`);
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn(`[Supabase] ⏱️ Fetch timeout (${TIMEOUT_MS}ms): ${url}`);
          controller.abort();
        }, TIMEOUT_MS);
        
        try {
          const response = await fetch(url, { 
            ...optionsWithoutSignal, 
            headers: finalHeaders,
            signal: controller.signal 
          });
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

  // 🔥 Tüm platformlarda realtime kontrol
  if (typeof document !== "undefined") {
    console.log("[SupabaseClient] ✅ Realtime aktif - heartbeat başlatılıyor...");
    setInterval(() => {
      try {
        const state = (client.realtime as any).connectionState?.();
        if (state !== "open" && state !== "connecting") {
          console.log("[SupabaseClient] 🔄 Realtime reconnect tetikleniyor...");
          (client.realtime as any).connect?.();
        }
      } catch {}
    }, 10000);
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
      // 🔥 Global token'ı da güncelle!
      setGlobalAccessToken(session.access_token);
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
