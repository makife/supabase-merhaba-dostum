import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Lottie from "lottie-react";
import { motion, useAnimationControls } from "framer-motion";

interface ScorePopProps {
  /** Güncel skor. Artınca animasyon tetiklenir. */
  score: number;
  /** Patlama/saçılma Lottie JSON'u (benimSkor.json / rakipSkor.json) */
  burstAnimation: object;
  /** Lottie'nin px cinsinden kare boyutu */
  burstSize?: number;
  /** Lottie başladığı anda çağrılır (ses çalmak için) */
  onBurst?: () => void;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const GROW_DURATION = 0.3; // sn: büyüme
const SHRINK_DURATION = 0.05; // sn: eski boyuta dönüş
const GROW_SCALE = 1.5; // +%50

/**
 * Skor artınca:
 * 1) 0.3 sn'de %50 büyür
 * 2) 0.05 sn'de eski boyutuna döner
 * 3) döner dönmez Lottie skorun bulunduğu noktadan oynar, etrafa saçılır
 *    (Lottie portal ile body'ye çizilir, bu yüzden kartın dışına taşabilir)
 */
export default function ScorePop({
  score,
  burstAnimation,
  burstSize = 220,
  onBurst,
  className,
  style,
  children,
}: ScorePopProps) {
  const controls = useAnimationControls();
  const prevScoreRef = useRef(score);
  const runIdRef = useRef(0);
  const onBurstRef = useRef(onBurst);
  onBurstRef.current = onBurst;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [burst, setBurst] = useState<{ key: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const prev = prevScoreRef.current;
    prevScoreRef.current = score;

    // Sadece artışta çalış (sıfırlama / ilk mount'ta çalışmasın)
    if (score <= prev) return;

    const runId = ++runIdRef.current;
    setBurst(null); // önceki patlamayı kes

    (async () => {
      controls.stop();
      controls.set({ scale: 1 });
      await controls.start({
        scale: GROW_SCALE,
        transition: { duration: GROW_DURATION, ease: "easeOut" },
      });
      if (runId !== runIdRef.current) return; // araya yeni puan girdiyse iptal
      await controls.start({
        scale: 1,
        transition: { duration: SHRINK_DURATION, ease: "easeIn" },
      });
      if (runId !== runIdRef.current) return;
      // eski boyuta döner dönmez Lottie başlar (skorun merkezinden)
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setBurst({ key: runId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      onBurstRef.current?.(); // ses Lottie ile aynı anda başlar
    })().catch(() => {});
  }, [score, controls]);

  useEffect(() => () => controls.stop(), [controls]);

  return (
    <div ref={wrapRef} className="relative inline-block">
      {burst !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed"
            style={{
              left: burst.x,
              top: burst.y,
              width: burstSize,
              height: burstSize,
              transform: "translate(-50%, -50%)",
              zIndex: 9999,
            }}
          >
            <Lottie
              key={burst.key}
              animationData={burstAnimation}
              loop={false}
              autoplay
              onComplete={() => setBurst(null)}
              style={{ width: "100%", height: "100%" }}
            />
          </div>,
          document.body,
        )}
      <motion.p
        animate={controls}
        initial={{ scale: 1 }}
        className={`relative ${className ?? ""}`}
        style={{ ...style, transformOrigin: "center center" }}
      >
        {children ?? score}
      </motion.p>
    </div>
  );
}
