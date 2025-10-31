import { useState, useEffect, useCallback } from 'react';
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

  const loadJokers = useCallback(async () => {
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
  }, [user]);

  const useJoker = async (jokerType: keyof JokerInventory) => {
    if (!user || jokers[jokerType] <= 0) return false;

    try {
      // Joker kullanım sayacını güncelle
      const columnMap = {
        degistir: 'degistir_joker_used',
        fisilida: 'fisilida_joker_used',
        senYaz: 'senyaz_joker_used'
      };

      // Önce mevcut değeri al
      const { data: profile } = await supabase
        .from('profiles')
        .select(columnMap[jokerType])
        .eq('id', user.id)
        .single();

      const currentValue = (profile as any)?.[columnMap[jokerType]] || 0;

      const { error: statsError } = await supabase
        .from('profiles')
        .update({ 
          [columnMap[jokerType]]: currentValue + 1
        })
        .eq('id', user.id);

      if (statsError) {
        console.error('Joker istatistik güncellenemedi:', statsError);
      } else {
        // Rozet kontrolü yap
        await supabase.rpc('check_and_award_badges_simple', { p_user_id: user.id });
      }
      // Veritabanındaki olası item_type eşleşmeleri (geçmiş uyumluluğu için)
      const aliasMap: Record<keyof JokerInventory, string[]> = {
        degistir: ['joker_degistir', 'degistir'],
        fisilida: ['joker_fisildi', 'fisilida'],
        senYaz: ['joker_senyaz', 'senYaz', 'senyaz'],
      };
      const aliases = aliasMap[jokerType];

      // Mevcut kaydı bul (hangi anahtar varsa onu güncelle)
      const { data: rows, error: selectError } = await supabase
        .from('user_inventory')
        .select('id, item_type, quantity')
        .eq('user_id', user.id)
        .in('item_type', aliases)
        .limit(1);

      if (selectError) throw selectError;

      const row = rows?.[0];
      if (!row) {
        console.warn('⚠️ Joker kaydı bulunamadı, iptal ediliyor:', jokerType);
        return false;
      }

      const currentQty = row.quantity ?? 0;
      const newQuantity = Math.max(0, currentQty - 1);

      console.log(`🎯 Joker kullanımı: ${jokerType} -> ${row.item_type}, ${currentQty} → ${newQuantity}`);

      if (newQuantity === 0) {
        // 0 olursa ilgili kaydı sil
        const { error } = await supabase
          .from('user_inventory')
          .delete()
          .eq('id', row.id);
        if (error) throw error;
      } else {
        // Miktarı güncelle
        const { error } = await supabase
          .from('user_inventory')
          .update({ quantity: newQuantity })
          .eq('id', row.id);
        if (error) throw error;
      }

      setJokers(prev => ({
        ...prev,
        [jokerType]: newQuantity,
      }));

      console.log(`✅ Joker başarıyla güncellendi: ${jokerType} = ${newQuantity}`);
      return true;
    } catch (error) {
      console.error('Joker kullanılırken hata:', error);
      return false;
    }
  };

  useEffect(() => {
    loadJokers();
  }, [user]);

  // Manual reload when needed - no realtime subscription interference
  // Removed realtime subscription to prevent interference with manual joker usage

  return {
    jokers,
    loading,
    useJoker,
    loadJokers
  };
};