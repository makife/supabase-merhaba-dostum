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
  // 👇 1. DEĞİŞİKLİK: loading bilgisini de aldık ki Auth yüklenmeden bağlanmaya çalışmayalım
  const { session, loading: authLoading } = useAuth();

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
      if (state.isReconnecting && !force) return false;

      // Auth yükleniyorsa ve ortada session yoksa bekle (Kill sonrası için kritik)
      if (authLoading && !session) {
        console.log("[Connection] Auth yükleniyor, bekleniyor...");
        return false;
      }

      setState((prev) => ({ ...prev, isReconnecting: true }));
      console.log(`[Connection] 🔄 Reconnect: ${force ? "ZORLA" : "Normal"}`);

      try {
        // 1. TEMİZLİK
        if (force) {
          console.log("[Connection] 🔌 Bağlantı temizleniyor...");
          await supabase.realtime.disconnect();
          await new Promise((r) => setTimeout(r, 300));
        }

        // 2. TOKEN GÜNCELLEME
        // Session varsa, token'ın sokete işlendiğinden emin ol
        if (session?.access_token) {
          // Token taze mi diye bak
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token) {
            supabase.realtime.setAuth(data.session.access_token);
          }
        }

        // 3. BAĞLAN
        console.log("[Connection] 🚀 Bağlanılıyor...");
        supabase.realtime.connect();

        // 4. KONTROL
        const isHealthy = await performHealthCheck();

        // 5. KANALLARI KURTAR
        if (isHealthy) {
          const health = checkChannelHealth();
          channelsRef.current.forEach((channel, name) => {
            // Force durumunda veya kanal kopuksa abone ol
            if (force || channel.state !== "joined") {
              console.log(`[Connection] Kanal tazeleniyor: ${name}`);
              channel.subscribe();
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
        console.log("[Connection] Hata:", e);
        setState((prev) => ({ ...prev, isReconnecting: false }));
        return false;
      }
    },
    [state.isReconnecting, performHealthCheck, checkChannelHealth, session, authLoading],
  );

  // --- 🔥 1. KORUMA: KILL SONRASI (COLD START) ---
  // Uygulama ilk açıldığında AppState listener tetiklenmez.
  // Bu yüzden AuthContext "Yüklendim" dediği an bağlantıyı biz tetikleriz.
  useEffect(() => {
    if (!authLoading && session) {
      console.log("[Connection] ✅ Auth Hazır (Cold Start) -> Bağlanılıyor...");
      // İlk açılışta temiz bir sayfa için force=true yapılabilir ama genelde normal reconnect yeterlidir.
      // Garanti olsun diye kısa bir gecikmeyle başlatıyoruz.
      setTimeout(() => reconnect(), 100);
    }
  }, [authLoading, session]); // Sadece auth durumu değişince çalışır

  // --- 🔥 2. KORUMA: UYANMA (FOREGROUND) ---
  // Uygulama arka plandan dönünce çalışır.
  useEffect(() => {
    const initListener = async () => {
      if (appStateListenerRef.current) await appStateListenerRef.current.remove();

      appStateListenerRef.current = await App.addListener("appStateChange", async ({ isActive }) => {
        if (isActive) {
          console.log("📱 [Connection] Uygulama UYANDI!");

          // ÖNEMLİ: Hemen disconnect YAPMA! Önce mevcut bağlantıyı kontrol et.
          // OS arka planda WebSocket'i öldürmüş olabilir, kontrol edelim.
          
          const checkAndReconnect = async () => {
            try {
              // 1. Ağ durumunu kontrol et
              const status = await Network.getStatus();
              console.log(`📡 [Connection] Ağ durumu: ${status.connected ? "Bağlı" : "Bağlı Değil"}`);
              
              if (!status.connected) {
                console.log("❌ [Connection] Ağ yok, bekleniyor...");
                // Ağ yoksa 2 saniye sonra tekrar dene
                setTimeout(checkAndReconnect, 2000);
                return;
              }

              // 2. Mevcut bağlantı sağlıklı mı kontrol et
              const isHealthy = await performHealthCheck();
              console.log(`🏥 [Connection] Sağlık kontrolü: ${isHealthy ? "Sağlıklı" : "Sağlıksız"}`);

              if (isHealthy) {
                // Bağlantı hala sağlıklı, sadece kanalları kontrol et
                console.log("✅ [Connection] Bağlantı sağlıklı, kanallar kontrol ediliyor...");
                checkChannelHealth();
                
                // Kopuk kanalları yeniden abone et
                channelsRef.current.forEach((channel, name) => {
                  if (channel.state !== "joined") {
                    console.log(`🔄 [Connection] Kanal yeniden abone ediliyor: ${name}`);
                    channel.subscribe();
                  }
                });
                
                setState((prev) => ({
                  ...prev,
                  isConnected: true,
                  lastConnectedAt: new Date(),
                }));
                
                startHeartbeat();
              } else {
                // Bağlantı kopuk, yeniden bağlan
                console.log("⚠️ [Connection] Bağlantı kopuk, yeniden bağlanılıyor...");
                reconnect(true);
              }
            } catch (error) {
              console.error("❌ [Connection] Kontrol hatası:", error);
              // Hata durumunda yeniden bağlanmayı dene
              reconnect(true);
            }
          };

          // Kısa bir gecikme ile kontrol et (OS'un ağ stack'ini hazırlaması için)
          setTimeout(checkAndReconnect, 300);
        } else {
          console.log("💤 [Connection] Uyku modu - Heartbeat durduruluyor.");
          // Arka plana alındığında sadece heartbeat'i durdur
          // disconnect() YAPMA! OS zaten WebSocket'i öldürecek, 
          // biz sadece bunu kabul ediyoruz.
          stopHeartbeat();
          
          // Bağlantı durumunu güncelle ama disconnect çağırma
          setState((prev) => ({
            ...prev,
            isConnected: false, // Varsayalım ki kopacak
          }));
        }
      });
    };

    initListener();
    startHeartbeat();

    return () => {
      if (appStateListenerRef.current) appStateListenerRef.current.remove();
      stopHeartbeat();
    };
  }, []); // Mount olduğunda sadece 1 kere listener kurulur

  // Heartbeat Yönetimi
  const startHeartbeat = () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      // Auth yükleniyorsa kalp atışı yapma
      if (authLoading) return;

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

export const useConnectionStatus = () => {
  const { state, isHealthy } = useConnection();
  return {
    isConnected: state.isConnected,
    isReconnecting: state.isReconnecting,
    isHealthy,
  };
};
