import { useEffect, useRef, memo, useState } from "react";
import { createPortal } from "react-dom";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  serverStartTime?: string | null;
  serverTimeOffset?: number;
}

// Preload images immediately when module loads
const IMAGE_PATHS = ["/bes.png", "/dort.png", "/uc.png", "/iki.png", "/bir.png", "/basla.png"];
const preloadedImages: HTMLImageElement[] = [];

// Preload on module load - not in component
if (typeof window !== "undefined") {
  IMAGE_PATHS.forEach((src) => {
    const img = new Image();
    img.src = src;
    preloadedImages.push(img);
  });
}

const GameCountdown = memo(({ onComplete }: GameCountdownProps) => {
  const [displayValue, setDisplayValue] = useState<number | "start">(5);
  const completedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (completedRef.current) return;

    // Create single audio instance
    audioRef.current = new Audio("/gerisayim.mp3");
    audioRef.current.volume = 0.6;

    const playSound = (src: string) => {
      try {
        const audio = new Audio(src);
        audio.volume = 0.6;
        audio.play().catch(() => {});
      } catch {}
    };

    // Play initial sound
    playSound("/gerisayim.mp3");

    // Simple countdown: 5 -> 4 -> 3 -> 2 -> 1 -> start -> complete
    const timers: NodeJS.Timeout[] = [];

    timers.push(setTimeout(() => { setDisplayValue(4); playSound("/gerisayim.mp3"); }, 1000));
    timers.push(setTimeout(() => { setDisplayValue(3); playSound("/gerisayim.mp3"); }, 2000));
    timers.push(setTimeout(() => { setDisplayValue(2); playSound("/gerisayim.mp3"); }, 3000));
    timers.push(setTimeout(() => { setDisplayValue(1); playSound("/gerisayim.mp3"); }, 4000));
    timers.push(setTimeout(() => { setDisplayValue("start"); playSound("/basla.mp3"); }, 5000));
    timers.push(setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    }, 5800));

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [onComplete]);

  // Get image source
  const getImageSrc = () => {
    if (displayValue === "start") return "/basla.png";
    return `/${displayValue === 5 ? "bes" : displayValue === 4 ? "dort" : displayValue === 3 ? "uc" : displayValue === 2 ? "iki" : "bir"}.png`;
  };

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
      }}
    >
      <img
        key={String(displayValue)}
        src={getImageSrc()}
        alt={String(displayValue)}
        style={{
          width: 280,
          height: 280,
          objectFit: "contain",
        }}
      />
    </div>,
    document.body
  );
});

GameCountdown.displayName = "GameCountdown";

export default GameCountdown;
