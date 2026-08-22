import { useCallback, useEffect, useRef } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import aiRoboAnimation from "@/assets/AI_robo.json";

export type RematchStatus = "idle" | "waiting" | "accepted" | "declined";

/** AI_robo.json içindeki marker'lara karşılık gelen frame aralıkları (fr=60). */
const SEGMENTS = {
  thinking: [271, 390] as [number, number],
  alert: [181, 270] as [number, number],
  yes: [31, 105] as [number, number],
  no: [106, 180] as [number, number],
};

// İlk 10 katman animasyondaki yazılar ve onların arka plan plakalarıdır.
// Kontrol katmanları ile robot çizimini koruyup yalnızca robotu gösteriyoruz.
const robotOnlyAnimation = {
  ...aiRoboAnimation,
  layers: aiRoboAnimation.layers.filter((layer) => layer.ind >= 11),
};

interface RematchRoboAnimationProps {
  /** "waiting" -> thinking/alert döngüsü, "accepted" -> yes, "declined" -> no */
  status: Exclude<RematchStatus, "idle">;
  /** yes/no animasyonu bittiğinde çağrılır (örn. kartı otomatik kapatmak için) */
  onResultFinished?: () => void;
  size?: number;
}

export function RematchRoboAnimation({
  status,
  onResultFinished,
  size = 140,
}: RematchRoboAnimationProps) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const waitingPhase = useRef<"thinking" | "alert">("thinking");

  const playCurrentSegment = useCallback(() => {
    if (status === "waiting") {
      waitingPhase.current = "thinking";
      lottieRef.current?.playSegments(SEGMENTS.thinking, true);
    } else if (status === "accepted") {
      lottieRef.current?.playSegments(SEGMENTS.yes, true);
    } else {
      lottieRef.current?.playSegments(SEGMENTS.no, true);
    }
  }, [status]);

  useEffect(() => {
    playCurrentSegment();
  }, [playCurrentSegment]);

  const handleComplete = () => {
    if (status === "waiting") {
      // rakibin cevabı gelene kadar thinking <-> alert dönüşü
      waitingPhase.current = waitingPhase.current === "thinking" ? "alert" : "thinking";
      lottieRef.current?.playSegments(SEGMENTS[waitingPhase.current], true);
      return;
    }
    // yes / no bir kere oynadı, durdu
    onResultFinished?.();
  };

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={robotOnlyAnimation}
      loop={false}
      autoplay={false}
      onDOMLoaded={playCurrentSegment}
      onComplete={handleComplete}
      style={{ width: size, height: size }}
    />
  );
}
