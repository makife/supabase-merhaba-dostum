import { useState, useCallback } from 'react';
import { AdMob, RewardAdPluginEvents, AdLoadInfo, AdMobRewardItem } from '@capacitor-community/admob';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useAdMob = () => {
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [isAdReady, setIsAdReady] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize AdMob
  const initializeAdMob = useCallback(async () => {
    try {
      await AdMob.initialize({
        testingDevices: [], // Production - no test devices
        initializeForTesting: false, // Production mode
      });
      console.log('AdMob initialized successfully');
    } catch (error) {
      console.error('AdMob initialization failed:', error);
    }
  }, []);

  // Load rewarded ad
  const loadRewardedAd = useCallback(async () => {
    if (isAdLoading) return;
    
    setIsAdLoading(true);
    
    try {
      await AdMob.prepareRewardVideoAd({
        adId: 'ca-app-pub-4768026665961339/3449888248', // Your real Rewarded Ad ID
        isTesting: false, // Production mode
      });
      
      setIsAdReady(true);
      console.log('Rewarded ad loaded successfully');
    } catch (error) {
      console.error('Failed to load rewarded ad:', error);
      toast({
        title: 'Reklam Yüklenemedi',
        description: 'Reklam yüklenirken bir hata oluştu. Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    } finally {
      setIsAdLoading(false);
    }
  }, [isAdLoading, toast]);

  // Show rewarded ad
  const showRewardedAd = useCallback(async () => {
    if (!isAdReady) {
      toast({
        title: 'Reklam Hazır Değil',
        description: 'Reklam henüz yüklenmedi. Lütfen bekleyin.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Add event listeners
      const adDismissedListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        console.log('Rewarded ad dismissed');
        setIsAdReady(false);
        // Load next ad
        loadRewardedAd();
      });

      const adFailedToShowListener = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
        console.error('Rewarded ad failed to show:', error);
        setIsAdReady(false);
        toast({
          title: 'Reklam Gösterilemedi',
          description: 'Reklam gösterilirken bir hata oluştu.',
          variant: 'destructive',
        });
      });

      const adRewardedListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, async (reward: AdMobRewardItem) => {
        console.log('User earned reward:', reward);
        
        // Give user reward (credits)
        await giveReward();
        
        toast({
          title: 'Ödül Kazandınız! 🎉',
          description: '+1 kredi hesabınıza eklendi.',
        });
      });

      // Show the ad
      await AdMob.showRewardVideoAd();
      
      // Clean up listeners after ad is shown
      setTimeout(() => {
        adDismissedListener.remove();
        adFailedToShowListener.remove();
        adRewardedListener.remove();
      }, 30000); // Remove listeners after 30 seconds
      
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
      setIsAdReady(false);
      toast({
        title: 'Reklam Hatası',
        description: 'Reklam gösterilirken bir hata oluştu.',
        variant: 'destructive',
      });
    }
  }, [isAdReady, toast, loadRewardedAd]);

  // Give reward to user
  const giveReward = useCallback(async () => {
    if (!user) return;

    try {
      // Get current credits first
      const { data: profile } = await supabase
        .from('profiles')
        .select('game_credits')
        .eq('id', user.id)
        .single();

      const newCredits = (profile?.game_credits || 0) + 1; // 1 kredi ekle

      // Update user credits in database
      const { error } = await supabase
        .from('profiles')
        .update({ 
          game_credits: newCredits,
          last_credit_refresh: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      console.log('Reward given successfully');
    } catch (error) {
      console.error('Failed to give reward:', error);
      toast({
        title: 'Ödül Hatası',
        description: 'Ödül verilirken bir hata oluştu.',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  return {
    isAdLoading,
    isAdReady,
    initializeAdMob,
    loadRewardedAd,
    showRewardedAd,
  };
};