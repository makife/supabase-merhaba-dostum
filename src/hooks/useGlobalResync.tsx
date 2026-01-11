import { useEffect, useRef, useCallback, useState } from 'react';
import { useUser } from '@/contexts/UserContext';

interface ResyncOptions {
  // Ana veri çekme fonksiyonu
  onResync: () => void | Promise<void>;
  // Sayfa aktif mi? (default: true)
  isActive?: boolean;
  // Kritik sayfa mı? (öncelikli resync)
  isPriority?: boolean;
  // Debug için sayfa adı
  pageName?: string;
  // Supabase kanallarını yeniden subscribe et
  onResubscribe?: () => void | Promise<void>;
}

/**
 * 🔥 ULTRA BASİT GLOBAL RESYNC HOOK
 * 
 * Tüm karmaşık Event Hub mantığı KALDIRILDI.
 * Sadece "app-resumed" eventini dinle ve veriyi tazele.
 */
export const useGlobalResync = ({
  onResync,
  isActive = true,
  isPriority = false,
  pageName = 'Unknown',
  onResubscribe
}: ResyncOptions) => {
  const { isSystemConnected } = useUser();
  
  // Refs
  const isMountedRef = useRef(true);
  const lastResyncTimeRef = useRef<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onResyncRef = useRef(onResync);
  const onResubscribeRef = useRef(onResubscribe);
  
  // Callback ref'lerini güncel tut
  useEffect(() => {
    onResyncRef.current = onResync;
    onResubscribeRef.current = onResubscribe;
  }, [onResync, onResubscribe]);
  
  // Debounce için minimum süre (ms)
  const MIN_RESYNC_INTERVAL = isPriority ? 300 : 1000;

  const performResync = useCallback(async (source: string = 'unknown') => {
    // Mount kontrolü
    if (!isMountedRef.current) {
      return;
    }
    
    // Aktiflik kontrolü
    if (!isActive) {
      console.log(`[Resync] ⏭️ ${pageName} inactive, skip (${source})`);
      return;
    }
    
    // Debounce kontrolü
    const now = Date.now();
    if (now - lastResyncTimeRef.current < MIN_RESYNC_INTERVAL) {
      console.log(`[Resync] ⏭️ ${pageName} debounced (${source})`);
      return;
    }
    
    lastResyncTimeRef.current = now;
    console.log(`[Resync] 🔄 ${pageName} veri tazeleniyor... (${source})`);
    
    setIsRefreshing(true);
    
    try {
      // Önce kanalları yeniden subscribe et (kritik sayfalar için)
      if (onResubscribeRef.current && isPriority) {
        await onResubscribeRef.current();
      }
      
      await onResyncRef.current();
      console.log(`[Resync] ✅ ${pageName} tamamlandı`);
    } catch (error) {
      console.error(`[Resync] ❌ ${pageName} hata:`, error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isActive, pageName, MIN_RESYNC_INTERVAL, isPriority]);

  // 🔥 BASİT YAKLAŞIM: app-resumed eventi dinle
  useEffect(() => {
    const handleAppResumed = () => {
      // Kritik sayfalar küçük gecikmeyle, diğerleri daha fazla
      const delay = isPriority ? 50 : 300;
      
      setTimeout(() => {
        performResync('app-resumed');
      }, delay);
    };

    window.addEventListener("app-resumed", handleAppResumed);
    
    return () => {
      window.removeEventListener("app-resumed", handleAppResumed);
    };
  }, [performResync, isPriority]);

  // isSystemConnected değişimini izle - FALSE → TRUE geçişi
  const wasConnectedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (wasConnectedRef.current === null) {
      wasConnectedRef.current = isSystemConnected;
      return;
    }
    
    // false → true geçişi tespit et
    if (!wasConnectedRef.current && isSystemConnected) {
      console.log(`[Resync] 🌐 ${pageName} bağlantı geri geldi!`);
      const delay = isPriority ? 100 : 400;
      setTimeout(() => {
        performResync('connection-restored');
      }, delay);
    }
    
    wasConnectedRef.current = isSystemConnected;
  }, [isSystemConnected, performResync, pageName, isPriority]);

  // Cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    // Manuel resync tetikleme
    triggerResync: () => performResync('manual'),
    isConnected: isSystemConnected,
    // Sessiz tazeleme durumu
    isRefreshing
  };
};

/**
 * 🔄 Sayfa bazlı resync wrapper
 * Daha basit kullanım için
 */
export const usePageResync = (
  fetchFunction: () => void | Promise<void>,
  pageName: string,
  isPriority = false,
  resubscribeFunction?: () => void | Promise<void>
) => {
  return useGlobalResync({
    onResync: fetchFunction,
    isActive: true,
    isPriority,
    pageName,
    onResubscribe: resubscribeFunction
  });
};
