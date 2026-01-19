import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

/**
 * 🔄 NATIVE ACTIVITY RESTART - Loading Bypass
 * 
 * MainActivity.java zaten Activity'yi yeniden başlatıyor (yeni WebView).
 * Bu hook SADECE loading ekranını atlamak için sessionStorage kontrolü yapar.
 * 
 * Native taraf sessionStorage'a 'app-resume-restart' ve 'app-loaded' set ediyor.
 * Bu sayede ergan.jpg loading ekranı gösterilmiyor.
 */

/**
 * App başlangıcında çağrılmalı - resume restart'tan gelip gelmediğini kontrol eder
 * Loading ekranı ATLANIR, sadece "Bağlanıyor" toast gösterilir
 */
export function checkResumeReload(): boolean {
  // Native taraftan gelen flag'i kontrol et (MainActivity.java inject ediyor)
  const isResumeRestart = sessionStorage.getItem('app-resume-restart') === 'true';
  
  if (isResumeRestart) {
    console.log("[ForceReload] ✅ Native Activity Restart - loading atlanıyor");
    
    // Flag'i temizle (bir kez kullanılmalı)
    sessionStorage.removeItem('app-resume-restart');
    
    // Sadece "Bağlanıyor" toast göster
    toast.loading("Bağlanıyor...", {
      id: "resume-connecting",
      duration: 2500,
    });
    
    setTimeout(() => {
      toast.dismiss("resume-connecting");
    }, 2500);
    
    return true;
  }
  
  return false;
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
    
  }, []);
}

/**
 * Son path'e yönlendirme - artık kullanılmıyor
 * Native taraf zaten aynı URL'e yönlendiriyor
 */
export async function navigateToLastPath(navigate: (path: string) => void): Promise<boolean> {
  return false;
}
