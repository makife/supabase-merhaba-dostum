import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/contexts/AuthContext";

interface ConnectionState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastConnectedAt: Date | null;
  reconnectAttempts: number;
  channelHealth: Map<string, "healthy" | "unhealthy" | "reconnecting">;
}

interface ConnectionContextType {
  state: ConnectionState;
  reconnect: (force?: boolean) => Promise<boolean>;
  registerChannel: (name: string, channel: RealtimeChannel) => void;
  unregisterChannel: (name: string) => void;
  isHealthy: boolean;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useAuth();

  const [state, setState] = useState<ConnectionState>({
    isConnected: true,
    isReconnecting: false,
    lastConnectedAt: new Date(),
    reconnectAttempts: 0,
    channelHealth: new Map(),
  });

  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const consecutiveFailures = useRef(0);
  const appStateListenerRef = useRef<any>(null);

  // Sağlık Kontrolü
  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      const status = await Network.getStatus();
      if (!status.connected) return false;

      // Basit bir RPC çağrısı
      const { error } = await supabase.rpc("get_server_time");
      if (error) {
        consecutiveFailures.current++;
        return false;
      }
      consecutiveFailures.current = 0;
      return true;
    } catch (e) {
      consecutiveFailures.current++;
      return false;
    }
  }, []);

  const checkChannelHealth = useCallback(() => {
    const newHealth = new Map<string, "healthy" | "unhealthy" | "reconnecting">();
    for (const [name, channel] of channelsRef.current) {
      if (channel.state === "joined") newHealth.set(name, "healthy");
      else if (channel.state === "joining") newHealth.set(name, "reconnecting");
      else newHealth.set(name, "unhealthy");
    }
    setState((prev) => ({ ...prev, channelHealth: newHealth }));
    return newHealth;
  }, []);

  // --- ANA RECONNECT MANTIĞI ---
  const reconnect = useCallback(
    async (force = false): Promise<boolean> => {
      if (state.isReconnecting && !force) return false;

      setState((prev) => ({ ...prev, isReconnecting: true }));
      console.log("[Connection] 🔄 Reconnect işlemi başladı... Force:", force);

      try {
        // 1. Önce eski bağlantıyı temizle (Nükleer Reset)
        if (force) {
          console.log("[Connection] Zorla koparılıyor (Disconnect)...");
          await supabase.realtime.disconnect();
          // Android network stack'inin kendine gelmesi için minik bekleme
          await new Promise((r) => setTimeout(r, 300));
        }

        // 2. Token kontrolü ve Ayarlama
        if (session?.access_token) {
          const { error } = await supabase.auth.refreshSession(); // Token bayatlamış olabilir, tazele!
          if (!error) {
            const currentSession = await supabase.auth.getSession();
            if (currentSession.data.session?.access_token) {
              supabase.realtime.setAuth(currentSession.data.session.access_token);
            }
          }
        }

        // 3. Bağlan
        console.log("[Connection] Bağlanılıyor (Connect)...");
        supabase.realtime.connect();

        // 4. Sağlık kontrolü
        const isHealthy = await performHealthCheck();

        // 5. Kanalları canlandır
        if (isHealthy) {
          const health = checkChannelHealth();
          for (const [name, status] of health) {
            // Unhealthy olanları veya force durumunda hepsini tazele
            if (status === "unhealthy" || force) {
              const channel = channelsRef.current.get(name);
              if (channel) {
                // Kanalı rejoin yap
                console.log(`[Connection] Kanal tazeleniyor: ${name}`);
                channel.subscribe();
              }
            }
          }
        }

        setState((prev) => ({
          ...prev,
          isConnected: isHealthy,
          isReconnecting: false,
          lastConnectedAt: isHealthy ? new Date() : prev.lastConnectedAt,
          reconnectAttempts: isHealthy ? 0 : prev.reconnectAttempts + 1,
        }));

        return isHealthy;
      } catch (e) {
        console.log("[Connection] Reconnect hatası:", e);
        setState((prev) => ({ ...prev, isReconnecting: false }));
        return false;
      }
    },
    [state.isReconnecting, performHealthCheck, checkChannelHealth, session],
  );

  // --- UYANMA (RESUME) DİNLEYİCİSİ ---
  useEffect(() => {
    const initAppStateListener = async () => {
      // Eğer varsa eskisini sil (Duplicate önlemek için)
      if (appStateListenerRef.current) {
        await appStateListenerRef.current.remove();
      }

      appStateListenerRef.current = await App.addListener("appStateChange", async ({ isActive }) => {
        if (isActive) {
          console.log("📱 [Connection] UYGULAMA UYANDI (RESUME)!");
          console.log("⚡ Bağlantı sıfırlanıyor...");

          // Uygulama öne geldiğinde bekleme yapma, direkt NÜKLEER RECONNECT yap.
          // "true" parametresi disconnect() çağırır.
          setTimeout(() => {
            reconnect(true);
          }, 500); // UI kendine gelsin diye yarım saniye avans veriyoruz
        } else {
          console.log("💤 [Connection] Uygulama uykuya geçti.");
        }
      });
    };

    initAppStateListener();

    // Heartbeat
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      const isHealthy = await performHealthCheck();
      checkChannelHealth();

      if (!isHealthy && consecutiveFailures.current >= 2) {
        console.log("[Connection] Kalp atışı zayıf -> Reconnect");
        reconnect();
      }

      setState((prev) => ({
        ...prev,
        isConnected: isHealthy || consecutiveFailures.current < 3,
      }));
    }, 10000);

    return () => {
      if (appStateListenerRef.current) appStateListenerRef.current.remove();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [reconnect, performHealthCheck, checkChannelHealth]);

  // Helper metodlar
  const registerChannel = useCallback(
    (name: string, channel: RealtimeChannel) => {
      channelsRef.current.set(name, channel);
      checkChannelHealth();
    },
    [checkChannelHealth],
  );

  const unregisterChannel = useCallback(
    (name: string) => {
      channelsRef.current.delete(name);
      checkChannelHealth();
    },
    [checkChannelHealth],
  );

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
