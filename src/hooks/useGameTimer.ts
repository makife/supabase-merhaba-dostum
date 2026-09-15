import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Production-ready Game Timer Hook
 * 
 * Timestamp-based timer - setInterval'a bağlı değil.
 * Server authoritative: endsAt timestamp'i verilir, remaining hesaplanır.
 * 
 * Avantajları:
 * - Tab switch, background'da çalışma sorunları yok
 * - Re-render'larda reset olmaz
 * - İki client aynı endsAt ile aynı süreyi görür
 */

interface UseGameTimerOptions {
  onTimeUp?: () => void;
  onWarning?: (secondsLeft: number) => void;
  warningThreshold?: number; // Varsayılan 15 saniye
}

export function useGameTimer(options: UseGameTimerOptions = {}) {
  const { onTimeUp, onWarning, warningThreshold = 15 } = options;
  
  const [displayTime, setDisplayTime] = useState<number>(120);
  const [isRunning, setIsRunning] = useState(false);
  
  const endsAtRef = useRef<number | null>(null);
  const warningFiredRef = useRef(false);
  const timeUpFiredRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer'ı başlat
  const start = useCallback((endsAtTimestamp: number) => {
    console.log("⏱️ Timer starting, ends at:", new Date(endsAtTimestamp).toISOString());
    
    endsAtRef.current = endsAtTimestamp;
    warningFiredRef.current = false;
    timeUpFiredRef.current = false;
    setIsRunning(true);
  }, []);

  // Timer'ı durdur
  const stop = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Timer'ı sıfırla
  const reset = useCallback((initialTime: number = 120) => {
    stop();
    endsAtRef.current = null;
    warningFiredRef.current = false;
    timeUpFiredRef.current = false;
    setDisplayTime(initialTime);
  }, [stop]);

  // Ana timer loop
  useEffect(() => {
    if (!isRunning || !endsAtRef.current) {
      return;
    }

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endsAtRef.current! - now) / 1000));
      
      setDisplayTime(remaining);

      // Warning callback
      if (remaining <= warningThreshold && remaining > 0 && !warningFiredRef.current) {
        warningFiredRef.current = true;
        onWarning?.(remaining);
      }

      // Time up callback
      if (remaining <= 0 && !timeUpFiredRef.current) {
        timeUpFiredRef.current = true;
        setIsRunning(false);
        onTimeUp?.();
      }
    };

    // İlk tick hemen
    tick();

    // Interval ile güncelle
    intervalRef.current = setInterval(tick, 200); // 200ms - smooth update

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, onTimeUp, onWarning, warningThreshold]);

  // Format helpers
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    displayTime,
    formattedTime: formatTime(displayTime),
    isRunning,
    isWarning: displayTime <= warningThreshold && displayTime > 0,
    start,
    stop,
    reset,
  };
}
