/**
 * Pitched Beep Service (Synthesized)
 *
 * Maç sonu / bracket geri sayım sesini WebAudio OscillatorNode ile
 * SENTETİK üretir. Dosya fetch/decode yok → ilk beep asla kaçmaz,
 * "taramalı tüfek" (biriken çağrıların aynı anda patlaması) imkânsız.
 *
 * NativeAudio plugin'i playbackRate desteklemediği için iOS/Android
 * native'de pitch için tek pratik yol bu. Web Audio iOS WKWebView ve
 * Android WebView'da sorunsuz çalışır, NativeAudio ses session'ıyla
 * çakışmaz (ambient kategori).
 *
 * Sinyal API uyumluluğu: imza eski haliyle aynı kalır
 *   playPitchedBeep(url, playbackRate, volume)
 * - `url` artık yok sayılır (geriye uyumluluk için tutuldu).
 * - `playbackRate` taban frekans çarpanı olarak kullanılır.
 */

import { isIOSWebAudioTarget, playIOSWebSound } from "./iosWebAudioService";

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

let ctx: AudioContext | null = null;
let unlockBound = false;
const lastPlayAt = new Map<string, number>();
const MIN_PLAY_GAP_MS = 400;

// Maç sonu beep'i için taban frekans. playbackRate ile çarpılır.
// Eski mp3 (~880 Hz civarı bir "tik") hissini koruyacak değer.
const BASE_FREQ_HZ = 880;
const BEEP_DURATION_S = 0.12;
const ATTACK_S = 0.005;
const RELEASE_S = 0.08;

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

const tryResume = () => {
  const c = getCtx();
  if (!c) return;
  if (c.state !== "running") {
    try { c.resume(); } catch {}
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
  // Sayfa görünür olunca da context'i ayağa kaldır (iOS arka plan dönüşü)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tryResume();
  });
};

if (typeof window !== "undefined") bindUnlockOnce();

/**
 * Eski API ile uyumluluk için tutuldu. Sentetik üretim olduğu için
 * gerçek bir önyükleme gerekmez; sadece AudioContext'i hazırlar.
 */
export const preloadPitchedBeep = async (_url?: string): Promise<void> => {
  bindUnlockOnce();
  getCtx();
};

/**
 * Pitched beep çalar.
 * @param url    Geriye uyumluluk için, kullanılmıyor.
 * @param playbackRate  Taban frekansa çarpan (eski API ile aynı semantik).
 * @param volume Çıkış gain'i (0..1).
 */
export const playPitchedBeep = async (
  url: string,
  playbackRate: number = 1,
  volume: number = 0.7
): Promise<boolean> => {
  // Aynı kaynaktan çok hızlı tekrar çağrıları yut (defansif guard).
  const now = performance.now();
  const key = url || "__default__";
  const last = lastPlayAt.get(key) || 0;
  if (now - last < MIN_PLAY_GAP_MS) return false;
  lastPlayAt.set(key, now);

  // 🔧 iOS native: OscillatorNode WKWebView'da AVAudioSession ile çakışıp
  // sessiz kalabiliyor. Bunun yerine çalışan HTML5 havuzunu playbackRate ile kullan.
  if (isIOSWebAudioTarget()) {
    const ok = await playIOSWebSound("beep", volume, "/beep.mp3", playbackRate);
    if (ok) return true;
  }

  const c = getCtx();
  if (!c) return false;


  if (c.state !== "running") {
    try { await c.resume(); } catch {}
    // Hâlâ ayağa kalkmadıysa sessizce çık; bir sonraki tikte tekrar denenir.
    if ((c.state as string) !== "running") return false;
  }

  try {
    const t0 = c.currentTime;
    const freq = Math.max(80, Math.min(8000, BASE_FREQ_HZ * playbackRate));
    const vol = Math.max(0, Math.min(1, volume));

    const osc = c.createOscillator();
    osc.type = "square"; // kısa, net "tik" hissi
    osc.frequency.setValueAtTime(freq, t0);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ATTACK_S + RELEASE_S);

    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + BEEP_DURATION_S);
    osc.onended = () => {
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };
    return true;
  } catch (e) {
    console.warn(`[pitchedBeep] play hata:`, e);
    return false;
  }
};
