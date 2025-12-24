import { useState, useCallback, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/contexts/UserContext";

// Sadece Purchases'ı import ediyoruz, hata veren tipleri kaldırdık
import { Purchases } from "@revenuecat/purchases-capacitor";

export const useNativePurchases = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  // useUser'dan gelen refreshProfile fonksiyonunu alıyoruz
  const { refreshProfile } = useUser();

  // RevenueCat Başlatma
  useEffect(() => {
    const init = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        // ESKİ VE YENİ SÜRÜMLER İÇİN UYUMLU LOG AYARI
        // setLogLevel yerine setDebugLogsEnabled kullanıyoruz
        await Purchases.setDebugLogsEnabled(true);

        // API Key'leri
        const apiKey = Capacitor.getPlatform() === "ios" ? "appl_SENIN_IOS_KEYIN" : "goog_SENIN_ANDROID_KEYIN"; // Buraya kendi key'ini yapıştır

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
        // 1. Mevcut paketleri (offerings) çek
        const offerings = await Purchases.getOfferings();

        // 2. İstenen paketi bul (current offering içinde)
        const currentOffering = offerings.current;

        if (!currentOffering || !currentOffering.availablePackages) {
          throw new Error("Market paketleri bulunamadı.");
        }

        const packageToBuy = currentOffering.availablePackages.find((pkg: any) => pkg.identifier === packageIdentifier);

        if (!packageToBuy) {
          throw new Error(`Paket bulunamadı: ${packageIdentifier}`);
        }

        // 3. Satın almayı başlat
        // TypeScript hatasını önlemek için 'any' tipine cast ediyoruz
        const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToBuy });

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
    purchasePackage,
    restorePurchases,
  };
};
