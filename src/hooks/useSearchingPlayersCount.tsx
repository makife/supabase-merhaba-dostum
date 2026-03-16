import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Rastgele eşleşme arayan oyuncu sayısını 1 dakikada bir çeker.
 * game_rooms tablosundan status='waiting' ve game_mode='random' olan odaları sayar.
 * Her bekleyen oda = 1 arayan oyuncu.
 */
export const useSearchingPlayersCount = () => {
  const [count, setCount] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        // 2 dakikadan eski odaları dahil etme
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        
        const { count: roomCount, error } = await supabase
          .from('game_rooms')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'waiting')
          .eq('game_mode', 'random')
          .gt('created_at', twoMinAgo);

        if (!error && roomCount !== null) {
          setCount(roomCount);
        }
      } catch {
        // Sessizce devam et
      }
    };

    fetchCount();
    intervalRef.current = setInterval(fetchCount, 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return count;
};
