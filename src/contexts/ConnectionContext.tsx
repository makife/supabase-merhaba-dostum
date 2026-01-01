import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase, recreateSupabaseClient, getSupabaseClient } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { RealtimeChannel } from "@supabase/supabase-js";

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
}

interface ConnectionContextType {
  state: ConnectionState;
  reconnect: (force?: boolean) => Promise<boolean>;
  registerChannel: (name: string, channel: RealtimeChannel) => void;
  unregisterChannel: (name: string) => void;
  isHealthy: boolean;
  forceReconnect: () => Promise<boolean>;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Native platform kontrolü - component dışında
const isNativePlatform = Capacitor.isNativePlatform();

// Kanal oluşturucu fonksiyonları saklamak için
type ChannelCreator = () => RealtimeChannel;

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ConnectionState>({
    isConnected: true,
    isReconnecting: false,
    lastConnectedAt: new Date(),
    reconnectAttempts: 0,
  });

  // Eski kanalları değil, kanal oluşturucu fonksiyonlarını saklıyoruz
  const channelCreatorsRef = useRef<Map<string, ChannelCreator>>(new Map());
  const isReconnectingRef = useRef(false);
  const appListenerRef = useRef<{ remove: () => void } | null>(null);
  const isMountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const lastForegroundTimeRef = useRef<number>(0);

  // Heartbeat durdur
  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  // Heartbeat başlat
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      if (!isMountedRef.current) return;
      
