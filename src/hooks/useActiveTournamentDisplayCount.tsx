import { useEffect, useRef, useState } from "react";

/**
 * Ana sayfa turnuva kartı için canlı görünen sayaç.
 * 6-28 arasında 4-9 saniyede bir küçük adımlarla dalgalanır.
 * useSearchingPlayersCount ile aynı pattern.
 */
export const useActiveTournamentDisplayCount = () => {
  const [count, setCount] = useState<number>(() => 6 + Math.floor(Math.random() * 23)); // 6..28
  const targetRef = useRef<number>(count);

  useEffect(() => {
    let cancelled = false;

    const pickNewTarget = () => {
      const drift = Math.floor(Math.random() * 9) - 4; // -4..+4
      let next = targetRef.current + drift;
      if (next < 6) next = 6 + Math.floor(Math.random() * 3);
      if (next > 28) next = 26 - Math.floor(Math.random() * 3);
      targetRef.current = next;
    };

    const tick = () => {
      if (cancelled) return;
      pickNewTarget();
      const start = count;
      const end = targetRef.current;
      const steps = 3 + Math.floor(Math.random() * 3);
      const stepDelay = 500 + Math.floor(Math.random() * 400);
      for (let i = 1; i <= steps; i++) {
        setTimeout(() => {
          if (cancelled) return;
          const v = Math.round(start + ((end - start) * i) / steps);
          setCount(v);
        }, i * stepDelay);
      }
      const totalStepMs = steps * stepDelay;
      const wait = totalStepMs + 4000 + Math.floor(Math.random() * 5000);
      setTimeout(tick, wait);
    };

    const initial = setTimeout(tick, 3000 + Math.random() * 2000);

    return () => {
      cancelled = true;
      clearTimeout(initial);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return count;
};
