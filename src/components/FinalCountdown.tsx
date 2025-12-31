import { useEffect, useRef, memo } from "react";

interface FinalCountdownProps {
  displayTime: number;
  onCountdownTick?: (second: number) => void;
}

const FinalCountdown = memo(({ displayTime, onCountdownTick }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const showCountdown = displayTime >= 1 && displayTime <= 9;

  // Ses üretme fonksiyonu
  const playCountdownSound = (secondsLeft: number) => {
    // İlk etkileşimde AudioContext'i başlat
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioCtxRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = "sine"; // Saf bir bip sesi için 'sine', daha dijital/retro için 'square'

    // FREKANS HESAPLAMA:
    // 9 saniyede 440Hz (La notası) ile başlar,
    // 1 saniyeye yaklaştıkça frekans artar.
    // Formül: Temel Frekans + (Kalan süre azaldıkça artan değer)
    const baseFreq = 440;
    const frequency = baseFreq + (10 - secondsLeft) * 80;

    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    // SES SEVİYESİ AYARI (Tıklama sesini önlemek için kısa bir fade-out)
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.1);
  };

  useEffect(() => {
    if (showCountdown && displayTime !== lastTickRef.current) {
      lastTickRef.current = displayTime;

      // Sesi çal
      playCountdownSound(displayTime);

      // Varsa diğer tick callback'ini çalıştır
      onCountdownTick?.(displayTime);
    }
  }, [displayTime, showCountdown, onCountdownTick]);

  if (!showCountdown) return null;

  return (
    <span
      className="font-mono font-black leading-none text-red-500"
      style={{
        fontFamily: "'Orbitron', 'Courier New', monospace",
        fontSize: "7rem",
        textShadow: "0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(239,68,68,0.5)",
      }}
    >
      {displayTime}
    </span>
  );
});

FinalCountdown.displayName = "FinalCountdown";

export default FinalCountdown;
