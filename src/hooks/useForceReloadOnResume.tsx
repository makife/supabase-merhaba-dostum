import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { supabase, loadSessionFromStorage, setGlobalAccessToken } from "@/integrations/supabase/client";

/**
 * 🔄 NATIVE ACTIVITY RESTART - Loading Bypass + Session Recovery
 * 
 * MainActivity.java Activity'yi yeniden başlatıyor (yeni WebView).
 * Bu hook:
 * 1. Loading ekranını atlar (sessionStorage flag kontrolü)
 * 2. Session'ı storage'dan yükler
 * 3. Supabase Realtime'ı zorla reconnect eder
 * 4. auth-ready ve data-ready event'lerini dispatch eder
 */

/**
 * App başlangıcında çağrılmalı - resume restart'tan gelip gelmediğini kontrol eder
 * Loading ekranı ATLANIR, session recovery başlatılır
 */
export function checkResumeReload(): boolean {
  // Native taraftan gelen flag'i kontrol et (MainActivity.java inject ediyor)
  const isResumeRestart = sessionStorage.getItem('app-resume-restart') === 'true';
  
  if (isResumeRestart) {
    console.log("[ForceReload] ✅ Native Activity Restart tespit edildi!");
    
    // Flag'i temizle (bir kez kullanılmalı)
    sessionStorage.removeItem('app-resume-restart');
    
    // "Bağlanıyor" toast göster
    toast.loading("Bağlanıyor...", {
      id: "resume-connecting",
      duration: 5000,
    });
    
    // 🔥 SESSION RECOVERY VE REALTIME RECONNECT BAŞLAT
    performResumeRecovery();
    
    return true;
  }
  
  return false;
}

/**
 * 🔥 Resume sonrası session recovery ve realtime reconnect
 * Bu fonksiyon async olarak çalışır ve tüm bağlantıları yeniden kurar
 */
async function performResumeRecovery(): Promise<void> {
  console.log("[ForceReload] 🔄 Resume recovery başlıyor...");
  
  try {
    // 1. Session'ı storage'dan yükle
    console.log("[ForceReload] 📦 Session storage'dan yükleniyor...");
    const storedSession = await loadSessionFromStorage();
    
    if (!storedSession?.access_token || !storedSession?.refresh_token) {
      console.log("[ForceReload] ⚠️ Storage'da session yok - auth sayfasına yönlenilecek");
      toast.dismiss("resume-connecting");
      return;
    }
    
    console.log("[ForceReload] ✅ Session bulundu:", storedSession.user?.email);
    
    // 2. Token'ı global'e set et (kritik!)
    setGlobalAccessToken(storedSession.access_token);
    
    // 3. Supabase'e session'ı set et
    console.log("[ForceReload] 🔑 Supabase'e session set ediliyor...");
    const { error: setError } = await supabase.auth.setSession({
      access_token: storedSession.access_token,
      refresh_token: storedSession.refresh_token,
    });
    
    if (setError) {
      console.error("[ForceReload] ⚠️ setSession hatası:", setError.message);
      // Hata olsa bile devam et, refresh denenecek
    }
    
    // 4. Token refresh yap (yeni token al)
    console.log("[ForceReload] 🔄 Token refresh yapılıyor...");
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: storedSession.refresh_token,
    });
    
    if (error) {
      console.error("[ForceReload] ❌ Token refresh hatası:", error.message);
      toast.dismiss("resume-connecting");
      toast.error("Oturum yenilenemedi");
      return;
    }
    
    if (data?.session) {
      console.log("[ForceReload] ✅ Token yenilendi!");
      
      // Yeni token'ı global'e set et
      setGlobalAccessToken(data.session.access_token);
      
      // 5. Realtime'ı yeni token ile authenticate et
      console.log("[ForceReload] 🔌 Realtime reconnect yapılıyor...");
      supabase.realtime.setAuth(data.session.access_token);
      
      // Realtime'ı zorla reconnect et
      try {
        const state = (supabase.realtime as any).connectionState?.();
        console.log("[ForceReload] 📡 Realtime state:", state);
        
        if (state !== "open") {
          (supabase.realtime as any).connect?.();
        }
      } catch (e) {
        console.log("[ForceReload] ⚠️ Realtime connect hatası:", e);
      }
      
      // 6. auth-ready event dispatch et
      console.log("[ForceReload] 📢 auth-ready event dispatch ediliyor...");
      window.dispatchEvent(
        new CustomEvent("auth-ready", {
          detail: {
            userId: data.session.user.id,
            email: data.session.user.email,
            source: "resume-recovery",
          },
        })
      );
      
      // 7. 500ms bekle, sonra data-ready dispatch et
      setTimeout(() => {
        console.log("[ForceReload] 📢 data-ready event dispatch ediliyor...");
        window.dispatchEvent(
          new CustomEvent("data-ready", {
            detail: { source: "resume-recovery" },
          })
        );
        
        // Toast'u başarı ile değiştir
        toast.dismiss("resume-connecting");
        toast.success("Bağlandı!", { duration: 1500 });
      }, 500);
      
      console.log("[ForceReload] ✅ Resume recovery tamamlandı!");
    }
  } catch (e) {
    console.error("[ForceReload] ❌ Resume recovery hatası:", e);
    toast.dismiss("resume-connecting");
    toast.error("Bağlantı hatası");
  }
}

