import { useCallback, useEffect, useState } from "react";
import { useSounds } from "@/hooks/useSounds";

const storageKey = (id: string) => `challenge-mute-${id}`;

const readMuted = (id: string): boolean => {
  try {
    return localStorage.getItem(storageKey(id)) === "1";
  } catch {
    return false;
  }
};

/**
 * Per-mini-oyun ses kısma. Sadece o mini oyun içindeki seslere etki eder;
 * global ses efekti ayarını değiştirmez.
 */
export const useGameMute = (gameId: string) => {
  const sounds = useSounds();
  const [muted, setMuted] = useState<boolean>(() => readMuted(gameId));

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (!detail || detail.id === gameId) {
        setMuted(readMuted(gameId));
      }
    };
    window.addEventListener("gameMuteChanged", handler as EventListener);
    return () => window.removeEventListener("gameMuteChanged", handler as EventListener);
  }, [gameId]);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey(gameId), next ? "1" : "0");
      } catch {}
      window.dispatchEvent(
        new CustomEvent("gameMuteChanged", { detail: { id: gameId } })
      );
      return next;
    });
  }, [gameId]);

  const playSound: typeof sounds.playSound = useCallback(
    (...args) => {
      if (muted) return Promise.resolve() as any;
      return sounds.playSound(...(args as Parameters<typeof sounds.playSound>));
    },
    [muted, sounds]
  );

  return { muted, toggleMuted, playSound };
};
