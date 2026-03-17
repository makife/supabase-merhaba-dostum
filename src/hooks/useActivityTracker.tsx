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

        // 🔥 BASİT: Sadece last_seen güncelle, is_online flag'i artık kullanılmıyor
        await supabase.from("profiles").update({ last_seen: now }).eq("id", user.id);

        await supabase
          .from("user_presence")
          .upsert({ user_id: user.id, last_seen: now, is_online: true }, { onConflict: "user_id" });

        console.log("💓 Heartbeat sent (last_seen updated)");
      } catch (error) {
        console.error("Error updating last_seen:", error);
      }
    };

    // 🔥 setOffline KALDIRILDI — artık is_online flag'ine bağımlı değiliz
    // Kullanıcı arka plana geçince heartbeat duracak, last_seen eskiyecek = otomatik offline

    // İlk güncelleme - sadece gerçekten foreground'daysa
    if (document.visibilityState === "visible" && !isPushSuppressed()) {
      updateLastSeen();
    } else {
      console.log("⏭️ ActivityTracker: İlk mount'ta push wake algılandı, online güncelleme atlanıyor");
    }

    // 🔥 OAuth (Google/Apple) girişi sonrası presence'ı zorla güncelle
    const handleForcePresence = (e: Event) => {
      console.log("🟢 ActivityTracker: force-presence-update alındı, online yapılıyor");
      updateLastSeen();
    };
    window.addEventListener("force-presence-update", handleForcePresence);

    // Her 45 saniyede bir heartbeat - sadece uygulama görünür VE odaklıysa (optimize edildi, eskisi 20s idi)
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        updateLastSeen();
      }
    }, 45000);

    // 🔥 Visibility change: öne gelince heartbeat, arka plana geçince bir şey yapma
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isPushSuppressed()) {
        updateLastSeen();
      }
      // arka plana geçince setOffline ÇAĞRILMIYOR — heartbeat duracak, last_seen eskiyecek
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Capacitor App state listener
    const appStateListenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        if (isPushSuppressed()) {
          console.log(`⏭️ ActivityTracker: Push wake algılandı, online güncelleme atlanıyor`);
          return;
        }
        console.log("🟢 ActivityTracker: App active → heartbeat gönderiliyor");
        updateLastSeen();
      }
      // isActive === false → bir şey yapma, heartbeat duracak, last_seen eskiyecek
    });

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("force-presence-update", handleForcePresence);
      appStateListenerPromise.then((l) => l.remove());
    };
  }, [user]);
}
