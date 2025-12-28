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
  const { session } = useAuth(); // AuthContext'ten session bilgisini al

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

  // --- SAĞLIK KONTROLÜ ---
  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      const status = await Network.getStatus();
      if (!status.connected) return false;

      // RPC ile sunucu zamanını çekerek gerçek bağlantıyı test et
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

  // Kanal Durumlarını Kontrol Et
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

  // --- ANA BAĞLANMA MANTIĞI ---
  const reconnect = useCallback(
    async (force = false): Promise<boolean> => {
      // Zaten bağlanıyorsak ve zorlama yoksa çık
      if (state.isReconnecting && !force) return false;

      setState((prev) => ({ ...prev, isReconnecting: true }));
      console.log("[Connection] 🔄 Reconnect işlemi başladı... Force:", force);

      try {
        // 1. ZORLA KOPARMA (Clean Slate)
        // Force durumunda veya bağlantı kopuksa önce mevcut soketi temizle
        if (force) {
          console.log("[Connection] 🔌 Eski bağlantı temizleniyor (Disconnect)...");
          await supabase.realtime.disconnect();
          // Android network stack'inin kendine gelmesi için minik bekleme
          await new Promise((r) => setTimeout(r, 300));
        }

        // 2. TOKEN TAZELEME
        // Session varsa, token'ın güncel olduğundan emin ol
        if (session?.access_token) {
          // AuthContext zaten taze token sağlıyor ama biz sokete işleyelim
          const { error } = await supabase.auth.refreshSession();
          if (!error) {
            const currentSession = await supabase.auth.getSession();
            if (currentSession.data.session?.access_token) {
              supabase.realtime.setAuth(currentSession.data.session.access_token);
            }
          }
        }

        // 3. BAĞLAN
        console.log("[Connection] 🚀 Bağlanılıyor (Connect)...");
        supabase.realtime.connect();

        // 4. SONUÇ KONTROLÜ
        const isHealthy = await performHealthCheck();

        // 5. KANALLARI CANLANDIR (Re-subscribe)
        if (isHealthy) {
          const health = checkChannelHealth();
          // Force durumunda tüm kanalları yeniden abone yap
          channelsRef.current.forEach((channel, name) => {
            console.log(`[Connection] Kanal tazeleniyor: ${name}`);
            // Kanal hataya düşmüşse tekrar subscribe tetikle
            if (channel.state !== "joined") {
              channel.subscribe((status) => {
                if (status === "SUBSCRIBED") checkChannelHealth();
              });
            }
          });
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

  // --- UYANMA (RESUME) DİNLEYİCİSİ - SABIRLI BEKLEYİŞ ---
  useEffect(() => {
    const initAppStateListener = async () => {
      // Varsa eskisini temizle
      if (appStateListenerRef.current) {
        await appStateListenerRef.current.remove();
      }

      appStateListenerRef.current = await App.addListener("appStateChange", async ({ isActive }) => {
        if (isActive) {
          console.log("📱 [Connection] Uygulama UYANDI (Foreground)!");

          // 1. Önce bozuk olabilecek bağlantıyı hemen kes
          await supabase.realtime.disconnect();

          // 2. SABIRLI BEKLEYİŞ DÖNGÜSÜ (Network Polling)
          // İnternet gelene kadar 500ms aralıklarla kontrol et
          let attempts = 0;
          const maxAttempts = 10; // 10 * 500ms = 5 saniye sabret

          const waitForNetworkAndConnect = async () => {
            const status = await Network.getStatus();
            console.log(
              `📡 [Connection] Ağ Kontrolü (${attempts + 1}/${maxAttempts}):`,
              status.connected ? "VAR" : "YOK",
            );

            if (status.connected) {
              console.log("⚡ Ağ Hazır! Bağlantı başlatılıyor...");
              reconnect(true); // Force reconnect
            } else if (attempts < maxAttempts) {
              attempts++;
              setTimeout(waitForNetworkAndConnect, 500); // 500ms sonra tekrar dene
            } else {
              console.log("❌ [Connection] Uygulama uyandı ama internet gelmedi (Zaman aşımı).");
              // Yine de son bir şans verelim
              reconnect(true);
            }
          };

          // İlk kontrolü hemen başlatma, 500ms avans ver
          setTimeout(waitForNetworkAndConnect, 500);
        } else {
          console.log("💤 [Connection] Uygulama uykuya geçti.");
          stopHeartbeat();
        }
      });
    };

    initAppStateListener();
    startHeartbeat(); // İlk açılışta heartbeat başlat

    return () => {
      if (appStateListenerRef.current) appStateListenerRef.current.remove();
      stopHeartbeat();
    };
  }, [reconnect]); // Dependency array temizlendi

  // Heartbeat Yönetimi
  const startHeartbeat = () => {
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
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
  };

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
