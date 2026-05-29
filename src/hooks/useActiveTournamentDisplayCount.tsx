import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ana sayfa turnuva kartı için aktif (waiting) turnuva sayısını
 * her 30 saniyede bir yeniler. Bot turnuvaları 30 saniyede bir döner
 * (ensure-bot-tournaments edge function tarafından).
 */
export const useActiveTournamentDisplayCount = () => {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        // ensure-bot-tournaments'i bekle (stale temizler + eksikleri doldurur), sonra gerçek DB sayısını göster
        await supabase.functions.invoke("ensure-bot-tournaments").catch(() => {});

        const { count: c } = await supabase
          .from("tournaments")
          .select("id", { count: "exact", head: true })
          .eq("status", "waiting");

        if (!cancelled) setCount(c ?? 0);
      } catch {
        // sessiz
      }
    };

    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return count;
};
