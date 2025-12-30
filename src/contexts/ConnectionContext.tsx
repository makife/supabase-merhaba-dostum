import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";

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
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Native platform kontrolü - component dışında
const isNativePlatform = Capacitor.isNativePlatform();

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const { session, loading: authLoading } = useAuth();

  const [state, setState] = useState<ConnectionState>({
    isConnected: true,
    isReconnecting: false,
    lastConnectedAt: new Date(),
    reconnectAttempts: 0,
  });

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const isHardResettingRef = useRef(false);
  const appListenerRef = useRef<{ remove: () => void } | null>(null);
  const isMountedRef = useRef(true);

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
      if (!isMountedRef.current || authLoading) return;
      
      try {
        const { error } = await supabase.rpc("get_server_time");
        if (error && isMountedRef.current) {
          console.log("[Connection] ❌ Heartbeat failed");
        }
      } catch (e) {
        console.log("[Connection] ❌ Heartbeat error");
      }
    }, 15000);
  }, [stopHeartbeat, authLoading]);

  // %100 garantili Hard Reset - Native için
  const hardResetConnection = useCallback(async (maxRetries = 5): Promise<boolean> => {
    if (isHardResettingRef.current) {
      console.log("[Connection] ⚠️ Hard reset zaten çalışıyor, atlanıyor...");
      return false;
    }

    isHardResettingRef.current = true;
    
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, isReconnecting: true, isConnected: false }));
    }

    console.log("🔄 [Connection] ===== HARD RESET BAŞLADI =====");

    let success = false;
    let attempt = 0;

    while (!success && attempt < maxRetries && isMountedRef.current) {
      attempt++;
      console.log(`🔄 [Connection] Deneme ${attempt}/${maxRetries}...`);

      try {
        // 1. HEARTBEAT DURDUR
        stopHeartbeat();

        // 2. TÜM KANALLARI KALDIR
        console.log("[Connection] 📺 Kanallar kaldırılıyor...");
        const channels = supabase.getChannels();
        for (const channel of channels) {
          try {
            await supabase.removeChannel(channel);
          } catch (e) {
            // Sessizce devam et
          }
        }

        // 3. REALTIME BAĞLANTISINI TAMAMEN KES
        console.log("[Connection] 🔌 Realtime bağlantısı kesiliyor...");
        try {
          (supabase.realtime as any).disconnect();
        } catch (e) {
          // Sessizce devam et
        }

        // 4. BEKLE - Bağlantının tamamen kapanması için
        const waitTime = Math.min(300 * attempt, 1500);
        console.log(`[Connection] ⏳ ${waitTime}ms bekleniyor...`);
        await new Promise(r => setTimeout(r, waitTime));

        // 5. AĞ KONTROLÜ (Native ise)
        if (isNativePlatform) {
          try {
            const { Network } = await import("@capacitor/network");
            const status = await Network.getStatus();
            console.log(`[Connection] 📡 Ağ durumu: ${status.connected ? "Bağlı" : "Bağlı Değil"}`);
            
            if (!status.connected) {
              console.log("[Connection] ❌ Ağ yok, 2 saniye sonra tekrar...");
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
          } catch (e) {
            console.log("[Connection] ⚠️ Ağ kontrolü atlandı");
          }
        }

        // 6. SESSION TAZELEMESİ
        console.log("[Connection] 🔑 Session tazeleniyor...");
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.log("[Connection] ⚠️ Session hatası:", sessionError.message);
          }
          
          if (sessionData?.session?.access_token) {
            // Token'ı realtime'a set et
            supabase.realtime.setAuth(sessionData.session.access_token);
            console.log("[Connection] ✅ Token güncellendi");
          } else {
            // Session yoksa refresh dene
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData?.session?.access_token) {
              supabase.realtime.setAuth(refreshData.session.access_token);
              console.log("[Connection] ✅ Token yenilendi");
            }
          }
        } catch (e) {
          console.log("[Connection] ⚠️ Token güncelleme hatası (devam ediliyor)");
        }

        // 7. REALTIME BAĞLAN
        console.log("[Connection] 🚀 Realtime bağlantısı başlatılıyor...");
        try {
          (supabase.realtime as any).connect();
        } catch (e) {
          console.log("[Connection] ⚠️ Connect hatası");
        }

        // 8. BAĞLANTI STABİLİZASYONU İÇİN BEKLE
        await new Promise(r => setTimeout(r, 800));

        // 9. BAĞLANTI TESTİ - 3 deneme
        console.log("[Connection] 🧪 Bağlantı test ediliyor...");
        let testSuccess = false;
        
        for (let testAttempt = 0; testAttempt < 3; testAttempt++) {
          try {
            const { data, error } = await supabase.rpc("get_server_time");
            if (!error && data) {
              testSuccess = true;
              console.log("[Connection] ✅ Bağlantı testi BAŞARILI!");
              break;
            }
          } catch (e) {
            // Devam et
          }
          await new Promise(r => setTimeout(r, 300));
        }

        if (!testSuccess) {
          console.log("[Connection] ❌ Bağlantı testi başarısız, tekrar deneniyor...");
          continue;
        }

        // 10. KAYITLI KANALLARI YENİDEN ABONE ET
        console.log(`[Connection] 📺 ${channelsRef.current.size} kanal yeniden abone ediliyor...`);
        for (const [name, channel] of channelsRef.current) {
          try {
            console.log(`[Connection] 🔄 Kanal: ${name}`);
            channel.subscribe((status) => {
              console.log(`[Connection] Kanal ${name} durumu: ${status}`);
            });
          } catch (e) {
            console.log(`[Connection] ⚠️ Kanal abone hatası: ${name}`);
          }
        }

        // BAŞARILI!
        success = true;
        console.log("🎉 [Connection] ===== HARD RESET BAŞARILI! =====");

      } catch (error) {
        console.error(`[Connection] ❌ Deneme ${attempt} başarısız:`, error);
        
        // Exponential backoff
        const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[Connection] ⏳ ${backoffTime}ms sonra tekrar denenecek...`);
        await new Promise(r => setTimeout(r, backoffTime));
      }
    }

    // Sonuç
    if (isMountedRef.current) {
      setState({
        isConnected: success,
        isReconnecting: false,
        lastConnectedAt: success ? new Date() : null,
        reconnectAttempts: success ? 0 : attempt,
      });
    }

    if (success) {
      startHeartbeat();
    }

    isHardResettingRef.current = false;

    if (!success) {
      console.log("❌ [Connection] ===== HARD RESET BAŞARISIZ! =====");
      // 10 saniye sonra tekrar dene
      if (isMountedRef.current) {
        setTimeout(() => {
          if (isMountedRef.current && !isHardResettingRef.current) {
            console.log("[Connection] 🔄 Otomatik yeniden deneme...");
            hardResetConnection(3);
          }
        }, 10000);
      }
    }

    return success;
  }, [stopHeartbeat, startHeartbeat]);

  // Normal reconnect
  const reconnect = useCallback(async (force = false): Promise<boolean> => {
    if (isNativePlatform || force) {
      return hardResetConnection();
    }
    
    // Web için basit reconnect
    try {
      (supabase.realtime as any).connect();
      return true;
    } catch (e) {
      return false;
    }
  }, [hardResetConnection]);

  // Native App State Listener
  useEffect(() => {
    if (!isNativePlatform) return;

    const setupNativeListener = async () => {
      try {
        const { App } = await import("@capacitor/app");

        // Eski listener'ı temizle
        if (appListenerRef.current) {
          appListenerRef.current.remove();
        }

        appListenerRef.current = await App.addListener("appStateChange", async ({ isActive }) => {
          console.log(`📱 [Connection] App State: ${isActive ? "FOREGROUND" : "BACKGROUND"}`);

          if (isActive) {
            // ÖN PLANA GELDİ - %100 HARD RESET
            console.log("📱 [Connection] Uygulama ön plana geldi - HARD RESET başlatılıyor...");
            
            // Küçük bir gecikme - UI'ın stabilize olması için
            await new Promise(r => setTimeout(r, 200));
            
            // Hard reset başlat
            hardResetConnection(5);
            
          } else {
            // ARKA PLANA GİTTİ - TEMİZLİK YAP
            console.log("📱 [Connection] Uygulama arka plana gitti - Temizlik yapılıyor...");
            
            stopHeartbeat();
            
            // Bağlantıyı kes
            try {
              (supabase.realtime as any).disconnect();
            } catch (e) {
              // Sessizce devam et
            }
            
            if (isMountedRef.current) {
              setState(prev => ({ ...prev, isConnected: false }));
            }
          }
        });

        console.log("[Connection] ✅ Native app state listener kuruldu");
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
  }, [hardResetConnection, stopHeartbeat]);

  // Web Visibility Listener
  useEffect(() => {
    if (isNativePlatform) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        console.log("[Connection] 🌐 Tab görünür oldu");
        await hardResetConnection(3);
      } else {
        console.log("[Connection] 🌐 Tab gizlendi");
        stopHeartbeat();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hardResetConnection, stopHeartbeat]);

  // Auth hazır olduğunda bağlan
  useEffect(() => {
    if (!authLoading && session) {
      console.log("[Connection] ✅ Auth hazır - Bağlantı başlatılıyor...");
      setTimeout(() => {
        if (isMountedRef.current) {
          hardResetConnection(3);
        }
      }, 100);
    }
  }, [authLoading, session, hardResetConnection]);

  // Mount/Unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopHeartbeat();
    };
  }, [stopHeartbeat]);

  // Channel kayıt metodları
  const registerChannel = useCallback((name: string, channel: RealtimeChannel) => {
    channelsRef.current.set(name, channel);
  }, []);

  const unregisterChannel = useCallback((name: string) => {
    channelsRef.current.delete(name);
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
