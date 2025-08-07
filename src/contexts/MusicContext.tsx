import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface MusicContextType {
  isPlaying: boolean;
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;
  startBackgroundMusic: () => void;
  stopBackgroundMusic: () => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicEnabled, setMusicEnabledState] = useState(true);
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('kelimeci-settings') || '{}');
        setMusicEnabledState(settings.music ?? true);
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
      if (!backgroundMusicRef.current) {
        backgroundMusicRef.current = new Audio('/sounds/default/backround-music.mp3');
        backgroundMusicRef.current.loop = true;
        backgroundMusicRef.current.volume = 0.3;
        backgroundMusicRef.current.preload = 'auto';
        
        // Event listeners for state tracking
        backgroundMusicRef.current.onplay = () => setIsPlaying(true);
        backgroundMusicRef.current.onpause = () => setIsPlaying(false);
        backgroundMusicRef.current.onended = () => setIsPlaying(false);
      }
    };

    initMusic();

    // Cleanup on unmount
    return () => {
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
    };
  }, []);

  const startBackgroundMusic = () => {
    if (musicEnabled && backgroundMusicRef.current && backgroundMusicRef.current.paused) {
      // Reset to beginning and start fresh
      backgroundMusicRef.current.currentTime = 0;
      
      // Try to play with better error handling
      const playPromise = backgroundMusicRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn('Could not play background music:', error);
          // Autoplay is blocked, music will start when user interacts
        });
      }
    }
  };

  const stopBackgroundMusic = () => {
    if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
      backgroundMusicRef.current.pause();
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
    if (enabled && backgroundMusicRef.current && backgroundMusicRef.current.paused) {
      backgroundMusicRef.current.currentTime = 0;
      const playPromise = backgroundMusicRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(console.warn);
      }
    } else if (!enabled && backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
      backgroundMusicRef.current.pause();
      backgroundMusicRef.current.currentTime = 0;
    }
  };

  return (
    <MusicContext.Provider value={{
      isPlaying,
      musicEnabled,
      setMusicEnabled,
      startBackgroundMusic,
      stopBackgroundMusic,
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