import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Lottie from "lottie-react";
import { motion, useAnimationControls } from "framer-motion";

interface ScorePopProps {
  /** Güncel skor. Artınca animasyon tetiklenir. */
  score: number;
  /** Patlama/saçılma Lottie JSON'u (benimSkor.json / rakipSkor.json) */
  burstAnimation: object;
  /** Lottie'nin px cinsinden kare boyutu */
  burstSize?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const GROW_DURATION = 0.5; // sn: büyüme
const SHRINK_DURATION = 0.2; // sn: eski boyuta dönüş
const GROW_SCALE = 1.25; // +%25 (şimdiki ebatın 4'te 1'i kadar)

/**
 * Skor artınca:
 * 1) 0.5 sn'de %25 büyür
 * 2) 0.2 sn'de eski boyutuna döner
 * 3) döner dönmez Lottie skorun altından (arkasından) oynar, etrafa saçılır
 */
export default function ScorePop({
  score,
  burstAnimation,
  burstSize = 150,
  className,
  style,
  children,
}: ScorePopProps) {
  const controls = useAnimationControls();
  const prevScoreRef = useRef(score);
  const runIdRef = useRef(0);
  const [burstKey, setBurstKey] = useState<number | null>(null);

  useEffect(() => {
    const prev = prevScoreRef.current;
    prevScoreRef.current = score;

    // Sadece artışta çalış (sıfırlama / ilk mount'ta çalışmasın)
    if (score <= prev) return;

    const runId = ++runIdRef.current;
    setBurstKey(null); // önceki patlamayı kes

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
      setBurstKey(runId); // eski boyuta döner dönmez Lottie başlar
    })().catch(() => {});
  }, [score, controls]);

  useEffect(() => () => controls.stop(), [controls]);

  return (
    <div className="relative inline-block">
      {burstKey !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2"
          style={{
            width: burstSize,
            height: burstSize,
            transform: "translate(-50%, -50%)",
            zIndex: 0,
          }}
        >
          <Lottie
            key={burstKey}
            animationData={burstAnimation}
            loop={false}
            autoplay
            onComplete={() => setBurstKey(null)}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
      <motion.p
        animate={controls}
        initial={{ scale: 1 }}
        className={`relative ${className ?? ""}`}
        style={{ ...style, zIndex: 1, transformOrigin: "center center" }}
      >
        {children ?? score}
      </motion.p>
    </div>
  );
}
