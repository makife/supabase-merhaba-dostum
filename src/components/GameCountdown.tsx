import { useEffect, useRef, memo, useState } from "react";
import { createPortal } from "react-dom";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  /** Server timestamp when countdown STARTS (not ends) - countdown lasts 5 seconds */
  serverStartTime?: string | null;
  /** Local offset to sync with server time */
  serverTimeOffset?: number;
}

// Preload images immediately when module loads
const IMAGE_PATHS = ["/bes.png", "/dort.png", "/uc.png", "/iki.png", "/bir.png", "/basla.png"];
const preloadedImages: Map<string, HTMLImageElement> = new Map();
let imagesPreloaded = false;

// 🔊 AUDIO POOL - Sesleri önceden yükle ve havuzda tut
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

// 🔓 Mobile audio unlock - kullanıcı etkileşimi ile ses kilidini aç
const unlockAudio = () => {
  if (audioUnlocked) return;
  
  // Tüm ses elementlerini sessiz çal ve durdur
  [...countdownSoundPool.sounds, ...startSoundPool.sounds].forEach(audio => {
    const originalVolume = audio.volume;
    audio.volume = 0;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = originalVolume;
    }).catch(() => {});
  });
  
  audioUnlocked = true;
  console.log("✅ GameCountdown: Audio unlocked for mobile");
};

// Kullanıcı etkileşimi dinleyicileri
if (typeof window !== "undefined") {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown'];
  const handleUnlock = () => {
    unlockAudio();
    unlockEvents.forEach(e => document.removeEventListener(e, handleUnlock));
  };
  unlockEvents.forEach(e => document.addEventListener(e, handleUnlock, { once: false, passive: true }));
}

// Audio pool'u başlat
const initAudioPool = () => {
  if (audioPoolInitialized || typeof window === "undefined") return;
  
  // Geri sayım sesleri için pool
  for (let i = 0; i < COUNTDOWN_SOUND_POOL_SIZE; i++) {
    const audio = new Audio();
    audio.src = "./gerisayim.mp3"; // Capacitor için relative path
    audio.volume = 0.6;
    audio.preload = "auto";
    audio.load();
    countdownSoundPool.sounds.push(audio);
  }
  
  // Başla sesi için pool
  for (let i = 0; i < START_SOUND_POOL_SIZE; i++) {
    const audio = new Audio();
    audio.src = "./basla.mp3"; // Capacitor için relative path
    audio.volume = 0.6;
    audio.preload = "auto";
    audio.load();
    startSoundPool.sounds.push(audio);
  }
  
  audioPoolInitialized = true;
  console.log("✅ GameCountdown: Audio pool initialized");
};

// Pool'dan ses çal
const playFromPool = (pool: AudioPool) => {
  if (pool.sounds.length === 0) {
    console.warn("⚠️ Audio pool empty");
    return;
  }
  
  const audio = pool.sounds[pool.currentIndex];
  pool.currentIndex = (pool.currentIndex + 1) % pool.sounds.length;
  
  // Sesi başa sar ve çal
  audio.currentTime = 0;
  audio.play().then(() => {
    console.log("✅ Sound played successfully");
  }).catch((err) => {
    console.warn("⚠️ Audio play failed:", err.message);
    // Tekrar dene - mobile unlock gerekebilir
    unlockAudio();
  });
};

// Preload on module load with completion tracking
const preloadPromise = typeof window !== "undefined" 
  ? Promise.all([
      // Görüntüleri yükle
      ...IMAGE_PATHS.map((src) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            preloadedImages.set(src, img);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = src;
        });
      }),
      // Audio pool'u başlat
      new Promise<void>((resolve) => {
        initAudioPool();
        resolve();
      })
    ]).then(() => {
      imagesPreloaded = true;
      console.log("✅ GameCountdown: All images and audio preloaded");
    })
  : Promise.resolve();

// Export for external preload check
export const ensureImagesLoaded = () => preloadPromise;

const COUNTDOWN_DURATION_MS = 5000; // 5 seconds countdown
const START_DISPLAY_DURATION_MS = 800; // Show "start" for 800ms

/**
 * Production-ready countdown component
 *
 * Uses server-authoritative timing:
 * - serverStartTime: when countdown begins
 * - Calculates remaining time passively: remaining = (serverStartTime + 5000) - serverNow
 * - NEVER resets - if time already passed, shows appropriate state
 * - Both clients calculate the SAME value at the SAME wall-clock moment
 */
