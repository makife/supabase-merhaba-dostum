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
        .in('item_type', ['degistir', 'fisilida', 'senYaz']);

      const jokerInventory: JokerInventory = {
        degistir: 0,
        fisilida: 0,
        senYaz: 0
      };

      data?.forEach(item => {
        if (item.item_type in jokerInventory) {
          jokerInventory[item.item_type as keyof JokerInventory] = item.quantity;
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

  return {
    jokers,
    loading,
    useJoker,
    loadJokers
  };
};