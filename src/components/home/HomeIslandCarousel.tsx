import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HomeMapPoint from "@/components/home/HomeMapPoint";
import { ISLANDS, preloadHomeIslands, type IslandKey } from "@/lib/homeIslandAssets";

/**
 * Yatay "coverflow" ada karuseli.
 * Ortadaki ada tam boyutta, yanlar uzaklığa göre küçülüp soluklaşır.
 * Parmakla kaydırınca adalar arasında geçiş yapılır (döngüsel).
 * Sayfa geçişi (liderlik/profil...) sadece ekran kenarından tetiklenir — burada
 * dokunmalar stopPropagation ile sayfa swipe'ına gitmez.
 */

interface Props {
  pointSize?: number;
  alerts?: Partial<Record<IslandKey, boolean>>;
  onSelect: (key: IslandKey) => void;
}

const N = ISLANDS.length;
/** en kısa yönlü mesafe (-N/2 .. N/2) */
const signedDelta = (i: number, pos: number) => {
  let d = i - pos;
  while (d > N / 2) d -= N;
  while (d < -N / 2) d += N;
  return d;
};

export const HomeIslandCarousel = ({ pointSize = 38, alerts, onSelect }: Props) => {
  const [pos, setPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const posRef = useRef(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number; pos: number; axis: "none" | "x" | "y" } | null>(null);

  posRef.current = pos;

  useMemo(() => {
    void preloadHomeIslands();
  }, []);

  // Süzülme parametreleri (ada başına sabit)
  const motion = useMemo(
    () =>
      ISLANDS.map(() => ({
        duration: 6 + Math.random() * 4,
        delay: -(Math.random() * 5),
        distance: 4 + Math.random() * 3,
      })),
    [],
  );

  const snap = useCallback((next: number) => {
    const norm = ((Math.round(next) % N) + N) % N;
    setPos(norm);
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    e.stopPropagation();
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, pos: posRef.current, axis: "none" };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const s = startRef.current;
    if (!s) return;
    const dx = e.touches[0].clientX - s.x;
    const dy = e.touches[0].clientY - s.y;
    if (s.axis === "none") {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      s.axis = Math.abs(dx) > Math.abs(dy) * 1.1 ? "x" : "y";
      if (s.axis === "x") setDragging(true);
    }
    if (s.axis !== "x") return;
    e.stopPropagation();
    const w = wrapRef.current?.offsetWidth || window.innerWidth;
    setPos(s.pos - (dx / w) * 1.35);
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const s = startRef.current;
      startRef.current = null;
      if (!s) return;
      if (s.axis === "x") e.stopPropagation();
      setDragging(false);
      const moved = posRef.current - s.pos;
      // hafif bir itiş de sekme değiştirsin
      const target = Math.abs(moved) > 0.18 ? s.pos + Math.sign(moved) : s.pos;
      snap(target);
    },
    [snap],
  );

  // Klavye/erişilebilirlik: ok tuşları
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "ArrowLeft") snap(posRef.current - 1);
      else if (ev.key === "ArrowRight") snap(posRef.current + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snap]);

  const activeIndex = ((Math.round(pos) % N) + N) % N;

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 flex items-center justify-center"
      style={{ touchAction: "pan-y", WebkitTapHighlightColor: "transparent" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <style>{`
        @keyframes homeCarouselDrift {
          0%, 100% { transform: translate3d(0, calc(var(--drift) * -1), 0); }
          50%      { transform: translate3d(0, var(--drift), 0); }
        }
      `}</style>

      {ISLANDS.map((island, i) => {
        const d = signedDelta(i, pos);
        const ad = Math.abs(d);
        const scale = Math.max(0.5, 1 - ad * 0.26);
        const opacity = ad > 2.2 ? 0 : Math.max(0, 1 - ad * 0.32);
        const x = d * 46;
        const isActive = ad < 0.5;

        return (
          <div
            key={island.key}
            className="absolute"
            style={{
              width: "72%",
              height: "42%",
              transform: `translate3d(${x}%, 0, 0) scale(${scale})`,
              transition: dragging ? "none" : "transform 340ms cubic-bezier(0.22,1,0.36,1), opacity 300ms ease-out",
              opacity,
              zIndex: 100 - Math.round(ad * 10),
              filter: isActive ? "none" : "brightness(0.82) saturate(0.9)",
              pointerEvents: opacity < 0.2 ? "none" : "auto",
              willChange: "transform, opacity",
            }}
          >
            <div
              className="relative w-full h-full"
              style={{
                ["--drift" as string]: `${motion[i].distance}px`,
                animation: `homeCarouselDrift ${motion[i].duration}s ease-in-out ${motion[i].delay}s infinite`,
              }}
            >
              <button
                type="button"
                aria-label={island.label}
                onClick={() => {
                  if (isActive) onSelect(island.key);
                  else snap(pos + d);
                }}
                className="absolute inset-0 active:scale-[0.97] transition-transform duration-150"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <img
                  src={island.src}
                  alt={island.label}
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-contain select-none pointer-events-none"
                  draggable={false}
                />
              </button>

              {isActive && (
                <HomeMapPoint
                  x={island.px}
                  y={island.py}
                  size={pointSize}
                  label={island.label}
                  alert={alerts?.[island.key] ?? false}
                  onClick={() => onSelect(island.key)}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* Aktif ada etiketi + göstergeler */}
      <div className="absolute bottom-[4%] left-0 right-0 z-[200] flex flex-col items-center gap-2 pointer-events-none">
        <span className="px-4 py-1 rounded-full bg-background/55 backdrop-blur-sm text-foreground text-sm font-semibold tracking-wide">
          {ISLANDS[activeIndex].label}
        </span>
        <div className="flex items-center gap-1.5">
          {ISLANDS.map((isl, i) => (
            <span
              key={isl.key}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === activeIndex ? 16 : 6,
                height: 6,
                background: i === activeIndex ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.5)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeIslandCarousel;
