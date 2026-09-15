import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';

// Dinamik import - sadece native platformda yüklenir
const getPurchases = async () => {
  const module = await import('@revenuecat/purchases-capacitor');
  return module.Purchases;
};

// RevenueCat Product ID'leri - Bu ID'ler RevenueCat dashboard'da tanımlanmalı
export const PRODUCT_IDS = {
  // Consumable ürünler (Mürekkep paketleri)
  INK_DROP: 'ink_drop',       // 100 mürekkep - ₺39.99
  INK_BOTTLE: 'ink_bottle',   // 300 mürekkep - ₺99.99
  INK_POT: 'ink_pot',         // 850 mürekkep - ₺249.99
  INK_BARREL: 'ink_barrel',   // 2500 mürekkep - ₺699.99
  
  // Subscription ürünler
  PREMIUM_MONTHLY: 'premium_monthly',   // Aylık VIP - ₺249.99
  PREMIUM_YEARLY: 'premium_yearly',     // Yıllık VIP - ₺1499.99
} as const;

// Mürekkep miktarları
export const INK_AMOUNTS: Record<string, number> = {
  [PRODUCT_IDS.INK_DROP]: 100,
  [PRODUCT_IDS.INK_BOTTLE]: 300,
  [PRODUCT_IDS.INK_POT]: 850,
  [PRODUCT_IDS.INK_BARREL]: 2500,
};

