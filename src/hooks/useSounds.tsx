import { useEffect, useRef, useState } from 'react';
import { useThemeContext } from '@/components/ThemeProvider';

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
}

interface SoundPack {
  id: string;
  name: string;
  sounds: SoundConfig;
}

export const useSounds = () => {
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const { soundPack } = useThemeContext();
  const audioCache = useRef<Map<string, HTMLAudioElement[]>>(new Map());
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Generate simple beep sounds using Web Audio API
  const generateBeep = (frequency: number, duration: number, type: OscillatorType = 'sine'): string => {
    return 'generated'; // Generated ses olarak işaretle
  };

  // Ses paketleri tanımları
  const soundPacks: Record<string, SoundPack> = {
    default: {
      id: 'default',
      name: 'Varsayılan',
      sounds: {
        buttonClick: '/sounds/default/button-click.mp3',
        correctWord: '/sounds/default/correct-word.mp3',
        wrongWord: '/sounds/default/wrong-word.mp3',
        gameWin: generateBeep(1600, 0.8),
        gameLose: generateBeep(200, 1.0),
        timeWarning: generateBeep(1000, 0.2),
        letterSelect: generateBeep(600, 0.1),
        celebration: '/sounds/default/kutlama.mp3',
        gameLoseSound: '/sounds/default/kaybetme.mp3'
      }
    },
    space: {
      id: 'space',
      name: 'Uzay',
      sounds: {
        buttonClick: '/sounds/space/button-click.mp3',
        correctWord: '/sounds/space/correct-word.mp3',
        wrongWord: generateBeep(150, 0.8), // Daha düşük frekans uzay sesi
        gameWin: generateBeep(2000, 1.0), // Yüksek frekans zafer sesi
        gameLose: generateBeep(80, 1.5), // Çok düşük frekans kayıp sesi
        timeWarning: generateBeep(1500, 0.15), // Keskin uyarı
        letterSelect: generateBeep(900, 0.05), // Kısa hızlı ses
        celebration: '/sounds/default/kutlama.mp3',
        gameLoseSound: '/sounds/default/kaybetme.mp3'
      }
    },
    nature: {
      id: 'nature',
      name: 'Doğa',
      sounds: {
        buttonClick: '/sounds/nature/button-click.mp3',
        correctWord: '/sounds/nature/correct-word.mp3',
        wrongWord: generateBeep(250, 0.6), // Yumuşak yanlış sesi
        gameWin: generateBeep(1400, 1.2), // Melodik zafer
        gameLose: generateBeep(180, 1.2), // Doğal kayıp sesi
        timeWarning: generateBeep(1200, 0.25), // Yumuşak uyarı
        letterSelect: generateBeep(700, 0.08), // Nazik seçim sesi
        celebration: '/sounds/default/kutlama.mp3',
        gameLoseSound: '/sounds/default/kaybetme.mp3'
      }
    }
  };

  // Load settings from localStorage and listen for changes
  useEffect(() => {
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('kelimeci-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setSoundsEnabled(settings.sounds ?? true);
        setMusicEnabled(settings.music ?? true);
      }
    };

    loadSettings();
    
    // Listen for storage changes from other components
    const handleStorageChange = () => loadSettings();
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom event when settings change
    window.addEventListener('settingsChanged', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsChanged', handleStorageChange);
    };
  }, []);

  // Background music management
  useEffect(() => {
    const loadBackgroundMusic = () => {
      if (!backgroundMusicRef.current) {
        backgroundMusicRef.current = new Audio('/sounds/default/backround-music.mp3');
        backgroundMusicRef.current.loop = true;
        backgroundMusicRef.current.volume = 0.3;
        backgroundMusicRef.current.preload = 'auto';
      }
    };

    loadBackgroundMusic();

    // Sadece müzik açıksa ve şu an çalmıyorsa çal
    if (musicEnabled && backgroundMusicRef.current && backgroundMusicRef.current.paused) {
      backgroundMusicRef.current.play().catch(error => {
        console.warn('Could not play background music:', error);
      });
    } else if (!musicEnabled && backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
      backgroundMusicRef.current.pause();
    }

    return () => {
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        backgroundMusicRef.current.pause();
      }
    };
  }, [musicEnabled]);

  // Create audio pool for better performance
  const createAudioPool = (soundPath: string, poolSize: number = 3): HTMLAudioElement[] => {
    const pool: HTMLAudioElement[] = [];
    for (let i = 0; i < poolSize; i++) {
      const audio = new Audio();
      audio.src = soundPath;
      audio.preload = 'auto';
      audio.volume = 0.7;
      audio.onerror = () => {
        console.warn(`Could not load sound: ${soundPath}`);
      };
      pool.push(audio);
    }
    return pool;
  };

  // Get available audio from pool
  const getAvailableAudio = (audioPool: HTMLAudioElement[]): HTMLAudioElement | null => {
    // En eski çalan ses dosyasını bul
    for (const audio of audioPool) {
      if (audio.paused || audio.ended || audio.currentTime === 0) {
        return audio;
      }
    }
    // Hepsi çalıyorsa ilkini kullan (kesip yeniden başlat)
    return audioPool[0] || null;
  };

  // Initialize audio context
  const getAudioContext = (): AudioContext | null => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.warn('Could not create audio context:', error);
        return null;
      }
    }
    return audioContextRef.current;
  };

  // Aktif ses paketini al
  const getActiveSoundPack = (): SoundPack => {
    return soundPacks[soundPack] || soundPacks.default;
  };

  // Ses cache'ini güncelle - sadece kutlama ve kaybetme sesleri için
  useEffect(() => {
    const activePack = getActiveSoundPack();
    
    // Cache'i temizle
    audioCache.current.clear();
    
    // Sadece özel ses dosyalarını yükle (kutlama, kaybetme, arka plan müziği)
    const specialSounds = ['celebration', 'gameLoseSound'];
    specialSounds.forEach((key) => {
      const soundPath = activePack.sounds[key as keyof SoundConfig];
      if (typeof soundPath === 'string' && !soundPath.startsWith('generated')) {
        try {
          audioCache.current.set(key, createAudioPool(soundPath, 2));
        } catch (error) {
          console.warn(`Failed to load sound ${key}:`, error);
        }
      }
    });
  }, [soundPack]);

  const playGeneratedSound = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!soundsEnabled) return;
    
    try {
      const audioContext = getAudioContext();
      if (!audioContext) return;
      
      // Resume context if suspended (mobile requirement)
      if (audioContext.state === 'suspended') {
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
      console.warn('Could not play generated sound:', error);
    }
  };

  const playSound = async (soundKey: keyof SoundConfig) => {
    if (!soundsEnabled) return;

    const activePack = getActiveSoundPack();

    try {
      // Önce MP3 dosyası var mı kontrol et
      const audioPool = audioCache.current.get(soundKey);
      if (audioPool && audioPool.length > 0) {
        const availableAudio = getAvailableAudio(audioPool);
        if (availableAudio && availableAudio.src && !availableAudio.src.includes('undefined')) {
          availableAudio.currentTime = 0;
          await availableAudio.play();
          return;
        }
      }

      // MP3 bulunamazsa generated sound kullan
      switch (activePack.id) {
        case 'space':
          switch (soundKey) {
            case 'buttonClick':
              playGeneratedSound(900, 0.08, 'square');
              break;
            case 'correctWord':
              playGeneratedSound(1800, 0.4, 'sawtooth');
              break;
            case 'wrongWord':
              playGeneratedSound(150, 0.8);
              break;
            case 'gameWin':
              playGeneratedSound(2000, 1.0);
              break;
            case 'gameLose':
              playGeneratedSound(80, 1.5);
              break;
            case 'timeWarning':
              playGeneratedSound(1500, 0.15);
              break;
            case 'letterSelect':
              playGeneratedSound(900, 0.05);
              break;
          }
          break;
        case 'nature':
          switch (soundKey) {
            case 'buttonClick':
              playGeneratedSound(500, 0.12, 'triangle');
              break;
            case 'correctWord':
              playGeneratedSound(1000, 0.5, 'triangle');
              break;
            case 'wrongWord':
              playGeneratedSound(250, 0.6);
              break;
            case 'gameWin':
              playGeneratedSound(1400, 1.2);
              break;
            case 'gameLose':
              playGeneratedSound(180, 1.2);
              break;
            case 'timeWarning':
              playGeneratedSound(1200, 0.25);
              break;
            case 'letterSelect':
              playGeneratedSound(700, 0.08);
              break;
          }
          break;
        default: // default paketi
          switch (soundKey) {
            case 'buttonClick':
              playGeneratedSound(800, 0.1);
              break;
            case 'correctWord':
              playGeneratedSound(1200, 0.3);
              break;
            case 'wrongWord':
              playGeneratedSound(300, 0.5);
              break;
            case 'gameWin':
              playGeneratedSound(1600, 0.8);
              break;
            case 'gameLose':
              playGeneratedSound(200, 1.0);
              break;
            case 'timeWarning':
              playGeneratedSound(1000, 0.2);
              break;
            case 'letterSelect':
              playGeneratedSound(600, 0.1);
              break;
          }
      }
    } catch (error) {
      console.warn('Could not play sound:', error);
    }
  };

  const playTimeWarningSequence = () => {
    if (!soundsEnabled) return;
    
    // Play 3 quick beeps for time warning
    setTimeout(() => playGeneratedSound(1000, 0.15), 0);
    setTimeout(() => playGeneratedSound(1000, 0.15), 200);
    setTimeout(() => playGeneratedSound(1000, 0.15), 400);
  };

  const startBackgroundMusic = () => {
    if (musicEnabled && backgroundMusicRef.current && backgroundMusicRef.current.paused) {
      backgroundMusicRef.current.currentTime = 0; // Baştan başlat
      backgroundMusicRef.current.play().catch(error => {
        console.warn('Could not play background music:', error);
      });
    }
  };

  const stopBackgroundMusic = () => {
    if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0; // Pozisyonu sıfırla
    }
  };

  const playCelebrationSound = () => {
    if (!soundsEnabled) return;
    
    const activePack = getActiveSoundPack();
    const soundPath = activePack.sounds.celebration;
    
    try {
      const audio = new Audio(soundPath);
      audio.volume = 0.6;
      audio.play().catch(error => {
        console.warn('Could not play celebration sound:', error);
      });
    } catch (error) {
      console.warn('Could not load celebration sound:', error);
    }
  };

  const playGameLoseSound = () => {
    if (!soundsEnabled) return;
    
    const activePack = getActiveSoundPack();
    const soundPath = activePack.sounds.gameLoseSound;
    
    try {
      const audio = new Audio(soundPath);
      audio.volume = 0.6;
      audio.play().catch(error => {
        console.warn('Could not play game lose sound:', error);
      });
    } catch (error) {
      console.warn('Could not load game lose sound:', error);
    }
  };

  return {
    playSound,
    playTimeWarningSequence,
    playCelebrationSound,
    playGameLoseSound,
    startBackgroundMusic,
    stopBackgroundMusic,
    soundsEnabled,
    musicEnabled,
    setSoundsEnabled: (enabled: boolean) => {
      setSoundsEnabled(enabled);
      const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
      settings.sounds = enabled;
      localStorage.setItem('kelimeci-settings', JSON.stringify(settings));
      window.dispatchEvent(new Event('settingsChanged'));
    },
    setMusicEnabled: (enabled: boolean) => {
      setMusicEnabled(enabled);
      const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
      settings.music = enabled;
      localStorage.setItem('kelimeci-settings', JSON.stringify(settings));
      window.dispatchEvent(new Event('settingsChanged'));
    }
  };
};