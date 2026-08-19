/**
 * iOS Web Audio Service (adı geriye dönük uyumluluk için korundu)
 *
 * NOT: WKWebView eş zamanlı çok sayıda <audio> element'ini kaldıramadığı için
 * pool'lar artık LAZY oluşturuluyor — init sadece meta (url, volume) kaydeder,
 * ilk `playIOSWebSound` çağrısında ilgili sesin havuzu yaratılır.
 *
 * AppDelegate.swift AVAudioSession'ı `.playback + .mixWithOthers` yaptığı için
 * HTML5 Audio sessiz modda bile çalar ve arka plan müziğini kesmez.
 */

import { Capacitor } from "@capacitor/core";

const isIOSNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

interface SoundMeta {
  url: string;
  volume: number;
  poolSize: number;
}

const meta = new Map<string, SoundMeta>();
const pools = new Map<string, HTMLAudioElement[]>();
const activeAudios = new Set<HTMLAudioElement>();

// Sadece sık/overlap gereken kısa sesler için >1
const MULTI_CHANNEL_IDS = new Set<string>([
  "button_click",
  "letter_select",
  "cark_tick",
  "beep",
  "final_countdown_click",
  "son_on_saniye",
  "correct_word",
  "wrong_word",
  "boost_arti_ses",
]);

const DEFAULT_POOL = 1;
const MULTI_POOL = 3;

export const isIOSWebAudioTarget = (): boolean => isIOSNative;

const toUrl = (assetPath: string): string =>
  assetPath.replace(/^public\//, "/");

const createAudio = (url: string, volume: number): HTMLAudioElement => {
  const a = new Audio(url);
  a.preload = "auto";
  a.volume = Math.max(0, Math.min(1, volume));
  a.setAttribute("playsinline", "true");
  try {
    a.load();
  } catch {
    /* ignore */
  }
  return a;
};

const ensurePool = (assetId: string): HTMLAudioElement[] | null => {
  let pool = pools.get(assetId);
  if (pool && pool.length > 0) return pool;
  const m = meta.get(assetId);
  if (!m) return null;
  pool = [];
  for (let i = 0; i < m.poolSize; i++) {
    try {
      pool.push(createAudio(m.url, m.volume));
    } catch (e) {
      console.warn(`[iOSAudio] ${assetId} audio create failed:`, e);
    }
  }
  pools.set(assetId, pool);
  return pool;
};

const getAvailable = (pool: HTMLAudioElement[]): HTMLAudioElement | null => {
  for (const a of pool) {
    if (a.paused || a.ended) return a;
  }
  return pool[0] || null;
};

// Global unlock: ilk gesture'da AudioContext benzeri şekilde bir "primer" audio çal.
let unlocked = false;
let unlockBound = false;

const primeSilentPlayback = () => {
  // Boş data URI ile küçük bir wav çal — sadece output stream'i açar
  try {
    const silent = new Audio(
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
    );
    silent.volume = 0;
    silent.setAttribute("playsinline", "true");
    const p = silent.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {
        /* ignore */
      });
    }
  } catch {
    /* ignore */
  }
};

const unlockAll = () => {
  if (unlocked) return;
  unlocked = true;
  primeSilentPlayback();
  console.log("🔓 [iOSAudio] Audio output primed");
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
    if (meta.has(s.assetId)) return;
    meta.set(s.assetId, {
      url: toUrl(s.assetPath),
      volume: s.volume ?? 0.7,
      poolSize: MULTI_CHANNEL_IDS.has(s.assetId) ? MULTI_POOL : DEFAULT_POOL,
    });
  });

  console.log(`🔊 [iOSAudio] ${meta.size} ses meta kaydedildi (lazy) ✅`);
};

export const playIOSWebSound = async (
  assetId: string,
  volume = 0.7,
  fallbackUrl?: string,
  playbackRate?: number
): Promise<boolean> => {
  if (!isIOSNative) return false;

  if (!meta.has(assetId)) {
    const url = fallbackUrl;
    if (!url) return false;
    meta.set(assetId, {
      url,
      volume,
      poolSize: MULTI_CHANNEL_IDS.has(assetId) ? MULTI_POOL : DEFAULT_POOL,
    });
  }

  const pool = ensurePool(assetId);
  if (!pool || pool.length === 0) return false;

  const audio = getAvailable(pool);
  if (!audio) return false;

  try {
    audio.volume = Math.max(0, Math.min(1, volume));
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
