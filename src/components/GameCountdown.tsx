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
          "relative font-black drop-shadow-2xl transition-all duration-300 text-center whitespace-nowrap",
          showStart 
            ? "text-[60px] sm:text-[80px] md:text-[100px] lg:text-[120px] leading-none" // BAŞLA! için daha küçük font
            : "text-[120px] sm:text-[180px] md:text-[240px] lg:text-[280px] leading-none" // Rakamlar için büyük font
        )}
        style={{
          background: showStart 
            ? "linear-gradient(135deg, #ff0000 0%, #ff6b00 50%, #ffd000 100%)" 
            : "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          textShadow: showStart 
            ? "0 0 40px rgba(255, 255, 0, 0.8), 0 0 80px rgba(255, 165, 0, 0.6)" 
            : "0 10px 40px rgba(0, 0, 0, 0.4)",
          filter: showStart 
            ? "drop-shadow(0 0 30px rgba(255, 255, 0, 0.9))" 
            : "drop-shadow(0 0 30px rgba(102, 126, 234, 0.8))",
          letterSpacing: showStart ? "0.1em" : "-0.02em", // BAŞLA! için daha fazla harf aralığı
          opacity: 1,
          transform: showStart ? "scale(1)" : "scale(1)", // Scale'i normale çektim
          fontWeight: "900",
          minWidth: showStart ? "300px" : "auto", // BAŞLA! için minimum genişlik
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showStart ? "BAŞLA!" : count}
      </div>
      
      {/* Debug için ekstra overlay */}
      {showStart && (
        <div className="absolute top-4 left-4 bg-red-500 text-white p-2 text-sm rounded z-50">
          DEBUG: BAŞLA! aktif - count: {count}
        </div>
      )}
    </div>
  </div>
);

export default GameCountdown;
