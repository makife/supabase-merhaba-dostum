import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAppState } from "@/hooks/useAppState";

interface MusicContextType {
  isPlaying: boolean;
  musicEnabled: boolean;
  musicPack: string;
  currentTrackIndex: number;
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
  const [musicPack, setMusicPackState] = useState("default");
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const isStartingRef = useRef(false);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalVolumeRef = useRef(0.3);
  const shuffledPlaylistRef = useRef<number[]>([]);
  const shuffleIndexRef = useRef(0);
  const wasPlayingBeforeBackgroundRef = useRef(false);

  // Arka plan yönetimi - uygulama arka plana gittiğinde müziği hemen durdur
  useAppState({
    onBackground: () => {
      // Arka plana gitti - müziği hemen durdur
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        console.log('🎵 Müzik arka plan için hemen duraklatılıyor');
        wasPlayingBeforeBackgroundRef.current = true;
        backgroundMusicRef.current.pause();
      }
    },
    onForeground: () => {
      // Ön plana geldi
      if (wasPlayingBeforeBackgroundRef.current && musicEnabled && backgroundMusicRef.current) {
        console.log('🎵 Müzik ön plan için devam ettiriliyor');
        wasPlayingBeforeBackgroundRef.current = false;
        backgroundMusicRef.current.play().catch(console.warn);
      }
    },
  });

  // Default pack playlist
  const defaultPlaylist = [
    "/sounds/default/backround-music.mp3",
    "/sounds/default/backround-music1.mp3",
    "/sounds/default/backround-music2.mp3",
    "/sounds/default/backround-music3.mp3",
    "/sounds/default/backround-music4.mp3",
    "/sounds/default/backround-music5.mp3",
    "/sounds/default/backround-music6.mp3",
  ];

  // Shuffle function
  const shuffleArray = (array: number[]): number[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Initialize shuffled playlist
  useEffect(() => {
    if (shuffledPlaylistRef.current.length === 0) {
      shuffledPlaylistRef.current = shuffleArray(Array.from({ length: defaultPlaylist.length }, (_, i) => i));
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const settings = JSON.parse(localStorage.getItem("kelimeci-settings") || "{}");
        setMusicEnabledState(settings.music ?? true);
        setMusicPackState(settings.musicPack ?? "default");
      } catch (error) {
        console.warn("Failed to load music settings:", error);
      }
    };

    loadSettings();

    // Listen for settings changes
    const handleStorageChange = () => loadSettings();
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("settingsChanged", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("settingsChanged", handleStorageChange);
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
          case "nature1":
            return "/sounds/default/doga1.mp3";
          case "nature2":
            return "/sounds/default/doga2.mp3";
          case "space1":
            return "/sounds/default/uzay1.mp3";
          case "space2":
            return "/sounds/default/uzay2.mp3";
          default:
            return defaultPlaylist[shuffledPlaylistRef.current[shuffleIndexRef.current] || 0];
        }
      };

      backgroundMusicRef.current = new Audio(getMusicFile());
      // Don't loop individual tracks for default pack, we'll handle playlist rotation
      backgroundMusicRef.current.loop = musicPack !== "default";
      backgroundMusicRef.current.volume = 0.3;
      backgroundMusicRef.current.preload = "auto";

      // Event listeners for state tracking
      backgroundMusicRef.current.onplay = () => setIsPlaying(true);
      backgroundMusicRef.current.onpause = () => setIsPlaying(false);
      backgroundMusicRef.current.onended = () => {
        setIsPlaying(false);
        // For default pack, move to next track in shuffled playlist and autoplay the next one
        if (musicPack === "default" && musicEnabled) {
          shuffleIndexRef.current = (shuffleIndexRef.current + 1) % shuffledPlaylistRef.current.length;

          // If we've played all tracks in the shuffled playlist, create a new shuffle
          if (shuffleIndexRef.current === 0) {
            shuffledPlaylistRef.current = shuffleArray(Array.from({ length: defaultPlaylist.length }, (_, i) => i));
          }

          const nextTrackIndex = shuffledPlaylistRef.current[shuffleIndexRef.current];
          setCurrentTrackIndex(nextTrackIndex);
          // Allow the effect to create the new Audio element, then start it
          setTimeout(() => {
            startBackgroundMusic();
          }, 120);
        }
      };
    };

    initMusic();

    // Cleanup on unmount
    return () => {
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
    };
  }, [musicPack, currentTrackIndex]);

  const startBackgroundMusic = () => {
    if (!musicEnabled || !backgroundMusicRef.current || isStartingRef.current) return;

    // Müzik zaten çalıyorsa tekrar başlatma
    if (!backgroundMusicRef.current.paused) return;

    isStartingRef.current = true;

    // Kaldığı yerden devam et (currentTime = 0 kaldırıldı)

    // Try to play with better error handling
    const playPromise = backgroundMusicRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          isStartingRef.current = false;
        })
        .catch((error) => {
          isStartingRef.current = false;
          console.warn("Could not play background music:", error);
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
      // Kaldığı yerden devam etsin diye currentTime = 0 kaldırıldı
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
        .catch((error) => {
          isStartingRef.current = false;
          console.warn("Could not play background music:", error);
        });
    } else {
      isStartingRef.current = false;
    }
  };

  const setMusicEnabled = (enabled: boolean) => {
    setMusicEnabledState(enabled);

    // Save to localStorage
    const settings = JSON.parse(localStorage.getItem("kelimeci-settings") || "{}");
    settings.music = enabled;
    localStorage.setItem("kelimeci-settings", JSON.stringify(settings));
    window.dispatchEvent(new Event("settingsChanged"));

    // Control music based on setting
    if (enabled && backgroundMusicRef.current && backgroundMusicRef.current.paused && !isStartingRef.current) {
      // Kaldığı yerden devam et
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
      // Kaldığı yerden devam etsin diye currentTime = 0 kaldırıldı
      isStartingRef.current = false;
    }
  };

  const setMusicPack = (pack: string) => {
    const wasPlaying = backgroundMusicRef.current && !backgroundMusicRef.current.paused;

    // Stop current music if playing
    if (wasPlaying) {
      stopBackgroundMusic();
    }

    setMusicPackState(pack);

    // Save to localStorage
    const settings = JSON.parse(localStorage.getItem("kelimeci-settings") || "{}");
    settings.musicPack = pack;
    localStorage.setItem("kelimeci-settings", JSON.stringify(settings));
    window.dispatchEvent(new Event("settingsChanged"));

    // Restart music with new pack if it was playing and music is enabled
    if (wasPlaying && musicEnabled) {
      // Small delay to allow audio element to update
      setTimeout(() => {
        startBackgroundMusic();
      }, 100);
    }
  };

  return (
    <MusicContext.Provider
      value={{
        isPlaying,
        musicEnabled,
        musicPack,
        currentTrackIndex,
        setMusicEnabled,
        setMusicPack,
        startBackgroundMusic,
        stopBackgroundMusic,
        fadeOutBackgroundMusic,
        fadeInBackgroundMusic,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error("useMusic must be used within a MusicProvider");
  }
  return context;
};
