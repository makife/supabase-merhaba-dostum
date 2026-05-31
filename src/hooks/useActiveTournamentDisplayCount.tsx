import { useEffect, useState } from "react";
import { fetchActiveTournamentList } from "@/utils/activeTournaments";

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
        const activeTournaments = await fetchActiveTournamentList();
        if (!cancelled) setCount(activeTournaments.length);
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
