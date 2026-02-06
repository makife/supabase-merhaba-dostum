import { useEffect, useRef, memo, useState } from "react";
import { createPortal } from "react-dom";
import { initNativeAudio, playNativeSound, isNativePlatform, isNativeAudioReady } from "@/services/nativeAudioService";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  /** Sunucudan gelen geri sayım BAŞLAMA zamanı (Timestamp string) */
  serverStartTime?: string | null;
  /** Sunucu ile istemci arasındaki saat farkı (ms) */
  serverTimeOffset?: number;
  /** Component key - rematch için yeni instance oluşturmak için */
  countdownKey?: string;
}

// --- ASSET YÖNETİMİ (PRELOAD) ---
const IMAGE_PATHS = ["/bes.png", "/dort.png", "/uc.png", "/iki.png", "/bir.png", "/basla.png"];
const preloadedImages: Map<string, HTMLImageElement> = new Map();
let imagesPreloaded = false;

// --- SES YÖNETİMİ (AUDIO POOL) - Sadece Web için ---
const COUNTDOWN_SOUND_POOL_SIZE = 6;
const START_SOUND_POOL_SIZE = 2;

interface AudioPool {
  sounds: HTMLAudioElement[];
  currentIndex: number;
}

const countdownSoundPool: AudioPool = { sounds: [], currentIndex: 0 };
const startSoundPool: AudioPool = { sounds: [], currentIndex: 0 };
let audioPoolInitialized = false;
let audioUnlocked = false;
let audioContext: AudioContext | null = null;
let nativeAudioReady = false;

// Native Audio'yu başlat
const initNativeCountdownAudio = async () => {
  if (!isNativePlatform()) return;
  if (nativeAudioReady) return;

  if (isNativeAudioReady()) {
    nativeAudioReady = true;
    return;
  }

  try {
    await initNativeAudio();
    nativeAudioReady = true;
  } catch (e) {
    console.warn("GameCountdown: Native Audio başlatılamadı:", e);
  }
};

// Mobil tarayıcılar ve Capacitor için ses kilidi açma
const unlockAudio = () => {
  if (audioUnlocked) return;

  if (isNativePlatform()) {
    initNativeCountdownAudio();
    audioUnlocked = true;
    return;
  }

  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn("GameCountdown: AudioContext oluşturulamadı:", e);
    }
  }

  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  [...countdownSoundPool.sounds, ...startSoundPool.sounds].forEach((audio) => {
    const originalVolume = audio.volume;
    audio.volume = 0.01;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = originalVolume;
    }).catch(() => {});
  });

  audioUnlocked = true;
};

// Event Listenerları ekle
if (typeof window !== "undefined") {
  const unlockEvents = ["touchstart", "touchend", "click", "keydown", "pointerdown", "mousedown"];
  const handleUnlock = () => {
    unlockAudio();
    unlockEvents.forEach((e) => document.removeEventListener(e, handleUnlock));
  };
  unlockEvents.forEach((e) => document.addEventListener(e, handleUnlock, { passive: true }));

  if (isNativePlatform()) {
    initNativeCountdownAudio();
  }
}

// Ses havuzunu başlat - Sadece Web için
const initAudioPool = () => {
  if (audioPoolInitialized || typeof window === "undefined") return;
  if (isNativePlatform()) {
    audioPoolInitialized = true;
    return;
  }

  const basePath = window.location.origin;

  for (let i = 0; i < COUNTDOWN_SOUND_POOL_SIZE; i++) {
    const audio = new Audio();
    audio.src = `${basePath}/gerisayim.mp3`;
    audio.volume = 0.6;
    audio.preload = "auto";
    audio.load();
    countdownSoundPool.sounds.push(audio);
  }

  for (let i = 0; i < START_SOUND_POOL_SIZE; i++) {
    const audio = new Audio();
    audio.src = `${basePath}/basla.mp3`;
    audio.volume = 0.6;
    audio.preload = "auto";
    audio.load();
    startSoundPool.sounds.push(audio);
  }

  audioPoolInitialized = true;
};

