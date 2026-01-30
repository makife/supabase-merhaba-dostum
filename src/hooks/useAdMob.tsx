import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Lovable.dev ortamı kontrolü
const isLovableEnv = typeof window !== "undefined" && window.location.hostname.includes("lovable");

// Runtime import fonksiyonu
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
      return;
    }

    try {
      const capacitorModule = await importModule("@capacitor/core");
      if (!capacitorModule) return;
      const { Capacitor } = capacitorModule;

      if (!Capacitor.isNativePlatform()) return;

      const admobModule = await importModule("@capacitor-community/admob");
      if (!admobModule) return;

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
      // 🔥 DÜZELTME BURADA: Capacitor Core modülünü import ediyoruz
      const capacitorModule = await importModule("@capacitor/core");
      if (!capacitorModule) return;

      // 🔥 DÜZELTME BURADA: Capacitor değişkenini tanımlıyoruz
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

      // 👇 GELİŞTİRME MODU AYARI (Test reklamları için TRUE yap)
      const IS_DEVELOPMENT_MODE = true;

      const isIOS = Capacitor.getPlatform() === "ios";

      // Gerçek ID'ler
      const REAL_AD_ID = isIOS ? "ca-app-pub-4768026665961339/6383991586" : "ca-app-pub-4768026665961339/4806604463";

      // Google Test ID
      const TEST_AD_ID = "ca-app-pub-3940256099942544/5224354917";

      // Mod'a göre ID seç
      const adIdToUse = IS_DEVELOPMENT_MODE ? TEST_AD_ID : REAL_AD_ID;

      console.log(`Loading ad... Mode: ${IS_DEVELOPMENT_MODE ? "TEST" : "REAL"}`);

      await admobModule.AdMob.prepareRewardVideoAd({
        adId: adIdToUse,
        isTesting: IS_DEVELOPMENT_MODE,
      });

      console.log("Rewarded ad prepared successfully");
      setIsAdReady(true);
    } catch (error) {
      console.error("Failed to load rewarded ad:", error);
      setIsAdReady(false);
      // Hata detayını kullanıcıya gösterme, konsola bas
    } finally {
      setIsAdLoading(false);
    }
  }, [isAdLoading, toast]);

  // Give reward to user
  const giveReward = useCallback(async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase.from("profiles").select("game_credits").eq("id", user.id).single();

      // +1 Mürekkep ver (veya oyun mantığına göre değiştir)
      const newCredits = (profile?.game_credits || 0) + 1;

      const { error } = await supabase
        .from("profiles")
        .update({
          game_credits: newCredits,
          last_credit_refresh: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
      console.log("Reward given successfully");
    } catch (error) {
      console.error("Failed to give reward:", error);
      toast({
        title: "Ödül Hatası",
        description: "Ödül verilirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Show rewarded ad
  const showRewardedAd = useCallback(async () => {
    if (isLovableEnv) {
      toast({ title: "Bilgi", description: "Reklamlar sadece mobil uygulamada çalışır" });
      return;
    }

    try {
      const capacitorModule = await importModule("@capacitor/core");
      if (!capacitorModule) return;
      const { Capacitor } = capacitorModule;

      if (!Capacitor.isNativePlatform()) {
        toast({ title: "Bilgi", description: "Reklamlar sadece mobil uygulamada çalışır" });
        return;
      }

      const admobModule = await importModule("@capacitor-community/admob");
      if (!admobModule) return;

      const { AdMob, RewardAdPluginEvents } = admobModule;

      const adDismissedListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        console.log("Rewarded ad dismissed");
        setIsAdReady(false);
        loadRewardedAd(); // Bir sonraki reklamı önceden yükle
      });

      const adFailedToShowListener = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error: any) => {
        console.error("Rewarded ad failed to show:", error);
        setIsAdReady(false);
        toast({
          title: "Reklam Gösterilemedi",
          description: "Lütfen daha sonra tekrar deneyin.",
          variant: "destructive",
        });
      });

      const adRewardedListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, async (reward: any) => {
        console.log("User earned reward:", reward);
        await giveReward();
        toast({ title: "Tebrikler! 🎉", description: "Ödülünüzü kazandınız." });
      });

      await AdMob.showRewardVideoAd();

      // Listener temizliği (Memory leak önlemek için)
      setTimeout(() => {
        adDismissedListener.remove();
        adFailedToShowListener.remove();
        adRewardedListener.remove();
      }, 60000); // 1 dakika sonra listenerları temizle
    } catch (error) {
      console.error("Failed to show rewarded ad:", error);
      setIsAdReady(false);
      toast({
        title: "Reklam Hazır Değil",
        description: "Reklam yükleniyor, lütfen biraz bekleyip tekrar deneyin.",
        variant: "destructive",
      });
      // Hata alınca tekrar yüklemeyi dene
      loadRewardedAd();
    }
  }, [loadRewardedAd, giveReward, toast]);

  return {
    isAdLoading,
    isAdReady,
    initializeAdMob,
    loadRewardedAd,
    showRewardedAd,
  };
};
