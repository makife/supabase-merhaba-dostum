/**
 * 🎯 FOREGROUND EVENT HUB - MERKEZİ EVENT KOORDİNATÖRÜ
 * 
 * PROBLEM: 4-5 farklı event (appForeground, visibility, session-recovered, supabase-reconnected)
 * her birini 10+ hook dinliyor = 50+ istek aynı anda!
 * 
 * ÇÖZÜM: Tek bir merkezi hub. Tüm eventler buraya gelir, BİR KERE işlenir,
 * sonra TEK BİR EVENT olarak dağıtılır.
 * 
 * AKIŞ:
 * 1. appForeground/visibility/session-recovered/supabase-reconnected → Hub'a gelir
 * 2. Hub debounce yapar (2sn içinde gelen tüm eventler birleşir)
 * 3. Hub SIRALI işlem yapar: Auth → Profile → Jokers → Data
 * 4. Her adım tamamlanınca ilgili callback çağrılır
 */

// =============== STATE ===============

let isHubActive = false;
let debounceTimer: NodeJS.Timeout | null = null;
let lastHubTriggerTime = 0;
const HUB_DEBOUNCE_MS = 800; // 800ms debounce - tüm eventler birleşsin

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
 * - onProfileReady: Profil yüklendikten sonra (T+500ms)
 * - onDataReady: Tüm veriler hazır (T+1000ms)
 */
export function registerHubCallback(
  event: 'onAuthReady' | 'onProfileReady' | 'onDataReady',
  callback: HubCallback
): () => void {
  callbacks[event].push(callback);
  
  // Unregister function döndür
  return () => {
    const index = callbacks[event].indexOf(callback);
    if (index > -1) {
      callbacks[event].splice(index, 1);
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

// =============== PRIVATE FUNCTIONS ===============

async function executeHubSequence(source: string): Promise<void> {
  // Zaten çalışıyorsa atla
  if (isHubActive) {
    console.log(`[EventHub] ⏭️ Zaten çalışıyor, atlanıyor (${source})`);
    return;
  }
  
  // Son çalışmadan bu yana çok az zaman geçtiyse atla
  const now = Date.now();
  if (now - lastHubTriggerTime < 1000) {
    console.log(`[EventHub] ⏭️ Çok yakın zamanda çalıştı, atlanıyor (${now - lastHubTriggerTime}ms)`);
    return;
  }
  
  console.log(`[EventHub] 🚀 SIRALI İŞLEM BAŞLIYOR (${source})`);
  isHubActive = true;
  lastHubTriggerTime = now;
  
  try {
    // ADIM 1: Auth Ready (T+0ms)
    console.log(`[EventHub] 📍 ADIM 1: Auth callbacks çağrılıyor...`);
    await runCallbacks('onAuthReady');
    
    // ADIM 2: Profile Ready (T+400ms)
    await delay(400);
    console.log(`[EventHub] 📍 ADIM 2: Profile callbacks çağrılıyor...`);
    await runCallbacks('onProfileReady');
    
    // ADIM 3: Data Ready (T+800ms)
    await delay(400);
    console.log(`[EventHub] 📍 ADIM 3: Data callbacks çağrılıyor...`);
    await runCallbacks('onDataReady');
    
    console.log(`[EventHub] ✅ SIRALI İŞLEM TAMAMLANDI`);
    
  } catch (error) {
    console.error(`[EventHub] ❌ Hata:`, error);
  } finally {
    isHubActive = false;
  }
}

async function runCallbacks(event: 'onAuthReady' | 'onProfileReady' | 'onDataReady'): Promise<void> {
  const eventCallbacks = callbacks[event];
  
  if (eventCallbacks.length === 0) {
    console.log(`[EventHub] ⏭️ ${event}: callback yok`);
    return;
  }
  
  console.log(`[EventHub] 🔄 ${event}: ${eventCallbacks.length} callback çalıştırılıyor...`);
  
  // Paralel çalıştır ama hepsinin bitmesini bekle
  await Promise.allSettled(
    eventCallbacks.map(cb => {
      try {
        return Promise.resolve(cb());
      } catch (e) {
        console.error(`[EventHub] Callback hatası:`, e);
        return Promise.reject(e);
      }
    })
  );
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
  
  console.log(`[EventHub] ✅ Event listener'lar kuruldu`);
  
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