// Ses çalma fonksiyonu
const playFromPool = async (pool: AudioPool, soundType: "countdown" | "start") => {
  if (isNativePlatform()) {
    try {
      await playNativeSound(soundType, soundType === "countdown" ? 0.6 : 0.7);
    } catch (e) {
      console.warn(`GameCountdown: Native ${soundType} sesi çalınamadı:`, e);
    }
    return;
  }

  if (pool.sounds.length === 0) return;

  if (!audioUnlocked) {
    unlockAudio();
  }

  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  const audio = pool.sounds[pool.currentIndex];
  pool.currentIndex = (pool.currentIndex + 1) % pool.sounds.length;
  audio.currentTime = 0;
  audio.play().catch(() => {
    unlockAudio();
  });
};

// Resim ve Sesleri Yükle
const preloadPromise =
  typeof window !== "undefined"
    ? Promise.all([
        ...IMAGE_PATHS.map(
          (src) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                preloadedImages.set(src, img);
                resolve();
              };
              img.onerror = () => resolve();
              img.src = src;
            }),
        ),
        new Promise<void>((resolve) => {
          initAudioPool();
          resolve();
        }),
      ]).then(() => {
        imagesPreloaded = true;
      })
    : Promise.resolve();

export const ensureImagesLoaded = () => preloadPromise;

