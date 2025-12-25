import { useState, useCallback, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionProduct {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  period: "monthly" | "yearly";
}

export const useNativeSubscriptions = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);
  const { toast } = useToast();
  const { refreshProfile } = useUser();

  // DÜZELTME: subscriptionProducts'u ref ile sabitleyerek re-render'ları önle
  const subscriptionProductsRef = useRef<SubscriptionProduct[]>([
    {
      id: "premium_month",
      title: "Aylık Premium",
      description: "Premium özellikler, aylık otomatik yenilenme",
      price: "₺29.99",
      currency: "TRY",
      period: "monthly",
    },
    {
      id: "premium_year",
      title: "Yıllık Premium",
      description: "Premium özellikler, yıllık otomatik yenilenme (%40 indirim)",
      price: "₺199.99",
      currency: "TRY",
      period: "yearly",
    },
  ]);

  // DÜZELTME: updateSubscriptionInDatabase'i useCallback ile stabilize et
  const updateSubscriptionInDatabase = useCallback(async (productId: string, isActive: boolean) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Calculate subscription end date
      const subscriptionEnd = new Date();
      if (productId === "premium_month") {
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
      } else if (productId === "premium_year") {
        subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
      }

      // Update user profile with premium status
      const { error } = await supabase
        .from("profiles")
        .update({
          premium_until: isActive ? subscriptionEnd.toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.user.id);

      if (error) {
        console.error("Failed to update subscription in database:", error);
        throw error;
      }

      console.log("Subscription updated in database:", { isActive, subscriptionEnd });
    } catch (error) {
      console.error("Database update failed:", error);
      throw error;
    }
  }, []); // Boş dependency array

  // DÜZELTME: checkSubscriptionStatus'u stabilize et
  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: profile } = await supabase.from("profiles").select("premium_until").eq("id", user.user.id).single();

      if (profile?.premium_until) {
        const premiumUntil = new Date(profile.premium_until);
        const now = new Date();
        const isActive = premiumUntil > now;

        setIsSubscribed(isActive);
        if (isActive) {
          setSubscriptionInfo({
            expiryDate: premiumUntil,
            isActive: true,
          });
        } else {
          setSubscriptionInfo(null);
          // If expired, clear the database
          await updateSubscriptionInDatabase("", false);
        }
      } else {
        setIsSubscribed(false);
        setSubscriptionInfo(null);
      }
    } catch (error) {
      console.error("Failed to check subscription status:", error);
    }
  }, [updateSubscriptionInDatabase]);

  // DÜZELTME: purchaseSubscription'ı stabilize et
  const purchaseSubscription = useCallback(
    async (productId: string) => {
      if (!Capacitor.isNativePlatform()) {
        toast({
          title: "Hata",
          description: "Bu özellik sadece mobil uygulamada çalışır",
          variant: "destructive",
        });
        return false;
      }

      try {
        setIsLoading(true);

        const product = subscriptionProductsRef.current.find((p) => p.id === productId);
        if (!product) return false;

        // Show confirmation dialog
        const confirmed = window.confirm(
          `${product.title} aboneliği satın almak istediğinizden emin misiniz?\n\nFiyat: ${product.price}\nOtomatik yenilenme: ${product.period === "monthly" ? "Aylık" : "Yıllık"}\n\nAbonelik Google Play Store / App Store üzerinden işlenecektir.`,
        );

        if (!confirmed) {
          return false;
        }

        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 2500));

        // Update subscription in database
        await updateSubscriptionInDatabase(productId, true);

        setIsSubscribed(true);

        const expiryDate = new Date();
        if (product.period === "monthly") {
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        } else {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        }

        setSubscriptionInfo({
          productId,
          expiryDate,
          isActive: true,
          period: product.period,
        });

        toast({
          title: "Abonelik Başarılı!",
          description: `${product.title} aktif edildi. Premium özellikler kullanıma hazır!`,
        });

        await refreshProfile();
        return true;
      } catch (error) {
        console.error("Subscription purchase failed:", error);
        toast({
          title: "Abonelik Hatası",
          description: "Abonelik satın alma işlemi başarısız oldu",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [refreshProfile, toast, updateSubscriptionInDatabase],
  );

  // DÜZELTME: Diğer fonksiyonları da stabilize et
  const restoreSubscriptions = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      toast({
        title: "Hata",
        description: "Bu özellik sadece mobil uygulamada çalışır",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);

      // Simulate restore process
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await checkSubscriptionStatus();

      toast({
        title: "Başarılı",
        description: "Abonelik durumunuz kontrol edildi",
      });

      await refreshProfile();
    } catch (error) {
      console.error("Failed to restore subscriptions:", error);
      toast({
        title: "Hata",
        description: "Abonelik durumu kontrol edilemedi",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [refreshProfile, toast, checkSubscriptionStatus]);

  const cancelSubscription = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      toast({
        title: "Bilgi",
        description: "Aboneliği iptal etmek için Google Play Store veya App Store'u kullanın",
      });
      return;
    }

    try {
      setIsLoading(true);

      const confirmed = window.confirm(
        "Aboneliğinizi iptal etmek istediğinizden emin misiniz?\n\nMevcut premium döneminin sonuna kadar erişiminiz devam edecek.",
      );

      if (!confirmed) return;

      // Simulate cancellation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      toast({
        title: "Abonelik İptal Edildi",
        description: "Aboneliğiniz başarıyla iptal edildi. Mevcut dönem sonuna kadar premium özellikler aktif kalacak.",
      });
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      toast({
        title: "Hata",
        description: "Abonelik iptal edilemedi",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const openSubscriptionManagement = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      toast({
        title: "Bilgi",
        description: "Abonelik yönetimi için Google Play Store veya App Store'u kullanın",
      });
      return;
    }

    // This would open the native store's subscription management
    // In a real implementation, this would use store-specific APIs
    toast({
      title: "Abonelik Yönetimi",
      description: "Google Play Store veya App Store abonelik yönetimi açılıyor...",
    });
  }, [toast]);

  // DÜZELTME: useEffect dependency'sini checkSubscriptionStatus ile sınırla
  useEffect(() => {
    checkSubscriptionStatus();
  }, [checkSubscriptionStatus]);

  return {
    isLoading,
    subscriptionProducts: subscriptionProductsRef.current, // Ref'ten döndür
    isSubscribed,
    subscriptionInfo,
    purchaseSubscription,
    restoreSubscriptions,
    checkSubscriptionStatus,
    cancelSubscription,
    openSubscriptionManagement,
  };
};