const GameCountdown = memo(({ onComplete, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [displayValue, setDisplayValue] = useState<number | "start" | null>(null);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  const startShownRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const soundPlayedRef = useRef<Set<number | string>>(new Set());
  const lastDisplayRef = useRef<number | "start" | null>(null);

  // 🔊 Pool-based sound playback
  const playCountdownSound = () => playFromPool(countdownSoundPool);
  const playStartSound = () => playFromPool(startSoundPool);

  useEffect(() => {
    mountedRef.current = true;
    completedRef.current = false;
    startShownRef.current = false;
    soundPlayedRef.current.clear();
    lastDisplayRef.current = null;

    return () => {
      mountedRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (completedRef.current) return;

    // Clean previous animation frame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Reset state for new countdown
    startShownRef.current = false;
    soundPlayedRef.current.clear();
    lastDisplayRef.current = null;

    // Legacy client-side mode (no server time)
    if (!serverStartTime) {
      console.log("⏱️ GameCountdown: Legacy client-side mode");
      const localStartTime = Date.now();
      
      const tick = () => {
        if (!mountedRef.current || completedRef.current) return;
        
        const elapsed = Date.now() - localStartTime;
        const remaining = COUNTDOWN_DURATION_MS - elapsed;
        
        if (remaining <= -START_DISPLAY_DURATION_MS) {
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete();
          }
          return;
        }
        
        if (remaining <= 0) {
          if (!startShownRef.current) {
            startShownRef.current = true;
            setDisplayValue("start");
            if (!soundPlayedRef.current.has("start")) {
              soundPlayedRef.current.add("start");
              playStartSound();
            }
          }
        } else {
          const seconds = Math.ceil(remaining / 1000);
          const display = Math.min(5, Math.max(1, seconds));
          if (lastDisplayRef.current !== display) {
            lastDisplayRef.current = display;
            setDisplayValue(display);
            if (!soundPlayedRef.current.has(display)) {
              soundPlayedRef.current.add(display);
              playCountdownSound();
            }
          }
        }
        
        rafRef.current = requestAnimationFrame(tick);
      };
      
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    // 🔒 SERVER-AUTHORITATIVE MODE
    console.log("⏱️ GameCountdown: Server mode, startTime:", serverStartTime, "offset:", serverTimeOffset);
    
    const countdownEndTime = new Date(serverStartTime).getTime() + COUNTDOWN_DURATION_MS;
    
    // 🎯 ALWAYS start by showing 5 immediately to ensure countdown starts from 5
    // This prevents server sync delays from skipping initial numbers
    if (lastDisplayRef.current === null) {
      console.log("⏱️ Initial display: 5 (forced)");
      setDisplayValue(5);
      lastDisplayRef.current = 5;
      if (!soundPlayedRef.current.has(5)) {
        soundPlayedRef.current.add(5);
        playCountdownSound();
      }
    }
    
    const tick = () => {
      if (!mountedRef.current || completedRef.current) return;
      
      const serverNow = Date.now() + serverTimeOffset;
      const remaining = countdownEndTime - serverNow;
      
      // Completion check
      if (remaining <= -START_DISPLAY_DURATION_MS) {
        if (!completedRef.current) {
          completedRef.current = true;
          console.log("⏱️ Countdown completed");
          onComplete();
        }
        return;
      }
      
      // Show "start"
      if (remaining <= 0) {
        if (!startShownRef.current) {
          startShownRef.current = true;
          console.log("⏱️ Showing: start");
          setDisplayValue("start");
          lastDisplayRef.current = "start";
          if (!soundPlayedRef.current.has("start")) {
            soundPlayedRef.current.add("start");
            playStartSound();
          }
        }
      } else {
        // Show countdown numbers 5-4-3-2-1
        const seconds = Math.ceil(remaining / 1000);
        const display = Math.min(5, Math.max(1, seconds));
        
        // Only update if display changed (but skip initial 5 since we already showed it)
        if (lastDisplayRef.current !== display) {
          console.log("⏱️ Showing:", display, "(remaining:", Math.round(remaining), "ms)");
          lastDisplayRef.current = display;
          setDisplayValue(display);
          if (!soundPlayedRef.current.has(display)) {
            soundPlayedRef.current.add(display);
            playCountdownSound();
          }
        }
      }
      
      rafRef.current = requestAnimationFrame(tick);
    };
    
    // Start RAF after a small delay to let initial 5 render
    setTimeout(() => {
      if (mountedRef.current && !completedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }, 50);
    
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onComplete, serverStartTime, serverTimeOffset]);

  // Get image source
  const getImageSrc = () => {
    if (displayValue === "start") return "/basla.png";
    if (displayValue === 5) return "/bes.png";
    if (displayValue === 4) return "/dort.png";
    if (displayValue === 3) return "/uc.png";
    if (displayValue === 2) return "/iki.png";
    if (displayValue === 1) return "/bir.png";
    return "/bes.png"; // fallback
  };

  // Don't render if no value yet
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
});

GameCountdown.displayName = "GameCountdown";

export default GameCountdown;
