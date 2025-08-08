import { useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { useUserPurchases } from '@/hooks/useUserPurchases';

// Capacitor In-App Purchase types
declare global {
  interface Window {
    Capacitor?: any;
    InAppPurchase?: {
      init: () => Promise<any>;
      ready: () => Promise<any>;
      getProducts: (productIds: string[]) => Promise<any>;
      buy: (productId: string) => Promise<any>;
      subscribe: (productId: string) => Promise<any>;
      restorePurchases: () => Promise<any>;
      finishTransaction: (transactionId: string) => Promise<any>;
      when: (productId: string) => {
        approved: (callback: (purchase: any) => void) => void;
        verified: (callback: (purchase: any) => void) => void;
        updated: (callback: (purchase: any) => void) => void;
      };
    };
  }
}

interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  type: 'CONSUMABLE' | 'NON_CONSUMABLE' | 'SUBSCRIPTION';
}

interface Purchase {
  transactionId: string;
  productId: string;
  quantity: number;
  state: 'PURCHASED' | 'PENDING' | 'CANCELLED';
}

export const useInAppPurchases = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const { toast } = useToast();
  const { refreshProfile } = useUser();
  const { processPurchase } = useUserPurchases();

  // Define product IDs for your app
  const PRODUCT_IDS = [
    'credits_10',
    'credits_25', 
    'credits_50',
    'unlimited_1h',
    'unlimited_24h',
    'premium_month',
    'theme_dark_ocean',
    'theme_sunset',
    'theme_forest',
    'avatar_floral_roses',
    'avatar_blue_berries',
    'avatar_gold_simple',
    'sound_pack_space',
    'sound_pack_nature',
    'effect_fireworks',
    'effect_confetti',
    'badge_wordmaster',
    'hint_pack_basic',
    'hint_pack_premium'
  ];

  // Initialize in-app purchases
  const initializePurchases = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || isInitialized) {
      return;
    }

    try {
      setIsLoading(true);
      
      // Check if cordova-plugin-purchase is available
      if (!window.InAppPurchase) {
        console.log('In-app purchase plugin not available');
        return;
      }

      // Initialize the plugin
      await window.InAppPurchase.init();
      
      // Set up event listeners for purchase events
      PRODUCT_IDS.forEach(productId => {
        if (window.InAppPurchase) {
          window.InAppPurchase.when(productId).approved(async (purchase: Purchase) => {
            // Handle approved purchase
            console.log('Purchase approved:', purchase);
            await handlePurchaseApproved(purchase);
          });

          window.InAppPurchase.when(productId).verified(async (purchase: Purchase) => {
            // Handle verified purchase
            console.log('Purchase verified:', purchase);
            await handlePurchaseVerified(purchase);
          });
        }
      });

      // Load products
      await loadProducts();
      
      // Mark as ready
      await window.InAppPurchase.ready();
      setIsInitialized(true);
      
      console.log('In-app purchases initialized successfully');
    } catch (error) {
      console.error('Failed to initialize in-app purchases:', error);
      toast({
        title: 'Hata',
        description: 'Satın alma sistemi başlatılamadı',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, toast]);

  // Load available products
  const loadProducts = useCallback(async () => {
    if (!window.InAppPurchase) return;

    try {
      const productList = await window.InAppPurchase.getProducts(PRODUCT_IDS);
      setProducts(productList || []);
      console.log('Products loaded:', productList);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }, []);

  // Handle purchase approval
  const handlePurchaseApproved = useCallback(async (purchase: Purchase) => {
    try {
      // Map the purchase to our internal item format
      const item = {
        id: purchase.productId,
        title: `Product ${purchase.productId}`,
        description: 'Mobile purchase',
        price: 0, // Will be handled by app store
        currency: 'premium' as const,
        type: getItemType(purchase.productId),
        value: getItemValue(purchase.productId)
      };

      // Process the purchase in our system
      await processPurchase(item);
      
      toast({
        title: 'Satın Alma Başarılı',
        description: 'Ürününüz hesabınıza eklendi',
      });

      // Refresh user profile
      await refreshProfile();
      
    } catch (error) {
      console.error('Failed to process purchase:', error);
      toast({
        title: 'Hata',
        description: 'Satın alma işlenirken hata oluştu',
        variant: 'destructive',
      });
    }
  }, [processPurchase, refreshProfile, toast]);

  // Handle purchase verification
  const handlePurchaseVerified = useCallback(async (purchase: Purchase) => {
    try {
      // Finish the transaction
      if (window.InAppPurchase) {
        await window.InAppPurchase.finishTransaction(purchase.transactionId);
      }
      console.log('Transaction finished:', purchase.transactionId);
    } catch (error) {
      console.error('Failed to finish transaction:', error);
    }
  }, []);

  // Purchase a product
  const purchaseProduct = useCallback(async (productId: string) => {
    if (!window.InAppPurchase || !isInitialized) {
      toast({
        title: 'Hata',
        description: 'Satın alma sistemi hazır değil',
        variant: 'destructive',
      });
      return false;
    }

    try {
      setIsLoading(true);
      
      console.log('Attempting to purchase:', productId);
      await window.InAppPurchase.buy(productId);
      
      return true;
    } catch (error) {
      console.error('Purchase failed:', error);
      toast({
        title: 'Satın Alma Hatası',
        description: 'Satın alma işlemi iptal edildi veya başarısız oldu',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, toast]);

  // Restore purchases
  const restorePurchases = useCallback(async () => {
    if (!window.InAppPurchase || !isInitialized) {
      toast({
        title: 'Hata',
        description: 'Satın alma sistemi hazır değil',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      await window.InAppPurchase.restorePurchases();
      
      toast({
        title: 'Başarılı',
        description: 'Önceki satın alımlarınız geri yüklendi',
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
  }, [isInitialized, refreshProfile, toast]);

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

  return {
    isInitialized,
    isLoading,
    products,
    initializePurchases,
    purchaseProduct,
    restorePurchases,
    loadProducts,
  };
};