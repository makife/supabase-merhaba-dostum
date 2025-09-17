import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

// Supabase client'ı direkt oluştur
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

      // Raw SQL query kullan
      const { data, error } = await supabase.rpc('check_memory_game_cooldown', {
        p_user_id: user.id,
        p_hours_ago: 24
      });

      if (error) {
        console.error('Memory game check error:', error);
        setCanPlay(true);
        setLoading(false);
        return;
      }

      if (data && data > 0) {
        // Son oyun 24 saat içinde oynandı
        setCanPlay(false);
        // Basit bir 24 saat sonrası hesapla
        const nextPlay = new Date(Date.now() + (24 * 60 * 60 * 1000));
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
        sen_yaz: 'Sen Yaz'
      };

      // Raw SQL ile kaydet
      const { error } = await supabase.rpc('save_memory_game_play', {
        p_user_id: user.id,
        p_moves: moves,
        p_joker_given: randomJoker
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
        duration: 5000
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