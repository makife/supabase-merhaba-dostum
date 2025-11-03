import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  serverStartTime?: string | null; // Server timestamp for sync
  serverTimeOffset?: number; // Server time offset in ms
}

const GameCountdown = ({ onComplete, className, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [count, setCount] = useState(5);
  const [isVisible, setIsVisible] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Ses dosyaları için ref'ler
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedCountRef = useRef<number>(-1);
  const hasPlayedStartRef = useRef<boolean>(false);

  // Ses dosyalarını yükle
  useEffect(() => {
    countdownAudioRef.current = new Audio("/gerisayim.mp3");
    startAudioRef.current = new Audio("/basla.mp3");

    // Ses dosyalarını preload et
    if (countdownAudioRef.current) {
      countdownAudioRef.current.preload = "auto";
      countdownAudioRef.current.volume = 0.7; // Ses seviyesi ayarla
    }
    if (startAudioRef.current) {
      startAudioRef.current.preload = "auto";
      startAudioRef.current.volume = 0.7;
    }

    // Cleanup
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

  // Ses çalma fonksiyonu - sadece bir kez çal
  const playCountdownSound = async (currentCount: number) => {
    if (countdownAudioRef.current && lastPlayedCountRef.current !== currentCount) {
      try {
        // Önceki sesi durdur
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

        // Ses bittiğinde event dinle
        startAudioRef.current.onended = () => {
          console.log("🔊 Başla sesi bitti");
        };
      } catch (error) {
        console.warn("Başla sesi çalamadı:", error);
      }
    }
  };

  // 🎯 SERVER-SIDE COUNTDOWN SYNC (SADECE)
  useEffect(() => {
    if (!serverStartTime) {
      return;
    }

    // Calculate countdown based on server timestamp
    const startTime = new Date(serverStartTime).getTime();
    setHasStarted(true);
    setIsVisible(true);

    const updateCountdown = () => {
      const now = Date.now() + serverTimeOffset;
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, 5 - elapsed);

      if (remaining > 0) {
        if (remaining !== count) {
          setCount(remaining);
          playCountdownSound(remaining);
        }
      } else if (remaining === 0 && !showStart) {
        setCount(0);
        playStartSound();
        setShowStart(true);
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            onComplete();
          }, 200);
        }, 1000);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => clearInterval(interval);
  }, [serverStartTime, serverTimeOffset, onComplete]);

  // ❌ CLIENT-SIDE FALLBACK KALDIRILDI - Sadece server-side sync kullanıyoruz
  // Bu sayede tüm oyuncular tamamen senkronize oluyor

  // Henüz başlamamışsa hiçbir şey gösterme
  if (!hasStarted) return null;

  if (count === 0 && !showStart) return null;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50", className)}>
      {/* 3D Animated Number/Text */}
      <div className="relative">
        {/* Glow effect */}
        <div
          className={cn(
            "absolute inset-0 blur-2xl transition-all duration-500",
            isVisible ? "opacity-60" : "opacity-0",
            showStart
              ? "bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400"
              : "bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400",
          )}
        />

        {/* Main 3D Text */}
        <div
          className={cn(
            "relative text-[200px] font-black transition-all duration-500 ease-out",
            "drop-shadow-2xl",
            isVisible ? "translate-y-0 opacity-100 scale-100" : "translate-y-[200px] opacity-0 scale-75",
          )}
          style={{
            background: showStart
              ? "linear-gradient(135deg, #22c55e 0%, #10b981 50%, #14b8a6 100%)"
              : "linear-gradient(135deg, #3b82f6 0%, #a855f7 50%, #ec4899 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
            filter: "drop-shadow(0 0 60px rgba(139, 92, 246, 0.5))",
            letterSpacing: "-0.02em",
          }}
        >
          {showStart ? "BAŞLA!" : count}
        </div>

        {/* 3D Shadow layer */}
        <div
          className={cn(
            "absolute inset-0 text-[200px] font-black transition-all duration-500 ease-out -z-10",
            "opacity-40",
            isVisible ? "translate-y-0 scale-100" : "translate-y-[200px] scale-75",
          )}
          style={{
            transform: isVisible ? "translate(4px, 4px)" : "translate(4px, 204px)",
            color: "#1a1a1a",
            filter: "blur(2px)",
            letterSpacing: "-0.02em",
          }}
        >
          {showStart ? "BAŞLA!" : count}
        </div>
      </div>
    </div>
  );
};

export default GameCountdown;
