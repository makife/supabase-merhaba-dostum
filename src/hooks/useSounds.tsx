import { useEffect, useRef, useState, useCallback } from "react";
import { useThemeContext } from "@/components/ThemeProvider";
import { Capacitor } from '@capacitor/core';
import { 
  initNativeAudio, 
  playNativeSound, 
  playSpecialNativeSound, 
  isNativePlatform,
  isNativeAudioReady
} from "@/services/nativeAudioService";

interface SoundConfig {
  buttonClick: string;
  correctWord: string;
  wrongWord: string;
  gameWin: string;
  gameLose: string;
  timeWarning: string;
  letterSelect: string;
  celebration: string;
  gameLoseSound: string;
  tieSound: string;
}

interface SoundPack {
  id: string;
  name: string;
  sounds: SoundConfig;
}

// 🔓 Mobile audio unlock state - Capacitor için güçlendirilmiş
let globalAudioUnlocked = false;
let globalAudioContext: AudioContext | null = null;
let nativeAudioInitialized = false;

const unlockGlobalAudio = () => {
  if (globalAudioUnlocked) return;
  
  // Native platform için Native Audio kullan
  // Not: initNativeAudio zaten App.tsx'te await ile çağrılıyor
  // Burada sadece tetikleme yapmak yeterli, zaten singleton pattern ile çalışıyor
  if (isNativePlatform() && !nativeAudioInitialized) {
    // Eğer henüz hazır değilse başlat
    if (!isNativeAudioReady()) {
      initNativeAudio().then(() => {
        nativeAudioInitialized = true;
        console.log("✅ useSounds: Native Audio initialized");
      });
    } else {
      nativeAudioInitialized = true;
      console.log("✅ useSounds: Native Audio already ready");
    }
  }
  
  // AudioContext oluştur ve resume et
  if (!globalAudioContext) {
    try {
      globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn("AudioContext oluşturulamadı:", e);
    }
  }
  
  if (globalAudioContext && globalAudioContext.state === 'suspended') {
    globalAudioContext.resume().then(() => {
      console.log("✅ useSounds: AudioContext resumed");
    }).catch(() => {});
  }
  
  // Web için sessiz bir ses çalarak mobil kilidi aç
  if (!isNativePlatform()) {
    try {
      const silentAudio = new Audio();
      silentAudio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+9DEAAAIAANIAAAASCgZoIAAAAQAAANIAAAAP/7UMQAAAgYA0gAAAAJIANIAAAABEREREREREf/+1DEAAAIGANIAAAACSADTAAAABERERERERH//tQxAAACCgDSAAAAAlAA0gAAAAEREREREREf/7UMQAAAQYA0gAAAABJABpAAAABEREREREREQAAAAA//tQxAAABAADSAAAAAAAANIAAAAAAAAAAAAAAAAA//sQxAAABAADSAAAAAAAANIAAAAAAAAA//sQxAAAAwADSAAAAAAAANIAAAAAAAAA";
      silentAudio.volume = 0.01;
      silentAudio.play().then(() => {
        silentAudio.pause();
        console.log("✅ useSounds: Silent audio played for unlock");
      }).catch(() => {});
    } catch (e) {}
  }
  
  globalAudioUnlocked = true;
  console.log("✅ useSounds: Global audio unlocked");
};

// Kullanıcı etkileşimi dinleyicileri - Capacitor için genişletilmiş
if (typeof window !== "undefined") {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown', 'pointerdown', 'mousedown'];
  const handleUnlock = () => {
    unlockGlobalAudio();
    // İlk unlock sonrası listener'ları kaldır
    unlockEvents.forEach(e => document.removeEventListener(e, handleUnlock));
  };
  // Passive: true ile performans artışı
  unlockEvents.forEach(e => document.addEventListener(e, handleUnlock, { passive: true }));
}

