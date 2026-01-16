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
import { setConnectionState } from "@/utils/persistentState";

// Sabitler
const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

// Global listener registry - sayfalar buraya callback ekler
type MessageListener = (topic: string, payload: any) => void;
const messageListeners = new Set<MessageListener>();

// 🆕 GLOBAL SUBSCRIPTION REGISTRY - Component unmount olsa bile korunur
interface SubscriptionInfo {
  topic: string;
  table?: string;
  schema?: string;
  event?: string;
  filter?: string;
  onMessage: (payload: any) => void;
}
const globalSubscriptions = new Map<string, SubscriptionInfo>();
let isListenerSetup = false;
let isReconnecting = false;

export function registerMessageListener(listener: MessageListener) {
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

// 🆕 Global subscription ekle + HEMEN Kotlin'e kaydet
export async function addGlobalSubscription(key: string, info: SubscriptionInfo) {
  globalSubscriptions.set(key, info);
  console.log(`[NativeRealtime] 📝 Global subscription eklendi: ${key}, toplam: ${globalSubscriptions.size}`);
  
  // 🔥 HEMEN Kotlin WebSocket'e de kaydet
  if (isNativeRealtimeAvailable() && NativeRealtime) {
    try {
      console.log(`[NativeRealtime] 🔌 Kotlin'e subscribe ediliyor: ${key}`);
      await NativeRealtime.subscribe({
        topic: info.topic,
        event: info.event || "*",
        schema: info.schema || "public",
        table: info.table,
        filter: info.filter,
      });
      console.log(`[NativeRealtime] ✅ Kotlin subscribe başarılı: ${key}`);
    } catch (e) {
      console.log(`[NativeRealtime] ⚠️ Kotlin subscribe hatası: ${key}`, e);
    }
  }
}

// 🆕 Global subscription sil
export function removeGlobalSubscription(key: string) {
  globalSubscriptions.delete(key);
  console.log(`[NativeRealtime] 🗑️ Global subscription silindi: ${key}, kalan: ${globalSubscriptions.size}`);
}

// 🆕 JS uyanınca Kotlin'den buffered mesajları ÇEK (PULL model)
// JS uyurken Kotlin mesaj gönderemez, JS aktif olarak çekmeli!
async function pullBufferedMessages() {
  if (!isNativeRealtimeAvailable() || !NativeRealtime) return;
  
  try {
    const result = await NativeRealtime.getBufferedMessages();
    
    if (result.count > 0) {
      console.log(`[NativeRealtime] 📬 ${result.count} buffered mesaj çekildi (PULL)`);
      
      // Her mesajı listener'lara ilet
      result.messages.forEach((msg) => {
        console.log(`[NativeRealtime] 📨 Buffered mesaj işleniyor: ${msg.topic} / ${msg.event}`);
        
        let parsedPayload: any;
        try {
          parsedPayload = JSON.parse(msg.payload);
        } catch {
          parsedPayload = msg.payload;
        }
        
        // Global subscription callback'lerini çağır
        globalSubscriptions.forEach((sub) => {
          if (msg.topic === sub.topic || msg.topic.includes(sub.table || "")) {
            sub.onMessage(parsedPayload);
          }
        });
        
        // Eski listener'ları da çağır (geriye uyumluluk)
        messageListeners.forEach((listener) => {
          listener(msg.topic, parsedPayload);
        });
      });
    } else {
      console.log("[NativeRealtime] 📭 Buffer boş, yeni mesaj yok");
    }
  } catch (e) {
    console.error("[NativeRealtime] ❌ Buffer çekme hatası:", e);
  }
}

// 🆕 Tüm subscription'ları yeniden oluştur (foreground'a dönüşte çağrılır)
// PULL MODEL: Önce buffered mesajları çek, sonra bağlantı kontrolü yap
export async function resubscribeAllChannels() {
  if (!isNativeRealtimeAvailable() || !NativeRealtime) return;
  
  if (isReconnecting) {
    console.log("[NativeRealtime] ⏸️ Zaten yeniden bağlanıyor, skip...");
    return;
  }
  
  isReconnecting = true;
  console.log(`[NativeRealtime] 🔄 JS uyandı! Foreground sync başlıyor...`);
  
  try {
    // 🔥 ÖNCE: Kotlin'den buffered mesajları ÇEK (PULL model)
    await pullBufferedMessages();
    
    // Token al
    const { data } = await supabase.auth.getSession();
    if (!data?.session?.access_token) {
      console.log("[NativeRealtime] ⚠️ Session yok, sync atlanıyor");
      return;
    }
    
    // Kotlin bağlantı durumunu kontrol et
    const stateResult = await NativeRealtime.getConnectionState();
    console.log("[NativeRealtime] 📡 Kotlin state:", stateResult.state);
    
    if (stateResult.state !== "connected") {
      console.log("[NativeRealtime] 🔌 Kotlin bağlantısı kopuk, yeniden bağlanıyor...");
      const wsUrl = SUPABASE_URL.replace("https://", "wss://") + "/realtime/v1/websocket";
      
      await NativeRealtime.connect({
        url: wsUrl,
        apiKey: SUPABASE_ANON_KEY,
        accessToken: data.session.access_token,
      });
      
      // Bağlantı kurulmasını bekle
      await new Promise((r) => setTimeout(r, 800));
      
      // Yeniden bağlandıysak subscription'ları da yenile
      for (const [key, sub] of globalSubscriptions.entries()) {
        console.log(`[NativeRealtime] 🔄 Re-subscribing (reconnect): ${key}`);
        try {
          await NativeRealtime.subscribe({
            topic: sub.topic,
            event: sub.event || "*",
            schema: sub.schema || "public",
            table: sub.table,
            filter: sub.filter,
          });
          console.log(`[NativeRealtime] ✅ Re-subscribed: ${key}`);
        } catch (e) {
          console.log(`[NativeRealtime] ⚠️ Re-subscribe hatası: ${key}`, e);
        }
      }
    }
    
    // Token'ı güncelle
    await NativeRealtime.setAccessToken({ token: data.session.access_token });
    console.log("[NativeRealtime] 🔑 Token güncellendi");
    
    console.log(`[NativeRealtime] ✅ Foreground sync tamamlandı, ${globalSubscriptions.size} kanal aktif`);
    
  } catch (e) {
    console.error("[NativeRealtime] ❌ Foreground sync hatası:", e);
  } finally {
    isReconnecting = false;
  }
}

// 🆕 Global listener setup (bir kez çağrılır)
function setupGlobalListeners() {
  if (isListenerSetup || !isNativeRealtimeAvailable() || !NativeRealtime) return;
  
  isListenerSetup = true;
  console.log("[NativeRealtime] 🎯 Global listener'lar kuruluyor...");
  
  // 🔥 KOTLIN WAKE-UP EVENT - Kotlin JS'i uyandırdığında bu çalışır!
  window.addEventListener("kotlin-wake-up", async (e: any) => {
    const bufferedCount = e.detail?.bufferedMessages || 0;
    console.log(`[NativeRealtime] 🔔 KOTLIN WAKE-UP! Buffer'da ${bufferedCount} mesaj`);
    
    // Hemen buffered mesajları çek
    await pullBufferedMessages();
  });
  
  NativeRealtime.addListener("realtimeMessage", (data: RealtimeMessageEvent) => {
    console.log("[NativeRealtime] 📨 Mesaj geldi:", data.topic, data.event);
    
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(data.payload);
    } catch {
      parsedPayload = data.payload;
    }
    
    // Global subscription callback'lerini çağır
    globalSubscriptions.forEach((sub) => {
      if (data.topic === sub.topic || data.topic.includes(sub.table || "")) {
        sub.onMessage(parsedPayload);
      }
    });
    
    // Eski listener'ları da çağır (geriye uyumluluk)
    messageListeners.forEach((listener) => {
      listener(data.topic, parsedPayload);
    });
  });
  
  NativeRealtime.addListener("connectionState", async (data: ConnectionStateEvent) => {
    console.log("[NativeRealtime] 🔌 Connection state:", data.state);
    
    // Dispatch event for components
    window.dispatchEvent(new CustomEvent("native-realtime-state", { 
      detail: { state: data.state, isConnected: data.state === "connected" } 
    }));
    
    // Bağlantı durumunu kaydet
    await setConnectionState({
      isConnected: data.state === "connected",
      lastConnectedAt: data.state === "connected" ? Date.now() : 0,
      reconnectAttempts: 0,
    });
  });
  
  console.log("[NativeRealtime] ✅ Global listener'lar kuruldu (kotlin-wake-up dahil)");
}

