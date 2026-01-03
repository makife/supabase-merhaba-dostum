import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase, recreateSupabaseClient, getSupabaseClient } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { RealtimeChannel } from "@supabase/supabase-js";
import { ForegroundService } from "capacitor-foreground-service";
import { startForegroundServiceStandalone, stopForegroundServiceStandalone } from "@/hooks/useForegroundService";
// NativeRealtime şimdilik devre dışı - Kotlin plugin entegre edilmedi

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
  /** Native Realtime kullanılıyor mu? */
  isUsingNativeRealtime: boolean;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

// Native platform kontrolü - component dışında
const isNativePlatform = Capacitor.isNativePlatform();
const isAndroidPlatform = Capacitor.getPlatform() === "android";

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
  const foregroundServiceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // SUPAbase CLIENT'I TAMAMEN YENİDEN OLUŞTUR - SÜPER BASİT VE BLOKLAMA YOK!
  const forceReconnect = useCallback(async (): Promise<boolean> => {
    console.log("🚀🚀🚀 [Connection] ============ FORCE RECONNECT BAŞLADI ============");

    // ÖNEMLİ: isReconnectingRef kontrolü YAPMA - her zaman reconnect'e izin ver!
    // Eski reconnect takılmış olabilir, zorla yeniden başlat
    if (isReconnectingRef.current) {
      console.log("[Connection] ⚠️ Önceki reconnect takılmış, ZORLA sıfırlanıyor!");
    }

    // Her zaman sıfırla ve başla
    isReconnectingRef.current = true;
    stopHeartbeat();

    if (isMountedRef.current) {
      setState((prev) => ({ ...prev, isReconnecting: true, isConnected: false }));
    }

    let success = false;

    try {
      // ADIM 1: Client'ı yeniden oluştur
      console.log("[Connection] 1️⃣ Client yeniden oluşturuluyor...");
      await recreateSupabaseClient();
      console.log("[Connection] ✅ Client oluşturuldu");

      // ADIM 2: Kısa bekle (client hazır olsun)
      await new Promise((r) => setTimeout(r, 300));

      // ADIM 3: Bağlantı testi
      console.log("[Connection] 2️⃣ Bağlantı testi yapılıyor...");
      
      for (let i = 1; i <= 5; i++) {
        try {
          const client = getSupabaseClient();
          const { data, error } = await client.rpc("get_server_time");
          
          if (!error && data) {
            success = true;
            console.log(`[Connection] ✅ Bağlantı BAŞARILI! (${i}. deneme)`);
            break;
          } else {
            console.log(`[Connection] ❌ Deneme ${i} başarısız:`, error?.message);
          }
        } catch (e) {
          console.log(`[Connection] ❌ Deneme ${i} exception:`, e);
        }
        
        // Denemeler arası bekle
        if (i < 5) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

    } catch (error) {
      console.error("[Connection] ❌ Reconnect genel hata:", error);
    }

    // Sonucu kaydet
    isReconnectingRef.current = false;
    
    if (isMountedRef.current) {
      setState((prev) => ({
        ...prev,
        isConnected: success,
        isReconnecting: false,
        lastConnectedAt: success ? new Date() : prev.lastConnectedAt,
        reconnectAttempts: success ? 0 : prev.reconnectAttempts + 1,
      }));
    }

    if (success) {
      console.log("🎉 [Connection] ============ RECONNECT BAŞARILI! ============");
      startHeartbeat();
      
      // Tüm componentlere haber ver - DATA REFETCH için
      console.log("[Connection] 📢 supabase-reconnected event yayınlanıyor...");
      window.dispatchEvent(new CustomEvent("supabase-reconnected"));
      
      // 500ms sonra tekrar (geç yüklenen componentler için)
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("supabase-reconnected"));
        console.log("[Connection] 📢 supabase-reconnected (2. sinyal) yayınlandı");
      }, 500);
    } else {
      console.log("❌ [Connection] Reconnect başarısız, 3 saniye sonra tekrar denenecek...");
      
      // Başarısızsa otomatik tekrar dene
      setTimeout(() => {
        if (isMountedRef.current) {
          isReconnectingRef.current = false; // Reset flag before retry
          forceReconnect();
        }
      }, 3000);
    }

    return success;
  }, [stopHeartbeat, startHeartbeat]);

  // Normal reconnect (forceReconnect'e yönlendir)
  const reconnect = useCallback(
    async (force = false): Promise<boolean> => {
      return forceReconnect();
    },
    [forceReconnect],
  );

  // NATIVE APP STATE LISTENER
  useEffect(() => {
    if (!isNativePlatform) return;
    
    console.log("[Connection] 📱 Native app state listener başlatılıyor...");

    const setupNativeListener = async () => {
      try {
        const { App } = await import("@capacitor/app");

        // Eski listener'ı temizle
        if (appListenerRef.current) {
          appListenerRef.current.remove();
          appListenerRef.current = null;
        }

        appListenerRef.current = await App.addListener("appStateChange", async ({ isActive }) => {
          console.log(
            `📱 [Connection] ============ APP STATE: ${isActive ? "FOREGROUND ▶️" : "BACKGROUND ⏸️"} ============`,
          );

          if (isActive) {
            // ÖN PLANA GELDİ
            console.log("🚀 [Connection] ============ ÖN PLANA GELDİ ============");
            
            // 1. Timeout'ları temizle
            if (foregroundServiceTimeoutRef.current) {
              clearTimeout(foregroundServiceTimeoutRef.current);
              foregroundServiceTimeoutRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
              reconnectTimeoutRef.current = null;
            }

            // 2. Foreground Service'i durdur
            if (isAndroidPlatform) {
              stopForegroundServiceStandalone().catch(() => {});
            }

            // 3. ÖNCE BAĞLANTIYI TEST ET - kopmuşsa reconnect yap
            console.log("🔍 [Connection] Bağlantı test ediliyor...");
            
            const testConnection = async () => {
              try {
                const client = getSupabaseClient();
                const startTime = Date.now();
                const { data, error } = await client.rpc("get_server_time");
                const latency = Date.now() - startTime;
                
                if (!error && data) {
                  // ✅ BAĞLANTI SAĞLAM - reconnect'e gerek yok!
                  console.log(`✅ [Connection] Bağlantı SAĞLAM! (${latency}ms) - Reconnect ATLANIYOR`);
                  
                  // Sadece state güncelle ve event yayınla
                  if (isMountedRef.current) {
                    setState(prev => ({ ...prev, isConnected: true, isReconnecting: false }));
                  }
                  
                  // Componentlere veri yenilemesi için haber ver
                  window.dispatchEvent(new CustomEvent("supabase-reconnected"));
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent("supabase-reconnected"));
                  }, 500);
                  
                  // Heartbeat'i yeniden başlat
                  startHeartbeat();
                  
                } else {
                  // ❌ BAĞLANTI KOPMUŞ - tam reconnect yap
                  console.log(`❌ [Connection] Bağlantı KOPMUŞ (hata: ${error?.message}) - Reconnect başlatılıyor...`);
                  isReconnectingRef.current = false; // Flag'i sıfırla
                  forceReconnect();
                }
              } catch (e) {
                console.log("❌ [Connection] Bağlantı testi exception:", e);
                isReconnectingRef.current = false;
                forceReconnect();
              }
            };
            
            // Kısa gecikme ile test et (Android'in kendini toplaması için)
            setTimeout(testConnection, 200);
            
          } else {
            // ARKA PLANA GİTTİ
            console.log("📱 [Connection] ============ ARKA PLANA GEÇİŞ ============");
            
            // Foreground Service başlat - bağlantıyı korumak için
            if (isAndroidPlatform) {
              startForegroundServiceStandalone({
                title: "Kelimele Aktif",
                description: "🔗 Bağlantı korunuyor...",
              }).then(serviceStarted => {
                if (serviceStarted) {
                  console.log("✅ [Connection] Foreground Service başladı");
                  
                  if (foregroundServiceTimeoutRef.current) {
                    clearTimeout(foregroundServiceTimeoutRef.current);
                  }

                  // 5 dakika sonra otomatik durdur (oyun süresi için yeterli)
                  foregroundServiceTimeoutRef.current = setTimeout(async () => {
                    console.log("⏰ [Connection] 5dk doldu, servis kapatılıyor");
                    await stopForegroundServiceStandalone();
                    foregroundServiceTimeoutRef.current = null;
                  }, 5 * 60 * 1000); // 5 dakika
                }
              }).catch(err => {
                console.error("❌ [Connection] Foreground Service hatası:", err);
              });
            }
            
            console.log("📱 [Connection] Heartbeat ve bağlantı OLDUĞU GİBİ KALIYOR");
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
  }, [forceReconnect]);

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
      console.log("[Connection] 🚀 İlk bağlantı başlatılıyor...");

      // Native platformda ağ kontrolü yap
      if (isNativePlatform) {
        try {
          const { Network } = await import("@capacitor/network");
          let networkReady = false;
          let retries = 0;

          while (!networkReady && retries < 10) {
            const status = await Network.getStatus();
            console.log(
              `[Connection] 📶 Ağ durumu kontrol ${retries + 1}: ${status.connected ? "BAĞLI ✅" : "BEKLENİYOR..."}`,
            );

            if (status.connected) {
              networkReady = true;
            } else {
              retries++;
              await new Promise((r) => setTimeout(r, 500));
            }
          }

          if (!networkReady) {
            console.log("[Connection] ⚠️ Ağ bağlantısı yok, 3 saniye sonra tekrar denenecek...");
            setTimeout(() => {
              if (isMountedRef.current) {
                initConnection();
              }
            }, 3000);
            return;
          }
        } catch (e) {
          console.log("[Connection] ⚠️ Ağ kontrolü yapılamadı, devam ediliyor...");
        }
      }

      // Kısa gecikme (auth hazır olması için)
      await new Promise((r) => setTimeout(r, 500));

      if (!isMountedRef.current) return;

      // Bağlantı testi - birden fazla deneme
      let connectionSuccess = false;

      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          console.log(`[Connection] 🧪 Bağlantı testi deneme ${attempt}/5...`);
          const { data, error } = await getSupabaseClient().rpc("get_server_time");

          if (!error && data) {
            connectionSuccess = true;
            console.log(`[Connection] ✅ İlk bağlantı başarılı! (deneme ${attempt})`);
            break;
          } else {
            console.log(`[Connection] ⚠️ Bağlantı testi hatası (deneme ${attempt}):`, error?.message);
          }
        } catch (e) {
          console.log(`[Connection] ⚠️ Bağlantı testi exception (deneme ${attempt}):`, e);
        }

        // Denemeler arası bekleme (artan süre)
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }

      if (isMountedRef.current) {
        if (connectionSuccess) {
          setState((prev) => ({ ...prev, isConnected: true }));
          startHeartbeat();

          // 🔥 KRİTİK: İlk bağlantı başarılı - kanalların canlanması için event yayınla
          console.log("[Connection] 🎉 İlk bağlantı başarılı - supabase-reconnected event yayınlanıyor...");
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent("supabase-reconnected"));
            console.log("[Connection] ✅ supabase-reconnected event yayınlandı!");
          }, 300);
        } else {
          console.log("[Connection] ⚠️ İlk bağlantı başarısız, tam reconnect başlatılıyor...");
          await forceReconnect();
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
  const isUsingNativeRealtime = false; // Şimdilik devre dışı

  return (
    <ConnectionContext.Provider
      value={{
        state,
        reconnect,
        registerChannel,
        unregisterChannel,
        isHealthy,
        forceReconnect,
        isUsingNativeRealtime,
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
