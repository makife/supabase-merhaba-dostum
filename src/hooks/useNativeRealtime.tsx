import { useEffect, useRef, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import {
  NativeRealtime,
  isNativeRealtimeAvailable,
  RealtimeMessageEvent,
  ConnectionStateEvent,
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
  const forceResubscribe = useCallback(async () => {
    if (isReconnectingRef.current) {
      console.log("[NativeRealtime] ⏸️ Zaten yeniden bağlanıyor, skip...");
      return;
    }

    isReconnectingRef.current = true;
    console.log("[NativeRealtime] 🔄 Aggressive re-subscription başlıyor...");

    try {
      // 🔧 KRİTİK: ÖNCELİKLE JS SDK bağlantısını kontrol et ve yeniden bağlan
      const realtimeState = (supabase.realtime as any).connectionState?.();
      console.log("[NativeRealtime] 📡 JS SDK Realtime state:", realtimeState);
      
      if (realtimeState !== "open" && realtimeState !== "connecting") {
        console.log("[NativeRealtime] 🔌 JS SDK bağlantısı kopuk, yeniden bağlanıyor...");
        
        // Token yenile
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            supabase.realtime.setAuth(data.session.access_token);
            console.log("[NativeRealtime] ✅ Token ayarlandı");
          }
        } catch (e) {
          console.log("[NativeRealtime] ⚠️ Token yenileme atlandı:", e);
        }
        
        // Bağlan
        try {
          (supabase.realtime as any).connect?.();
          console.log("[NativeRealtime] ✅ Connect çağrıldı");
        } catch (e) {
          console.log("[NativeRealtime] ⚠️ Connect hatası:", e);
        }
        
        // Biraz bekle
        await new Promise((r) => setTimeout(r, 500));
      }

      // Native Storage'dan son aktif kanalları oku
      const [lastRoomId, lastChatId, lastMatchId] = await Promise.all([
        getLastRoomId(),
        getLastChatId(),
        getLastMatchId(),
      ]);

      console.log("[NativeRealtime] 📖 Cached IDs:", { lastRoomId, lastChatId, lastMatchId });

      // Supabase realtime bağlantısını kontrol et
      const channels = supabase.getChannels();
      const closedChannels = channels.filter(
        (ch) => ch.state === "closed" || ch.state === "errored"
      );

      if (closedChannels.length > 0) {
        console.log("[NativeRealtime] ⚠️ Kapalı kanallar bulundu:", closedChannels.length);

        // Her kapalı kanalı zorla yeniden aç
        for (const channel of closedChannels) {
          console.log("[NativeRealtime] 🔄 Force subscribing:", channel.topic);
          channel.subscribe();
        }
      }

      // Eğer aktif room varsa ve kanalı yoksa, yeni kanal oluştur
      if (lastRoomId) {
        const roomChannelExists = channels.some((ch) => ch.topic.includes(lastRoomId));
        if (!roomChannelExists) {
          console.log("[NativeRealtime] 🆕 Room kanalı yok, oluşturuluyor:", lastRoomId);
          const roomChannel = supabase
            .channel(`room-recovery-${lastRoomId}`)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "game_rooms", filter: `id=eq.${lastRoomId}` },
              (payload) => {
                console.log("[NativeRealtime] 🎮 Room update (recovery):", payload);
                messageListeners.forEach((l) => l(`room:${lastRoomId}`, payload));
              }
            )
            .subscribe();
        }
      }

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
  }, []);

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
