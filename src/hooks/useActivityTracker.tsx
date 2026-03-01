import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { App } from "@capacitor/app";

export function useActivityTracker() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const updateLastSeen = async () => {
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

    // İlk güncelleme
    updateLastSeen();

    // Her 20 saniyede bir heartbeat - sadece uygulama görünürse
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        updateLastSeen();
      }
    }, 20000);

    // Capacitor App state listener - sadece kullanıcı gerçekten
    // uygulamayı aktif açtığında tetiklenir (push bildirimi hariç)
    const appStateListenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        updateLastSeen();
      }
    });

    return () => {
      clearInterval(interval);
      appStateListenerPromise.then((l) => l.remove());
    };
  }, [user]);
}
