import { useEffect, useRef, memo, useState } from "react";
import { createPortal } from "react-dom";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  /** Server timestamp when countdown STARTS (not ends) - countdown lasts 5 seconds */
  serverStartTime?: string | null;
  /** Local offset to sync with server time */
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

const COUNTDOWN_DURATION_MS = 5000; // 5 seconds countdown
const START_DISPLAY_DURATION_MS = 800; // Show "start" for 800ms

/**
 * Production-ready countdown component
 * 
 * Uses server-authoritative timing:
 * - serverStartTime: when countdown begins
 * - Calculates remaining time passively: remaining = (serverStartTime + 5000) - serverNow
 * - NEVER resets - if time already passed, shows appropriate state
 * - Both clients calculate the SAME value at the SAME wall-clock moment
 */
const GameCountdown = memo(({ onComplete, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [displayValue, setDisplayValue] = useState<number | "start" | null>(5);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  const lastPlayedSecondRef = useRef<number | null>(null);
  const startShownRef = useRef(false);
  // 🔧 setInterval kullan - requestAnimationFrame tab arka planda durur
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Prevent running after completion
    if (completedRef.current) {
      console.log("⏱️ GameCountdown: Already completed, skipping");
      return;
    }

    const playSound = (src: string) => {
      try {
        const audio = new Audio(src);
        audio.volume = 0.6;
        audio.play().catch(() => {});
      } catch {}
    };

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // If no server time provided, use legacy client-side mode
    if (!serverStartTime) {
      console.log("⏱️ GameCountdown: Legacy client-side mode (no serverStartTime)");
      
      setDisplayValue(5);
      playSound("/gerisayim.mp3");
      lastPlayedSecondRef.current = 5;
      
      const timers: NodeJS.Timeout[] = [];
      timers.push(setTimeout(() => { if (mountedRef.current) { setDisplayValue(4); playSound("/gerisayim.mp3"); } }, 1000));
      timers.push(setTimeout(() => { if (mountedRef.current) { setDisplayValue(3); playSound("/gerisayim.mp3"); } }, 2000));
      timers.push(setTimeout(() => { if (mountedRef.current) { setDisplayValue(2); playSound("/gerisayim.mp3"); } }, 3000));
      timers.push(setTimeout(() => { if (mountedRef.current) { setDisplayValue(1); playSound("/gerisayim.mp3"); } }, 4000));
      timers.push(setTimeout(() => { if (mountedRef.current) { setDisplayValue("start"); playSound("/basla.mp3"); } }, 5000));
      timers.push(setTimeout(() => {
        if (!completedRef.current && mountedRef.current) {
          completedRef.current = true;
          onComplete();
        }
      }, 5800));

      return () => {
        timers.forEach(clearTimeout);
      };
    }

    // Server-authoritative mode
    const startTimeMs = new Date(serverStartTime).getTime();
    const endTimeMs = startTimeMs + COUNTDOWN_DURATION_MS;
    
    console.log("⏱️ GameCountdown: Server-authoritative mode starting", {
      serverStartTime,
      startTimeMs,
      endTimeMs: new Date(endTimeMs).toISOString(),
      serverTimeOffset,
    });
    
    // Play initial sound
    const serverNow = Date.now() + serverTimeOffset;
    const initialRemaining = Math.ceil((endTimeMs - serverNow) / 1000);
    if (initialRemaining >= 1 && initialRemaining <= 5) {
      setDisplayValue(initialRemaining);
      playSound("/gerisayim.mp3");
      lastPlayedSecondRef.current = initialRemaining;
    }
    
    // Use setInterval for consistent updates (doesn't pause in background)
    intervalRef.current = setInterval(() => {
      if (completedRef.current || !mountedRef.current) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      
      const serverNow = Date.now() + serverTimeOffset;
      const remainingMs = endTimeMs - serverNow;
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      
      if (remainingMs <= -START_DISPLAY_DURATION_MS) {
        // Countdown finished 800ms ago - complete
        if (!completedRef.current) {
          completedRef.current = true;
          console.log("⏱️ GameCountdown: Completed");
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onComplete();
        }
        return;
      }
      
      if (remainingMs <= 0 && remainingMs > -START_DISPLAY_DURATION_MS) {
        // Show "start" for 800ms after countdown ends
        if (!startShownRef.current) {
          startShownRef.current = true;
          setDisplayValue("start");
          playSound("/basla.mp3");
        }
      } else if (remainingSeconds >= 1 && remainingSeconds <= 5) {
        // Show countdown number (5, 4, 3, 2, 1)
        setDisplayValue(remainingSeconds);
        
        // Play sound only once per second
        if (lastPlayedSecondRef.current !== remainingSeconds) {
          lastPlayedSecondRef.current = remainingSeconds;
          playSound("/gerisayim.mp3");
        }
      }
    }, 50); // 50ms interval for smooth updates
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [onComplete, serverStartTime, serverTimeOffset]);

  // Get image source
  const getImageSrc = () => {
    if (displayValue === "start") return "/basla.png";
    if (displayValue === 5) return "/bes.png";
    if (displayValue === 4) return "/dort.png";
    if (displayValue === 3) return "/uc.png";
    if (displayValue === 2) return "/iki.png";
    if (displayValue === 1) return "/bir.png";
    return "/bes.png"; // fallback
  };

  // Don't render if no value yet
  if (displayValue === null) {
    return null;
  }

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
