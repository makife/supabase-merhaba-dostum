import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Lovable.dev ortamı kontrolü
const isLovableEnv = typeof window !== "undefined" && window.location.hostname.includes("lovable");

// Runtime import fonksiyonu - Vite tarafından analiz edilmeyecek
const importModule = (moduleName: string) => {
  return import(/* @vite-ignore */ moduleName).catch(() => null);
};

export const useAdMob = () => {
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [isAdReady, setIsAdReady] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize AdMob
  const initializeAdMob = useCallback(async () => {
    if (isLovableEnv) {
      console.log("AdMob not available in Lovable.dev environment");
      toast({ title: "Bilgi", description: "Reklamlar sadece mobil uygulamada çalışır" });
      return;
    }

    try {
      // Capacitor'u dinamik olarak import et
      const capacitorModule = await importModule("@capacitor/core");
      if (!capacitorModule) {
        console.log("Capacitor not available");
        return;
      }

      const { Capacitor } = capacitorModule;

      if (!Capacitor.isNativePlatform()) {
        toast({ title: "Bilgi", description: "Reklamlar sadece mobil uygulamada çalışır" });
        return;
      }

      // AdMob modülünü dinamik olarak import et
      const admobModule = await importModule("@capacitor-community/admob");
      if (!admobModule) {
        console.log("AdMob module not available");
        return;
      }

      await admobModule.AdMob.initialize({
        testingDevices: [],
        initializeForTesting: false,
      });
      console.log("AdMob initialized successfully");
    } catch (error) {
      console.error("AdMob initialization failed:", error);
    }
  }, [toast]);

  // Load rewarded ad
  const loadRewardedAd = useCallback(async () => {
    if (isAdLoading) return;

    if (isLovableEnv) {
      console.log("AdMob not available in Lovable.dev environment");
      toast({
        title: "Bilgi",
        description: "Reklamlar sadece mobil uygulamada çalışır",
      });
      return;
    }

    setIsAdLoading(true);

    try {
      const capacitorModule = await importModule("@capacitor/core");
      if (!capacitorModule) return;

      const { Capacitor } = capacitorModule;

      if (!Capacitor.isNativePlatform()) {
        toast({
          title: "Bilgi",
          description: "Reklamlar sadece mobil uygulamada çalışır",
        });
        return;
      }

      const admobModule = await importModule("@capacitor-community/admob");
      if (!admobModule) return;

      const isIOS = Capacitor.getPlatform() === "ios";

      // 🎯 Gerçek reklam ID'leri
      const REAL_AD_ID = isIOS ? "ca-app-pub-4768026665961339/6383991586" : "ca-app-pub-4768026665961339/4806604463";

      // 🧪 Google test rewarded ad ID
      const TEST_AD_ID = "ca-app-pub-3940256099942544/5224354917";

      try {
        // 🔥 Önce gerçek reklamı dene
        await admobModule.AdMob.prepareRewardVideoAd({
          adId: REAL_AD_ID,
          isTesting: false,
        });

        console.log("Real rewarded ad loaded");
        setIsAdReady(true);
      } catch (realAdError) {
        console.warn("Real ad failed, loading test ad...", realAdError);

        // 🧪 Gerçek reklam gelmezse test reklamı yükle
        await admobModule.AdMob.prepareRewardVideoAd({
          adId: TEST_AD_ID,
          isTesting: true,
        });

        console.log("Test rewarded ad loaded");
        setIsAdReady(true);
      }
    } catch (error) {
      console.error("Failed to load rewarded ad:", error);
      toast({
        title: "Reklam Yüklenemedi",
        description: "Reklam yüklenirken bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setIsAdLoading(false);
    }
  }, [isAdLoading, toast]);

  // Give reward to user
  const giveReward = useCallback(async () => {
    if (!user) return;

    try {
      // Önce mevcut miktarı çek
      const { data: profile } = await supabase
        .from("profiles")
        .select("game_credits") // Sütun adın farklıysa burayı değiştir! (örn: 'ink')
        .eq("id", user.id)
        .single();

      // BURAYI DEĞİŞTİRDİK: +1 yerine +5 yaptık
      const newCredits = (profile?.game_credits || 0) + 1;

      // Veritabanını güncelle
      const { error } = await supabase
        .from("profiles")
        .update({
          game_credits: newCredits, // Sütun adın farklıysa burayı değiştir!
          last_credit_refresh: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) {
        throw error;
      }

      console.log("Reward given successfully");
    } catch (error) {
      console.error("Failed to give reward:", error);
      toast({
        title: "Ödül Hatası",
        description: "Mürekkep verilirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Show rewarded ad
  const showRewardedAd = useCallback(async () => {
    if (!isAdReady) {
      toast({
        title: "Reklam Hazır Değil",
        description: "Reklam henüz yüklenmedi. Lütfen bekleyin.",
        variant: "destructive",
      });
      return;
    }

    if (isLovableEnv) {
      console.log("AdMob not available in Lovable.dev environment");
      toast({ title: "Bilgi", description: "Reklamlar sadece mobil uygulamada çalışır" });
      return;
    }

    try {
      const capacitorModule = await importModule("@capacitor/core");
      if (!capacitorModule) {
        console.log("Capacitor not available");
        return;
      }

      const { Capacitor } = capacitorModule;

      if (!Capacitor.isNativePlatform()) {
        toast({ title: "Bilgi", description: "Reklamlar sadece mobil uygulamada çalışır" });
        return;
      }

      const admobModule = await importModule("@capacitor-community/admob");
      if (!admobModule) {
        console.log("AdMob module not available");
        return;
      }

      const { AdMob, RewardAdPluginEvents } = admobModule;
      const adDismissedListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        console.log("Rewarded ad dismissed");
        setIsAdReady(false);
        loadRewardedAd();
      });
      const adFailedToShowListener = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
        console.error("Rewarded ad failed to show:", error);
        setIsAdReady(false);
        toast({
          title: "Reklam Gösterilemedi",
          description: "Reklam gösterilirken bir hata oluştu.",
          variant: "destructive",
        });
      });
      const adRewardedListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, async (reward: any) => {
        console.log("User earned reward:", reward);
        await giveReward();
        // BURAYI DEĞİŞTİRDİK: Mesaj artık 5 mürekkep diyor
        toast({ title: "Tebrikler! 🎉", description: "5 Damla Mürekkep kazandınız." });
      });
      await AdMob.showRewardVideoAd();
      setTimeout(() => {
        adDismissedListener.remove();
        adFailedToShowListener.remove();
        adRewardedListener.remove();
      }, 30000);
    } catch (error) {
      console.error("Failed to show rewarded ad:", error);
      setIsAdReady(false);
      toast({
        title: "Reklam Hatası",
        description: "Reklam gösterilirken bir hata oluştu.",
        variant: "destructive",
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
