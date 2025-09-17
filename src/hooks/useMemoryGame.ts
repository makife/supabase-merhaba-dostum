import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useMemoryGame = () => {
  const { user } = useAuth();
  const { updateInventory } = useUserPurchases();
  const [canPlay, setCanPlay] = useState(false);
  const [timeUntilNextPlay, setTimeUntilNextPlay] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // 24 saat kontrolü
  const checkCanPlay = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data, error } = await supabase
        .from('memory_game_plays')
        .select('played_at')
        .eq('user_id', user.id)
        .gte('played_at', twentyFourHoursAgo.toISOString())
        .order('played_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Memory game check error:', error);
        setCanPlay(true);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        // Son oyun 24 saat içinde oynandı
        setCanPlay(false);
        const lastPlay = new Date(data[0].played_at);
        const nextPlay = new Date(lastPlay.getTime() + (24 * 60 * 60 * 1000));
        calculateTimeUntilNextPlay(nextPlay);
      } else {
        // 24 saat geçmiş, oynayabilir
        setCanPlay(true);
        setTimeUntilNextPlay('');
      }
    } catch (error) {
      console.error('Memory game check error:', error);
      setCanPlay(true);
    }
    
    setLoading(false);
  };

  // Kalan süreyi hesapla
  const calculateTimeUntilNextPlay = (nextPlayTime: Date) => {
    const now = new Date();
    const timeDiff = nextPlayTime.getTime() - now.getTime();
    
    if (timeDiff <= 0) {
      setCanPlay(true);
      setTimeUntilNextPlay('');
      return;
    }

    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    setTimeUntilNextPlay(`${hours}s ${minutes}d`);
  };

  // Oyun tamamlandığında joker ver
  const completeGame = async (moves: number) => {
    if (!user || !canPlay) return null;

    try {
      // Random joker seç
      const jokerTypes = ['degistir', 'fisilida', 'senyaz'];
      const randomJoker = jokerTypes[Math.floor(Math.random() * jokerTypes.length)];
      
      // Joker isimlerini Türkçe'ye çevir
      const jokerNames = {
        degistir: 'Değiştir',
        fisilida: 'Fısılda', 
        senyaz: 'Sen Yaz'
      };

      // Database'e kaydet
      const { error } = await supabase
        .from('memory_game_plays')
        .insert({
          user_id: user.id,
          moves: moves,
          joker_given: randomJoker,
          played_at: new Date().toISOString()
        });

      if (error) {
        console.error('Memory game save error:', error);
        return null;
      }

      // Joker'i envantere ekle
      await updateInventory(randomJoker, 1);

      // Durumu güncelle
      setCanPlay(false);
      
      // Toast göster
      toast.success(`🎉 Tebrikler! ${jokerNames[randomJoker as keyof typeof jokerNames]} jokeri kazandın!`, {
        description: `${moves} hamlede tamamladın. 24 saat sonra tekrar oynayabilirsin.`,
        duration: 5000,
      });

      return randomJoker;
    } catch (error) {
      console.error('Complete memory game error:', error);
      return null;
    }
  };

  // Timer effect
  useEffect(() => {
    checkCanPlay();
    
    const interval = setInterval(() => {
      if (!canPlay) {
        checkCanPlay();
      }
    }, 60000); // Her dakika kontrol et

    return () => clearInterval(interval);
  }, [user]);

  return {
    canPlay,
    timeUntilNextPlay,
    loading,
    completeGame,
    checkCanPlay
  };
};
