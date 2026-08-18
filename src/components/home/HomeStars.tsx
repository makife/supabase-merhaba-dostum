import { useMemo } from "react";

/** parlayanYildizlar.png içinden ayrılan 7 yıldız görseli */
const STAR_SRCS = [1, 2, 3, 4, 5, 6, 7].map((i) => `/anaSayfa/yildizlar/${i}.png`);

interface HomeStarsProps {
  /** ekranda kaç yıldız parlayacak */
  count?: number;
}

/**
 * Gece modunda ekranın rastgele yerlerinde parlayıp sönen yıldızlar.
 * Konum/boyut/süre/gecikme mount başına rastgele belirlenir.
 */
export const HomeStars = ({ count = 9 }: HomeStarsProps) => {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        src: STAR_SRCS[Math.floor(Math.random() * STAR_SRCS.length)],
        left: Math.random() * 92 + 2,
        top: Math.random() * 88 + 2,
        size: 26 + Math.random() * 54,
        duration: 2.5 + Math.random() * 4,
        delay: -(Math.random() * 6),
        peak: 0.5 + Math.random() * 0.5,
      })),
    [count],
  );

  return (
    <>
      <style>{`
        @keyframes homeStarTwinkle {
          0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
          45%      { opacity: var(--peak); transform: scale(1) rotate(12deg); }
          60%      { opacity: calc(var(--peak) * 0.75); transform: scale(0.92) rotate(16deg); }
        }
      `}</style>
      {stars.map((s) => (
        <img
          key={s.id}
          src={s.src}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute select-none pointer-events-none"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: 0,
            ["--peak" as string]: s.peak,
            animation: `homeStarTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            willChange: "opacity, transform",
          }}
        />
      ))}
    </>
  );
};

export default HomeStars;
