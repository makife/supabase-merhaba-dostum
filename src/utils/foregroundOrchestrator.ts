/**
 * 🎯 FOREGROUND ORCHESTRATOR
 * 
 * Android Native'de arka plandan gelirken tüm işlemleri kademeli (staggered)
 * şekilde yönetir. Aynı anda çok fazla istek Bridge'i tıkar.
 * 
 * Timeline:
 * T+0ms:    UI hazırlığı (immersive bars) + Bridge Kickstart Ping
 * T+400ms:  Auth/Session recovery
 * T+1000ms: ServerTime sync
 * T+1800ms: Global veri tazeleme
 */

import { supabase } from "@/integrations/supabase/client";

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
 * 🆕 BRIDGE KICKSTART: Android'in uyuyan network soketlerini uyandır
 * Küçük bir ping atarak ağ bağlantısını zorla aktifleştir
 */
async function bridgeKickstartPing(): Promise<void> {
  console.log("[ForegroundOrchestrator] 📡 Bridge Kickstart Ping gönderiliyor...");
  
  try {
    // Çok basit ve hızlı bir RPC çağrısı - sadece network'ü uyandırmak için
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s max
    
    await supabase.rpc("get_server_time");
    
    clearTimeout(timeoutId);
    console.log("[ForegroundOrchestrator] ✅ Bridge Kickstart başarılı - network aktif");
  } catch (e: any) {
    // Hata olsa bile sorun değil - amaç sadece network'ü uyandırmak
    console.log("[ForegroundOrchestrator] ⚠️ Bridge Kickstart ping hata (beklenen):", e?.message);
  }
}

/**
 * Kademeli foreground uyanışını başlat
 */
export async function startForegroundOrchestration(callbacks: OrchestrationCallbacks): Promise<void> {
  if (isOrchestrating) {
    console.log("[ForegroundOrchestrator] ⏳ Zaten çalışıyor, önce temizleniyor...");
    abortAllPendingForegroundTasks();
  }
  
  console.log("[ForegroundOrchestrator] 🚀 Kademeli uyanış başlıyor...");
  isOrchestrating = true;
  
  // Yeni AbortController oluştur
  globalForegroundAbortController = new AbortController();
  
  // 🔧 NOT: autoRefreshToken artık TRUE - stopAutoRefresh çağırmıyoruz!
  // Supabase kendi token refresh'ini yönetsin
  
  // T+0ms: UI hazırlığı + Bridge Kickstart Ping (async, bloklama yok)
  const t0 = setTimeout(() => {
    console.log("[ForegroundOrchestrator] T+0ms: UI hazırlığı + Bridge Kickstart");
    callbacks.onUIReady?.();
    
    // 🆕 Bridge Kickstart: Network soketlerini uyandır (async)
    bridgeKickstartPing();
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
  
  // T+1800ms: Global veri tazeleme + data-ready event
  const t1800 = setTimeout(() => {
    console.log("[ForegroundOrchestrator] T+1800ms: Data refresh");
    callbacks.onDataRefresh?.();
    
    // 🔥 data-ready eventi dispatch et - tüm sayfalar verileri yenilesin!
    console.log("[ForegroundOrchestrator] 📢 data-ready eventi dispatch ediliyor...");
    window.dispatchEvent(
      new CustomEvent("data-ready", {
        detail: { source: "foreground-orchestrator" },
      }),
    );
    
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
