import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Production-ready Server Time Sync Hook
 * 
 * Bu hook sunucu saati ile client saati arasındaki farkı (offset) hesaplar.
 * RTT (Round-Trip Time) kompansasyonu ile en doğru offset'i bulur.
 * 
 * Kullanım:
 * const { serverNow, offset, isReady } = useServerTime();
 * const serverTime = serverNow(); // Her zaman güncel sunucu zamanı
 */

interface TimeSample {
  offset: number;
  rtt: number;
}

export function useServerTime() {
  const [offset, setOffset] = useState<number>(0);
  const [isReady, setIsReady] = useState(false);
  const offsetRef = useRef<number>(0);

  // Server time'ı hesapla - multiple samples + best RTT selection
  const calculateOffset = useCallback(async (): Promise<number> => {
    const samples: TimeSample[] = [];
    
    for (let i = 0; i < 3; i++) {
      const t0 = Date.now();
      
      try {
        const { data: serverTime, error } = await supabase.rpc("get_server_time");
        
        if (error || !serverTime) {
          console.error("Server time fetch error:", error);
          continue;
        }
        
        const t3 = Date.now();
        const rtt = t3 - t0;
        
        // RTT kompansasyonlu offset: server time - client time - (rtt/2)
        const calculatedOffset = new Date(serverTime as string).getTime() - t0 - (rtt / 2);
        
        samples.push({ offset: calculatedOffset, rtt });
        
        console.log(`📊 Time sample ${i + 1}: offset=${calculatedOffset}ms, RTT=${rtt}ms`);
        
        // Son sample hariç 50ms bekle
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (err) {
        console.error("Sample fetch error:", err);
      }
    }
    
    if (samples.length === 0) {
      console.warn("⚠️ No valid samples, using offset: 0");
      return 0;
    }
    
    // En düşük RTT'ye sahip sample'ı kullan (en güvenilir)
    const bestSample = samples.sort((a, b) => a.rtt - b.rtt)[0];
    console.log(`✅ Best sample: offset=${bestSample.offset}ms, RTT=${bestSample.rtt}ms`);
    
    return bestSample.offset;
  }, []);

  // Sunucu zamanını al (her zaman güncel)
  const serverNow = useCallback((): number => {
    return Date.now() + offsetRef.current;
  }, []);

  // İlk sync
  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      const calculatedOffset = await calculateOffset();
      
      if (mounted) {
        setOffset(calculatedOffset);
        offsetRef.current = calculatedOffset;
        setIsReady(true);
        console.log("⏰ Server time ready, offset:", calculatedOffset, "ms");
      }
    };
    
    init();
    
    return () => {
      mounted = false;
    };
  }, [calculateOffset]);

  // Offset değiştiğinde ref'i güncelle
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  return {
    offset,
    serverNow,
    isReady,
    resync: calculateOffset,
  };
}
