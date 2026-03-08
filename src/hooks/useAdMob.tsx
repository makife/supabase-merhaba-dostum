import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

// AdMob modülü dinamik import (sadece native'de yüklenir)
let admobModuleCache: any = null;
const getAdMobModule = async () => {
  if (admobModuleCache) return admobModuleCache;
  try {
    admobModuleCache = await import("@capacitor-community/admob");
    return admobModuleCache;
  } catch (e) {
    console.error("[AdMob] Module import failed:", e);
    return null;
  }
};

export const useAdMob = () => {
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [isAdReady, setIsAdReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // ✅ Senkron platform kontrolü - dinamik import KULLANMA
  const isNativePlatform = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  console.log("[AdMob] Platform:", platform, "isNative:", isNativePlatform);

  // Initialize AdMob
  const initializeAdMob = useCallback(async (): Promise<boolean> => {
    if (!isNativePlatform) {
      console.log("[AdMob] Skipping init - not native platform");
      return false;
    }

    if (isInitialized) {
      console.log("[AdMob] Already initialized");
      return true;
    }

    try {
      const admobModule = await getAdMobModule();
      if (!admobModule) {
        console.error("[AdMob] AdMob module not found");
        return false;
      }

      await admobModule.AdMob.initialize({
        testingDevices: [],
        initializeForTesting: false,
      });
      setIsInitialized(true);
      console.log("[AdMob] ✅ Initialized successfully");
      return true;
    } catch (error) {
      console.error("[AdMob] ❌ Initialization failed:", error);
      return false;
    }
  }, [isNativePlatform, isInitialized]);

  // Load rewarded ad
  const loadRewardedAd = useCallback(async (): Promise<boolean> => {
    if (isAdLoading) {
      console.log("[AdMob] Already loading an ad");
      return false;
    }

    if (!isNativePlatform) {
      console.log("[AdMob] Not native platform - cannot load ad");
      toast({
        title: "Bilgi",
        description: "Reklamlar sadece mobil uygulamada çalışır",
      });
      return false;
    }

    // 🔧 KRİTİK: Önce initialize edildiğinden emin ol
    if (!isInitialized) {
      console.log("[AdMob] Not initialized yet, initializing first...");
      const initSuccess = await initializeAdMob();
      if (!initSuccess) {
        console.error("[AdMob] Failed to initialize before loading ad");
        toast({
          title: "AdMob Hatası",
          description: "Reklam sistemi başlatılamadı",
          variant: "destructive",
        });
        return false;
      }
    }

    setIsAdLoading(true);
    setIsAdReady(false);

    try {
      const admobModule = await getAdMobModule();
      if (!admobModule) {
        console.error("[AdMob] AdMob module not found");
        setIsAdLoading(false);
        return false;
      }

      // 👇 GELİŞTİRME MODU AYARI (Test reklamları için TRUE yap)
      const IS_DEVELOPMENT_MODE = false;

      const isIOS = platform === "ios";

      // Gerçek ID'ler
      const REAL_AD_ID = isIOS ? "ca-app-pub-4768026665961339/6920222714" : "ca-app-pub-4768026665961339/4806604463";

      // Google Test ID - HER ZAMAN ÇALIŞMALI
      const TEST_AD_ID = "ca-app-pub-3940256099942544/5224354917";

      // Mod'a göre ID seç
      const adIdToUse = IS_DEVELOPMENT_MODE ? TEST_AD_ID : REAL_AD_ID;

      console.log(
        `[AdMob] 📺 Loading ad... Platform: ${isIOS ? "iOS" : "Android"}, Mode: ${IS_DEVELOPMENT_MODE ? "TEST" : "REAL"}`,
      );
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
      const errorMsg = error?.message || error?.errorMessage || JSON.stringify(error) || "Bilinmeyen hata";
      console.error("[AdMob] ❌ Failed to load rewarded ad:", error);
      console.error("[AdMob] ❌ Error message:", errorMsg);
      console.error("[AdMob] ❌ Error code:", error?.code);
      console.error("[AdMob] ❌ Error details:", JSON.stringify(error));
      setIsAdReady(false);
      setIsAdLoading(false);
      
      // Return error info so caller can show meaningful message
      return { success: false, error: errorMsg, code: error?.code } as any;
    }
  }, [isAdLoading, isNativePlatform, isInitialized, initializeAdMob, platform, toast]);

  // Give reward to user
  const giveReward = useCallback(async () => {
    if (!user) {
      console.log("[AdMob] No user - cannot give reward");
      return;
    }

    try {
      const { data: profile } = await supabase.from("profiles").select("ink_count").eq("id", user.id).single();

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
      // 🔧 KRİTİK: Profili hemen yenile - UI anında güncellensin
      window.dispatchEvent(new CustomEvent("refreshProfile"));
    } catch (error) {
      console.error("[AdMob] ❌ Failed to give reward:", error);
      toast({
        title: "Ödül Hatası",
        description: "Ödül verilirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Show rewarded ad - optional custom reward callback
  const showRewardedAd = useCallback(
    async (customReward?: () => Promise<void>): Promise<boolean> => {
      if (!isNativePlatform) {
        toast({ title: "Bilgi", description: "Reklamlar sadece mobil uygulamada çalışır" });
        return false;
      }

      try {
        const admobModule = await getAdMobModule();
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

            const dismissedListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
              console.log("[AdMob] 📺 Ad dismissed");
              setIsAdReady(false);
              if (!resolved) {
                resolved = true;
                cleanup(listeners);
                resolve(true);
              }
            });
            listeners.push(dismissedListener);

            const failedListener = await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error: any) => {
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
            });
            listeners.push(failedListener);

            const rewardedListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, async (reward: any) => {
              console.log("[AdMob] 🎉 User earned reward:", reward);
              if (customReward) {
                await customReward();
              } else {
                await giveReward();
                toast({
                  title: "Tebrikler! 🎉",
                  description: "+1 Mürekkep kazandınız!",
                });
              }
            });
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
    },
    [isNativePlatform, giveReward, toast],
  );

  return {
    isAdLoading,
    isAdReady,
    isInitialized,
    initializeAdMob,
    loadRewardedAd,
    showRewardedAd,
  };
};
