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
  fadeInBackgroundMusic: (duration?: number, opts?: { musicOnly?: boolean }) => void;
}

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [musicEnabled, setMusicEnabledState] = useState(true);
  const [musicPack, setMusicPackState] = useState("default");
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  // 🔥 FIX: Storage yüklenene kadar müzik init'i engelle
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const isStartingRef = useRef(false);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const originalVolumeRef = useRef(0.3);
  const shuffledPlaylistRef = useRef<number[]>([]);
  const shuffleIndexRef = useRef(0);
  const wasPlayingBeforeBackgroundRef = useRef(false);
  const musicEnabledRef = useRef(true);
  const lastUserToggleAtRef = useRef(0);

  // 🔥 iOS: Web Audio (MediaElementSource + GainNode) KULLANILMIYOR.
  // iOS'ta AudioContext başka bir ses/interruption sonrası "suspended/interrupted"
  // kalıyor ve element çalsa bile graph üzerinden çıkış ölüyordu → ilk parçadan
  // sonra müzik susuyor, toggle kapat/aç da düzeltmiyordu. Artık düz HTML5 Audio
  // kullanıyoruz; iOS volume setter'ı yok saydığı için fade yerine anında
  // pause/play yapıyoruz (güvenilirlik > yumuşak fade).
  const isIOSNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  const IOS_USE_WEBAUDIO = false;
  const iosAudioCtxRef = useRef<AudioContext | null>(null);
  const iosGainRef = useRef<GainNode | null>(null);
  const iosSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const iosEndedWatchdogRef = useRef<NodeJS.Timeout | null>(null);


  // Arka plana geçişte hızlı fade out için ref
  const backgroundFadeRef = useRef<NodeJS.Timeout | null>(null);

  // 📻 Maç öncesi hangi kaynak çalıyordu? (fadeOut → fadeIn arası)
  const preMatchAudioSourceRef = useRef<"music" | "radio" | "none">("none");

  // ⏱️ Akıllı resume: fadeOut zamanı. 30 sn'den fazla geçtiyse sıradaki şarkıya geç.
  const pausedAtRef = useRef<number | null>(null);
  const RESUME_THRESHOLD_MS = 30_000;

  // 🔥 Platforma duyarlı volume getter/setter (iOS HTMLAudioElement.volume'u yok sayar)
  const getMusicVolume = (): number => {
    if (isIOSNative && iosGainRef.current) return iosGainRef.current.gain.value;
    return backgroundMusicRef.current?.volume ?? 0;
  };
  const setMusicVolume = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (isIOSNative && iosGainRef.current) {
      try { iosGainRef.current.gain.value = clamped; } catch {}
    }
    if (backgroundMusicRef.current) {
      try { backgroundMusicRef.current.volume = clamped; } catch {}
    }
  };

  /**
   * 🔥 iOS: play() bazen sessizce reddediliyor ya da element "hazır değil" durumunda
   * kalıyor (ilk parça bittikten sonra). Önce normal play, olmazsa load() + play,
   * son olarak kısa gecikmeli tekrar dene.
   */
  const playIOSMusicRobust = async (audio: HTMLAudioElement): Promise<boolean> => {
    const tryPlay = async (): Promise<boolean> => {
      try {
        await audio.play();
        return !audio.paused;
      } catch (e) {
        console.warn("🎵 [iOS] play() reddedildi:", e);
        return false;
      }
    };

    if (await tryPlay()) return true;

    try {
      audio.load();
      audio.currentTime = 0;
    } catch {}
    if (await tryPlay()) return true;

    await new Promise((r) => setTimeout(r, 250));
    return tryPlay();
  };



  // ⏱️ Duraklatmadan bu yana geçen süre eşiği aşıldıysa sıradaki şarkıya geç.
  // Default pack için shuffleIndex'i bir sonrakine ilerletir; diğer paketler tek şarkılı
  // olduğu için sadece currentTime=0 yapar.
  const shouldAdvanceTrack = (): boolean => {
    if (pausedAtRef.current == null) return false;
    return Date.now() - pausedAtRef.current > RESUME_THRESHOLD_MS;
  };
  const advanceToNextTrackSrc = () => {
    if (musicPack !== "default") return null;
    shuffleIndexRef.current = (shuffleIndexRef.current + 1) % shuffledPlaylistRef.current.length;
    if (shuffleIndexRef.current === 0) {
      shuffledPlaylistRef.current = shuffleArray(Array.from({ length: defaultPlaylist.length }, (_, i) => i));
    }
    const nextTrackIndex = shuffledPlaylistRef.current[shuffleIndexRef.current];
    return { src: defaultPlaylist[nextTrackIndex], index: nextTrackIndex };
  };

  // Hızlı fade out fonksiyonu (arka plan için)
  const quickFadeOut = () => {
    if (!backgroundMusicRef.current || backgroundMusicRef.current.paused) return;

    // Önceki fade'i temizle
    if (backgroundFadeRef.current) {
      clearInterval(backgroundFadeRef.current);
      backgroundFadeRef.current = null;
    }

    // 🔥 iOS: volume setter yok sayıldığı için fade döngüsü asla bitmez → direkt durdur
    if (isIOSNative) {
      try { backgroundMusicRef.current.pause(); } catch {}
      pausedAtRef.current = Date.now();
      return;
    }


    const audio = backgroundMusicRef.current;
    const startVol = getMusicVolume();
    const fadeStep = startVol / 10; // 500ms'de 10 adım = 50ms aralık

    console.log("🎵 Hızlı fade out başlatılıyor...");

    backgroundFadeRef.current = setInterval(() => {
      const cur = getMusicVolume();
      if (cur > fadeStep) {
        setMusicVolume(cur - fadeStep);
      } else {
        setMusicVolume(0);
        audio.pause();
        pausedAtRef.current = Date.now();
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
        pausedAtRef.current = Date.now();
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
        setMusicVolume(originalVolumeRef.current);
        // ⏱️ 30 sn'den fazla arka planda kaldıysak sıradaki şarkıya geç
        if (shouldAdvanceTrack()) {
          const next = advanceToNextTrackSrc();
          if (next) {
            try {
              backgroundMusicRef.current.src = next.src;
              backgroundMusicRef.current.load();
              setCurrentTrackIndex(next.index);
            } catch (e) { console.warn("🎵 Sıradaki şarkıya geçilemedi:", e); }
          } else {
            try { backgroundMusicRef.current.currentTime = 0; } catch {}
          }
        }
        pausedAtRef.current = null;
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

  // 📻 Radyo başladığında arka plan müziğini durdur + toggle'ı kapalıya al
  useEffect(() => {
    const handleRadioStarted = () => {
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        try { backgroundMusicRef.current.pause(); } catch {}
      }
      // UI toggle'ı da kapalı konuma getir ve kalıcı olarak kaydet
      lastUserToggleAtRef.current = Date.now();
      musicEnabledRef.current = false;
      setMusicEnabledState(false);
      setIsPlaying(false);
      (async () => {
        try {
          const settingsStr = await nativeStorage.getItem(STORAGE_KEYS.SETTINGS);
          const settings = settingsStr ? JSON.parse(settingsStr) : {};
          settings.music = false;
          await nativeStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
          window.dispatchEvent(new Event("settingsChanged"));
        } catch {}
      })();
      if (Capacitor.isNativePlatform()) {
        (async () => {
          try {
            const { registerPlugin } = await import("@capacitor/core");
            const NativeMusic = registerPlugin<{
              setMusicEnabled: (opts: { enabled: boolean }) => Promise<void>;
            }>("NativeMusic");
            await NativeMusic.setMusicEnabled({ enabled: false });
          } catch {}
        })();
      }
    };
    window.addEventListener("radio-started", handleRadioStarted);
    return () => window.removeEventListener("radio-started", handleRadioStarted);
  }, []);




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
              pausedAtRef.current = Date.now();
            }
          } else {
            // Ön plana geldi - 🔥 FIX: musicEnabledRef kullan
            if (wasPlayingBeforeBackgroundRef.current && musicEnabledRef.current && backgroundMusicRef.current) {
              console.log("🎵 Ön plan - müzik devam ettiriliyor");
              wasPlayingBeforeBackgroundRef.current = false;
              setMusicVolume(originalVolumeRef.current);
              if (shouldAdvanceTrack()) {
                const next = advanceToNextTrackSrc();
                if (next) {
                  try {
                    backgroundMusicRef.current.src = next.src;
                    backgroundMusicRef.current.load();
                    setCurrentTrackIndex(next.index);
                  } catch (e) { console.warn("🎵 Sıradaki şarkıya geçilemedi:", e); }
                } else {
                  try { backgroundMusicRef.current.currentTime = 0; } catch {}
                }
              }
              pausedAtRef.current = null;
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
    "./sounds/default/background-music.mp3",
    "./sounds/default/background-music1.mp3",
    "./sounds/default/background-music2.mp3",
    "./sounds/default/background-music3.mp3",
    "./sounds/default/background-music4.mp3",
    "./sounds/default/background-music5.mp3",
    "./sounds/default/background-music6.mp3",
    "./sounds/default/background-music7.mp3",
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
        const enabled = settings.music ?? true;
        // 🔥 FIX: Kullanıcı az önce toggle ettiyse storage'dan gelen (muhtemelen
        // henüz yazılmamış) eski değeri uygulamayalım -> aç/kapa titremesi olmasın
        const recentToggle = Date.now() - lastUserToggleAtRef.current < 3000;
        if (!recentToggle) {
          setMusicEnabledState(enabled);
          musicEnabledRef.current = enabled;
        }
        setMusicPackState(settings.musicPack ?? "default");
      } catch (error) {
        console.warn("Failed to load music settings:", error);
      } finally {
        // 🔥 FIX: Her durumda (hata olsa bile) loaded olarak işaretle
        setSettingsLoaded(true);
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
    // 🔥 FIX: Storage yüklenene kadar hiçbir şey yapma
    // Bu olmadan uygulama kill sonrası açılışta musicEnabled=true (default)
    // ile müzik başlıyor, storage'daki false değeri daha okunmamış oluyor
    if (!settingsLoaded) return;

    // Native platformda HTML5 Audio oluşturma - NativeMusicPlugin zaten yönetiyor
    if (isNative) {
      console.log("🎵 [MusicContext] Native platform - HTML5 Audio atlanıyor, NativeMusicPlugin kullanılacak");

      // 🔥 Native'de müziği otomatik başlat (musicEnabled kontrolü artık güvenilir)
      const initNativeMusic = async () => {
        if (!musicEnabled) {
          console.log("🎵 [MusicContext] Native müzik devre dışı, başlatılmıyor");
          return;
        }

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

      // iOS: playsinline + Web Audio graph (devre dışı)
      if (isIOSNative) {
        try { backgroundMusicRef.current.setAttribute("playsinline", "true"); } catch {}
      }
      if (isIOSNative && IOS_USE_WEBAUDIO) {

        try {
          if (!iosAudioCtxRef.current) {
            const Ctor: typeof AudioContext =
              (window as any).AudioContext || (window as any).webkitAudioContext;
            if (Ctor) iosAudioCtxRef.current = new Ctor();
          }
          const ctx = iosAudioCtxRef.current;
          if (ctx) {
            // Önceki source'u disconnect et (yeni audio için yeni node lazım)
            try { iosSourceRef.current?.disconnect(); } catch {}
            try { iosGainRef.current?.disconnect(); } catch {}
            iosSourceRef.current = ctx.createMediaElementSource(backgroundMusicRef.current);
            iosGainRef.current = ctx.createGain();
            iosGainRef.current.gain.value = originalVolumeRef.current;
            iosSourceRef.current.connect(iosGainRef.current).connect(ctx.destination);
          }
        } catch (e) {
          console.warn("🎵 [iOS] MediaElementSource bağlanamadı:", e);
        }
      }

      const handleTrackEnd = () => {
        setIsPlaying(false);
        if (iosEndedWatchdogRef.current) {
          clearInterval(iosEndedWatchdogRef.current);
          iosEndedWatchdogRef.current = null;
        }
        // For default pack, move to next track in shuffled playlist and autoplay the next one
        if (musicPack === "default" && musicEnabledRef.current) {
          shuffleIndexRef.current = (shuffleIndexRef.current + 1) % shuffledPlaylistRef.current.length;

          // If we've played all tracks in the shuffled playlist, create a new shuffle
          if (shuffleIndexRef.current === 0) {
            shuffledPlaylistRef.current = shuffleArray(Array.from({ length: defaultPlaylist.length }, (_, i) => i));
          }

          const nextTrackIndex = shuffledPlaylistRef.current[shuffleIndexRef.current];

          // 🔥 iOS FIX: Yeni Audio elementi oluşturmak yerine MEVCUT elementin src'sini değiştir.
          // Yeni HTMLAudioElement + createMediaElementSource her seferinde yeniden bağlanınca
          // iOS Web Audio gesture/unlock state'ini kaybediyor ve play() sessizce reddediliyor.
          // Aynı elementi yeniden kullanmak GainNode bağlantısını ve unlock state'ini korur.
          if (isIOSNative && backgroundMusicRef.current) {
            const audio = backgroundMusicRef.current;
            try {
              audio.src = defaultPlaylist[nextTrackIndex];
              audio.load();
              audio.currentTime = 0;
              setMusicVolume(originalVolumeRef.current);
              // iOS: AudioContext suspended olabilir, resume dene
              if (iosAudioCtxRef.current && iosAudioCtxRef.current.state !== "running") {
                iosAudioCtxRef.current.resume().catch(() => {});
              }
              audio.play()
                .then(() => {
                  console.log("🎵 [iOS] Sıradaki şarkı başlatıldı:", nextTrackIndex);
                  setIsPlaying(true);
                  // Watchdog'u yeniden kur
                  if (iosEndedWatchdogRef.current) clearInterval(iosEndedWatchdogRef.current);
                  iosEndedWatchdogRef.current = setInterval(() => {
                    const a = backgroundMusicRef.current;
                    if (!a) return;
                    if (a.duration > 0 && !a.paused && a.currentTime >= a.duration - 0.35) {
                      console.log("🎵 [iOS] Watchdog: şarkı bitti, sonrakine geçiliyor");
                      try { a.pause(); } catch {}
                      handleTrackEnd();
                    }
                  }, 500);
                })
                .catch((e) => console.warn("🎵 [iOS] Sıradaki şarkı çalınamadı:", e));
              // 🔥 iOS FIX: setCurrentTrackIndex ÇAĞIRMA! currentTrackIndex effect
              // dependency'sinde olduğu için re-run tetikler, cleanup az önce
              // başlattığımız audio'yu pause eder ve yeni Audio elementi autoplay
              // izniyle bloklanır. Bu yüzden ilk şarkıdan sonra loop kırılıyordu.
              // UI için gerekirse ref üzerinden takip edilebilir.
            } catch (e) {
              console.warn("🎵 [iOS] src değiştirme hatası, fallback:", e);
              setCurrentTrackIndex(nextTrackIndex);
              setTimeout(() => {
                if (musicEnabledRef.current) startBackgroundMusic();
              }, 120);
            }
            return;
          }

          setCurrentTrackIndex(nextTrackIndex);
          // Allow the effect to create the new Audio element, then start it
          setTimeout(() => {
            if (musicEnabledRef.current) {
              startBackgroundMusic();
            }
          }, 120);
        }
      };


      backgroundMusicRef.current.onended = handleTrackEnd;
      // 🔥 iOS: onended bazen tetiklenmez — timeupdate watchdog ekle
      if (isIOSNative) {
        if (iosEndedWatchdogRef.current) clearInterval(iosEndedWatchdogRef.current);
        iosEndedWatchdogRef.current = setInterval(() => {
          const a = backgroundMusicRef.current;
          if (!a) return;
          if (a.duration > 0 && !a.paused && a.currentTime >= a.duration - 0.35) {
            console.log("🎵 [iOS] Watchdog: şarkı bitti, sonrakine geçiliyor");
            try { a.pause(); } catch {}
            handleTrackEnd();
          }
        }, 500);
      }
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
      if (iosEndedWatchdogRef.current) {
        clearInterval(iosEndedWatchdogRef.current);
        iosEndedWatchdogRef.current = null;
      }
      if (backgroundMusicRef.current && !backgroundMusicRef.current.paused) {
        backgroundMusicRef.current.pause();
        backgroundMusicRef.current.currentTime = 0;
      }
    };
  // musicEnabled burada dependency olmamalı: toggle zaten sesi doğrudan yönetiyor.
  // Aksi halde false → true geçişi mevcut Audio elementini cleanup ile sıfırlayıp
  // aynı kullanıcı dokunuşunda başlayan fade/play akışını bozuyor.
  }, [musicPack, currentTrackIndex, isNative, settingsLoaded]);

  const startBackgroundMusic = async () => {
    if (!musicEnabled) return;

    // Radyo çalıyorsa kapat (karşılıklı dışlama)
    try { window.dispatchEvent(new CustomEvent("music-started")); } catch {}


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
      setMusicVolume(originalVolumeRef.current);
    }
    isStartingRef.current = false;
  };

  const fadeOutBackgroundMusic = async (duration: number = 2000) => {
    console.log(`🎵 [MusicContext] fadeOutBackgroundMusic çağrıldı: ${duration}ms`);

    // 📻 Maç öncesi hangi kaynak çalıyor onu kaydet
    // ⚠️ Sadece ilk fadeOut'ta belirle; sonraki tekrarlı fadeOut çağrıları
    // (ör. GameCountdown + GamePage mount) radyo zaten susmuşken kaynağı
    // "none"'a düşürerek maç sonu resume'u bozmasın.
    if (preMatchAudioSourceRef.current === "none") {
      const radioOn = !!(window as any).__radioIsPlaying;
      const musicOn = isNative
        ? isPlaying
        : !!(backgroundMusicRef.current && !backgroundMusicRef.current.paused);
      if (radioOn) preMatchAudioSourceRef.current = "radio";
      else if (musicOn) preMatchAudioSourceRef.current = "music";
    }


    // Radyoyu da yavaşça sustur
    try {
      window.dispatchEvent(new CustomEvent("radio-fade-out", { detail: { duration } }));
    } catch {}



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
      fadeIntervalRef.current = null;
    }

    // 🔥 iOS: fade yok, direkt durdur (volume setter yok sayılıyor)
    if (isIOSNative) {
      try { backgroundMusicRef.current.pause(); } catch {}
      pausedAtRef.current = Date.now();
      console.log("🎵 [iOS] Müzik direkt durduruldu (fade yok)");
      return;
    }


    const audio = backgroundMusicRef.current;
    const startVolume = getMusicVolume();
    const fadeStep = startVolume / (duration / 50); // 50ms intervals

    console.log(`🎵 [MusicContext] Web/iOS fade out başlıyor: ${startVolume} → 0`);

    fadeIntervalRef.current = setInterval(() => {
      const cur = getMusicVolume();
      if (cur > fadeStep) {
        setMusicVolume(cur - fadeStep);
      } else {
        setMusicVolume(0);
        audio.pause();
        pausedAtRef.current = Date.now();
        setMusicVolume(originalVolumeRef.current); // Reset for next time
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        console.log("🎵 [MusicContext] Web/iOS fade out tamamlandı");
      }
    }, 50);
  };

  const fadeInBackgroundMusic = async (
    duration: number = 2000,
    opts?: { musicOnly?: boolean }
  ) => {
    console.log(`🎵 [MusicContext] fadeInBackgroundMusic çağrıldı: ${duration}ms`, opts);

    // 📻 Maç öncesi radyo çalıyorduysa müzik yerine radyoyu geri başlat
    // (musicOnly=true ise radyoyu görmezden gel, sadece arka plan müziğini aç)
    if (!opts?.musicOnly && preMatchAudioSourceRef.current === "radio") {
      preMatchAudioSourceRef.current = "none";
      try {
        window.dispatchEvent(new CustomEvent("radio-resume"));
      } catch {}
      return;
    }
    preMatchAudioSourceRef.current = "none";

    // 🎵 Arka plan müziği maç boyunca durdurulmadıysa (yeni davranış: maç
    // başlarken sadece radyo fade-out olur), maç sonu fadeIn'i no-op olmalı.
    // Aksi halde native'de setPack tekrar çağrılıp müzik baştan başlar.
    if (!opts?.musicOnly) {
      const musicStillPlaying = isNative
        ? isPlaying
        : !!(backgroundMusicRef.current && !backgroundMusicRef.current.paused);
      if (musicStillPlaying) {
        console.log("🎵 [MusicContext] Müzik zaten çalıyor, fadeIn atlanıyor");
        return;
      }
    }



    // musicOnly=true iken kullanıcı maç ekranında AÇIKÇA arka plan müziğini
    // istiyor → global "music enabled" ayarı kapalı olsa da (ör. maç öncesi
    // radyo çalıyorsa music=false olabilir) zorla açıp başlat.
    const forceMusic = !!opts?.musicOnly;
    if (forceMusic) {
      // 🔥 FIX: Storage yazımını audio başlamadan ÖNCE await et.
      // Aksi halde SoundEffectsToggle'ın writeSoundsEnabled'ından tetiklenen
      // storage event → loadSettings, güncel olmayan music=false'ı okuyup
      // musicEnabled state'ini geri kapatıyor (ses çalar ama UI kapalı görünür).
      try {
        const settingsStr = await nativeStorage.getItem(STORAGE_KEYS.SETTINGS);
        const settings = settingsStr ? JSON.parse(settingsStr) : {};
        if (settings.music !== true) {
          settings.music = true;
          await nativeStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        }
      } catch (e) {
        console.warn("Failed to save forced music setting:", e);
      }
      if (!musicEnabledRef.current) {
        musicEnabledRef.current = true;
        setMusicEnabledState(true);
      }
      // settingsChanged dispatch etmiyoruz: loadSettings tekrar çalışırsa
      // Audio elementi rebuild olur ve kullanıcı gesture'ı kaybolur.
    }

    // 🔥 NATIVE PLATFORM İÇİN
    if (isNative) {
      if (!musicEnabled && !forceMusic) {
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
    if ((!musicEnabledRef.current && !forceMusic) || !backgroundMusicRef.current) return;

    // Önceki başarısız/yarım kalmış başlatma kilidi bu açık kullanıcı
    // etkileşimini engellememeli.
    if (isStartingRef.current) isStartingRef.current = false;


    // Clear any existing fade
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    const audio = backgroundMusicRef.current;
    const targetVolume = originalVolumeRef.current;
    // iOS'ta volume 0'a çekmek işe yaramaz (setter yok sayılır) ve fade döngüsü
    // asla bitmez → iOS'ta fade yapmadan tam sesle başlat.
    if (!isIOSNative) setMusicVolume(0);
    else setMusicVolume(targetVolume);

    // ⏱️ Akıllı resume: 30 sn'den fazla susmuşsak sıradaki şarkıya geç (default pack),
    // aksi halde kaldığı yerden devam et.
    if (shouldAdvanceTrack()) {
      const next = advanceToNextTrackSrc();
      if (next) {
        try {
          audio.src = next.src;
          audio.load();
          setCurrentTrackIndex(next.index);
        } catch (e) {
          console.warn("🎵 Sıradaki şarkıya geçilemedi:", e);
        }
      }
      try { audio.currentTime = 0; } catch {}
    }
    // else: currentTime'a dokunma → kaldığı yerden devam
    pausedAtRef.current = null;

    isStartingRef.current = true;

    if (isIOSNative) {
      await playIOSMusicRobust(audio);
      isStartingRef.current = false;
      return;
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          const fadeStep = targetVolume / (duration / 50); // 50ms intervals

          fadeIntervalRef.current = setInterval(() => {
            const cur = getMusicVolume();
            if (cur < targetVolume - fadeStep) {
              setMusicVolume(cur + fadeStep);
            } else {
              setMusicVolume(targetVolume);
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
    lastUserToggleAtRef.current = Date.now();
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
