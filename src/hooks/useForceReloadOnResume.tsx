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
 * 
 * @deprecated App.tsx artık doğrudan performResumeRecoveryDirect kullanıyor
 */
export function checkResumeReload(): boolean {
  // Native taraftan gelen flag'i kontrol et (MainActivity.java inject ediyor)
  const isResumeRestart = sessionStorage.getItem('app-resume-restart') === 'true';
  
  if (isResumeRestart) {
    console.log("[ForceReload] ✅ Native Activity Restart tespit edildi!");
    
    // Flag'i temizle (bir kez kullanılmalı)
    sessionStorage.removeItem('app-resume-restart');
    
    // 🔥 SESSION RECOVERY VE REALTIME RECONNECT BAŞLAT
    performResumeRecovery();
    
    return true;
  }
  
  return false;
}

/**
 * 🔥🔥🔥 DOĞRUDAN ÇAĞRILACAK SESSION RECOVERY
 * App.tsx bu fonksiyonu direkt çağırır - flag kontrolü DIŞARIDA yapılır
 * 
 * @returns Promise<boolean> - başarılı olup olmadığını döner
 */
export async function performResumeRecoveryDirect(): Promise<boolean> {
  console.log("[ForceReload] 🔄🔄🔄 RESUME RECOVERY BAŞLIYOR 🔄🔄🔄");
  
  try {
    // 1. Session'ı storage'dan yükle
    console.log("[ForceReload] 📦 Session storage'dan yükleniyor...");
    const storedSession = await loadSessionFromStorage();
    
    if (!storedSession?.access_token || !storedSession?.refresh_token) {
      console.log("[ForceReload] ⚠️ Storage'da session yok - auth sayfasına yönlenilecek");
      return false;
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
      return false;
    }
    
    if (data?.session) {
      console.log("[ForceReload] ✅ Token yenilendi!");
      
      // Yeni token'ı global'e set et
      setGlobalAccessToken(data.session.access_token);
      
      // 5. 🔥🔥🔥 REALTIME RECONNECT - EN KRİTİK KISIM
      console.log("[ForceReload] 🔌🔌🔌 REALTIME RECONNECT BAŞLIYOR...");
      
      // Önce mevcut bağlantıyı kontrol et
      try {
        const realtimeState = (supabase.realtime as any).connectionState?.();
        console.log("[ForceReload] 📡 Mevcut Realtime state:", realtimeState);
      } catch (e) {
        console.log("[ForceReload] ⚠️ Realtime state okunamadı");
      }
      
      // Token'ı realtime'a set et
      supabase.realtime.setAuth(data.session.access_token);
      console.log("[ForceReload] ✅ Realtime auth token set edildi");
      
      // 🔥 Realtime'ı zorla reconnect et
      try {
        // Önce mevcut bağlantıyı kapat
        console.log("[ForceReload] 🔌 Mevcut bağlantı kapatılıyor...");
        (supabase.realtime as any).disconnect?.();
        
        // 500ms bekle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Yeniden bağlan
        console.log("[ForceReload] 🔌 Yeniden bağlanılıyor...");
        (supabase.realtime as any).connect?.();
        
        console.log("[ForceReload] ✅ Realtime reconnect komutu gönderildi");
      } catch (e) {
        console.log("[ForceReload] ⚠️ Realtime reconnect hatası:", e);
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
      
      // 7. supabase-reconnected event dispatch et (kanalların yeniden kurulması için)
      console.log("[ForceReload] 📢 supabase-reconnected event dispatch ediliyor...");
      window.dispatchEvent(new CustomEvent("supabase-reconnected"));
      
      // 8. 1 saniye bekle, sonra data-ready dispatch et
      setTimeout(() => {
        console.log("[ForceReload] 📢 data-ready event dispatch ediliyor...");
        window.dispatchEvent(
          new CustomEvent("data-ready", {
            detail: { source: "resume-recovery" },
          })
        );
      }, 1000);
      
      console.log("[ForceReload] ✅✅✅ RESUME RECOVERY TAMAMLANDI! ✅✅✅");
      return true;
    }
    
    return false;
  } catch (e) {
    console.error("[ForceReload] ❌ Resume recovery hatası:", e);
    return false;
  }
}

/**
 * 🔥 Eski performResumeRecovery - toast yönetimi dahil
 * @deprecated Artık App.tsx performResumeRecoveryDirect kullanıyor
 */
async function performResumeRecovery(): Promise<void> {
  // Toast göster
  toast.loading("Bağlanıyor...", {
    id: "resume-connecting",
    duration: 15000,
  });
  
  const success = await performResumeRecoveryDirect();
  
  if (success) {
    toast.dismiss("resume-connecting");
    toast.success("Bağlandı!", { duration: 1500 });
  } else {
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
    // performResumeRecoveryDirect App.tsx'de çağrılıyor
    
  }, []);
}

/**
 * Son path'e yönlendirme - artık kullanılmıyor
 * Native taraf zaten aynı URL'e yönlendiriyor
 */
export async function navigateToLastPath(navigate: (path: string) => void): Promise<boolean> {
  return false;
}
