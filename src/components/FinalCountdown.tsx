import { useEffect, useRef, memo } from "react";

interface FinalCountdownProps {
  displayTime: number;
  onCountdownTick?: (second: number) => void;
}

const FinalCountdown = memo(({ displayTime, onCountdownTick }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);

  // 9'dan 1'e kadar göster
  const showCountdown = displayTime >= 1 && displayTime <= 9;

  const playPitchSound = (secondsLeft: number) => {
    try {
      // Capacitor'da public klasöründeki dosyalara genelde '/' ile ulaşılır
      const audio = new Audio("/sounds/default.mp3");

      /**
       * PITCH (PERDE) AYARI:
       * 9 saniyede: 1.0 (Normal)
       * 1 saniyede: 1.8 (İnce/Hızlı)
       */
      const pitchRate = 1.0 + (9 - secondsLeft) * 0.1;

      // Sesi hızlandırarak perdesini yükseltiyoruz
      audio.playbackRate = pitchRate;

      // Bazı WebView'larda (özellikle iOS) sesin incelmesi için bu ayar gerekebilir:
      // @ts-ignore - preservesPitch her tarayıcıda standart olmayabilir
      if (audio.preservesPitch !== undefined) {
        // @ts-ignore
        audio.preservesPitch = false; // False yaparsak ses hızlandıkça incelir (Chipmunk etkisi)
      }

      audio.play().catch((err) => {
        console.warn("Ses çalma başarısız (Etkileşim eksik olabilir):", err);
      });
    } catch (error) {
      console.error("Audio objesi oluşturulamadı:", error);
    }
  };

  useEffect(() => {
    if (showCountdown && displayTime !== lastTickRef.current) {
      lastTickRef.current = displayTime;

      // Sesi çal
      playPitchSound(displayTime);

      // Tick callback'ini çalıştır
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
