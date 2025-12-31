import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
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

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<ConnectionState>({
    isConnected: true,
    isReconnecting: false,
    lastConnectedAt: new Date(),
    reconnectAttempts: 0,
  });

  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
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
        const { error } = await supabase.rpc("get_server_time");
        if (error && isMountedRef.current) {
          console.log("[Connection] ❌ Heartbeat failed, triggering reconnect...");
          forceReconnect();
        }
      } catch (e) {
        console.log("[Connection] ❌ Heartbeat error, triggering reconnect...");
        forceReconnect();
      }
    }, 20000);
  }, [stopHeartbeat]);

  // TAMAMEN SIFIRDAN BAĞLANTI KURMA
  const forceReconnect = useCallback(async (): Promise<boolean> => {
    // Debounce: Son 2 saniye içinde reconnect olduysa atla
    const now = Date.now();
    if (now - lastForegroundTimeRef.current < 2000) {
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

    console.log("🔄 [Connection] ========== FORCE RECONNECT BAŞLADI ==========");
    stopHeartbeat();

    let success = false;
    const maxAttempts = 7;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (!isMountedRef.current) break;

      console.log(`🔄 [Connection] Deneme ${attempt}/${maxAttempts}`);

      try {
        // ADIM 1: Tüm mevcut kanalları kaldır
        console.log("[Connection] 1️⃣ Mevcut kanallar kaldırılıyor...");
        try {
          const existingChannels = supabase.getChannels();
          for (const ch of existingChannels) {
            try {
              await supabase.removeChannel(ch);
            } catch (e) {
              // Sessizce devam
            }
          }
        } catch (e) {
          // Sessizce devam
        }

        // ADIM 2: Realtime bağlantısını kes
        console.log("[Connection] 2️⃣ Realtime bağlantısı kesiliyor...");
        try {
          (supabase.realtime as any).disconnect();
        } catch (e) {
          // Sessizce devam
        }

        // ADIM 3: Kısa bekleme (bağlantının kapanması için)
        const waitTime = Math.min(200 + (attempt * 100), 800);
        console.log(`[Connection] 3️⃣ ${waitTime}ms bekleniyor...`);
        await new Promise(r => setTimeout(r, waitTime));

        // ADIM 4: Ağ kontrolü (Native platformlarda)
        if (isNativePlatform) {
          try {
            const { Network } = await import("@capacitor/network");
            const status = await Network.getStatus();
            console.log(`[Connection] 4️⃣ Ağ durumu: ${status.connected ? "BAĞLI ✅" : "BAĞLI DEĞİL ❌"}`);
            
            if (!status.connected) {
              console.log("[Connection] ⚠️ Ağ bağlantısı yok, 1.5 saniye sonra tekrar deneniyor...");
              await new Promise(r => setTimeout(r, 1500));
              continue;
            }
          } catch (e) {
            console.log("[Connection] ⚠️ Ağ kontrolü yapılamadı, devam ediliyor...");
          }
        }

        // ADIM 5: Session'ı tazele
        console.log("[Connection] 5️⃣ Session tazeleniyor...");
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session?.access_token) {
            supabase.realtime.setAuth(sessionData.session.access_token);
            console.log("[Connection] ✅ Token ayarlandı");
          } else {
            // Session yoksa refresh dene
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData?.session?.access_token) {
              supabase.realtime.setAuth(refreshData.session.access_token);
              console.log("[Connection] ✅ Token yenilendi");
            }
          }
        } catch (e) {
          console.log("[Connection] ⚠️ Token güncelleme hatası, devam ediliyor...");
        }

        // ADIM 6: Realtime'ı yeniden bağla
        console.log("[Connection] 6️⃣ Realtime bağlantısı başlatılıyor...");
        try {
          (supabase.realtime as any).connect();
        } catch (e) {
          console.log("[Connection] ⚠️ Connect hatası, devam ediliyor...");
        }

        // ADIM 7: Bağlantının stabil olması için bekle
        await new Promise(r => setTimeout(r, 600));

        // ADIM 8: Bağlantı testi (3 deneme)
        console.log("[Connection] 7️⃣ Bağlantı test ediliyor...");
        let testSuccess = false;

        for (let testAttempt = 1; testAttempt <= 3; testAttempt++) {
          try {
            const { data, error } = await supabase.rpc("get_server_time");
            if (!error && data) {
              testSuccess = true;
              console.log(`[Connection] ✅ Bağlantı testi BAŞARILI! (deneme ${testAttempt})`);
              break;
            }
          } catch (e) {
            // Sessizce devam
          }
          await new Promise(r => setTimeout(r, 250));
        }

        if (!testSuccess) {
          console.log("[Connection] ❌ Bağlantı testi başarısız, tekrar deneniyor...");
          continue;
        }

        // ADIM 9: Kayıtlı kanalları yeniden abone et
        if (channelsRef.current.size > 0) {
          console.log(`[Connection] 8️⃣ ${channelsRef.current.size} kanal yeniden abone ediliyor...`);
          for (const [name, channel] of channelsRef.current) {
            try {
              channel.subscribe((status) => {
                console.log(`[Connection] Kanal "${name}" durumu: ${status}`);
              });
            } catch (e) {
              console.log(`[Connection] ⚠️ Kanal "${name}" abone hatası`);
            }
          }
        }

        // BAŞARILI!
        success = true;
        console.log("🎉 [Connection] ========== FORCE RECONNECT BAŞARILI! ==========");
        break;

      } catch (error) {
        console.error(`[Connection] ❌ Deneme ${attempt} başarısız:`, error);
        
        // Exponential backoff
        const backoffTime = Math.min(500 * Math.pow(1.5, attempt), 4000);
        console.log(`[Connection] ⏳ ${backoffTime}ms sonra tekrar deneniyor...`);
        await new Promise(r => setTimeout(r, backoffTime));
      }
    }

    // Sonuç
    if (isMountedRef.current) {
      setState({
        isConnected: success,
        isReconnecting: false,
        lastConnectedAt: success ? new Date() : null,
        reconnectAttempts: success ? 0 : maxAttempts,
      });
    }

    if (success) {
      startHeartbeat();
    } else {
      console.log("❌ [Connection] ========== FORCE RECONNECT BAŞARISIZ ==========");
      
      // 8 saniye sonra otomatik tekrar dene
      if (isMountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            console.log("[Connection] 🔄 Otomatik yeniden deneme başlatılıyor...");
            isReconnectingRef.current = false;
            forceReconnect();
          }
        }, 8000);
      }
    }

    isReconnectingRef.current = false;
    return success;
  }, [stopHeartbeat, startHeartbeat]);

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
            console.log("📱 [Connection] Uygulama ön plana geldi - Bağlantı yeniden kuruluyor...");
            
            // UI'ın stabilize olması için kısa gecikme
            await new Promise(r => setTimeout(r, 150));
            
            // Force reconnect başlat
            if (isMountedRef.current) {
              forceReconnect();
            }
          } else {
            // ARKA PLANA GİTTİ
            console.log("📱 [Connection] Uygulama arka plana gitti - Temizlik yapılıyor...");
            
            stopHeartbeat();
            
            // Bağlantıyı kes (enerji tasarrufu için)
            try {
              (supabase.realtime as any).disconnect();
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
        console.log("[Connection] 🌐 Tab görünür oldu - Bağlantı kontrol ediliyor...");
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
      await new Promise(r => setTimeout(r, 500));
      
      if (isMountedRef.current) {
        console.log("[Connection] 🚀 İlk bağlantı başlatılıyor...");
        forceReconnect();
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

  // Channel kayıt metodları
  const registerChannel = useCallback((name: string, channel: RealtimeChannel) => {
    channelsRef.current.set(name, channel);
    console.log(`[Connection] 📺 Kanal kaydedildi: ${name}`);
  }, []);

  const unregisterChannel = useCallback((name: string) => {
    channelsRef.current.delete(name);
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
