import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToForegroundState, getIsAppInForeground } from "@/hooks/useAppForegroundState";
import { Network } from "@capacitor/network";
import { Capacitor } from "@capacitor/core";

interface TimeSample {
  offset: number;
  rtt: number;
}

interface ServerTimeContextType {
  offset: number;
  serverNow: () => number;
  isReady: boolean;
  isSyncing: boolean;
  lastSyncAt: number | null;
  triggerResync: () => Promise<number>;
}

const ServerTimeContext = createContext<ServerTimeContextType | null>(null);

export function useServerTimeContext() {
  const context = useContext(ServerTimeContext);
  if (!context) {
    throw new Error("useServerTimeContext must be used within ServerTimeProvider");
  }
  return context;
}

// Global değişkenler - context dışından da erişilebilir
let globalOffset = 0;
let globalIsReady = false;
const offsetListeners = new Set<(offset: number) => void>();

export const getGlobalServerOffset = () => globalOffset;
export const getGlobalServerNow = () => Date.now() + globalOffset;
export const isServerTimeReady = () => globalIsReady;

export const subscribeToOffsetChange = (callback: (offset: number) => void) => {
  offsetListeners.add(callback);
  return () => offsetListeners.delete(callback);
};

const notifyOffsetChange = (newOffset: number) => {
  globalOffset = newOffset;
  offsetListeners.forEach(cb => cb(newOffset));
};

