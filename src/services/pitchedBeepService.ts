/**
 * Pitched Beep Service
 *
 * Maç sonu 10 saniye geri sayım sesini pitch (playbackRate) ile çalmak için
 * Web Audio API kullanır. Capacitor'ın NativeAudio plugin'i playbackRate
 * desteklemediği için iOS/Android native'de tüm tıklar aynı tonda çalıyordu.
 * Web Audio hem iOS WKWebView hem Android WebView'da çalışır ve diğer
 * native audio session'larıyla çakışmaz (ambient kategori).
 */

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const inflight = new Map<string, Promise<AudioBuffer | null>>();
let unlockBound = false;

const getCtx = (): AudioContext | null => {
  if (ctx) return ctx;
  if (typeof window === "undefined") return null;
  try {
    const Ctor = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
};

const tryResume = async () => {
  const c = getCtx();
  if (!c) return;
  if (c.state !== "running") {
    try { await c.resume(); } catch {}
  }
};

const bindUnlockOnce = () => {
  if (unlockBound || typeof window === "undefined") return;
  unlockBound = true;
  const handler = () => { tryResume(); };
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  window.addEventListener("touchstart", handler, opts);
  window.addEventListener("touchend", handler, opts);
  window.addEventListener("pointerdown", handler, opts);
  window.addEventListener("click", handler, opts);
};

if (typeof window !== "undefined") bindUnlockOnce();

const loadBuffer = async (url: string): Promise<AudioBuffer | null> => {
  if (buffers.has(url)) return buffers.get(url)!;
  const ex = inflight.get(url);
  if (ex) return ex;
  const c = getCtx();
  if (!c) return null;
  const p = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
      const arr = await res.arrayBuffer();
      const buf = await new Promise<AudioBuffer>((resolve, reject) => {
        try {
          const ret = c.decodeAudioData(arr, resolve, reject);
          if (ret && typeof (ret as Promise<AudioBuffer>).then === "function") {
            (ret as Promise<AudioBuffer>).then(resolve, reject);
          }
        } catch (e) { reject(e); }
      });
      buffers.set(url, buf);
      return buf;
    } catch (e) {
      console.warn(`[pitchedBeep] decode hata ${url}:`, e);
      return null;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, p);
  return p;
};

export const preloadPitchedBeep = async (url: string): Promise<void> => {
  bindUnlockOnce();
  getCtx();
  await loadBuffer(url);
};

export const playPitchedBeep = async (
  url: string,
  playbackRate: number = 1,
  volume: number = 0.7
): Promise<boolean> => {
  const c = getCtx();
  if (!c) return false;

  // Buffer henüz hazır değilse: yüklemeyi tetikle ama bu tick'i atla.
  // Aksi halde await sırasında biriken çağrılar buffer hazır olunca
  // aynı anda patlıyor ("taramalı tüfek" efekti).
  const buf = buffers.get(url);
  if (!buf) {
    loadBuffer(url).catch(() => {});
    if (c.state !== "running") { try { c.resume(); } catch {} }
    return false;
  }

  if (c.state !== "running") {
    try { await c.resume(); } catch {}
    if (c.state !== "running") return false;
  }

  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = playbackRate;
    const gain = c.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    src.connect(gain).connect(c.destination);
    src.start(0);
    return true;
  } catch (e) {
    console.warn(`[pitchedBeep] play hata:`, e);
    return false;
  }
};
