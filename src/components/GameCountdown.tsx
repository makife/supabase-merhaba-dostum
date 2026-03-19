import { useEffect, useRef, memo, useState } from "react";
import { createPortal } from "react-dom";
import { initNativeAudio, playNativeSound, isNativePlatform, isNativeAudioReady } from "@/services/nativeAudioService";
import { useMusic } from "@/contexts/MusicContext";
import { isSoundEffectsEnabled } from "@/utils/soundSettings";

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
// 🔧 BASİT VE STABIL INTERVAL-BASED COUNTDOWN
const GameCountdown = memo(
  ({ onComplete, serverStartTime, serverTimeOffset = 0, countdownKey }: GameCountdownProps) => {
    const [displayValue, setDisplayValue] = useState<number | "start" | null>(null);
    const { fadeOutBackgroundMusic } = useMusic();

    // Refs - tüm state management ref üzerinden
    const completedRef = useRef(false);
    const mountedRef = useRef(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const completeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const soundPlayedRef = useRef<Set<number | string>>(new Set());
    const hasInitializedRef = useRef(false);
    const currentValueRef = useRef<number>(5);
    const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2, 8));
    const musicFadedRef = useRef(false);

    const playCountdownSound = () => {
      if (!isSoundEffectsEnabled()) return;
      playFromPool(countdownSoundPool, "countdown");
    };
    const playStartSound = () => {
      if (!isSoundEffectsEnabled()) return;
      playFromPool(startSoundPool, "start");
    };

    // Cleanup helper
    const cleanupAllTimers = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
        completeTimeoutRef.current = null;
      }
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
    };

    // Mount/Unmount lifecycle
    useEffect(() => {
      const instanceId = instanceIdRef.current;
      console.log(`🔄 [${instanceId}] GameCountdown MOUNT`);
      
      mountedRef.current = true;
      completedRef.current = false;
      hasInitializedRef.current = false;
      soundPlayedRef.current.clear();
      currentValueRef.current = 5;
      setDisplayValue(null);

      return () => {
        console.log(`🔄 [${instanceId}] GameCountdown UNMOUNT`);
        mountedRef.current = false;
        cleanupAllTimers();
      };
    }, []);

    // Key veya serverStartTime değiştiğinde reset
    useEffect(() => {
      if (!serverStartTime) return;
      
      const instanceId = instanceIdRef.current;
      
      // Zaten bu timestamp ile başlatıldıysa atla
      if (hasInitializedRef.current) {
        return;
      }

      console.log(`🎯 [${instanceId}] Countdown başlatılıyor - time: ${serverStartTime}`);
      
      // Önce her şeyi temizle
      cleanupAllTimers();
      completedRef.current = false;
      soundPlayedRef.current.clear();
      currentValueRef.current = 5;
      hasInitializedRef.current = true;

      // 🔧 BÜYÜK FIX: Basit ve stabil countdown mantığı
      // serverStartTime = countdown'ın BAŞLAMASI gereken an
      // Eğer şu an veya çok yakınsa, doğrudan 5'ten başla
      const startTime = new Date(serverStartTime).getTime();
      const serverNow = Date.now() + serverTimeOffset;
      const timeDiff = startTime - serverNow;

      console.log(`⏱️ [${instanceId}] Timing check: startTime=${startTime}, serverNow=${serverNow}, diff=${timeDiff}ms`);

      // 🔒 Eğer zaman farkı -500ms ile +500ms arasındaysa "şu an" kabul et
      // Bu, ağ gecikmelerini tolere eder
      const isNow = Math.abs(timeDiff) < 500;
      
      // 🔒 Eğer çok geç kalmışsak (5 saniyeden fazla geçmiş), hemen bitir
      if (timeDiff < -5500) {
        console.log(`🏁 [${instanceId}] Countdown zaten bitmiş (${timeDiff}ms geçmiş), hemen tamamla`);
        setDisplayValue("start");
        if (!soundPlayedRef.current.has("start")) {
          soundPlayedRef.current.add("start");
          playStartSound();
        }
        completeTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && !completedRef.current) {
            completedRef.current = true;
            onComplete();
          }
        }, 300);
        return;
      }

      // 🎯 SERVER-ANCHORED COUNTDOWN: Her tick'te sunucu zamanına göre hesapla
      // Bu sayede iOS ve Android aynı anda aynı sayıyı gösterir
      
      const startCountdownAnchored = () => {
        console.log(`🔢 [${instanceId}] Server-anchored countdown başlıyor! startTime=${startTime}`);
        
        // 🎵 Arka plan müziğini fade out yap
        if (!musicFadedRef.current) {
          musicFadedRef.current = true;
          fadeOutBackgroundMusic(4500);
        }
        
        // Tick fonksiyonu: sunucu zamanına göre hangi sayıda olmalıyız?
        const tick = () => {
          if (!mountedRef.current || completedRef.current) {
            cleanupAllTimers();
            return;
          }
          
          const now = Date.now() + serverTimeOffset;
          // startTime'dan bu yana kaç saniye geçti?
          const elapsed = (now - startTime) / 1000;
          // Countdown 5'ten başlıyor, her saniye 1 azalıyor
          // elapsed=0 → 5, elapsed=1 → 4, ... elapsed=4 → 1, elapsed=5 → 0 (BAŞLA)
          const countdownValue = Math.ceil(5 - elapsed);
          
          if (countdownValue > 5) {
            // Henüz başlamamış, bekle
            return;
          }
          
          if (countdownValue >= 1 && countdownValue <= 5) {
            if (currentValueRef.current !== countdownValue) {
              currentValueRef.current = countdownValue;
              console.log(`🔢 [${instanceIdRef.current}] ${countdownValue} (elapsed=${elapsed.toFixed(2)}s)`);
              setDisplayValue(countdownValue);
              if (!soundPlayedRef.current.has(countdownValue)) {
                soundPlayedRef.current.add(countdownValue);
                playCountdownSound();
              }
            }
          } else if (countdownValue <= 0) {
            // BAŞLA!
            if (!soundPlayedRef.current.has("start")) {
              console.log(`🏁 [${instanceIdRef.current}] BAŞLA! (elapsed=${elapsed.toFixed(2)}s)`);
              setDisplayValue("start");
              soundPlayedRef.current.add("start");
              playStartSound();
            }
            
            // Interval'ı durdur
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            
            // 600ms sonra tamamla
            if (!completeTimeoutRef.current) {
              completeTimeoutRef.current = setTimeout(() => {
                if (mountedRef.current && !completedRef.current) {
                  completedRef.current = true;
                  console.log(`🏁 [${instanceIdRef.current}] Countdown TAMAMLANDI`);
                  onComplete();
                }
              }, 600);
            }
          }
        };
        
        // İlk tick hemen çalışsın
        tick();
        
        // Sonra her 200ms'de kontrol et (1000ms yerine — daha hassas senkronizasyon)
        intervalRef.current = setInterval(tick, 200);
      };

      // Eğer start time geçmişte veya şu anda ise, hemen başla
      if (timeDiff <= 500) {
        console.log(`⚡ [${instanceId}] Hemen başlıyor (timeDiff=${timeDiff}ms)`);
        startCountdownAnchored();
      } else {
        // Gelecekte başlayacaksa bekle
        console.log(`⏳ [${instanceId}] ${timeDiff - 500}ms bekleyip başlayacak`);
        startTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && !completedRef.current) {
            startCountdownAnchored();
          }
        }, timeDiff - 500); // 500ms önce başlat, tick zaten doğru zamanı hesaplayacak
      }

    }, [serverStartTime, serverTimeOffset, onComplete]);

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
