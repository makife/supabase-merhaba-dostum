import { useEffect, useRef } from "react";
import { supabase, loadSessionFromStorage, saveSessionToStorage, setGlobalAccessToken } from "@/integrations/supabase/client";
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
      
      // Rate limit: 5 saniyede bir (önceden 10 sn idi - daha hızlı recovery için azalttık)
      if (now - lastRecoveryRef.current < 5000 || isRecoveringRef.current) {
        console.log(`[SessionRecovery] ⏳ Atlandı (${source}) - cooldown veya işlem devam ediyor`);
        return;
      }
      
      isRecoveringRef.current = true;
      lastRecoveryRef.current = now;

      try {
        console.log(`[SessionRecovery] 🔄 Başlıyor... (${source})`);

        // 1. Supabase'den mevcut session'ı kontrol et
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (currentSession?.access_token && currentSession?.user) {
          console.log("[SessionRecovery] ✅ Session zaten aktif:", currentSession.user.email);
          
          // 🔥🔥🔥 KRİTİK: GLOBAL TOKEN'I SET ET!
          // Native'de her istek bu token'ı kullanır
          setGlobalAccessToken(currentSession.access_token);
          console.log("[SessionRecovery] 🔐 Global token SET EDİLDİ!");
          
          // 🔥 BASİT YAKLAŞIM: Session hazır, artık verileri yükleyebilirler
          // "app-resumed" eventi zaten useAppForegroundState'ten gelecek
          // Burada sadece session-recovered için log tutalım
          console.log("[SessionRecovery] 📡 Session aktif - hook'lar bilgilendirildi");
          
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
        console.log("[SessionRecovery] 🔄 Token refresh yapılıyor...");
        
        // 🔥🔥🔥 KRİTİK: refresh_token PARAMETRESİYLE çağır!
        // Native'de persistSession: false olduğu için Supabase kendi storage'ından
        // refresh_token bulamaz. BİZ vermemiz LAZIM!
        const { data, error } = await supabase.auth.refreshSession({
          refresh_token: stored.refresh_token,
        });

        if (error) {
          console.log("[SessionRecovery] ⚠️ Refresh hatası:", error.message);
          
          // Token tamamen geçersizse temizlik yap
          if (error.message?.includes('Invalid') || 
              error.message?.includes('expired') || 
              error.message?.includes('revoked')) {
            console.log("[SessionRecovery] 🚫 Token geçersiz - session siliniyor");
            // Session'ı SİLMİYORUZ - kullanıcı bir süre daha bekleyebilir
            // Sadece log tutuyoruz
          } else {
            // 🔥🔥🔥 REFRESH BAŞARISIZ AMA TOKEN HALA GEÇERLİ OLABİLİR
            // Storage'daki session'ı Supabase client'a ZORLA set et!
            console.log("[SessionRecovery] 🔧 Refresh başarısız - storage session'ı zorla set ediliyor...");
            try {
              const { error: setError } = await supabase.auth.setSession({
                access_token: stored.access_token,
                refresh_token: stored.refresh_token,
              });
              
              if (!setError) {
                console.log("[SessionRecovery] ✅ Storage session zorla set edildi!");
                // 🔥 Session hazır - app-resumed zaten tetiklenecek
              }
            } catch (setErr) {
              console.error("[SessionRecovery] ❌ setSession hatası:", setErr);
            }
          }
        } else if (data?.session) {
          console.log("[SessionRecovery] ✅ Session yenilendi!", data.session.user.email);
          
          // 🔥🔥🔥 EN KRİTİK ADIM: GLOBAL TOKEN'I SET ET!
          setGlobalAccessToken(data.session.access_token);
          console.log("[SessionRecovery] 🔐 Global token SET EDİLDİ (refresh sonrası)!");
          
          // 🔥🔥🔥 KRİTİK: Supabase client'a session'ı EXPLICIT olarak bildir!
          // Native'de persistSession: false olduğu için refreshSession tek başına yetmez!
          try {
            const { error: setError } = await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
            
            if (setError) {
              console.error("[SessionRecovery] ⚠️ setSession hatası:", setError.message);
            } else {
              console.log("[SessionRecovery] ✅ Supabase client session SET EDİLDİ!");
            }
          } catch (setErr) {
            console.error("[SessionRecovery] ❌ setSession exception:", setErr);
          }
          
          // 🔥 Yeni session'ı kaydet (yeni refresh_token ile)
          await saveSessionToStorage(data.session);
          
          // 🔥 Session hazır - app-resumed eventi useAppForegroundState'ten gelecek
          console.log("[SessionRecovery] ✅ Session tamam, veri yenileme başlayacak...");
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

    // 2. App foreground event (App.tsx'ten)
    const handleForeground = () => {
      recoverSession("appForeground");
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
    window.addEventListener("appForeground", handleForeground);
    window.addEventListener("app-auth-recovery", handleAuthRecovery);
    window.addEventListener("app-force-restore", handleForceRestore);
    window.addEventListener("session-restored-from-native", handleNativeSessionRestored);

    // İlk çalıştırma
    recoverSession("initial");

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("appForeground", handleForeground);
      window.removeEventListener("app-auth-recovery", handleAuthRecovery);
      window.removeEventListener("app-force-restore", handleForceRestore);
      window.removeEventListener("session-restored-from-native", handleNativeSessionRestored);
    };
  }, []);
}
