/**
 * 🎯 FOREGROUND EVENT HUB - MERKEZİ EVENT KOORDİNATÖRÜ V2
 * 
 * PROBLEM: 4-5 farklı event (appForeground, visibility, session-recovered, supabase-reconnected)
 * her birini 10+ hook dinliyor = 50+ istek aynı anda!
 * 
 * ÇÖZÜM: Tek bir merkezi hub. Tüm eventler buraya gelir, BİR KERE işlenir,
 * sonra TEK BİR EVENT olarak dağıtılır.
 * 
 * V2 DEĞİŞİKLİKLERİ:
 * - Callback timeout eklendi (5sn max bekleme)
 * - Daha iyi hata yakalama
 * - Logging iyileştirildi
 */

// =============== STATE ===============

let isHubActive = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastHubTriggerTime = 0;
const HUB_DEBOUNCE_MS = 600; // 600ms debounce
const CALLBACK_TIMEOUT_MS = 2000; // Her callback max 2sn bekleyebilir (fire-and-forget için yeterli)

// Callback registry
type HubCallback = () => void | Promise<void>;
const callbacks = {
  onAuthReady: [] as HubCallback[],
  onProfileReady: [] as HubCallback[],
  onDataReady: [] as HubCallback[],
};

// =============== PUBLIC API ===============

/**
 * Hub'a callback kaydet
 * - onAuthReady: Auth işlemi tamamlandığında (T+0ms)
 * - onProfileReady: Profil yüklendikten sonra (T+300ms)
 * - onDataReady: Tüm veriler hazır (T+600ms)
 */
export function registerHubCallback(
  event: 'onAuthReady' | 'onProfileReady' | 'onDataReady',
  callback: HubCallback
): () => void {
  callbacks[event].push(callback);
  console.log(`[EventHub] ➕ Callback kaydedildi: ${event} (toplam: ${callbacks[event].length})`);
  
  // Unregister function döndür
  return () => {
    const index = callbacks[event].indexOf(callback);
    if (index > -1) {
      callbacks[event].splice(index, 1);
      console.log(`[EventHub] ➖ Callback silindi: ${event} (kalan: ${callbacks[event].length})`);
    }
  };
}

/**
 * Hub'ı tetikle (debounced)
 * Tüm event sources buraya gelir
 */
export function triggerHub(source: string): void {
  console.log(`[EventHub] 📥 Event alındı: ${source}`);
  
  // Debounce: Önceki timer'ı iptal et
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Yeni debounce timer başlat
  debounceTimer = setTimeout(() => {
    executeHubSequence(source);
  }, HUB_DEBOUNCE_MS);
}

/**
 * Hub'ı HEMEN çalıştır (debounce bypass)
 * Session recovery gibi kritik durumlar için
 */
export function triggerHubImmediate(source: string): void {
  console.log(`[EventHub] ⚡ ACIL event: ${source}`);
  
  // Önceki timer'ı iptal et
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  
  // Hemen çalıştır
  executeHubSequence(source);
}

/**
 * Hub aktif mi? (başka işlemler beklemeli mi?)
 */
export function isHubProcessing(): boolean {
  return isHubActive;
}

/**
 * Kayıtlı callback sayılarını döndür (debug için)
 */
export function getHubStats() {
  return {
    onAuthReady: callbacks.onAuthReady.length,
    onProfileReady: callbacks.onProfileReady.length,
    onDataReady: callbacks.onDataReady.length,
    isActive: isHubActive,
  };
}

// =============== PRIVATE FUNCTIONS ===============

