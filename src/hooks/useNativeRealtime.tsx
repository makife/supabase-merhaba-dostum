import { useEffect, useRef, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import {
  NativeRealtime,
  isNativeRealtimeAvailable,
  RealtimeMessageEvent,
  ConnectionStateEvent,
} from "@/plugins/NativeRealtime"; // Buradaki yolu kontrol et, plugins içindeydi
import { supabase } from "@/integrations/supabase/client";
import { useAppState } from "@/hooks/useAppState";

// Sabitler
const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";
const BACKGROUND_LIMIT = 60 * 1000; // 1 Dakika

export function useNativeRealtime() {
  const [connectionState, setConnectionState] = useState<string>("disconnected");
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionsRef = useRef<Map<string, any>>(new Map());
  const foregroundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isNative = isNativeRealtimeAvailable();

  // 1. Kotlin'den gelen mesajları dinle
  useEffect(() => {
    if (!isNative || !NativeRealtime) return;

    const setupListeners = async () => {
      await NativeRealtime.addListener("realtimeMessage", (data: RealtimeMessageEvent) => {
        subscriptionsRef.current.forEach((sub) => {
          if (data.topic === sub.topic || data.topic.includes(sub.table || "")) {
            try {
              sub.onMessage(JSON.parse(data.payload));
            } catch (e) {
              sub.onMessage(data.payload);
            }
          }
        });
      });

      await NativeRealtime.addListener("connectionState", (data: ConnectionStateEvent) => {
        setConnectionState(data.state);
        setIsConnected(data.state === "connected");
      });
    };

    setupListeners();
    return () => {
      NativeRealtime.removeAllListeners();
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

  // 3. ARKA PLAN YÖNETİMİ (1 DAKİKA KURALI)
  useAppState({
    onBackground: () => {
      console.log("📱 Arka plana geçildi. 60 saniyelik geri sayım başladı...");
      // 1 dakika sonra fişi çeken sayaç
      foregroundTimerRef.current = setTimeout(async () => {
        console.log("⏰ 1 dakika doldu. Arka planda pil tüketmemek için bağlantı kesiliyor.");
        await NativeRealtime?.disconnect();
        foregroundTimerRef.current = null;
      }, BACKGROUND_LIMIT);
    },
    onForeground: () => {
      // Eğer 1 dakika dolmadan geri gelirse sayacı iptal et
      if (foregroundTimerRef.current) {
        clearTimeout(foregroundTimerRef.current);
        foregroundTimerRef.current = null;
        console.log("▶️ Oyuncu geri geldi, sayaç durduruldu. Bağlantı devam ediyor.");
      }
    },
  });

  // 4. Diğer yardımcı fonksiyonlar
  const subscribe = useCallback(
    (options: any) => {
      const key = `${options.topic}:${options.table}`;
      subscriptionsRef.current.set(key, options);
      if (isNative) NativeRealtime?.subscribe(options);
      return () => {
        subscriptionsRef.current.delete(key);
        if (isNative) NativeRealtime?.unsubscribe({ topic: options.topic });
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

  return { isNative, connectionState, isConnected, connect, subscribe, broadcast };
}
