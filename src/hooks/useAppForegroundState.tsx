import { useState, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { startForegroundServiceStandalone, stopForegroundServiceStandalone } from "@/hooks/useForegroundService";

// Global durum takibi
(window as any).__appForegroundTime = Date.now();
let killSwitchInterval: any = null;
let isAppInForeground = true;

const setForegroundState = async (inForeground: boolean) => {
  isAppInForeground = inForeground;

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
    if (inForeground) {
      // 🛡️ ÖN PLAN: Zırhı tazele ve Kill-Switch başlat
      (window as any).__appForegroundTime = Date.now();
      console.log("[FS-Guardian] 📱 Ön plan: Kill-Switch aktif.");

      // Varsa eski interval'i temizle
      if (killSwitchInterval) clearInterval(killSwitchInterval);

      // İlk durdurma emrini hemen gönder
      stopForegroundServiceStandalone().catch(() => {});

      // Ön planda olduğun sürece her 5 saniyede bir durdurmaya zorla!
      killSwitchInterval = setInterval(() => {
        if (isAppInForeground) {
          console.log("[FS-Guardian] 👊 Nöbetçi: FS zorla durduruluyor...");
          stopForegroundServiceStandalone().catch(() => {});
        }
      }, 5000);
    } else {
      // 🔙 ARKA PLAN: Kill-switch'i HEMEN imha et (Servisi öldürmesin)
      if (killSwitchInterval) {
        clearInterval(killSwitchInterval);
        killSwitchInterval = null;
      }

      console.log("[FS-Guardian] 🔙 Arka plan: Servis başlatılıyor (max 60s)");
      startForegroundServiceStandalone({
        title: "Kelimele",
        description: "🎮 Oyun bağlantısı korunuyor...",
        maxDurationMs: 60000,
      }).catch(() => {});
    }
  }

  if (inForeground) {
    window.dispatchEvent(new CustomEvent("supabase-reconnected"));
  }
};

export const getIsAppInForeground = () => isAppInForeground;

export function useAppForegroundState() {
  const [isInForeground, setIsInForeground] = useState(true);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    const initializeListeners = async () => {
      if (isNative) {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("appStateChange", ({ isActive }) => {
          setIsInForeground(isActive);
          setForegroundState(isActive);
        });
        return () => listener.remove();
      }
    };

    let cleanup: any;
    initializeListeners().then((fn) => (cleanup = fn));
    return () => cleanup?.();
  }, [isNative]);

  return { isInForeground, isNative };
}
