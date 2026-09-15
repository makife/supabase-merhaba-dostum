import React from "react";
import { useGameMute } from "@/hooks/useGameMute";

interface GameMuteButtonProps {
  gameId: string;
  className?: string;
  size?: number;
}

/**
 * Mini oyun için ses kısma/açma düğmesi. Sadece o mini oyunun seslerini kısar.
 */
export const GameMuteButton: React.FC<GameMuteButtonProps> = ({
  gameId,
  className = "",
  size = 40,
}) => {
  const { muted, toggleMuted } = useGameMute(gameId);
  const icon = muted ? "/icons/seskapali-gorsel.svg" : "/icons/sesacik-gorsel.svg";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleMuted();
      }}
      aria-label={muted ? "Oyun sesini aç" : "Oyun sesini kıs"}
      title={muted ? "Oyun sesini aç" : "Oyun sesini kıs"}
      className={`inline-flex items-center justify-center rounded-2xl bg-white/10 border border-white/10 active:scale-90 transition-transform ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={icon}
        alt=""
        style={{ width: size * 0.6, height: size * 0.6, pointerEvents: "none" }}
        draggable={false}
      />
    </button>
  );
};

export default GameMuteButton;
