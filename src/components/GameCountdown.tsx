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
  const [animKey, setAnimKey] = useState(0); // Animasyonu yeniden tetiklemek için

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
      countdownAudioRef.current.volume = 0.7;
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

  // 🎯 SERVER-SIDE COUNTDOWN SYNC
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
        if (remaining !== count) {
          setCount(remaining);
          setAnimKey((prev) => prev + 1); // Yeni animasyon tetikle
          playCountdownSound(remaining);
        }
      } else if (remaining === 0 && !showStart) {
        setCount(0);
        setAnimKey((prev) => prev + 1); // BAŞLA için animasyon
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
  }, [serverStartTime, serverTimeOffset, onComplete, count, showStart]);

  // Henüz başlamamışsa hiçbir şey gösterme
  if (!hasStarted) return null;
  if (count === 0 && !showStart) return null;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50", className)}>
      {/* 3D Animated Number/Text */}
      <div key={animKey} className="relative animate-slide-up">
        {/* Glow effect */}
        <div
          className={cn(
            "absolute inset-0 blur-3xl animate-fade-in",
            showStart
              ? "bg-gradient-to-r from-green-300 via-emerald-300 to-teal-300"
              : "bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300",
          )}
        />

        {/* Main 3D Text */}
        <div
          className={cn(
            "relative font-black drop-shadow-2xl",
            showStart
              ? "text-[80px] sm:text-[120px] md:text-[160px] lg:text-[200px]"
              : "text-[120px] sm:text-[180px] md:text-[240px] lg:text-[280px]",
          )}
          style={{
            background: showStart
              ? "linear-gradient(135deg, #4ade80 0%, #22c55e 50%, #2dd4bf 100%)"
              : "linear-gradient(135deg, #60a5fa 0%, #c084fc 50%, #f472b6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
            filter: showStart
              ? "drop-shadow(0 0 80px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 40px rgba(45, 212, 191, 0.6))"
              : "drop-shadow(0 0 80px rgba(192, 132, 252, 0.8)) drop-shadow(0 0 40px rgba(244, 114, 182, 0.6))",
            letterSpacing: "-0.02em",
          }}
        >
          {showStart ? "BAŞLA!" : count}
        </div>

        {/* 3D Shadow layer */}
        <div
          className={cn(
            "absolute inset-0 font-black opacity-40 -z-10",
            showStart
              ? "text-[80px] sm:text-[120px] md:text-[160px] lg:text-[200px]"
              : "text-[120px] sm:text-[180px] md:text-[240px] lg:text-[280px]",
          )}
          style={{
            transform: "translate(4px, 4px)",
            color: "#1a1a1a",
            filter: "blur(2px)",
            letterSpacing: "-0.02em",
          }}
        >
          {showStart ? "BAŞLA!" : count}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes slideUp {
          0% {
            transform: translateY(100vh);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 0.8;
          }
        }
        
        .animate-slide-up {
          animation: slideUp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }
      `,
        }}
      />
    </div>
  );
};

export default GameCountdown;
