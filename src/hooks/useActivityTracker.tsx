import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { App } from "@capacitor/app";
import { matchmakingMode } from "@/utils/matchmakingMode";

/**
 * Push bildirimi alındığında heartbeat'i geçici olarak bastırmak için
 * global bir mekanizma. useMobileNotifications'tan tetiklenir.
 */
let pushSuppressUntil = 0;

export function suppressActivityForPush(durationMs = 15000) {
  pushSuppressUntil = Date.now() + durationMs;
  console.log(`⏸️ ActivityTracker: Push suppression aktif (${durationMs}ms)`);
}

function isPushSuppressed(): boolean {
  return Date.now() < pushSuppressUntil;
}

export function useActivityTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async () => {
      // Push suppression aktifse güncelleme yapma
      if (isPushSuppressed()) {
        console.log("⏭️ ActivityTracker: Push suppression aktif, heartbeat atlanıyor");
        return;
      }

      // 🚀 Matchmaking aktifken heartbeat atla
      if (matchmakingMode.isActive()) {
        return;
      }

      try {
        const now = new Date().toISOString();

        await supabase.from("profiles").update({ last_seen: now }).eq("id", user.id);

        await supabase
          .from("user_presence")
          .upsert({ user_id: user.id, is_online: true, last_seen: now }, { onConflict: "user_id" });

        console.log("💓 Heartbeat sent (last_seen + presence updated)");
      } catch (error) {
        console.error("Error updating last_seen:", error);
      }
    };

    // İlk güncelleme - sadece gerçekten foreground'daysa
    if (document.visibilityState === "visible" && document.hasFocus() && !isPushSuppressed()) {
      updateLastSeen();
    } else {
      console.log("⏭️ ActivityTracker: İlk mount'ta push wake algılandı, online güncelleme atlanıyor");
    }

    // Her 45 saniyede bir heartbeat - sadece uygulama görünür VE odaklıysa (optimize edildi, eskisi 20s idi)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        updateLastSeen();
      }
    }, 45000);

    // Capacitor App state listener
    const appStateListenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        setTimeout(() => {
          const isVisible = document.visibilityState === "visible";
          const hasFocus = document.hasFocus();
          if (isVisible && hasFocus && !isPushSuppressed()) {
            updateLastSeen();
          } else {
            console.log(`⏭️ ActivityTracker: Push wake algılandı (visible=${isVisible}, focus=${hasFocus}, suppressed=${isPushSuppressed()}), online güncelleme atlanıyor`);
          }
        }, 1500);
      }
    });

    return () => {
      clearInterval(interval);
      appStateListenerPromise.then((l) => l.remove());
    };
  }, [user]);
}
