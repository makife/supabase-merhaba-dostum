import { useEffect, useRef } from "react";
import {
  supabase,
  loadSessionFromStorage,
  saveSessionToStorage,
  setGlobalAccessToken,
  clearSessionStorage,
} from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

/**
 * 🔧 Session Recovery Hook - V6 (GLOBAL TOKEN FIX)
 * Arka plandan gelince session'ı korur ve geri yükler
 * TEK KAYNAK: client.ts storage fonksiyonları
 *
 * 🔥🔥🔥 KRİTİK: Native'de her istek için globalAccessToken gerekli!
 * Bu hook session recovery sırasında token'ı global'e set ediyor.
 */

export function useSessionRecovery() {
  const lastRecoveryRef = useRef(0);
  const isRecoveringRef = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const recoverSession = async (source: string = "unknown") => {
      const now = Date.now();

      // Rate limit: 5 saniyede bir
      if (now - lastRecoveryRef.current < 5000 || isRecoveringRef.current) {
        console.log(`[SessionRecovery] ⏳ Atlandı (${source}) - cooldown veya işlem devam ediyor`);
        return;
      }

      isRecoveringRef.current = true;
      lastRecoveryRef.current = now;

      try {
        console.log(`[SessionRecovery] 🔄 Başlıyor... (${source})`);

        // 1. Supabase'den mevcut session'ı kontrol et
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (currentSession?.access_token && currentSession?.user) {
          console.log("[SessionRecovery] ✅ Session zaten aktif:", currentSession.user.email);

          // 🔥🔥🔥 KRİTİK: GLOBAL TOKEN'I SET ET!
          setGlobalAccessToken(currentSession.access_token);
          console.log("[SessionRecovery] 🔑 Global token SET EDİLDİ!");

          // 🔥 HEMEN auth-ready dispatch et (bekleme YOK!)
          console.log("[SessionRecovery] 📢 auth-ready eventi dispatch ediliyor (existing session)...");
          window.dispatchEvent(
            new CustomEvent("auth-ready", {
              detail: {
                userId: currentSession.user.id,
                email: currentSession.user.email,
                source: "existing-session",
              },
            }),
          );

          isRecoveringRef.current = false;
          return;
        }

        // 2. Storage'dan session yükle
        const stored = await loadSessionFromStorage();

        if (!stored?.refresh_token || !stored?.user) {
          console.log("[SessionRecovery] ⚠️ Storage'da geçerli session yok");
          isRecoveringRef.current = false;
          return;
        }

        console.log("[SessionRecovery] 📦 Storage'da session bulundu:", stored.user.email);

        // 🔥🔥🔥 KRİTİK FİX: Token'ı HEMEN global'e set et (optimistic)
        setGlobalAccessToken(stored.access_token);
        console.log("[SessionRecovery] 🔑 Global token SET EDİLDİ (optimistic - storage'dan)");

        // 🔥 Supabase'e session'ı set et (refresh yerine ÖNCE setSession)
        console.log("[SessionRecovery] 🔄 Storage session Supabase'e set ediliyor...");

        const { error: setError } = await supabase.auth.setSession({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
        });

        if (setError) {
          console.error("[SessionRecovery] ⚠️ setSession hatası:", setError.message);

          // setSession başarısız - refresh dene
          console.log("[SessionRecovery] 🔄 setSession başarısız, refresh deneniyor...");
        }

        // 🔥 Şimdi token refresh yap (arka planda)
        console.log("[SessionRecovery] 🔄 Token refresh yapılıyor...");

        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: stored.refresh_token,
        });

        if (error) {
          console.log("[SessionRecovery] ⚠️ Refresh hatası:", error.message);

          // Token tamamen geçersizse temizlik yap
          if (
            error.message?.includes("Invalid") ||
            error.message?.includes("expired") ||
            error.message?.includes("revoked")
          ) {
            console.log("[SessionRecovery] 🚫 Token geçersiz - session siliniyor");
            await clearSessionStorage();
            setGlobalAccessToken(null);
          } else {
            // 🔥 Refresh başarısız AMA mevcut token hala geçerli olabilir
            // auth-ready dispatch et ki app devam etsin
            console.log("[SessionRecovery] 📢 Refresh başarısız ama mevcut token ile devam (auth-ready)...");
            window.dispatchEvent(
              new CustomEvent("auth-ready", {
                detail: {
                  userId: stored.user.id,
                  email: stored.user.email,
                  source: "session-recovery-fallback",
                },
              }),
            );
          }
        } else if (data?.session) {
          console.log("[SessionRecovery] ✅ Session yenilendi!", data.session.user.email);

          // 🔥🔥🔥 EN KRİTİK ADIM: YENİ TOKEN'I GLOBAL'E SET ET!
          setGlobalAccessToken(data.session.access_token);
          console.log("[SessionRecovery] 🔑 Global token SET EDİLDİ (refresh sonrası)!");

          // 🔥 Yeni session'ı kaydet (yeni refresh_token ile)
          await saveSessionToStorage(data.session);

          // 🔥 300ms BEKLE ki Supabase internal state güncellensin
          await new Promise((resolve) => setTimeout(resolve, 300));

          // 🔥 auth-ready eventi dispatch et!
          console.log("[SessionRecovery] 📢 auth-ready eventi dispatch ediliyor...");
          window.dispatchEvent(
            new CustomEvent("auth-ready", {
              detail: {
                userId: data.session.user.id,
                email: data.session.user.email,
                source: "session-recovery",
              },
            }),
          );

          // 🔥 EKSTRA: data-ready eventi de dispatch et - tüm sayfalar verileri yenilesin!
          console.log("[SessionRecovery] 📢 data-ready eventi dispatch ediliyor (veriler yenilenecek)...");
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("data-ready", {
                detail: { source: "session-recovery" },
              }),
            );
          }, 500);

          console.log("[SessionRecovery] ✅ Session tamam, auth-ready + data-ready gönderildi!");
        }
      } catch (e) {
        console.error("[SessionRecovery] ❌ Hata:", e);
      } finally {
        isRecoveringRef.current = false;
      }
    };

    // 1. Visibility change (web-style)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        recoverSession("visibility");
      }
    };

    // 🔥🔥🔥 KRİTİK FIX: "app-resumed" eventini dinle!
    // useAppForegroundState bu eventi dispatch ediyor
    const handleAppResumed = () => {
      console.log("[SessionRecovery] 📡 app-resumed eventi alındı!");
      recoverSession("app-resumed");
    };

    // 3. Custom events (Auth recovery request)
    const handleAuthRecovery = () => {
      recoverSession("auth-recovery-event");
    };

    // 4. Force restore (Bridge health fail)
    const handleForceRestore = () => {
      console.log("[SessionRecovery] 🔥 Force restore tetiklendi!");
      lastRecoveryRef.current = 0; // Cooldown'ı sıfırla
      recoverSession("force-restore");
    };

    // 5. Native session restored (Kotlin'den)
    const handleNativeSessionRestored = async (event: any) => {
      console.log("[SessionRecovery] 🔐 Native session restored eventi:", event.detail);
      // Native taraftan token geldi - session'ı refresh et
      lastRecoveryRef.current = 0; // Cooldown'ı sıfırla
      await recoverSession("native-restored");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    // 🔥 KRİTİK: "app-resumed" dinle (useAppForegroundState bu eventi gönderiyor!)
    window.addEventListener("app-resumed", handleAppResumed);
    window.addEventListener("app-auth-recovery", handleAuthRecovery);
    window.addEventListener("app-force-restore", handleForceRestore);
    window.addEventListener("session-restored-from-native", handleNativeSessionRestored);

    // İlk çalıştırma
    recoverSession("initial");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("app-resumed", handleAppResumed);
      window.removeEventListener("app-auth-recovery", handleAuthRecovery);
      window.removeEventListener("app-force-restore", handleForceRestore);
      window.removeEventListener("session-restored-from-native", handleNativeSessionRestored);
    };
  }, []);
}