      try {
        const { error } = await getSupabaseClient().rpc("get_server_time");
        if (error && isMountedRef.current) {
          console.log("[Connection] ❌ Heartbeat failed, triggering reconnect...");
          forceReconnect();
        }
      } catch (e) {
        console.log("[Connection] ❌ Heartbeat error, triggering reconnect...");
        forceReconnect();
      }
    }, 25000);
  }, [stopHeartbeat]);

  // SUPAbase CLIENT'I TAMAMEN YENİDEN OLUŞTUR
  const forceReconnect = useCallback(async (): Promise<boolean> => {
    // Debounce: Son 3 saniye içinde reconnect olduysa atla
    const now = Date.now();
    if (now - lastForegroundTimeRef.current < 3000) {
      console.log("[Connection] ⏳ Debounce - son reconnect çok yakın, atlanıyor...");
      return false;
    }
    lastForegroundTimeRef.current = now;

    if (isReconnectingRef.current) {
      console.log("[Connection] ⚠️ Reconnect zaten çalışıyor, atlanıyor...");
      return false;
    }

    isReconnectingRef.current = true;

    // Pending timeout'ları temizle
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (isMountedRef.current) {
      setState(prev => ({ ...prev, isReconnecting: true, isConnected: false }));
    }

    console.log("🔄 [Connection] ========== CLIENT YENİDEN OLUŞTURULUYOR ==========");
    stopHeartbeat();

    let success = false;

    try {
      // 1. Ağ kontrolü (Native platformlarda)
      if (isNativePlatform) {
        try {
          const { Network } = await import("@capacitor/network");
          const status = await Network.getStatus();
          console.log(`[Connection] 📶 Ağ durumu: ${status.connected ? "BAĞLI ✅" : "BAĞLI DEĞİL ❌"}`);
          
          if (!status.connected) {
            console.log("[Connection] ⚠️ Ağ bağlantısı yok, 2 saniye sonra tekrar deneniyor...");
            await new Promise(r => setTimeout(r, 2000));
            
            // Tekrar kontrol et
            const status2 = await Network.getStatus();
            if (!status2.connected) {
              console.log("[Connection] ❌ Hala ağ yok, reconnect iptal...");
              isReconnectingRef.current = false;
              if (isMountedRef.current) {
                setState(prev => ({ ...prev, isReconnecting: false }));
              }
              
              // 5 saniye sonra tekrar dene
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                  isReconnectingRef.current = false;
                  forceReconnect();
                }
              }, 5000);
              
              return false;
            }
          }
        } catch (e) {
          console.log("[Connection] ⚠️ Ağ kontrolü yapılamadı, devam ediliyor...");
        }
      }

      // 2. SUPAbase CLIENT'I TAMAMEN YENİDEN OLUŞTUR
      console.log("[Connection] 🆕 Supabase client tamamen yeniden oluşturuluyor...");
      await recreateSupabaseClient();

      // 3. Kısa bekleme
      await new Promise(r => setTimeout(r, 500));

      // 4. Bağlantı testi
      console.log("[Connection] 🧪 Bağlantı test ediliyor...");
      let testSuccess = false;
      
      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          const { data, error } = await getSupabaseClient().rpc("get_server_time");
          if (!error && data) {
            testSuccess = true;
            console.log(`[Connection] ✅ Bağlantı testi BAŞARILI! (deneme ${attempt})`);
            break;
          } else {
            console.log(`[Connection] ⚠️ Bağlantı testi hatası (deneme ${attempt}):`, error?.message);
          }
        } catch (e) {
          console.log(`[Connection] ⚠️ Bağlantı testi exception (deneme ${attempt}):`, e);
        }
        await new Promise(r => setTimeout(r, 400));
      }

      if (testSuccess) {
        success = true;
        console.log("🎉 [Connection] ========== RECONNECT BAŞARILI! ==========");
        
        // Window event yayınla - diğer component'lar dinleyebilir
        window.dispatchEvent(new CustomEvent("supabase-reconnected"));
      } else {
        console.log("❌ [Connection] Bağlantı testi başarısız");
      }

    } catch (error) {
      console.error("[Connection] ❌ Reconnect hatası:", error);
    }

    // Sonuç
    if (isMountedRef.current) {
      setState({
        isConnected: success,
        isReconnecting: false,
        lastConnectedAt: success ? new Date() : null,
        reconnectAttempts: success ? 0 : state.reconnectAttempts + 1,
      });
    }

    if (success) {
      startHeartbeat();
    } else {
      console.log("❌ [Connection] Reconnect başarısız, 6 saniye sonra tekrar deneniyor...");
      
      if (isMountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("[Connection] 🔄 Otomatik yeniden deneme başlatılıyor...");
            isReconnectingRef.current = false;
            forceReconnect();
          }
        }, 6000);
      }
    }

    isReconnectingRef.current = false;
    return success;
  }, [stopHeartbeat, startHeartbeat, state.reconnectAttempts]);

  // Normal reconnect (forceReconnect'e yönlendir)
  const reconnect = useCallback(async (force = false): Promise<boolean> => {
    return forceReconnect();
  }, [forceReconnect]);

  // NATIVE APP STATE LISTENER - TEK MERKEZ
  useEffect(() => {
    if (!isNativePlatform) return;

    const setupNativeListener = async () => {
      try {
        const { App } = await import("@capacitor/app");

        // Eski listener'ı temizle
        if (appListenerRef.current) {
          appListenerRef.current.remove();
          appListenerRef.current = null;
        }

        appListenerRef.current = await App.addListener("appStateChange", async ({ isActive }) => {
          console.log(`📱 [Connection] ============ APP STATE: ${isActive ? "FOREGROUND ▶️" : "BACKGROUND ⏸️"} ============`);

          if (isActive) {
            // ÖN PLANA GELDİ
            console.log("📱 [Connection] Uygulama ön plana geldi - CLIENT YENİDEN OLUŞTURULUYOR...");
            
            // UI'ın stabilize olması için kısa gecikme
            await new Promise(r => setTimeout(r, 200));
            
            // Force reconnect başlat - CLIENT YENİDEN OLUŞTURULACAK
            if (isMountedRef.current) {
              forceReconnect();
            }
          } else {
            // ARKA PLANA GİTTİ
            console.log("📱 [Connection] Uygulama arka plana gitti - Temizlik yapılıyor...");
            
            stopHeartbeat();
            
            // Bağlantıyı kes (enerji tasarrufu için)
            try {
              const client = getSupabaseClient();
              const channels = client.getChannels();
              for (const ch of channels) {
                try {
                  await client.removeChannel(ch);
                } catch (e) {
                  // Sessizce devam
                }
              }
              (client.realtime as any).disconnect();
            } catch (e) {
              // Sessizce devam
            }
            
            if (isMountedRef.current) {
              setState(prev => ({ ...prev, isConnected: false }));
            }
          }
        });

        console.log("[Connection] ✅ Native app state listener aktif");
      } catch (error) {
        console.error("[Connection] ❌ Native listener kurulamadı:", error);
      }
    };

    setupNativeListener();

    return () => {
      if (appListenerRef.current) {
        appListenerRef.current.remove();
        appListenerRef.current = null;
      }
    };
  }, [forceReconnect, stopHeartbeat]);

  // WEB VISIBILITY LISTENER
  useEffect(() => {
    if (isNativePlatform) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        console.log("[Connection] 🌐 Tab görünür oldu - CLIENT YENİDEN OLUŞTURULUYOR...");
        await forceReconnect();
      } else {
        console.log("[Connection] 🌐 Tab gizlendi");
        stopHeartbeat();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [forceReconnect, stopHeartbeat]);

  // İLK BAĞLANTI - Component mount olduğunda
  useEffect(() => {
    const initConnection = async () => {
      // Kısa gecikme (auth hazır olması için)
      await new Promise(r => setTimeout(r, 800));
      
      if (isMountedRef.current) {
        console.log("[Connection] 🚀 İlk bağlantı başlatılıyor...");
        
        // Sadece bağlantı testi yap, client zaten oluşturulmuş
        try {
          const { data, error } = await getSupabaseClient().rpc("get_server_time");
          if (!error && data) {
            console.log("[Connection] ✅ İlk bağlantı başarılı");
            setState(prev => ({ ...prev, isConnected: true }));
            startHeartbeat();
          } else {
            console.log("[Connection] ⚠️ İlk bağlantı hatası, reconnect başlatılıyor...");
            forceReconnect();
          }
        } catch (e) {
          console.log("[Connection] ⚠️ İlk bağlantı exception, reconnect başlatılıyor...");
          forceReconnect();
        }
      }
    };

    initConnection();

    return () => {
      isMountedRef.current = false;
      stopHeartbeat();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Channel kayıt metodları (artık sadece uyumluluk için - çoğu component kendi kanallarını yönetiyor)
  const registerChannel = useCallback((name: string, channel: RealtimeChannel) => {
    console.log(`[Connection] 📺 Kanal kaydedildi: ${name}`);
  }, []);

  const unregisterChannel = useCallback((name: string) => {
    console.log(`[Connection] 🗑️ Kanal silindi: ${name}`);
  }, []);

  const isHealthy = state.isConnected && !state.isReconnecting;

  return (
    <ConnectionContext.Provider
      value={{
        state,
        reconnect,
        registerChannel,
        unregisterChannel,
        isHealthy,
        forceReconnect,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) throw new Error("useConnection must be used within ConnectionProvider");
  return context;
};

export const useConnectionStatus = () => {
  const { state, isHealthy } = useConnection();
  return {
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    isHealthy,
  };
};
