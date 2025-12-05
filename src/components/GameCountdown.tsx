import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  serverStartTime?: string | null;
  serverTimeOffset?: number;
}

const GameCountdown = ({ onComplete, className, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [count, setCount] = useState<number | "start" | null>(null);
  
  const audioPoolRef = useRef<HTMLAudioElement[]>([]);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const hasCalledCompleteRef = useRef(false);
  const hasStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const audioIndexRef = useRef(0);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Preload everything on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    // Create audio pool for countdown sounds (5 separate instances)
    for (let i = 0; i < 5; i++) {
      const audio = new Audio("/gerisayim.mp3");
      audio.preload = "auto";
      audio.volume = 0.7;
      audio.load();
      audioPoolRef.current.push(audio);
    }
    
    // Start sound
    startAudioRef.current = new Audio("/basla.mp3");
    startAudioRef.current.preload = "auto";
    startAudioRef.current.volume = 0.7;
    startAudioRef.current.load();

    // Preload and cache images
    const imageSources = [
      { key: "5", src: "/bes.png" },
      { key: "4", src: "/dort.png" },
      { key: "3", src: "/uc.png" },
      { key: "2", src: "/iki.png" },
      { key: "1", src: "/bir.png" },
      { key: "start", src: "/basla.png" },
    ];
    
    imageSources.forEach(({ key, src }) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        imagesRef.current.set(key, img);
      };
    });

    return () => {
      isMountedRef.current = false;
      // Cleanup audio pool
      audioPoolRef.current.forEach(audio => {
        audio.pause();
        audio.src = "";
      });
      audioPoolRef.current = [];
    };
  }, []);

  // Play sound from pool (non-blocking)
  const playCountdownSound = () => {
    const audio = audioPoolRef.current[audioIndexRef.current];
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      audioIndexRef.current = (audioIndexRef.current + 1) % audioPoolRef.current.length;
    }
  };

  // Main sequence logic
  useEffect(() => {
    if (!serverStartTime) return;
    if (hasStartedRef.current) return;

    console.log("🎯 GameCountdown başlatılıyor:", serverStartTime);
    hasStartedRef.current = true;

    const timers: NodeJS.Timeout[] = [];

    // 5s buffer -> Show 5
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCount(5);
      playCountdownSound();
    }, 5000));

    // 6s -> 4
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCount(4);
      playCountdownSound();
    }, 6000));

    // 7s -> 3
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCount(3);
      playCountdownSound();
    }, 7000));

    // 8s -> 2
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCount(2);
      playCountdownSound();
    }, 8000));

    // 9s -> 1
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCount(1);
      playCountdownSound();
    }, 9000));

    // 10s -> Start
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCount("start");
      startAudioRef.current?.play().catch(() => {});
    }, 10000));

    // 10.8s -> Complete
    timers.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      if (hasCalledCompleteRef.current) return;
      
      hasCalledCompleteRef.current = true;
      setCount(null);
      
      // Small delay before calling onComplete
      requestAnimationFrame(() => {
        if (!isMountedRef.current) return;
        console.log("🚀 Countdown onComplete çağrılıyor");
        onComplete();
      });
    }, 10800));

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [serverStartTime, onComplete]);

  if (count === null) return null;

  const getImageSrc = (): string => {
    if (count === "start") return "/basla.png";
    const srcMap: Record<number, string> = {
      1: "/bir.png",
      2: "/iki.png",
      3: "/uc.png",
      4: "/dort.png",
      5: "/bes.png",
    };
    return srcMap[count] || "/bes.png";
  };

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/60",
        className
      )}
    >
      <img
        key={count}
        src={getImageSrc()}
        alt={String(count)}
        className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] md:w-[420px] md:h-[420px] object-contain"
        style={{
          willChange: "transform",
          transform: "translateZ(0)",
        }}
        loading="eager"
        decoding="async"
      />
    </div>
  );
};

export default GameCountdown;