// --- ANA COMPONENT ---
// 🔧 TAMAMEN YENİDEN YAZILDI - BASIT VE GÜVENİLİR
// serverStartTime = countdown'ın başlaması gereken sunucu zamanı
// Her zaman 5-4-3-2-1 sayar, sunucu zamanıyla senkronize
const GameCountdown = memo(
  ({ onComplete, serverStartTime, serverTimeOffset = 0, countdownKey }: GameCountdownProps) => {
    // 🔧 BASİT YAKLAŞIM: Her zaman 5'ten başla ve 1 saniye aralıklarla say
    const [displayValue, setDisplayValue] = useState<number | "start" | null>(null);

    // Refs
    const completedRef = useRef(false);
    const mountedRef = useRef(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const completeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const soundPlayedRef = useRef<Set<number | string>>(new Set());
    const startedRef = useRef(false);
    const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2, 8));

    const playCountdownSound = () => playFromPool(countdownSoundPool, "countdown");
    const playStartSound = () => playFromPool(startSoundPool, "start");

    // 🔒 countdownKey veya serverStartTime değiştiğinde TAMAMEN SIFIRLA
    useEffect(() => {
      const instanceId = instanceIdRef.current;
      console.log(`🔄 [${instanceId}] GameCountdown mount/reset - key: ${countdownKey}, time: ${serverStartTime}`);
      
      mountedRef.current = true;
      completedRef.current = false;
      startedRef.current = false;
      soundPlayedRef.current.clear();
      setDisplayValue(null);

      return () => {
        console.log(`🔄 [${instanceId}] GameCountdown unmount`);
        mountedRef.current = false;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (completeTimeoutRef.current) {
          clearTimeout(completeTimeoutRef.current);
          completeTimeoutRef.current = null;
        }
      };
    }, [countdownKey, serverStartTime]);

    // 🎯 ANA COUNTDOWN MANTIK - BASİT VE GÜVENİLİR
    useEffect(() => {
      if (completedRef.current) return;
      if (!serverStartTime) {
        console.log("⏳ GameCountdown: serverStartTime bekleniyor...");
        return;
      }
      if (startedRef.current) {
        console.log("⏳ GameCountdown: Zaten başladı, atlanıyor...");
        return;
      }

      const instanceId = instanceIdRef.current;
      startedRef.current = true;

      // Eski timer'ları temizle
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
        completeTimeoutRef.current = null;
      }

      // 🔧 ZAMANLAMA:
      // serverStartTime = countdown'ın BAŞLAMASI gereken an
      // 5 saniye boyunca 5-4-3-2-1 göster, sonra "BAŞLA"
      const startTime = new Date(serverStartTime).getTime();
      const serverNow = Date.now() + serverTimeOffset;
      const msUntilStart = startTime - serverNow;

      console.log(`⏱️ [${instanceId}] Countdown timing:`, {
        serverStartTime,
        startTime: new Date(startTime).toISOString(),
        serverNow: new Date(serverNow).toISOString(),
        msUntilStart,
      });

      // 🎯 SENARYO 1: Countdown henüz başlamadı - bekle
      if (msUntilStart > 100) {
        console.log(`⏳ [${instanceId}] Countdown ${msUntilStart}ms sonra başlayacak...`);
        
        // İlk değeri 5 olarak göster (bekleme sırasında)
        setDisplayValue(5);
        
        // Başlama zamanı gelince countdown'ı başlat
        const startTimer = setTimeout(() => {
          if (mountedRef.current && !completedRef.current) {
            console.log(`✅ [${instanceId}] Bekleme bitti, countdown başlıyor`);
            startCountdownSequence();
          }
        }, msUntilStart);

        return () => clearTimeout(startTimer);
      }

      // 🎯 SENARYO 2: Countdown zaten başlamış olmalı
      // Kalan süreyi hesapla ve oradan devam et
      const elapsed = -msUntilStart; // Geçen süre (ms)
      const remainingSeconds = Math.max(0, 5 - Math.floor(elapsed / 1000));

      console.log(`⚡ [${instanceId}] Countdown devam ediyor: ${remainingSeconds} saniye kaldı (${elapsed}ms geçti)`);

      if (remainingSeconds <= 0) {
        // Countdown zaten bitti - hemen "BAŞLA" göster ve bitir
        console.log(`🏁 [${instanceId}] Countdown zaten bitmiş, hemen tamamlanıyor`);
        setDisplayValue("start");
        if (!soundPlayedRef.current.has("start")) {
          soundPlayedRef.current.add("start");
          playStartSound();
        }
        completeTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && !completedRef.current) {
            completedRef.current = true;
            console.log(`🏁 [${instanceId}] Countdown TAMAMLANDI (geç katılım)`);
            onComplete();
          }
        }, 400);
        return;
      }

      // Kalan sayıdan devam et
      startCountdownSequence(remainingSeconds);

      // 🔧 COUNTDOWN SEKANS BAŞLATICI
      function startCountdownSequence(startFrom: number = 5) {
        let currentNumber = startFrom;
        
        console.log(`🔢 [${instanceId}] Countdown sekansı başlıyor: ${currentNumber}`);
        
        // İlk sayıyı göster ve ses çal
        setDisplayValue(currentNumber);
        if (!soundPlayedRef.current.has(currentNumber)) {
          soundPlayedRef.current.add(currentNumber);
          playCountdownSound();
        }
        currentNumber--;

        // Her saniye bir sonraki sayıyı göster
        intervalRef.current = setInterval(() => {
          if (!mountedRef.current || completedRef.current) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return;
          }

          if (currentNumber > 0) {
            // Sayıyı göster ve ses çal
            console.log(`🔢 [${instanceId}] Countdown: ${currentNumber}`);
            setDisplayValue(currentNumber);
            if (!soundPlayedRef.current.has(currentNumber)) {
              soundPlayedRef.current.add(currentNumber);
              playCountdownSound();
            }
            currentNumber--;
          } else if (currentNumber === 0) {
            // "BAŞLA" göster
            console.log(`🏁 [${instanceId}] BAŞLA gösteriliyor`);
            setDisplayValue("start");
            if (!soundPlayedRef.current.has("start")) {
              soundPlayedRef.current.add("start");
              playStartSound();
            }
            currentNumber--;
          } else {
            // Countdown tamamlandı
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            
            // 600ms "BAŞLA" göster, sonra tamamla
            completeTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && !completedRef.current) {
                completedRef.current = true;
                console.log(`🏁 [${instanceId}] Countdown TAMAMLANDI`);
                onComplete();
              }
            }, 600);
          }
        }, 1000);
      }

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (completeTimeoutRef.current) {
          clearTimeout(completeTimeoutRef.current);
          completeTimeoutRef.current = null;
        }
      };
    }, [onComplete, serverStartTime, serverTimeOffset]);

    // Görsel Seçimi
    const getImageSrc = () => {
      if (displayValue === "start") return "/basla.png";
      if (displayValue === 5) return "/bes.png";
      if (displayValue === 4) return "/dort.png";
      if (displayValue === 3) return "/uc.png";
      if (displayValue === 2) return "/iki.png";
      if (displayValue === 1) return "/bir.png";
      return "/bes.png";
    };

    // Eğer değer yoksa hiçbir şey gösterme
    if (displayValue === null) {
      return null;
    }

    return createPortal(
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
        }}
      >
        <img
          key={String(displayValue)}
          src={getImageSrc()}
          alt={String(displayValue)}
          style={{
            width: 280,
            height: 280,
            objectFit: "contain",
          }}
        />
      </div>,
      document.body,
    );
  },
);

GameCountdown.displayName = "GameCountdown";

export default GameCountdown;