export const useSounds = () => {
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const { soundPack } = useThemeContext();
  const audioCache = useRef<Map<string, HTMLAudioElement[]>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);

  // DÜZELTME: Sound packs'i ref ile sabitle
  const soundPacksRef = useRef<Record<string, SoundPack>>({
    default: {
      id: "default",
      name: "Varsayılan",
      sounds: {
        buttonClick: "sounds/default/button-click.mp3",
        correctWord: "sounds/default/correct-word.mp3",
        wrongWord: "sounds/default/wrong-word.mp3",
        gameWin: "generated", // Generated ses olarak işaretle
        gameLose: "generated",
        timeWarning: "generated",
        letterSelect: "generated",
        celebration: "sounds/default/kutlama.mp3",
        gameLoseSound: "sounds/default/kaybetme.mp3",
        tieSound: "sounds/default/beraberlik.mp3",
      },
    },
    space: {
      id: "space",
      name: "Uzay",
      sounds: {
        buttonClick: "sounds/space/button-click.mp3",
        correctWord: "sounds/space/correct-word.mp3",
        wrongWord: "generated",
        gameWin: "generated",
        gameLose: "generated",
        timeWarning: "generated",
        letterSelect: "generated",
        celebration: "sounds/default/kutlama.mp3",
        gameLoseSound: "sounds/default/kaybetme.mp3",
        tieSound: "sounds/default/beraberlik.mp3",
      },
    },
    nature: {
      id: "nature",
      name: "Doğa",
      sounds: {
        buttonClick: "sounds/nature/button-click.mp3",
        correctWord: "sounds/nature/correct-word.mp3",
        wrongWord: "generated",
        gameWin: "generated",
        gameLose: "generated",
        timeWarning: "generated",
        letterSelect: "generated",
        celebration: "sounds/default/kutlama.mp3",
        gameLoseSound: "sounds/default/kaybetme.mp3",
        tieSound: "sounds/default/beraberlik.mp3",
      },
    },
  });

  // DÜZELTME: Settings yükleme fonksiyonunu stabilize et
  const loadSettings = useCallback(() => {
    try {
      const settings = JSON.parse(localStorage.getItem("kelimeci-settings") || "{}");
      setSoundsEnabled(settings.sounds ?? true);
    } catch (error) {
      console.warn("Failed to load sound settings:", error);
    }
  }, []);

  // Load settings from localStorage and listen for changes
  useEffect(() => {
    loadSettings();

    // Listen for storage changes from other components
    const handleStorageChange = () => loadSettings();
    window.addEventListener("storage", handleStorageChange);

    // Listen for custom event when settings change
    window.addEventListener("settingsChanged", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("settingsChanged", handleStorageChange);
    };
  }, [loadSettings]);

  // DÜZELTME: Audio utility fonksiyonlarını useCallback ile stabilize et
  const createAudioPool = useCallback((soundPath: string, poolSize: number = 3): HTMLAudioElement[] => {
    const pool: HTMLAudioElement[] = [];
    // Capacitor için absolute path kullan - başındaki slash'i kaldır
    const basePath = window.location.origin;
    const cleanPath = soundPath.startsWith('/') ? soundPath.slice(1) : soundPath;
    const fixedPath = `${basePath}/${cleanPath}`;
    
    for (let i = 0; i < poolSize; i++) {
      const audio = new Audio();
      audio.src = fixedPath;
      audio.preload = "auto";
      audio.volume = 0.7;
      audio.onerror = () => {
        console.warn(`Could not load sound: ${fixedPath}`);
      };
      pool.push(audio);
    }
    return pool;
  }, []);

  // 🔓 Unlock audio for mobile - ses çalmadan önce çağır
  const unlockAudioForMobile = useCallback(() => {
    // Global unlock'u tetikle
    unlockGlobalAudio();
    
    if (audioUnlockedRef.current && globalAudioUnlocked) return;
    
    // AudioContext'i resume et (hem local hem global)
    const ctx = audioContextRef.current || globalAudioContext;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    
    audioUnlockedRef.current = true;
    console.log("✅ useSounds: Audio unlocked for mobile");
  }, []);

  // Get available audio from pool
  const getAvailableAudio = useCallback((audioPool: HTMLAudioElement[]): HTMLAudioElement | null => {
    // En eski çalan ses dosyasını bul
    for (const audio of audioPool) {
      if (audio.paused || audio.ended || audio.currentTime === 0) {
        return audio;
      }
    }
    // Hepsi çalıyorsa ilkini kullan (kesip yeniden başlat)
    return audioPool[0] || null;
  }, []);

  // Initialize audio context
  const getAudioContext = useCallback((): AudioContext | null => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn("Could not create audio context:", error);
        return null;
      }
    }
    
    // Mobile için AudioContext'i resume et
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    
    return audioContextRef.current;
  }, []);

  // Aktif ses paketini al
  const getActiveSoundPack = useCallback((): SoundPack => {
    return soundPacksRef.current[soundPack] || soundPacksRef.current.default;
  }, [soundPack]);

  // DÜZELTME: Audio cache update'i stabilize et
  // ⚠️ Native platformda HTML5 Audio kullanma - NativeAudio zaten çalışıyor
  useEffect(() => {
    // Native platformda HTML5 Audio pool oluşturma - NativeAudio kullanılacak
    if (isNativePlatform()) {
      console.log("🔊 useSounds: Native platform - HTML5 Audio pool atlanıyor, NativeAudio kullanılacak");
      return;
    }
    
    const activePack = getActiveSoundPack();

    // Cache'i temizle
    audioCache.current.clear();

    // Sadece özel ses dosyalarını yükle (kutlama, kaybetme, arka plan müziği)
    const specialSounds = ["celebration", "gameLoseSound", "tieSound"];
    specialSounds.forEach((key) => {
      const soundPath = activePack.sounds[key as keyof SoundConfig];
      if (typeof soundPath === "string" && !soundPath.startsWith("generated")) {
        try {
          audioCache.current.set(key, createAudioPool(soundPath, 3));
        } catch (error) {
          console.warn(`Failed to load sound ${key}:`, error);
        }
      }
    });
    
    // ✅ Özel sesler için audio pool oluştur (yes, wow, yahoo, joker sesleri) - WEB ONLY
    try {
      audioCache.current.set('special_yes', createAudioPool('yes.mp3', 5));
      audioCache.current.set('special_wow', createAudioPool('wow2.mp3', 5));
      audioCache.current.set('special_yahoo', createAudioPool('yahoo.mp3', 5));
      audioCache.current.set('special_wow1', createAudioPool('wow1.mp3', 3));
      // Joker sesleri
      audioCache.current.set('joker_degistir', createAudioPool('degistir.mp3', 3));
      audioCache.current.set('joker_fisilda', createAudioPool('fisilda.mp3', 3));
      audioCache.current.set('joker_senyaz', createAudioPool('senyaz.mp3', 3));
      // Sampiyon sesi
      audioCache.current.set('special_sampiyon', createAudioPool('sampiyon.mp3', 2));
      // Çark sesi
      audioCache.current.set('special_cark', createAudioPool('carkSesi.mp3', 2));
    } catch (error) {
      console.warn('Failed to load special sound pools:', error);
    }
  }, [soundPack, getActiveSoundPack, createAudioPool]);

  // DÜZELTME: Generated sound fonksiyonlarını useCallback ile stabilize et
  const playGeneratedSound = useCallback(
    (frequency: number, duration: number, type: OscillatorType = "sine") => {
      if (!soundsEnabled) return;

      // 🔓 Mobil için unlock - AudioContext kullanmadan önce
      unlockAudioForMobile();

      try {
        const audioContext = getAudioContext();
        if (!audioContext) return;

        // Resume context if suspended (mobile requirement)
        if (audioContext.state === "suspended") {
          audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);

        // Cleanup
        oscillator.onended = () => {
          oscillator.disconnect();
          gainNode.disconnect();
        };
      } catch (error) {
        console.warn("Could not play generated sound:", error);
      }
    },
    [soundsEnabled, getAudioContext, unlockAudioForMobile],
  );

  // 🎵 Yumuşak & Modern native tap/pop sesi - iOS/Android hissi
  const playSoftPopSound = useCallback(() => {
    if (!soundsEnabled) return;
    unlockAudioForMobile();

    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();

      const t = ctx.currentTime;

      // Layer 1: Soft pop body (sine, ~900Hz, hızlı decay)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(900, t);
      osc1.frequency.exponentialRampToValueAtTime(400, t + 0.06);
      gain1.gain.setValueAtTime(0, t);
      gain1.gain.linearRampToValueAtTime(0.12, t + 0.003);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t);
      osc1.stop(t + 0.1);

      // Layer 2: High-frequency click transient (kısa, keskin)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(3500, t);
      osc2.frequency.exponentialRampToValueAtTime(1200, t + 0.02);
      gain2.gain.setValueAtTime(0, t);
      gain2.gain.linearRampToValueAtTime(0.06, t + 0.001);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t);
      osc2.stop(t + 0.05);

      // Layer 3: Noise burst (dokunuş hissi)
      const bufferSize = ctx.sampleRate * 0.02;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * 0.3;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(4000, t);
      noiseFilter.Q.setValueAtTime(2, t);
      noiseGain.gain.setValueAtTime(0.04, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start(t);
      noiseSource.stop(t + 0.02);

      // Cleanup
      osc1.onended = () => { osc1.disconnect(); gain1.disconnect(); };
      osc2.onended = () => { osc2.disconnect(); gain2.disconnect(); };
      noiseSource.onended = () => { noiseSource.disconnect(); noiseFilter.disconnect(); noiseGain.disconnect(); };
    } catch (error) {
      console.warn("Could not play soft pop sound:", error);
    }
  }, [soundsEnabled, getAudioContext, unlockAudioForMobile]);

  // DÜZELTME: playSound fonksiyonunu stabilize et
  const playSound = useCallback(
    async (soundKey: keyof SoundConfig) => {
      if (!soundsEnabled) return;

      // 🔓 Mobil için her ses çalmadan önce unlock dene
      unlockAudioForMobile();

      const activePack = getActiveSoundPack();

      try {
        // Önce MP3 dosyası var mı kontrol et
        const audioPool = audioCache.current.get(soundKey);
        if (audioPool && audioPool.length > 0) {
          const availableAudio = getAvailableAudio(audioPool);
          if (availableAudio && availableAudio.src && !availableAudio.src.includes("undefined")) {
            availableAudio.currentTime = 0;
            await availableAudio.play().catch(() => unlockAudioForMobile());
            return;
          }
        }

        // MP3 bulunamazsa tema-specific generated sound kullan
        switch (activePack.id) {
          case "space":
            switch (soundKey) {
              case "buttonClick":
                playSoftPopSound();
                break;
              case "correctWord":
                setTimeout(() => playGeneratedSound(800, 0.1, "square"), 0);
                setTimeout(() => playGeneratedSound(1200, 0.1, "square"), 100);
                setTimeout(() => playGeneratedSound(1600, 0.2, "square"), 200);
                break;
              case "wrongWord":
                playGeneratedSound(120, 0.8, "square");
                break;
              case "gameWin":
                setTimeout(() => playGeneratedSound(1000, 0.2, "square"), 0);
                setTimeout(() => playGeneratedSound(1500, 0.2, "square"), 200);
                setTimeout(() => playGeneratedSound(2000, 0.3, "square"), 400);
                setTimeout(() => playGeneratedSound(2500, 0.4, "square"), 600);
                break;
              case "gameLose":
                playGeneratedSound(60, 2.0, "sawtooth");
                break;
              case "timeWarning":
                playGeneratedSound(1800, 0.12, "square");
                break;
              case "letterSelect":
                playGeneratedSound(1500, 0.03, "square");
                break;
            }
            break;
          case "nature":
            switch (soundKey) {
              case "buttonClick":
                playSoftPopSound();
                break;
              case "correctWord":
                setTimeout(() => playGeneratedSound(600, 0.08, "triangle"), 0);
                setTimeout(() => playGeneratedSound(800, 0.08, "triangle"), 80);
                setTimeout(() => playGeneratedSound(1000, 0.12, "triangle"), 160);
                break;
              case "wrongWord":
                playGeneratedSound(200, 0.7, "triangle");
                break;
              case "gameWin":
                setTimeout(() => playGeneratedSound(800, 0.15, "triangle"), 0);
                setTimeout(() => playGeneratedSound(1200, 0.15, "triangle"), 150);
                setTimeout(() => playGeneratedSound(900, 0.15, "triangle"), 300);
                setTimeout(() => playGeneratedSound(1400, 0.2, "triangle"), 450);
                setTimeout(() => playGeneratedSound(1100, 0.25, "triangle"), 650);
                break;
              case "gameLose":
                playGeneratedSound(150, 1.5, "sine");
                break;
              case "timeWarning":
                playGeneratedSound(1000, 0.3, "triangle");
                break;
              case "letterSelect":
                playGeneratedSound(600, 0.1, "triangle");
                break;
            }
            break;
          default: // default paketi
            switch (soundKey) {
              case "buttonClick":
                playSoftPopSound();
                break;
              case "correctWord":
                playGeneratedSound(1200, 0.3);
                break;
              case "wrongWord":
                playGeneratedSound(300, 0.5);
                break;
              case "gameWin":
                playGeneratedSound(1600, 0.8);
                break;
              case "gameLose":
                playGeneratedSound(200, 1.0);
                break;
              case "timeWarning":
                playGeneratedSound(1000, 0.2);
                break;
              case "letterSelect":
                playGeneratedSound(600, 0.1);
                break;
            }
        }
      } catch (error) {
        console.warn("Could not play sound:", error);
      }
    },
    [soundsEnabled, getActiveSoundPack, getAvailableAudio, playGeneratedSound, unlockAudioForMobile],
  );

  // Süre azalıyor sesi - 30 saniyeye gelince fade-out ile çalar
  const timeWarningAudioRef = useRef<HTMLAudioElement | null>(null);
  const timeWarningFadeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playTimeWarningSequence = useCallback(() => {
    if (!soundsEnabled) return;

    // 🔓 Mobil için unlock
    unlockAudioForMobile();

    // Önceki varsa temizle
    if (timeWarningFadeRef.current) {
      clearInterval(timeWarningFadeRef.current);
      timeWarningFadeRef.current = null;
    }
    if (timeWarningAudioRef.current) {
      timeWarningAudioRef.current.pause();
      timeWarningAudioRef.current = null;
    }

    try {
      const basePath = window.location.origin;
      const audio = new Audio(`${basePath}/sureAzaliyor.mp3`);
      audio.volume = 0.7;
      timeWarningAudioRef.current = audio;

      audio.play().then(() => {
        // Fade-out: her 500ms'de volume azalt
        const fadeInterval = setInterval(() => {
          if (!timeWarningAudioRef.current) {
            clearInterval(fadeInterval);
            return;
          }
          const newVol = timeWarningAudioRef.current.volume - 0.05;
          if (newVol <= 0) {
            timeWarningAudioRef.current.pause();
            timeWarningAudioRef.current = null;
            clearInterval(fadeInterval);
            timeWarningFadeRef.current = null;
          } else {
            timeWarningAudioRef.current.volume = newVol;
          }
        }, 500);
        timeWarningFadeRef.current = fadeInterval;
      }).catch(err => {
        console.warn("sureAzaliyor.mp3 çalınamadı:", err);
      });
    } catch (err) {
      console.warn("sureAzaliyor.mp3 error:", err);
    }
  }, [soundsEnabled, unlockAudioForMobile]);

  const playCelebrationSound = useCallback(async () => {
    if (!soundsEnabled) return;

    // 🔓 Mobil için unlock
    unlockAudioForMobile();

    // 🎵 Native platform için Native Audio kullan
    if (isNativePlatform()) {
      const played = await playNativeSound('celebration', 0.6);
      if (played) {
        console.log("🔊 useSounds: Native kutlama sesi çalındı");
        return;
      }
    }

    const activePack = getActiveSoundPack();
    const soundPath = activePack.sounds.celebration;
    // Capacitor için absolute path kullan
    const basePath = window.location.origin;
    const fixedPath = soundPath.startsWith('/') ? `${basePath}${soundPath}` : soundPath;

    try {
      const audio = new Audio(fixedPath);
      audio.volume = 0.6;
      audio.play().catch((error) => {
        console.warn("Could not play celebration sound:", error);
        unlockAudioForMobile();
      });
    } catch (error) {
      console.warn("Could not load celebration sound:", error);
    }
  }, [soundsEnabled, getActiveSoundPack, unlockAudioForMobile]);

  const playGameLoseSound = useCallback(async () => {
    if (!soundsEnabled) return;

    // 🔓 Mobil için unlock
    unlockAudioForMobile();

    // 🎵 Native platform için Native Audio kullan
    if (isNativePlatform()) {
      const played = await playNativeSound('game_lose', 0.6);
      if (played) {
        console.log("🔊 useSounds: Native kaybetme sesi çalındı");
        return;
      }
    }

    const activePack = getActiveSoundPack();
    const soundPath = activePack.sounds.gameLoseSound;
    // Capacitor için absolute path kullan
    const basePath = window.location.origin;
    const fixedPath = soundPath.startsWith('/') ? `${basePath}${soundPath}` : soundPath;

    try {
      const audio = new Audio(fixedPath);
      audio.volume = 0.6;
      audio.play().catch((error) => {
        console.warn("Could not play game lose sound:", error);
        unlockAudioForMobile();
      });
    } catch (error) {
      console.warn("Could not load game lose sound:", error);
    }
  }, [soundsEnabled, getActiveSoundPack, unlockAudioForMobile]);

  const playTieSound = useCallback(async () => {
    if (!soundsEnabled) return;

    // 🔓 Mobil için unlock
    unlockAudioForMobile();

    // 🎵 Native platform için Native Audio kullan
    if (isNativePlatform()) {
      const played = await playNativeSound('tie', 0.6);
      if (played) {
        console.log("🔊 useSounds: Native beraberlik sesi çalındı");
        return;
      }
    }

    const activePack = getActiveSoundPack();
    const soundPath = activePack.sounds.tieSound;
    // Capacitor için absolute path kullan
    const basePath = window.location.origin;
    const fixedPath = soundPath.startsWith('/') ? `${basePath}${soundPath}` : soundPath;

    try {
      const audio = new Audio(fixedPath);
      audio.volume = 0.6;
      audio.play().catch((error) => {
        console.warn("Could not play game tie sound:", error);
        unlockAudioForMobile();
      });
    } catch (error) {
      console.warn("Could not load game tie sound:", error);
    }
  }, [soundsEnabled, getActiveSoundPack, unlockAudioForMobile]);

  // Special game sounds that need to respect sound settings
  const playSpecialSound = useCallback(
    async (soundFile: string, volume: number = 0.7) => {
      if (!soundsEnabled) return;

      // 🔓 Mobil için unlock
      unlockAudioForMobile();

      // 🎵 Native platform için Native Audio kullan - FALLBACK YOK
      if (isNativePlatform()) {
        const played = await playSpecialNativeSound(soundFile, volume);
        if (played) {
          console.log(`🔊 useSounds: Native ses çalındı - ${soundFile}`);
        } else {
          console.warn(`⚠️ useSounds: Native ses çalınamadı - ${soundFile}`);
        }
        return; // Native'de her zaman return et, HTML5 Audio fallback yapma
      }

      // WEB ONLY: Pool'dan ses çal
      try {
        let cacheKey: string | null = null;
        if (soundFile.includes('yes.mp3')) cacheKey = 'special_yes';
        else if (soundFile.includes('wow2.mp3')) cacheKey = 'special_wow';
        else if (soundFile.includes('wow1.mp3')) cacheKey = 'special_wow1';
        else if (soundFile.includes('yahoo.mp3')) cacheKey = 'special_yahoo';
        else if (soundFile.includes('degistir.mp3')) cacheKey = 'joker_degistir';
        else if (soundFile.includes('fisilda.mp3')) cacheKey = 'joker_fisilda';
        else if (soundFile.includes('senyaz.mp3')) cacheKey = 'joker_senyaz';
        else if (soundFile.includes('sampiyon.mp3')) cacheKey = 'special_sampiyon';
        
        else if (soundFile.includes('carkSesi.mp3')) cacheKey = 'special_cark';
        
        if (cacheKey) {
          const audioPool = audioCache.current.get(cacheKey);
          if (audioPool && audioPool.length > 0) {
            const availableAudio = getAvailableAudio(audioPool);
            if (availableAudio) {
              availableAudio.volume = volume;
              availableAudio.currentTime = 0;
              availableAudio.play().catch((error) => {
                console.warn(`Could not play special sound ${soundFile}:`, error);
                unlockAudioForMobile();
              });
              return;
            }
          }
        }
        
        // Fallback: pool bulunamazsa eski yöntem (web only)
        const audio = new Audio(soundFile);
        audio.volume = volume;
        audio.currentTime = 0;
        audio.play().catch((error) => {
          console.warn(`Could not play special sound ${soundFile}:`, error);
          unlockAudioForMobile();
        });
      } catch (error) {
        console.warn(`Could not load special sound ${soundFile}:`, error);
      }
    },
    [soundsEnabled, getAvailableAudio, unlockAudioForMobile],
  );

  // DÜZELTME: setSoundsEnabled fonksiyonunu stabilize et
  const updateSoundsEnabled = useCallback((enabled: boolean) => {
    setSoundsEnabled(enabled);
    const settings = JSON.parse(localStorage.getItem("kelimeci-settings") || "{}");
    settings.sounds = enabled;
    localStorage.setItem("kelimeci-settings", JSON.stringify(settings));
    window.dispatchEvent(new Event("settingsChanged"));
  }, []);

  return {
    playSound,
    playTimeWarningSequence,
    playCelebrationSound,
    playGameLoseSound,
    playTieSound,
    playSpecialSound,
    soundsEnabled,
    setSoundsEnabled: updateSoundsEnabled,
  };
};
