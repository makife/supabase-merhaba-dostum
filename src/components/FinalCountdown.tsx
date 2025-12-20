import { useEffect, useRef, memo } from "react";

interface FinalCountdownProps {
  displayTime: number;
  onCountdownTick?: (second: number) => void;
}

/**
 * Son 9 saniye için basit ve optimize geri sayım
 * Profil kartları arasında gösterilir
 */
const FinalCountdown = memo(({ displayTime, onCountdownTick }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);
  
  // 9'dan 1'e kadar göster (0'da oyun biter)
  const showCountdown = displayTime >= 1 && displayTime <= 9;
  
  useEffect(() => {
    if (showCountdown && displayTime !== lastTickRef.current) {
      lastTickRef.current = displayTime;
      onCountdownTick?.(displayTime);
    }
  }, [displayTime, showCountdown, onCountdownTick]);

  if (!showCountdown) return null;

  const isUrgent = displayTime <= 3;

  return (
    <span
      className={`
        font-mono font-black leading-none
        ${isUrgent ? "text-red-500" : "text-orange-400"}
      `}
      style={{
        fontFamily: "'Orbitron', 'Courier New', monospace",
        fontSize: '6rem',
        textShadow: isUrgent
          ? '0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(239,68,68,0.5)'
          : '0 0 30px rgba(251,146,60,0.8), 0 0 60px rgba(251,146,60,0.5)',
      }}
    >
      {displayTime}
    </span>
  );
});

FinalCountdown.displayName = 'FinalCountdown';

export default FinalCountdown;
