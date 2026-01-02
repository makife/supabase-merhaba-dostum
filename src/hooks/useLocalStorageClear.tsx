import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useLocalStorageClear = () => {
  const { toast } = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkForStorageClear = async () => {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("value, updated_at")
          .eq("key", "clear_local_storage")
          .maybeSingle();

        if (error) {
          // system_settings tablosu yoksa veya veri yoksa sessizce devam et
          if (error.code === "PGRST116" || error.code === "42P01") {
            return;
          }
          console.error("Error checking storage clear setting:", error);
          return;
        }

        if (data?.value === "true") {
          const lastClearCheck = localStorage.getItem("last_storage_clear_check");
          const currentCheck = data.updated_at;

          // Eğer bu clear komutu daha önce işlenmediyse
          if (lastClearCheck !== currentCheck) {
            // LocalStorage'ı temizle (sadece oyun ile ilgili verileri)
            const keysToRemove = [
              "kelimeci-settings",
              "kelimeci-theme",
              "kelimeci-user-preferences",
              "kelimeci-game-state",
              "kelimeci-cache",
              "theme-preference",
              "user-settings",
            ];

            keysToRemove.forEach((key) => {
              localStorage.removeItem(key);
            });

            // Bu clear işleminin yapıldığını kaydet
            localStorage.setItem("last_storage_clear_check", currentCheck);

            // Sayfayı yenile
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        }
      } catch (error) {
        console.error("Error in storage clear check:", error);
      }
    };

    // İlk kontrol
    checkForStorageClear();

    // Her 30 saniyede bir kontrol et
    interval = setInterval(checkForStorageClear, 30000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [toast]);
};

// Admin için localStorage temizleme fonksiyonu
export const triggerGlobalStorageClear = async () => {
  try {
    const { error } = await supabase.rpc("trigger_global_storage_clear");

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error("Error triggering global storage clear:", error);
    return { success: false, error };
  }
};
