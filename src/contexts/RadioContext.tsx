import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

export interface RadioStation {
  id: string;
  name: string;
  url: string;
  icon?: string;
}

// Türk internet radyo kanalları (public stream URL'leri)
export const RADIO_STATIONS: RadioStation[] = [
  { id: "power-turk", name: "PowerTürk", url: "https://listen.powerapp.com.tr/powerturk/mpeg/icecast.audio" },
  { id: "power-fm", name: "Power FM", url: "https://listen.powerapp.com.tr/powerfm/mpeg/icecast.audio" },
  { id: "metro-fm", name: "Metro FM", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FM_SC" },
  { id: "virgin-radio", name: "Virgin Radio", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/VIRGIN_RADIO_SC" },
  { id: "super-fm", name: "Süper FM", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/SUPER_FM_SC" },
  { id: "joy-turk", name: "JoyTürk", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURK_SC" },
  { id: "slow-turk", name: "Slow Türk", url: "https://radyo.duhnet.tv/ak_dtvh_slowturk" },
  { id: "radyo-d", name: "Radyo D", url: "https://radyo.duhnet.tv/radyod" },
];

interface RadioContextValue {
  isPlaying: boolean;
  isLoading: boolean;
  currentStation: RadioStation | null;
  stations: RadioStation[];
  play: (station: RadioStation) => Promise<void>;
  stop: () => void;
  fadeOut: (durationMs?: number) => void;
}

const RadioContext = createContext<RadioContextValue | undefined>(undefined);

export const RadioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStation, setCurrentStation] = useState<RadioStation | null>(null);
  const currentStationRef = useRef<RadioStation | null>(null);

  const clearFade = () => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    clearFade();
    const a = audioRef.current;
    if (a) {
      try { a.pause(); } catch {}
      try { a.src = ""; a.load(); } catch {}
    }
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  const play = useCallback(async (station: RadioStation) => {
    clearFade();
    try {
      // Arka plan müziği çalıyorsa durdur (karşılıklı dışlama)
      try { window.dispatchEvent(new CustomEvent("radio-started")); } catch {}
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.crossOrigin = "anonymous";
        audioRef.current.preload = "none";
      }
      const a = audioRef.current;
      a.volume = 0.7;
      a.src = station.url;
      currentStationRef.current = station;
      setCurrentStation(station);
      setIsLoading(true);
      await a.play();
      setIsPlaying(true);
      setIsLoading(false);
    } catch (e) {
      console.warn("[Radio] play failed:", e);
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, []);


  const fadeOut = useCallback((durationMs = 1500) => {
    const a = audioRef.current;
    if (!a || a.paused) return;
    clearFade();
    const steps = 20;
    const startVol = a.volume;
    const dec = startVol / steps;
    fadeTimerRef.current = setInterval(() => {
      const cur = a.volume;
      if (cur > dec) {
        try { a.volume = Math.max(0, cur - dec); } catch {}
      } else {
        try { a.volume = 0; a.pause(); } catch {}
        setIsPlaying(false);
        clearFade();
      }
    }, Math.max(20, durationMs / steps));
  }, []);

  // Arka plana geçince radyoyu durdur; foreground'da otomatik başlatma yok
  useEffect(() => {
    const handleBackground = () => {
      if (audioRef.current && !audioRef.current.paused) {
        stop();
      }
    };
    window.addEventListener("app-background", handleBackground);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") handleBackground();
    });

    // Native app state
    let removeListener: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          const { App } = await import("@capacitor/app");
          const l = await App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) stop();
          });
          removeListener = () => l.remove();
        } catch (e) {
          console.warn("[Radio] App listener failed:", e);
        }
      })();
    }

    // Maç başlangıcında yavaşça durdur
    const handleFade = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      fadeOut(detail.duration ?? 2000);
    };
    window.addEventListener("radio-fade-out", handleFade);

    // Arka plan müziği açıldığında radyoyu kapat
    const handleMusicStarted = () => {
      if (audioRef.current && !audioRef.current.paused) {
        stop();
      }
    };
    window.addEventListener("music-started", handleMusicStarted);

    // Maç bitişinde: eğer radyo maç öncesi çalıyorduysa geri başlat
    const handleRadioResume = () => {
      const st = currentStationRef.current;
      if (st) {
        play(st);
      }
    };
    window.addEventListener("radio-resume", handleRadioResume);

    return () => {
      window.removeEventListener("app-background", handleBackground);
      window.removeEventListener("radio-fade-out", handleFade);
      window.removeEventListener("music-started", handleMusicStarted);
      window.removeEventListener("radio-resume", handleRadioResume);
      if (removeListener) removeListener();
    };
  }, [stop, fadeOut, play]);

  // Global bayrak: MusicContext maç öncesi kaynağı bilsin
  useEffect(() => {
    (window as any).__radioIsPlaying = isPlaying;
  }, [isPlaying]);


  return (
    <RadioContext.Provider
      value={{
        isPlaying,
        isLoading,
        currentStation,
        stations: RADIO_STATIONS,
        play,
        stop,
        fadeOut,
      }}
    >
      {children}
    </RadioContext.Provider>
  );
};

export const useRadio = () => {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error("useRadio must be used within RadioProvider");
  return ctx;
};
