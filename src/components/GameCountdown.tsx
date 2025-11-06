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
        console.log("🔊 Geri sayım sesi çalıyor:", currentCount);
      } catch (error) {
        console.warn("Geri sayım sesi çalamadı:", error);
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

  useEffect(() => {
    if (!serverStartTime) {
      return;
    }

    const startTime = new Date(serverStartTime).getTime();
    setHasStarted(true);
    setIsVisible(true);

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
        {/* Main Text */}
        <div
          className={cn(
            "relative font-black drop-shadow-2xl transition-all duration-300",
            showStart
              ? "text-[80px] sm:text-[120px] md:text-[160px] lg:text-[200px]"
              : "text-[120px] sm:text-[180px] md:text-[240px] lg:text-[280px]",
          )}
          style={{
            background: showStart
              ? "linear-gradient(135deg, #ff6b6b 0%, #ffa500 25%, #ffd700 50%, #90ee90 75%, #87ceeb 100%)"
              : "linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4ecdc4 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            color: "transparent", // Bu satırı ekleyin
            backgroundSize: "200% 200%",
            animation: "gradientShift 3s ease infinite",
            textShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
            filter: showStart
              ? "drop-shadow(0 0 80px rgba(255, 107, 107, 0.8)) drop-shadow(0 0 40px rgba(255, 215, 0, 0.6))"
              : "drop-shadow(0 0 80px rgba(102, 126, 234, 0.8)) drop-shadow(0 0 40px rgba(244, 143, 177, 0.6))",
            letterSpacing: "-0.02em",
            opacity: showStart ? 1 : 0.95,
            transform: showStart ? "scale(1.05)" : "scale(1)",
          }}
        >
          {showStart ? "BAŞLA!" : count}
        </div>

        {/* Ek parlaklık efekti */}
        <div
          className={cn("absolute inset-0 transition-all duration-300", showStart ? "opacity-100" : "opacity-70")}
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
