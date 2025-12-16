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

// Audio pool'u başlat
const initAudioPool = () => {
  if (audioPoolInitialized || typeof window === "undefined") return;
  
  // Geri sayım sesleri için pool
  for (let i = 0; i < COUNTDOWN_SOUND_POOL_SIZE; i++) {
    const audio = new Audio("/gerisayim.mp3");
    audio.volume = 0.6;
    audio.preload = "auto";
    audio.load();
    countdownSoundPool.sounds.push(audio);
  }
  
  // Başla sesi için pool
  for (let i = 0; i < START_SOUND_POOL_SIZE; i++) {
    const audio = new Audio("/basla.mp3");
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
  if (pool.sounds.length === 0) return;
  
  const audio = pool.sounds[pool.currentIndex];
  pool.currentIndex = (pool.currentIndex + 1) % pool.sounds.length;
  
  // Sesi başa sar ve çal
  audio.currentTime = 0;
  audio.play().catch(() => {});
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
  const lastPlayedSecondRef = useRef<number | null>(null);
  const startShownRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundPlayedRef = useRef<Set<number>>(new Set()); // Her saniye için sadece bir ses çal
  const countdownStartedRef = useRef(false); // 🔒 Geri sayım başladı mı kontrolü
  const currentDisplayRef = useRef<number | "start" | null>(null); // 🔒 Closure problemi çözümü

  useEffect(() => {
    mountedRef.current = true;
    // 🔒 Yeni mount'ta ref'leri resetle (yarı final gibi yeni maçlar için)
    completedRef.current = false;
    countdownStartedRef.current = false;
    startShownRef.current = false;
    soundPlayedRef.current.clear();
    currentDisplayRef.current = null;

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Prevent running after completion
    if (completedRef.current) {
      console.log("⏱️ GameCountdown: Already completed, skipping");
      return;
    }

    // 🔒 Geri sayım zaten başladıysa, tekrar başlatma (race condition önleme)
    if (countdownStartedRef.current) {
      console.log("⏱️ GameCountdown: Already started, skipping duplicate trigger");
      return;
    }
    countdownStartedRef.current = true;

    // 🔊 Pool-based sound playback - çok daha hızlı
    const playCountdownSound = () => {
      playFromPool(countdownSoundPool);
    };
    
    const playStartSound = () => {
      playFromPool(startSoundPool);
    };

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Reset sound tracking
    soundPlayedRef.current.clear();

    // If no server time provided, use legacy client-side mode
    if (!serverStartTime) {
      console.log("⏱️ GameCountdown: Legacy client-side mode (no serverStartTime)");

      setDisplayValue(5);
      playCountdownSound();
      soundPlayedRef.current.add(5);

      const timers: NodeJS.Timeout[] = [];
      timers.push(
        setTimeout(() => {
          if (mountedRef.current && !soundPlayedRef.current.has(4)) {
            setDisplayValue(4);
            playCountdownSound();
            soundPlayedRef.current.add(4);
          }
        }, 1000),
      );
      timers.push(
        setTimeout(() => {
          if (mountedRef.current && !soundPlayedRef.current.has(3)) {
            setDisplayValue(3);
            playCountdownSound();
            soundPlayedRef.current.add(3);
          }
        }, 2000),
      );
      timers.push(
        setTimeout(() => {
          if (mountedRef.current && !soundPlayedRef.current.has(2)) {
            setDisplayValue(2);
            playCountdownSound();
            soundPlayedRef.current.add(2);
          }
        }, 3000),
      );
      timers.push(
        setTimeout(() => {
          if (mountedRef.current && !soundPlayedRef.current.has(1)) {
            setDisplayValue(1);
            playCountdownSound();
            soundPlayedRef.current.add(1);
          }
        }, 4000),
      );
      timers.push(
        setTimeout(() => {
          if (mountedRef.current && !startShownRef.current) {
            setDisplayValue("start");
            playStartSound();
            startShownRef.current = true;
          }
        }, 5000),
      );
      timers.push(
        setTimeout(() => {
          if (!completedRef.current && mountedRef.current) {
            completedRef.current = true;
            onComplete();
          }
        }, 5800),
      );

      return () => {
        timers.forEach(clearTimeout);
      };
    }

    // 🔒 HYBRID APPROACH: Local visual progression + Server-sync completion
    // Visual: Her zaman 5-4-3-2-1 göster (local timing)
    // Completion: Server end time'a göre bitir (senkronize)
    console.log("⏱️ GameCountdown: Hybrid mode with serverStartTime:", serverStartTime);
    
    // Server countdown end time (AUTHORITATIVE for completion)
    const countdownStartTime = new Date(serverStartTime).getTime();
    const countdownEndTime = countdownStartTime + COUNTDOWN_DURATION_MS;
    const serverNow = Date.now() + serverTimeOffset;
    
    // Eğer countdown zaten bitmişse
    if (countdownEndTime - serverNow <= 0) {
      if (!completedRef.current && mountedRef.current) {
        completedRef.current = true;
        console.log("⏱️ GameCountdown: Already completed at mount");
        onComplete();
      }
      return;
    }
    
    // 🎯 LOCAL VISUAL START - Her zaman 5'ten başla
    const localStartTime = Date.now();
    console.log("⏱️ Starting countdown from 5 (local visual), server ends at:", new Date(countdownEndTime).toISOString());
    
    setDisplayValue(5);
    currentDisplayRef.current = 5;
    playCountdownSound();
    soundPlayedRef.current.add(5);
    
    // Use setInterval for consistent updates
    intervalRef.current = setInterval(() => {
      if (completedRef.current || !mountedRef.current) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      const now = Date.now();
      const serverNow = now + serverTimeOffset;
      
      // Server end time'a göre kalan süre (completion için)
      const serverRemainingMs = countdownEndTime - serverNow;
      
      // Local elapsed time (visual için)
      const localElapsedMs = now - localStartTime;
      const localRemainingMs = COUNTDOWN_DURATION_MS - localElapsedMs;
      
      // 🔒 COMPLETION CHECK: Local timing + start display süresi sonrası
      if (localRemainingMs <= -START_DISPLAY_DURATION_MS) {
        if (!completedRef.current) {
          completedRef.current = true;
          console.log("⏱️ GameCountdown: Completed (local-sync)");
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onComplete();
        }
        return;
      }

      // 🎯 VISUAL DISPLAY: Local timing ile 5-4-3-2-1 ve start
      // Local timing kullan - hem visual hem start için tutarlılık
      if (localRemainingMs <= 0) {
        // Show "start" - local countdown ended
        if (!startShownRef.current) {
          startShownRef.current = true;
          console.log("⏱️ Countdown: start");
          setDisplayValue("start");
          currentDisplayRef.current = "start";
          playStartSound();
        }
      } else {
        // Local visual countdown (5-4-3-2-1)
        const localSeconds = Math.ceil(localRemainingMs / 1000);
        const displaySeconds = Math.min(5, Math.max(1, localSeconds));
        
        if (currentDisplayRef.current !== displaySeconds && displaySeconds >= 1 && displaySeconds <= 5) {
          console.log("⏱️ Countdown:", displaySeconds);
          setDisplayValue(displaySeconds);
          currentDisplayRef.current = displaySeconds;
          
          // Play sound for this second
          if (!soundPlayedRef.current.has(displaySeconds)) {
            soundPlayedRef.current.add(displaySeconds);
            playCountdownSound();
          }
        }
      }
    }, 50); // 50ms interval for smoother updates

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
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
