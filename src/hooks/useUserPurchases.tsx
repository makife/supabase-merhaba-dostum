import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';

interface UserPurchase {
  id: string;
  item_id: string;
  item_type: string;
  purchased_at: string;
  is_active: boolean;
  expires_at?: string;
}

interface UserSettings {
  active_theme: string;
  active_avatar_frame: string;
  active_sound_pack: string;
  active_music_pack: string;
  effects_enabled?: boolean;
  confetti_effect_enabled?: boolean;
  fireworks_effect_enabled?: boolean;
}

interface UserInventory {
  item_type: string;
  quantity: number;
}

export const useUserPurchases = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [settings, setSettings] = useState<UserSettings>({
    active_theme: 'default',
    active_avatar_frame: 'none',
    active_sound_pack: 'default',
    active_music_pack: 'default',
    effects_enabled: true,
    confetti_effect_enabled: true,
    fireworks_effect_enabled: true
  });
  const [inventory, setInventory] = useState<UserInventory[]>([]);
  const [loading, setLoading] = useState(false);

  // Kullanıcı satın alımlarını yükle
  const loadPurchases = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error('Error loading purchases:', error);
    }
  }, [user?.id]);

  // Kullanıcı ayarlarını yükle
  const loadSettings = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSettings({
          active_theme: data.active_theme || 'default',
          active_avatar_frame: data.active_avatar_frame || 'none',
          active_sound_pack: data.active_sound_pack || 'default',
          active_music_pack: (data as any).active_music_pack || 'default',
          effects_enabled: data.effects_enabled ?? true,
          confetti_effect_enabled: data.confetti_effect_enabled ?? true,
          fireworks_effect_enabled: data.fireworks_effect_enabled ?? true
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, [user?.id]);

  // Kullanıcı envanterini yükle
  const loadInventory = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_inventory')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
    }
  }, [user?.id]);

  // Envanter güncelle
  const updateInventory = useCallback(async (itemType: string, quantity: number) => {
    if (!user?.id) return;

    try {
      const { data: existing } = await supabase
        .from('user_inventory')
        .select('*')
        .eq('user_id', user.id)
        .eq('item_type', itemType)
        .single();

      if (existing) {
        await supabase
          .from('user_inventory')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_inventory')
          .insert({
            user_id: user.id,
            item_type: itemType,
            quantity: quantity
          });
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
    }
  }, [user?.id]);

  // Ayarları güncelle
  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    if (!user?.id) return;

    try {
      const { data: existing } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const updatedSettings = { ...settings, ...newSettings };

      if (existing) {
        await supabase
          .from('user_settings')
          .update(updatedSettings)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            ...updatedSettings
          });
      }

      setSettings(updatedSettings);
      await loadSettings();

      toast({
        title: 'Ayarlar Güncellendi',
        description: 'Tercihleriniz başarıyla kaydedildi.',
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      toast({
        title: 'Güncelleme Hatası',
        description: 'Ayarlar güncellenirken bir hata oluştu.',
        variant: 'destructive',
      });
    }
  }, [user?.id, settings, loadSettings, toast]);

  // Satın alma işlemi gerçekleştir
  const processPurchase = useCallback(async (item: any) => {
    if (!user?.id) return false;

    setLoading(true);
    window.dispatchEvent(new CustomEvent('purchaseStarted'));
    try {
      // Öğe tipine göre işlem yap
      if (item.type === 'credits') {
        // Direkt olarak mevcut haklara ekle
        const { data: profile } = await supabase
          .from('profiles')
          .select('game_credits, bonus_credits')
          .eq('id', user.id)
          .single();

        const currentCredits = profile?.game_credits || 0;
        const currentBonus = profile?.bonus_credits || 0;
        
        // Toplam mevcut krediye yeni kredileri ekle
        const currentTotal = currentCredits + currentBonus;
        const newTotal = currentTotal + item.value;
        
        // 5'e kadar game_credits'e, kalanı bonus_credits'e ekle
        const newGameCredits = Math.min(5, newTotal);
        const newBonusCredits = Math.max(0, newTotal - 5);

        const { error } = await supabase
          .from('profiles')
          .update({ 
            game_credits: newGameCredits,
            bonus_credits: newBonusCredits,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
          
        if (error) throw error;

      } else if (item.type === 'joker') {
        // Joker satın alımı - envantere ekle
        await updateInventory(item.id, item.value);
        
        // Başarı mesajı silindi - zaten market sayfasında gösteriliyor

      } else if (item.type === 'unlimited_time') {
        // 🔥 KRİTİK FIX: Sınırsız zaman satın alımında bonus_credits'e ekle
        // game_credits değil bonus_credits kullanılmalı (game_credits max 5)
        const { data: profile } = await supabase
          .from('profiles')
          .select('game_credits, bonus_credits')
          .eq('id', user.id)
          .single();

        const creditsToAdd = item.value === 1 ? 10 : 50; // 1 saat = 10, 24 saat = 50
        const currentGameCredits = profile?.game_credits || 0;
        const currentBonusCredits = profile?.bonus_credits || 0;
        
        // game_credits 5'e kadar doldur, kalan bonus'a
        const spaceInGameCredits = Math.max(0, 5 - currentGameCredits);
        const addToGame = Math.min(creditsToAdd, spaceInGameCredits);
        const addToBonus = creditsToAdd - addToGame;
        
        const newGameCredits = currentGameCredits + addToGame;
        const newBonusCredits = currentBonusCredits + addToBonus;
        
        console.log(`[Purchase] unlimited_time: Adding ${creditsToAdd} credits. Game: ${currentGameCredits}->${newGameCredits}, Bonus: ${currentBonusCredits}->${newBonusCredits}`);

        await supabase
          .from('profiles')
          .update({ 
            game_credits: newGameCredits,
            bonus_credits: newBonusCredits
          })
          .eq('id', user.id);

      } else if (item.type === 'premium') {
        // Premium üyelik
        if (item.value > 0) {
          const premiumUntil = new Date();
          premiumUntil.setDate(premiumUntil.getDate() + item.value);
          
          await supabase
            .from('profiles')
            .update({ premium_until: premiumUntil.toISOString() })
            .eq('id', user.id);
        }

      } else if (item.type === 'hint') {
        // İpucu paketi
        const { data: profile } = await supabase
          .from('profiles')
          .select('hint_credits')
          .eq('id', user.id)
          .single();

        const newHints = (profile?.hint_credits || 0) + item.value;

        await supabase
          .from('profiles')
          .update({ hint_credits: newHints })
          .eq('id', user.id);

        // Envantere de ekle
        await updateInventory('hint', item.value);

      } else {
        // Diğer öğeler için envantere ekle
        await updateInventory(item.type, 1);
        
        // Müzik paketi satın alımı için özel işlem
        if (item.id.startsWith('music_pack_')) {
          const musicPackId = item.id.replace('music_pack_', '');
          await updateSettings({ active_music_pack: musicPackId });
        }
      }

      // Kredi ile satın alma
      if (item.currency === 'credits') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('game_credits')
          .eq('id', user.id)
          .single();

        const newCredits = (profile?.game_credits || 0) - item.price;

        await supabase
          .from('profiles')
          .update({ game_credits: newCredits })
          .eq('id', user.id);
      }

      // Satın alma kaydı oluştur
      await supabase
        .from('user_purchases')
        .insert({
          user_id: user.id,
          item_id: item.id,
          item_type: item.type,
          is_active: true
        });

      // Verileri yenile
      await Promise.all([loadPurchases(), loadInventory()]);

      // Profile yenilenmesini zorunlu kıl
      window.dispatchEvent(new CustomEvent('refreshProfile'));

      toast({
        title: 'Satın Alma Başarılı! 🎉',
        description: `${item.title} başarıyla satın alındı.`,
      });

      return true;
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        title: 'Satın Alma Hatası',
        description: 'Bir hata oluştu, lütfen tekrar deneyin.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id, updateInventory, updateSettings, loadPurchases, loadInventory, toast]);

  // Satın alınmış öğe kontrolü
  const hasPurchased = useCallback((itemId: string) => {
    return purchases.some(p => p.item_id === itemId && p.is_active);
  }, [purchases]);

  // Envanterde öğe kontrolü
  const getInventoryQuantity = useCallback((itemType: string) => {
    const item = inventory.find(i => i.item_type === itemType);
    return item?.quantity || 0;
  }, [inventory]);

  // Kullanıcı değiştiğinde verileri yükle
  useEffect(() => {
    if (user?.id) {
      Promise.all([
        loadPurchases(),
        loadSettings(),
        loadInventory()
      ]).catch(error => {
        console.error('Error loading user data:', error);
      });
    } else {
      // Kullanıcı çıkış yaptığında state'leri temizle
      setPurchases([]);
      setSettings({
        active_theme: 'default',
        active_avatar_frame: 'none',
        active_sound_pack: 'default',
        active_music_pack: 'default',
        effects_enabled: true,
        confetti_effect_enabled: true,
        fireworks_effect_enabled: true
      });
      setInventory([]);
    }
  }, [user?.id, loadPurchases, loadSettings, loadInventory]);

  return {
    purchases,
    settings,
    inventory,
    loading,
    processPurchase,
    updateSettings,
    hasPurchased,
    getInventoryQuantity,
    loadPurchases,
    loadSettings,
    loadInventory,
    updateInventory
  };
};