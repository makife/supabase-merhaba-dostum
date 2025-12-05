import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  serverStartTime?: string | null;
  serverTimeOffset?: number;
}

type Phase = "waiting" | "countdown" | "start" | "done";

const GameCountdown = ({ onComplete, className, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [count, setCount] = useState(5);
  const [isVisible, setIsVisible] = useState(false);

  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasCalledCompleteRef = useRef(false);
  const hasStartedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Preload audio
  useEffect(() => {
    isMountedRef.current = true;
    
    countdownAudioRef.current = new Audio("/gerisayim.mp3");
    startAudioRef.current = new Audio("/basla.mp3");
    
    [countdownAudioRef.current, startAudioRef.current].forEach((a) => {
      if (a) {
        a.preload = "auto";
        a.volume = 0.7;
        a.load();
      }
    });

    // Preload images
    const images = ["/bir.png", "/iki.png", "/uc.png", "/dort.png", "/bes.png", "/basla.png"];
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Main sequence logic
  useEffect(() => {
    if (!serverStartTime) return;
    if (hasStartedRef.current) return;

    console.log("🎯 GameCountdown başlatılıyor:", serverStartTime);
    hasStartedRef.current = true;

    if (isMountedRef.current) {
      setIsVisible(false); // Buffer süresinde görünmez
      setPhase("waiting");
    }

    // Phase timings:
    // 0-5000ms: buffer (invisible wait)
    // 5000-10000ms: countdown 5,4,3,2,1 (5s)
    // 10000ms+: start then complete

    const timers: NodeJS.Timeout[] = [];

    // 5s -> Countdown starts at 5, now visible
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsVisible(true);
      setPhase("countdown");
      setCount(5);
      countdownAudioRef.current?.play().catch(() => {});
    }, 5000));

    // 6s -> 4
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCount(4);
      countdownAudioRef.current?.play().catch(() => {});
    }, 6000));

    // 7s -> 3
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCount(3);
      countdownAudioRef.current?.play().catch(() => {});
    }, 7000));

    // 8s -> 2
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCount(2);
      countdownAudioRef.current?.play().catch(() => {});
    }, 8000));

    // 9s -> 1
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCount(1);
      countdownAudioRef.current?.play().catch(() => {});
    }, 9000));

    // 10s -> Start
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setPhase("start");
      startAudioRef.current?.play().catch(() => {});
    }, 10000));

    // 10.8s -> Complete
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      if (hasCalledCompleteRef.current) return;
      
      hasCalledCompleteRef.current = true;
      setIsVisible(false);
      
      setTimeout(() => {
        if (!isMountedRef.current) return;
        console.log("🚀 Countdown onComplete çağrılıyor");
        onComplete();
      }, 200);
    }, 10800));

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [serverStartTime, onComplete]);

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (!isVisible) return null;

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
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/60", className)}>
      <div className="relative flex flex-col items-center gap-4">
        
        {/* Countdown Phase - 5s */}
        {phase === "countdown" && (
          <img
            src={getImageForCount(count)}
            alt={`${count}`}
            className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] md:w-[420px] md:h-[420px] object-contain"
            style={{
              filter: "drop-shadow(0 0 60px rgba(102, 126, 234, 0.9)) drop-shadow(0 0 30px rgba(244, 143, 177, 0.7))",
            }}
          />
        )}

        {/* Start Phase */}
        {phase === "start" && (
          <img
            src="/basla.png"
            alt="Başla"
            className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] md:w-[420px] md:h-[420px] object-contain scale-110"
            style={{
              filter: "drop-shadow(0 0 60px rgba(255, 107, 107, 0.9)) drop-shadow(0 0 30px rgba(255, 215, 0, 0.7))",
            }}
          />
        )}

      </div>
    </div>
  );
};

export default GameCountdown;
