/**
 * 🎯 FOREGROUND ORCHESTRATOR
 * 
 * Android Native'de arka plandan gelirken tüm işlemleri kademeli (staggered)
 * şekilde yönetir. Aynı anda çok fazla istek Bridge'i tıkar.
 * 
 * Timeline:
 * T+0ms:    UI hazırlığı (immersive bars)
 * T+400ms:  Auth/Session recovery
 * T+1000ms: ServerTime sync
 * T+1800ms: Global veri tazeleme
 */

// Global AbortController - tüm zombi istekleri temizlemek için
let globalForegroundAbortController: AbortController | null = null;

// Orchestrator state
let isOrchestrating = false;
let orchestratorTimeouts: NodeJS.Timeout[] = [];

// Callbacks
type OrchestrationCallbacks = {
  onUIReady?: () => void;
  onAuthRecovery?: () => void;
  onTimeSync?: () => void;
  onDataRefresh?: () => void;
  onComplete?: () => void;
  onBridgeHealthFail?: () => void;
};

/**
 * Tüm bekleyen foreground işlemlerini iptal et
 * Her yeni foreground'da çağrılmalı (zombi temizliği)
 */
export function abortAllPendingForegroundTasks(): void {
  console.log("[ForegroundOrchestrator] 🛑 Tüm zombi istekler iptal ediliyor...");
  
  // 1. Global AbortController ile tüm fetch'leri iptal et
  if (globalForegroundAbortController) {
    globalForegroundAbortController.abort();
  }
  globalForegroundAbortController = new AbortController();
  
  // 2. Orchestrator timeout'larını temizle
  orchestratorTimeouts.forEach(t => clearTimeout(t));
  orchestratorTimeouts = [];
  
  // 3. Orchestrating flag'ini resetle
  isOrchestrating = false;
}

/**
 * Global AbortSignal al - fetch'lerde kullan
 */
export function getForegroundAbortSignal(): AbortSignal | undefined {
  return globalForegroundAbortController?.signal;
}

/**
 * Kademeli foreground uyanışını başlat
 */
export function startForegroundOrchestration(callbacks: OrchestrationCallbacks): void {
  if (isOrchestrating) {
    console.log("[ForegroundOrchestrator] ⏳ Zaten çalışıyor, önce temizleniyor...");
    abortAllPendingForegroundTasks();
  }
  
  console.log("[ForegroundOrchestrator] 🚀 Kademeli uyanış başlıyor...");
  isOrchestrating = true;
  
  // Yeni AbortController oluştur
  globalForegroundAbortController = new AbortController();
  
  // T+0ms: UI hazırlığı
  const t0 = setTimeout(() => {
    console.log("[ForegroundOrchestrator] T+0ms: UI hazırlığı");
    callbacks.onUIReady?.();
  }, 0);
  orchestratorTimeouts.push(t0);
  
  // T+400ms: Auth/Session recovery
  const t400 = setTimeout(() => {
    console.log("[ForegroundOrchestrator] T+400ms: Auth recovery");
    callbacks.onAuthRecovery?.();
  }, 400);
  orchestratorTimeouts.push(t400);
  
  // T+1000ms: ServerTime sync
  const t1000 = setTimeout(() => {
    console.log("[ForegroundOrchestrator] T+1000ms: Time sync");
    callbacks.onTimeSync?.();
  }, 1000);
  orchestratorTimeouts.push(t1000);
  
  // T+1800ms: Global veri tazeleme
  const t1800 = setTimeout(() => {
    console.log("[ForegroundOrchestrator] T+1800ms: Data refresh");
    callbacks.onDataRefresh?.();
    isOrchestrating = false;
    callbacks.onComplete?.();
  }, 1800);
  orchestratorTimeouts.push(t1800);
  
  // 🔧 Bridge Sağlık Kontrolü: 3 saniye sonra hala veri yüklenememişse
  const bridgeHealthCheck = setTimeout(() => {
    if (isOrchestrating) {
      console.log("[ForegroundOrchestrator] ⚠️ 3sn timeout - Bridge health fail!");
      isOrchestrating = false;
      callbacks.onBridgeHealthFail?.();
    }
  }, 3000);
  orchestratorTimeouts.push(bridgeHealthCheck);
}

/**
 * Orchestration tamamlandı mı?
 */
export function isOrchestrationComplete(): boolean {
  return !isOrchestrating;
}
