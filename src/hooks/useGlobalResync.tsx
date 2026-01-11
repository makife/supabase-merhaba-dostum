import { useEffect, useRef, useCallback, useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useAppState } from '@/hooks/useAppState';

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
 * 🔄 Global Resync Hook
 * 
 * Uygulama arka plandan döndüğünde ve bağlantı yeniden kurulduğunda
 * otomatik veri tazeleme yapar.
 * 
 * Kurallar:
 * - isSystemConnected false→true geçişinde resync tetiklenir
 * - Sadece mount edilmiş sayfalar için çalışır
 * - Loading ekranı göstermez (sessiz tazeleme)
 * - Kritik sayfalar öncelikli
 */
export const useGlobalResync = ({
  onResync,
  isActive = true,
  isPriority = false,
  pageName = 'Unknown',
  onResubscribe
}: ResyncOptions) => {
  const { isSystemConnected } = useUser();
  const { isActive: isAppActive } = useAppState({});
  
  // Önceki bağlantı durumunu takip et
  const wasConnectedRef = useRef<boolean | null>(null);
  const wasAppActiveRef = useRef<boolean | null>(null);
  const isMountedRef = useRef(true);
  const lastResyncTimeRef = useRef<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Debounce için minimum süre (ms)
  const MIN_RESYNC_INTERVAL = isPriority ? 500 : 2000;

  const performResync = useCallback(async (source: string = 'unknown') => {
    // Mount kontrolü
    if (!isMountedRef.current) {
      console.log(`[Resync] ⏭️ ${pageName} unmounted, skip (${source})`);
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
    
    // Sessiz tazeleme - loading gösterme
    setIsRefreshing(true);
    
    try {
      // Önce kanalları yeniden subscribe et (kritik sayfalar için)
      if (onResubscribe && isPriority) {
        await onResubscribe();
      }
      
      await onResync();
      console.log(`[Resync] ✅ ${pageName} tamamlandı`);
    } catch (error) {
      console.error(`[Resync] ❌ ${pageName} hata:`, error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onResync, onResubscribe, isActive, pageName, MIN_RESYNC_INTERVAL, isPriority]);

  // isSystemConnected değişimini izle - FALSE → TRUE geçişi
  useEffect(() => {
    // İlk render'da sadece değeri kaydet
    if (wasConnectedRef.current === null) {
      wasConnectedRef.current = isSystemConnected;
      return;
    }
    
    // false → true geçişi tespit et
    if (!wasConnectedRef.current && isSystemConnected) {
      console.log(`[Resync] 🌐 ${pageName} bağlantı geri geldi!`);
      
      // Kritik sayfalar hemen, diğerleri küçük gecikmeyle
      const delay = isPriority ? 50 : 300;
      
      setTimeout(() => {
        performResync('connection-restored');
      }, delay);
    }
    
    wasConnectedRef.current = isSystemConnected;
  }, [isSystemConnected, performResync, pageName, isPriority]);

  // App foreground'a geldiğinde resync (bağlantı varsa)
  useEffect(() => {
    // İlk render'da sadece değeri kaydet
    if (wasAppActiveRef.current === null) {
      wasAppActiveRef.current = isAppActive;
      return;
    }
    
    // false → true geçişi (arka plan → ön plan)
    if (!wasAppActiveRef.current && isAppActive && isSystemConnected) {
      console.log(`[Resync] 📱 ${pageName} ön plana geldi!`);
      
      // App uyanışında küçük gecikmeyle resync
      const delay = isPriority ? 100 : 500;
      
      setTimeout(() => {
        performResync('app-foreground');
      }, delay);
    }
    
    wasAppActiveRef.current = isAppActive;
  }, [isAppActive, isSystemConnected, performResync, pageName, isPriority]);

  // Supabase reconnect ve session recovery eventlerini dinle
  useEffect(() => {
    const handleReconnect = () => {
      console.log(`[Resync] 📡 ${pageName} supabase-reconnected event`);
      performResync('supabase-event');
    };
    
    // 🔥 KRİTİK: Session recovery sonrası TÜM sayfalar yenilensin!
    const handleSessionRecovered = () => {
      console.log(`[Resync] 🔐 ${pageName} session-recovered event - ZORLA yenileme`);
      // Session recovery sonrası hemen veri tazele (debounce'u atla)
      lastResyncTimeRef.current = 0;
      setTimeout(() => performResync('session-recovered'), isPriority ? 100 : 300);
    };
    
    // 🔥 appForeground event'ini de dinle (native için)
    const handleAppForeground = () => {
      console.log(`[Resync] ☀️ ${pageName} appForeground event`);
      setTimeout(() => performResync('app-foreground-event'), isPriority ? 200 : 600);
    };
    
    window.addEventListener('supabase-reconnected', handleReconnect);
    window.addEventListener('session-recovered', handleSessionRecovered);
    window.addEventListener('appForeground', handleAppForeground);
    
    return () => {
      window.removeEventListener('supabase-reconnected', handleReconnect);
      window.removeEventListener('session-recovered', handleSessionRecovered);
      window.removeEventListener('appForeground', handleAppForeground);
    };
  }, [performResync, pageName, isPriority]);

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
    isAppActive,
    // Sessiz tazeleme durumu (UI'da kullanılabilir)
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
