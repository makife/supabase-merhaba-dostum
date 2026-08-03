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

  const wrapRef = useRef<HTMLDivElement>(null);
  const islandRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Ada PNG'lerinin alfa maskeleri (şeffaf alanlara tıklama sayılmasın)
  const maskCache = useRef<Record<string, ImageData | null>>({});

  const getMask = useCallback((src: string) => {
    if (src in maskCache.current) return maskCache.current[src];
    maskCache.current[src] = null;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      try {
        const w = 160;
        const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        maskCache.current[src] = ctx.getImageData(0, 0, w, h);
      } catch {
        maskCache.current[src] = null;
      }
    };
    return null;
  }, []);

  // Maskeleri erken hazırla
  useMemo(() => ISLANDS.forEach((i) => getMask(i.src)), [getMask]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
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
        const mask = maskCache.current[island.src];
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
        ref={wrapRef}
        className="absolute inset-0 z-10"
        style={{ WebkitTapHighlightColor: "transparent" }}
        onPointerDown={handlePointerDown}
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
            src={island.src}
            alt={island.label}
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
