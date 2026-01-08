import { useEffect, useRef } from "react";
import { supabase, loadSessionFromStorage, saveSessionToStorage, clearSessionStorage } from "@/integrations/supabase/client";
import { isFreshWake, getColdStartTime, updateForegroundTime } from "@/utils/coldStartTime";
import { Capacitor } from "@capacitor/core";

/**
 * 🔧 Session Recovery Hook - V3 (SADECE Preferences Kullanan)
 * 
 * Arka plandan gelince veya kill sonrası session'ın kaybolmasını önler.
 * localStorage KULLANMAZ - sadece Preferences (Native Storage)
 */

const SESSION_TIMEOUT_MS = 10000;

export function useSessionRecovery() {
  const isRecoveringRef = useRef(false);
  const lastRecoveryRef = useRef(0);

  useEffect(() => {
    // Native değilse bu hook'a gerek yok
    if (!Capacitor.isNativePlatform()) {
      console.log("[SessionRecovery] ℹ️ Web platformu, recovery hook devre dışı");
      return;
    }

    const recoverSession = async () => {
      // Rate limit: 5 saniyede bir
      const now = Date.now();
      if (now - lastRecoveryRef.current < 5000) {
        console.log("[SessionRecovery] ⏳ Rate limit aktif");
        return;
      }
      if (isRecoveringRef.current) {
        console.log("[SessionRecovery] ⏳ Recovery devam ediyor");
        return;
      }
      
      isRecoveringRef.current = true;
      lastRecoveryRef.current = now;

      try {
        console.log("[SessionRecovery] 🔄 Session kontrol...");
        console.log("[SessionRecovery] isFreshWake:", isFreshWake(20000));

        // 1. Supabase'den mevcut session kontrol
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<null>((resolve) => 
          setTimeout(() => resolve(null), SESSION_TIMEOUT_MS)
        );
        
        const result = await Promise.race([sessionPromise, timeoutPromise]);

        if (result && 'data' in result && result.data?.session?.access_token) {
          console.log("[SessionRecovery] ✅ Session mevcut");
          isRecoveringRef.current = false;
          return;
        }

        console.log("[SessionRecovery] ⚠️ Session yok, storage'dan restore...");

        // 2. Preferences'tan session yükle
        const storedSession = await loadSessionFromStorage();

        if (!storedSession || !storedSession.refresh_token) {
          console.log("[SessionRecovery] ❌ Storage'da geçerli session yok");
          isRecoveringRef.current = false;
          return;
        }

        // 3. Refresh token ile yenile
        console.log("[SessionRecovery] 🔄 Token refresh...");
        
        const refreshPromise = supabase.auth.refreshSession({ 
          refresh_token: storedSession.refresh_token 
        });
        
        const refreshResult = await Promise.race([refreshPromise, timeoutPromise]);

        if (refreshResult && 'data' in refreshResult) {
          const { data, error } = refreshResult;
          
          if (error) {
            const msg = error.message?.toLowerCase() || '';
            console.error("[SessionRecovery] ❌ Refresh hatası:", error.message);
            
            // Invalid token - storage temizle
            if (msg.includes('invalid') || msg.includes('expired') || msg.includes('revoked')) {
              console.log("[SessionRecovery] 🗑️ Invalid token, storage temizleniyor");
              await clearSessionStorage();
            }
          } else if (data?.session) {
            console.log("[SessionRecovery] ✅ Session yenilendi!");
            await saveSessionToStorage(data.session);
          }
        } else {
          console.log("[SessionRecovery] ⚠️ Refresh timeout");
          
          // Timeout oldu ama token hala geçerli olabilir - setSession dene
          const nowSec = Math.floor(Date.now() / 1000);
          if (storedSession.expires_at && storedSession.expires_at > nowSec) {
            console.log("[SessionRecovery] 🔄 Token geçerli, setSession...");
            
            const { error } = await supabase.auth.setSession({
              access_token: storedSession.access_token,
              refresh_token: storedSession.refresh_token,
            });
            
            if (error) {
              console.error("[SessionRecovery] setSession hatası:", error.message);
            } else {
              console.log("[SessionRecovery] ✅ setSession başarılı");
            }
          }
        }

      } catch (e) {
        console.error("[SessionRecovery] ❌ Hata:", e);
      } finally {
        isRecoveringRef.current = false;
      }
    };

    // Event handlers
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        console.log("[SessionRecovery] 👁️ Visible");
        updateForegroundTime();
        recoverSession();
      }
    };

    const handleReconnect = () => {
      console.log("[SessionRecovery] 🔔 Reconnect event");
      recoverSession();
    };

    // Listeners
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("supabase-reconnected", handleReconnect);
    window.addEventListener("app-auth-recovery", handleReconnect);

    // Cold start recovery
    console.log("[SessionRecovery] 🚀 Cold start recovery");
    recoverSession();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("supabase-reconnected", handleReconnect);
      window.removeEventListener("app-auth-recovery", handleReconnect);
    };
  }, []);
}
