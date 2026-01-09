/**
 * 🎯 FOREGROUND ORCHESTRATOR V2 - Sequential Cold-Start Simulation
 * 
 * Android Native'de arka plandan gelirken SIRALI (sequential) veri yükleme.
 * Cold start güvenilirliğini sağlar, ama Loading screen göstermez.
 * 
 * Akış:
 * 1. Temizlik: Tüm subscription'ları kapat, zombi istekleri iptal et
 * 2. Session Recovery: BEKLE - tamam olana kadar devam etme
 * 3. Profile Fetch: BEKLE - tamam olana kadar devam etme
 * 4. Subscription'ları Aç: Joker, Chat, Role vs.
 * 5. Kullanıcı aynı sayfada kalır
 */

import { supabase, loadSessionFromStorage, saveSessionToStorage } from "@/integrations/supabase/client";

// Global AbortController - tüm zombi istekleri temizlemek için
let globalForegroundAbortController: AbortController | null = null;

// Orchestrator state
let isOrchestrating = false;
let orchestratorTimeouts: NodeJS.Timeout[] = [];

// Callback türleri
type OrchestrationCallbacks = {
  onCleanupStart?: () => void;           // Temizlik başladı
  onSessionRecoveryStart?: () => void;   // Session recovery başladı
  onSessionRecoveryComplete?: (success: boolean) => void; // Session tamam
  onProfileFetchStart?: () => void;      // Profile fetch başladı
  onProfileFetchComplete?: (success: boolean) => void;   // Profile tamam
  onSubscriptionsReady?: () => void;     // Subscription'lar açılabilir
  onComplete?: () => void;               // Tüm süreç tamamlandı
  onError?: (error: string) => void;     // Hata oluştu
};

// Subscription cleanup fonksiyonları - hook'lar buraya register olacak
type CleanupFunction = () => void;
const registeredCleanupFunctions: CleanupFunction[] = [];

// Recovery tamamlandığında çağrılacak callback'ler
const recoveryCompleteListeners: Set<() => void> = new Set();

/**
 * Hook'lar kendi cleanup fonksiyonlarını buraya kaydetsin
 * Örn: useJokerInventory, useChatNotifications
 */
export function registerForegroundCleanup(cleanupFn: CleanupFunction): () => void {
  registeredCleanupFunctions.push(cleanupFn);
  
  // Unregister fonksiyonu döndür
  return () => {
    const index = registeredCleanupFunctions.indexOf(cleanupFn);
    if (index > -1) {
      registeredCleanupFunctions.splice(index, 1);
    }
  };
}

/**
 * Sequential recovery tamamlandığında bildirim al
 * Hook'lar subscription'larını bu event'te açabilir
 */
export function subscribeToRecoveryComplete(callback: () => void): () => void {
  recoveryCompleteListeners.add(callback);
  return () => recoveryCompleteListeners.delete(callback);
}

/**
 * Recovery tamamlandığında tüm listener'ları bilgilendir
 */
function notifyRecoveryComplete(): void {
  console.log(`[ForegroundOrchestrator] 🔔 Recovery complete - ${recoveryCompleteListeners.size} listener bilgilendiriliyor`);
  recoveryCompleteListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.warn("[ForegroundOrchestrator] Recovery listener hatası:", e);
    }
  });
}

/**
 * Tüm bekleyen foreground işlemlerini iptal et
 */
export function abortAllPendingForegroundTasks(): void {
  console.log("[ForegroundOrchestrator] 🛑 Temizlik başlıyor...");
  
  // 1. Global AbortController ile tüm fetch'leri iptal et
  if (globalForegroundAbortController) {
    globalForegroundAbortController.abort();
  }
  globalForegroundAbortController = new AbortController();
  
  // 2. Orchestrator timeout'larını temizle
  orchestratorTimeouts.forEach(t => clearTimeout(t));
  orchestratorTimeouts = [];
  
  // 3. Kayıtlı cleanup fonksiyonlarını çağır
  console.log(`[ForegroundOrchestrator] 🧹 ${registeredCleanupFunctions.length} subscription temizleniyor...`);
  registeredCleanupFunctions.forEach(cleanup => {
    try {
      cleanup();
    } catch (e) {
      console.warn("[ForegroundOrchestrator] Cleanup hatası:", e);
    }
  });
  
  // 4. Flag'i sıfırla
  isOrchestrating = false;
}

