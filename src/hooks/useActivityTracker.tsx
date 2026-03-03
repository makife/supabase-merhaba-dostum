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

    // İlk güncelleme - sadece gerçekten foreground'daysa
    if (document.visibilityState === "visible" && document.hasFocus()) {
      updateLastSeen();
    } else {
      console.log("⏭️ ActivityTracker: İlk mount'ta push wake algılandı, online güncelleme atlanıyor");
    }

    // Her 20 saniyede bir heartbeat - sadece uygulama görünür VE odaklıysa
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        updateLastSeen();
      }
    }, 20000);

    // Capacitor App state listener - push bildirimi arka planda uyandırınca
    // isActive=true gelebilir, bu yüzden visibility + focus + gecikme kontrolü ekle
    const appStateListenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        // Push wake vs gerçek foreground ayrımı: 1500ms bekle, visible VE focused ise güncelle
        // Bazı Android cihazlarda push wake sırasında visibilityState="visible" oluyor
        // ama document.hasFocus() false kalıyor - bu ayrımı kullanıyoruz
        setTimeout(() => {
          const isVisible = document.visibilityState === "visible";
          const hasFocus = document.hasFocus();
          if (isVisible && hasFocus) {
            updateLastSeen();
          } else {
            console.log(`⏭️ ActivityTracker: Push wake algılandı (visible=${isVisible}, focus=${hasFocus}), online güncelleme atlanıyor`);
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
