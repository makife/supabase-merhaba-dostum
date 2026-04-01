import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { nativeStorage, STORAGE_KEYS } from "@/utils/nativeStorage";
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
  const musicEnabledRef = useRef(true);

  // Arka plana geçişte hızlı fade out için ref
  const backgroundFadeRef = useRef<NodeJS.Timeout | null>(null);

  // Hızlı fade out fonksiyonu (arka plan için)
  const quickFadeOut = () => {
    if (!backgroundMusicRef.current || backgroundMusicRef.current.paused) return;

    // Önceki fade'i temizle
    if (backgroundFadeRef.current) {
      clearInterval(backgroundFadeRef.current);
    }

    const audio = backgroundMusicRef.current;
    const fadeStep = audio.volume / 10; // 500ms'de 10 adım = 50ms aralık

    console.log("🎵 Hızlı fade out başlatılıyor...");

    backgroundFadeRef.current = setInterval(() => {
      if (audio.volume > fadeStep) {
        audio.volume = Math.max(0, audio.volume - fadeStep);
      } else {
        audio.volume = 0;
        audio.pause();
        if (backgroundFadeRef.current) {
          clearInterval(backgroundFadeRef.current);
          backgroundFadeRef.current = null;
        }
        console.log("🎵 Fade out tamamlandı, müzik durdu");
      }
    }, 50);
  };

  // 🔥 Arka plan event'lerini dinle - Native'de App.addListener daha güvenilir
  useEffect(() => {
    const handleBackground = () => {
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        console.log("🎵 Arka plan algılandı - müzik durduruluyor");
        wasPlayingBeforeBackgroundRef.current = true;
        // Native'de hemen durdur, fade yapma (performans)
        backgroundMusicRef.current.pause();
      }
    };

    const handleForeground = () => {
      if (backgroundFadeRef.current) {
        clearInterval(backgroundFadeRef.current);
        backgroundFadeRef.current = null;
      }

      // 🔥 FIX: musicEnabledRef kullan - foreground handler closure'da eski değeri görebilir
      if (wasPlayingBeforeBackgroundRef.current && musicEnabledRef.current && backgroundMusicRef.current) {
        console.log("🎵 Müzik ön plan için devam ettiriliyor");
        wasPlayingBeforeBackgroundRef.current = false;
        backgroundMusicRef.current.volume = originalVolumeRef.current;
        backgroundMusicRef.current.play().catch(console.warn);
      } else {
        wasPlayingBeforeBackgroundRef.current = false;
      }
    };

    // Global event'leri dinle
    window.addEventListener("app-background", handleBackground);
    window.addEventListener("app-foreground", handleForeground);

    return () => {
      window.removeEventListener("app-background", handleBackground);
      window.removeEventListener("app-foreground", handleForeground);
    };
  }, [musicEnabled]);

  // Native appStateChange için doğrudan dinleme
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeListener: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("appStateChange", ({ isActive }) => {
          console.log(`🎵 [Music] appStateChange: ${isActive ? "ACTIVE" : "INACTIVE"}`);

          if (!isActive) {
            // Arka plana gitti
            if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
              console.log("🎵 Arka plan - müzik durduruluyor");
              wasPlayingBeforeBackgroundRef.current = true;
              backgroundMusicRef.current.pause();
            }
          } else {
            // Ön plana geldi - 🔥 FIX: musicEnabledRef kullan
            if (wasPlayingBeforeBackgroundRef.current && musicEnabledRef.current && backgroundMusicRef.current) {
              console.log("🎵 Ön plan - müzik devam ettiriliyor");
              wasPlayingBeforeBackgroundRef.current = false;
              backgroundMusicRef.current.volume = originalVolumeRef.current;
              backgroundMusicRef.current.play().catch(console.warn);
            } else {
              wasPlayingBeforeBackgroundRef.current = false;
            }
          }
        });
        removeListener = () => listener.remove();
      } catch (e) {
        console.warn("🎵 App listener kurulumu başarısız:", e);
      }
    };

    setupListener();

    return () => {
      if (removeListener) removeListener();
    };
  }, [musicEnabled]);

  // Eski useAppState'i kaldır - artık doğrudan listener kullanıyoruz
  // NativeMusic plugin sadece Android'de var, iOS HTML5 Audio kullanmalı
  const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  // Default pack playlist - Capacitor için relative path kullan
  const defaultPlaylist = [
    "./sounds/default/backround-music.mp3",
    "./sounds/default/backround-music1.mp3",
    "./sounds/default/backround-music2.mp3",
    "./sounds/default/backround-music3.mp3",
    "./sounds/default/backround-music4.mp3",
    "./sounds/default/backround-music5.mp3",
    "./sounds/default/backround-music6.mp3",
    "./sounds/default/backround-music7.mp3", // Yeni
    "./sounds/default/backround-music8.mp3", // Yeni
    "./sounds/default/backround-music9.mp3", // Yeni
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
    const loadSettings = async () => {
      try {
        const settingsStr = await nativeStorage.getItem(STORAGE_KEYS.SETTINGS);
        const settings = settingsStr ? JSON.parse(settingsStr) : {};
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
  // 🔥 Native platformda NativeMusicPlugin kullanılır, HTML5 Audio kullanılmaz
  useEffect(() => {
    // Native platformda HTML5 Audio oluşturma - NativeMusicPlugin zaten yönetiyor
    if (isNative) {
      console.log("🎵 [MusicContext] Native platform - HTML5 Audio atlanıyor, NativeMusicPlugin kullanılacak");

      // 🔥 Native'de müziği otomatik başlat
      const initNativeMusic = async () => {
        if (!musicEnabled) return;

        try {
          const { registerPlugin } = await import("@capacitor/core");
          const NativeMusic = registerPlugin<{
            setPack: (opts: { pack: string }) => Promise<void>;
            setMusicEnabled: (opts: { enabled: boolean }) => Promise<void>;
          }>("NativeMusic");

          console.log("🎵 [MusicContext] Native müzik başlatılıyor, pack:", musicPack);
          await NativeMusic.setPack({ pack: musicPack });
          await NativeMusic.setMusicEnabled({ enabled: true });
          setIsPlaying(true);
          console.log("🎵 [MusicContext] Native müzik başlatıldı!");
        } catch (e) {
          console.warn("🎵 Native müzik başlatılamadı:", e);
        }
      };

      // Kısa gecikme ile başlat (plugin'in hazır olması için)
      const timer = setTimeout(initNativeMusic, 500);
      return () => clearTimeout(timer);
    }

    const initMusic = () => {
      // Stop current music if playing
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        backgroundMusicRef.current.pause();
      }

      // Get music file based on selected pack - Capacitor için relative path
      const getMusicFile = () => {
        switch (musicPack) {
          case "nature1":
            return "./sounds/default/doga1.mp3";
          case "nature2":
            return "./sounds/default/doga2.mp3";
          case "space1":
            return "./sounds/default/uzay1.mp3";
          case "space2":
            return "./sounds/default/uzay2.mp3";
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
        // 🔥 FIX: musicEnabledRef kullan, stale closure'dan kaçın
        if (musicPack === "default" && musicEnabledRef.current) {
          shuffleIndexRef.current = (shuffleIndexRef.current + 1) % shuffledPlaylistRef.current.length;

          // If we've played all tracks in the shuffled playlist, create a new shuffle
          if (shuffleIndexRef.current === 0) {
            shuffledPlaylistRef.current = shuffleArray(Array.from({ length: defaultPlaylist.length }, (_, i) => i));
          }

          const nextTrackIndex = shuffledPlaylistRef.current[shuffleIndexRef.current];
          setCurrentTrackIndex(nextTrackIndex);
          // Allow the effect to create the new Audio element, then start it
          setTimeout(() => {
            // 🔥 FIX: Tekrar kontrol et - bu süre içinde kullanıcı müziği kapatmış olabilir
            if (musicEnabledRef.current) {
              startBackgroundMusic();
            }
          }, 120);
        }
      };
    };

    initMusic();

    // 🔥 iOS/Web: musicEnabled ise otomatik başlatmayı dene
    // Autoplay policy nedeniyle başarısız olabilir - bu durumda ilk dokunuşta başlat
    if (musicEnabled && !isNative) {
      const tryAutoplay = () => {
        if (backgroundMusicRef.current && backgroundMusicRef.current.paused && !isStartingRef.current) {
          isStartingRef.current = true;
          backgroundMusicRef.current.play()
            .then(() => {
              isStartingRef.current = false;
              console.log("🎵 [MusicContext] iOS/Web otomatik başlatma başarılı");
              // Listener'ları temizle
              document.removeEventListener("touchstart", onFirstInteraction);
              document.removeEventListener("click", onFirstInteraction);
            })
            .catch(() => {
              isStartingRef.current = false;
              console.log("🎵 [MusicContext] Autoplay engellendi, kullanıcı etkileşimi bekleniyor");
            });
        }
      };

      // İlk kullanıcı etkileşiminde müziği başlat
      const onFirstInteraction = () => {
        // 🔥 FIX: musicEnabledRef kullan - kullanıcı bu arada müziği kapatmış olabilir
        if (backgroundMusicRef.current && backgroundMusicRef.current.paused && musicEnabledRef.current) {
          console.log("🎵 [MusicContext] İlk dokunuş algılandı, müzik başlatılıyor");
          backgroundMusicRef.current.play()
            .then(() => {
              isStartingRef.current = false;
              console.log("🎵 [MusicContext] Müzik ilk dokunuşla başlatıldı ✅");
            })
            .catch((e) => {
              console.warn("🎵 [MusicContext] İlk dokunuşta da başlatılamadı:", e);
            });
        }
        document.removeEventListener("touchstart", onFirstInteraction);
        document.removeEventListener("click", onFirstInteraction);
      };

      document.addEventListener("touchstart", onFirstInteraction, { once: true });
      document.addEventListener("click", onFirstInteraction, { once: true });

      // Ayrıca direkt deneme yap (bazen izin zaten verilmiş olabilir)
      setTimeout(tryAutoplay, 300);

      // Cleanup
      return () => {
        document.removeEventListener("touchstart", onFirstInteraction);
        document.removeEventListener("click", onFirstInteraction);
        if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
          backgroundMusicRef.current.pause();
          backgroundMusicRef.current.currentTime = 0;
        }
      };
    }

    // Cleanup on unmount
    return () => {
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
    };
  }, [musicPack, currentTrackIndex, isNative, musicEnabled]);

  const startBackgroundMusic = async () => {
    if (!musicEnabled) return;

    // 🔥 Native platformda NativeMusicPlugin kullan
    if (isNative) {
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const NativeMusic = registerPlugin<{
          setPack: (opts: { pack: string }) => Promise<void>;
          setMusicEnabled: (opts: { enabled: boolean }) => Promise<void>;
        }>("NativeMusic");

        await NativeMusic.setPack({ pack: musicPack });
        await NativeMusic.setMusicEnabled({ enabled: true });
        setIsPlaying(true);
        console.log("🎵 [MusicContext] Native müzik başlatıldı");
      } catch (e) {
        console.warn("🎵 Native müzik başlatılamadı:", e);
      }
      return;
    }

    // Web platformu için HTML5 Audio
    if (!backgroundMusicRef.current || isStartingRef.current) return;

    // Müzik zaten çalıyorsa tekrar başlatma
    if (!backgroundMusicRef.current.paused) return;

    isStartingRef.current = true;

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

  const stopBackgroundMusic = async () => {
    // 🔥 Native platformda NativeMusicPlugin kullan
    if (isNative) {
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const NativeMusic = registerPlugin<{
          setMusicEnabled: (opts: { enabled: boolean }) => Promise<void>;
        }>("NativeMusic");

        await NativeMusic.setMusicEnabled({ enabled: false });
        setIsPlaying(false);
        console.log("🎵 [MusicContext] Native müzik durduruldu");
      } catch (e) {
        console.warn("🎵 Native müzik durdurulamadı:", e);
      }
      return;
    }

    // Web platformu için HTML5 Audio
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

  const fadeOutBackgroundMusic = async (duration: number = 2000) => {
    console.log(`🎵 [MusicContext] fadeOutBackgroundMusic çağrıldı: ${duration}ms`);

    // 🔥 NATIVE PLATFORM İÇİN
    if (isNative) {
      if (!isPlaying) {
        console.log("🎵 [MusicContext] Native müzik zaten durmuş");
        return;
      }

      try {
        const { registerPlugin } = await import("@capacitor/core");
        const NativeMusic = registerPlugin<{
          fadeOut: (opts: { duration: number }) => Promise<void>;
        }>("NativeMusic");

        console.log(`🎵 [MusicContext] Native fade out başlıyor: ${duration}ms`);
        await NativeMusic.fadeOut({ duration: duration / 1000 }); // ms'yi saniyeye çevir
        setIsPlaying(false);
        console.log("🎵 [MusicContext] Native fade out tamamlandı");
      } catch (e) {
        console.warn("🎵 Native fade out hatası, direkt durduruluyor:", e);
        // Fallback: direkt durdur
        stopBackgroundMusic();
      }
      return;
    }

    // 🔥 WEB PLATFORM İÇİN (mevcut kodun devamı)
    if (!backgroundMusicRef.current || backgroundMusicRef.current.paused) {
      console.log("🎵 [MusicContext] Web müzik yok veya durmuş");
      return;
    }

    // Clear any existing fade
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const audio = backgroundMusicRef.current;
    const startVolume = audio.volume;
    const fadeStep = startVolume / (duration / 50); // 50ms intervals

    console.log(`🎵 [MusicContext] Web fade out başlıyor: ${startVolume} → 0`);

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
        console.log("🎵 [MusicContext] Web fade out tamamlandı");
      }
    }, 50);
  };

  const fadeInBackgroundMusic = async (duration: number = 2000) => {
    console.log(`🎵 [MusicContext] fadeInBackgroundMusic çağrıldı: ${duration}ms`);

    // 🔥 NATIVE PLATFORM İÇİN
    if (isNative) {
      if (!musicEnabled) {
        console.log("🎵 [MusicContext] Native müzik devre dışı");
        return;
      }

      try {
        const { registerPlugin } = await import("@capacitor/core");
        const NativeMusic = registerPlugin<{
          fadeIn: (opts: { duration: number }) => Promise<void>;
          setMusicEnabled: (opts: { enabled: boolean }) => Promise<void>;
          setPack: (opts: { pack: string }) => Promise<void>;
        }>("NativeMusic");

        console.log(`🎵 [MusicContext] Native fade in başlıyor: ${duration}ms`);
        
        // Önce müziği başlat, sonra fade in yap
        await NativeMusic.setPack({ pack: musicPack });
        await NativeMusic.setMusicEnabled({ enabled: true });
        
        // Fade in varsa kullan, yoksa direkt başlat
        try {
          await NativeMusic.fadeIn({ duration: duration / 1000 }); // ms'yi saniyeye çevir
        } catch (fadeError) {
          // fadeIn metodu yoksa sorun değil, müzik zaten başladı
          console.log("🎵 [MusicContext] Native fadeIn metodu yok, müzik direkt başlatıldı");
        }
        
        setIsPlaying(true);
        console.log("🎵 [MusicContext] Native fade in tamamlandı");
      } catch (e) {
        console.warn("🎵 Native fade in hatası:", e);
      }
      return;
    }

    // 🔥 WEB PLATFORM İÇİN (mevcut kod)
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

  const setMusicEnabled = async (enabled: boolean) => {
    setMusicEnabledState(enabled);
    musicEnabledRef.current = enabled; // 🔥 FIX: ref'i de güncelle
    // Save to native storage
    try {
      const settingsStr = await nativeStorage.getItem(STORAGE_KEYS.SETTINGS);
      const settings = settingsStr ? JSON.parse(settingsStr) : {};
      settings.music = enabled;
      await nativeStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      window.dispatchEvent(new Event("settingsChanged"));
    } catch (e) {
      console.warn("Failed to save music setting:", e);
    }

    // 🔥 Native platformda NativeMusicPlugin kullan
    if (isNative) {
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const NativeMusic = registerPlugin<{
          setPack: (opts: { pack: string }) => Promise<void>;
          setMusicEnabled: (opts: { enabled: boolean }) => Promise<void>;
        }>("NativeMusic");

        if (enabled) {
          await NativeMusic.setPack({ pack: musicPack });
          await NativeMusic.setMusicEnabled({ enabled: true });
          setIsPlaying(true);
        } else {
          await NativeMusic.setMusicEnabled({ enabled: false });
          setIsPlaying(false);
        }
        console.log("🎵 [MusicContext] Native müzik:", enabled ? "AÇILDI" : "KAPANDI");
      } catch (e) {
        console.warn("🎵 Native müzik ayarı değiştirilemedi:", e);
      }
      return;
    }

    // Web platformu için HTML5 Audio kontrolü
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
      isStartingRef.current = false;
    }
  };

  const setMusicPack = async (pack: string) => {
    const wasPlaying = isNative ? isPlaying : backgroundMusicRef.current && !backgroundMusicRef.current.paused;

    // Stop current music if playing
    if (wasPlaying) {
      stopBackgroundMusic();
    }

    setMusicPackState(pack);

    // Save to native storage
    try {
      const settingsStr = await nativeStorage.getItem(STORAGE_KEYS.SETTINGS);
      const settings = settingsStr ? JSON.parse(settingsStr) : {};
      settings.musicPack = pack;
      await nativeStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      window.dispatchEvent(new Event("settingsChanged"));
    } catch (e) {
      console.warn("Failed to save music pack setting:", e);
    }

    // 🔥 Native platformda NativeMusicPlugin kullan
    if (isNative && musicEnabled) {
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const NativeMusic = registerPlugin<{
          setPack: (opts: { pack: string }) => Promise<void>;
          setMusicEnabled: (opts: { enabled: boolean }) => Promise<void>;
        }>("NativeMusic");

        await NativeMusic.setPack({ pack: pack });
        await NativeMusic.setMusicEnabled({ enabled: true });
        setIsPlaying(true);
        console.log("🎵 [MusicContext] Native müzik paketi değişti:", pack);
      } catch (e) {
        console.warn("🎵 Native müzik paketi değiştirilemedi:", e);
      }
      return;
    }

    // Web: Restart music with new pack if it was playing and music is enabled
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
