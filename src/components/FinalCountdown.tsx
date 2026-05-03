import { useEffect, useRef, memo } from "react";
import { isSoundEffectsEnabled } from "@/utils/soundSettings";

interface FinalCountdownProps {
  displayTime: number;
  onCountdownTick?: (second: number) => void;
}

const FinalCountdown = memo(({ displayTime, onCountdownTick }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);

  const showCountdown = displayTime >= 1 && displayTime <= 9;

  const playPitchSound = (secondsLeft: number) => {
    if (!isSoundEffectsEnabled()) return;
    try {
      console.log(`Ses tetiklendi! Saniye: ${secondsLeft}`);

      const audio = new Audio("/onsaniyegerisayim.mp3");

      const pitchRate = 1.0 + (9 - secondsLeft) * 0.25;

      // @ts-ignore
      audio.preservesPitch = false;
      // @ts-ignore
      audio.webkitPreservesPitch = false;
      audio.playbackRate = pitchRate;

      // Sesi çalmayı dene ve hatayı yakala
      audio
        .play()
        .then(() => console.log("Ses başarıyla çalındı"))
        .catch((err) => {
          console.error("SES ÇALMA BLOKLANDI! Muhtemelen sayfaya tıklamadın:", err);
        });
    } catch (error) {
      console.error("Audio objesi oluşturulurken hata:", error);
    }
  };

  useEffect(() => {
    if (showCountdown && displayTime !== lastTickRef.current) {
      lastTickRef.current = displayTime;

      // 1. Kendi beep sesimizi çal
      playPitchSound(displayTime);

      // 2. Click sesini kesmek için burayı kapalı tutmaya devam et
      // onCountdownTick?.(displayTime);
    }
  }, [displayTime, showCountdown]);

  if (!showCountdown) return null;

  return (
    <span
      className="font-mono font-black leading-none text-red-500"
      style={{
        display: "inline-block",
        fontFamily: "'Orbitron', sans-serif",
        fontSize: "7rem",
        textAlign: "center",
        textShadow: "0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(239,68,68,0.5)",
      }}
    >
      {displayTime}
    </span>
  );
});

FinalCountdown.displayName = "FinalCountdown";

export default FinalCountdown;
