import { useEffect, useRef, useState } from 'react';

/**
 * Ana sayfada "X kişi arıyor" göstergesi için saat dilimine göre dinamik sayaç.
 * Türkiye saati (UTC+3) baz alınır.
 *
 * 00:00-02:00  → 5-10 kişi
 * 02:00-07:00  → 0-3 kişi
 * 07:00-12:00  → 40-55 kişi
 * 12:00-17:00  → 75-110 kişi
 * 17:00-00:00  → 125-415 kişi
 */

function getHourInTurkey(): number {
  const now = new Date();
  return (now.getUTCHours() + 3) % 24;
}

function getRangeForHour(hour: number): [number, number] {
  if (hour >= 0 && hour < 2) return [5, 10];
  if (hour >= 2 && hour < 7) return [0, 3];
  if (hour >= 7 && hour < 12) return [40, 55];
  if (hour >= 12 && hour < 17) return [75, 110];
  return [125, 415]; // 17:00 - 00:00
}

function getInitialCount(): number {
  const [min, max] = getRangeForHour(getHourInTurkey());
  return min + Math.floor(Math.random() * (max - min + 1));
}

export const useSearchingPlayersCount = () => {
  const [count, setCount] = useState<number>(getInitialCount);
  const targetRef = useRef<number>(count);

  useEffect(() => {
    let cancelled = false;

    const pickNewTarget = () => {
      const [min, max] = getRangeForHour(getHourInTurkey());
      const drift = Math.floor(Math.random() * 11) - 5; // -5..+5
      let next = targetRef.current + drift;
      if (next < min) next = min + Math.floor(Math.random() * 4);
      if (next > max) next = max - Math.floor(Math.random() * 4);
      // Eğer saat değişmişse ve yeni aralık farklıysa, hedefi yeni aralığa çek
      if (next < min) next = min;
      if (next > max) next = max;
      targetRef.current = next;
    };

    const tick = () => {
      if (cancelled) return;
      pickNewTarget();
      const start = count;
      const end = targetRef.current;
      const steps = 3 + Math.floor(Math.random() * 3); // 3-5 ara adım
      const stepDelay = 500 + Math.floor(Math.random() * 400); // 500-900ms
      for (let i = 1; i <= steps; i++) {
        setTimeout(() => {
          if (cancelled) return;
          const v = Math.round(start + ((end - start) * i) / steps);
          setCount(v);
        }, i * stepDelay);
      }
      const totalStepMs = steps * stepDelay;
      const wait = totalStepMs + 4000 + Math.floor(Math.random() * 5000); // 4-9s ek
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