export const useRevenueCat = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSubscriptions, setActiveSubscriptions] = useState<string[]>([]);
  const [offerings, setOfferings] = useState<any>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { refreshProfile } = useUser();

  // RevenueCat'i başlat
  const initialize = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || isInitialized) {
      return false;
    }

    try {
      setIsLoading(true);
      const platform = Capacitor.getPlatform();

      // API key'i edge function'dan al
      const { data, error } = await supabase.functions.invoke('revenuecat-config', {
        body: { platform }
      });

      if (error || !data?.apiKey) {
        console.error('Failed to get RevenueCat API key:', error);
        return false;
      }

      const Purchases = await getPurchases();
      
      // RevenueCat'i yapılandır
      await Purchases.configure({
        apiKey: data.apiKey,
      });

      // Offerings'i yükle
      const offeringsResult = await Purchases.getOfferings();
      if (offeringsResult.current) {
        setOfferings(offeringsResult.current);
      }

      // Müşteri bilgisini al
      const info = await Purchases.getCustomerInfo();
      setActiveSubscriptions(info.activeSubscriptions || []);

      setIsInitialized(true);
      console.log('RevenueCat initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, user?.id]);

  // Ürün satın al (consumable veya subscription)
  const purchaseProduct = useCallback(async (productId: string): Promise<boolean> => {
    if (!Capacitor.isNativePlatform()) {
      toast({
        title: 'Bilgi',
        description: 'Satın almalar sadece mobil uygulamada çalışır',
        variant: 'default',
      });
      return false;
    }

    if (!isInitialized || !offerings) {
      toast({
        title: 'Hata',
        description: 'Satın alma sistemi hazır değil, lütfen bekleyin',
        variant: 'destructive',
      });
      return false;
    }

    try {
      setIsLoading(true);

      // Package'ı bul
      const packageToPurchase = offerings.availablePackages.find(
        (pkg: any) => pkg.product.identifier === productId
      );

      if (!packageToPurchase) {
        toast({
          title: 'Hata',
          description: 'Ürün bulunamadı',
          variant: 'destructive',
        });
        return false;
      }

      const Purchases = await getPurchases();
      const result = await Purchases.purchasePackage({
        aPackage: packageToPurchase
      });

      // Satın alma başarılı - veritabanını güncelle
      await handleSuccessfulPurchase(productId, null);
      
      // Aktif abonelikleri güncelle
      const info = await Purchases.getCustomerInfo();
      setActiveSubscriptions(info.activeSubscriptions || []);
      await refreshProfile();

      toast({
        title: 'Satın Alma Başarılı! 🎉',
        description: 'Ürününüz hesabınıza eklendi',
      });

      return true;
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      if (error.code === 'PURCHASE_CANCELLED_ERROR' || error.userCancelled) {
        toast({
          title: 'İptal Edildi',
          description: 'Satın alma işlemi iptal edildi',
        });
      } else {
        toast({
          title: 'Satın Alma Hatası',
          description: 'İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.',
          variant: 'destructive',
        });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, offerings, toast, refreshProfile]);

  // Başarılı satın alma sonrası veritabanı güncelleme
  const handleSuccessfulPurchase = async (productId: string, customerInfo: any) => {
    if (!user?.id) return;

    try {
      // Mürekkep paketi mi?
      if (Object.values(PRODUCT_IDS).includes(productId as any) && INK_AMOUNTS[productId]) {
        const inkAmount = INK_AMOUNTS[productId];
        
        // Mevcut mürekkep miktarını al ve güncelle
        const { data: profile } = await supabase
          .from('profiles')
          .select('ink_count')
          .eq('id', user.id)
          .single();

        const newInkCount = (profile?.ink_count || 0) + inkAmount;

        await supabase
          .from('profiles')
          .update({ ink_count: newInkCount })
          .eq('id', user.id);

        console.log(`Added ${inkAmount} ink to user. New total: ${newInkCount}`);
      }
      
      // Premium abonelik mi?
      if (productId === PRODUCT_IDS.PREMIUM_MONTHLY || productId === PRODUCT_IDS.PREMIUM_YEARLY) {
        const premiumUntil = new Date();
        
        if (productId === PRODUCT_IDS.PREMIUM_MONTHLY) {
          premiumUntil.setMonth(premiumUntil.getMonth() + 1);
        } else {
          premiumUntil.setFullYear(premiumUntil.getFullYear() + 1);
        }

        await supabase
          .from('profiles')
          .update({ 
            premium_until: premiumUntil.toISOString(),
            premium_type: productId,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        console.log(`Premium activated until: ${premiumUntil}`);
      }

      // Satın alma kaydı oluştur
      await supabase
        .from('user_purchases')
        .insert({
          user_id: user.id,
          item_id: productId,
          item_type: productId.includes('premium') ? 'subscription' : 'consumable',
          is_active: true,
        });

    } catch (error) {
      console.error('Failed to update database after purchase:', error);
    }
  };

  // Satın alımları geri yükle
  const restorePurchases = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      toast({
        title: 'Bilgi',
        description: 'Bu özellik sadece mobil uygulamada çalışır',
        variant: 'default',
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const Purchases = await getPurchases();
      const result = await Purchases.restorePurchases();
      
      const restoredSubscriptions = result.activeSubscriptions || [];
      setActiveSubscriptions(restoredSubscriptions);

      // Aktif abonelik varsa veritabanını güncelle
      if (restoredSubscriptions.length > 0) {
        for (const subId of restoredSubscriptions) {
          await handleSuccessfulPurchase(subId, null);
        }
        
        toast({
          title: 'Geri Yükleme Başarılı',
          description: 'Abonelikleriniz geri yüklendi',
        });
      } else {
        toast({
          title: 'Bilgi',
          description: 'Geri yüklenecek aktif abonelik bulunamadı',
        });
      }

      await refreshProfile();
    } catch (error) {
      console.error('Restore failed:', error);
      toast({
        title: 'Hata',
        description: 'Satın alımlar geri yüklenemedi',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, refreshProfile, user?.id]);

  // Premium durumunu kontrol et
  const isPremium = useCallback(() => {
    return (
      activeSubscriptions.includes(PRODUCT_IDS.PREMIUM_MONTHLY) ||
      activeSubscriptions.includes(PRODUCT_IDS.PREMIUM_YEARLY)
    );
  }, [activeSubscriptions]);

  // Uygulama başladığında otomatik başlat
  useEffect(() => {
    if (Capacitor.isNativePlatform() && user?.id) {
      initialize();
    }
  }, [user?.id]);

  return {
    isInitialized,
    isLoading,
    activeSubscriptions,
    offerings,
    initialize,
    purchaseProduct,
    restorePurchases,
    isPremium,
    PRODUCT_IDS,
  };
};
