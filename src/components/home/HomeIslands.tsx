import { useCallback, useMemo, useRef } from "react";
import HomeMapPoint from "@/components/home/HomeMapPoint";


/**
 * Yeni anasayfaGorsel.png içindeki 5 ada, ayrı PNG'lere bölündü.
 * Her ada bağımsız (rastgele süre/gecikme/mesafe) şekilde yukarı-aşağı süzülür.
 * Harita noktaları adanın içine yerleştiği için ada ile birlikte hareket eder.
 */
type IslandKey = "oyunModlari" | "duello" | "carki" | "sohbet" | "arkadaslik";

interface IslandDef {
  key: IslandKey;
  src: string;
  /** kapsayıcıya göre yüzde konum/boyut (768x1152 orijinal ölçüden) */
  left: number;
  top: number;
  width: number;
  height: number;
  /** ada içinde harita noktasının yüzde konumu */
  px: number;
  py: number;
  label: string;
}

const ISLANDS: IslandDef[] = [
  { key: "oyunModlari", src: "/anaSayfa/adalar/oyunModlari.png", left: 10.16, top: 4.34, width: 41.15, height: 20.23, px: 47, py: 30, label: "Oyun Modları" },
  { key: "duello", src: "/anaSayfa/adalar/duello.png", left: 44.14, top: 11.81, width: 51.95, height: 28.73, px: 45, py: 28, label: "Düello & Challenge" },
  { key: "carki", src: "/anaSayfa/adalar/carki.png", left: 4.82, top: 27.78, width: 47.92, height: 29.95, px: 40, py: 25, label: "Şans Çarkı" },
  { key: "sohbet", src: "/anaSayfa/adalar/sohbet.png", left: 48.18, top: 42.27, width: 47.53, height: 28.91, px: 50, py: 32, label: "Sohbet" },
  { key: "arkadaslik", src: "/anaSayfa/adalar/arkadaslik.png", left: 13.41, top: 58.85, width: 61.98, height: 37.5, px: 46, py: 40, label: "Arkadaşlık" },
];

interface HomeIslandsProps {
  pointSize?: number;
  alerts?: Partial<Record<IslandKey, boolean>>;
  onSelect: (key: IslandKey) => void;
}

export const HomeIslands = ({ pointSize = 38, alerts, onSelect }: HomeIslandsProps) => {
  // Her ada için rastgele süzülme parametreleri (mount başına sabit)
  const motion = useMemo(
    () =>
      ISLANDS.map(() => ({
        duration: 6 + Math.random() * 4,
        delay: -(Math.random() * 5),
        distance: 3 + Math.random() * 3.5,
      })),
    [],
  );

  return (
    <>
      <style>{`
        @keyframes homeIslandDrift {
          0%, 100% { transform: translate3d(0, calc(var(--drift) * -1), 0); }
          50%      { transform: translate3d(0, var(--drift), 0); }
        }
      `}</style>

      {ISLANDS.map((island, i) => (
        <div
          key={island.key}
          className="absolute"
          style={{
            left: `${island.left}%`,
            top: `${island.top}%`,
            width: `${island.width}%`,
            height: `${island.height}%`,
            ["--drift" as string]: `${motion[i].distance}px`,
            animation: `homeIslandDrift ${motion[i].duration}s ease-in-out ${motion[i].delay}s infinite`,
            willChange: "transform",
          }}
        >
          <img
            src={island.src}
            alt={island.label}
            className="w-full h-full object-contain select-none pointer-events-none"
            draggable={false}
          />
          <HomeMapPoint
            x={island.px}
            y={island.py}
            size={pointSize}
            label={island.label}
            alert={alerts?.[island.key] ?? false}
            onClick={() => onSelect(island.key)}
          />
        </div>
      ))}
    </>
  );
};

export default HomeIslands;
