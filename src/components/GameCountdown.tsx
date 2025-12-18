import { useEffect, useRef, memo, useState } from "react";
import { createPortal } from "react-dom";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  /** Server timestamp when countdown STARTS */
  serverStartTime?: string | null;
  /** Local offset to sync with server time */
  serverTimeOffset?: number;
}

// --- ASSET VE AUDIO YÖNETİMİ ---
const IMAGE_PATHS = ["/bes.png", "/dort.png", "/uc.png", "/iki.png", "/bir.png", "/basla.png"];
const preloadedImages: Map<string, HTMLImageElement> = new Map();
let imagesPreloaded = false;

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

const unlockAudio = () => {
  if (audioUnlocked) return;
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
};

if (typeof window !== "undefined") {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown'];
  const handleUnlock = () => {
    unlockAudio();
    unlockEvents.forEach(e => document.removeEventListener(e, handleUnlock));
  };
  unlockEvents.forEach(e => document.addEventListener(e, handleUnlock, { once: false, passive: true }));
}

const initAudioPool = () => {
  if (audioPoolInitialized || typeof window === "undefined") return;

  for (let i = 0; i < COUNTDOWN_SOUND_POOL_SIZE; i++) {
    const audio = new Audio();
    audio.src = "./gerisayim.mp3"; 
    audio.volume = 0.6;
    audio.preload = "auto";
    audio.load();
    countdownSoundPool.sounds.push(audio);
  }
  
  for (let i = 0; i < START_SOUND_POOL_SIZE; i++) {
    const audio = new Audio();
    audio.src = "./basla.mp3";
    audio.volume = 0.6;
    audio.preload = "auto";
    audio.load();
    startSoundPool.sounds.push(audio);
  }
  audioPoolInitialized = true;
};

const playFromPool = (pool: AudioPool) => {
  if (pool.sounds.length === 0) return;
  const audio = pool.sounds[pool.currentIndex];
  pool.currentIndex = (pool.currentIndex + 1) % pool.sounds.length;
  audio.currentTime = 0;
  audio.play().catch(() => unlockAudio());
};

const preloadPromise = typeof window !== "undefined" 
  ? Promise.all([
      ...IMAGE_PATHS.map((src) => new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => { preloadedImages.set(src, img); resolve(); };
          img.onerror = () => resolve();
          img.src = src;
        })),
      new Promise<void>((resolve) => { initAudioPool(); resolve(); })
    ]).then(() => { imagesPreloaded = true; })
  : Promise.resolve();

export const ensureImagesLoaded = () => preloadPromise;

const COUNTDOWN_DURATION_MS = 5000;
const START_DISPLAY_DURATION_MS = 800;

// --- ANA COMPONENT ---
const GameCountdown = memo(({ onComplete, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [displayValue, setDisplayValue] = useState<number | "start" | null>(null);
  
  // Debug için anlık farkı hesapla (Render sırasında)
  const debugNow = Date.now() + serverTimeOffset;
  const debugStartTime = serverStartTime ? new Date(serverStartTime).getTime() : 0;
  // Eğer pozitifse oyunun başlamasına daha var demektir. Negatifse geç kaldık demektir.
  const debugDiff = serverStartTime ? (debugStartTime - debugNow) : 0;

  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  const startShownRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const soundPlayedRef = useRef<Set<number | string>>(new Set());
  const lastDisplayRef = useRef<number | "start" | null>(null);

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

    // --- KRİTİK KONTROL ---
    // Sunucudan veri yoksa bekle. Legacy mod YOK.
    if (!serverStartTime) {
        console.log("⏳ GameCountdown: Sunucu saati bekleniyor (Veri null)...");
        return; 
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // Countdown bitişi = StartTime + 5sn
    const countdownEndTime = new Date(serverStartTime).getTime() + COUNTDOWN_DURATION_MS;
    
    const tick = () => {
      if (!mountedRef.current || completedRef.current) return;

      const serverNow = Date.now() + serverTimeOffset;
      const remaining = countdownEndTime - serverNow;
      
      // 1. Oyun Başladı
      if (remaining <= -START_DISPLAY_DURATION_MS) {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
        return;
      }
      
      // 2. "BAŞLA" Yazısı
      if (remaining <= 0) {
        if (!startShownRef.current) {
          startShownRef.current = true;
          setDisplayValue("start");
          lastDisplayRef.current = "start";
          if (!soundPlayedRef.current.has("start")) {
            soundPlayedRef.current.add("start");
            playStartSound();
          }
        }
      } 
      // 3. Geri Sayım (veya Buffer Beklemesi)
      else {
        const seconds = Math.ceil(remaining / 1000);
        // Eğer buffer yüzünden 20 saniye varsa bile en fazla 5 göster.
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
    
    setTimeout(() => {
      if (mountedRef.current && !completedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }, 50);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onComplete, serverStartTime, serverTimeOffset]);

  const getImageSrc = () => {
    if (displayValue === "start") return "/basla.png";
    if (displayValue === 5) return "/bes.png";
    if (displayValue === 4) return "/dort.png";
    if (displayValue === 3) return "/uc.png";
    if (displayValue === 2) return "/iki.png";
    if (displayValue === 1) return "/bir.png";
    return "/bes.png"; 
  };

  // Veri yoksa veya değer oluşmadıysa null (Debug panel için aşağıyı bekle)
  // Ama debug panelini görmek için return null yapmıyoruz, sadece resmi gizliyoruz.
  
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
        {/* --- DEBUG PANELİ BAŞLANGIÇ --- */}
        <div style={{
            position: 'absolute',
            top: '10%',
            left: '5%',
            right: '5%',
            padding: '10px',
            backgroundColor: 'black',
            border: '2px solid red',
            color: '#00FF00',
            fontFamily: 'monospace',
            fontSize: '14px',
            zIndex: 10000,
            pointerEvents: 'none'
        }}>
            <div><strong>DEBUG MODE</strong></div>
            <div>ServerStart (Raw): {serverStartTime || "YOK (NULL)"}</div>
            <div>Offset: {serverTimeOffset} ms</div>
            <div style={{ color: debugDiff < 0 ? 'red' : 'yellow' }}>
                FARK (Start - ŞuAn): {Math.round(debugDiff)} ms
            </div>
            <div>
                Durum: {debugDiff < 0 ? "⚠️ GEÇ KALINDI (Negatif)" : "✅ BEKLENİYOR (Pozitif)"}
            </div>
            <div>Display: {displayValue}</div>
        </div>
        {/* --- DEBUG PANELİ BİTİŞ --- */}

      {displayValue !== null && (
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
      )}
    </div>,
    document.body,
  );
});

GameCountdown.displayName = "GameCountdown";

export default GameCountdown;
