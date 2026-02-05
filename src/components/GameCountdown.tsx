import { useEffect, useRef, memo, useState } from "react";
import { createPortal } from "react-dom";
import { 
  initNativeAudio, 
  playNativeSound, 
  isNativePlatform,
  isNativeAudioReady
} from "@/services/nativeAudioService";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  /** Sunucudan gelen oyun BAŞLAMA zamanı (Timestamp string) */
  serverStartTime?: string | null;
  /** Sunucu ile istemci arasındaki saat farkı (ms) */
  serverTimeOffset?: number;
  /** Component key - rematch için yeni instance oluşturmak için */
  countdownKey?: string;
}

// 🔧 REFACTORED: Turnuva mantığıyla aynı - basit ve güvenilir
// serverStartTime = countdown'ın başlaması gereken sunucu zamanı
// countdownEndTime = serverStartTime + 5000ms
// remaining <= 0 olduğunda "BAŞLA" göster, 600ms sonra onComplete çağır

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

// Native Audio'yu başlat (App.tsx'te zaten başlatılıyor ama yedek olarak)
const initNativeCountdownAudio = async () => {
  if (!isNativePlatform()) return;
  if (nativeAudioReady) return;
  
  // Zaten hazırsa direkt kullan
  if (isNativeAudioReady()) {
    nativeAudioReady = true;
    console.log("✅ GameCountdown: Native Audio zaten hazır");
    return;
  }
  
  try {
    await initNativeAudio();
    nativeAudioReady = true;
    console.log("✅ GameCountdown: Native Audio hazır");
  } catch (e) {
    console.warn("GameCountdown: Native Audio başlatılamadı:", e);
  }
};

// Mobil tarayıcılar ve Capacitor için güçlendirilmiş ses kilidi açma
const unlockAudio = () => {
  if (audioUnlocked) return;
  
  // Native platform için Native Audio kullan
  if (isNativePlatform()) {
    initNativeCountdownAudio();
    audioUnlocked = true;
    return;
  }
  
  // Web için AudioContext oluştur ve resume et
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn("GameCountdown: AudioContext oluşturulamadı:", e);
    }
  }
  
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().then(() => {
      console.log("✅ GameCountdown: AudioContext resumed");
    }).catch(() => {});
  }
  
  // Tüm ses dosyalarını unlock et
  [...countdownSoundPool.sounds, ...startSoundPool.sounds].forEach(audio => {
    const originalVolume = audio.volume;
    audio.volume = 0.01;
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = originalVolume;
      console.log("✅ GameCountdown: Audio element unlocked");
    }).catch(() => {});
  });
  
  audioUnlocked = true;
  console.log("✅ GameCountdown: Audio unlocked");
};

// Event Listenerları ekle - Capacitor için genişletilmiş
if (typeof window !== "undefined") {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown', 'pointerdown', 'mousedown'];
  const handleUnlock = () => {
    unlockAudio();
    unlockEvents.forEach(e => document.removeEventListener(e, handleUnlock));
  };
  unlockEvents.forEach(e => document.addEventListener(e, handleUnlock, { passive: true }));
  
  // Native için erken başlat
  if (isNativePlatform()) {
    initNativeCountdownAudio();
  }
}

