import { useState, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { setPendingAction, clearPendingAction } from "@/utils/pendingActionState";

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
        const apiKey = Capacitor.getPlatform() === "ios" ? "appl_SENIN_IOS_KEYIN" : "goog_ZHVTnZDoizRWRGlAYnXJzTxUxCl";

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
        // 🔥 Pending action kaydet - app ölürse geri geldiğinde kontrol edilecek
        await setPendingAction({
          type: 'payment',
          startedAt: Date.now(),
          context: 'purchase',
          productId: packageIdentifier,
        });

        // 1. Market paketlerini çek
        const offerings = await Purchases.getOfferings();
        const currentOffering = offerings.current;

        if (!currentOffering || !currentOffering.availablePackages) {
          await clearPendingAction();
          throw new Error("Market paketleri bulunamadı.");
        }

        // 2. İstenen paketi bul
        const packageToBuy = currentOffering.availablePackages.find((pkg: any) => pkg.identifier === packageIdentifier);

        if (!packageToBuy) {
          await clearPendingAction();
          throw new Error(`Paket bulunamadı: ${packageIdentifier}`);
        }

        // 3. Satın al
        const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToBuy });

        // ✅ Başarılı - pending action temizle
        await clearPendingAction();

        console.log("Satın alma başarılı:", customerInfo);
        return true;
      } catch (error: any) {
        if (error.userCancelled) {
          // User cancelled - pending action temizle
          await clearPendingAction();
          console.log("Kullanıcı iptal etti");
        } else {
          // Diğer hatalar için pending action'ı bırak (recovery için)
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
