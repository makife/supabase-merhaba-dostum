import { useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import NativeRealtime from "@/services/nativeRealtimeService";
import { useAppState } from "@/hooks/useAppState";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://nnlvtqmuwmrqfinsgvwc.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubHZ0cW11d21ycWZpbnNndndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MTUzODAsImV4cCI6MjA3MDA5MTM4MH0.MrN6Cgs-uTHg9MF_zfae31VXAj6lTI6V9gdEFZBMvVE";

export function useNativeRealtime() {
  const isNative = Capacitor.isNativePlatform();
  const foregroundTimerRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    if (!isNative) return;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const wsUrl = SUPABASE_URL.replace("https://", "wss://") + "/realtime/v1/websocket";

      console.log("[NativeRealtime] 🔌 Native bağlantı başlatılıyor...");
      await NativeRealtime.connect({
        url: wsUrl,
        apiKey: SUPABASE_ANON_KEY,
        accessToken: session?.access_token || "",
      });
    } catch (e) {
      console.error("[NativeRealtime] ❌ Bağlantı hatası:", e);
    }
  }, [isNative]);

  // İŞTE SENİN İSTEDİĞİN 1 DAKİKA MANTIĞI:
  useAppState({
    onBackground: () => {
      console.log("📱 Arka plana geçildi, 60 saniyelik ömür başladı...");
      foregroundTimerRef.current = setTimeout(async () => {
        console.log("⏰ 1 dakika doldu, native servis kapatılıyor.");
        await NativeRealtime.disconnect(); // Kotlin tarafındaki servisi ve WebSocket'i durdurur
        foregroundTimerRef.current = null;
      }, 60000); // 60.000 ms = 1 dakika
    },
    onForeground: () => {
      if (foregroundTimerRef.current) {
        clearTimeout(foregroundTimerRef.current);
        console.log("▶️ Uygulama öne geldi, sayaç iptal edildi. Bağlantı devam ediyor.");
      }
    },
  });

  return { connect, isNative };
}
