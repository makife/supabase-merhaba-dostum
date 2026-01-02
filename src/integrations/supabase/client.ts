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
      heartbeatIntervalMs: 5000,
    },
  });
};

// Global client instance
let supabaseInstance: SupabaseClient<Database> = createSupabaseClient();

// Client'ı yeniden oluştur (arka plandan gelirken kullanılacak)
export const recreateSupabaseClient = async (): Promise<SupabaseClient<Database>> => {
  console.log("🔄 [SupabaseClient] ========== CLIENT TAMAMEN YENİDEN OLUŞTURULUYOR ==========");
  
  try {
    // 1. Mevcut client'ın realtime bağlantılarını kes
    console.log("[SupabaseClient] 1️⃣ Eski bağlantılar kesiliyor...");
    try {
      const channels = supabaseInstance.getChannels();
      for (const ch of channels) {
        try {
          await supabaseInstance.removeChannel(ch);
        } catch (e) {
          // Sessizce devam
        }
      }
    } catch (e) {
      console.log("[SupabaseClient] ⚠️ Kanal temizleme hatası (önemsiz):", e);
    }
    
    try {
      (supabaseInstance.realtime as any).disconnect();
    } catch (e) {
      console.log("[SupabaseClient] ⚠️ Disconnect hatası (önemsiz):", e);
    }
    
    // 2. Kısa bekleme (eski bağlantıların tamamen kapanması için)
    await new Promise(r => setTimeout(r, 300));
    
    // 3. Yeni client oluştur
    console.log("[SupabaseClient] 2️⃣ Yeni client oluşturuluyor...");
    supabaseInstance = createSupabaseClient();
    
    // 4. Mevcut session'ı al ve yeni client'a uygula
    console.log("[SupabaseClient] 3️⃣ Session kontrol ediliyor...");
    let sessionRestored = false;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data: sessionData, error: sessionError } = await supabaseInstance.auth.getSession();
        
        if (sessionError) {
          console.log(`[SupabaseClient] ⚠️ Session alma hatası (deneme ${attempt}):`, sessionError.message);
          await new Promise(r => setTimeout(r, 300));
          continue;
        }
        
        if (sessionData?.session?.access_token) {
          supabaseInstance.realtime.setAuth(sessionData.session.access_token);
          console.log("[SupabaseClient] ✅ Token yeni client'a ayarlandı");
          sessionRestored = true;
          break;
        } else {
          // Session yoksa refresh dene
          console.log(`[SupabaseClient] ⚠️ Session yok (deneme ${attempt}), refresh deneniyor...`);
          const { data: refreshData, error: refreshError } = await supabaseInstance.auth.refreshSession();
          if (!refreshError && refreshData?.session?.access_token) {
            supabaseInstance.realtime.setAuth(refreshData.session.access_token);
            console.log("[SupabaseClient] ✅ Token yenilendi");
            sessionRestored = true;
            break;
          } else if (refreshError) {
            console.log(`[SupabaseClient] ⚠️ Session refresh hatası:`, refreshError.message);
          }
        }
      } catch (e) {
        console.log(`[SupabaseClient] ⚠️ Session işleme hatası (deneme ${attempt}):`, e);
      }
      await new Promise(r => setTimeout(r, 400));
    }
    
    if (!sessionRestored) {
      console.log("[SupabaseClient] ⚠️ Session restore edilemedi - kullanıcı giriş yapmamış olabilir");
    }
    
    // 5. Realtime bağlantısını başlat
    console.log("[SupabaseClient] 4️⃣ Realtime bağlantısı başlatılıyor...");
    try {
      (supabaseInstance.realtime as any).connect();
    } catch (e) {
      console.log("[SupabaseClient] ⚠️ Connect hatası (önemsiz):", e);
    }
    
    // 6. Bağlantı testi - daha fazla deneme
    console.log("[SupabaseClient] 5️⃣ Bağlantı test ediliyor...");
    await new Promise(r => setTimeout(r, 400));
    
    let testSuccess = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const { data, error } = await supabaseInstance.rpc("get_server_time");
        if (!error && data) {
          testSuccess = true;
          console.log(`[SupabaseClient] ✅ Bağlantı testi BAŞARILI! (deneme ${attempt})`);
          break;
        } else {
          console.log(`[SupabaseClient] ⚠️ Bağlantı testi hatası (deneme ${attempt}):`, error?.message);
        }
      } catch (e) {
        console.log(`[SupabaseClient] ⚠️ Bağlantı testi exception (deneme ${attempt}):`, e);
      }
      await new Promise(r => setTimeout(r, 300 * attempt));
    }
    
    if (!testSuccess) {
      console.log("[SupabaseClient] ⚠️ Bağlantı testi başarısız ama devam ediliyor...");
    }
    
    console.log("🎉 [SupabaseClient] ========== CLIENT YENİDEN OLUŞTURULDU ==========");
    
  } catch (error) {
    console.error("[SupabaseClient] ❌ Client yeniden oluşturma hatası:", error);
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
