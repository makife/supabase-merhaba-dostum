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

  // --- 🔥 2. KORUMA: UYANMA (FOREGROUND) - HARD RESET YAKLAŞIMI ---
  // Native'de uygulama arka plandan dönünce MUTLAKA hard reset yap
  useEffect(() => {
    const initListener = async () => {
      if (appStateListenerRef.current) await appStateListenerRef.current.remove();

      appStateListenerRef.current = await App.addListener("appStateChange", async ({ isActive }) => {
        if (isActive) {
          console.log("📱 [Connection] Uygulama UYANDI - HARD RESET BAŞLIYOR!");

          // Native'de arka plandan dönünce HER ZAMAN hard reset yap
          // Hiçbir kontrol yapma, direkt kes ve yeniden bağlan
          const hardReset = async () => {
            try {
              console.log("🔌 [Connection] HARD RESET: Tüm bağlantılar kesiliyor...");
              
              // 1. Heartbeat'i durdur
              stopHeartbeat();
              
              // 2. Realtime'ı tamamen kes - ZORLA
              try {
                supabase.realtime.disconnect();
              } catch (e) {
                console.log("⚠️ [Connection] Disconnect hatası (görmezden gel):", e);
              }
              
              // 3. Biraz bekle - OS'un temizlik yapması için
              await new Promise(r => setTimeout(r, 500));
              
              // 4. Ağ durumunu kontrol et
              const status = await Network.getStatus();
              console.log(`📡 [Connection] Ağ durumu: ${status.connected ? "Bağlı" : "Bağlı Değil"}`);
              
              if (!status.connected) {
                console.log("❌ [Connection] Ağ yok, 3 saniye sonra tekrar denenecek...");
                setState(prev => ({ ...prev, isConnected: false, isReconnecting: false }));
                setTimeout(hardReset, 3000);
                return;
              }
              
              // 5. Session'ı tazele
              console.log("🔑 [Connection] Session tazeleniyor...");
              const { data: sessionData } = await supabase.auth.getSession();
              
              if (sessionData?.session?.access_token) {
                supabase.realtime.setAuth(sessionData.session.access_token);
                console.log("✅ [Connection] Token güncellendi");
              }
              
              // 6. Yeniden bağlan
              console.log("🚀 [Connection] Realtime bağlantısı başlatılıyor...");
              supabase.realtime.connect();
              
              // 7. Biraz bekle ve bağlantıyı doğrula
              await new Promise(r => setTimeout(r, 500));
              
              // 8. RPC ile bağlantıyı test et
              const { error } = await supabase.rpc("get_server_time");
              
              if (error) {
                console.log("⚠️ [Connection] Bağlantı testi başarısız, tekrar deneniyor...");
                setTimeout(hardReset, 2000);
                return;
              }
              
              console.log("✅ [Connection] Bağlantı testi BAŞARILI!");
              
              // 9. Tüm kanalları yeniden abone et
              console.log(`📺 [Connection] ${channelsRef.current.size} kanal yeniden abone ediliyor...`);
              channelsRef.current.forEach((channel, name) => {
                console.log(`🔄 [Connection] Kanal abone ediliyor: ${name}`);
                try {
                  channel.subscribe();
                } catch (e) {
                  console.log(`⚠️ [Connection] Kanal abone hatası (${name}):`, e);
                }
              });
              
              // 10. State'i güncelle
              setState({
                isConnected: true,
                isReconnecting: false,
                lastConnectedAt: new Date(),
                reconnectAttempts: 0,
                channelHealth: new Map(),
              });
              
              // 11. Heartbeat'i başlat
              startHeartbeat();
              
              console.log("🎉 [Connection] HARD RESET TAMAMLANDI!");
              
            } catch (error) {
              console.error("❌ [Connection] Hard reset hatası:", error);
              setState(prev => ({ ...prev, isConnected: false, isReconnecting: false }));
              // Hata durumunda 3 saniye sonra tekrar dene
              setTimeout(hardReset, 3000);
            }
          };

          // Hemen hard reset başlat
          hardReset();
          
        } else {
          console.log("💤 [Connection] Uyku modu - Bağlantı kesiliyor.");
          
          // Arka plana alındığında HER ŞEYİ temizle
          stopHeartbeat();
          
          // Bağlantıyı kes - native'de OS zaten kesecek ama biz de keselim
          try {
            supabase.realtime.disconnect();
          } catch (e) {
            // Görmezden gel
          }
          
          setState(prev => ({
            ...prev,
            isConnected: false,
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
