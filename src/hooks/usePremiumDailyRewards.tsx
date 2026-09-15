import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { useMobileNotifications } from '@/hooks/useMobileNotifications';

export const usePremiumDailyRewards = () => {
  const { user } = useAuth();
  const { profile, isPremium, refreshProfile } = useUser();
  const { showLocalNotification, isPermissionGranted } = useMobileNotifications();
  const [hasClaimedToday, setHasClaimedToday] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Premium kullanıcı mı ve premium_until var mı kontrol et
  const hasPremiumSubscription = useCallback(() => {
    if (!profile?.premium_until) return false;
    return new Date(profile.premium_until) > new Date();
  }, [profile]);

  // Bugün joker alınmış mı kontrol et
  const checkTodaysClaim = useCallback(async () => {
    if (!user?.id || !hasPremiumSubscription()) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('premium_daily_rewards')
        .select('id')
        .eq('user_id', user.id)
        .eq('reward_date', today)
        .maybeSingle();

      if (!error) {
        setHasClaimedToday(!!data);
      }
    } catch (error) {
      console.error('Error checking daily rewards:', error);
    }
  }, [user?.id, hasPremiumSubscription]);

  // Günlük jokerleri al
  const claimDailyJokers = useCallback(async () => {
    if (!user?.id || !hasPremiumSubscription() || hasClaimedToday || isLoading) {
      return { success: false, message: 'Jokerler alınamadı' };
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('claim_premium_daily_jokers', { p_user_id: user.id });

      if (error) {
        console.error('Error claiming daily jokers:', error);
        return { success: false, message: error.message };
      }

      const result = data as { success: boolean; message: string; jokers?: any; premium_type?: string; amount?: number };
      
      if (result.success) {
        setHasClaimedToday(true);

        const amount = result.amount ?? 5;
        const isYearly = result.premium_type === 'premium_yearly';
        const planLabel = isYearly ? 'Yıllık VIP' : 'Aylık VIP';

        // Toast bildirimi
        toast.success(`🎁 Günlük ${planLabel} Jokerleri Alındı!`, {
          description: `Değiştir, Fısılda ve Sen Yaz jokerleriniz +${amount} eklendi`
        });

        // Push notification gönder
        if (isPermissionGranted) {
          showLocalNotification(
            `🎁 ${planLabel} Günlük Hediye!`,
            `Günlük ${amount}x Değiştir, ${amount}x Fısılda, ${amount}x Sen Yaz jokerleriniz eklendi!`,
            { type: 'premium_daily_jokers' }
          );
        }
        
        // Profili yenile
        await refreshProfile(true);
      }

      return result;
    } catch (error) {
      console.error('Error claiming daily jokers:', error);
      return { success: false, message: 'Bir hata oluştu' };
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, hasPremiumSubscription, hasClaimedToday, isLoading, refreshProfile, showLocalNotification, isPermissionGranted]);

  // Otomatik kontrol ve talep
  useEffect(() => {
    if (user?.id && hasPremiumSubscription()) {
      checkTodaysClaim();
    }
  }, [user?.id, profile?.premium_until, checkTodaysClaim, hasPremiumSubscription]);

  // Premium kullanıcı giriş yaptığında ve bugün almadıysa otomatik ver
  useEffect(() => {
    const autoClaimJokers = async () => {
      if (
        user?.id && 
        hasPremiumSubscription() && 
        !hasClaimedToday && 
        !isLoading &&
        profile?.premium_until // Premium subscription aktif
      ) {
        // Küçük bir gecikme ekle (profil yüklenmesi için)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Tekrar kontrol et (race condition önleme)
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('premium_daily_rewards')
          .select('id')
          .eq('user_id', user.id)
          .eq('reward_date', today)
          .maybeSingle();

        if (!data) {
          console.log('🎁 Auto-claiming daily jokers for premium user');
          await claimDailyJokers();
        }
      }
    };

    autoClaimJokers();
  }, [user?.id, profile?.premium_until, hasClaimedToday, isLoading, hasPremiumSubscription, claimDailyJokers]);

  return {
    hasClaimedToday,
    isLoading,
    hasPremiumSubscription: hasPremiumSubscription(),
    claimDailyJokers,
    checkTodaysClaim
  };
};
