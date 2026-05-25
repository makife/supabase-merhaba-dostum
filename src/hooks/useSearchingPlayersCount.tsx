import { useEffect, useRef, useState } from 'react';

/**
 * Ana sayfada "X kişi arıyor" göstergesi için sahte (canlı görünen) sayaç.
 * 8 ile 35 arasında 4-9 saniyede bir küçük adımlarla değişir, doğal görünür.
 * Gerçek kuyruktaki kişi sayısını sorgulamayız - sadece UI hissiyatı.
 */
export const useSearchingPlayersCount = () => {
  const [count, setCount] = useState<number>(() => 8 + Math.floor(Math.random() * 28)); // 8..35
  const targetRef = useRef<number>(count);

  useEffect(() => {
    let cancelled = false;

    const pickNewTarget = () => {
      // Mevcut hedefe yakın yeni bir hedef seç (büyük sıçramaları önle)
      const drift = Math.floor(Math.random() * 11) - 5; // -5..+5
      let next = targetRef.current + drift;
      if (next < 8) next = 8 + Math.floor(Math.random() * 4);
      if (next > 35) next = 32 - Math.floor(Math.random() * 4);
      targetRef.current = next;
    };

    const tick = () => {
      if (cancelled) return;
      pickNewTarget();
      // Hedefe doğru kademeli geçiş için birkaç ara adım
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
      const wait = totalStepMs + 4000 + Math.floor(Math.random() * 5000); // 4-9s ek bekleme
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
