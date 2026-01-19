import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";

/**
 * 🔄 SIMPLE FORCE RELOAD ON RESUME
 * 
 * Basit mantık:
 * 1. Arka plana giderken path kaydet  
 * 2. Ön plana gelince 300ms bekle (WebView uyanması için)
 * 3. window.location.reload() ile sayfayı yenile
 * 4. Reload sonrası app sıfırdan başlıyor = tüm Supabase kanalları yeniden kurulur
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
 */
export async function checkResumeReload(): Promise<boolean> {
  const isResumeReload = await getAndClearResumeFlag();
  if (isResumeReload) {
    console.log("[ForceReload] ✅ Resume reload tespit edildi - loading atlanacak");
    sessionStorage.setItem("app-loaded", "true");
  }
  return isResumeReload;
}

/**
 * Hook: Native platformda arka plandan dönüşte reload tetikler
 * 
 * YAKLAŞIM: appStateChange + 300ms gecikme
 * - appStateChange geldiğinde JS henüz tam uyanmamış olabilir
 * - 300ms bekleyerek WebView'in hazır olmasını garantiliyoruz
 * - Reload sonrası app sıfırdan başlıyor = tüm kanallar yeniden kurulur
 */
export function useForceReloadOnResume() {
  const isReloadingRef = useRef(false);
  const wasInBackgroundRef = useRef(false);
  
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    console.log("[ForceReload] 🚀 Hook başlatıldı");
    
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
        
        console.log("[ForceReload] ⏳ 300ms bekleniyor (WebView uyanması için)...");
        
        // 🔥 KRİTİK: 300ms bekle - WebView'in tamamen uyanmasını garanti et
        setTimeout(() => {
          console.log("[ForceReload] 🔄 Sayfa yeniden yükleniyor:", currentPath);
          window.location.reload();
        }, 300);
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
    console.log("[ForceReload] 🎯 Son path'e yönlendiriliyor:", lastPath);
    navigate(lastPath);
    return true;
  }
  return false;
}
