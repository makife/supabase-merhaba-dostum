import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  serverStartTime?: string | null;
  serverTimeOffset?: number;
}

// Memoized image component to prevent unnecessary re-renders
const CountdownImage = memo(({ src, alt }: { src: string; alt: string }) => (
  <img
    src={src}
    alt={alt}
    className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] md:w-[420px] md:h-[420px] object-contain"
    style={{
      willChange: "auto",
      transform: "translateZ(0)",
      backfaceVisibility: "hidden",
    }}
    loading="eager"
    decoding="sync"
  />
));
CountdownImage.displayName = "CountdownImage";

// Image sources mapping
const IMAGE_MAP: Record<string, string> = {
  "5": "/bes.png",
  "4": "/dort.png",
  "3": "/uc.png",
  "2": "/iki.png",
  "1": "/bir.png",
  "start": "/basla.png",
};

const GameCountdown = memo(({ onComplete, className, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  
  const hasCalledCompleteRef = useRef(false);
  const hasStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  
  // Audio refs - separate instances for each sound
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioIndexRef = useRef(0);

  // Preload everything on mount - run once
  useEffect(() => {
    isMountedRef.current = true;
    
    // Preload images immediately
    Object.values(IMAGE_MAP).forEach(src => {
      const img = new Image();
      img.src = src;
    });

    // Create 5 audio instances for countdown sounds
    for (let i = 0; i < 5; i++) {
      const audio = new Audio();
      audio.src = "/gerisayim.mp3";
      audio.preload = "auto";
      audio.volume = 0.7;
      audioRefs.current.push(audio);
    }
    
    // Start sound
    startAudioRef.current = new Audio();
    startAudioRef.current.src = "/basla.mp3";
    startAudioRef.current.preload = "auto";
    startAudioRef.current.volume = 0.7;

    return () => {
      isMountedRef.current = false;
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current = [];
      audioRefs.current.forEach(a => {
        a.pause();
        a.src = "";
      });
      audioRefs.current = [];
      if (startAudioRef.current) {
        startAudioRef.current.pause();
        startAudioRef.current.src = "";
      }
    };
  }, []);

  // Play sound from pool
  const playSound = () => {
    const audio = audioRefs.current[audioIndexRef.current];
    if (audio) {
      audio.currentTime = 0;
      // Use setTimeout to make it non-blocking
      setTimeout(() => audio.play().catch(() => {}), 0);
      audioIndexRef.current = (audioIndexRef.current + 1) % 5;
    }
  };

  // Main countdown sequence
  useEffect(() => {
    if (!serverStartTime || hasStartedRef.current) return;
    
    console.log("🎯 GameCountdown başlatılıyor:", serverStartTime);
    hasStartedRef.current = true;

    // Clear any existing timers
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];

    // Schedule all transitions upfront
    // 5s buffer (invisible) -> then show countdown
    
    timersRef.current.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCurrentImage("5");
      playSound();
    }, 5000));

    timersRef.current.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCurrentImage("4");
      playSound();
    }, 6000));

    timersRef.current.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCurrentImage("3");
      playSound();
    }, 7000));

    timersRef.current.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCurrentImage("2");
      playSound();
    }, 8000));

    timersRef.current.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCurrentImage("1");
      playSound();
    }, 9000));

    timersRef.current.push(setTimeout(() => {
      if (!isMountedRef.current) return;
      setCurrentImage("start");
      setTimeout(() => startAudioRef.current?.play().catch(() => {}), 0);
    }, 10000));

    timersRef.current.push(setTimeout(() => {
      if (!isMountedRef.current || hasCalledCompleteRef.current) return;
      hasCalledCompleteRef.current = true;
      setCurrentImage(null);
      console.log("🚀 Countdown onComplete çağrılıyor");
      onComplete();
    }, 10800));

    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, [serverStartTime, onComplete]);

  // Don't render if no image to show
  if (!currentImage) return null;

  const imageSrc = IMAGE_MAP[currentImage];
  if (!imageSrc) return null;

  // Use portal to render countdown in a separate DOM tree
  // This isolates it from parent re-renders
  const countdownContent = (
    <div 
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center",
        className
      )}
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        isolation: "isolate",
        contain: "layout style paint",
      }}
    >
      <CountdownImage src={imageSrc} alt={currentImage} />
    </div>
  );

  // Render via portal to document.body
  return createPortal(countdownContent, document.body);
});

GameCountdown.displayName = "GameCountdown";

export default GameCountdown;
