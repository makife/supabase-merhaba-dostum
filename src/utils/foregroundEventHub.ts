/**
 * 🔥 DEPRECATED - Bu dosya artık kullanılmıyor!
 * 
 * Basit yaklaşıma geçildi: useAppResume hook ve "app-resumed" eventi
 * 
 * Bu dosya geriye dönük uyumluluk için korunuyor.
 * Yeni kod "app-resumed" eventini dinlemeli.
 */

// DEPRECATED: Eski callback registry - artık kullanılmıyor
type HubCallback = () => void | Promise<void>;
const callbacks = {
  onAuthReady: [] as HubCallback[],
  onProfileReady: [] as HubCallback[],
  onDataReady: [] as HubCallback[],
};

/**
 * @deprecated Artık kullanılmıyor - window.addEventListener("app-resumed", ...) kullanın
 */
export function registerHubCallback(
  event: 'onAuthReady' | 'onProfileReady' | 'onDataReady',
  callback: HubCallback
): () => void {
  console.warn(`[EventHub] ⚠️ DEPRECATED: registerHubCallback artık kullanılmıyor. "app-resumed" eventini dinleyin.`);
  
  // Geriye dönük uyumluluk: app-resumed eventine bağla
  const handler = () => {
    try {
      callback();
    } catch (e) {
      console.error("[EventHub] Callback error:", e);
    }
  };
  
  window.addEventListener("app-resumed", handler);
  
  return () => {
    window.removeEventListener("app-resumed", handler);
  };
}

/**
 * @deprecated Artık kullanılmıyor
 */
export function triggerHub(source: string): void {
  console.warn(`[EventHub] ⚠️ DEPRECATED: triggerHub artık kullanılmıyor.`);
}

/**
 * @deprecated Artık kullanılmıyor
 */
export function triggerHubImmediate(source: string): void {
  console.warn(`[EventHub] ⚠️ DEPRECATED: triggerHubImmediate artık kullanılmıyor.`);
}

/**
 * @deprecated Artık kullanılmıyor
 */
export function isHubProcessing(): boolean {
  return false;
}

/**
 * @deprecated Artık kullanılmıyor
 */
export function getHubStats() {
  return {
    onAuthReady: 0,
    onProfileReady: 0,
    onDataReady: 0,
    isActive: false,
  };
}

/**
 * @deprecated Artık kullanılmıyor
 */
export function initEventHub(): () => void {
  console.warn(`[EventHub] ⚠️ DEPRECATED: initEventHub artık kullanılmıyor.`);
  return () => {};
}
