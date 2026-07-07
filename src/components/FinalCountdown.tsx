import { useEffect, useRef, memo } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { isSoundEffectsEnabled } from "@/utils/soundSettings";
import { playNativeSound } from "@/services/nativeAudioService";
import sonOnSaniyeAnim from "@/assets/sonOnSaniye.json";

interface FinalCountdownProps {
  displayTime: number;
  onCountdownTick?: (second: number) => void;
}

// Lottie file: 30fps, 306 frames (~10s). Each second = 30 frames.
// displayTime range we display: 9 → 1
const FPS = 30;
const TOTAL_FRAMES = 306;

const FinalCountdown = memo(({ displayTime, onCountdownTick }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  const showCountdown = displayTime >= 1 && displayTime <= 10;

  useEffect(() => {
    if (showCountdown && displayTime !== lastTickRef.current) {
      const prev = lastTickRef.current;
      lastTickRef.current = displayTime;

      // 10 saniyelik mp3'ü SADECE bir kez, geri sayımın başında çal.
      // Böylece maç bittikten sonra devam etmez.
      const isStart = prev === null || prev < displayTime || displayTime === 10;
      if (isStart && isSoundEffectsEnabled()) {
        playNativeSound("son_on_saniye", 0.7).catch((err) =>
          console.error("son10saniye çalma hatası:", err)
        );
      }

      // Lottie'yi her saniye senkronize et: displayTime=10 → frame 0, =9 → 30, ...
      const targetFrame = Math.min(TOTAL_FRAMES - 1, (10 - displayTime) * FPS);
      try {
        lottieRef.current?.goToAndPlay(targetFrame, true);
      } catch {}
    }
  }, [displayTime, showCountdown]);

  if (!showCountdown) return null;

  return (
    <div
      style={{
        display: "inline-block",
        width: "16rem",
        height: "16rem",
        pointerEvents: "none",
      }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={sonOnSaniyeAnim}
        loop={false}
        autoplay={false}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
});

FinalCountdown.displayName = "FinalCountdown";

export default FinalCountdown;
