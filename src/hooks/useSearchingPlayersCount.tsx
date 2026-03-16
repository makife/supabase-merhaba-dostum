import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const RANDOM_MATCH_TTL_MS = 2 * 60 * 1000;

/**
 * Rastgele eşleşme arayan oyuncu sayısını çeker.
 * - Doğru kaynak: public.game_rooms
 * - Doğru mod: game_mode = 'random-match'
 * - Eş zamanlı güncelleme: Realtime
 * - Güvenlik ağı: 1 dakikalık polling
 */
export const useSearchingPlayersCount = () => {
  const [count, setCount] = useState<number>(0);
  const isMountedRef = useRef(true);

  const fetchCount = useCallback(async () => {
    try {
      const twoMinAgo = new Date(Date.now() - RANDOM_MATCH_TTL_MS).toISOString();

      const { count: roomCount, error } = await supabase
        .from('game_rooms')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'waiting')
        .eq('game_mode', 'random-match')
        .gt('created_at', twoMinAgo);

      if (!error && roomCount !== null && isMountedRef.current) {
        setCount(roomCount);
      }
    } catch {
      // Sessizce devam et
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    fetchCount();

    const refreshInterval = window.setInterval(fetchCount, 60000);

    const channel = supabase
      .channel('searching-players-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_rooms',
          filter: 'game_mode=eq.random-match',
        },
        () => {
          fetchCount();
        },
      )
      .subscribe();

    return () => {
      isMountedRef.current = false;
      window.clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [fetchCount]);

  return count;
};
