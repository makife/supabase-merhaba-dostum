import { useEffect } from "react";
import { useLocation } from "react-router-dom";
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

function isActiveGameRoute(pathname: string): boolean {
  return pathname === "/game" || pathname.startsWith("/game/") || pathname.startsWith("/tournament/game/");
}

export function useActivityTracker() {
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return;

    const currentlyInGame = isActiveGameRoute(location.pathname);

    const updateLastSeen = async () => {
      // Push suppression aktifse güncelleme yapma
      if (isPushSuppressed()) {
        console.log("⏭️ ActivityTracker: Push suppression aktif, heartbeat atlanıyor");
        return;
      }

      // 🚀 Matchmaking aktifken heartbeat atla, ama oyun rotasındaysa in_game mutlaka güncellensin
      if (matchmakingMode.isActive() && !currentlyInGame) {
        return;
      }

      try {
        const now = new Date().toISOString();

        // 🔥 Route tabanlı oyun durumu: /game/* veya /tournament/game/* açıkken mavi nokta için in_game=true
        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update({ last_seen: now, in_game: currentlyInGame })
          .eq("id", user.id);
        if (profileUpdateError) throw profileUpdateError;

        await supabase
          .from("user_presence")
          .upsert({ user_id: user.id, last_seen: now, is_online: true }, { onConflict: "user_id" });

        console.log(`💓 Heartbeat sent (last_seen updated, in_game=${currentlyInGame})`);
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

    // GamePage cleanup/HMR gecikmeli false yazarsa, oyun rotasında tekrar true'ya sabitle
    const inGameRetry = currentlyInGame ? window.setTimeout(updateLastSeen, 2500) : undefined;

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
    }, currentlyInGame ? 15000 : 45000);

    // 🔥 Visibility change: öne gelince heartbeat, arka plana geçince bir şey yapma
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isPushSuppressed()) {
        updateLastSeen();
      }
      // arka plana geçince setOffline ÇAĞRILMIYOR — heartbeat duracak, last_seen eskiyecek
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Capacitor App state listener
    // 🔧 FIX: iOS'ta push bildirim uygulamayı kısa süreliğine uyandırıyor
    // appStateChange(isActive:true) push listener'dan ÖNCE tetikleniyor
    // Bu yüzden 500ms bekleyip suppression kontrolü yapıyoruz
    const appStateListenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        // 🔧 iOS push wake koruması: Kısa gecikme ile suppression kontrolü yap
        // Push listener 500ms içinde suppressActivityForPush() çağıracak
        setTimeout(() => {
          if (isPushSuppressed()) {
            console.log(`⏭️ ActivityTracker: Push wake algılandı, online güncelleme atlanıyor`);
            return;
          }
          // Ek kontrol: Uygulama gerçekten ön planda mı?
          if (document.visibilityState !== "visible") {
            console.log("⏭️ ActivityTracker: App ön planda değil (push wake), heartbeat atlanıyor");
            return;
          }
          console.log("🟢 ActivityTracker: App active → heartbeat gönderiliyor");
          updateLastSeen();
        }, 500);
      }
      // isActive === false → bir şey yapma, heartbeat duracak, last_seen eskiyecek
    });

    return () => {
      if (inGameRetry) window.clearTimeout(inGameRetry);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("force-presence-update", handleForcePresence);
      appStateListenerPromise.then((l) => l.remove());
    };
  }, [user?.id, location.pathname]);
}
