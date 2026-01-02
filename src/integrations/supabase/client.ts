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

// Client'ı yeniden oluştur - SÜPER BASİT VE GÜVENİLİR
export const recreateSupabaseClient = async (): Promise<SupabaseClient<Database>> => {
  console.log("🔄 [SupabaseClient] ========== CLIENT RECREATE BAŞLADI ==========");
  
  try {
    // 1. ESKİ KANALLARI TEMİZLE
    try {
      const channels = supabaseInstance.getChannels();
      console.log(`[SupabaseClient] 🧹 ${channels.length} kanal temizleniyor...`);
      
      for (const ch of channels) {
        try {
          supabaseInstance.removeChannel(ch);
        } catch (e) {
          // Sessizce devam et
        }
      }
      
      // Realtime bağlantısını kes
      try {
        (supabaseInstance.realtime as any).disconnect?.();
      } catch (e) {}
      
    } catch (e) {
      console.log("[SupabaseClient] ⚠️ Kanal temizleme hatası:", e);
    }
    
    // 2. YENİ CLIENT OLUŞTUR
    console.log("[SupabaseClient] 🆕 Yeni client oluşturuluyor...");
    supabaseInstance = createSupabaseClient();
    console.log("[SupabaseClient] ✅ Yeni client oluşturuldu");
    
    // 3. SESSION'I AL VE REALTIME'A AYARLA
    console.log("[SupabaseClient] 🔐 Session kontrol ediliyor...");
    try {
      const { data: sessionData } = await supabaseInstance.auth.getSession();
      
      if (sessionData?.session?.access_token) {
        supabaseInstance.realtime.setAuth(sessionData.session.access_token);
        console.log("[SupabaseClient] ✅ Mevcut token ayarlandı");
      } else {
        // Session yoksa refresh dene
        console.log("[SupabaseClient] 🔄 Session yok, refresh deneniyor...");
        const { data: refreshData } = await supabaseInstance.auth.refreshSession();
        
        if (refreshData?.session?.access_token) {
          supabaseInstance.realtime.setAuth(refreshData.session.access_token);
          console.log("[SupabaseClient] ✅ Token yenilendi ve ayarlandı");
        } else {
          console.log("[SupabaseClient] ⚠️ Session alınamadı - anonim mod");
        }
      }
    } catch (e) {
      console.log("[SupabaseClient] ⚠️ Session hatası:", e);
    }
    
    // 4. REALTIME BAĞLANTISINI BAŞLAT
    console.log("[SupabaseClient] 🔌 Realtime bağlantısı başlatılıyor...");
    try {
      (supabaseInstance.realtime as any).connect?.();
    } catch (e) {
      console.log("[SupabaseClient] ⚠️ Realtime connect hatası:", e);
    }
    
    console.log("🎉 [SupabaseClient] ========== CLIENT HAZIR ==========");
    
  } catch (error) {
    console.error("[SupabaseClient] ❌ Recreate hatası:", error);
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
