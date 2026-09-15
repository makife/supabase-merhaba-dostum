/**
 * 🔥 COLD START TIME TRACKER
 * 
 * Bu dosya TÜM modüllerden ÖNCE yükleniyor (main.tsx'te ilk import).
 * Uygulama kill edilip açıldığında bile doğru timestamp'i garantiler.
 * 
 * AuthContext'teki "20 saniye misafir koruması" bu değere bağlı!
 */

// 🔥 ANINDA SET ET - dosya yüklendiği anda (React'tan önce!)
const COLD_START_TIMESTAMP = Date.now();

// Window'a da yaz (global erişim)
if (typeof window !== 'undefined') {
  (window as any).__appColdStartTime = COLD_START_TIMESTAMP;
  (window as any).__appForegroundTime = COLD_START_TIMESTAMP;
  
  console.log('[ColdStartTime] ⏱️ Cold start timestamp SET:', COLD_START_TIMESTAMP);
}

/**
 * Cold start zamanını al
 */
export const getColdStartTime = (): number => COLD_START_TIMESTAMP;

/**
 * Uygulama "taze uyanmış" mı? (20 saniyeden az geçtiyse)
 */
export const isFreshWake = (thresholdMs: number = 20000): boolean => {
  const foregroundTime = (window as any).__appForegroundTime || COLD_START_TIMESTAMP;
  const timeSinceWake = Date.now() - foregroundTime;
  return timeSinceWake < thresholdMs;
};

/**
 * Foreground zamanını güncelle (ön plana gelince çağrılmalı)
 */
export const updateForegroundTime = (): void => {
  if (typeof window !== 'undefined') {
    (window as any).__appForegroundTime = Date.now();
    console.log('[ColdStartTime] 📱 Foreground time güncellendi:', Date.now());
  }
};
