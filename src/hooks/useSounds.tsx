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
}

interface SoundPack {
  id: string;
  name: string;
  sounds: SoundConfig;
}

export const useSounds = () => {
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const { soundPack } = useThemeContext();
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

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
        letterSelect: generateBeep(600, 0.1)
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
        letterSelect: generateBeep(900, 0.05) // Kısa hızlı ses
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
        letterSelect: generateBeep(700, 0.08) // Nazik seçim sesi
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

  // Create audio elements with Web Audio API fallback
  const createAudioElement = (soundPath: string): HTMLAudioElement => {
    const audio = new Audio();
    audio.src = soundPath;
    audio.preload = 'auto';
    audio.volume = 0.7;
    audio.onerror = () => {
      console.warn(`Could not load sound: ${soundPath}`);
    };
    return audio;
  };

  // Aktif ses paketini al
  const getActiveSoundPack = (): SoundPack => {
    return soundPacks[soundPack] || soundPacks.default;
  };

  // Ses cache'ini güncelle
  useEffect(() => {
    const activePack = getActiveSoundPack();
    
    // Cache'i temizle
    audioCache.current.clear();
    
    // Yeni sesleri yükle
    Object.entries(activePack.sounds).forEach(([key, soundPath]) => {
      if (typeof soundPath === 'string' && !soundPath.startsWith('generated')) {
        try {
          audioCache.current.set(key, createAudioElement(soundPath));
        } catch (error) {
          console.warn(`Failed to load sound ${key}:`, error);
        }
      }
    });
  }, [soundPack]);

  const playGeneratedSound = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
    if (!soundsEnabled) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Could not play generated sound:', error);
    }
  };

  const playSound = async (soundKey: keyof SoundConfig) => {
    if (!soundsEnabled) return;

    const activePack = getActiveSoundPack();
    const soundPath = activePack.sounds[soundKey];

    try {
      // MP3 dosyası varsa onu çal
      const audio = audioCache.current.get(soundKey);
      if (audio && typeof soundPath === 'string' && !soundPath.startsWith('generated')) {
        audio.currentTime = 0;
        await audio.play();
        return;
      }

      // Generated ses için ilgili pakete göre fallback
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

  return {
    playSound,
    playTimeWarningSequence,
    soundsEnabled,
    setSoundsEnabled
  };
};