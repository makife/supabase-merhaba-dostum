import { memo, useEffect, useRef } from "react";
import lottie, { AnimationItem } from "lottie-web";

interface Props {
  animationData: any;
  width: number;
  height: number;
  mountDelay?: number;
}

/**
 * Podyum çerçeve animasyonu.
 * - SVG yerine CANVAS renderer kullanır (yüzlerce DOM node yerine tek canvas → çok daha az jank).
 * - Sekme/görünürlük dışına çıkınca animasyonu durdurur.
 * - React re-render'larından bağımsız çalışır (memo + imperatif mount).
 */
const PodiumFrameLottieBase = ({ animationData, width, height, mountDelay = 0 }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationItem | null>(null);

  useEffect(() => {
    if (!containerRef.current || !animationData) return;

    let cancelled = false;
    const container = containerRef.current;

    // Sekme değişim commit'i sırasında üç ağır canvas'ı aynı anda kurmak yerine
    // her podyum animasyonunu ayrı bir task'ta başlat. Böylece dokunma/scroll
    // event'leri ana thread'de uzun süre beklemiyor.
    const timer = window.setTimeout(() => {
      if (cancelled || !container.isConnected) return;

      const anim = lottie.loadAnimation({
        container,
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
      anim.setSubframe(false);
      animRef.current = anim;
    }, mountDelay);

    const onVisibility = () => {
      if (document.hidden) animRef.current?.pause();
      else animRef.current?.play();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      const anim = animRef.current;
      anim?.pause();
      animRef.current = null;
      // destroy() büyük Lottie'lerde pahalıdır; React sekme geçiş commit'ini
      // bloke etmemesi için canvas sökümünü sonraki task'a bırak.
      if (anim) window.setTimeout(() => anim.destroy(), 0);
    };
  }, [animationData, mountDelay]);

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
  (a, b) =>
    a.animationData === b.animationData &&
    a.width === b.width &&
    a.height === b.height &&
    a.mountDelay === b.mountDelay,
);
