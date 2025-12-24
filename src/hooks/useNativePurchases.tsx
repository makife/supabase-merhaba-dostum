import { useState, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";

// RevenueCat Tipleri
import { Purchases, PurchasesPackage, LOG_LEVEL } from "@revenuecat/purchases-capacitor";

export const useNativePurchases = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { refreshProfile, profile } = useUser();

  // RevenueCat Başlatma
  useEffect(() => {
    const init = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        // Log seviyesini ayarla
        await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

        // API Key'leri Supabase Secrets veya buraya hardcode girebilirsin şimdilik
        const apiKey = Capacitor.getPlatform() === "ios" ? "appl_SENIN_IOS_KEYIN" : "goog_ZHVTnZDoizRWRGlAYnXJzTxUxCl"; // Buraya kendi RevenueCat keyini yazabilirsin ya da env'den çek

        await Purchases.configure({ apiKey });
        console.log("RevenueCat başarıyla başlatıldı");
      } catch (e) {
        console.error("RevenueCat başlatma hatası:", e);
      }
    };
    init();
  }, []);

  // SATIN ALMA FONKSİYONU (Esas İş Burası)
  const purchasePackage = useCallback(
    async (packageIdentifier: string) => {
      if (!Capacitor.isNativePlatform()) {
        toast({ title: "Hata", description: "Satın alma sadece mobilde çalışır", variant: "destructive" });
        return false;
      }

      setIsLoading(true);
      try {
        // 1. Mevcut paketleri (offerings) çek
        const offerings = await Purchases.getOfferings();

        // 2. İstenen paketi bul (current offering içinde)
        const currentOffering = offerings.current;
        if (!currentOffering) throw new Error("Market paketleri bulunamadı (Offering yok).");

        const packageToBuy = currentOffering.availablePackages.find((pkg) => pkg.identifier === packageIdentifier);

        if (!packageToBuy) {
          throw new Error(`Paket bulunamadı: ${packageIdentifier}`);
        }

        // 3. Satın almayı başlat (Google Play penceresi açılır)
        const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToBuy });

        // 4. Satın alma başarılıysa true dön
        console.log("Satın alma başarılı:", customerInfo);
        return true;
      } catch (error: any) {
        if (error.userCancelled) {
          console.log("Kullanıcı iptal etti");
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
    purchasePackage, // İsmini purchaseProduct yerine purchasePackage yaptım, daha doğru
    restorePurchases,
  };
};
