import { useState, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";

// Sadece ana kütüphaneyi çekiyoruz
import { Purchases } from "@revenuecat/purchases-capacitor";

export const useNativePurchases = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { refreshProfile } = useUser();

  // RevenueCat Başlatma
  useEffect(() => {
    const init = async () => {
      // Sadece mobilde çalışsın
      if (!Capacitor.isNativePlatform()) return;

      try {
        // API Key ayarı
        const apiKey = Capacitor.getPlatform() === "ios" ? "appl_NdOevMcvFJVECmCqnnIFrZtWVNa" : "goog_ZHVTnZDoizRWRGlAYnXJzTxUxCl";

        // RevenueCat'i yapılandır
        await Purchases.configure({ apiKey });
        console.log("RevenueCat başarıyla başlatıldı");
      } catch (e) {
        console.error("RevenueCat başlatma hatası:", e);
      }
    };
    init();
  }, []);

  // SATIN ALMA FONKSİYONU
  const purchasePackage = useCallback(
    async (packageIdentifier: string) => {
      if (!Capacitor.isNativePlatform()) {
        toast({ title: "Hata", description: "Satın alma sadece mobilde çalışır", variant: "destructive" });
        return false;
      }

      setIsLoading(true);
      try {
        // 1. Market paketlerini çek
        const offerings = await Purchases.getOfferings();
        const currentOffering = offerings.current;

        if (!currentOffering || !currentOffering.availablePackages) {
          throw new Error("Market paketleri bulunamadı.");
        }

        // 2. İstenen paketi bul
        const packageToBuy = currentOffering.availablePackages.find((pkg: any) => pkg.identifier === packageIdentifier);

        if (!packageToBuy) {
          throw new Error(`Paket bulunamadı: ${packageIdentifier}`);
        }

        // 3. Satın al
        const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToBuy });

        console.log("Satın alma başarılı:", customerInfo);
        return true;
      } catch (error: any) {
        if (
          error.userCancelled === true ||
          error.code === "PURCHASE_CANCELLED_ERROR" ||
          error.code === 1 ||
          error.message?.toLowerCase().includes("cancel") ||
          error.message?.toLowerCase().includes("dismiss")
        ) {
          // Sessizce geç
        } else {
          console.error("Satın alma hatası:", error);
          toast({ title: "Hata", description: error.message || "Satın alma başarısız", variant: "destructive" });
        }
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
  );

  // RESTORE (Geri Yükleme)
  const restorePurchases = useCallback(async () => {
    setIsLoading(true);
    try {
      await Purchases.restorePurchases();
      toast({ title: "Başarılı", description: "Satın alımlar geri yüklendi." });
    } catch (e) {
      toast({ title: "Hata", description: "Geri yükleme başarısız.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  return {
    isLoading,
    purchasePackage,
    restorePurchases,
  };
};
