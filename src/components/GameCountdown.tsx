import { useEffect, useRef, memo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion"; // EKLENDİ

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
 * * Uses server-authoritative timing:
 * - serverStartTime: when countdown begins
 * - Calculates remaining time passively: remaining = (serverStartTime + 5000) - serverNow
 * - NEVER resets - if time already passed, shows appropriate state
 * - Both clients calculate the SAME value at the SAME wall-clock moment
 */
const GameCountdown = memo(({ onComplete, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [displayValue, setDisplayValue] = useState<number | "start" | null>(null);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);
  // lastPlayedSecondRef unused variable removed clean up
  const startShownRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundPlayedRef = useRef<Set<number>>(new Set()); // Her saniye için sadece bir ses çal

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
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

    // Reset sound tracking
    soundPlayedRef.current.clear();

    // If no server time provided, use legacy client-side mode
    if (!serverStartTime) {
      console.log("⏱️ GameCountdown: Legacy client-side mode (no serverStartTime)");

      setDisplayValue(5);
      playSound("/gerisayim.mp3");
      soundPlayedRef.current.add(5);

      const timers: NodeJS.Timeout[] = [];
      timers.push(
        setTimeout(() => {
          if (mountedRef.current && !soundPlayedRef.current.has(4)) {
            setDisplayValue(4);
            playSound("/gerisayim.mp3");
            soundPlayedRef.current.add(4);
          }
        }, 1000),
      );
      timers.push(
        setTimeout(() => {
          if (mountedRef.current && !soundPlayedRef.current.has(3)) {
            setDisplayValue(3);
            playSound("/gerisayim.mp3");
            soundPlayedRef.current.add(3);
          }
        }, 2000),
      );
      timers.push(
        setTimeout(() => {
          if (mountedRef.current && !soundPlayedRef.current.has(2)) {
            setDisplayValue(2);
            playSound("/gerisayim.mp3");
            soundPlayedRef.current.add(2);
          }
        }, 3000),
      );
      timers.push(
        setTimeout(() => {
          if (mountedRef.current && !soundPlayedRef.current.has(1)) {
            setDisplayValue(1);
            playSound("/gerisayim.mp3");
            soundPlayedRef.current.add(1);
          }
        }, 4000),
      );
      timers.push(
        setTimeout(() => {
          if (mountedRef.current && !startShownRef.current) {
            setDisplayValue("start");
            playSound("/basla.mp3");
            startShownRef.current = true;
          }
        }, 5000),
      );
      timers.push(
        setTimeout(() => {
          if (!completedRef.current && mountedRef.current) {
            completedRef.current = true;
            onComplete();
          }
        }, 5800),
      );

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

    // Calculate initial state
    const serverNow = Date.now() + serverTimeOffset;
    const initialRemaining = Math.ceil((endTimeMs - serverNow) / 1000);

    console.log("⏱️ GameCountdown: Initial calculation", {
      serverNow: new Date(serverNow).toISOString(),
      endTime: new Date(endTimeMs).toISOString(),
      initialRemaining,
    });

    // 🔒 KRİTİK: İlk görüntüleme değeri HER ZAMAN 5 olmalı
    if (initialRemaining >= 5) {
      setDisplayValue(5);
      if (!soundPlayedRef.current.has(5)) {
        playSound("/gerisayim.mp3");
        soundPlayedRef.current.add(5);
      }
    } else if (initialRemaining >= 1 && initialRemaining <= 4) {
      setDisplayValue(initialRemaining);
      if (!soundPlayedRef.current.has(initialRemaining)) {
        playSound("/gerisayim.mp3");
        soundPlayedRef.current.add(initialRemaining);
      }
    } else if (initialRemaining <= 0 && initialRemaining > -1) {
      if (!startShownRef.current) {
        setDisplayValue("start");
        playSound("/basla.mp3");
        startShownRef.current = true;
      }
    } else {
      setDisplayValue(5);
    }

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
        if (!startShownRef.current) {
          startShownRef.current = true;
          setDisplayValue("start");
          playSound("/basla.mp3");
        }
      } else if (remainingSeconds >= 1 && remainingSeconds <= 5) {
        setDisplayValue(remainingSeconds);

        if (!soundPlayedRef.current.has(remainingSeconds)) {
          soundPlayedRef.current.add(remainingSeconds);
          playSound("/gerisayim.mp3");
        }
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [onComplete, serverStartTime, serverTimeOffset]);

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
        overflow: "hidden", // Animasyon ekran dışına taşarken scroll çıkmasın
      }}
    >
      <AnimatePresence mode="wait">
        {displayValue === "start" ? (
          // --- BAŞLA ANİMASYONU ---
          // Soldan gir -> Ortada dur -> Sağdan çık
          <motion.img
            key="start-image"
            src="/basla.png"
            alt="Başla"
            initial={{ x: "-100vw", opacity: 0 }} // Başlangıç konumu (ekranın solu)
            animate={{
              x: ["-100vw", "0%", "0%", "100vw"], // Keyframes: Sol -> Orta -> Orta -> Sağ
              opacity: [1, 1, 1, 1],
            }}
            transition={{
              duration: 0.8, // START_DISPLAY_DURATION_MS (800ms) ile eşleşmeli
              times: [0, 0.2, 0.7, 1], // Zamanlama: %20 giriş, %50 bekleme, %30 çıkış
              ease: "easeInOut",
            }}
            style={{
              width: 320, // Biraz daha büyük daha etkileyici durur
              height: 320,
              objectFit: "contain",
              willChange: "transform",
            }}
          />
        ) : (
          // --- GERİ SAYIM ANİMASYONU (5-4-3-2-1) ---
          // Pop-in efekti
          <motion.img
            key={displayValue} // Key değiştiğinde animasyon tekrar tetiklenir
            src={
              displayValue === 5
                ? "/bes.png"
                : displayValue === 4
                  ? "/dort.png"
                  : displayValue === 3
                    ? "/uc.png"
                    : displayValue === 2
                      ? "/iki.png"
                      : "/bir.png"
            }
            alt={String(displayValue)}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 300 }}
            style={{
              width: 280,
              height: 280,
              objectFit: "contain",
            }}
          />
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
});

GameCountdown.displayName = "GameCountdown";

export default GameCountdown;
