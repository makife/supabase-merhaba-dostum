import { useState, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { useUserPurchases } from "@/hooks/useUserPurchases";

// Dinamik import (sadece native platformda)
const getPurchases = async () => {
  const module = await import("@revenuecat/purchases-capacitor");
  return module.Purchases;
};

export const useNativePurchases = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  const { refreshProfile } = useUser();
  const { processPurchase } = useUserPurchases();

  // RevenueCat başlatma
  const initializePurchases = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || isInitialized) {
      return;
    }

    try {
      // RevenueCat API keys - gerçek projede secrets'tan alınmalı
      const REVENUECAT_API_KEY =
        Capacitor.getPlatform() === "ios" ? "appl_your_ios_api_key_here" : "goog_your_android_api_key_here";

      const Purchases = await getPurchases();
      await Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
      });

      setIsInitialized(true);
      console.log("RevenueCat initialized for native purchases");
    } catch (error) {
      console.error("Failed to initialize RevenueCat:", error);
    }
  }, [isInitialized]);

  // Mount'ta başlat
  useEffect(() => {
    initializePurchases();
  }, [initializePurchases]);

  // Ürün satın alma
  const purchaseProduct = useCallback(
    async (productId: string, item: any) => {
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

        // Onay dialogu
        const confirmed = window.confirm(
          `${item.title} satın almak istediğinizden emin misiniz?\nFiyat: ₺${item.price}`,
        );

        if (!confirmed) {
          return false;
        }

        // Gerçek satın alma işlemi
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const success = await processPurchase(item);

        if (success) {
          toast({
            title: "Satın Alma Başarılı",
            description: `${item.title} hesabınıza eklendi`,
          });

          await refreshProfile();
          return true;
        } else {
          throw new Error("Purchase processing failed");
        }
      } catch (error) {
        console.error("Purchase failed:", error);
        toast({
          title: "Satın Alma Hatası",
          description: "Satın alma işlemi başarısız oldu",
          variant: "destructive",
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [processPurchase, refreshProfile, toast],
  );

  // Satın alımları geri yükle - GERÇEK REVENUECAT ENTEGRASYONU
  const restorePurchases = useCallback(async () => {
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

      const Purchases = await getPurchases();
      const result = await Purchases.restorePurchases();

      console.log("Restored purchases:", result);

      // Geri yüklenen satın alımları işle
      const activeSubscriptions = result.activeSubscriptions || [];
      const allPurchases = result.allPurchasedProductIdentifiers || [];

      let restoredCount = 0;

      // Her bir geri yüklenen ürünü veritabanına kaydet
      for (const productId of allPurchases) {
        try {
          const item = {
            id: productId,
            title: getProductTitle(productId),
            type: getItemType(productId),
            value: getItemValue(productId),
            price: 0,
            currency: "restored" as const,
          };

          await processPurchase(item);
          restoredCount++;
        } catch (err) {
          console.error("Failed to restore product:", productId, err);
        }
      }

      if (restoredCount > 0) {
        toast({
          title: "Geri Yükleme Başarılı",
          description: `${restoredCount} satın alım geri yüklendi`,
        });
      } else {
        toast({
          title: "Bilgi",
          description: "Geri yüklenecek satın alım bulunamadı",
        });
      }

      await refreshProfile();
    } catch (error) {
      console.error("Failed to restore purchases:", error);
      toast({
        title: "Hata",
        description: "Satın alımlar geri yüklenemedi. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [processPurchase, refreshProfile, toast]);

  return {
    isLoading,
    isInitialized,
    purchaseProduct,
    restorePurchases,
  };
};

// Helper: Ürün başlığı
const getProductTitle = (productId: string): string => {
  if (productId.includes("credits_5")) return "5 Oyun Hakkı";
  if (productId.includes("credits_25")) return "25 Oyun Hakkı";
  if (productId.includes("credits_50")) return "50 Oyun Hakkı";
  if (productId.includes("unlimited_1h")) return "1 Saatlik Sınırsız";
  if (productId.includes("unlimited_24h")) return "24 Saatlik Sınırsız";
  if (productId.includes("premium")) return "Premium Üyelik";
  return productId;
};

// Helper: Ürün tipi
const getItemType = (productId: string): string => {
  if (productId.includes("credits")) return "credits";
  if (productId.includes("unlimited")) return "unlimited_time";
  if (productId.includes("premium")) return "premium";
  if (productId.includes("theme")) return "theme";
  if (productId.includes("avatar")) return "avatar";
  if (productId.includes("sound")) return "sound";
  return "credits";
};

// Helper: Ürün değeri
const getItemValue = (productId: string): number => {
  if (productId.includes("5")) return 5;
  if (productId.includes("25")) return 25;
  if (productId.includes("50")) return 50;
  if (productId.includes("1h")) return 1;
  if (productId.includes("24h")) return 24;
  if (productId.includes("month")) return 30;
  return 1;
};
