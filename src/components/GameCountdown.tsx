import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  serverStartTime?: string | null;
  serverTimeOffset?: number;
}

/** --------------------------------------------------------------
 *  Tüm görselleri (sayılar + basla) ve sesleri önceden yükleyen
 *  yardımcı fonksiyon
 *  -------------------------------------------------------------- */
const preloadAssets = async (): Promise<void> => {
  // ---------- Görseller ----------
  const imagePaths = [
    "/bir.png",
    "/iki.png",
    "/uc.png",
    "/dort.png",
    "/bes.png",
    "/basla.png",
  ];

  const imagePromises = imagePaths.map((src) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Görsel yüklenemedi: ${src}`));
    });
  });

  // ---------- Sesler ----------
  const audioPaths = ["/gerisayim.mp3", "/basla.mp3"];
  const audioPromises = audioPaths.map((src) => {
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = 0.7;
      audio.oncanplaythrough = () => resolve();
      audio.onerror = () => reject(new Error(`Ses yüklenemedi: ${src}`));
    });
  });

  await Promise.all([...imagePromises, ...audioPromises]);
};

const GameCountdown = ({
  onComplete,
  className,
  serverStartTime,
  serverTimeOffset = 0,
}: GameCountdownProps) => {
  /* ---------- State ---------- */
  const [count, setCount] = useState(5);
  const [isVisible, setIsVisible] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [preloadComplete, setPreloadComplete] = useState(false);

  /* ---------- Refs ---------- */
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedCountRef = useRef<number>(-1);
  const hasPlayedStartRef = useRef<boolean>(false);

  /* ---------- Preload (görsel + ses) ---------- */
  useEffect(() => {
    let cancelled = false;

    preloadAssets()
      .then(() => {
        if (!cancelled) {
          // Audio nesnelerini burada tekrar oluştur (preload sırasında zaten yüklendi)
          countdownAudioRef.current = new Audio("/gerisayim.mp3");
          startAudioRef.current = new Audio("/basla.mp3");

          if (countdownAudioRef.current) {
            countdownAudioRef.current.preload = "auto";
            countdownAudioRef.current.volume = 0.7;
          }
          if (startAudioRef.current) {
            startAudioRef.current.preload = "auto";
            startAudioRef.current.volume = 0.7;
          }

          setPreloadComplete(true);
        }
      })
      .catch((err) => {
        console.error("Asset preload hatası:", err);
        // Hata olsa bile devam et (kullanıcı deneyimini kesmemek için)
        if (!cancelled) setPreloadComplete(true);
      });

    return () => {
      cancelled = true;
      // Cleanup audio
      [countdownAudioRef.current, startAudioRef.current].forEach((a) => {
        if (a) {
          a.pause();
          a.src = "";
        }
      });
    };
  }, []);

  /* ---------- Ses çalma fonksiyonları ---------- */
  const playCountdownSound = async (currentCount: number) => {
    if (
      countdownAudioRef.current &&
      lastPlayedCountRef.current !== currentCount
    ) {
      try {
        countdownAudioRef.current.pause();
        countdownAudioRef.current.currentTime = 0;
        await countdownAudioRef.current.play();
        lastPlayedCountRef.current = currentCount;
        console.log("Geri sayım klik sesi çalıyor:", currentCount);
      } catch (e) {
        console.warn("Geri sayım sesi çalamadı:", e);
      }
    }
  };

  const playStartSound = async () => {
    if (startAudioRef.current && !hasPlayedStartRef.current) {
      try {
        startAudioRef.current.pause();
        startAudioRef.current.currentTime = 0;
        await startAudioRef.current.play();
        hasPlayedStartRef.current = true;
        console.log("Başla sesi çalıyor");
      } catch (e) {
        console.warn("Başla sesi çalamadı:", e);
      }
    }
  };

  /* ---------- Görsel eşleştirme ---------- */
  const getImageForCount = (num: number): string => {
    const map: Record<number, string> = {
      1: "/bir.png",
      2: "/iki.png",
      3: "/uc.png",
      4: "/dort.png",
      5: "/bes.png",
    };
    return map[num] ?? "";
  };

  /* ---------- Geri sayım mantığı ---------- */
  useEffect(() => {
    if (!serverStartTime || !preloadComplete) return;

    const startTime = new Date(serverStartTime).getTime();
    setHasStarted(true);
    setIsVisible(true);
    playCountdownSound(5);

    const updateCountdown = () => {
      const now = Date.now() + serverTimeOffset;
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, 5 - elapsed);

      if (remaining > 0) {
        setCount((prev) => {
          if (prev !== remaining) {
            playCountdownSound(remaining);
            setAnimKey((k) => k + 1);
          }
          return remaining;
        });
      } else if (remaining === 0 && !hasPlayedStartRef.current) {
        setCount(0);
        setAnimKey((k) => k + 1);
        playStartSound();
        setShowStart(true);

        setTimeout(() => {
          setIsVisible(false);
          setTimeout(onComplete, 200);
        }, 1000);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [
    serverStartTime,
    serverTimeOffset,
    onComplete,
    preloadComplete,
  ]);

  /* ---------- Erken render koruması ---------- */
  if (!hasStarted || !preloadComplete) return null;
  if (count === 0 && !showStart) return null;

  /* ---------- JSX ---------- */
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50",
        className
      )}
    >
      <div className="relative">
        {/* PNG Görsel */}
        <img
          key={animKey}
          src={showStart ? "/basla.png" : getImageForCount(count)}
          alt={showStart ? "Başla" : `${count}`}
          className={cn(
            "transition-all duration-300 object-contain",
            "w-[280px] h-[280px]",
            "sm:w-[360px] sm:h-[360px]",
            "md:w-[420px] md:h-[420px]",
            "lg:w-[480px] lg:h-[480px]",
            showStart ? "scale-110" : "scale-100"
          )}
          style={{
            filter: showStart
              ? "drop-shadow(0 0 60px rgba(255,107,107,0.9)) drop-shadow(0 0 30px rgba(255,215,0,0.7))"
              : "drop-shadow(0 0 60px rgba(102,126,234,0.9)) drop-shadow(0 0 30px rgba(244,143,177,0.7))",
            animation: "pulse 0.3s ease-out",
          }}
        />

        {/* Parlaklık efekti */}
        <div
          className={cn(
            "absolute inset-0 transition-all duration-300 pointer-events-none",
            showStart ? "opacity-100" : "opacity-70"
          )}
          style={{
            background: showStart
              ? "radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%)"
              : "radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%)",
            mixBlendMode: "overlay",
            filter: "blur(10px)",
          }}
        />
      </div>
    </div>
  );
};

export default GameCountdown;
