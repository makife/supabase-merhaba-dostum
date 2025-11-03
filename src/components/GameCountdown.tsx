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
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/60", className)}>
      {/* 3D Animated Number/Text */}
      <div className="relative">
        {/* Glow effect */}
        <div
          className={cn(
            "absolute inset-0 blur-xl transition-all duration-300",
            isVisible ? "opacity-70 scale-110" : "opacity-0 scale-50",
            showStart
              ? "bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"
              : "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500",
          )}
        />

        {/* Main 3D Text */}
        <div
          className={cn(
            "relative text-[180px] font-black transition-all duration-300",
            "drop-shadow-2xl",
            isVisible ? "scale-100 opacity-100 rotate-0" : "scale-0 opacity-0 rotate-180",
            showStart && "animate-bounce",
          )}
          style={{
            background: showStart
              ? "linear-gradient(135deg, #10b981 0%, #34d399 25%, #6ee7b7 50%, #34d399 75%, #10b981 100%)"
              : "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 25%, #ec4899 50%, #8b5cf6 75%, #3b82f6 100%)",
            backgroundSize: "200% 200%",
            animation: showStart
              ? "gradient 2s ease infinite, pulse 0.5s ease-in-out infinite"
              : "gradient 3s ease infinite",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: showStart
              ? "0 0 40px rgba(16, 185, 129, 0.8), 0 0 80px rgba(52, 211, 153, 0.6), 0 10px 30px rgba(0, 0, 0, 0.5)"
              : "0 0 40px rgba(139, 92, 246, 0.8), 0 0 80px rgba(236, 72, 153, 0.6), 0 10px 30px rgba(0, 0, 0, 0.5)",
            filter: "drop-shadow(0 20px 40px rgba(0, 0, 0, 0.4))",
          }}
        >
          {showStart ? "BAŞLA!" : count}
        </div>

        {/* 3D Shadow layers */}
        <div
          className={cn(
            "absolute inset-0 text-[180px] font-black transition-all duration-300 -z-10",
            "opacity-30",
            isVisible ? "scale-100" : "scale-0",
          )}
          style={{
            transform: "translate(6px, 6px)",
            color: "#000",
            filter: "blur(2px)",
          }}
        >
          {showStart ? "BAŞLA!" : count}
        </div>

        {/* Second shadow layer */}
        <div
          className={cn(
            "absolute inset-0 text-[180px] font-black transition-all duration-300 -z-20",
            "opacity-15",
            isVisible ? "scale-100" : "scale-0",
          )}
          style={{
            transform: "translate(12px, 12px)",
            color: "#000",
            filter: "blur(3px)",
          }}
        >
          {showStart ? "BAŞLA!" : count}
        </div>

        {/* Particles effect */}
        {isVisible && (
          <>
            <div className="absolute -top-20 -left-20 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-xl animate-pulse" />
            <div
              className="absolute -bottom-20 -right-20 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full blur-xl animate-pulse"
              style={{ animationDelay: "0.5s" }}
            />
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
};

export default GameCountdown;
