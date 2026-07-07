import { useEffect, useRef, memo } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { Capacitor } from "@capacitor/core";
import { isSoundEffectsEnabled } from "@/utils/soundSettings";
import { playPitchedBeep, preloadPitchedBeep } from "@/services/pitchedBeepService";
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
const BEEP_URL = "/onsaniyegerisayim.mp3";

// Modül yüklendiğinde sesi preload et — ilk tıkın gecikmemesi için
preloadPitchedBeep(BEEP_URL).catch(() => {});

const FinalCountdown = memo(({ displayTime, onCountdownTick }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  const showCountdown = displayTime >= 1 && displayTime <= 10;

  const playPitchSound = (secondsLeft: number) => {
    if (!isSoundEffectsEnabled()) return;
    // Web Audio API hem iOS/Android native hem web'de playbackRate'i destekler.
    // NativeAudio plugin'i pitch desteklemediği için tüm platformlarda burayı kullanıyoruz.
    const pitchRate = 1.0 + (10 - secondsLeft) * 0.22;
    playPitchedBeep(BEEP_URL, pitchRate, 0.7).catch((err) =>
      console.error("Pitched beep hatası:", err)
    );
  };

  useEffect(() => {
    if (showCountdown && displayTime !== lastTickRef.current) {
      lastTickRef.current = displayTime;
      playPitchSound(displayTime);

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