// Ses havuzunu başlat - Sadece Web için (Native Audio ayrı yönetiliyor)
const initAudioPool = () => {
  if (audioPoolInitialized || typeof window === "undefined") return;
  if (isNativePlatform()) {
    // Native'de HTML5 Audio kullanma, Native Audio kullan
    audioPoolInitialized = true;
    return;
  }

  // Web için Capacitor ortamında base URL'den yükle
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

// Ses çalma fonksiyonu - Native ve Web için ayrı yönetim
const playFromPool = async (pool: AudioPool, soundType: 'countdown' | 'start') => {
  // Native platform için Native Audio kullan
  if (isNativePlatform()) {
    try {
      await playNativeSound(soundType, soundType === 'countdown' ? 0.6 : 0.7);
      console.log(`🔊 GameCountdown: Native ${soundType} sesi çalındı`);
    } catch (e) {
      console.warn(`GameCountdown: Native ${soundType} sesi çalınamadı:`, e);
    }
    return;
  }
  
  // Web için HTML5 Audio
  if (pool.sounds.length === 0) return;
  
  // Her çalmadan önce unlock dene
  if (!audioUnlocked) {
    unlockAudio();
  }
  
  // AudioContext'i resume et
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  
  const audio = pool.sounds[pool.currentIndex];
  pool.currentIndex = (pool.currentIndex + 1) % pool.sounds.length;
  audio.currentTime = 0;
  audio.play().catch((e) => {
    console.warn("GameCountdown: Ses çalınamadı, unlock deneniyor:", e);
    unlockAudio();
  });
};

// Resim ve Sesleri Yükle
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

const COUNTDOWN_DURATION_MS = 5000; // Geri sayım süresi (5 saniye)
const START_DISPLAY_DURATION_MS = 600; // "BAŞLA" yazısının ekranda kalma süresi

// --- ANA COMPONENT ---
const GameCountdown = memo(({ onComplete, serverStartTime, serverTimeOffset = 0, countdownKey }: GameCountdownProps) => {
  const [displayValue, setDisplayValue] = useState<number | "start" | null>(null);
  
  // Refs
  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  const startShownRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const soundPlayedRef = useRef<Set<number | string>>(new Set());
  const lastDisplayRef = useRef<number | "start" | null>(null);
  const completeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownEndTimeRef = useRef<number | null>(null);

  const playCountdownSound = () => playFromPool(countdownSoundPool, 'countdown');
  const playStartSound = () => playFromPool(startSoundPool, 'start');

  useEffect(() => {
    mountedRef.current = true;
    completedRef.current = false;
    startShownRef.current = false;
    soundPlayedRef.current.clear();
    lastDisplayRef.current = null;
    countdownEndTimeRef.current = null;

    return () => {
      mountedRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
        completeTimeoutRef.current = null;
      }
    };
  }, []);

  // serverStartTime veya countdownKey değiştiğinde state'i sıfırla
  useEffect(() => {
    if (serverStartTime) {
      // Yeni countdown başlıyor - state'i sıfırla
      completedRef.current = false;
      startShownRef.current = false;
      soundPlayedRef.current.clear();
      lastDisplayRef.current = null;
      countdownEndTimeRef.current = null;
      setDisplayValue(null);
      
      if (completeTimeoutRef.current) {
        clearTimeout(completeTimeoutRef.current);
        completeTimeoutRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
  }, [serverStartTime, countdownKey]);

  useEffect(() => {
    if (completedRef.current) return;

    // Eğer sunucudan zaman bilgisi henüz gelmediyse HİÇBİR ŞEY YAPMA.
    if (!serverStartTime) {
      console.log("⏳ GameCountdown: Sunucudan başlama saati bekleniyor...");
      return; 
    }

    // Önceki döngüyü temizle
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }

    console.log("⏱️ GameCountdown: Server Modu Aktif. Başlama:", serverStartTime, "Offset:", serverTimeOffset);
    
    // 🔧 KRİTİK: serverStartTime = countdown'ın BAŞLAMASI gereken sunucu zamanı (buffer SONRASI)
    // Yani countdown (5-4-3-2-1) bu anda başlıyor
    // countdownEndTime = serverStartTime + 5000ms
    const countdownStartTime = new Date(serverStartTime).getTime();
    const countdownEndTime = countdownStartTime + COUNTDOWN_DURATION_MS;
    countdownEndTimeRef.current = countdownEndTime;
    
    console.log("🎯 GameCountdown timing:", {
      startTime: new Date(countdownStartTime).toISOString(),
      endTime: new Date(countdownEndTime).toISOString(),
      serverNow: new Date(Date.now() + serverTimeOffset).toISOString(),
    });
    
    const triggerComplete = () => {
      if (completedRef.current || !mountedRef.current) return;
      completedRef.current = true;
      console.log("🏁 Geri sayım tamamlandı, oyun başlıyor.");
      onComplete();
    };
    
    // Animasyon Döngüsü (Tick)
    const tick = () => {
      if (!mountedRef.current || completedRef.current) return;

      const serverNow = Date.now() + serverTimeOffset;
      const endTime = countdownEndTimeRef.current || countdownEndTime;
      const remaining = endTime - serverNow;
      
      if (remaining <= 0) {
        if (!startShownRef.current) {
          startShownRef.current = true;
          setDisplayValue("start");
          lastDisplayRef.current = "start";
          if (!soundPlayedRef.current.has("start")) {
            soundPlayedRef.current.add("start");
            playStartSound();
          }
          
          // 🔧 FIX: setTimeout ile güvenilir tamamlama - turnuva mantığıyla aynı
          completeTimeoutRef.current = setTimeout(() => {
            triggerComplete();
          }, START_DISPLAY_DURATION_MS);
        }
        return; // RAF döngüsünü durdur
      } 
      
      // 🔧 KRİTİK: Geri sayım devam ediyor - sunucu zamanına göre
      // serverStartTime zaten countdown'ın başlangıç zamanı (buffer SONRASI)
      // Dolayısıyla remaining = 5000ms'den başlayıp 0'a düşüyor
      const serverSeconds = Math.ceil(remaining / 1000);
      // 🔧 FIX: Değer her zaman 1-5 arasında olmalı
      const display = Math.min(5, Math.max(1, serverSeconds));
      
      if (lastDisplayRef.current !== display) {
        lastDisplayRef.current = display;
        setDisplayValue(display);
        console.log(`🔢 Countdown: ${display} (remaining: ${remaining}ms)`);
        
        if (!soundPlayedRef.current.has(display)) {
          soundPlayedRef.current.add(display);
          playCountdownSound();
        }
      }
      
      rafRef.current = requestAnimationFrame(tick);
    };
    
    // İlk tick'i hemen başlat
    const serverNowInitial = Date.now() + serverTimeOffset;
    const remainingInitial = countdownEndTime - serverNowInitial;
    
    // 🔧 FIX: Countdown zaten bitmiş mi kontrol et
    if (remainingInitial <= 0) {
      console.log("⚡ GameCountdown: Countdown zaten bitmiş, direkt tamamlanıyor");
      setDisplayValue("start");
      if (!soundPlayedRef.current.has("start")) {
        soundPlayedRef.current.add("start");
        playStartSound();
      }
      completeTimeoutRef.current = setTimeout(() => {
        triggerComplete();
      }, 300);
      return;
    }
    
    // 🔧 KRİTİK: İlk değeri göster - sunucu zamanına göre hesapla
    // remaining 5000ms civarından başlamalı (buffer zaten geçmiş)
    const initialSeconds = Math.ceil(remainingInitial / 1000);
    // 🔧 FIX: Her zaman 5'ten başla ama geç katılımda kalan süreden devam et
    const displayInitial = Math.min(5, Math.max(1, initialSeconds));
    
    setDisplayValue(displayInitial);
    lastDisplayRef.current = displayInitial;
    console.log(`🔢 Countdown başlangıç: ${displayInitial} (remaining: ${remainingInitial}ms)`);
    
    if (!soundPlayedRef.current.has(displayInitial)) {
      soundPlayedRef.current.add(displayInitial);
      playCountdownSound();
    }
    
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
    };
  }, [onComplete, serverStartTime, serverTimeOffset, countdownKey]);

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
});

GameCountdown.displayName = "GameCountdown";

export default GameCountdown;
