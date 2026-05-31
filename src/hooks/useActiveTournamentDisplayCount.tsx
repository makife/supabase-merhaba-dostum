import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getGlobalServerNow } from "@/contexts/ServerTimeContext";

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
        // Havuzu DB tarafında kilitli şekilde yenile; çoklu cihaz çağrıları turnuva sayısını şişirmez.
        await (supabase as any).rpc("ensure_bot_tournament_pool").catch(() => {});
        const nowIso = new Date(getGlobalServerNow()).toISOString();

        const { count: c } = await supabase
          .from("tournaments")
          .select("id", { count: "exact", head: true })
          .eq("status", "waiting")
          .gt("expires_at", nowIso);

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
