import { useState, useEffect, useRef, useCallback } from "react";
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
  const hasCalledCompleteRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // === PRELOAD (Basitleştirilmiş - donmayı önle) ===
  useEffect(() => {
    isMountedRef.current = true;

    // Audio elementleri hemen hazırla (fetch beklemeden)
    countdownAudioRef.current = new Audio("/gerisayim.mp3");
    startAudioRef.current = new Audio("/basla.mp3");

    [countdownAudioRef.current, startAudioRef.current].forEach((a) => {
      if (a) {
        a.preload = "auto";
        a.volume = 0.7;
        a.load();
      }
    });

    // Görselleri arka planda preload et (beklemeden)
    const images = ["/bir.png", "/iki.png", "/uc.png", "/dort.png", "/bes.png", "/basla.png"];
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // === MOBILE AUDIO UNLOCK ===
  const ensureAudioUnlocked = useCallback(() => {
    try {
      const unlock = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
      unlock.volume = 0.0;
      unlock.play().catch(() => {});
    } catch (e) {}
  }, []);

  // === COUNTDOWN LOGIC (Basitleştirilmiş ve güvenli) ===
  useEffect(() => {
    if (!serverStartTime) return;
    if (hasStarted) return; // Zaten başlamışsa tekrar başlatma

    console.log("🎯 GameCountdown başlatılıyor:", serverStartTime);

    const startTime = new Date(serverStartTime).getTime();
    startTimeRef.current = startTime;

    // Audio unlock'u dene
    ensureAudioUnlocked();

    // Hemen görünür yap
    if (isMountedRef.current) {
      setHasStarted(true);
      setIsVisible(true);
    }

    const updateCountdown = () => {
      if (!isMountedRef.current) return;

      const now = Date.now() + serverTimeOffset;
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, 5 - elapsed);

      // Eğer countdown süresi çoktan geçmişse (>7 saniye), doğrudan tamamla
      if (elapsed > 7 && !hasCalledCompleteRef.current) {
        console.log("⚠️ Countdown süresi çoktan geçmiş, doğrudan tamamlanıyor");
        hasCalledCompleteRef.current = true;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsVisible(false);
        onComplete();
        return;
      }

      if (remaining > 0) {
        setCount((prev) => {
          if (prev !== remaining) {
            // Ses çal
            if (countdownAudioRef.current && lastPlayedCountRef.current !== remaining) {
              countdownAudioRef.current.currentTime = 0;
              countdownAudioRef.current.play().catch(() => {});
              lastPlayedCountRef.current = remaining;
            }
            setAnimKey((k) => k + 1);
          }
          return remaining;
        });
      } else if (remaining === 0 && !hasPlayedStartRef.current) {
        console.log("✅ Countdown tamamlandı - Başla gösteriliyor");
        setCount(0);
        setAnimKey((k) => k + 1);

        // Başla sesi
        if (startAudioRef.current) {
          startAudioRef.current.currentTime = 0;
          startAudioRef.current.play().catch(() => {});
        }
        hasPlayedStartRef.current = true;

        setShowStart(true);

        // Kısa bir süre sonra tamamla
        setTimeout(() => {
          if (!isMountedRef.current) return;
          if (hasCalledCompleteRef.current) return;

          hasCalledCompleteRef.current = true;
          setIsVisible(false);

          setTimeout(() => {
            if (!isMountedRef.current) return;
            console.log("🚀 Countdown onComplete çağrılıyor");
            onComplete();
          }, 200);
        }, 800);
      }
    };

    // Hemen başla + 100ms interval
    updateCountdown();
    intervalRef.current = setInterval(updateCountdown, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [serverStartTime, serverTimeOffset, onComplete, ensureAudioUnlocked, hasStarted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // === RENDER ===
  if (!hasStarted || !isVisible) return null;
  if (count === 0 && !showStart) return null;

  const getImageForCount = (num: number): string => {
    const imageMap: Record<number, string> = {
      1: "/bir.png",
      2: "/iki.png",
      3: "/uc.png",
      4: "/dort.png",
      5: "/bes.png",
    };
    return imageMap[num] || "/bes.png";
  };

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50", className)}>
      <div className="relative">
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
