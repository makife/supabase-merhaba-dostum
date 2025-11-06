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
return (
  <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50", className)}>
    <div className="relative">
      <div
        className={cn(
          "font-black text-center transition-all duration-500",
          showStart 
            ? "text-[70px] sm:text-[90px] md:text-[110px] lg:text-[130px] text-yellow-300 animate-pulse" 
            : "text-[120px] sm:text-[180px] md:text-[240px] lg:text-[280px] text-cyan-400"
        )}
        style={{
          textShadow: showStart 
            ? "0 0 30px #ffff00, 0 0 60px #ffaa00" 
            : "0 0 30px #00ffff, 0 0 60px #0088ff",
          opacity: 1,
          lineHeight: 1,
          fontWeight: 900,
        }}
      >
        {showStart ? "BAŞLA!" : count}
      </div>
    </div>
  </div>
);
export default GameCountdown;
