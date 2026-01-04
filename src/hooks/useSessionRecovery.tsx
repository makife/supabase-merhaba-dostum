import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * 🔧 Session Recovery Hook
 * Arka plandan gelince session'ın kaybolması sorununu çözer
 * Hem native hem web için çalışır
 */
export function useSessionRecovery() {
  const isRecoveringRef = useRef(false);
  const lastRecoveryRef = useRef(0);

  useEffect(() => {
    const recoverSession = async () => {
      // Rate limit: 3 saniyede bir
      const now = Date.now();
      if (now - lastRecoveryRef.current < 3000) return;
      if (isRecoveringRef.current) return;
      
      isRecoveringRef.current = true;
      lastRecoveryRef.current = now;

      try {
        console.log("[SessionRecovery] 🔄 Session kontrol başlıyor...");

        // 1. Mevcut session'ı kontrol et
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (currentSession?.access_token) {
          console.log("[SessionRecovery] ✅ Session mevcut:", currentSession.user?.email);
          isRecoveringRef.current = false;
          return;
        }

        console.log("[SessionRecovery] ⚠️ Session yok, storage'dan restore deneniyor...");

        // 2. localStorage'dan session oku
        const storedSessionKey = "sb-nnlvtqmuwmrqfinsgvwc-auth-token";
        let storedSession: string | null = null;

        // Önce localStorage'dan dene
        try {
          storedSession = localStorage.getItem(storedSessionKey);
        } catch (e) {
          console.log("[SessionRecovery] localStorage okunamadı");
        }

        // Native ise Preferences'dan da dene
        if (!storedSession) {
          try {
            const { Preferences } = await import("@capacitor/preferences");
            const { value } = await Preferences.get({ key: storedSessionKey });
            storedSession = value;
          } catch (e) {
            console.log("[SessionRecovery] Preferences okunamadı");
          }
        }

        if (!storedSession) {
          console.log("[SessionRecovery] ❌ Storage'da session yok");
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
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: parsed.refresh_token
        });

        if (error || !data.session) {
          console.error("[SessionRecovery] ❌ Refresh başarısız:", error?.message);
          
          // Son çare: setSession dene
          if (parsed.access_token) {
            console.log("[SessionRecovery] 🔄 setSession deneniyor...");
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
      recoverSession();
    };

    // Visibility change'i de dinle
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        console.log("[SessionRecovery] 👁️ Visible - recovery tetikleniyor...");
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
        console.log("[SessionRecovery] Native listener hatası:", e);
      }
    };

    setupNativeListener();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("appForeground", handleForeground);

    // İlk yüklemede de çalıştır
    recoverSession();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("appForeground", handleForeground);
      appStateCleanup?.();
    };
  }, []);
}