/**
 * Hook: Native platformda arka plandan dönüşte kullanılır
 * 
 * NOT: Artık JS tarafında reload TETİKLEMİYORUZ!
 * MainActivity.java zaten Activity'yi tamamen yeniden başlatıyor.
 * Bu hook sadece log için kalıyor.
 */
export function useForceReloadOnResume() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    console.log("[ForceReload] 🚀 Native Activity Restart Mode aktif");
    console.log("[ForceReload] 📱 MainActivity.java arka plandan dönüşte Activity'yi yeniden başlatacak");
    
    // JS tarafında hiçbir şey yapmıyoruz - native taraf hallediyor
    // checkResumeReload() main.tsx'de çağrılıyor
    
  }, []);
}

/**
 * Son path'e yönlendirme - artık kullanılmıyor
 * Native taraf zaten aynı URL'e yönlendiriyor
 */
export async function navigateToLastPath(navigate: (path: string) => void): Promise<boolean> {
  return false;
}

/**
 * 🔥 Direct resume recovery - App.tsx'den doğrudan çağrılır
 * Sayfa değişmeden kanalları canlandırır
 */
export async function performResumeRecoveryDirect(): Promise<boolean> {
  console.log("[ForceReload] 🔄 Direct resume recovery başlıyor...");
  
  try {
    // 1. Session'ı storage'dan yükle
    const storedSession = await loadSessionFromStorage();
    
    if (!storedSession?.access_token || !storedSession?.refresh_token) {
      console.log("[ForceReload] ⚠️ Storage'da session yok");
      return false;
    }
    
    // 2. Token'ı global'e set et
    setGlobalAccessToken(storedSession.access_token);
    
    // 3. Supabase'e session'ı set et
    await supabase.auth.setSession({
      access_token: storedSession.access_token,
      refresh_token: storedSession.refresh_token,
    });
    
    // 4. Token refresh yap
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: storedSession.refresh_token,
    });
    
    if (error || !data?.session) {
      console.error("[ForceReload] ❌ Token refresh hatası:", error?.message);
      return false;
    }
    
    // 5. Yeni token'ı global'e set et
    setGlobalAccessToken(data.session.access_token);
    
    // 6. Realtime'ı yeni token ile authenticate et
    supabase.realtime.setAuth(data.session.access_token);
    
    // 7. supabase-reconnected event'i dispatch et (kanallar bu eventi dinliyor)
    window.dispatchEvent(new CustomEvent("supabase-reconnected", {
      detail: { source: "direct-resume-recovery" }
    }));
    
    console.log("[ForceReload] ✅ Direct resume recovery tamamlandı!");
    return true;
    
  } catch (e) {
    console.error("[ForceReload] ❌ Direct resume recovery hatası:", e);
    return false;
  }
}
