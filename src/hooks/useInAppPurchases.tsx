import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { useUserPurchases } from '@/hooks/useUserPurchases';

interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
}

// Dinamik import helper'ı (sadece native platformda kullanılacak)
const getPurchases = async () => (await import(/* @vite-ignore */ '@revenuecat/purchases-capacitor')).Purchases;

export const useInAppPurchases = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [offerings, setOfferings] = useState<any | null>(null);
  const { toast } = useToast();
  const { refreshProfile } = useUser();
  const { processPurchase } = useUserPurchases();

  // Initialize RevenueCat
  const initializePurchases = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || isInitialized) {
      return;
    }

    try {
      setIsLoading(true);
      
      // RevenueCat API keys - Bu gerçek projede environment variables olmalı
      const REVENUECAT_API_KEY = Capacitor.getPlatform() === 'ios' 
        ? 'appl_your_ios_api_key_here'  // iOS için
        : 'goog_your_android_api_key_here';  // Android için

      const Purchases = await getPurchases();
      await Purchases.configure({
        apiKey: REVENUECAT_API_KEY,
      });

      // Set user ID if available
      const userInfo = await Purchases.getCustomerInfo();
      console.log('Customer info:', userInfo);

      // Load offerings
      await loadOfferings();
      
      setIsInitialized(true);
      console.log('RevenueCat initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      toast({
        title: 'Bilgi',
        description: 'Mobil satın alma sistemi web\'de çalışmaz',
        variant: 'default',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, toast]);

  // Load offerings (products)
  const loadOfferings = useCallback(async () => {
    try {
      const Purchases = await getPurchases();
      const offerings = await Purchases.getOfferings();
      if (offerings.current) {
        setOfferings(offerings.current);
        
        // Convert to our Product format
        const productList = offerings.current.availablePackages.map((pkg: any) => ({
          id: pkg.product.identifier,
          title: pkg.product.title,
          description: pkg.product.description,
          price: pkg.product.priceString,
          currency: pkg.product.currencyCode
        }));
        
        setProducts(productList);
        console.log('Offerings loaded:', productList);
      }
    } catch (error) {
      console.error('Failed to load offerings:', error);
    }
  }, []);

  // Purchase a product
  const purchaseProduct = useCallback(async (productId: string) => {
    if (!isInitialized) {
      toast({
        title: 'Hata',
        description: 'Satın alma sistemi hazır değil',
        variant: 'destructive',
      });
      return false;
    }

    if (!offerings) {
      toast({
        title: 'Hata', 
        description: 'Ürünler yüklenemedi',
        variant: 'destructive',
      });
      return false;
    }

    try {
      setIsLoading(true);
      
      // Find the package
      const packageToPurchase = offerings.availablePackages.find(
        pkg => pkg.product.identifier === productId
      );

      if (!packageToPurchase) {
        throw new Error('Product not found');
      }

      console.log('Attempting to purchase:', productId);
      const Purchases = await getPurchases();
      const purchaserInfo = await Purchases.purchasePackage({
        aPackage: packageToPurchase
      });

      // Purchase completed - process it
      const item = {
        id: productId,
        title: packageToPurchase.product.title,
        description: packageToPurchase.product.description,
        price: 0, // Handled by app store
        currency: 'premium' as const,
        type: getItemType(productId),
        value: getItemValue(productId)
      };

      await processPurchase(item);
      
      toast({
        title: 'Satın Alma Başarılı',
        description: 'Ürününüz hesabınıza eklendi',
      });

      await refreshProfile();
      
      return true;
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      // Handle user cancellation
      if (error.code === 'PURCHASE_CANCELLED_ERROR') {
        toast({
          title: 'İptal Edildi',
          description: 'Satın alma işlemi iptal edildi',
        });
      } else {
        toast({
          title: 'Satın Alma Hatası',
          description: 'Satın alma işlemi başarısız oldu',
          variant: 'destructive',
        });
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, offerings, processPurchase, refreshProfile, toast]);

  // Restore purchases
  const restorePurchases = useCallback(async () => {
    if (!isInitialized) {
      toast({
        title: 'Hata',
        description: 'Satın alma sistemi hazır değil',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      const Purchases = await getPurchases();
      await Purchases.restorePurchases();
      
      toast({
        title: 'Başarılı',
        description: 'Önceki satın alımlarınız kontrol edildi',
      });
      
      await refreshProfile();
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      toast({
        title: 'Hata',
        description: 'Satın alımlar geri yüklenemedi',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, processPurchase, refreshProfile, toast]);

  // Helper function to get item type from product ID
  const getItemType = (productId: string) => {
    if (productId.includes('credits')) return 'credits';
    if (productId.includes('unlimited')) return 'unlimited_time';
    if (productId.includes('premium')) return 'premium';
    if (productId.includes('theme')) return 'theme';
    if (productId.includes('avatar')) return 'avatar';
    if (productId.includes('sound')) return 'sound';
    if (productId.includes('effect')) return 'effect';
    if (productId.includes('badge')) return 'badge';
    if (productId.includes('hint')) return 'hint';
    return 'credits';
  };

  // Helper function to get item value from product ID
  const getItemValue = (productId: string) => {
    if (productId.includes('10')) return 10;
    if (productId.includes('25')) return 25;
    if (productId.includes('50')) return 50;
    if (productId.includes('1h')) return 1;
    if (productId.includes('24h')) return 24;
    if (productId.includes('month')) return 30;
    return 1;
  };

  // Initialize on mount
  useEffect(() => {
    initializePurchases();
  }, [initializePurchases]);

  return {
    isInitialized,
    isLoading,
    products,
    offerings,
    initializePurchases,
    purchaseProduct,
    restorePurchases,
    loadOfferings,
  };
};