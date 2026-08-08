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

  const BASE_VOLUME = 0.7;

  // 🔊 iOS native, HTMLAudioElement.volume setter'ını YOK SAYAR.
  // Bu yüzden fade in/out gerçek seviye kontrolü için WebAudio GainNode
  // üzerinden yapılıyor (radyo stream'leri CORS `*` verdiği için
  // MediaElementSource güvenli). Kurulum başarısız olursa element.volume
  // fallback'ine düşüyoruz.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const srcNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const ensureGraph = useCallback((a: HTMLAudioElement) => {
    if (gainRef.current) return true;
    try {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return false;
      const ctx: AudioContext = new Ctor();
      const src = ctx.createMediaElementSource(a);
      const gain = ctx.createGain();
      gain.gain.value = BASE_VOLUME;
      src.connect(gain);
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      srcNodeRef.current = src;
      gainRef.current = gain;
      // Graph kullanıldığında element seviyesi tam olmalı
      try { a.volume = 1; } catch {}
      return true;
    } catch (e) {
      console.warn("[Radio] WebAudio graph kurulamadı, volume fallback:", e);
      return false;
    }
  }, []);

  const resumeCtx = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== "running") {
      try { ctx.resume().catch(() => {}); } catch {}
    }
  }, []);

  const clearFade = () => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  /** Aktif seviyeyi oku (graph varsa gain, yoksa element.volume) */
  const getLevel = () => {
    if (gainRef.current) return gainRef.current.gain.value;
    return audioRef.current?.volume ?? BASE_VOLUME;
  };

  /** Seviye uygula */
  const setLevel = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (gainRef.current) {
      try { gainRef.current.gain.value = clamped; } catch {}
      return;
    }
    try { if (audioRef.current) audioRef.current.volume = clamped; } catch {}
  };

  const stop = useCallback(() => {
    clearFade();
    const a = audioRef.current;
    if (a) {
      try { a.pause(); } catch {}
      try { a.src = ""; a.load(); } catch {}
    }
    setLevel(BASE_VOLUME);
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
      a.muted = false;
      a.src = station.url;
      currentStationRef.current = station;
      setCurrentStation(station);
      setIsLoading(true);
      await a.play();
      // Graph'i ilk play sonrası (user gesture içinde) kur
      ensureGraph(a);
      resumeCtx();
      setLevel(BASE_VOLUME);
      setIsPlaying(true);
      setIsLoading(false);
    } catch (e) {
      console.warn("[Radio] play failed:", e);
      setIsLoading(false);
      setIsPlaying(false);
    }
  }, [ensureGraph, resumeCtx]);


  const savedVolumeRef = useRef<number>(BASE_VOLUME);

  const fadeOut = useCallback((durationMs = 1500) => {
    const a = audioRef.current;
    if (!a || a.paused) return;
    clearFade();
    resumeCtx();
    const steps = 24;
    const startVol = getLevel() > 0 ? getLevel() : BASE_VOLUME;
    savedVolumeRef.current = startVol;
    let i = 0;
    fadeTimerRef.current = setInterval(() => {
      i++;
      if (i >= steps) {
        setLevel(0);
        // iOS native: pause etme! Aksi halde gesture kaybolur ve
        // maç sonunda resume başarısız olur. Sadece sessize alıyoruz.
        try { a.muted = true; } catch {}
        clearFade();
        return;
      }
      // Step sayacına dayalı: volume setter yok sayılsa bile döngü biter
      setLevel(startVol * (1 - i / steps));
    }, Math.max(20, durationMs / steps));
  }, [resumeCtx]);

  const fadeIn = useCallback((durationMs = 1500) => {
    const a = audioRef.current;
    if (!a) return;
    clearFade();
    try { a.muted = false; } catch {}
    // Eğer pause olduysa (arka plan vs.) tekrar başlat
    if (a.paused) {
      try { a.play().catch(() => {}); } catch {}
    }
    ensureGraph(a);
    resumeCtx();
    const target = savedVolumeRef.current || BASE_VOLUME;
    const steps = 24;
    let i = 0;
    setLevel(0);
    setIsPlaying(true);
    fadeTimerRef.current = setInterval(() => {
      i++;
      if (i >= steps) {
        setLevel(target);
        clearFade();
        return;
      }
      setLevel(target * (i / steps));
    }, Math.max(20, durationMs / steps));
  }, [ensureGraph, resumeCtx]);


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
      const a = audioRef.current;
      const st = currentStationRef.current;
      // Eğer audio hala mevcut ve muted-fade edilmişse, sadece fadeIn
      if (a && a.src && !a.paused) {
        fadeIn(1500);
        return;
      }
      if (a && a.src && a.paused) {
        try { a.muted = false; } catch {}
        try { a.play().then(() => fadeIn(1500)).catch(() => { if (st) play(st); }); } catch { if (st) play(st); }
        return;
      }
      if (st) play(st);
    };
    window.addEventListener("radio-resume", handleRadioResume);

    return () => {
      window.removeEventListener("app-background", handleBackground);
      window.removeEventListener("radio-fade-out", handleFade);
      window.removeEventListener("music-started", handleMusicStarted);
      window.removeEventListener("radio-resume", handleRadioResume);
      if (removeListener) removeListener();
    };
  }, [stop, fadeOut, fadeIn, play]);

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
