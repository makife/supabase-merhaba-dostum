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
      // Dosya adını beep.mp3 yaptık
      const audio = new Audio("/sounds/beep.mp3");

      /**
       * PITCH HESABI (Daha Agresif):
       * 9 saniye -> 1.0x (Normal)
       * 5 saniye -> 2.0x (İnce)
       * 1 saniye -> 3.0x (Çok Tiz)
       */
      const pitchRate = 1.0 + (9 - secondsLeft) * 0.25;

      // --- PITCH İNCELMESİ İÇİN KRİTİK AYARLAR ---
      // @ts-ignore
      audio.preservesPitch = false;
      // @ts-ignore
      audio.webkitPreservesPitch = false; // iOS/Capacitor/Safari için
      // @ts-ignore
      audio.mozPreservesPitch = false;

      audio.playbackRate = pitchRate;

      audio.play().catch((err) => {
        console.warn("Ses çalınamadı (Etkileşim eksik):", err);
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
