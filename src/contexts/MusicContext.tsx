import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface MusicContextType {
  isPlaying: boolean;
  musicEnabled: boolean;
  musicPack: string;
  setMusicEnabled: (enabled: boolean) => void;
  setMusicPack: (pack: string) => void;
  startBackgroundMusic: () => void;
  stopBackgroundMusic: () => void;
  fadeOutBackgroundMusic: (duration?: number) => void;
  fadeInBackgroundMusic: (duration?: number) => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicEnabled, setMusicEnabledState] = useState(true);
  const [musicPack, setMusicPackState] = useState('default');
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const isStartingRef = useRef(false);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalVolumeRef = useRef(0.3);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
        setMusicEnabledState(settings.music ?? true);
        setMusicPackState(settings.musicPack ?? 'default');
      } catch (error) {
        console.warn('Failed to load music settings:', error);
      }
    };

    loadSettings();
    
    // Listen for settings changes
    const handleStorageChange = () => loadSettings();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('settingsChanged', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsChanged', handleStorageChange);
    };
  }, []);

  // Initialize and manage background music
  useEffect(() => {
    const initMusic = () => {
      // Stop current music if playing
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        backgroundMusicRef.current.pause();
      }
      
      // Get music file based on selected pack
      const getMusicFile = () => {
        switch (musicPack) {
          case 'nature1':
            return '/sounds/default/doga1.mp3';
          case 'nature2':
            return '/sounds/default/doga2.mp3';
          case 'space1':
            return '/sounds/default/uzay1.mp3';
          case 'space2':
            return '/sounds/default/uzay2.mp3';
          default:
            return '/sounds/default/backround-music.mp3';
        }
      };
      
      backgroundMusicRef.current = new Audio(getMusicFile());
      backgroundMusicRef.current.loop = true;
      backgroundMusicRef.current.volume = 0.3;
      backgroundMusicRef.current.preload = 'auto';
      
      // Event listeners for state tracking
      backgroundMusicRef.current.onplay = () => setIsPlaying(true);
      backgroundMusicRef.current.onpause = () => setIsPlaying(false);
      backgroundMusicRef.current.onended = () => setIsPlaying(false);
    };

    initMusic();

    // Cleanup on unmount
    return () => {
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
    };
  }, [musicPack]);

  const startBackgroundMusic = () => {
    if (!musicEnabled || !backgroundMusicRef.current || isStartingRef.current) return;
    
    // Müzik zaten çalıyorsa tekrar başlatma
    if (!backgroundMusicRef.current.paused) return;
    
    isStartingRef.current = true;
    
    // Reset to beginning and start fresh
    backgroundMusicRef.current.currentTime = 0;
    
    // Try to play with better error handling
    const playPromise = backgroundMusicRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isStartingRef.current = false;
        })
        .catch(error => {
          isStartingRef.current = false;
          console.warn('Could not play background music:', error);
        });
    } else {
      isStartingRef.current = false;
    }
  };

  const stopBackgroundMusic = () => {
    // Clear any ongoing fade
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    
    if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.volume = originalVolumeRef.current;
    }
    isStartingRef.current = false;
  };

  const fadeOutBackgroundMusic = (duration: number = 2000) => {
    if (!backgroundMusicRef.current || backgroundMusicRef.current.paused) return;
    
    // Clear any existing fade
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }
    
    const audio = backgroundMusicRef.current;
    const startVolume = audio.volume;
    const fadeStep = startVolume / (duration / 50); // 50ms intervals
    
    fadeIntervalRef.current = setInterval(() => {
      if (audio.volume > fadeStep) {
        audio.volume = Math.max(0, audio.volume - fadeStep);
      } else {
        audio.volume = 0;
        audio.pause();
        audio.volume = originalVolumeRef.current; // Reset for next time
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
      }
    }, 50);
  };

  const fadeInBackgroundMusic = (duration: number = 2000) => {
    if (!musicEnabled || !backgroundMusicRef.current || isStartingRef.current) return;
    
    // Clear any existing fade
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }
    
    const audio = backgroundMusicRef.current;
    const targetVolume = originalVolumeRef.current;
    audio.volume = 0;
    audio.currentTime = 0;
    
    isStartingRef.current = true;
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          const fadeStep = targetVolume / (duration / 50); // 50ms intervals
          
          fadeIntervalRef.current = setInterval(() => {
            if (audio.volume < targetVolume - fadeStep) {
              audio.volume = Math.min(targetVolume, audio.volume + fadeStep);
            } else {
              audio.volume = targetVolume;
              if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
                fadeIntervalRef.current = null;
              }
            }
          }, 50);
          
          isStartingRef.current = false;
        })
        .catch(error => {
          isStartingRef.current = false;
          console.warn('Could not play background music:', error);
        });
    } else {
      isStartingRef.current = false;
    }
  };

  const setMusicEnabled = (enabled: boolean) => {
    setMusicEnabledState(enabled);
    
    // Save to localStorage
    const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
    settings.music = enabled;
    localStorage.setItem('kelimeci-settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('settingsChanged'));
    
    // Control music based on setting
    if (enabled && backgroundMusicRef.current && backgroundMusicRef.current.paused && !isStartingRef.current) {
      backgroundMusicRef.current.currentTime = 0;
      isStartingRef.current = true;
      const playPromise = backgroundMusicRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            isStartingRef.current = false;
          })
          .catch(() => {
            isStartingRef.current = false;
          });
      } else {
        isStartingRef.current = false;
      }
    } else if (!enabled && backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
      isStartingRef.current = false;
    }
  };

  const setMusicPack = (pack: string) => {
    setMusicPackState(pack);
    
    // Save to localStorage
    const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
    settings.musicPack = pack;
    localStorage.setItem('kelimeci-settings', JSON.stringify(settings));
    window.dispatchEvent(new Event('settingsChanged'));
  };

  return (
    <MusicContext.Provider value={{
      isPlaying,
      musicEnabled,
      musicPack,
      setMusicEnabled,
      setMusicPack,
      startBackgroundMusic,
      stopBackgroundMusic,
      fadeOutBackgroundMusic,
      fadeInBackgroundMusic,
    }}>
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
};