import { useEffect, useRef, memo, useState } from "react";
import { createPortal } from "react-dom";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  /** Sunucudan gelen oyun BAŞLAMA zamanı (Timestamp string) */
  serverStartTime?: string | null;
  /** Sunucu ile istemci arasındaki saat farkı (ms) */
  serverTimeOffset?: number;
}

// --- ASSET YÖNETİMİ (PRELOAD) ---
const IMAGE_PATHS = ["/bes.png", "/dort.png", "/uc.png", "/iki.png", "/bir.png", "/basla.png"];
const preloadedImages: Map<string, HTMLImageElement> = new Map();
let imagesPreloaded = false;

// --- SES YÖNETİMİ (AUDIO POOL) ---
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

// Mobil tarayıcılar ve Capacitor için güçlendirilmiş ses kilidi açma
const unlockAudio = () => {
  if (audioUnlocked) return;
  
  // AudioContext oluştur ve resume et
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
}

// Ses havuzunu başlat - Capacitor için absolute path kullan
const initAudioPool = () => {
  if (audioPoolInitialized || typeof window === "undefined") return;

  // Capacitor ortamında base URL'den yükle
  const basePath = window.location.origin;
  
  for (let i = 0; i < COUNTDOWN_SOUND_POOL_SIZE; i++) {
    const audio = new Audio();
    // Hem web hem Capacitor için çalışacak şekilde
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

// Ses çalma fonksiyonu - Mobil için güçlendirilmiş
const playFromPool = (pool: AudioPool) => {
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
const START_DISPLAY_DURATION_MS = 800; // "BAŞLA" yazısının ekranda kalma süresi

// --- ANA COMPONENT ---
const GameCountdown = memo(({ onComplete, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [displayValue, setDisplayValue] = useState<number | "start" | null>(null);
  
  // Refs
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

    // Eğer sunucudan zaman bilgisi henüz gelmediyse HİÇBİR ŞEY YAPMA.
    // Legacy (Client-side) modu tamamen kaldırdık.
    // Bu sayede SQL Buffer'dan gelen ileri tarihi beklemek ZORUNDA kalır.
    if (!serverStartTime) {
        console.log("⏳ GameCountdown: Sunucudan başlama saati bekleniyor...");
        return; 
    }

    // Önceki döngüyü temizle
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    console.log("⏱️ GameCountdown: Server Modu Aktif. Başlama:", serverStartTime, "Offset:", serverTimeOffset);
    
    // Geri sayımın BİTİŞ zamanı = Başlama Zamanı + 5 Saniye
    const countdownEndTime = new Date(serverStartTime).getTime() + COUNTDOWN_DURATION_MS;
    
    // Animasyon Döngüsü (Tick)
    const tick = () => {
      if (!mountedRef.current || completedRef.current) return;

      const serverNow = Date.now() + serverTimeOffset;
      const remaining = countdownEndTime - serverNow;
      
      // 1. Durum: Süre tamamen bitti ("Başla" yazısı da kalkmalı)
      if (remaining <= -START_DISPLAY_DURATION_MS) {
        if (!completedRef.current) {
          completedRef.current = true;
          console.log("🏁 Geri sayım tamamlandı, oyun başlıyor.");
          onComplete();
        }
        return;
      }
      
      // 2. Durum: Süre doldu, "BAŞLA!" göster
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
      // 3. Durum: Geri sayım devam ediyor (veya tampon süresindeyiz)
      else {
        const seconds = Math.ceil(remaining / 1000);
        
        // Burası kritik: Eğer SQL'den +20sn geldiyse 'seconds' 15-20 arası çıkabilir.
        // Math.min(5, ...) sayesinde ekranda hep "5" görürüz.
        const display = Math.min(5, Math.max(1, seconds));
        
        // Ekrana basma işlemi (Gereksiz render önleme)
        if (lastDisplayRef.current !== display) {
          lastDisplayRef.current = display;
          setDisplayValue(display);
          
          // Ses çalma (sadece rakam değişince)
          if (!soundPlayedRef.current.has(display)) {
            soundPlayedRef.current.add(display);
            playCountdownSound();
          }
        }
      }
      
      rafRef.current = requestAnimationFrame(tick);
    };
    
    // İlk render'ın oturması için minik bir gecikme ile başlat
    setTimeout(() => {
      if (mountedRef.current && !completedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }, 50);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
});

GameCountdown.displayName = "GameCountdown";

export default GameCountdown;
