import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { nativeStorage, STORAGE_KEYS } from '@/utils/nativeStorage';

interface MemoryGameCache {
  canPlay: boolean;
  timeUntilNextPlay: string;
  lastCheck: number;
}

export const useMemoryGame = () => {
  const { user } = useAuth();
  const [canPlay, setCanPlay] = useState(true);
  const [timeUntilNextPlay, setTimeUntilNextPlay] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const initializedRef = useRef(false);

  // Cache key oluştur
  const getCacheKey = () => `${STORAGE_KEYS.MEMORY_GAME_PREFIX}${user?.id}`;

  // Cache'e kaydet (async)
  const saveToCache = async (canPlayValue: boolean, timeValue: string = '') => {
    if (!user) return;
    
    const cacheData: MemoryGameCache = {
      canPlay: canPlayValue,
      timeUntilNextPlay: timeValue,
      lastCheck: Date.now()
    };
    
    await nativeStorage.setJSON(getCacheKey(), cacheData);
  };

  // Cache'den oku (async)
  const loadFromCache = async (): Promise<MemoryGameCache | null> => {
    if (!user) return null;
    
    try {
      const data = await nativeStorage.getJSON<MemoryGameCache>(getCacheKey());
      if (!data) return null;
      
      const now = Date.now();
      const lastCheck = data.lastCheck || 0;
      
      // 5 dakikadan eski cache'i kullanma
      if (now - lastCheck > 5 * 60 * 1000) {
        return null;
      }
      
      return data;
    } catch {
      return null;
    }
  };

  // 24 saat kontrolü
  const checkCanPlay = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Önce cache'e bak (async)
    const cached = await loadFromCache();
    if (cached) {
      setCanPlay(cached.canPlay);
      setTimeUntilNextPlay(cached.timeUntilNextPlay || '');
      
      if (!cached.canPlay && cached.timeUntilNextPlay) {
        setTimeout(() => checkCanPlayFromAPI(), 100);
      }
      return;
    }

    await checkCanPlayFromAPI();
  };

  const checkCanPlayFromAPI = async () => {
    if (!user) return;

    setLoading(true);

    try {
      // Son 24 saat içinde oyun oynandı mı kontrol et
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await (supabase as any)
        .from('memory_game_plays')
        .select('played_at')
        .eq('user_id', user.id)
        .gte('played_at', twentyFourHoursAgo.toISOString())
        .order('played_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Memory game check error:', error);
        setCanPlay(true);
        await saveToCache(true, '');
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const lastPlayTime = new Date((data[0] as any).played_at);
        const nextPlayTime = new Date(lastPlayTime.getTime() + (24 * 60 * 60 * 1000));
        
        const now = new Date();
        if (now >= nextPlayTime) {
          setCanPlay(true);
          setTimeUntilNextPlay('');
          await saveToCache(true, '');
        } else {
          setCanPlay(false);
          await calculateTimeUntilNextPlay(nextPlayTime);
        }
      } else {
        setCanPlay(true);
        setTimeUntilNextPlay('');
        await saveToCache(true, '');
      }
    } catch (error) {
      console.error('Memory game check error:', error);
      setCanPlay(true);
      await saveToCache(true, '');
    }
    
    setLoading(false);
  };

  // Kalan süreyi hesapla
  const calculateTimeUntilNextPlay = async (nextPlayTime: Date) => {
    const now = new Date();
    const timeDiff = nextPlayTime.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      setCanPlay(true);
      setTimeUntilNextPlay('');
      await saveToCache(true, '');
      return;
    }

    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    const timeString = `${hours}s ${minutes}d`;
    setTimeUntilNextPlay(timeString);
    await saveToCache(false, timeString);
  };

  // Oyun tamamlandığında sadece kayıt tut (joker yok)
  const completeGame = async (moves: number) => {
    if (!user || !canPlay) return null;

    try {
      // Sadece oyun kaydını tut
      const { error: insertError } = await (supabase as any)
        .from('memory_game_plays')
        .insert({
          user_id: user.id,
          moves: moves,
          played_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Memory game save error:', insertError);
        return null;
      }

      // Durumu güncelle
      setCanPlay(false);
      
      // Sadece tebrik mesajı
      toast.success(`Tebrikler! ${moves} hamlede tamamladın!`, {
        description: `24 saat sonra tekrar oynayabilirsin!`,
        duration: 5000
      });

      // Kalan süreyi hesapla
      const nextPlayTime = new Date();
      nextPlayTime.setHours(nextPlayTime.getHours() + 24);
      await calculateTimeUntilNextPlay(nextPlayTime);

      return true;
    } catch (error) {
      console.error('Complete memory game error:', error);
      return null;
    }
  };

  // Timer effect
  useEffect(() => {
    if (user && !initializedRef.current) {
      initializedRef.current = true;
      checkCanPlay();
    }
  }, [user]);

  // Periyodik kontrol
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(async () => {
      if (!canPlay && timeUntilNextPlay) {
        const cached = await loadFromCache();
        if (cached && !cached.canPlay) {
          checkCanPlayFromAPI();
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user, canPlay, timeUntilNextPlay]);

  return {
    canPlay,
    timeUntilNextPlay,
    loading,
    completeGame,
    checkCanPlay
  };
};