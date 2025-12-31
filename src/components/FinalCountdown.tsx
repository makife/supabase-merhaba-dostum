import { useEffect, useRef, memo } from "react";

interface FinalCountdownProps {
  displayTime: number;
  onCountdownTick?: (second: number) => void;
}

const FinalCountdown = memo(({ displayTime, onCountdownTick }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);

  const showCountdown = displayTime >= 1 && displayTime <= 9;

  // 1. FONKSİYON TANIMI (Component içinde olduğundan emin ol)
  const playPitchSound = (secondsLeft: number) => {
    try {
      // Dosya public klasöründe direkt durmalı: public/beep.mp3
      const audio = new Audio("/beep.mp3");

      // PITCH HESABI: 9'dan 1'e gittikçe 1.0'dan 3.0'a çıkar
      const pitchRate = 1.0 + (9 - secondsLeft) * 0.25;

      // Pitch inceltme ayarları
      // @ts-ignore
      audio.preservesPitch = false;
      // @ts-ignore
      audio.webkitPreservesPitch = false;

      audio.playbackRate = pitchRate;

      audio.play().catch((err) => {
        console.warn("Ses çalma hatası:", err);
      });
    } catch (error) {
      console.error("Ses dosyası bulunamadı veya Audio hatası:", error);
    }
  };

  // 2. USEEFFECT İÇİNDE ÇAĞRI
  useEffect(() => {
    if (showCountdown && displayTime !== lastTickRef.current) {
      lastTickRef.current = displayTime;

      // Kendi beep sesimizi çalıyoruz
      playPitchSound(displayTime);

      // NOT: Eğer hala "click" sesi duyuyorsan, aşağıdaki satırı yorum satırı yapıp dene.
      // Sorun büyük ihtimalle bu fonksiyonun çağrıldığı üst dosyada (Parent) gizli.
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
