import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { RealtimeChannel } from "@supabase/supabase-js";

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

  // Health check - Basit ping
  const performHealthCheck = useCallback(async (): Promise<boolean> => {
    try {
      const status = await Network.getStatus();
      if (!status.connected) {
        console.log("[Connection] Internet yok (Native check)");
        return false;
      }

      // RPC çağrısı ile veritabanı erişimini test et
      // Bu sadece interneti değil, TOKEN geçerliliğini de test eder!
      const { error } = await supabase.rpc("get_server_time");

      if (error) {
        console.log("[Connection] RPC Check Failed:", error.message);
        // Eğer hata Auth ile ilgiliyse bunu sayaca ekle
        consecutiveFailures.current++;
        return false;
      }

      consecutiveFailures.current = 0;
      return true;
    } catch (e) {
      console.log("[Connection] Health check exception:", e);
      consecutiveFailures.current++;
      return false;
    }
  }, []);

  // Kanal durumlarını kontrol et
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

  // --- ANA RECONNECT MANTIĞI (GÜNCELLENDİ) ---
  const reconnect = useCallback(
    async (force = false): Promise<boolean> => {
      if (state.isReconnecting && !force) return false;

      setState((prev) => ({ ...prev, isReconnecting: true }));
      console.log("[Connection] 🔄 Reconnect started... Force:", force);

      try {
        // 1. Önce basit bir sağlık kontrolü yap
        let isHealthy = await performHealthCheck();

        // 2. Eğer sağlık kontrolü başarısızsa, sorun %90 TOKEN SÜRESİDİR.
        // Sadece internet kontrolü yetmez, oturumu yenilemek zorundayız.
        if (!isHealthy) {
          console.log("[Connection] ⚠️ Health check failed. Attempting SESSION REFRESH...");

          // Supabase'in session'ı yenilemesini bekle
          const { data, error } = await supabase.auth.refreshSession();

          if (error) {
            console.log("[Connection] ❌ Session refresh failed:", error.message);
            // Eğer refresh de başarısızsa, kullanıcıyı gerçekten offline kabul et
          } else if (data.session) {
            console.log("[Connection] ✅ Session refreshed successfully!");
            // Session yenilendi, şimdi tekrar sağlık kontrolü yap
            // Biraz bekle ki socket yeni token'ı alabilsin
            await new Promise((r) => setTimeout(r, 500));
            isHealthy = await performHealthCheck();
          }
        }

        // 3. Kanalları onar (Eğer bağlantı sağlandıysa)
        if (isHealthy) {
          const health = checkChannelHealth();
          for (const [name, status] of health) {
            if (status === "unhealthy") {
              const channel = channelsRef.current.get(name);
              if (channel) {
                console.log(`[Connection] Rejoining channel: ${name}`);
                // removeChannel yapmak yerine rejoin denemek bazen daha güvenlidir
                // ama temiz kurulum için remove -> create mantığı react tarafında yönetilmeli.
                // Burada sadece socket'in bağlı olduğundan emin oluyoruz.
                if (channel.state !== "joining" && channel.state !== "joined") {
                  channel.subscribe((status) => {
                    if (status === "SUBSCRIBED") checkChannelHealth();
                  });
                }
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
        console.log("[Connection] Fatal reconnect error:", e);
        setState((prev) => ({ ...prev, isReconnecting: false }));
        return false;
      }
    },
    [state.isReconnecting, performHealthCheck, checkChannelHealth],
  );

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

  // Heartbeat
  useEffect(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    heartbeatRef.current = setInterval(async () => {
      const isHealthy = await performHealthCheck();
      checkChannelHealth();

      // Eğer bağlantı koptuysa, sessizce değil, agresif şekilde session yenileme dene
      if (!isHealthy) {
        // İlk hatada hemen reconnect deneme, belki anlık kopmadır (consecutiveFailures >= 1)
        if (consecutiveFailures.current >= 2) {
          console.log("[Connection] Heartbeat lost x2 -> Triggering Reconnect");
          reconnect();
        }
      }

      setState((prev) => ({
        ...prev,
        isConnected: isHealthy || consecutiveFailures.current < 3,
      }));
    }, 10000); // 10 saniye

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [performHealthCheck, reconnect, checkChannelHealth]);

  // Boot Sequence & Listeners
  useEffect(() => {
    let networkListener: any;
    let appStateListener: any;
    // Auth state değişimlerini dinle (Token yenilenirse bağlantıyı güncelle)
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        console.log(`[Connection] Auth Event: ${event} -> Marking connected`);
        setState((prev) => ({ ...prev, isConnected: true }));
        consecutiveFailures.current = 0;
      }
    });

    const initConnection = async () => {
      // 1. Network Listener
      networkListener = await Network.addListener("networkStatusChange", (status) => {
        console.log("[Connection] Network change:", status);
        if (status.connected) setTimeout(() => reconnect(true), 1000);
      });

      // 2. App State Listener (Resume/Background)
      appStateListener = await App.addListener("appStateChange", async ({ isActive }) => {
        if (isActive) {
          console.log("[Connection] App Resumed -> Force Check");
          // Resume olduğunda bekleme yapma, hemen token kontrolü yap
          reconnect(true);
        }
      });

      // 3. COLD START (Agresif Başlangıç)
      // Açılışta token eskiyse, ilk check fail verir.
      // O yüzden fail verirse hemen refreshSession deniyoruz (reconnect içinde var).
      const boot = async () => {
        await new Promise((r) => setTimeout(r, 500)); // Native kendine gelsin
        const isHealthy = await performHealthCheck();
        if (!isHealthy) {
          console.log("[Connection] Boot check failed -> Forcing Reconnect Sequence");
          await reconnect(true);
        } else {
          console.log("[Connection] Boot check OK");
        }
      };

      boot();
    };

    initConnection();

    return () => {
      if (networkListener) networkListener.remove();
      if (appStateListener) appStateListener.remove();
      authListener.subscription.unsubscribe();
    };
  }, [reconnect, performHealthCheck]);

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
