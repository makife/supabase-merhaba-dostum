import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isFreshWake, getColdStartTime, updateForegroundTime } from "@/utils/coldStartTime";
import { Capacitor } from "@capacitor/core";

/**
 * 🔧 Session Recovery Hook - GÜÇLENDİRİLMİŞ VERSİYON v2
 * 
 * Arka plandan gelince veya kill sonrası session'ın kaybolmasını önler.
 * Invalid Refresh Token durumunda storage'ı temizler.
 */

// Storage key'leri
const CUSTOM_KEY = "kelimele-auth-token";
const LEGACY_KEY = "sb-nnlvtqmuwmrqfinsgvwc-auth-token";

// Daha uzun timeout - Android uyanışı için (15 saniye)
const SESSION_TIMEOUT_MS = 15000;

// Geçersiz session'ı temizle
const clearInvalidSession = async () => {
  console.log("[SessionRecovery] 🗑️ Geçersiz session temizleniyor...");
  
  try {
    // localStorage temizle
    localStorage.removeItem(CUSTOM_KEY);
    localStorage.removeItem(LEGACY_KEY);
    
    // Native Preferences temizle
    if (Capacitor.isNativePlatform()) {
      try {
        const { Preferences } = await import("@capacitor/preferences");
        await Preferences.remove({ key: CUSTOM_KEY });
        await Preferences.remove({ key: LEGACY_KEY });
      } catch (e) {
        console.log("[SessionRecovery] Preferences temizleme hatası:", e);
      }
    }
    
    console.log("[SessionRecovery] ✅ Geçersiz session temizlendi");
  } catch (e) {
    console.error("[SessionRecovery] Session temizleme hatası:", e);
  }
};

