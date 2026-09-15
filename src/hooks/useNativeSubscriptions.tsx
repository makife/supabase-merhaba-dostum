import { useState, useCallback, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

// RevenueCat import
import { Purchases } from "@revenuecat/purchases-capacitor";

interface SubscriptionProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  period: "monthly" | "yearly";
}

// RevenueCat Product IDs - Google Play Console ve RevenueCat'teki ID'lerle AYNI olmalı
export const SUBSCRIPTION_PRODUCT_IDS = {
  PREMIUM_MONTHLY: "premium_monthly",
  PREMIUM_YEARLY: "premium_yearly",
} as const;

export const useNativeSubscriptions = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const [offerings, setOfferings] = useState<any>(null);
  const { toast } = useToast();
  const { refreshProfile } = useUser();

  const subscriptionProductsRef = useRef<SubscriptionProduct[]>([
    {
      id: SUBSCRIPTION_PRODUCT_IDS.PREMIUM_MONTHLY,
      title: "Aylık Premium",
      description: "Premium özellikler, aylık otomatik yenilenme",
      price: "₺249.99",
      currency: "TRY",
      period: "monthly",
    },
    {
      id: SUBSCRIPTION_PRODUCT_IDS.PREMIUM_YEARLY,
      title: "Yıllık Premium",
      description: "Premium özellikler, yıllık otomatik yenilenme (%50 indirim)",
      price: "₺1499.99",
      currency: "TRY",
      period: "yearly",
    },
  ]);

  // Veritabanında abonelik durumunu güncelle - Gerçek bitiş tarihi ile
  const updateSubscriptionInDatabase = useCallback(
    async (productId: string, isActive: boolean, expirationDate?: Date | null) => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        let subscriptionEnd: Date | null = null;

        if (isActive) {
          if (expirationDate) {
            // RevenueCat'ten gelen gerçek bitiş tarihi
            subscriptionEnd = expirationDate;
            console.log("📅 Using real expiration date from RevenueCat:", subscriptionEnd);
          } else {
            // Fallback: Hesaplanan tarih
            subscriptionEnd = new Date();
            if (productId === SUBSCRIPTION_PRODUCT_IDS.PREMIUM_MONTHLY) {
              subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
            } else if (productId === SUBSCRIPTION_PRODUCT_IDS.PREMIUM_YEARLY) {
              subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
            }
            console.log("📅 Using calculated expiration date:", subscriptionEnd);
          }
        }

        const { error } = await supabase
          .from("profiles")
          .update({
            premium_until: subscriptionEnd ? subscriptionEnd.toISOString() : null,
            premium_type: isActive ? productId : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.user.id);

        if (error) {
          console.error("Failed to update subscription in database:", error);
          throw error;
        }

        // Satın alma kaydı oluştur
        if (isActive) {
          await supabase.from("user_purchases").insert({
            user_id: user.user.id,
            item_id: productId,
            item_type: "subscription",
            is_active: true,
          });
        }

        console.log("✅ Subscription updated in database:", { isActive, subscriptionEnd });
      } catch (error) {
        console.error("Database update failed:", error);
        throw error;
      }
    },
    [],
  );

  // Abonelik durumunu kontrol et - RevenueCat'ten gerçek tarihi al ve DB'yi güncelle
  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Önce veritabanından kontrol et
      const { data: profile } = await supabase.from("profiles").select("premium_until").eq("id", user.user.id).single();

      let dbPremiumUntil: Date | null = null;
      if (profile?.premium_until) {
        dbPremiumUntil = new Date(profile.premium_until);
        const now = new Date();
        const isActive = dbPremiumUntil > now;

        setIsSubscribed(isActive);
        if (isActive) {
          setSubscriptionInfo({
            expiryDate: dbPremiumUntil,
            isActive: true,
          });
        } else {
          setSubscriptionInfo(null);
        }
      } else {
        setIsSubscribed(false);
        setSubscriptionInfo(null);
      }

      // Native platformdaysa RevenueCat'ten gerçek abonelik bilgisini al
      if (Capacitor.isNativePlatform()) {
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          const activeSubscriptions = customerInfo.activeSubscriptions || [];

          console.log("🔍 RevenueCat check - Active subscriptions:", activeSubscriptions);
          console.log("🔍 RevenueCat entitlements:", customerInfo.entitlements);

          if (activeSubscriptions.length > 0) {
            // Entitlements'tan gerçek bitiş tarihini al
            const entitlements = customerInfo.entitlements?.active || {};
            let latestExpirationDate: Date | null = null;
            let activeProductId: string | null = null;

            // Tüm aktif entitlement'ları kontrol et
            for (const [key, entitlement] of Object.entries(entitlements)) {
              const ent = entitlement as any;
              if (ent.expirationDate) {
                const expDate = new Date(ent.expirationDate);
                if (!latestExpirationDate || expDate > latestExpirationDate) {
                  latestExpirationDate = expDate;
                  activeProductId = ent.productIdentifier || activeSubscriptions[0];
                }
                console.log(`📅 Entitlement "${key}" expires: ${expDate.toISOString()}`);
              }
            }

            // DB'deki tarih ile RevenueCat'teki tarihi karşılaştır
            if (latestExpirationDate) {
              const shouldUpdateDb =
                !dbPremiumUntil || latestExpirationDate.getTime() > dbPremiumUntil.getTime() + 60000; // 1 dakika tolerans

              if (shouldUpdateDb) {
                console.log("🔄 Subscription renewed! Updating DB with new expiration:", latestExpirationDate);
                await updateSubscriptionInDatabase(
                  activeProductId || SUBSCRIPTION_PRODUCT_IDS.PREMIUM_MONTHLY,
                  true,
                  latestExpirationDate,
                );
                await refreshProfile();
              }

              setIsSubscribed(true);
              setSubscriptionInfo({
                expiryDate: latestExpirationDate,
                isActive: true,
                productId: activeProductId,
              });
            } else {
              // Entitlement'tan tarih alınamadıysa aktif abonelik var demektir
              setIsSubscribed(true);
              console.log("⚠️ Active subscription but no expiration date found");
            }
          } else if (dbPremiumUntil && dbPremiumUntil > new Date()) {
            // RevenueCat'te aktif yok ama DB'de var - muhtemelen iptal edilmiş, mevcut süre bitene kadar devam et
            console.log("ℹ️ No active RevenueCat subscription but DB has valid premium_until");
          }
        } catch (rcError) {
          console.log("RevenueCat check skipped:", rcError);
        }
      }
    } catch (error) {
      console.error("Failed to check subscription status:", error);
    }
  }, [updateSubscriptionInDatabase, refreshProfile]);

  // RevenueCat offerings'i yükle
  const loadOfferings = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const offeringsResult = await Purchases.getOfferings();
      if (offeringsResult.current) {
        setOfferings(offeringsResult.current);
        console.log("Loaded offerings:", offeringsResult.current);
      }
    } catch (error) {
      console.error("Failed to load offerings:", error);
    }
  }, []);

  // GERÇEK RevenueCat abonelik satın alma
  const purchaseSubscription = useCallback(
    async (productId: string): Promise<boolean> => {
      if (!Capacitor.isNativePlatform()) {
        toast({
          title: "Bilgi",
          description: "Abonelik satın alma sadece mobil uygulamada çalışır",
          variant: "default",
        });
        return false;
      }

      try {
        setIsLoading(true);
        console.log("Starting subscription purchase for:", productId);

        // Offerings'i al
        const offeringsResult = await Purchases.getOfferings();
        const currentOffering = offeringsResult.current;

        if (!currentOffering || !currentOffering.availablePackages) {
          console.error("No offerings available");
          toast({
            title: "Hata",
            description: "Abonelik paketleri yüklenemedi. Lütfen tekrar deneyin.",
            variant: "destructive",
          });
          return false;
        }

        console.log(
          "Available packages:",
          currentOffering.availablePackages.map((p: any) => ({
            identifier: p.identifier,
            productId: p.product?.identifier,
          })),
        );

        // Package'ı bul - hem package identifier hem product identifier'a bak
        const packageToPurchase = currentOffering.availablePackages.find(
          (pkg: any) =>
            pkg.identifier === productId ||
            pkg.product?.identifier === productId ||
            pkg.identifier === `$rc_${productId}` ||
            pkg.product?.identifier?.includes(productId),
        );

        if (!packageToPurchase) {
          console.error("Package not found for productId:", productId);
          console.log(
            "Available identifiers:",
            currentOffering.availablePackages.map((p: any) => p.identifier),
          );
          toast({
            title: "Hata",
            description: `Abonelik paketi bulunamadı: ${productId}`,
            variant: "destructive",
          });
          return false;
        }

        console.log("Purchasing package:", packageToPurchase);

        // RevenueCat ile satın al
        const { customerInfo } = await Purchases.purchasePackage({
          aPackage: packageToPurchase,
        });

        console.log("Purchase successful, customerInfo:", customerInfo);

        // Satın alma başarılı - veritabanını güncelle
        await updateSubscriptionInDatabase(productId, true);

        setIsSubscribed(true);

        const expiryDate = new Date();
        if (productId === SUBSCRIPTION_PRODUCT_IDS.PREMIUM_MONTHLY) {
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        } else {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        }

        setSubscriptionInfo({
          productId,
          expiryDate,
          isActive: true,
        });

        await refreshProfile();
        return true;
      } catch (error: any) {
        console.error("Subscription purchase failed:", error);

        // Kullanıcı iptal ettiyse
        if (
          error.code === "PURCHASE_CANCELLED_ERROR" ||
          error.userCancelled === true ||
          error.code === 1 || // Google Play iptal kodu
          error.message?.toLowerCase().includes("cancel") ||
          error.message?.toLowerCase().includes("dismiss")
        ) {
          // Sessizce geç — kullanıcı zaten biliyor, toast gösterme
        } else {
          toast({
            title: "Abonelik Hatası",
            description: error.message || "Abonelik satın alma işlemi başarısız oldu",
            variant: "destructive",
          });
        }

        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshProfile, toast, updateSubscriptionInDatabase],
  );

  // Satın alımları geri yükle - Gerçek bitiş tarihi ile
  const restoreSubscriptions = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      toast({
        title: "Bilgi",
        description: "Bu özellik sadece mobil uygulamada çalışır",
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log("🔄 Restoring subscriptions...");

      const customerInfo = await Purchases.restorePurchases();
      const activeSubscriptions = customerInfo.activeSubscriptions || [];
      const entitlements = customerInfo.entitlements?.active || {};

      console.log("Restored subscriptions:", activeSubscriptions);
      console.log("Restored entitlements:", entitlements);

      if (activeSubscriptions.length > 0) {
        // Aktif abonelik bulundu - gerçek bitiş tarihi ile veritabanını güncelle
        for (const subId of activeSubscriptions) {
          // Bu subscription için entitlement'tan bitiş tarihini bul
          let expirationDate: Date | null = null;

          for (const [key, entitlement] of Object.entries(entitlements)) {
            const ent = entitlement as any;
            if (ent.productIdentifier === subId && ent.expirationDate) {
              expirationDate = new Date(ent.expirationDate);
              break;
            }
          }

          // Eğer direkt bulunamadıysa, herhangi bir aktif entitlement'tan al
          if (!expirationDate) {
            for (const [key, entitlement] of Object.entries(entitlements)) {
              const ent = entitlement as any;
              if (ent.expirationDate) {
                expirationDate = new Date(ent.expirationDate);
                break;
              }
            }
          }

          console.log(`📅 Restoring ${subId} with expiration:`, expirationDate);
          await updateSubscriptionInDatabase(subId, true, expirationDate);
        }

        setIsSubscribed(true);
        toast({
          title: "Geri Yükleme Başarılı",
          description: "Aboneliğiniz geri yüklendi!",
        });
      } else {
        toast({
          title: "Bilgi",
          description: "Geri yüklenecek aktif abonelik bulunamadı",
        });
      }

      await refreshProfile();
    } catch (error) {
      console.error("Failed to restore subscriptions:", error);
      toast({
        title: "Hata",
        description: "Abonelik geri yüklenemedi",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [refreshProfile, toast, updateSubscriptionInDatabase]);

  const cancelSubscription = useCallback(async () => {
    toast({
      title: "Abonelik İptali",
      description: "Aboneliğinizi iptal etmek için Google Play Store veya App Store ayarlarını kullanın",
    });
  }, [toast]);

  const openSubscriptionManagement = useCallback(async () => {
    toast({
      title: "Abonelik Yönetimi",
      description: "Google Play Store veya App Store abonelik ayarlarını kullanın",
    });
  }, [toast]);

  // Başlangıçta offerings'i yükle ve durumu kontrol et
  useEffect(() => {
    checkSubscriptionStatus();
    if (Capacitor.isNativePlatform()) {
      loadOfferings();
    }
  }, [checkSubscriptionStatus, loadOfferings]);

  return {
    isLoading,
    subscriptionProducts: subscriptionProductsRef.current,
    isSubscribed,
    subscriptionInfo,
    offerings,
    purchaseSubscription,
    restoreSubscriptions,
    checkSubscriptionStatus,
    cancelSubscription,
    openSubscriptionManagement,
  };
};
