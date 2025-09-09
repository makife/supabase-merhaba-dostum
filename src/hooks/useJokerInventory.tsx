import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface JokerInventory {
  degistir: number;
  fisilida: number;
  senYaz: number;
}

export const useJokerInventory = () => {
  const { user } = useAuth();
  const [jokers, setJokers] = useState<JokerInventory>({
    degistir: 0,
    fisilida: 0,
    senYaz: 0
  });
  const [loading, setLoading] = useState(true);

  const loadJokers = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('user_inventory')
        .select('item_type, quantity')
        .eq('user_id', user.id)
        .in('item_type', ['degistir','joker_degistir','fisilida','joker_fisildi','senYaz','senyaz','joker_senyaz']);

      const jokerInventory: JokerInventory = {
        degistir: 0,
        fisilida: 0,
        senYaz: 0
      };

      const keyMap: Record<string, keyof JokerInventory> = {
        degistir: 'degistir',
        joker_degistir: 'degistir',
        fisilida: 'fisilida',
        joker_fisildi: 'fisilida',
        senYaz: 'senYaz',
        senyaz: 'senYaz',
        joker_senyaz: 'senYaz',
      };

      data?.forEach(item => {
        const mapped = keyMap[item.item_type];
        if (mapped) {
          jokerInventory[mapped] = item.quantity + (jokerInventory[mapped] || 0);
        }
      });

      setJokers(jokerInventory);
    } catch (error) {
      console.error('Joker envanteri yüklenirken hata:', error);
    } finally {
      setLoading(false);
    }
  };

  const useJoker = async (jokerType: keyof JokerInventory) => {
    if (!user || jokers[jokerType] <= 0) return false;

    try {
      const newQuantity = jokers[jokerType] - 1;
      
      if (newQuantity === 0) {
        // Eğer 0 olacaksa kaydı sil
        await supabase
          .from('user_inventory')
          .delete()
          .eq('user_id', user.id)
          .eq('item_type', jokerType);
      } else {
        // Miktarı güncelle
        await supabase
          .from('user_inventory')
          .update({ quantity: newQuantity })
          .eq('user_id', user.id)
          .eq('item_type', jokerType);
      }

      setJokers(prev => ({
        ...prev,
        [jokerType]: newQuantity
      }));

      return true;
    } catch (error) {
      console.error('Joker kullanılırken hata:', error);
      return false;
    }
  };

  useEffect(() => {
    loadJokers();
  }, [user]);

  // Realtime subscription for joker inventory changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('user-inventory-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_inventory',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🔄 Joker inventory real-time update:', payload);
          loadJokers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadJokers]);

  return {
    jokers,
    loading,
    useJoker,
    loadJokers
  };
};