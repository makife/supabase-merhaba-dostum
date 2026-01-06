import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isFreshWake, getColdStartTime, updateForegroundTime } from "@/utils/coldStartTime";

/**
 * 🔧 Session Recovery Hook - GÜÇLENDİRİLMİŞ VERSİYON
 * 
 * Arka plandan gelince veya kill sonrası session'ın kaybolmasını önler.
 * Cold start ve foreground geçişlerinde koordineli çalışır.
 */
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
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.log("[SessionRecovery] ⚠️ getSession hatası:", error.message);
        }

        if (currentSession?.access_token) {
          console.log("[SessionRecovery] ✅ Session mevcut:", currentSession.user?.email);
          isRecoveringRef.current = false;
          return;
        }

        console.log("[SessionRecovery] ⚠️ Session yok, storage'dan restore deneniyor...");

        // 2. Storage key'leri
        const CUSTOM_KEY = "kelimele-auth-token";
        const LEGACY_KEY = "sb-nnlvtqmuwmrqfinsgvwc-auth-token";
        
        let storedSession: string | null = null;

        // Önce Preferences'dan (native storage) dene
        try {
          const { Preferences } = await import("@capacitor/preferences");
          const { value } = await Preferences.get({ key: CUSTOM_KEY });
          storedSession = value;
          if (!storedSession) {
            const legacy = await Preferences.get({ key: LEGACY_KEY });
            storedSession = legacy.value;
          }
          if (storedSession) console.log("[SessionRecovery] ✅ Preferences'da session bulundu");
        } catch (e) {
          console.log("[SessionRecovery] ℹ️ Preferences okunamadı (web ortamı olabilir)");
        }

        // Yoksa localStorage'dan dene
        if (!storedSession) {
          try {
            storedSession = localStorage.getItem(CUSTOM_KEY) || localStorage.getItem(LEGACY_KEY);
            if (storedSession) console.log("[SessionRecovery] ✅ localStorage'da session bulundu");
          } catch (e) {
            console.log("[SessionRecovery] ℹ️ localStorage okunamadı");
          }
        }

        if (!storedSession) {
          console.log("[SessionRecovery] ❌ Hiçbir storage'da session yok");
          isRecoveringRef.current = false;
          return;
        }

        const parsed = JSON.parse(storedSession);
        
        if (!parsed?.refresh_token) {
          console.log("[SessionRecovery] ❌ Refresh token yok");
          isRecoveringRef.current = false;
          return;
        }

        console.log("[SessionRecovery] 🔄 Refresh token bulundu, session yenileniyor...");
        
        // 3. Refresh token ile yeni session al
        const { data, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: parsed.refresh_token
        });

        if (refreshError || !data.session) {
          console.error("[SessionRecovery] ❌ Refresh başarısız:", refreshError?.message);
          
          // Son çare: setSession dene (token expired değilse işe yarayabilir)
          if (parsed.access_token && parsed.expires_at) {
            const nowSec = Math.floor(Date.now() / 1000);
            if (parsed.expires_at > nowSec) {
              console.log("[SessionRecovery] 🔄 Token hala geçerli, setSession deneniyor...");
              const { error: setError } = await supabase.auth.setSession({
                access_token: parsed.access_token,
                refresh_token: parsed.refresh_token
              });
              
              if (setError) {
                console.error("[SessionRecovery] ❌ setSession hatası:", setError.message);
              } else {
                console.log("[SessionRecovery] ✅ setSession başarılı!");
              }
            }
          }
        } else {
          console.log("[SessionRecovery] ✅ Session refresh edildi:", data.session.user?.email);
        }

      } catch (e) {
        console.error("[SessionRecovery] ❌ Beklenmeyen hata:", e);
      } finally {
        isRecoveringRef.current = false;
      }
    };

    // App foreground event'ini dinle
    const handleForeground = () => {
      console.log("[SessionRecovery] 📱 Foreground - recovery tetikleniyor...");
      // Foreground time'ı güncelle (coldStartTime.ts'deki fonksiyon)
      updateForegroundTime();
      recoverSession();
    };

    // Auth recovery event'ini dinle (orchestrator'dan gelir)
    const handleAuthRecovery = () => {
      console.log("[SessionRecovery] 🔄 Orchestrator auth recovery event");
      recoverSession();
    };

    // Visibility change'i de dinle
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        console.log("[SessionRecovery] 👁️ Visible - recovery tetikleniyor...");
        updateForegroundTime();
        recoverSession();
      }
    };

    // Native App state listener
    let appStateCleanup: (() => void) | undefined;
    
    const setupNativeListener = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.isNativePlatform()) {
          const { App } = await import("@capacitor/app");
          const listener = await App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) {
              handleForeground();
            }
          });
          appStateCleanup = () => listener.remove();
        }
      } catch (e) {
        console.log("[SessionRecovery] ℹ️ Native listener kurulumu atlandı (web ortamı)");
      }
    };

    setupNativeListener();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("appForeground", handleForeground);
    window.addEventListener("app-auth-recovery", handleAuthRecovery);

    // İlk yüklemede de çalıştır (cold start)
    console.log("[SessionRecovery] 🚀 İlk yükleme - cold start recovery");
    recoverSession();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("appForeground", handleForeground);
      window.removeEventListener("app-auth-recovery", handleAuthRecovery);
      appStateCleanup?.();
    };
  }, []);
}