export function useSessionRecovery() {
  const isRecoveringRef = useRef(false);
  const lastRecoveryRef = useRef(0);

  useEffect(() => {
    const recoverSession = async () => {
      // Rate limit: 5 saniyede bir (daha toleranslı)
      const now = Date.now();
      if (now - lastRecoveryRef.current < 5000) {
        console.log("[SessionRecovery] ⏳ Rate limit aktif, atlanıyor");
        return;
      }
      if (isRecoveringRef.current) {
        console.log("[SessionRecovery] ⏳ Recovery zaten devam ediyor");
        return;
      }
      
      isRecoveringRef.current = true;
      lastRecoveryRef.current = now;

      try {
        console.log("[SessionRecovery] 🔄 Session kontrol başlıyor...");
        console.log("[SessionRecovery] Cold start:", getColdStartTime(), "isFreshWake:", isFreshWake(20000));

        // 1. Mevcut session'ı kontrol et
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), SESSION_TIMEOUT_MS)
        );
        
        const sessionResult = await Promise.race([sessionPromise, timeoutPromise]);

        if (sessionResult && 'data' in sessionResult) {
          const { data: { session: currentSession }, error } = sessionResult;
          
          if (error) {
            console.log("[SessionRecovery] ⚠️ getSession hatası:", error.message);
          }

          if (currentSession?.access_token) {
            console.log("[SessionRecovery] ✅ Session mevcut:", currentSession.user?.email);
            isRecoveringRef.current = false;
            return;
          }
        } else {
          console.log("[SessionRecovery] ⚠️ Session yok veya timeout, storage'dan restore deneniyor...");
        }

        // 2. Storage'dan session al - ÖNCE localStorage (HybridStorage ile senkronize)
        let storedSession: string | null = null;

        // Önce localStorage'dan dene (SENKRON - cold start'ta bile çalışır)
        try {
          storedSession = localStorage.getItem(CUSTOM_KEY) || localStorage.getItem(LEGACY_KEY);
          if (storedSession) console.log("[SessionRecovery] ✅ localStorage'da session bulundu");
        } catch (e) {
          console.log("[SessionRecovery] ℹ️ localStorage okunamadı");
        }

        // localStorage boşsa Preferences'tan doldur ve senkronize et
        if (!storedSession && Capacitor.isNativePlatform()) {
          try {
            const { Preferences } = await import("@capacitor/preferences");
            const { value } = await Preferences.get({ key: CUSTOM_KEY });
            storedSession = value;
            
            if (!storedSession) {
              const legacy = await Preferences.get({ key: LEGACY_KEY });
              storedSession = legacy.value;
            }
            
            if (storedSession) {
              console.log("[SessionRecovery] ✅ Preferences'da session bulundu, localStorage'a senkronize ediliyor...");
              // HybridStorage sync: Preferences → localStorage
              localStorage.setItem(CUSTOM_KEY, storedSession);
            }
          } catch (e) {
            console.log("[SessionRecovery] ℹ️ Preferences okunamadı");
          }
        }

        if (!storedSession) {
          console.log("[SessionRecovery] ❌ Hiçbir storage'da session yok");
          isRecoveringRef.current = false;
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(storedSession);
        } catch (e) {
          console.log("[SessionRecovery] ❌ Session parse hatası, temizleniyor...");
          await clearInvalidSession();
          isRecoveringRef.current = false;
          return;
        }
        
        // Token süresi kontrolü
        const nowSec = Math.floor(Date.now() / 1000);
        const expiresAt = parsed?.expires_at || 0;
        const isExpired = expiresAt < nowSec;
        
        console.log(`[SessionRecovery] Token durumu: ${isExpired ? '⚠️ EXPIRED' : '✅ VALID'} (expires: ${expiresAt}, now: ${nowSec})`);

        if (!parsed?.refresh_token) {
          console.log("[SessionRecovery] ❌ Refresh token yok, session temizleniyor...");
          await clearInvalidSession();
          isRecoveringRef.current = false;
          return;
        }

        // 3. Refresh token ile yeni session al
        console.log("[SessionRecovery] 🔄 Refresh token ile session yenileniyor...");
        
        const refreshPromise = supabase.auth.refreshSession({ refresh_token: parsed.refresh_token });
        const refreshTimeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), SESSION_TIMEOUT_MS)
        );
        
        const refreshResult = await Promise.race([refreshPromise, refreshTimeoutPromise]);

        if (refreshResult && 'data' in refreshResult) {
          const { data, error: refreshError } = refreshResult;
          
          if (refreshError) {
            const errorMessage = refreshError.message || '';
            console.error("[SessionRecovery] ❌ Refresh başarısız:", errorMessage);
            
            // 🆕 Invalid Refresh Token hatası - session'ı tamamen temizle
            if (
              errorMessage.toLowerCase().includes('invalid') ||
              errorMessage.toLowerCase().includes('not found') ||
              errorMessage.toLowerCase().includes('expired') ||
              errorMessage.toLowerCase().includes('revoked')
            ) {
              console.log("[SessionRecovery] 🗑️ Invalid token tespit edildi, session temizleniyor...");
              await clearInvalidSession();
              
              // Supabase client'ı da temizle
              try {
                await supabase.auth.signOut({ scope: 'local' });
              } catch (e) {
                // Sessizce geç
              }
              
              isRecoveringRef.current = false;
              return;
            }
            
            // Token expired değilse setSession dene
            if (!isExpired && parsed.access_token) {
              console.log("[SessionRecovery] 🔄 Token hala geçerli, setSession deneniyor...");
              const { error: setError } = await supabase.auth.setSession({
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token
              });
              
              if (setError) {
                console.error("[SessionRecovery] ❌ setSession hatası:", setError.message);
                // setSession de başarısız olduysa session'ı temizle
                if (setError.message.toLowerCase().includes('invalid')) {
                  await clearInvalidSession();
                }
              } else {
                console.log("[SessionRecovery] ✅ setSession başarılı!");
              }
            }
          } else if (data?.session) {
            console.log("[SessionRecovery] ✅ Session refresh edildi:", data.session.user?.email);
          }
        } else {
          console.log("[SessionRecovery] ⚠️ Refresh timeout (15s)");
        }

      } catch (e) {
        console.error("[SessionRecovery] ❌ Beklenmeyen hata:", e);
      } finally {
        isRecoveringRef.current = false;
      }
    };

    // 🔧 Event handlers
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        console.log("[SessionRecovery] 👁️ Visible - recovery tetikleniyor...");
        updateForegroundTime();
        recoverSession();
      }
    };

    const handleReconnect = () => {
      console.log("[SessionRecovery] 🔔 supabase-reconnected - recovery tetikleniyor...");
      recoverSession();
    };

    const handleAuthRecovery = () => {
      console.log("[SessionRecovery] 🔄 Orchestrator auth recovery event");
      recoverSession();
    };

    // Web visibility listener
    document.addEventListener("visibilitychange", handleVisibility);
    
    // Custom events
    window.addEventListener("supabase-reconnected", handleReconnect);
    window.addEventListener("app-auth-recovery", handleAuthRecovery);

    // İlk yüklemede de çalıştır (cold start)
    console.log("[SessionRecovery] 🚀 İlk yükleme - cold start recovery");
    recoverSession();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("supabase-reconnected", handleReconnect);
      window.removeEventListener("app-auth-recovery", handleAuthRecovery);
    };
  }, []);
}
