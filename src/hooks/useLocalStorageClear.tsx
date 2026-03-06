import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useLocalStorageClear = () => {
  const hasCheckedRef = useRef(false);

  const checkForStorageClear = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value, updated_at")
        .eq("key", "clear_local_storage")
        .maybeSingle();

      if (error) {
        if (error.code === "PGRST116" || error.code === "42P01") return;
        console.error("Error checking storage clear setting:", error);
        return;
      }

      if (data?.value === "true") {
        const lastClearCheck = localStorage.getItem("last_storage_clear_check");
        const currentCheck = data.updated_at;

        if (lastClearCheck !== currentCheck) {
          const keysToRemove = [
            "kelimeci-settings",
            "kelimeci-theme",
            "kelimeci-user-preferences",
            "kelimeci-game-state",
            "kelimeci-cache",
            "theme-preference",
            "user-settings",
          ];

          keysToRemove.forEach((key) => localStorage.removeItem(key));
          localStorage.setItem("last_storage_clear_check", currentCheck);

          setTimeout(() => window.location.reload(), 2000);
        }
      }
    } catch (error) {
      console.error("Error in storage clear check:", error);
    }
  };

  useEffect(() => {
    // ✅ Sadece mount'ta ve visibility change'de kontrol et — polling yok
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      checkForStorageClear();
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkForStorageClear();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
};

// Admin için localStorage temizleme fonksiyonu
export const triggerGlobalStorageClear = async () => {
  try {
    const { error } = await supabase.rpc("trigger_global_storage_clear");
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error("Error triggering global storage clear:", error);
    return { success: false, error };
  }
};
