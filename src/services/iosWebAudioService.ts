/**
 * iOS Web Audio Service (adı geriye dönük uyumluluk için korundu)
 *
 * NOT: Önceden Web Audio API (AudioContext) kullanıyordu ama WKWebView'de
 * WebAudio kendi "Ambient" ses oturumunu kullandığı için telefon sessiz
 * moddayken veya oturum aktive olmadığında sesler duyulmuyordu.
 *
 * Şimdi HTML5 Audio (havuzlu) kullanıyoruz. AppDelegate.swift
 * AVAudioSession'ı `.playback + .mixWithOthers` olarak ayarladığı için:
 *   - Sessiz moddayken bile efektler duyulur (playback kategorisi)
 *   - Arka plan müziği kesilmez (mixWithOthers)
 *   - NativeAudio ile AVAudioSession çakışması yaşanmaz
 *
 * API aynı: initIOSWebAudio / playIOSWebSound / stopAllIOSWebSounds.
 */

import { Capacitor } from "@capacitor/core";

const isIOSNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

// assetId -> HTMLAudioElement havuzu
const pools = new Map<string, HTMLAudioElement[]>();
// assetId -> url (fallback / lazy load için)
const urls = new Map<string, string>();
// assetId -> temel volume
const volumes = new Map<string, number>();

const activeAudios = new Set<HTMLAudioElement>();

const POOL_SIZE = 3;

export const isIOSWebAudioTarget = (): boolean => isIOSNative;

const toUrl = (assetPath: string): string =>
  assetPath.replace(/^public\//, "/");

const createPool = (url: string, volume: number): HTMLAudioElement[] => {
  const pool: HTMLAudioElement[] = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    try {
      const a = new Audio(url);
      a.preload = "auto";
      a.volume = Math.max(0, Math.min(1, volume));
      // iOS WKWebView: inline oynat, tam ekran video moduna geçme
      a.setAttribute("playsinline", "true");
      // preload'u tetikle
      try {
        a.load();
      } catch {
        /* ignore */
      }
      pool.push(a);
    } catch (e) {
      console.warn("[iOSAudio] Audio element oluşturulamadı:", e);
    }
  }
  return pool;
};

const getAvailable = (pool: HTMLAudioElement[]): HTMLAudioElement | null => {
  for (const a of pool) {
    if (a.paused || a.ended) return a;
  }
  return pool[0] || null;
};

// İlk kullanıcı etkileşiminde tüm havuzu "unlock" et.
// iOS HTMLAudioElement.play() kullanıcı gestür'ü içinde çağrılırsa,
// aynı elementin sonraki play() çağrıları gestür dışında da çalışır.
let unlocked = false;
let unlockBound = false;

const unlockAll = () => {
  if (unlocked) return;
  unlocked = true;
  pools.forEach((pool) => {
    pool.forEach((a) => {
      try {
        const originalVolume = a.volume;
        a.muted = true;
        const p = a.play();
        if (p && typeof p.then === "function") {
          p.then(() => {
            try {
              a.pause();
              a.currentTime = 0;
              a.muted = false;
              a.volume = originalVolume;
            } catch {
              /* ignore */
            }
          }).catch(() => {
            a.muted = false;
            a.volume = originalVolume;
          });
        }
      } catch {
        /* ignore */
      }
    });
  });
  console.log("🔓 [iOSAudio] Havuz unlock edildi");
};

const bindUnlockOnce = () => {
  if (unlockBound || !isIOSNative) return;
  unlockBound = true;
  const handler = () => {
    unlockAll();
  };
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  window.addEventListener("touchstart", handler, opts);
  window.addEventListener("touchend", handler, opts);
  window.addEventListener("pointerdown", handler, opts);
  window.addEventListener("click", handler, opts);
  window.addEventListener("keydown", handler, opts);
};

if (isIOSNative && typeof window !== "undefined") {
  bindUnlockOnce();
}

export const initIOSWebAudio = async (
  sounds: { assetId: string; assetPath: string; volume?: number }[]
): Promise<void> => {
  if (!isIOSNative) return;
  bindUnlockOnce();

  sounds.forEach((s) => {
    if (pools.has(s.assetId)) return;
    const url = toUrl(s.assetPath);
    const vol = s.volume ?? 0.7;
    urls.set(s.assetId, url);
    volumes.set(s.assetId, vol);
    pools.set(s.assetId, createPool(url, vol));
  });

  console.log(
    `🔊 [iOSAudio] ${pools.size}/${sounds.length} ses havuzu hazır ✅`
  );
};

export const playIOSWebSound = async (
  assetId: string,
  volume = 0.7,
  fallbackUrl?: string
): Promise<boolean> => {
  if (!isIOSNative) return false;

  let pool = pools.get(assetId);
  if (!pool || pool.length === 0) {
    const url = fallbackUrl || urls.get(assetId);
    if (!url) return false;
    pool = createPool(url, volume);
    pools.set(assetId, pool);
    urls.set(assetId, url);
    volumes.set(assetId, volume);
  }

  const audio = getAvailable(pool);
  if (!audio) return false;

  try {
    audio.volume = Math.max(0, Math.min(1, volume));
    // Sesi baştan başlat
    try {
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
    activeAudios.add(audio);
    const cleanup = () => {
      activeAudios.delete(audio);
      audio.removeEventListener("ended", cleanup);
      audio.removeEventListener("error", cleanup);
    };
    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", cleanup);

    const p = audio.play();
    if (p && typeof p.then === "function") {
      await p.catch((e) => {
        console.warn(`[iOSAudio] ${assetId} play hatası:`, e);
        cleanup();
        // Play başarısız olduysa unlock ihtimalini yeniden tetikle
        unlocked = false;
        return null;
      });
    }
    return true;
  } catch (e) {
    console.warn(`[iOSAudio] ${assetId} play exception:`, e);
    return false;
  }
};

export const stopAllIOSWebSounds = (): void => {
  if (!isIOSNative) return;
  activeAudios.forEach((a) => {
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
  });
  activeAudios.clear();
};