/**
 * Global AbortSignal al - fetch'lerde kullan
 */
export function getForegroundAbortSignal(): AbortSignal | undefined {
  return globalForegroundAbortController?.signal;
}

/**
 * ADIM 2: Session Recovery - Storage'dan yükle ve refresh et
 */
async function performSessionRecovery(): Promise<boolean> {
  console.log("[ForegroundOrchestrator] 🔐 Session recovery başlıyor...");
  
  try {
    // Önce mevcut session'ı kontrol et
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      console.log("[ForegroundOrchestrator] ✅ Session zaten aktif");
      return true;
    }
    
    // Storage'dan yükle
    const stored = await loadSessionFromStorage();
    
    if (!stored?.refresh_token) {
      console.log("[ForegroundOrchestrator] ⚠️ Storage'da session yok - login gerekli");
      return false;
    }
    
    // Token refresh
    console.log("[ForegroundOrchestrator] 🔄 Token refresh yapılıyor...");
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: stored.refresh_token,
    });
    
    if (error) {
      console.error("[ForegroundOrchestrator] ❌ Refresh hatası:", error.message);
      return false;
    }
    
    if (data?.session) {
      await saveSessionToStorage(data.session);
      console.log("[ForegroundOrchestrator] ✅ Session yenilendi!");
      return true;
    }
    
    return false;
  } catch (e: any) {
    console.error("[ForegroundOrchestrator] ❌ Session recovery hatası:", e);
    return false;
  }
}

/**
 * ADIM 3: Profile Fetch
 */
async function performProfileFetch(userId: string): Promise<boolean> {
  console.log("[ForegroundOrchestrator] 👤 Profile fetch başlıyor...");
  
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .eq("id", userId)
      .single();
    
    if (error) {
      console.error("[ForegroundOrchestrator] ❌ Profile fetch hatası:", error.message);
      return false;
    }
    
    if (data) {
      console.log("[ForegroundOrchestrator] ✅ Profile yüklendi:", data.username);
      return true;
    }
    
    return false;
  } catch (e: any) {
    console.error("[ForegroundOrchestrator] ❌ Profile fetch exception:", e);
    return false;
  }
}

/**
 * 🚀 ANA FONKSİYON: Sequential Cold-Start Simulation
 * 
 * Arka plandan dönüşte cold start sırasını taklit eder.
 * Kullanıcı aynı sayfada kalır, loading screen GÖSTERMEZ.
 */
