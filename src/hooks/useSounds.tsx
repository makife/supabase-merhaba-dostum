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
  const { soundPack } = useThemeContext();
  const audioCache = useRef<Map<string, HTMLAudioElement[]>>(new Map());
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
      try {
        const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
        setSoundsEnabled(settings.sounds ?? true);
      } catch (error) {
        console.warn('Failed to load sound settings:', error);
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

  // Uzay teması için özel sesler
  const playSpaceCorrectSound = () => {
    if (!soundsEnabled) return;
    // Yükselen frekanslı uzay zafer sesi
    setTimeout(() => playGeneratedSound(800, 0.1, 'square'), 0);
    setTimeout(() => playGeneratedSound(1200, 0.1, 'square'), 100);
    setTimeout(() => playGeneratedSound(1600, 0.2, 'square'), 200);
  };

  const playSpaceWinSound = () => {
    if (!soundsEnabled) return;
    // Uzay zafer fanfarı - elektronik melodi
    setTimeout(() => playGeneratedSound(1000, 0.2, 'square'), 0);
    setTimeout(() => playGeneratedSound(1500, 0.2, 'square'), 200);
    setTimeout(() => playGeneratedSound(2000, 0.3, 'square'), 400);
    setTimeout(() => playGeneratedSound(2500, 0.4, 'square'), 600);
  };

  // Doğa teması için özel sesler
  const playNatureCorrectSound = () => {
    if (!soundsEnabled) return;
    // Kuş şakıması benzeri doğal ses
    setTimeout(() => playGeneratedSound(600, 0.08, 'triangle'), 0);
    setTimeout(() => playGeneratedSound(800, 0.08, 'triangle'), 80);
    setTimeout(() => playGeneratedSound(1000, 0.12, 'triangle'), 160);
  };

  const playNatureWinSound = () => {
    if (!soundsEnabled) return;
    // Doğal melodi - kuş cıvıltısı benzeri
    setTimeout(() => playGeneratedSound(800, 0.15, 'triangle'), 0);
    setTimeout(() => playGeneratedSound(1200, 0.15, 'triangle'), 150);
    setTimeout(() => playGeneratedSound(900, 0.15, 'triangle'), 300);
    setTimeout(() => playGeneratedSound(1400, 0.2, 'triangle'), 450);
    setTimeout(() => playGeneratedSound(1100, 0.25, 'triangle'), 650);
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

      // MP3 bulunamazsa tema-specific generated sound kullan
      switch (activePack.id) {
        case 'space':
          switch (soundKey) {
            case 'buttonClick':
              // Futuristik elektronik beep - yüksek frekanslı keskin ses
              playGeneratedSound(1200, 0.06, 'square');
              break;
            case 'correctWord':
              // Uzay zafer sesi - yükselen frekanslı synthesizer
              playSpaceCorrectSound();
              break;
            case 'wrongWord':
              // Düşük frekanslı robotik hata sesi
              playGeneratedSound(120, 0.8, 'square');
              break;
            case 'gameWin':
              // Uzay zafer fanfarı - çoklu frekanslı
              playSpaceWinSound();
              break;
            case 'gameLose':
              // Dramatik düşük frekanslı kayıp sesi
              playGeneratedSound(60, 2.0, 'sawtooth');
              break;
            case 'timeWarning':
              // Keskin alarm sesi
              playGeneratedSound(1800, 0.12, 'square');
              break;
            case 'letterSelect':
              // Hızlı elektronik tick
              playGeneratedSound(1500, 0.03, 'square');
              break;
          }
          break;
        case 'nature':
          switch (soundKey) {
            case 'buttonClick':
              // Yumuşak ahşap tık sesi
              playGeneratedSound(400, 0.15, 'triangle');
              break;
            case 'correctWord':
              // Kuş şakıması benzeri doğal ses
              playNatureCorrectSound();
              break;
            case 'wrongWord':
              // Yumuşak rüzgar sesi
              playGeneratedSound(200, 0.7, 'triangle');
              break;
            case 'gameWin':
              // Doğal melodi - kuş cıvıltısı benzeri
              playNatureWinSound();
              break;
            case 'gameLose':
              // Yumuşak dalga sesi
              playGeneratedSound(150, 1.5, 'sine');
              break;
            case 'timeWarning':
              // Nazik çan sesi
              playGeneratedSound(1000, 0.3, 'triangle');
              break;
            case 'letterSelect':
              // Yaprak hışırtısı benzeri
              playGeneratedSound(600, 0.1, 'triangle');
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
    soundsEnabled,
    setSoundsEnabled: (enabled: boolean) => {
      setSoundsEnabled(enabled);
      const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
      settings.sounds = enabled;
      localStorage.setItem('kelimeci-settings', JSON.stringify(settings));
      window.dispatchEvent(new Event('settingsChanged'));
    }
  };
};