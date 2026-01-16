import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * 🔥 Silent Push Notification ile Arka Plan Keep-Alive
 * 
 * Uygulama arka plana gittiğinde:
 * 1. Her 30 saniyede bir silent push notification gönderilir
 * 2. Toplam 4 bildirim (120 saniye) boyunca uygulama canlı tutulur
 * 3. 120 saniye sonra sistem verileri korumayı bırakır
 * 
 * Uygulama ön plana geldiğinde:
 * - Silent push gönderimi iptal edilir
 */

const KEEPALIVE_INTERVAL_MS = 30000; // 30 saniye
const MAX_KEEPALIVE_COUNT = 4; // Toplam 4 bildirim = 120 saniye

export const useBackgroundKeepAlive = () => {
  const { user } = useAuth();
  const isNative = Capacitor.isNativePlatform();
  
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const keepAliveCountRef = useRef(0);
  const isBackgroundRef = useRef(false);

  // Silent push gönder
  const sendSilentKeepAlive = useCallback(async () => {
    if (!user?.id) {
      console.log("[KeepAlive] ⏭️ User yok, skip");
      return;
    }

    try {
      console.log(`[KeepAlive] 📤 Silent push gönderiliyor... (${keepAliveCountRef.current + 1}/${MAX_KEEPALIVE_COUNT})`);
      
      const { error } = await supabase.functions.invoke("send-silent-keepalive", {
        body: { userId: user.id },
      });

      if (error) {
        console.warn("[KeepAlive] ⚠️ Silent push hatası:", error.message);
      } else {
        console.log("[KeepAlive] ✅ Silent push gönderildi");
      }
    } catch (e) {
      console.warn("[KeepAlive] ⚠️ Silent push exception:", e);
    }
  }, [user?.id]);

  // Keep-alive döngüsünü başlat
  const startKeepAlive = useCallback(() => {
    if (!isNative || !user?.id) return;
    
    // Zaten çalışıyorsa başlatma
    if (keepAliveIntervalRef.current) {
      console.log("[KeepAlive] ⏭️ Zaten çalışıyor");
      return;
    }

    console.log("[KeepAlive] 🚀 Başlatılıyor (30s aralıklarla, max 4 kez)");
    
    keepAliveCountRef.current = 0;
    isBackgroundRef.current = true;

    // İlk bildirimi hemen gönder
    sendSilentKeepAlive();
    keepAliveCountRef.current = 1;

    // Sonraki bildirimleri 30 saniye aralıklarla gönder
    keepAliveIntervalRef.current = setInterval(() => {
      if (keepAliveCountRef.current >= MAX_KEEPALIVE_COUNT) {
        console.log("[KeepAlive] ⏹️ 120 saniye doldu, durduruluyor");
        stopKeepAlive();
        return;
      }

      sendSilentKeepAlive();
      keepAliveCountRef.current++;
    }, KEEPALIVE_INTERVAL_MS);
  }, [isNative, user?.id, sendSilentKeepAlive]);

  // Keep-alive döngüsünü durdur
  const stopKeepAlive = useCallback(() => {
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
      console.log("[KeepAlive] ⏹️ Durduruldu");
    }
    keepAliveCountRef.current = 0;
    isBackgroundRef.current = false;
  }, []);

  // App state değişikliklerini dinle
  useEffect(() => {
    if (!isNative) return;

    let removeListener: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          console.log(`[KeepAlive] 📱 App state: ${isActive ? "FOREGROUND" : "BACKGROUND"}`);

          if (isActive) {
            // Ön plana geldi - keep-alive durdur
            stopKeepAlive();
          } else {
            // Arka plana geçti - keep-alive başlat
            startKeepAlive();
          }
        });

        removeListener = () => handle.remove();
        console.log("[KeepAlive] ✅ App state listener kuruldu");
      } catch (e) {
        console.warn("[KeepAlive] ⚠️ App state listener kurulamadı:", e);
      }
    };

    setupListener();

    return () => {
      removeListener?.();
      stopKeepAlive();
    };
  }, [isNative, startKeepAlive, stopKeepAlive]);

  return {
    isActive: !isBackgroundRef.current,
    startKeepAlive,
    stopKeepAlive,
  };
};