export async function startSequentialForegroundRecovery(callbacks: OrchestrationCallbacks): Promise<void> {
  // Zaten çalışıyorsa bekle
  if (isOrchestrating) {
    console.log("[ForegroundOrchestrator] ⏳ Zaten çalışıyor, atlanıyor...");
    return;
  }
  
  console.log("[ForegroundOrchestrator] 🚀 === SEQUENTIAL RECOVERY BAŞLIYOR ===");
  isOrchestrating = true;
  
  // Yeni AbortController
  globalForegroundAbortController = new AbortController();
  
  try {
    // ═══════════════════════════════════════════════════════════
    // ADIM 1: TEMİZLİK
    // ═══════════════════════════════════════════════════════════
    console.log("[ForegroundOrchestrator] 📍 ADIM 1: Temizlik");
    callbacks.onCleanupStart?.();
    
    // Kayıtlı cleanup'ları çağır (subscription'ları kapat)
    registeredCleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (e) {
        console.warn("[ForegroundOrchestrator] Cleanup hatası:", e);
      }
    });
    
    // Kısa bekleme - cleanup'ların tamamlanması için
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // ═══════════════════════════════════════════════════════════
    // ADIM 2: SESSION RECOVERY (BEKLE!)
    // ═══════════════════════════════════════════════════════════
    console.log("[ForegroundOrchestrator] 📍 ADIM 2: Session Recovery");
    callbacks.onSessionRecoveryStart?.();
    
    const sessionSuccess = await performSessionRecovery();
    callbacks.onSessionRecoveryComplete?.(sessionSuccess);
    
    if (!sessionSuccess) {
      console.log("[ForegroundOrchestrator] ⚠️ Session recovery başarısız - akış durduruluyor");
      isOrchestrating = false;
      callbacks.onError?.("Session recovery failed");
      return;
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADIM 3: PROFILE FETCH (BEKLE!)
    // ═══════════════════════════════════════════════════════════
    console.log("[ForegroundOrchestrator] 📍 ADIM 3: Profile Fetch");
    callbacks.onProfileFetchStart?.();
    
    // Session'dan user ID al
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    if (!userId) {
      console.log("[ForegroundOrchestrator] ⚠️ User ID bulunamadı");
      isOrchestrating = false;
      callbacks.onError?.("No user ID");
      return;
    }
    
    const profileSuccess = await performProfileFetch(userId);
    callbacks.onProfileFetchComplete?.(profileSuccess);
    
    // Profile başarısız olsa bile devam et - subscription'ları açalım
    if (!profileSuccess) {
      console.log("[ForegroundOrchestrator] ⚠️ Profile fetch başarısız ama devam ediliyor");
    }
    
    // ═══════════════════════════════════════════════════════════
    // ADIM 4: SUBSCRIPTION'LAR AÇILACAK
    // ═══════════════════════════════════════════════════════════
    console.log("[ForegroundOrchestrator] 📍 ADIM 4: Subscription'lar hazır");
    callbacks.onSubscriptionsReady?.();
    
    // 🔔 Tüm dinleyicilere "recovery tamamlandı" sinyali gönder
    notifyRecoveryComplete();
    
    // Kısa bekleme - subscription'ların kurulması için
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // ═══════════════════════════════════════════════════════════
    // TAMAMLANDI
    // ═══════════════════════════════════════════════════════════
    console.log("[ForegroundOrchestrator] ✅ === SEQUENTIAL RECOVERY TAMAMLANDI ===");
    isOrchestrating = false;
    callbacks.onComplete?.();
    
  } catch (e: any) {
    console.error("[ForegroundOrchestrator] ❌ Recovery hatası:", e);
    isOrchestrating = false;
    callbacks.onError?.(e.message || "Unknown error");
  }
}

/**
 * ESKİ FONKSİYON - Geriye uyumluluk için (deprecated)
 * Yeni kod startSequentialForegroundRecovery kullanmalı
 */
export async function startForegroundOrchestration(callbacks: {
  onUIReady?: () => void;
  onAuthRecovery?: () => void;
  onTimeSync?: () => void;
  onDataRefresh?: () => void;
  onComplete?: () => void;
  onBridgeHealthFail?: () => void;
}): Promise<void> {
  console.log("[ForegroundOrchestrator] ⚠️ Eski API kullanılıyor - Sequential Recovery'e yönlendiriliyor");
  
  await startSequentialForegroundRecovery({
    onSessionRecoveryStart: callbacks.onAuthRecovery,
    onSubscriptionsReady: callbacks.onDataRefresh,
    onComplete: callbacks.onComplete,
    onError: () => callbacks.onBridgeHealthFail?.(),
  });
}

/**
 * Orchestration tamamlandı mı?
 */
export function isOrchestrationComplete(): boolean {
  return !isOrchestrating;
}

/**
 * Orchestration çalışıyor mu?
 */
export function isOrchestrationRunning(): boolean {
  return isOrchestrating;
}
