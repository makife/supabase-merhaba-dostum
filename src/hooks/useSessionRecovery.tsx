import { useEffect, useRef } from "react";
import { supabase, loadSessionFromStorage, saveSessionToStorage } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

/**
 * 🔧 Session Recovery Hook - V4
 * Arka plandan gelince session'ı korur
 * TEK KAYNAK: client.ts storage fonksiyonları
 */

export function useSessionRecovery() {
  const lastRecoveryRef = useRef(0);
  const isRecoveringRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const recoverSession = async () => {
      const now = Date.now();
      
      // Rate limit: 10 saniyede bir
      if (now - lastRecoveryRef.current < 10000 || isRecoveringRef.current) {
        return;
      }
      
      isRecoveringRef.current = true;
      lastRecoveryRef.current = now;

      try {
        console.log("[SessionRecovery] 🔄 Kontrol...");

        // Supabase'den mevcut session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.access_token) {
          console.log("[SessionRecovery] ✅ Session aktif");
          isRecoveringRef.current = false;
          return;
        }

        // Storage'dan yükle
        const stored = await loadSessionFromStorage();

        if (!stored?.refresh_token) {
          console.log("[SessionRecovery] ⚠️ Storage'da session yok");
          isRecoveringRef.current = false;
          return;
        }

        console.log("[SessionRecovery] 🔄 Token refresh...");
        
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: stored.refresh_token,
        });

        if (error) {
          console.log("[SessionRecovery] ⚠️ Refresh hatası:", error.message);
        } else if (data?.session) {
          console.log("[SessionRecovery] ✅ Session yenilendi!");
          await saveSessionToStorage(data.session);
        }

      } catch (e) {
        console.error("[SessionRecovery] ❌ Hata:", e);
      } finally {
        isRecoveringRef.current = false;
      }
    };

    // Visibility change
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        recoverSession();
      }
    };

    // Custom events
    const handleReconnect = () => recoverSession();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("supabase-reconnected", handleReconnect);

    // İlk çalıştırma
    recoverSession();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("supabase-reconnected", handleReconnect);
    };
  }, []);
}
