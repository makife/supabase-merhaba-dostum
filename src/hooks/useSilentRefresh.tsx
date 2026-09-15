import { useState, useCallback, useRef } from 'react';

interface SilentRefreshOptions<T> {
  // Veri çekme fonksiyonu
  fetchFn: () => Promise<T>;
  // Başlangıç verisi
  initialData?: T;
}

interface SilentRefreshResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isRefreshing: boolean; // Sessiz tazeleme durumu
  error: Error | null;
  refresh: () => Promise<void>;
  setData: (data: T) => void;
}

/**
 * 🔇 Silent Refresh Hook
 * 
 * Veri tazelenirken loading ekranı göstermez.
 * Mevcut veri gösterilirken arka planda güncelleme yapar.
 * 
 * Kullanım:
 * const { data, isLoading, refresh } = useSilentRefresh({
 *   fetchFn: () => supabase.from('table').select('*')
 * });
 */
export const useSilentRefresh = <T,>({
  fetchFn,
  initialData
}: SilentRefreshOptions<T>): SilentRefreshResult<T> => {
  const [data, setData] = useState<T | undefined>(initialData);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const isFetchingRef = useRef(false);
  const hasInitialDataRef = useRef(!!initialData);

  const refresh = useCallback(async () => {
    // Zaten çekiyorsa tekrar çekme
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    
    // İlk yükleme mi yoksa tazeleme mi?
    const isInitialLoad = !hasInitialDataRef.current && !data;
    
    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      // Sessiz tazeleme - loading gösterme
      setIsRefreshing(true);
    }
    
    try {
      const result = await fetchFn();
      setData(result);
      setError(null);
      hasInitialDataRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
      // Hata olsa bile mevcut veriyi koru
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  }, [fetchFn, data]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refresh,
    setData
  };
};

/**
 * 🔇 Multiple Silent Refresh
 * Birden fazla veri kaynağı için
 */
export const useMultipleSilentRefresh = (
  refreshFunctions: Array<() => Promise<void>>
) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all(refreshFunctions.map(fn => fn()));
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshFunctions]);

  return { refreshAll, isRefreshing };
};
