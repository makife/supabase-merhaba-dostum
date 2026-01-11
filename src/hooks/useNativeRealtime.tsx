import { useEffect, useRef, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import {
  NativeRealtime,
  isNativeRealtimeAvailable,
  RealtimeMessageEvent,
  ConnectionStateEvent,
  SessionRestoredEvent,
} from "@/plugins/NativeRealtime";
import { supabase } from "@/integrations/supabase/client";
import { useAppState } from "@/hooks/useAppState";
import {
  getLastRoomId,
  getLastChatId,
  getLastMatchId,
  addBufferedMessage,
  getBufferedMessages,
  clearBufferedMessages,
  setConnectionState,
} from "@/utils/persistentState";

// Sabitler
const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

// Global listener registry - sayfalar buraya callback ekler
type MessageListener = (topic: string, payload: any) => void;
const messageListeners = new Set<MessageListener>();

export function registerMessageListener(listener: MessageListener) {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

export function useNativeRealtime() {
  const [connectionState, setConnectionStateLocal] = useState<string>("disconnected");
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionsRef = useRef<Map<string, any>>(new Map());
  const foregroundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef(false);
  const isNative = isNativeRealtimeAvailable();

  // 1. Kotlin'den gelen mesajları dinle
  useEffect(() => {
    if (!isNative || !NativeRealtime) return;

    const setupListeners = async () => {
      // 🔥 KRİTİK: sessionRestored eventi - Misafir modundan kurtarma
      await NativeRealtime.addListener("sessionRestored", async (data: any) => {
        console.log("[NativeRealtime] 🔐 SESSION RESTORED eventi alındı!", data);
        
        if (data.restored && data.accessToken) {
          console.log("[NativeRealtime] 🔄 Supabase session yenileniyor...");
          
          try {
            // Mevcut session'ı kontrol et
            const { data: currentSession } = await supabase.auth.getSession();
            
            if (!currentSession?.session) {
              console.log("[NativeRealtime] ⚠️ JS session yok, yeniden auth yapılıyor...");
              
              // Session'ı yenile - bu kullanıcıyı tekrar login yapar
              const { data: refreshData, error } = await supabase.auth.refreshSession();
              
              if (error) {
                console.error("[NativeRealtime] ❌ Session refresh hatası:", error);
                // Hata olursa bile native token'ı kullanmayı dene
                // Native tarafta token varsa, kullanıcı hala giriş yapmış demektir
              } else {
                console.log("[NativeRealtime] ✅ Session başarıyla yenilendi:", refreshData.user?.email);
              }
            } else {
              console.log("[NativeRealtime] ✅ JS session zaten mevcut:", currentSession.session.user.email);
            }
            
            // Session restore olayını tüm uygulamaya bildir
            window.dispatchEvent(new CustomEvent("session-restored-from-native", {
              detail: { accessToken: data.accessToken }
            }));
            
          } catch (e) {
            console.error("[NativeRealtime] ❌ Session restore hatası:", e);
          }
        }
      });

      await NativeRealtime.addListener("realtimeMessage", (data: RealtimeMessageEvent) => {
        console.log("[NativeRealtime] 📨 Mesaj geldi:", data.topic, data.event);
        
        let parsedPayload: any;
        try {
          parsedPayload = JSON.parse(data.payload);
        } catch {
          parsedPayload = data.payload;
        }

        // Tüm kayıtlı listener'lara bildir
        subscriptionsRef.current.forEach((sub) => {
          if (data.topic === sub.topic || data.topic.includes(sub.table || "")) {
            sub.onMessage(parsedPayload);
          }
        });

        // Global listener'lara da bildir (sayfa state enjeksiyonu için)
        messageListeners.forEach((listener) => {
          listener(data.topic, parsedPayload);
        });
      });

      await NativeRealtime.addListener("connectionState", async (data: ConnectionStateEvent) => {
        console.log("[NativeRealtime] 🔌 Connection state:", data.state);
        setConnectionStateLocal(data.state);
        setIsConnected(data.state === "connected");

        // Bağlantı durumunu kalıcı olarak kaydet
        await setConnectionState({
          isConnected: data.state === "connected",
          lastConnectedAt: data.state === "connected" ? Date.now() : 0,
          reconnectAttempts: 0,
        });
      });
    };

    setupListeners();
    // ⚠️ CLEANUP DEVRE DIŞI - Native bağlantı koruması
    // removeAllListeners() tüm native listener'ları kaldırıyor ve bağlantı kopuyordu
    return () => {
      console.log("⚠️ [useNativeRealtime] Cleanup ATLANYOR (bağlantı koruması) - removeAllListeners çağrılmadı");
      // ❌ DEVRE DIŞI: NativeRealtime.removeAllListeners();
    };
  }, [isNative]);

  // 2. Bağlantı Fonksiyonu
  const connect = useCallback(async () => {
    if (!isNative || !NativeRealtime) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const wsUrl = SUPABASE_URL.replace("https://", "wss://") + "/realtime/v1/websocket";

      console.log("[NativeRealtime] 🔌 Kotlin motoru başlatılıyor...");
      await NativeRealtime.connect({
        url: wsUrl,
        apiKey: SUPABASE_ANON_KEY,
        accessToken: session?.access_token || "",
      });
    } catch (e) {
      console.error("[NativeRealtime] Bağlantı hatası:", e);
    }
  }, [isNative]);

  // 🆕 3. AGGRESSIVE RE-SUBSCRIPTION: Ön plana çıkınca zorla yeniden bağlan
  // ⚠️ KRİTİK: Native'de JS Supabase Realtime KULLANILMIYOR - sadece Kotlin WebSocket!
  const forceResubscribe = useCallback(async () => {
    if (isReconnectingRef.current) {
      console.log("[NativeRealtime] ⏸️ Zaten yeniden bağlanıyor, skip...");
      return;
    }

    isReconnectingRef.current = true;
    console.log("[NativeRealtime] 🔄 Aggressive re-subscription başlıyor...");

    try {
      // 🔧 KRİTİK: Native'de JS SDK Realtime KULLANMIYORUZ - Kotlin yönetiyor
      // Sadece Kotlin bağlantısını kontrol et ve yeniden bağlan
      if (isNative && NativeRealtime) {
        console.log("[NativeRealtime] 📡 Kotlin WebSocket kontrol ediliyor...");
        
        // Kotlin bağlantı durumunu kontrol et
        try {
          const stateResult = await NativeRealtime.getConnectionState();
          console.log("[NativeRealtime] 📡 Kotlin state:", stateResult.state);
          
          if (stateResult.state !== "connected") {
            console.log("[NativeRealtime] 🔌 Kotlin bağlantısı kopuk, yeniden bağlanıyor...");
            
            // Token al
            const { data } = await supabase.auth.getSession();
            const wsUrl = SUPABASE_URL.replace("https://", "wss://") + "/realtime/v1/websocket";
            
            await NativeRealtime.connect({
              url: wsUrl,
              apiKey: SUPABASE_ANON_KEY,
              accessToken: data?.session?.access_token || "",
            });
            
            console.log("[NativeRealtime] ✅ Kotlin reconnect çağrıldı");
            
            // Biraz bekle
            await new Promise((r) => setTimeout(r, 500));
          }
        } catch (e) {
          console.log("[NativeRealtime] ⚠️ Kotlin state kontrolü hatası:", e);
        }
        
        // Aktif subscription'ları yeniden subscribe et
        console.log("[NativeRealtime] 📋 Aktif subscription sayısı:", subscriptionsRef.current.size);
        subscriptionsRef.current.forEach(async (sub, key) => {
          console.log("[NativeRealtime] 🔄 Re-subscribing:", key);
          try {
            await NativeRealtime.subscribe({
              topic: sub.topic,
              event: sub.event || "*",
              schema: sub.schema || "public",
              table: sub.table,
              filter: sub.filter,
            });
          } catch (e) {
            console.log("[NativeRealtime] ⚠️ Re-subscribe hatası:", key, e);
          }
        });
      }

      // Native Storage'dan son aktif kanalları oku
      const [lastRoomId, lastChatId, lastMatchId] = await Promise.all([
        getLastRoomId(),
        getLastChatId(),
        getLastMatchId(),
      ]);

      console.log("[NativeRealtime] 📖 Cached IDs:", { lastRoomId, lastChatId, lastMatchId });

      // 🆕 4. CHANNEL BUFFERING: Arka planda biriken mesajları enjekte et
      const bufferedMessages = await getBufferedMessages();
      if (bufferedMessages.length > 0) {
        console.log("[NativeRealtime] 📦 Buffered mesajlar enjekte ediliyor:", bufferedMessages.length);
        
        for (const msg of bufferedMessages) {
          messageListeners.forEach((listener) => {
            listener(msg.topic, msg.payload);
          });
        }

        await clearBufferedMessages();
      }
    } catch (e) {
      console.error("[NativeRealtime] Force resubscribe hatası:", e);
    } finally {
      isReconnectingRef.current = false;
    }
  }, [isNative]);

  // 5. ARKA PLAN YÖNETİMİ
  // ⚠️ KRİTİK: Native bağlantıyı ASLA kesme! Kotlin WebSocket arka planda çalışmaya devam eder.
  useAppState({
    onBackground: () => {
      console.log("📱 [useNativeRealtime] Arka plana geçildi. Native bağlantı KORUNUYOR.");
      // Native bağlantıyı KESMİYORUZ - Kotlin Foreground Service devam ediyor
      // Sadece log tutuyoruz
    },
    onForeground: async () => {
      console.log("▶️ [useNativeRealtime] Ön plana gelindi.");
      
      // Eğer eski bir timer varsa temizle (artık kullanılmıyor ama güvenlik için)
      if (foregroundTimerRef.current) {
        clearTimeout(foregroundTimerRef.current);
        foregroundTimerRef.current = null;
      }

      // 🆕 AGGRESSIVE RE-SUBSCRIPTION: JS kanallarını zorla yeniden bağla
      console.log("▶️ [useNativeRealtime] Foreground - aggressive re-subscription tetikleniyor...");
      await forceResubscribe();
    },
  });

  // 6. Diğer yardımcı fonksiyonlar
  // ⚠️ Subscribe fonksiyonu - unsubscribe DEVRE DIŞI
  const subscribe = useCallback(
    (options: any) => {
      const key = `${options.topic}:${options.table}`;
      subscriptionsRef.current.set(key, options);
      if (isNative) NativeRealtime?.subscribe(options);
      // ⚠️ CLEANUP DEVRE DIŞI - unsubscribe bağlantıyı öldürüyordu
      return () => {
        console.log(`⚠️ [useNativeRealtime] Unsubscribe ATLANYOR: ${options.topic} (bağlantı koruması)`);
        // subscriptionsRef.current.delete(key); // Map'ten de silmeyelim - referans kaybolmasın
        // ❌ DEVRE DIŞI: if (isNative) NativeRealtime?.unsubscribe({ topic: options.topic });
      };
    },
    [isNative],
  );

  const broadcast = useCallback(
    async (topic: string, event: string, payload: any) => {
      if (isNative) {
        await NativeRealtime?.broadcast({ topic, event, payload: JSON.stringify(payload) });
      }
    },
    [isNative],
  );

  return { 
    isNative, 
    connectionState, 
    isConnected, 
    connect, 
    subscribe, 
    broadcast,
    forceResubscribe // Export et ki diğer yerlerden de çağrılabilsin
  };
}
