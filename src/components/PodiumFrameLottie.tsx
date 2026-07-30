import { memo, useEffect, useRef } from "react";
import lottie, { AnimationItem } from "lottie-web";

interface Props {
  animationData: any;
  width: number;
  height: number;
}

/**
 * Podyum çerçeve animasyonu.
 * - SVG yerine CANVAS renderer kullanır (yüzlerce DOM node yerine tek canvas → çok daha az jank).
 * - Sekme/görünürlük dışına çıkınca animasyonu durdurur.
 * - React re-render'larından bağımsız çalışır (memo + imperatif mount).
 */
const PodiumFrameLottieBase = ({ animationData, width, height }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current || !animationData) return;

    const anim = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "canvas",
      loop: true,
      autoplay: true,
      animationData,
      rendererSettings: {
        preserveAspectRatio: "xMidYMid meet",
        clearCanvas: true,
        progressiveLoad: true,
      } as any,
    });
    // Ağır animasyonlarda CPU'yu düşürmek için kare hızını sınırla
    anim.setSubframe(false);
    animRef.current = anim;

    const onVisibility = () => {
      if (document.hidden) anim.pause();
      else anim.play();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      anim.destroy();
      animRef.current = null;
    };
  }, [animationData]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        pointerEvents: "none",
        contain: "strict",
      }}
    />
  );
};

export const PodiumFrameLottie = memo(
  PodiumFrameLottieBase,
  (a, b) => a.animationData === b.animationData && a.width === b.width && a.height === b.height,
);
