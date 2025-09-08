import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
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
    if (!Capacitor.isNativePlatform()) {
      toast({ title: 'Bilgi', description: 'Reklamlar sadece mobil uygulamada çalışır' });
      return;
    }
    try {
      const { AdMob } = await import(/* @vite-ignore */ '@capacitor-community/admob');
      await AdMob.initialize({
        testingDevices: [],
        initializeForTesting: false,
      });
      console.log('AdMob initialized successfully');
    } catch (error) {
      console.error('AdMob initialization failed:', error);
    }
  }, [toast]);

  // Load rewarded ad
  const loadRewardedAd = useCallback(async () => {
    if (isAdLoading) return;
    if (!Capacitor.isNativePlatform()) {
      toast({ title: 'Bilgi', description: 'Reklamlar sadece mobil uygulamada çalışır' });
      return;
    }
    setIsAdLoading(true);
    try {
      const { AdMob } = await import(/* @vite-ignore */ '@capacitor-community/admob');
      const isIOS = Capacitor.getPlatform() === 'ios';
      const adId = isIOS
        ? 'ca-app-pub-4768026665961339/6383991586'
        : 'ca-app-pub-4768026665961339/3449888248';
      await AdMob.prepareRewardVideoAd({ adId, isTesting: false });
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
    if (!Capacitor.isNativePlatform()) {
      toast({ title: 'Bilgi', description: 'Reklamlar sadece mobil uygulamada çalışır' });
      return;
    }
    try {
      const { AdMob, RewardAdPluginEvents } = await import(/* @vite-ignore */ '@capacitor-community/admob');
      const adDismissedListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        console.log('Rewarded ad dismissed');
        setIsAdReady(false);
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
      const adRewardedListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, async (reward: any) => {
        console.log('User earned reward:', reward);
        await giveReward();
        toast({ title: 'Ödül Kazandınız! 🎉', description: '+1 kredi hesabınıza eklendi.' });
      });
      await AdMob.showRewardVideoAd();
      setTimeout(() => {
        adDismissedListener.remove();
        adFailedToShowListener.remove();
        adRewardedListener.remove();
      }, 30000);
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
      setIsAdReady(false);
      toast({
        title: 'Reklam Hatası',
        description: 'Reklam gösterilirken bir hata oluştu.',
        variant: 'destructive',
      });
    }
  }, [isAdReady, toast, loadRewardedAd, giveReward]);


  return {
    isAdLoading,
    isAdReady,
    initializeAdMob,
    loadRewardedAd,
    showRewardedAd,
  };
};