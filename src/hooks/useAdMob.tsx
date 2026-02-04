import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Runtime import fonksiyonu
const importModule = (moduleName: string) => {
  return import(/* @vite-ignore */ moduleName).catch(() => null);
};

export const useAdMob = () => {
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [isAdReady, setIsAdReady] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const isNativePlatformRef = useRef<boolean | null>(null);

  // Check if running on native platform
  const checkNativePlatform = useCallback(async (): Promise<boolean> => {
    if (isNativePlatformRef.current !== null) {
      return isNativePlatformRef.current;
    }

    try {
      const capacitorModule = await importModule("@capacitor/core");
      if (!capacitorModule) {
        isNativePlatformRef.current = false;
        return false;
      }
      const { Capacitor } = capacitorModule;
      const isNative = Capacitor.isNativePlatform();
      isNativePlatformRef.current = isNative;
      console.log("[AdMob] Platform check:", isNative ? "NATIVE" : "WEB");
      return isNative;
    } catch (error) {
      console.error("[AdMob] Platform check error:", error);
      isNativePlatformRef.current = false;
      return false;
    }
  }, []);

  // Initialize AdMob
  const initializeAdMob = useCallback(async () => {
    const isNative = await checkNativePlatform();
    if (!isNative) {
      console.log("[AdMob] Skipping init - not native platform");
      return;
    }

    try {
      const admobModule = await importModule("@capacitor-community/admob");
      if (!admobModule) {
        console.error("[AdMob] AdMob module not found");
        return;
      }

      await admobModule.AdMob.initialize({
        testingDevices: [],
        initializeForTesting: false,
      });
      console.log("[AdMob] ✅ Initialized successfully");
    } catch (error) {
      console.error("[AdMob] ❌ Initialization failed:", error);
    }
  }, [checkNativePlatform]);

  // Load rewarded ad
  const loadRewardedAd = useCallback(async (): Promise<boolean> => {
    if (isAdLoading) {
      console.log("[AdMob] Already loading an ad");
      return false;
    }

    const isNative = await checkNativePlatform();
    if (!isNative) {
      console.log("[AdMob] Not native - cannot load ad");
      toast({
        title: "Bilgi",
        description: "Reklamlar sadece mobil uygulamada çalışır",
      });
      return false;
    }

    setIsAdLoading(true);
    setIsAdReady(false);

    try {
      const admobModule = await importModule("@capacitor-community/admob");
      if (!admobModule) {
        console.error("[AdMob] AdMob module not found");
        setIsAdLoading(false);
        return false;
      }

      const capacitorModule = await importModule("@capacitor/core");
      if (!capacitorModule) {
        setIsAdLoading(false);
        return false;
      }
      const { Capacitor } = capacitorModule;

      // 👇 GELİŞTİRME MODU AYARI (Test reklamları için TRUE yap)
      const IS_DEVELOPMENT_MODE = true;

      const isIOS = Capacitor.getPlatform() === "ios";

      // Gerçek ID'ler
      const REAL_AD_ID = isIOS 
        ? "ca-app-pub-4768026665961339/6383991586" 
        : "ca-app-pub-4768026665961339/4806604463";

      // Google Test ID - HER ZAMAN ÇALIŞMALI
      const TEST_AD_ID = "ca-app-pub-3940256099942544/5224354917";

      // Mod'a göre ID seç
      const adIdToUse = IS_DEVELOPMENT_MODE ? TEST_AD_ID : REAL_AD_ID;

      console.log(`[AdMob] 📺 Loading ad... Platform: ${isIOS ? "iOS" : "Android"}, Mode: ${IS_DEVELOPMENT_MODE ? "TEST" : "REAL"}`);
      console.log(`[AdMob] 📺 Ad ID: ${adIdToUse}`);

      await admobModule.AdMob.prepareRewardVideoAd({
        adId: adIdToUse,
        isTesting: IS_DEVELOPMENT_MODE,
      });

      console.log("[AdMob] ✅ Rewarded ad prepared successfully");
      setIsAdReady(true);
      setIsAdLoading(false);
      return true;
    } catch (error: any) {
      console.error("[AdMob] ❌ Failed to load rewarded ad:", error);
      console.error("[AdMob] ❌ Error details:", JSON.stringify(error));
      setIsAdReady(false);
      setIsAdLoading(false);
      return false;
    }
  }, [isAdLoading, checkNativePlatform, toast]);

  // Give reward to user
  const giveReward = useCallback(async () => {
    if (!user) {
      console.log("[AdMob] No user - cannot give reward");
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("ink_count")
        .eq("id", user.id)
        .single();

      // +1 Mürekkep ver
      const newInkCount = (profile?.ink_count || 0) + 1;

      const { error } = await supabase
        .from("profiles")
        .update({
          ink_count: newInkCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;
      console.log("[AdMob] ✅ Reward given successfully, new ink:", newInkCount);
    } catch (error) {
      console.error("[AdMob] ❌ Failed to give reward:", error);
      toast({
        title: "Ödül Hatası",
        description: "Ödül verilirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Show rewarded ad
  const showRewardedAd = useCallback(async (): Promise<boolean> => {
    const isNative = await checkNativePlatform();
    if (!isNative) {
      toast({ title: "Bilgi", description: "Reklamlar sadece mobil uygulamada çalışır" });
      return false;
    }

    try {
      const admobModule = await importModule("@capacitor-community/admob");
      if (!admobModule) {
        console.error("[AdMob] AdMob module not found");
        return false;
      }

      const { AdMob, RewardAdPluginEvents } = admobModule;

      return new Promise<boolean>((resolve) => {
        let resolved = false;
        
        const cleanup = async (listeners: any[]) => {
          for (const listener of listeners) {
            try {
              await listener.remove();
            } catch (e) {
              // ignore
            }
          }
        };

        const setupListeners = async () => {
          const listeners: any[] = [];

          const dismissedListener = await AdMob.addListener(
            RewardAdPluginEvents.Dismissed,
            () => {
              console.log("[AdMob] 📺 Ad dismissed");
              setIsAdReady(false);
              if (!resolved) {
                resolved = true;
                cleanup(listeners);
                resolve(true);
              }
            }
          );
          listeners.push(dismissedListener);

          const failedListener = await AdMob.addListener(
            RewardAdPluginEvents.FailedToShow,
            (error: any) => {
              console.error("[AdMob] ❌ Ad failed to show:", error);
              setIsAdReady(false);
              toast({
                title: "Reklam Gösterilemedi",
                description: "Lütfen daha sonra tekrar deneyin.",
                variant: "destructive",
              });
              if (!resolved) {
                resolved = true;
                cleanup(listeners);
                resolve(false);
              }
            }
          );
          listeners.push(failedListener);

          const rewardedListener = await AdMob.addListener(
            RewardAdPluginEvents.Rewarded,
            async (reward: any) => {
              console.log("[AdMob] 🎉 User earned reward:", reward);
              await giveReward();
              toast({ 
                title: "Tebrikler! 🎉", 
                description: "+1 Mürekkep kazandınız!" 
              });
            }
          );
          listeners.push(rewardedListener);

          // Timeout cleanup
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              cleanup(listeners);
              resolve(false);
            }
          }, 120000); // 2 dakika timeout
        };

        setupListeners();

        console.log("[AdMob] 📺 Showing rewarded ad...");
        AdMob.showRewardVideoAd().catch((error: any) => {
          console.error("[AdMob] ❌ Show ad error:", error);
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        });
      });
    } catch (error) {
      console.error("[AdMob] ❌ Failed to show rewarded ad:", error);
      setIsAdReady(false);
      toast({
        title: "Reklam Hazır Değil",
        description: "Reklam yüklenemedi, lütfen tekrar deneyin.",
        variant: "destructive",
      });
      return false;
    }
  }, [checkNativePlatform, giveReward, toast]);

  return {
    isAdLoading,
    isAdReady,
    initializeAdMob,
    loadRewardedAd,
    showRewardedAd,
  };
};
