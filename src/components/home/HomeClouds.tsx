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

export const HomeClouds = () => {
  const clouds = useMemo<Cloud[]>(
    () =>
      CLOUDS.map((name, i) => ({
        src: `/anaSayfa/${name}.png`,
        top: rand(2, 88),
        size: rand(90, 190),
        duration: rand(34, 70),
        delay: -rand(0, 40) - i * 2,
        ltr: Math.random() > 0.5,
        opacity: rand(0.35, 0.75),
      })),
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
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