export function ServerTimeProvider({ children }: { children: React.ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  
  const offsetRef = useRef(0);
  const isSyncingRef = useRef(false);
  const lastSyncAtRef = useRef<number | null>(null);
  const isConnectedRef = useRef(true);
  
  // 🆕 AbortController ref - her uyanışta mevcut sync'i iptal etmek için
  const syncAbortControllerRef = useRef<AbortController | null>(null);

  // 🔧 FAILSAFE: Sync kilidini zorla aç
  const forceUnlockSync = useCallback(() => {
    if (isSyncingRef.current) {
      console.log("[ServerTime] ⚠️ FAILSAFE: Sync kilidi zorla açılıyor");
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // 🆕 Mevcut sync'i iptal et
  const abortCurrentSync = useCallback(() => {
    if (syncAbortControllerRef.current) {
      console.log("[ServerTime] 🛑 Mevcut sync iptal ediliyor...");
      syncAbortControllerRef.current.abort();
      syncAbortControllerRef.current = null;
    }
    // Kilidi de aç
    forceUnlockSync();
  }, [forceUnlockSync]);

  // Server time offset hesapla - multiple samples + best RTT selection
  const calculateOffset = useCallback(async (forceReset: boolean = false): Promise<number> => {
    // 🆕 Force reset: mevcut sync'i iptal et ve temiz başla
    if (forceReset) {
      abortCurrentSync();
    }
    
    // Eğer zaten sync yapılıyorsa ve force değilse bekle
    if (isSyncingRef.current && !forceReset) {
      console.log("[ServerTime] ⏳ Sync zaten devam ediyor, atlanıyor...");
      return offsetRef.current;
    }

    // Son sync 5 saniyeden yeniyse atla (çok sık resync önleme)
    const now = Date.now();
    if (!forceReset && lastSyncAtRef.current && (now - lastSyncAtRef.current) < 5000) {
      console.log("[ServerTime] ⏳ Son sync çok yeni, atlanıyor...");
      return offsetRef.current;
    }

    // Yeni AbortController oluştur
    const abortController = new AbortController();
    syncAbortControllerRef.current = abortController;

    isSyncingRef.current = true;
    setIsSyncing(true);

    const samples: TimeSample[] = [];
    // 🎯 NTP tarzı kalibrasyon: çok örnek al, en düşük RTT'li olanı seç.
    // Timeout dolsa bile o ana kadar toplanan örnekler kullanılır (partial sonuç).
    const SAMPLE_COUNT = 7;
    const SAMPLE_GAP_MS = 60;
    const SYNC_TIMEOUT = 3500;
    
    try {
      // Timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Sync timeout')), SYNC_TIMEOUT);
      });
      
      // Abort promise
      const abortPromise = new Promise<never>((_, reject) => {
        abortController.signal.addEventListener('abort', () => {
          reject(new Error('Sync aborted'));
        });
      });
      
      // Sync işlemi
      const syncPromise = (async () => {
        for (let i = 0; i < 3; i++) {
          // Abort edildi mi kontrol et
          if (abortController.signal.aborted) {
            throw new Error('Sync aborted');
          }
          
          const t0 = Date.now();
          
          try {
            const { data: serverTime, error } = await supabase.rpc("get_server_time");
            
            if (error || !serverTime) {
              console.error("[ServerTime] Fetch error:", error);
              continue;
            }
            
            const t3 = Date.now();
            const rtt = t3 - t0;
            
            // RTT kompansasyonlu offset: server time - client time - (rtt/2)
            const calculatedOffset = new Date(serverTime as string).getTime() - t0 - (rtt / 2);
            
            samples.push({ offset: calculatedOffset, rtt });
            
            console.log(`[ServerTime] 📊 Sample ${i + 1}: offset=${calculatedOffset}ms, RTT=${rtt}ms`);
            
            // Bir sample yeterli - hızlı devam et
            if (samples.length >= 1) break;
            
          } catch (err) {
            console.error("[ServerTime] Sample fetch error:", err);
          }
        }
        return samples;
      })();

      // Race: sync vs timeout vs abort
      await Promise.race([syncPromise, timeoutPromise, abortPromise]);
      
    } catch (err: any) {
      // 🔧 QUIET FAILSAFE: Konsola fazla log basma, sessizce devam et
      // Debug için sadece geliştirme ortamında log
      if (process.env.NODE_ENV === 'development') {
        console.debug("[ServerTime] Sync issue:", err?.message);
      }
      
      // Son başarılı offset'i kullan ve devam et (sessizce)
    } finally {
      // CRITICAL: Her durumda syncing flag'ini temizle
      isSyncingRef.current = false;
      setIsSyncing(false);
      syncAbortControllerRef.current = null;
    }
    
    if (samples.length === 0) {
      // 🔧 QUIET FAILSAFE: Sessizce cache offset kullan, UI bekletme
      lastSyncAtRef.current = Date.now();
      setLastSyncAt(Date.now());
      
      // isReady'yi anında true yap
      if (!globalIsReady) {
        setIsReady(true);
        globalIsReady = true;
      }
      
      return offsetRef.current;
    }
    
    // En düşük RTT'ye sahip sample'ı kullan (en güvenilir)
    const bestSample = samples.sort((a, b) => a.rtt - b.rtt)[0];
    const newOffset = bestSample.offset;
    
    // 🔧 QUIET: Sadece development'ta log bas
    if (process.env.NODE_ENV === 'development') {
      const drift = Math.abs(newOffset - offsetRef.current);
      if (drift > 100) {
        console.debug(`[ServerTime] Drift: ${drift}ms`);
      }
      console.debug(`[ServerTime] Synced: offset=${newOffset}ms, RTT=${bestSample.rtt}ms`);
    }
    
    // State ve ref'leri güncelle
    offsetRef.current = newOffset;
    lastSyncAtRef.current = Date.now();
    setOffset(newOffset);
    setLastSyncAt(Date.now());
    setIsReady(true);
    
    // Global değişkenleri güncelle
    globalOffset = newOffset;
    globalIsReady = true;
    notifyOffsetChange(newOffset);
    
    return newOffset;
  }, [abortCurrentSync]);

  // Sunucu zamanını al (her zaman güncel)
  const serverNow = useCallback((): number => {
    return Date.now() + offsetRef.current;
  }, []);

  // Manuel resync trigger
  const triggerResync = useCallback(async (): Promise<number> => {
    console.log("[ServerTime] 🔄 Manual resync triggered");
    return calculateOffset(true); // Force reset
  }, [calculateOffset]);

  // İlk sync
  useEffect(() => {
    console.log("[ServerTime] 🚀 Initial sync starting...");
    calculateOffset(false);
  }, [calculateOffset]);

  // Foreground state değişikliğini dinle
  useEffect(() => {
    const handleForegroundChange = async (inForeground: boolean) => {
      if (inForeground) {
        console.log("[ServerTime] 📱 App returned to foreground - orchestrator bekliyor...");
        // NOT: Artık burada direkt sync yapmıyoruz, orchestrator T+1000ms'de yapacak
      }
    };

    // 🆕 Orchestrator event'ini dinle
    const handleTimeSync = async () => {
      console.log("[ServerTime] 🔄 Orchestrator triggered time sync");
      // Mevcut sync'i iptal et ve yeni başlat
      abortCurrentSync();
      // 🔧 Network warm-up: 300ms bekle (Android WebView ağ ısınması)
      await new Promise(resolve => setTimeout(resolve, 300));
      calculateOffset(true);
    };
    
    window.addEventListener('app-time-sync', handleTimeSync);

    const unsubscribe = subscribeToForegroundState(handleForegroundChange);
    return () => {
      unsubscribe();
      window.removeEventListener('app-time-sync', handleTimeSync);
    };
  }, [calculateOffset, abortCurrentSync]);

  // Network bağlantı değişikliğini dinle
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    
    const handleConnectionChange = async (connected: boolean) => {
      isConnectedRef.current = connected;
      
      if (connected && getIsAppInForeground()) {
        console.log("[ServerTime] 🌐 Connection restored, recalibrating...");
        // Bağlantı kurulduktan sonra biraz bekle
        await new Promise(resolve => setTimeout(resolve, 1000));
        calculateOffset();
      }
    };

    if (isNative) {
      // Native: Capacitor Network plugin
      let listenerHandle: { remove: () => void } | null = null;
      
      Network.addListener("networkStatusChange", (status) => {
        console.log("[ServerTime] Native network status:", status.connected);
        handleConnectionChange(status.connected);
      }).then(handle => {
        listenerHandle = handle;
      });

      // İlk durumu kontrol et
      Network.getStatus().then(status => {
        isConnectedRef.current = status.connected;
      });

      return () => {
        listenerHandle?.remove();
      };
    } else {
      // Web: navigator.onLine + events
      const handleOnline = () => {
        console.log("[ServerTime] Web: online event");
        handleConnectionChange(true);
      };
      
      const handleOffline = () => {
        console.log("[ServerTime] Web: offline event");
        handleConnectionChange(false);
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      
      isConnectedRef.current = navigator.onLine;

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, [calculateOffset]);

  // 🔥 BASİT YAKLAŞIM: app-resumed eventi dinle
  useEffect(() => {
    const handleAppResumed = () => {
      console.log("[ServerTime] 🔌 App resumed - recalibrating...");
      setTimeout(() => {
        calculateOffset();
      }, 300);
    };

    window.addEventListener("app-resumed", handleAppResumed);
    
    return () => {
      window.removeEventListener("app-resumed", handleAppResumed);
    };
  }, [calculateOffset]);

  // Periyodik drift kontrolü (her 60 saniyede bir)
  useEffect(() => {
    const driftCheckInterval = setInterval(() => {
      if (getIsAppInForeground() && isConnectedRef.current) {
        console.log("[ServerTime] 🔄 Periodic drift check...");
        calculateOffset();
      }
    }, 60000);

    return () => clearInterval(driftCheckInterval);
  }, [calculateOffset]);

  const value: ServerTimeContextType = {
    offset,
    serverNow,
    isReady,
    isSyncing,
    lastSyncAt,
    triggerResync,
  };

  return (
    <ServerTimeContext.Provider value={value}>
      {children}
    </ServerTimeContext.Provider>
  );
}
