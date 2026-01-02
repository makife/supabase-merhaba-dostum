import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { recreateSupabaseClient, getSupabaseClient } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { RealtimeChannel } from "@supabase/supabase-js";
import { startForegroundServiceStandalone, stopForegroundServiceStandalone } from "@/hooks/useForegroundService";

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

  // SUPAbase CLIENT'I TAMAMEN YENİDEN OLUŞTUR
  const forceReconnect = useCallback(async (): Promise<boolean> => {
    // Debounce: Son 1 saniye içinde reconnect olduysa atla (daha kısa)
    const now = Date.now();
    if (now - lastForegroundTimeRef.current < 1000) {
      console.log("[Connection] ⏳ Debounce - son reconnect çok yakın, atlanıyor...");
      return true; // false yerine true döndür - bağlantı varsayılan olarak var kabul edilsin
    }
    lastForegroundTimeRef.current = now;

    if (isReconnectingRef.current) {
      console.log("[Connection] ⚠️ Reconnect zaten çalışıyor, bekleniyor...");
      // Reconnect bitene kadar bekle
      let waitCount = 0;
      while (isReconnectingRef.current && waitCount < 20) {
        await new Promise(r => setTimeout(r, 250));
        waitCount++;
      }
      return state.isConnected;
    }

    isReconnectingRef.current = true;

    // Pending timeout'ları temizle
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (isMountedRef.current) {
      setState((prev) => ({ ...prev, isReconnecting: true }));
    }

    console.log("🔄 [Connection] ========== RECONNECT BAŞLATILIYOR ==========");
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
            await new Promise((r) => setTimeout(r, 2000));

            // Tekrar kontrol et
            const status2 = await Network.getStatus();
            if (!status2.connected) {
              console.log("[Connection] ❌ Hala ağ yok, reconnect iptal...");
              isReconnectingRef.current = false;
              if (isMountedRef.current) {
                setState((prev) => ({ ...prev, isReconnecting: false }));
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
      await new Promise((r) => setTimeout(r, 500));

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
        await new Promise((r) => setTimeout(r, 400));
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
      setState((prev) => ({
        ...prev,
        isConnected: success,
        isReconnecting: false,
        lastConnectedAt: success ? new Date() : null,
        reconnectAttempts: success ? 0 : prev.reconnectAttempts + 1,
        showRecoveryOverlay: false, // Başarılıysa overlay'ı kapat
      }));
    }

    if (success) {
      startHeartbeat();
    }
    // ARTIK OTOMATİK RETRY YOK - Manuel overlay gösterilecek

    isReconnectingRef.current = false;
    return success;
  }, [stopHeartbeat, startHeartbeat]);

  // Normal reconnect (forceReconnect'e yönlendir)
  const reconnect = useCallback(
    async (force = false): Promise<boolean> => {
      return forceReconnect();
    },
    [forceReconnect],
  );

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
          console.log(
            `📱 [Connection] ============ APP STATE: ${isActive ? "FOREGROUND ▶️" : "BACKGROUND ⏸️"} ============`,
          );

          if (isActive) {
            // ÖN PLANA GELDİ
            console.log("▶️ [Connection] Ön plana gelindi, işlemler başlıyor...");
            
            // 1. Önceki timeout'u temizle
            if (foregroundServiceTimeoutRef.current) {
              clearTimeout(foregroundServiceTimeoutRef.current);
              foregroundServiceTimeoutRef.current = null;
              console.log("🧹 [Connection] Bekleyen timeout temizlendi");
            }

            // 2. Foreground Service'i durdur (arka planda başlatıldıysa)
            if (isAndroidPlatform) {
              try {
                console.log("📱 [Connection] Foreground Service durduruluyor...");
                await stopForegroundServiceStandalone();
              } catch (e) {
                console.log("⚠️ [Connection] Service durdurma hatası (önemsiz):", e);
              }
            }

            // 3. Kısa bekle - sistem stabilize olsun
            await new Promise(r => setTimeout(r, 300));

            // 4. Bağlantıyı yeniden kur
            console.log("🔄 [Connection] Bağlantı yenileniyor...");
            const success = await forceReconnect();
            console.log(`${success ? "✅" : "❌"} [Connection] Reconnect sonucu: ${success}`);
            
          } else {
            // ARKA PLANA GİTTİ
            console.log("⏸️ [Connection] Arka plana gidildi, işlemler başlıyor...");
            
            // 1. Heartbeat'i hemen durdur
            stopHeartbeat();
            
            // 2. Foreground Service başlat (sadece Android)
            if (isAndroidPlatform) {
              console.log("📱 [Connection] Foreground Service başlatılıyor...");
              try {
                // Kısa bekle - state değişimi tamamlansın
                await new Promise(r => setTimeout(r, 100));
                
                const serviceStarted = await startForegroundServiceStandalone({
                  title: "Kelimele",
                  description: "Oyun bağlantısı korunuyor...",
                });

                if (serviceStarted) {
                  console.log("✅ [Connection] Foreground Service başarıyla başladı");

                  // Önceki timeout varsa temizle
                  if (foregroundServiceTimeoutRef.current) {
                    clearTimeout(foregroundServiceTimeoutRef.current);
                  }

                  // 2 dakika sonra otomatik durdur (daha uzun süre)
                  foregroundServiceTimeoutRef.current = setTimeout(async () => {
                    console.log("⏰ [Connection] 2 dakika doldu, servis otomatik kapatılıyor");
                    await stopForegroundServiceStandalone();
                    foregroundServiceTimeoutRef.current = null;
                  }, 120000);
                } else {
                  console.warn("⚠️ [Connection] Foreground Service başlatılamadı");
                }
              } catch (err) {
                console.error("❌ [Connection] Foreground Service hatası:", err);
              }
            }

            // State güncelle - ama bağlantı koptu deme, sadece arka planda olduğumuzu bildir
            // isConnected: false demek UI'da sorun yaratabilir
            console.log("📴 [Connection] Arka plan moduna geçildi");
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
