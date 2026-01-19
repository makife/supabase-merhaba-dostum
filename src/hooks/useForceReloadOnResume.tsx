import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { isCameraActive, loadCameraActiveState } from "@/utils/cameraState";

/**
 * 🔄 FORCE RELOAD ON RESUME
 * 
 * Uygulama arka plandan döndüğünde TAMAMEN yeniden başlatır.
 * Ama LoadingScreen'i göstermez - son sayfada kalır.
 * 
 * ⚠️ KAMERA/GALERİ AKTİFKEN RELOAD YAPILMAZ!
 */

const RESUME_RELOAD_FLAG = "app-resume-reload";
const LAST_PATH_KEY = "app-last-path";

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

/**
 * App başlangıcında çağrılmalı - resume reload olup olmadığını kontrol eder
 * Ayrıca kamera state'ini de yükler
 */
export async function checkResumeReload(): Promise<boolean> {
  // Önce kamera state'ini yükle (native storage'dan)
  const wasCameraActive = await loadCameraActiveState();
  
  if (wasCameraActive) {
    console.log("[ForceReload] 📷 Kamera aktifti - reload bypass edilecek");
  }
  
  const isResumeReload = await getAndClearResumeFlag();
  if (isResumeReload) {
    console.log("[ForceReload] ✅ Resume reload tespit edildi - loading atlanacak");
    sessionStorage.setItem("app-loaded", "true");
  }
  return isResumeReload;
}

/**
 * Hook: Native platformda arka plandan dönüşte reload tetikler
 * NOT: Kamera/Galeri aktifken reload YAPILMAZ!
 */
export function useForceReloadOnResume() {
  const isReloadingRef = useRef(false);
  
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    console.log("[ForceReload] 🚀 Hook başlatıldı");
    
    const handleAppStateChange = async (state: { isActive: boolean }) => {
      // Ön plana dönüş
      if (state.isActive && !isReloadingRef.current) {
        // 🛡️ KAMERA AKTİFSE RELOAD YAPMA!
        if (isCameraActive()) {
          console.log("[ForceReload] 📷 Kamera aktif - reload atlanıyor");
          return;
        }
        
        console.log("[ForceReload] 📱 Ön plana dönüldü - reload tetikleniyor...");
        
        isReloadingRef.current = true;
        
        const currentPath = window.location.pathname + window.location.search;
        await setLastPath(currentPath);
        await setResumeFlag();
        
        console.log("[ForceReload] 🔄 Sayfa yeniden yükleniyor:", currentPath);
        
        window.location.reload();
      }
      // Arka plana gidiş
      else if (!state.isActive) {
        const currentPath = window.location.pathname + window.location.search;
        await setLastPath(currentPath);
        console.log("[ForceReload] 💤 Arka plana gidiliyor, path kaydedildi:", currentPath);
      }
    };
    
    const listenerPromise = App.addListener("appStateChange", handleAppStateChange);
    
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
    console.log("[ForceReload] 🎯 Son path'e yönlendiriliyor:", lastPath);
    navigate(lastPath);
    return true;
  }
  return false;
}
