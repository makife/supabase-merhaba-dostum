import { supabase } from "@/integrations/supabase/client";

interface TimeSample {
  offset: number;
  rtt: number;
}

/**
 * Seviye 1: Multiple samples + RTT compensation
 * 
 * Network jitter'a karşı koruma sağlar. 3 sample alır ve
 * en düşük RTT'ye sahip olanı kullanır (en güvenilir).
 */
export async function calculateServerOffset(): Promise<number> {
  const samples: TimeSample[] = [];
  
  for (let i = 0; i < 7; i++) {
    const t0 = Date.now();
    
    try {
      const { data: serverTime, error } = await supabase.rpc("get_server_time");
      
      if (error || !serverTime) {
        console.error("Server time fetch error:", error);
        continue;
      }
      
      const t3 = Date.now();
      const rtt = t3 - t0;
      
      // RTT kompensasyonlu offset hesapla
      // Server time'ı request'in ortasındaki zamana ayarla
      const offset = new Date(serverTime as string).getTime() - t0 - (rtt / 2);
      
      samples.push({ offset, rtt });
      
      console.log(`📊 Sample ${i + 1}: offset=${offset}ms, RTT=${rtt}ms`);
      
      // Son sample hariç 100ms bekle
      if (i < 6) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (err) {
      console.error("Sample fetch error:", err);
    }
  }
  
  if (samples.length === 0) {
    console.warn("⚠️ No valid samples, using fallback offset: 0");
    return 0;
  }
  
  // En düşük RTT'ye sahip sample'ı kullan (en güvenilir)
  const bestSample = samples.sort((a, b) => a.rtt - b.rtt)[0];
  
  console.log(`✅ Best sample selected: offset=${bestSample.offset}ms, RTT=${bestSample.rtt}ms`);
  
  return bestSample.offset;
}

/**
 * Seviye 2: Drift detection
 * 
 * Clock drift'i tespit eder ve gerekirse re-sync yapar.
 * Uzun oyunlar, mobil uyku modu, CPU throttling gibi
 * durumlarda cihaz saati kayabilir.
 */
export async function checkClockDrift(
  currentOffset: number,
  onDriftDetected: (newOffset: number, drift: number) => void
): Promise<void> {
  try {
    const newOffset = await calculateServerOffset();
    const drift = Math.abs(newOffset - currentOffset);
    
    // 500ms'den fazla sapma varsa drift olarak kabul et
    if (drift > 500) {
      console.warn(`⚠️ Clock drift detected: ${drift}ms`);
      onDriftDetected(newOffset, drift);
    } else {
      console.log(`✅ Clock drift check OK: ${drift}ms (< 500ms threshold)`);
    }
  } catch (err) {
    console.error("Drift check error:", err);
  }
}

/**
 * Periyodik drift kontrolü için interval oluştur
 */
export function startDriftMonitoring(
  getCurrentOffset: () => number,
  onDriftDetected: (newOffset: number, drift: number) => void,
  intervalMs: number = 30000 // 30 saniye
): NodeJS.Timeout {
  const intervalId = setInterval(async () => {
    const currentOffset = getCurrentOffset();
    await checkClockDrift(currentOffset, onDriftDetected);
  }, intervalMs);
  
  console.log(`🔄 Drift monitoring started (check every ${intervalMs / 1000}s)`);
  
  return intervalId;
}
