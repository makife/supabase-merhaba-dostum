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
  
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
      // Daha sık heartbeat - arka planda bağlantıyı canlı tutmak için
      heartbeatIntervalMs: 3000,
      // Reconnect ayarları
      reconnectAfterMs: (tries: number) => {
        // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
        return Math.min(1000 * Math.pow(2, tries), 10000);
      },
    },
  });
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

// Client'ı yeniden oluşturmadan sadece realtime bağlantısını yenile
// Bu şekilde tüm referanslar geçerli kalır!
export const recreateSupabaseClient = async (): Promise<SupabaseClient<Database>> => {
  console.log("🔄 [SupabaseClient] ========== REALTIME RECONNECT ==========");
  
  try {
    // 1. MEVCUT KANALLARI TEMİZLE
    console.log("[SupabaseClient] 1️⃣ Kanallar temizleniyor...");
    try {
      const channels = supabaseInstance.getChannels();
      console.log(`[SupabaseClient] ${channels.length} kanal bulundu`);
      for (const ch of channels) {
        try { 
          await supabaseInstance.removeChannel(ch); 
        } catch {}
      }
    } catch (e) {
      console.log("[SupabaseClient] ⚠️ Kanal temizleme hatası:", e);
    }
    
    // 2. REALTIME BAĞLANTISINI KAPAT
    console.log("[SupabaseClient] 2️⃣ Realtime bağlantısı kapatılıyor...");
    try { 
      (supabaseInstance.realtime as any).disconnect?.(); 
    } catch {}
    
    // Kısa bekle
    await new Promise(r => setTimeout(r, 200));
    
    // 3. SESSION TOKEN GÜNCELLE
    console.log("[SupabaseClient] 3️⃣ Session kontrol (2s timeout)...");
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
    
    // 4. REALTIME BAĞLANTISINI YENİDEN AÇ
    console.log("[SupabaseClient] 4️⃣ Realtime yeniden başlatılıyor...");
    try { 
      (supabaseInstance.realtime as any).connect?.(); 
    } catch {}
    
    console.log("🎉 [SupabaseClient] ========== RECONNECT TAMAM ==========");
    
  } catch (error) {
    console.error("[SupabaseClient] ❌ Reconnect hatası:", error);
  }
  
  return supabaseInstance;
};

// Client getter (her zaman güncel instance'ı döndürür)
export const getSupabaseClient = (): SupabaseClient<Database> => {
  return supabaseInstance;
};

// Geriye dönük uyumluluk için - ana export
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get: (_, prop) => {
    return (supabaseInstance as any)[prop];
  },
});
