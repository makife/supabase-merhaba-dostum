import { useCallback, useMemo, useRef } from "react";
import HomeMapPoint from "@/components/home/HomeMapPoint";
import {
  ISLANDS,
  getIslandMask,
  preloadHomeIslands,
  type IslandKey,
} from "@/lib/homeIslandAssets";
import { useNightMode } from "@/hooks/useNightMode";

/**
 * anasayfaGorsel.png içindeki 5 ada, ayrı PNG'lere bölündü.
 * Her ada bağımsız (rastgele süre/gecikme/mesafe) şekilde yukarı-aşağı süzülür.
 * Görseller ve alfa maskeleri modül seviyesinde önbellekte tutulur (bkz. homeIslandAssets),
 * bu yüzden sayfalar arası geçişte yeniden yükleme beklemesi olmaz.
 */

interface HomeIslandsProps {
  pointSize?: number;
  alerts?: Partial<Record<IslandKey, boolean>>;
  onSelect: (key: IslandKey) => void;
}

export const HomeIslands = ({ pointSize = 38, alerts, onSelect }: HomeIslandsProps) => {
  const isNight = useNightMode();
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

  const islandRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Görseller/maskeler hazır değilse (ilk açılış) hemen hazırlanmaya başlar
  useMemo(() => {
    void preloadHomeIslands();
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      // Üstteki adalar önce denenir (son render edilen en üstte)
      for (let i = ISLANDS.length - 1; i >= 0; i--) {
        const el = islandRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        )
          continue;

        const island = ISLANDS[i];
        const mask = getIslandMask(island.src);
        if (mask) {
          // object-contain: görselin rect içindeki gerçek alanını hesapla
          const imgRatio = mask.width / mask.height;
          const boxRatio = rect.width / rect.height;
          let dw = rect.width;
          let dh = rect.height;
          if (imgRatio > boxRatio) dh = rect.width / imgRatio;
          else dw = rect.height * imgRatio;
          const ox = rect.left + (rect.width - dw) / 2;
          const oy = rect.top + (rect.height - dh) / 2;
          const mx = Math.floor(((e.clientX - ox) / dw) * mask.width);
          const my = Math.floor(((e.clientY - oy) / dh) * mask.height);
          if (mx < 0 || my < 0 || mx >= mask.width || my >= mask.height) continue;
          const alpha = mask.data[(my * mask.width + mx) * 4 + 3];
          if (alpha < 24) continue;
        }

        onSelect(island.key);
        return;
      }
    },
    [onSelect],
  );

  return (
    <>
      <style>{`
        @keyframes homeIslandDrift {
          0%, 100% { transform: translate3d(0, calc(var(--drift) * -1), 0); }
          50%      { transform: translate3d(0, var(--drift), 0); }
        }
      `}</style>

      {/* Tüm ada alanını kapsayan tıklama katmanı: alfa testiyle doğru adayı seçer */}
      <div
        className="absolute inset-0 z-10"
        style={{ WebkitTapHighlightColor: "transparent" }}
        onClick={handleClick}
      />

      {ISLANDS.map((island, i) => (
        <div
          key={island.key}
          ref={(el) => {
            islandRefs.current[i] = el;
          }}
          className="absolute pointer-events-none"
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
            src={isNight ? island.nightSrc : island.src}
            alt={island.label}
            loading="eager"
            decoding="async"
            className="w-full h-full object-contain select-none pointer-events-none"
            draggable={false}
          />
          <div className="pointer-events-auto">
            <HomeMapPoint
              x={island.px}
              y={island.py}
              size={pointSize}
              label={island.label}
              alert={alerts?.[island.key] ?? false}
              onClick={() => onSelect(island.key)}
            />
          </div>
        </div>
      ))}
    </>
  );
};

export default HomeIslands;
