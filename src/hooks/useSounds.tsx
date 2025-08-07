import { useEffect, useRef, useState } from 'react';

interface SoundConfig {
  buttonClick: string;
  correctWord: string;
  wrongWord: string;
  gameWin: string;
  gameLose: string;
  timeWarning: string;
  letterSelect: string;
}

export const useSounds = () => {
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

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
  const createAudioElement = (soundData: string): HTMLAudioElement => {
    const audio = new Audio();
    audio.src = soundData;
    audio.preload = 'auto';
    audio.volume = 0.7;
    return audio;
  };

  // Generate simple beep sounds using Web Audio API
  const generateBeep = (frequency: number, duration: number, type: OscillatorType = 'sine'): string => {
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
      
      return 'generated';
    } catch (error) {
      console.warn('Web Audio API not supported, using silent fallback');
      return 'data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAAAA';
    }
  };

  // Initialize sound cache with generated sounds
  useEffect(() => {
    const sounds: SoundConfig = {
      buttonClick: generateBeep(800, 0.1),
      correctWord: generateBeep(1200, 0.3),
      wrongWord: generateBeep(300, 0.5),
      gameWin: generateBeep(1600, 0.8),
      gameLose: generateBeep(200, 1.0),
      timeWarning: generateBeep(1000, 0.2),
      letterSelect: generateBeep(600, 0.1)
    };

    Object.entries(sounds).forEach(([key, soundData]) => {
      if (soundData !== 'generated') {
        audioCache.current.set(key, createAudioElement(soundData));
      }
    });
  }, []);

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

    try {
      const audio = audioCache.current.get(soundKey);
      if (audio) {
        audio.currentTime = 0;
        await audio.play();
      } else {
        // Fallback to generated sounds
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