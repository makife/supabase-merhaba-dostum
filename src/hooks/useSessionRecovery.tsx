import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { Preferences } from "@capacitor/preferences";

/**
 * 🔧 Session Recovery Hook
 * Native'de arka plandan gelince session'ın kaybolması sorununu çözer
 * Supabase client'ın storage problemi nedeniyle session'ı manuel olarak restore eder
 */
export function useSessionRecovery() {
  const isRecoveringRef = useRef(false);
  const lastRecoveryRef = useRef(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const recoverSession = async () => {
      // Rate limit: 5 saniyede bir
      const now = Date.now();
      if (now - lastRecoveryRef.current < 5000) return;
      if (isRecoveringRef.current) return;
      
      isRecoveringRef.current = true;
      lastRecoveryRef.current = now;

      try {
        console.log("[SessionRecovery] 🔄 Session kontrol başlıyor...");

        // 1. Önce mevcut session'ı kontrol et (timeout ile)
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), 2000)
        );
        
        const sessionPromise = supabase.auth.getSession().then(r => r.data?.session);
        const currentSession = await Promise.race([sessionPromise, timeoutPromise]);

        if (currentSession?.access_token) {
          console.log("[SessionRecovery] ✅ Session zaten mevcut");
          isRecoveringRef.current = false;
          return;
        }

        console.log("[SessionRecovery] ⚠️ Session yok veya timeout, storage'dan restore deneniyor...");

        // 2. Capacitor Preferences'dan session'ı oku
        const { value: storedSession } = await Preferences.get({ 
          key: "sb-nnlvtqmuwmrqfinsgvwc-auth-token" 
        });

        if (!storedSession) {
          console.log("[SessionRecovery] ❌ Storage'da session yok");
          isRecoveringRef.current = false;
          return;
        }

        const parsed = JSON.parse(storedSession);
        
        if (!parsed?.access_token || !parsed?.refresh_token) {
          console.log("[SessionRecovery] ❌ Storage'daki session eksik");
          isRecoveringRef.current = false;
          return;
        }

        // 3. Token'ın süresi dolmuş mu kontrol et
        const expiresAt = parsed.expires_at || 0;
        const now2 = Math.floor(Date.now() / 1000);
        const isExpired = expiresAt < now2 + 60; // 60 sn güvenlik payı

        if (isExpired) {
          console.log("[SessionRecovery] ⚠️ Token süresi dolmuş, refresh deneniyor...");
          
          // Refresh token ile yeni session al
          const { data, error } = await supabase.auth.refreshSession({
            refresh_token: parsed.refresh_token
          });

          if (error || !data.session) {
            console.error("[SessionRecovery] ❌ Refresh başarısız:", error?.message);
            // Refresh başarısız - kullanıcı yeniden giriş yapmalı
          } else {
            console.log("[SessionRecovery] ✅ Session refresh edildi!");
            // Session otomatik olarak set edildi
          }
        } else {
          console.log("[SessionRecovery] ✅ Token hala geçerli, setSession yapılıyor...");
          
          // Token geçerli - direkt set et
          const { error } = await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token
          });

          if (error) {
            console.error("[SessionRecovery] ❌ setSession hatası:", error.message);
          } else {
            console.log("[SessionRecovery] ✅ Session restore edildi!");
          }
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
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) {
            handleForeground();
          }
        });
        appStateCleanup = () => listener.remove();
      } catch (e) {
        console.error("[SessionRecovery] Native listener hatası:", e);
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