export function useNativeRealtime() {
  const [connectionState, setConnectionStateLocal] = useState<string>("disconnected");
  const [isConnected, setIsConnected] = useState(false);
  const foregroundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isNative = isNativeRealtimeAvailable();

  // 1. Global listener'ları kur (sadece bir kez)
  useEffect(() => {
    if (!isNative) return;
    setupGlobalListeners();
    
    // Connection state event listener
    const handleStateChange = (e: CustomEvent) => {
      setConnectionStateLocal(e.detail.state);
      setIsConnected(e.detail.isConnected);
    };
    
    window.addEventListener("native-realtime-state", handleStateChange as EventListener);
    
    return () => {
      window.removeEventListener("native-realtime-state", handleStateChange as EventListener);
    };
  }, [isNative]);

  // 2. Bağlantı Fonksiyonu
  const connect = useCallback(async () => {
    if (!isNative || !NativeRealtime) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
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

  // 3. ARKA PLAN YÖNETİMİ
  useAppState({
    onBackground: () => {
      console.log("📱 [useNativeRealtime] Arka plana geçildi. Native bağlantı KORUNUYOR.");
    },
    onForeground: async () => {
      console.log("▶️ [useNativeRealtime] Ön plana gelindi.");
      
      if (foregroundTimerRef.current) {
        clearTimeout(foregroundTimerRef.current);
        foregroundTimerRef.current = null;
      }

      // Aggressive re-subscription
      console.log("▶️ [useNativeRealtime] Foreground - aggressive re-subscription tetikleniyor...");
      await resubscribeAllChannels();
    },
  });

  // 4. Subscribe fonksiyonu - GLOBAL REGISTRY'ye kaydeder
  const subscribe = useCallback(
    (options: SubscriptionInfo & { topic: string }) => {
      const key = `${options.topic}:${options.table || 'broadcast'}`;
      
      // Global registry'ye ekle
      addGlobalSubscription(key, options);
      
      // Hemen Kotlin'e de kaydet
      if (isNative && NativeRealtime) {
        NativeRealtime.subscribe({
          topic: options.topic,
          event: options.event || "*",
          schema: options.schema || "public",
          table: options.table,
          filter: options.filter,
        }).catch(e => console.log("[NativeRealtime] Subscribe hatası:", e));
      }
      
      // Cleanup - subscription'ı kaldırma (bağlantı koruması)
      return () => {
        console.log(`⚠️ [useNativeRealtime] Unsubscribe ATLANYOR: ${options.topic} (bağlantı koruması)`);
        // NOT: Global registry'den silmiyoruz çünkü foreground'da lazım olacak
        // Sadece component unmount olduğunda callback artık çalışmayacak
        // Ama yeni component mount olduğunda yeni callback ile güncellenecek
      };
    },
    [isNative],
  );

  const broadcast = useCallback(
    async (topic: string, event: string, payload: any) => {
      if (isNative && NativeRealtime) {
        await NativeRealtime.broadcast({ topic, event, payload: JSON.stringify(payload) });
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
    forceResubscribe: resubscribeAllChannels
  };
}
