import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { toast } from "sonner";

/**
 * 🔄 COLD START RELOAD ON RESUME
 * 
 * İlk açılış davranışını simüle eder:
 * 1. Arka plana giderken path kaydet
 * 2. Ön plana gelince window.location.href = origin + path
 * 3. Bu TAM bir cold start - tüm JS sıfırdan yüklenir
 */

const LAST_PATH_KEY = "app-last-path";
const RESUME_FLAG_KEY = "app-resume-reload";

async function getLastPath(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: LAST_PATH_KEY });
    return value;
  } catch {
    return sessionStorage.getItem(LAST_PATH_KEY);
  }
}

async function setLastPath(path: string): Promise<void> {
  try {
    await Preferences.set({ key: LAST_PATH_KEY, value: path });
  } catch {
    sessionStorage.setItem(LAST_PATH_KEY, path);
  }
}

async function setResumeFlag(): Promise<void> {
  try {
    await Preferences.set({ key: RESUME_FLAG_KEY, value: "true" });
  } catch {
    sessionStorage.setItem(RESUME_FLAG_KEY, "true");
  }
  
  // 🔥 KRİTİK: app-loaded SET ET - loading ekranı ATLANSIN
  sessionStorage.setItem("app-loaded", "true");
}

async function getAndClearResumeFlag(): Promise<boolean> {
  try {
    const { value } = await Preferences.get({ key: RESUME_FLAG_KEY });
    if (value === "true") {
      await Preferences.remove({ key: RESUME_FLAG_KEY });
      return true;
    }
    return false;
  } catch {
    const value = sessionStorage.getItem(RESUME_FLAG_KEY);
    if (value === "true") {
      sessionStorage.removeItem(RESUME_FLAG_KEY);
      return true;
    }
    return false;
  }
}

/**
 * App başlangıcında çağrılmalı - resume reload'dan gelip gelmediğini kontrol eder
 * Loading ekranı ATLANIR, sadece "Bağlanıyor" toast gösterilir
 */
export async function checkResumeReload(): Promise<boolean> {
  const isResumeReload = await getAndClearResumeFlag();
  if (isResumeReload) {
    console.log("[ForceReload] ✅ Resume reload - loading atlanıyor, toast gösteriliyor");
    
    // Loading ekranı zaten atlanacak (app-loaded set edildi)
    // Sadece "Bağlanıyor" toast göster
    toast.loading("Bağlanıyor...", {
      id: "resume-connecting",
      duration: 2500,
    });
    
    setTimeout(() => {
      toast.dismiss("resume-connecting");
    }, 2500);
  }
  return isResumeReload;
}

/**
 * Hook: Native platformda arka plandan dönüşte COLD START reload tetikler
 * 
 * YAKLAŞIM: window.location.href = origin + path
 * Bu TAM bir cold start - ilk açılış ile aynı davranış
 */
export function useForceReloadOnResume() {
  const isReloadingRef = useRef(false);
  const wasInBackgroundRef = useRef(false);
  
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    console.log("[ForceReload] 🚀 Cold Start Reload Hook başlatıldı");
    
    const handleStateChange = async (state: { isActive: boolean }) => {
      // Arka plana gidiş
      if (!state.isActive) {
        console.log("[ForceReload] 📴 Arka plana gidiliyor, path kaydediliyor...");
        wasInBackgroundRef.current = true;
        const currentPath = window.location.pathname + window.location.search;
        await setLastPath(currentPath);
        return;
      }
      
      // Ön plana dönüş
      if (state.isActive && wasInBackgroundRef.current) {
        if (isReloadingRef.current) {
          console.log("[ForceReload] ⏳ Zaten reload yapılıyor, atlanıyor");
          return;
        }
        
        isReloadingRef.current = true;
        wasInBackgroundRef.current = false;
        
        const lastPath = await getLastPath();
        const targetPath = lastPath || "/";
        
        // Clean path (cache-busting parametrelerini temizle)
        const cleanPath = targetPath.replace(/[?&]_t=\d+/, "").replace(/[?&]$/, "") || "/";
        
        await setResumeFlag();
        
        console.log("[ForceReload] ⏳ 500ms bekleniyor (WebView uyanması için)...");
        
        // 500ms bekle - WebView'in uyanmasını garanti et
        setTimeout(() => {
          console.log("[ForceReload] 🔄 COLD START yapılıyor:", cleanPath);
          
          // 🔥 COLD START: İlk açılış ile aynı davranış
          // window.location.href = origin + path → TAM sayfa yüklemesi
          window.location.href = window.location.origin + cleanPath;
        }, 500);
      }
    };
    
    const listener = App.addListener("appStateChange", handleStateChange);
    
    return () => {
      listener.then(l => l.remove());
    };
  }, []);
}

/**
 * Son path'e yönlendirme (App.tsx'de kullanılır)
 */
export async function navigateToLastPath(navigate: (path: string) => void): Promise<boolean> {
  const lastPath = await getLastPath();
  if (lastPath && lastPath !== "/" && lastPath !== window.location.pathname) {
    const cleanPath = lastPath.replace(/[?&]_t=\d+/, "").replace(/[?&]$/, "");
    console.log("[ForceReload] 🎯 Son path'e yönlendiriliyor:", cleanPath);
    navigate(cleanPath || lastPath);
    return true;
  }
  return false;
}
