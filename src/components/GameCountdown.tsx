import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  serverStartTime?: string | null;
  serverTimeOffset?: number;
}

const GameCountdown = ({ onComplete, className, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [count, setCount] = useState(5);
  const [isVisible, setIsVisible] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedCountRef = useRef<number>(-1);
  const hasPlayedStartRef = useRef<boolean>(false);

  useEffect(() => {
    // Geri sayım için geriSayimKlik.mp3
    countdownAudioRef.current = new Audio("/gerisayim.mp3");
    // Başla için geriSayimBasla.mp3
    startAudioRef.current = new Audio("/basla.mp3");

    if (countdownAudioRef.current) {
      countdownAudioRef.current.preload = "auto";
      countdownAudioRef.current.volume = 0.7;
    }
    if (startAudioRef.current) {
      startAudioRef.current.preload = "auto";
      startAudioRef.current.volume = 0.7;
    }

    return () => {
      if (countdownAudioRef.current) {
        countdownAudioRef.current.pause();
        countdownAudioRef.current = null;
      }
      if (startAudioRef.current) {
        startAudioRef.current.pause();
        startAudioRef.current = null;
      }
    };
  }, []);

  const playCountdownSound = async (currentCount: number) => {
    if (countdownAudioRef.current && lastPlayedCountRef.current !== currentCount) {
      try {
        countdownAudioRef.current.pause();
        countdownAudioRef.current.currentTime = 0;
        await countdownAudioRef.current.play();
        lastPlayedCountRef.current = currentCount;
        console.log("🔊 Geri sayım klik sesi çalıyor:", currentCount);
      } catch (error) {
        console.warn("Geri sayım klik sesi çalamadı:", error);
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
        console.log("🔊 Başla sesi çalıyor");

        startAudioRef.current.onended = () => {
          console.log("🔊 Başla sesi bitti");
        };
      } catch (error) {
        console.warn("Başla sesi çalamadı:", error);
      }
    }
  };

  // Sayı-dosya eşleştirmesi
  const getImageForCount = (num: number): string => {
    const imageMap: { [key: number]: string } = {
      1: "/bir.png",
      2: "/iki.png",
      3: "/uc.png",
      4: "/dort.png",
      5: "/bes.png",
    };
    return imageMap[num] || "";
  };

  useEffect(() => {
    if (!serverStartTime) {
      return;
    }

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
      } else if (remaining === 0) {
        setCount(0);
        setAnimKey((k) => k + 1);

        if (!hasPlayedStartRef.current) {
          playStartSound();
          setShowStart(true);
          setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => {
              onComplete();
            }, 200);
          }, 1000);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [serverStartTime, serverTimeOffset, onComplete]);

  if (!hasStarted) return null;
  if (count === 0 && !showStart) return null;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50", className)}>
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
            showStart ? "scale-110" : "scale-100",
          )}
          style={{
            filter: showStart
              ? "drop-shadow(0 0 60px rgba(255, 107, 107, 0.9)) drop-shadow(0 0 30px rgba(255, 215, 0, 0.7))"
              : "drop-shadow(0 0 60px rgba(102, 126, 234, 0.9)) drop-shadow(0 0 30px rgba(244, 143, 177, 0.7))",
            animation: "pulse 0.3s ease-out",
          }}
        />

        {/* Ek parlaklık efekti */}
        <div
          className={cn(
            "absolute inset-0 transition-all duration-300 pointer-events-none",
            showStart ? "opacity-100" : "opacity-70",
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
