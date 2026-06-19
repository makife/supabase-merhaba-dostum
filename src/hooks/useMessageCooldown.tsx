import { useState, useEffect, useCallback, useRef } from "react";

const COOLDOWN_SECONDS = 5;

export function useMessageCooldown() {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startCooldown = useCallback(() => {
    setCooldownRemaining(COOLDOWN_SECONDS);
  }, []);

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [cooldownRemaining]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const isCoolingDown = cooldownRemaining > 0;

  return { cooldownRemaining, isCoolingDown, startCooldown };
}
