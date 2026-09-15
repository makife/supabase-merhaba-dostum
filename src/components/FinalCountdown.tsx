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
const FPS = 30;
const TOTAL_FRAMES = 306;
const SOUND_TOTAL_SECONDS = 10; // son10saniye.mp3 uzunluğu

const FinalCountdown = memo(({ displayTime }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const showCountdown = displayTime >= 1 && displayTime <= 10;

  // Sesi mevcut displayTime'a göre uygun offset ile başlat
  const startSoundFromCurrent = () => {
    if (!isSoundEffectsEnabled()) return;

    // Web: HTML5 Audio ile offset destekli çal (mid-play resume için)
    if (typeof window !== "undefined") {
      try {
        // Önceki instance'ı temizle
        if (audioRef.current) {
          try {
            audioRef.current.pause();
          } catch {
            /* ignore */
          }
          audioRef.current = null;
        }
        const audio = new Audio("/son10saniye.mp3");
        audio.volume = 0.7;
        // displayTime === 11 → offset 0, 10 → 1, 9 → 2, ...
        const offset = Math.max(0, Math.min(SOUND_TOTAL_SECONDS - 0.05, 10 - displayTime));
        const play = () => {
          try {
            audio.currentTime = offset;
          } catch {
            /* ignore */
          }
          audio.play().catch(() => {
            // Fallback: native path
            playNativeSound("son_on_saniye", 0.7).catch(() => {});
          });
        };
        if (audio.readyState >= 1) {
          play();
        } else {
          audio.addEventListener("loadedmetadata", play, { once: true });
        }
        audioRef.current = audio;
        return;
      } catch {
        /* iOS/Native yolu deneriz */
      }
    }

    playNativeSound("son_on_saniye", 0.7).catch(() => {});
  };

  // displayTime'a göre başlangıç / senkron
  useEffect(() => {
    if (displayTime !== lastTickRef.current) {
      lastTickRef.current = displayTime;

      // 10 saniyelik mp3'ü 10 saniye kala başlat
      if (displayTime === 10) {
        startSoundFromCurrent();
      }

      // Lottie'yi her saniye senkronize et
      if (showCountdown) {
        const targetFrame = Math.min(TOTAL_FRAMES - 1, (10 - displayTime) * FPS);
        try {
          lottieRef.current?.goToAndPlay(targetFrame, true);
        } catch {
          /* ignore */
        }
      }
    }
  }, [displayTime, showCountdown]);

  // Ses efekti aç/kapa toggle'ına anlık tepki ver
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled: boolean }>).detail;
      const enabled = detail?.enabled ?? isSoundEffectsEnabled();
      const inWindow = displayTime >= 1 && displayTime <= 10;

      if (!enabled) {
        // Kapatıldı → yerel audio'yu sustur
        if (audioRef.current) {
          try {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          } catch {
            /* ignore */
          }
          audioRef.current = null;
        }
      } else if (inWindow) {
        // Açıldı ve hâlâ geri sayımdayız → sesi doğru offset'ten başlat
        startSoundFromCurrent();
      }
    };
    window.addEventListener("soundEffectsToggled", handleToggle as EventListener);
    return () =>
      window.removeEventListener("soundEffectsToggled", handleToggle as EventListener);
    // displayTime'ı da bağımlılığa alıp handler her zaman güncel değerle çalışsın
  }, [displayTime]);

  // Component unmount olursa ya da countdown penceresi kapanırsa sesi durdur
  useEffect(() => {
    if (!showCountdown && displayTime < 1) {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch {
          /* ignore */
        }
        audioRef.current = null;
      }
    }
    return () => {
      // final unmount temizliği
      if (displayTime < 1 && audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          /* ignore */
        }
        audioRef.current = null;
      }
    };
  }, [showCountdown, displayTime]);

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
