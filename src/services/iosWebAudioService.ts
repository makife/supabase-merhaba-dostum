/**
 * iOS Web Audio Service
 *
 * iOS native (Capacitor WebView) üzerinde NativeAudio ve HTML5 Audio
 * AVAudioSession ile çakışıp uygulamayı oyundan atıyordu (memory:
 * ios-audio-session-conflict-fix).
 *
 * Bu servis Web Audio API (AudioContext + AudioBuffer) kullanır. WebKit'in
 * varsayılan WebAudio session kategorisi "ambient" olduğu için diğer sesleri
 * kesmez ve native session ile çakışmaz. Tüm ses dosyaları başlangıçta fetch
 * + decodeAudioData ile bellek içi AudioBuffer'lara çözülür; çalma anında
 * yeni bir BufferSource oluşturularak overlap'a izin verilir.
 *
 * İlk kullanıcı dokunuşunda AudioContext resume edilir (iOS gestür kuralı).
 */

import { Capacitor } from "@capacitor/core";

const isIOSNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

let ctx: AudioContext | null = null;
let unlocked = false;
let unlockBound = false;
let unlockPromise: Promise<void> | null = null;
const buffers = new Map<string, AudioBuffer>();
const inflight = new Map<string, Promise<AudioBuffer | null>>();

type WebAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export const isIOSWebAudioTarget = (): boolean => isIOSNative;

const getContext = (): AudioContext | null => {
  if (!isIOSNative) return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch (e) {
    console.warn("[iOSWebAudio] AudioContext oluşturulamadı:", e);
    return null;
  }
};

const tryUnlock = (): Promise<void> => {
  const c = getContext();
  if (!c) return Promise.resolve();
  if (c.state === "running") {
    unlocked = true;
    return Promise.resolve();
  }
  if (unlockPromise) return unlockPromise;
  unlockPromise = (async () => {
    try {
      // Sessiz buffer'ı resume'dan ÖNCE start et — Safari için kritik
      try {
        const buf = c.createBuffer(1, 1, 22050);
        const src = c.createBufferSource();
        src.buffer = buf;
        src.connect(c.destination);
        src.start(0);
      } catch {
        // Safari unlock denemesi başarısız olursa resume yine denenir.
      }
      await c.resume();
      unlocked = c.state === "running";
      if (unlocked) console.log("🔓 [iOSWebAudio] AudioContext unlocked");
    } catch (e) {
      console.warn("[iOSWebAudio] unlock hatası:", e);
    } finally {
      // Bir sonraki gesture'da tekrar deneyebilmek için suspended kaldıysa sıfırla
      if (c.state !== "running") unlockPromise = null;
    }
  })();
  return unlockPromise;
};

const bindUnlockOnce = () => {
  if (unlockBound) return;
  unlockBound = true;
  const handler = () => {
    tryUnlock();
  };
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  window.addEventListener("touchstart", handler, opts);
  window.addEventListener("touchend", handler, opts);
  window.addEventListener("pointerdown", handler, opts);
  window.addEventListener("click", handler, opts);
  window.addEventListener("keydown", handler, opts);
};

// Modül yüklenir yüklenmez gesture dinleyicilerini bağla — init beklenmesin
if (isIOSNative && typeof window !== "undefined") {
  bindUnlockOnce();
}

const loadBuffer = async (
  assetId: string,
  url: string
): Promise<AudioBuffer | null> => {
  if (buffers.has(assetId)) return buffers.get(assetId)!;
  const existing = inflight.get(assetId);
  if (existing) return existing;
  const c = getContext();
  if (!c) return null;

  const p = (async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
      const arr = await res.arrayBuffer();
      const buf = await new Promise<AudioBuffer>((resolve, reject) => {
        // Eski WebKit callback API'sini de destekle
        try {
          const ret = c.decodeAudioData(
            arr,
            (b) => resolve(b),
            (e) => reject(e)
          );
          if (ret && typeof (ret as Promise<AudioBuffer>).then === "function") {
            (ret as Promise<AudioBuffer>).then(resolve, reject);
          }
        } catch (e) {
          reject(e);
        }
      });
      buffers.set(assetId, buf);
      return buf;
    } catch (e) {
      console.warn(`[iOSWebAudio] ${assetId} decode hatası:`, e);
      return null;
    } finally {
      inflight.delete(assetId);
    }
  })();

  inflight.set(assetId, p);
  return p;
};

export const initIOSWebAudio = async (
  sounds: { assetId: string; assetPath: string; volume?: number }[]
): Promise<void> => {
  if (!isIOSNative) return;
  bindUnlockOnce();
  getContext();
  // Tüm sesleri paralel decode et
  await Promise.all(
    sounds.map((s) => {
      // assetPath formu: "public/foo.mp3" -> "/foo.mp3"
      const url = s.assetPath.replace(/^public\//, "/");
      return loadBuffer(s.assetId, url);
    })
  );
  console.log(
    `🔊 [iOSWebAudio] ${buffers.size}/${sounds.length} ses hazır ✅`
  );
};

export const playIOSWebSound = async (
  assetId: string,
  volume = 0.7,
  fallbackUrl?: string
): Promise<boolean> => {
  if (!isIOSNative) return false;
  const c = getContext();
  if (!c) return false;

  // iOS context unlock değilse resume'u BEKLE (gesture ise resume olur)
  if ((c.state as string) !== "running") {
    try {
      await tryUnlock();
    } catch {
      // Gesture dışı denemelerde iOS resume'u reddedebilir.
    }
    if ((c.state as string) !== "running") {
      try {
        await c.resume();
      } catch {
        // Hâlâ kilitliyse aşağıdaki state kontrolü false döndürür.
      }
    }
    if ((c.state as string) !== "running") {
      console.warn(`[iOSWebAudio] ${assetId} çalınamadı: ctx state=${c.state}`);
      return false;
    }
  }

  let buf = buffers.get(assetId);
  if (!buf && fallbackUrl) {
    buf = (await loadBuffer(assetId, fallbackUrl)) || undefined;
  }
  if (!buf) return false;

  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    src.connect(gain).connect(c.destination);
    src.start(0);
    return true;
  } catch (e) {
    console.warn(`[iOSWebAudio] ${assetId} play hatası:`, e);
    return false;
  }
};

export const stopAllIOSWebSounds = (): void => {
  if (!isIOSNative || !ctx) return;
  // BufferSource'lar tek seferlik; aktif kaynak takibi yok.
  // Acil kesme istenirse context.suspend() çağrılabilir ama oyun sırasında istemiyoruz.
};
