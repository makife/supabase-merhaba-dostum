import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { toast } from "sonner";

/**
 * 🔄 AGGRESSIVE FORCE RELOAD ON RESUME
 * 
 * Basit mantık:
 * 1. Arka plana giderken path kaydet  
 * 2. Ön plana gelince 500ms bekle (WebView uyanması için)
 * 3. Cache-busting ile tam sayfa yenileme (replace + timestamp)
 * 4. Reload sonrası "Bağlanıyor" toast göster
 */

const LAST_PATH_KEY = "app-last-path";
const RESUME_RELOAD_FLAG = "app-resume-reload";

async function setLastPath(path: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: LAST_PATH_KEY, value: path });
  } else {
    sessionStorage.setItem(LAST_PATH_KEY, path);
  }
}

export async function getLastPath(): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: LAST_PATH_KEY });
    return value;
  } else {
    return sessionStorage.getItem(LAST_PATH_KEY);
  }
}

async function setResumeFlag(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: RESUME_RELOAD_FLAG, value: "true" });
  } else {
    sessionStorage.setItem(RESUME_RELOAD_FLAG, "true");
  }
}

async function getAndClearResumeFlag(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key: RESUME_RELOAD_FLAG });
    if (value === "true") {
      await Preferences.remove({ key: RESUME_RELOAD_FLAG });
      return true;
    }
    return false;
  } else {
    const flag = sessionStorage.getItem(RESUME_RELOAD_FLAG);
    if (flag === "true") {
      sessionStorage.removeItem(RESUME_RELOAD_FLAG);
      return true;
    }
    return false;
  }
}

/**
 * App başlangıcında çağrılmalı - resume reload olup olmadığını kontrol eder
 * ve "Bağlanıyor" toast gösterir
 */
export async function checkResumeReload(): Promise<boolean> {
  const isResumeReload = await getAndClearResumeFlag();
  if (isResumeReload) {
    console.log("[ForceReload] ✅ Resume reload tespit edildi - loading atlanacak");
    sessionStorage.setItem("app-loaded", "true");
    
    // "Bağlanıyor" toast göster ve 2 saniye sonra kapat
    const toastId = toast.loading("Bağlanıyor...", {
      duration: 3000,
    });
    
    setTimeout(() => {
      toast.dismiss(toastId);
    }, 2000);
  }
  return isResumeReload;
}

/**
 * Hook: Native platformda arka plandan dönüşte agresif reload tetikler
 * 
 * YAKLAŞIM: 
 * - appStateChange + 500ms gecikme (daha uzun bekleme)
 * - window.location.replace() + cache-busting timestamp
 * - WebView'in tamamen uyanmasını garanti eder
 */
export function useForceReloadOnResume() {
  const isReloadingRef = useRef(false);
  const wasInBackgroundRef = useRef(false);
  
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    console.log("[ForceReload] 🚀 Hook başlatıldı (agresif mod)");
    
    const handleStateChange = async (state: { isActive: boolean }) => {
      // Arka plana gidiş
      if (!state.isActive) {
        wasInBackgroundRef.current = true;
        const currentPath = window.location.pathname + window.location.search;
        await setLastPath(currentPath);
        console.log("[ForceReload] 💤 Arka plana gidiliyor, path kaydedildi:", currentPath);
        return;
      }
      
      // Ön plana dönüş
      if (state.isActive && wasInBackgroundRef.current && !isReloadingRef.current) {
        console.log("[ForceReload] 📱 Ön plana dönüldü...");
        
        isReloadingRef.current = true;
        wasInBackgroundRef.current = false;
        
        // Path'i kaydet
        const currentPath = window.location.pathname + window.location.search;
        await setLastPath(currentPath);
        await setResumeFlag();
        
        console.log("[ForceReload] ⏳ 500ms bekleniyor (WebView tam uyanması için)...");
        
        // 🔥 KRİTİK: 500ms bekle - WebView'in tamamen uyanmasını garanti et
        setTimeout(() => {
          console.log("[ForceReload] 🔄 AGRESİF sayfa yenileme başlatılıyor:", currentPath);
          
          // Cache-busting URL oluştur
          const separator = currentPath.includes('?') ? '&' : '?';
          const cacheBustUrl = `${currentPath}${separator}_t=${Date.now()}`;
          
          // window.location.replace kullan - daha agresif, history'yi değiştirir
          window.location.replace(cacheBustUrl);
        }, 500);
      }
    };
    
    const listenerPromise = App.addListener("appStateChange", handleStateChange);
    
    return () => {
      listenerPromise.then(listener => listener.remove());
    };
  }, []);
}

/**
 * Son path'e yönlendirme için kullanılacak
 */
export async function navigateToLastPath(navigate: (path: string) => void): Promise<boolean> {
  const lastPath = await getLastPath();
  if (lastPath && lastPath !== "/" && lastPath !== window.location.pathname) {
    // Cache-busting parametresini temizle
    const cleanPath = lastPath.replace(/[?&]_t=\d+/, '').replace(/[?&]$/, '');
    console.log("[ForceReload] 🎯 Son path'e yönlendiriliyor:", cleanPath);
    navigate(cleanPath || lastPath);
    return true;
  }
  return false;
}
