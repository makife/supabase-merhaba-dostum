import { useEffect, useRef } from "react";

/**
 * 🎯 SIMPLE APP RESUME HOOK
 * 
 * "app-resumed" eventini dinler ve callback çağırır.
 * Event, useAppForegroundState tarafından dispatch edilir.
 * 
 * ÖNEMLİ: Bu hook component lifecycle'dan bağımsız çalışır.
 * Callback'ler ref ile tutulur, böylece component unmount olsa bile 
 * en son callback referansı korunur.
 */

// 🔥 GLOBAL CALLBACK REGISTRY - component unmount'lardan etkilenmez
type ResumeCallback = () => void;
const globalResumeCallbacks = new Map<string, ResumeCallback>();
let globalListenerInitialized = false;

// Global listener'ı bir kez kur
function initGlobalResumeListener() {
  if (globalListenerInitialized) return;
  globalListenerInitialized = true;
  
  console.log("[useAppResume] 🌐 Global listener kuruluyor...");
  
  window.addEventListener("app-resumed", () => {
    console.log(`[useAppResume] 📡 app-resumed alındı, ${globalResumeCallbacks.size} callback çağrılacak`);
    
    globalResumeCallbacks.forEach((callback, id) => {
      try {
        console.log(`[useAppResume] 🔄 Callback çağrılıyor: ${id}`);
        callback();
      } catch (e) {
        console.error(`[useAppResume] ❌ Callback hatası (${id}):`, e);
      }
    });
  });
}

/**
 * App resume hook - component mount olduğunda callback kaydeder
 * Component unmount olduğunda callback kaldırılır
 * 
 * @param id - Unique identifier for this callback
 * @param callback - Function to call on app resume
 */
export function useAppResume(id: string, callback: () => void) {
  const callbackRef = useRef(callback);
  
  // Her render'da en güncel callback'i ref'e kaydet
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    // Global listener'ı başlat (bir kez)
    initGlobalResumeListener();
    
    // Bu component'in callback'ini kaydet
    const wrappedCallback = () => {
      callbackRef.current();
    };
    
    console.log(`[useAppResume] ➕ Callback kaydedildi: ${id}`);
    globalResumeCallbacks.set(id, wrappedCallback);
    
    return () => {
      console.log(`[useAppResume] ➖ Callback silindi: ${id}`);
      globalResumeCallbacks.delete(id);
    };
  }, [id]);
}

/**
 * Debug: Kayıtlı callback sayısını döndür
 */
export function getResumeCallbackCount(): number {
  return globalResumeCallbacks.size;
}