async function executeHubSequence(source: string): Promise<void> {
  // Zaten çalışıyorsa atla
  if (isHubActive) {
    console.log(`[EventHub] ⏭️ Zaten çalışıyor, atlanıyor (${source})`);
    return;
  }
  
  // Son çalışmadan bu yana çok az zaman geçtiyse atla
  const now = Date.now();
  if (now - lastHubTriggerTime < 800) {
    console.log(`[EventHub] ⏭️ Çok yakın zamanda çalıştı, atlanıyor (${now - lastHubTriggerTime}ms)`);
    return;
  }
  
  const stats = getHubStats();
  console.log(`[EventHub] 🚀 SIRALI İŞLEM BAŞLIYOR (${source})`, stats);
  isHubActive = true;
  lastHubTriggerTime = now;
  
  try {
    // ADIM 1: Auth Ready (T+0ms)
    console.log(`[EventHub] 📍 ADIM 1: Auth callbacks çağrılıyor... (${callbacks.onAuthReady.length} adet)`);
    await runCallbacksWithTimeout('onAuthReady');
    
    // ADIM 2: Profile Ready (T+300ms)
    await delay(300);
    console.log(`[EventHub] 📍 ADIM 2: Profile callbacks çağrılıyor... (${callbacks.onProfileReady.length} adet)`);
    await runCallbacksWithTimeout('onProfileReady');
    
    // ADIM 3: Data Ready (T+600ms)
    await delay(300);
    console.log(`[EventHub] 📍 ADIM 3: Data callbacks çağrılıyor... (${callbacks.onDataReady.length} adet)`);
    await runCallbacksWithTimeout('onDataReady');
    
    console.log(`[EventHub] ✅ SIRALI İŞLEM TAMAMLANDI (${Date.now() - now}ms)`);
    
  } catch (error) {
    console.error(`[EventHub] ❌ Hata:`, error);
  } finally {
    isHubActive = false;
  }
}

async function runCallbacksWithTimeout(event: 'onAuthReady' | 'onProfileReady' | 'onDataReady'): Promise<void> {
  const eventCallbacks = callbacks[event];
  
  if (eventCallbacks.length === 0) {
    console.log(`[EventHub] ⏭️ ${event}: callback yok`);
    return;
  }
  
  console.log(`[EventHub] 🔄 ${event}: ${eventCallbacks.length} callback çalıştırılıyor...`);
  
  // Her callback'i timeout ile çalıştır
  const promises = eventCallbacks.map((cb, index) => {
    return new Promise<void>(async (resolve) => {
      const timeoutId = setTimeout(() => {
        console.warn(`[EventHub] ⏰ ${event}[${index}] timeout (${CALLBACK_TIMEOUT_MS}ms)`);
        resolve(); // Timeout olsa bile devam et
      }, CALLBACK_TIMEOUT_MS);
      
      try {
        await Promise.resolve(cb());
        console.log(`[EventHub] ✓ ${event}[${index}] tamamlandı`);
      } catch (e) {
        console.error(`[EventHub] ✗ ${event}[${index}] hata:`, e);
      } finally {
        clearTimeout(timeoutId);
        resolve();
      }
    });
  });
  
  await Promise.all(promises);
  console.log(`[EventHub] ✅ ${event}: tüm callback'ler tamamlandı`);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============== EVENT INTERCEPTORS ===============

/**
 * Global event listener'ları kur
 * Bu fonksiyon App.tsx'te SADECE BİR KERE çağrılmalı
 */
export function initEventHub(): () => void {
  console.log(`[EventHub] 🎯 Merkezi event hub başlatılıyor...`);
  
  // 1. App Foreground (native)
  const handleAppForeground = () => triggerHub('appForeground');
  
  // 2. Visibility Change (web + native)
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      triggerHub('visibility');
    }
  };
  
  // 3. Session Recovered - KRİTİK, hemen çalış
  const handleSessionRecovered = () => triggerHubImmediate('session-recovered');
  
  // 4. Supabase Reconnected
  const handleReconnect = () => triggerHub('supabase-reconnected');
  
  // 5. Online event
  const handleOnline = () => triggerHub('online');
  
  // Event listener'ları kur
  window.addEventListener('appForeground', handleAppForeground);
  window.addEventListener('app-foreground', handleAppForeground);
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('session-recovered', handleSessionRecovered);
  window.addEventListener('supabase-reconnected', handleReconnect);
  window.addEventListener('online', handleOnline);
  
  const stats = getHubStats();
  console.log(`[EventHub] ✅ Event listener'lar kuruldu. Kayıtlı callback'ler:`, stats);
  
  // Cleanup function döndür
  return () => {
    window.removeEventListener('appForeground', handleAppForeground);
    window.removeEventListener('app-foreground', handleAppForeground);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('session-recovered', handleSessionRecovered);
    window.removeEventListener('supabase-reconnected', handleReconnect);
    window.removeEventListener('online', handleOnline);
    console.log(`[EventHub] 🧹 Event listener'lar temizlendi`);
  };
}
