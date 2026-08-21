// Simple WebAudio synthetic beeps for mini-games.
// Kısa, jenerik "bip" sesleri — decode / dosya yüklemesi yok.

import { Capacitor } from "@capacitor/core";

const IS_IOS_NATIVE =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";


let ctx: AudioContext | null = null;
const getCtx = (): AudioContext | null => {
  try {
    if (!ctx) {
      const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
};

const beep = (freq: number, duration = 0.08, type: OscillatorType = "square", vol = 0.12) => {
  const ac = getCtx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ac.destination);
    const now = ac.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {}
};

// Refleks kutuları için kısa, parlak bip.
// step: mevcut kelime içindeki harf indeksi (0'dan başlar). Her harfte pitch yükselir.
export const playTileBeep = (step = 0) => {
  const base = 660;
  const semitone = Math.pow(2, 1 / 12);
  const freq = Math.min(2400, base * Math.pow(semitone, step * 2));
  beep(freq, 0.07, "square", 0.1);
};

// Harf Koşusu zıplama için hafif "boop"
export const playJumpBeep = () => {
  const ac = getCtx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    const now = ac.currentTime;
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  } catch {}
};

// Karma (2048) kaydırma sesi — kısa "swoosh".
// WebAudio ile sentezlenir, HTML5 <audio> kullanılmaz; iOS'ta arka plan müziği kesilmez.
export const playSwipeSwoosh = () => {
  const ac = getCtx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    const dur = 0.13;
    // Kısa gürültü buffer'ı (band-pass süzülmüş) = swoosh
    const frames = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const t = i / frames;
      data[i] = (Math.random() * 2 - 1) * (1 - t) * (1 - t);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + dur);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start(now);
    src.stop(now + dur + 0.02);
  } catch {}
};


// Dino Runner zıplama sesi — mp3 havuzu
const DINO_JUMP_URL = "/DinoRunners/dinoRunnerZiplama.mp3";
let dinoJumpPool: HTMLAudioElement[] | null = null;
const DINO_POOL_SIZE = 4;

const ensureDinoPool = (): HTMLAudioElement[] => {
  if (dinoJumpPool) return dinoJumpPool;
  try {
    dinoJumpPool = Array.from({ length: DINO_POOL_SIZE }, () => {
      const a = new Audio(DINO_JUMP_URL);
      a.preload = "auto";
      a.volume = 0.7;
      a.setAttribute("playsinline", "true");
      return a;
    });
  } catch {
    dinoJumpPool = [];
  }
  return dinoJumpPool;
};

/**
 * iOS nativde HTML5 <audio> çalmak AVAudioSession'ı sıfırlıyor ve arka plan
 * müziğini kesiyor; ayrıca play() ana thread'de hitch yaratıyor.
 * Bu yüzden iOS'ta zıplama sesi paylaşımlı WebAudio ile sentezleniyor.
 */
export const playDinoJump = () => {
  if (IS_IOS_NATIVE) {
    playJumpBeep();
    return;
  }
  const pool = ensureDinoPool();
  if (pool.length === 0) return;
  const a = pool.find((x) => x.paused || x.ended) ?? pool[0];
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {}
};


/**
 * Genel amaçlı ton — mini oyunlarda ayrı AudioContext açmak yerine bunu kullan.
 * iOS'ta ikinci bir AudioContext açmak AVAudioSession'ı sıfırlıyor ve
 * arka plan müziğini kesiyor; bu yüzden tek paylaşımlı context şart.
 */
export const playGenericTone = (
  freq: number,
  type: OscillatorType = "sine",
  vol = 0.1,
  duration = 0.1
) => {
  beep(freq, duration, type, vol);
};
