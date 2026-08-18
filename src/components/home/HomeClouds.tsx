import { useMemo } from "react";

const CLOUDS = ["bulut2", "bulut3", "bulut4", "bulut5", "bulut6", "bulut7", "bulut8"];

interface Cloud {
  src: string;
  top: number;
  size: number;
  duration: number;
  delay: number;
  ltr: boolean;
  opacity: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

interface HomeCloudsProps {
  /** back = adaların arkası, front = adaların önü */
  layer?: "back" | "front";
}

export const HomeClouds = ({ layer = "back" }: HomeCloudsProps) => {
  const clouds = useMemo<Cloud[]>(() => {
    // Yoğunluk: arkada 2 tur, önde 1 tur (biraz daha yoğun bulut)
    const passes = 1;
    const list: Cloud[] = [];
    for (let p = 0; p < passes; p++) {
      const names = layer === "front" ? CLOUDS.slice(0, 4) : CLOUDS;
      names.forEach((name, i) => {
        list.push({
          src: `/anaSayfa/${name}.png`,
          top: rand(2, 90),
          size: layer === "front" ? rand(120, 240) : rand(90, 190),
          duration: layer === "front" ? rand(28, 55) : rand(34, 70),
          delay: -rand(0, 45) - (i + p * names.length) * 2,
          ltr: Math.random() > 0.5,
          opacity: layer === "front" ? rand(0.22, 0.45) : rand(0.35, 0.75),
        });
      });
    }
    return list;
  }, [layer]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <style>{`
        @keyframes homeCloudLTR {
          0%   { transform: translate3d(-40vw, 0, 0); opacity: 0; }
          15%  { opacity: var(--cloud-op); }
          70%  { opacity: var(--cloud-op); }
          100% { transform: translate3d(120vw, 0, 0); opacity: 0; }
        }
        @keyframes homeCloudRTL {
          0%   { transform: translate3d(120vw, 0, 0); opacity: 0; }
          15%  { opacity: var(--cloud-op); }
          70%  { opacity: var(--cloud-op); }
          100% { transform: translate3d(-40vw, 0, 0); opacity: 0; }
        }
      `}</style>
      {clouds.map((c, i) => (
        <img
          key={i}
          src={c.src}
          alt=""
          aria-hidden
          className="absolute select-none"
          style={
            {
              top: `${c.top}%`,
              left: 0,
              width: c.size,
              opacity: 0,
              "--cloud-op": c.opacity,
              animation: `${c.ltr ? "homeCloudLTR" : "homeCloudRTL"} ${c.duration}s linear ${c.delay}s infinite`,
              willChange: "transform, opacity",
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};

export default HomeClouds;
