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

const getCountdownPhase = (now: number, startTime: number): number | "start" | null => {
  const msUntilStart = startTime - now;

  if (msUntilStart > 1000) {
    return null;
  }

  if (msUntilStart > 0) {
    return 5;
  }

  const elapsedSeconds = (now - startTime) / 1000;

  if (elapsedSeconds >= 5) {
    return "start";
  }

  return Math.min(5, Math.max(1, Math.ceil(5 - elapsedSeconds)));
};

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
    
    // 🔒 GEÇ MOUNT GARANTİSİ: 5'in mutlaka gösterilmesini sağla
    const hasShown5Ref = useRef(false);
    const forced5StartTimeRef = useRef<number>(0);
    const MIN_DISPLAY_MS = 950; // Her sayı en az 950ms gösterilmeli (doğal hız)
    const CATCHUP_DISPLAY_MS = 220; // ⚡ Sunucudan geride kalındıysa hızlı yakalama modu
    const lastValueChangeTimeRef = useRef<number>(0);
    const hardDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      currentValueRef.current = 0;
      hasShown5Ref.current = false;
      forced5StartTimeRef.current = 0;
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
      currentValueRef.current = 0;
      hasShown5Ref.current = false;
      forced5StartTimeRef.current = 0;
      lastValueChangeTimeRef.current = 0;
      hasInitializedRef.current = true;

      const startTime = new Date(serverStartTime).getTime();
      const serverNow = Date.now() + serverTimeOffset;
      const timeDiff = startTime - serverNow;

      console.log(`⏱️ [${instanceId}] Timing check: startTime=${startTime}, serverNow=${serverNow}, diff=${timeDiff}ms`);

      // Tolerans kontrolü: 5 saniyeden fazla geçmişse hemen bitir
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

      // 🎯 SERVER-ANCHORED COUNTDOWN with GUARANTEED 5 START
      const startCountdownAnchored = () => {
        console.log(`🔢 [${instanceId}] Server-anchored countdown başlıyor! startTime=${startTime}`);

        // 🎵 Maça başlarken SADECE radyo fade-out edilir.
        // Arka plan müziği (floating menüden açıksa) çalmaya devam eder.
        // Oyuncu isterse maç ekranındaki 3 kademeli ses düğmesiyle kapatabilir.
        if (!musicFadedRef.current) {
          musicFadedRef.current = true;
          const radioOn = !!(window as any).__radioIsPlaying;
          if (radioOn) {
            try { fadeOutBackgroundMusic(1800); } catch {}
          }
        }

        // 🔒 MUTLAKA 5'İ GÖSTER - geç mount olsa bile
        if (!hasShown5Ref.current) {
          hasShown5Ref.current = true;
          forced5StartTimeRef.current = Date.now();
          lastValueChangeTimeRef.current = Date.now();
          currentValueRef.current = 5;
          setDisplayValue(5);
          console.log(`🔒 [${instanceId}] 5 ZORLA gösterildi (geç mount garantisi)`);
          if (!soundPlayedRef.current.has(5)) {
            soundPlayedRef.current.add(5);
            playCountdownSound();
          }
        }

        // Tick fonksiyonu: sunucu zamanına göre hangi sayıda olmalıyız?
        // 🔒 SIRALIK GARANTİ: Asla sayı atlamaz, her sayı MIN_DISPLAY_MS gösterilir
        const tick = () => {
          if (!mountedRef.current || completedRef.current) {
            cleanupAllTimers();
            return;
          }

          const now = Date.now() + serverTimeOffset;
          const phase = getCountdownPhase(now, startTime);

          if (phase === null) {
            // Henüz başlamadı, 5'i göstermeye devam et
            return;
          }

          // 🔒 Mevcut sayının minimum gösterim süresi kontrolü
          // ⚡ CATCH-UP: Sunucu zamanı bizden ilerideyse (geç mount / gecikmeli paket)
          // minimum gösterim süresini kısaltıp sayıları hızlandırarak START_AT'i yakalarız.
          const isBehind = typeof phase === "number" ? phase < currentValueRef.current - 1 : true;
          const effectiveMinDisplay = isBehind ? CATCHUP_DISPLAY_MS : MIN_DISPLAY_MS;
          const timeSinceLastChange = Date.now() - lastValueChangeTimeRef.current;
          if (timeSinceLastChange < effectiveMinDisplay) {
            // Mevcut sayı hala minimum süresini doldurmadı, bekle
            return;
          }

          if (typeof phase === "number") {
            // 🔒 SIRALIK SAYIM: Sadece 1 azalt (5→4→3→2→1), asla atlama
            const nextValue = currentValueRef.current - 1;
            
            if (nextValue >= 1 && nextValue < currentValueRef.current) {
              // Sunucu zamanı bu sayıya ulaştı mı veya geçti mi kontrol et
              if (phase <= nextValue) {
                currentValueRef.current = nextValue;
                lastValueChangeTimeRef.current = Date.now();
                console.log(`🔢 [${instanceIdRef.current}] ${nextValue} (serverPhase=${phase}, startDiff=${startTime - now}ms)`);
                setDisplayValue(nextValue);
                if (!soundPlayedRef.current.has(nextValue)) {
                  soundPlayedRef.current.add(nextValue);
                  playCountdownSound();
                }
              }
            }
          } else {
            // Sunucu "start" diyor - ama önce kalan sayıları göster
            const nextValue = currentValueRef.current - 1;
            if (nextValue >= 1) {
              // Hala gösterilmemiş sayılar var, hızlıca göster
              currentValueRef.current = nextValue;
              lastValueChangeTimeRef.current = Date.now();
              setDisplayValue(nextValue);
              if (!soundPlayedRef.current.has(nextValue)) {
                soundPlayedRef.current.add(nextValue);
                playCountdownSound();
              }
              return; // Henüz start'a geçme
            }
            
            // BAŞLA!
            if (!soundPlayedRef.current.has("start")) {
              console.log(`🏁 [${instanceIdRef.current}] BAŞLA!`);
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

        // İlk tick'i minimum gösterim süresinden sonra başlat
        const now = Date.now() + serverTimeOffset;
        const elapsed = now - startTime;
        
        // Eğer zaten geçmiş zaman varsa (geç mount), 5'i gösterdikten sonra hızlıca yakala
        if (elapsed > 0) {
          console.log(`⚡ [${instanceId}] Geç mount: ${elapsed}ms geçmiş, 5 gösterildikten sonra yakalanacak`);
        }

        // MIN_DISPLAY_MS sonra tick'leri başlat (5'in gösterilmesini garanti et)
        const delayBeforeTicks = Math.max(0, MIN_DISPLAY_MS - (Date.now() - forced5StartTimeRef.current));
        
        setTimeout(() => {
          if (!mountedRef.current || completedRef.current) return;
          tick(); // İlk tick
          intervalRef.current = setInterval(tick, 100);
        }, delayBeforeTicks);

        // 🔒 HARD DEADLINE: Oyun HER CİHAZDA mutlak sunucu anında başlar.
        // Görsel sayım gecikse bile START_AT geldiğinde "BAŞLA" zorlanır ve onComplete tetiklenir.
        const HARD_GRACE_MS = 350;
        const msUntilHardEnd = startTime + 5000 - (Date.now() + serverTimeOffset);
        if (hardDeadlineRef.current) clearTimeout(hardDeadlineRef.current);
        hardDeadlineRef.current = setTimeout(() => {
          if (!mountedRef.current || completedRef.current) return;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (!soundPlayedRef.current.has("start")) {
            console.log(`🏁 [${instanceId}] HARD DEADLINE - BAŞLA zorlandı (server anchor)`);
            soundPlayedRef.current.add("start");
            setDisplayValue("start");
            playStartSound();
          }
          if (!completeTimeoutRef.current) {
            completeTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current && !completedRef.current) {
                completedRef.current = true;
                onComplete();
              }
            }, HARD_GRACE_MS);
          }
        }, Math.max(0, msUntilHardEnd));
      };

      // Son 1 saniyeye girdiysek hemen 5'i göster, daha erkense son saniyede başlat
      if (timeDiff <= 1000) {
        console.log(`⚡ [${instanceId}] Hemen başlıyor (timeDiff=${timeDiff}ms)`);
        startCountdownAnchored();
      } else {
        // Lead-up: Erken mount durumunda bekleme
        console.log(`⏳ [${instanceId}] ${timeDiff - 1000}ms bekleyip son saniyede başlayacak`);
        startTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current && !completedRef.current) {
            startCountdownAnchored();
          }
        }, timeDiff - 1000);
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
