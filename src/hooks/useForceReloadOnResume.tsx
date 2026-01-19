import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

/**
 * 🔄 SOFT RELOAD ON RESUME - V2
 * 
 * window.location.href yerine soft reload yaklaşımı:
 * 1. Arka plandan dönüşte "Bağlanıyor..." toast göster
 * 2. Session recovery tetikle (app-auth-recovery event)
 * 3. auth-ready gelince "Bağlandı!" göster
 * 4. data-ready dispatch et - tüm sayfalar verileri yenilesin
 * 
 * Bu yaklaşım WebView'ın donmasını önler.
 */

/**
 * Hook: Native platformda arka plandan dönüşte soft reload tetikler
 */
export function useForceReloadOnResume() {
  const isProcessingRef = useRef(false);
  const wasInBackgroundRef = useRef(false);
  
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    console.log("[ForceReload] 🚀 Soft Reload Hook başlatıldı (V2)");
    
    // 🔥 app-resumed eventini dinle (useAppForegroundState bu eventi gönderiyor)
    const handleAppResumed = () => {
      if (isProcessingRef.current) {
        console.log("[ForceReload] ⏳ Zaten işleniyor, atlanıyor");
        return;
      }
      
      if (!wasInBackgroundRef.current) {
        console.log("[ForceReload] ℹ️ İlk açılış, atlanıyor");
        wasInBackgroundRef.current = true;
        return;
      }
      
      isProcessingRef.current = true;
      console.log("[ForceReload] 🔄 Arka plandan dönüş - soft reload başlatılıyor...");
      
      // "Bağlanıyor" toast göster
      toast.loading("Bağlanıyor...", {
        id: "resume-connecting",
        duration: 5000,
      });
      
      // 🔥 auth-ready eventini bekle
      const handleAuthReady = () => {
        console.log("[ForceReload] ✅ Auth ready - bağlantı kuruldu!");
        toast.dismiss("resume-connecting");
        toast.success("Bağlandı!", { duration: 1500 });
        
        // data-ready dispatch et - tüm sayfalar verileri yenilesin
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("data-ready", { 
            detail: { source: "force-reload-resume" } 
          }));
        }, 300);
        
        isProcessingRef.current = false;
      };
      
      window.addEventListener("auth-ready", handleAuthReady, { once: true });
      
      // 🔥 Session recovery tetikle
      setTimeout(() => {
        console.log("[ForceReload] 🔑 app-auth-recovery eventi gönderiliyor...");
        window.dispatchEvent(new Event("app-auth-recovery"));
      }, 100);
      
      // Fallback: 5 saniye sonra hala auth-ready gelmediyse devam et
      setTimeout(() => {
        if (isProcessingRef.current) {
          console.log("[ForceReload] ⚠️ Auth ready timeout - fallback");
          window.removeEventListener("auth-ready", handleAuthReady);
          toast.dismiss("resume-connecting");
          isProcessingRef.current = false;
          
          // Yine de data-ready gönder
          window.dispatchEvent(new CustomEvent("data-ready", { 
            detail: { source: "force-reload-fallback" } 
          }));
        }
      }, 5000);
    };
    
    // 🔥 Arka plana geçişi takip et
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasInBackgroundRef.current = true;
        console.log("[ForceReload] 🌙 Arka plana geçildi");
      }
    };
    
    window.addEventListener("app-resumed", handleAppResumed);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      window.removeEventListener("app-resumed", handleAppResumed);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}

/**
 * App başlangıcında çağrılabilir - artık gerekli değil
 * Geriye uyumluluk için boş fonksiyon
 */
export async function checkResumeReload(): Promise<boolean> {
  return false;
}

/**
 * Son path'e yönlendirme - artık gerekli değil
 * Geriye uyumluluk için boş fonksiyon
 */
export async function navigateToLastPath(navigate: (path: string) => void): Promise<boolean> {
  return false;
}
