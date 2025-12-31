import { useEffect, useRef, memo } from "react";

interface FinalCountdownProps {
  displayTime: number;
  onCountdownTick?: (second: number) => void;
}

const FinalCountdown = memo(({ displayTime, onCountdownTick }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);

  const showCountdown = displayTime >= 1 && displayTime <= 9;

  const playPitchSound = (secondsLeft: number) => {
    try {
      // Dosya yolu artık direkt kök dizinde: public/beep.mp3
      const audio = new Audio("/beep.mp3");

      /**
       * PITCH HESABI:
       * 9 saniyede hız 1.0 (Normal ses)
       * 1 saniyeye yaklaştıkça hız 3.0'a çıkar (Çok ince ses)
       */
      const pitchRate = 1.0 + (9 - secondsLeft) * 0.25;

      // Tarayıcının sesi kalınlaştırmasını (tonu korumasını) engelliyoruz
      // @ts-ignore
      audio.preservesPitch = false;
      // @ts-ignore
      audio.webkitPreservesPitch = false;

      audio.playbackRate = pitchRate;

      audio.play().catch((err) => {
        console.warn("Ses çalma hatası (Muhtemelen etkileşim yok):", err);
      });
    } catch (error) {
      console.error("Audio objesi hatası:", error);
    }
  };

  useEffect(() => {
    if (showCountdown && displayTime !== lastTickRef.current) {
      lastTickRef.current = displayTime;
      playPitchSound(displayTime);
      onCountdownTick?.(displayTime);
    }
  }, [displayTime, showCountdown, onCountdownTick]);

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
