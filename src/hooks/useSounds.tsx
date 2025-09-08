import { useEffect, useRef, useState, useCallback } from 'react';
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
  
  // DÜZELTME: Sound packs'i ref ile sabitle
  const soundPacksRef = useRef<Record<string, SoundPack>>({
    default: {
      id: 'default',
      name: 'Varsayılan',
      sounds: {
        buttonClick: '/sounds/default/button-click.mp3',
        correctWord: '/sounds/default/correct-word.mp3',
        wrongWord: '/sounds/default/wrong-word.mp3',
        gameWin: 'generated', // Generated ses olarak işaretle
        gameLose: 'generated',
        timeWarning: 'generated',
        letterSelect: 'generated',
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
        wrongWord: 'generated',
        gameWin: 'generated',
        gameLose: 'generated',
        timeWarning: 'generated',
        letterSelect: 'generated',
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
        wrongWord: 'generated',
        gameWin: 'generated',
        gameLose: 'generated',
        timeWarning: 'generated',
        letterSelect: 'generated',
        celebration: '/sounds/default/kutlama.mp3',
        gameLoseSound: '/sounds/default/kaybetme.mp3'
      }
    }
  });

  // DÜZELTME: Settings yükleme fonksiyonunu stabilize et
  const loadSettings = useCallback(() => {
    try {
      const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
      setSoundsEnabled(settings.sounds ?? true);
    } catch (error) {
      console.warn('Failed to load sound settings:', error);
    }
  }, []);

  // Load settings from localStorage and listen for changes
  useEffect(() => {
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
  }, [loadSettings]);

  // DÜZELTME: Audio utility fonksiyonlarını useCallback ile stabilize et
  const createAudioPool = useCallback((soundPath: string, poolSize: number = 3): HTMLAudioElement[] => {
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
        console.warn('Could not create audio context:', error);
        return null;
      }
    }
    return audioContextRef.current;
  }, []);

  // Aktif ses paketini al
  const getActiveSoundPack = useCallback((): SoundPack => {
    return soundPacksRef.current[soundPack] || soundPacksRef.current.default;
  }, [soundPack]);

  // DÜZELTME: Audio cache update'i stabilize et
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
  }, [soundPack, getActiveSoundPack, createAudioPool]);

  // DÜZELTME: Generated sound fonksiyonlarını useCallback ile stabilize et
  const playGeneratedSound = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
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
  }, [soundsEnabled, getAudioContext]);

  // DÜZELTME: playSound fonksiyonunu stabilize et
  const playSound = useCallback(async (soundKey: keyof SoundConfig) => {
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
              playGeneratedSound(1200, 0.06, 'square');
              break;
            case 'correctWord':
              setTimeout(() => playGeneratedSound(800, 0.1, 'square'), 0);
              setTimeout(() => playGeneratedSound(1200, 0.1, 'square'), 100);
              setTimeout(() => playGeneratedSound(1600, 0.2, 'square'), 200);
              break;
            case 'wrongWord':
              playGeneratedSound(120, 0.8, 'square');
              break;
            case 'gameWin':
              setTimeout(() => playGeneratedSound(1000, 0.2, 'square'), 0);
              setTimeout(() => playGeneratedSound(1500, 0.2, 'square'), 200);
              setTimeout(() => playGeneratedSound(2000, 0.3, 'square'), 400);
              setTimeout(() => playGeneratedSound(2500, 0.4, 'square'), 600);
              break;
            case 'gameLose':
              playGeneratedSound(60, 2.0, 'sawtooth');
              break;
            case 'timeWarning':
              playGeneratedSound(1800, 0.12, 'square');
              break;
            case 'letterSelect':
              playGeneratedSound(1500, 0.03, 'square');
              break;
          }
          break;
        case 'nature':
          switch (soundKey) {
            case 'buttonClick':
              playGeneratedSound(400, 0.15, 'triangle');
              break;
            case 'correctWord':
              setTimeout(() => playGeneratedSound(600, 0.08, 'triangle'), 0);
              setTimeout(() => playGeneratedSound(800, 0.08, 'triangle'), 80);
              setTimeout(() => playGeneratedSound(1000, 0.12, 'triangle'), 160);
              break;
            case 'wrongWord':
              playGeneratedSound(200, 0.7, 'triangle');
              break;
            case 'gameWin':
              setTimeout(() => playGeneratedSound(800, 0.15, 'triangle'), 0);
              setTimeout(() => playGeneratedSound(1200, 0.15, 'triangle'), 150);
              setTimeout(() => playGeneratedSound(900, 0.15, 'triangle'), 300);
              setTimeout(() => playGeneratedSound(1400, 0.2, 'triangle'), 450);
              setTimeout(() => playGeneratedSound(1100, 0.25, 'triangle'), 650);
              break;
            case 'gameLose':
              playGeneratedSound(150, 1.5, 'sine');
              break;
            case 'timeWarning':
              playGeneratedSound(1000, 0.3, 'triangle');
              break;
            case 'letterSelect':
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
  }, [soundsEnabled, getActiveSoundPack, getAvailableAudio, playGeneratedSound]);

  // Diğer fonksiyonları da stabilize et
  const playTimeWarningSequence = useCallback(() => {
    if (!soundsEnabled) return;
    
    // Play 3 quick beeps for time warning
    setTimeout(() => playGeneratedSound(1000, 0.15), 0);
    setTimeout(() => playGeneratedSound(1000, 0.15), 200);
    setTimeout(() => playGeneratedSound(1000, 0.15), 400);
  }, [soundsEnabled, playGeneratedSound]);

  const playCelebrationSound = useCallback(() => {
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
  }, [soundsEnabled, getActiveSoundPack]);

  const playGameLoseSound = useCallback(() => {
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
  }, [soundsEnabled, getActiveSoundPack]);

  // Special game sounds that need to respect sound settings
  const playSpecialSound = useCallback((soundFile: string, volume: number = 0.7) => {
    if (!soundsEnabled) return;
    
    try {
      const audio = new Audio(soundFile);
      audio.volume = volume;
      audio.currentTime = 0;
      audio.play().catch(error => {
        console.warn(`Could not play special sound ${soundFile}:`, error);
      });
    } catch (error) {
      console.warn(`Could not load special sound ${soundFile}:`, error);
    }
  }, [soundsEnabled]);

  // DÜZELTME: setSoundsEnabled fonksiyonunu stabilize et
  const updateSoundsEnabled = useCallback((enabled: boolean) => {
    setSoundsEnabled(enabled);
    const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
    settings.sounds = enabled;
    localStorage.setItem('kelimeci-settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('settingsChanged'));
  }, []);

  return {
    playSound,
    playTimeWarningSequence,
    playCelebrationSound,
    playGameLoseSound,
    playSpecialSound,
    soundsEnabled,
    setSoundsEnabled: updateSoundsEnabled
  };
};