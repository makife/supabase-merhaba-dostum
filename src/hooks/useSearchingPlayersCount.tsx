import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Rastgele eşleşme arayan oyuncu sayısını 1 dakikada bir çeker.
 * matchmaking_rooms tablosundan status='waiting' ve süresi dolmamış odaların
 * current_players toplamını döner.
 */
export const useSearchingPlayersCount = () => {
  const [count, setCount] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { data, error } = await supabase
          .from('matchmaking_rooms')
          .select('current_players')
          .eq('status', 'waiting')
          .gt('expires_at', new Date().toISOString());

        if (!error && data) {
          const total = data.reduce((sum, room) => sum + (room.current_players || 0), 0);
          setCount(total);
        }
      } catch {
        // Sessizce devam et
      }
    };

    fetchCount();
    intervalRef.current = setInterval(fetchCount, 60000); // 1 dakikada bir

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return count;
};
