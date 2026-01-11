import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

/**
 * 🔥 ULTRA BASİT APP RESUME HOOK
 * 
 * Tek iş: Uygulama ön plana geldiğinde callback çağır.
 * Karmaşık orchestration YOK. Debounce YOK. Hub YOK.
 * 
 * Kullanım:
 * useAppResume(() => {
 *   refreshData();
 * });
 */

// Global state - tek listener
let globalListenerReady = false;
const resumeCallbacks = new Set<() => void>();

// Session recovery helper
async function recoverSessionIfNeeded(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Storage'dan refresh et
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        console.log('[AppResume] ⚠️ Session yok');
        return false;
      }
    }
    
    console.log('[AppResume] ✅ Session aktif');
    return true;
  } catch (e) {
    console.error('[AppResume] ❌ Session recovery hatası:', e);
    return false;
  }
}

// Tüm callback'leri çağır
async function notifyAllCallbacks() {
  console.log(`[AppResume] 🔔 ${resumeCallbacks.size} callback çağrılıyor...`);
  
  // Önce session recovery
  const sessionOk = await recoverSessionIfNeeded();
  if (!sessionOk) {
    console.log('[AppResume] ⏭️ Session yok, callback\'ler atlanıyor');
    return;
  }
  
  // Tüm callback'leri çağır (parallel)
  const promises: Promise<void>[] = [];
  
  resumeCallbacks.forEach(cb => {
    promises.push(
      Promise.resolve().then(() => {
        try {
          cb();
        } catch (e) {
          console.error('[AppResume] Callback hatası:', e);
        }
      })
    );
  });
  
  await Promise.all(promises);
  console.log('[AppResume] ✅ Tüm callback\'ler tamamlandı');
}

// Global listener'ı kur (sadece 1 kez)
function initGlobalListener() {
  if (globalListenerReady) return;
  globalListenerReady = true;
  
  console.log('[AppResume] 🎯 Global listener başlatılıyor...');
  
  if (Capacitor.isNativePlatform()) {
    // Native: App state change
    App.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        console.log('[AppResume] 📱 Native: Ön plana gelindi');
        
        // Kısa gecikme - UI'ın hazır olmasını bekle
        await new Promise(r => setTimeout(r, 200));
        
        notifyAllCallbacks();
      }
    });
    console.log('[AppResume] ✅ Native listener kuruldu');
  } else {
    // Web: Visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        console.log('[AppResume] 👁️ Web: Görünür oldu');
        notifyAllCallbacks();
      }
    });
    console.log('[AppResume] ✅ Web listener kuruldu');
  }
}

/**
 * Hook: Uygulama ön plana geldiğinde callback çağır
 */
export function useAppResume(callback: () => void, deps: React.DependencyList = []) {
  const callbackRef = useRef(callback);
  const isMountedRef = useRef(true);
  
  // Callback'i güncel tut
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...deps]);
  
  useEffect(() => {
    isMountedRef.current = true;
    
    // Global listener'ı başlat (lazy)
    initGlobalListener();
    
    // Wrapper callback
    const wrappedCallback = () => {
      if (isMountedRef.current) {
        callbackRef.current();
      }
    };
    
    // Register
    resumeCallbacks.add(wrappedCallback);
    console.log(`[AppResume] ➕ Callback eklendi (toplam: ${resumeCallbacks.size})`);
    
    return () => {
      isMountedRef.current = false;
      resumeCallbacks.delete(wrappedCallback);
      console.log(`[AppResume] ➖ Callback silindi (kalan: ${resumeCallbacks.size})`);
    };
  }, []);
}

/**
 * Manuel resume tetikle (test için)
 */
export function triggerManualResume() {
  console.log('[AppResume] 🔧 Manuel tetikleme');
  notifyAllCallbacks();
}

/**
 * Callback sayısını al (debug için)
 */
export function getResumeCallbackCount(): number {
  return resumeCallbacks.size;
}
