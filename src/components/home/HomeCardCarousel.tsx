import { useCallback, useRef, useState } from "react";
import type { SlidePanelItem } from "./HomeSlidePanel";

/**
 * Atlıkarınca (coverflow) tarzı kart karuseli.
 * Ortadaki kart tam boyutta, yanlar küçülüp soluklaşır. Parmakla döngüsel kaydırma.
 */
interface Props {
  items: SlidePanelItem[];
}

export const HomeCardCarousel = ({ items }: Props) => {
  const N = items.length;
  const [pos, setPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const posRef = useRef(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number; pos: number; axis: "none" | "x" | "y" } | null>(null);
  posRef.current = pos;

  const signedDelta = (i: number, p: number) => {
    let d = i - p;
    while (d > N / 2) d -= N;
    while (d < -N / 2) d += N;
    return d;
  };

  const snap = useCallback(
    (next: number) => {
      setPos(((Math.round(next) % N) + N) % N);
    },
    [N],
  );

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
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      s.axis = Math.abs(dx) > Math.abs(dy) * 0.7 ? "x" : "y";
      if (s.axis === "x") setDragging(true);
    }
    if (s.axis !== "x") return;
    e.stopPropagation();
    const w = wrapRef.current?.offsetWidth || window.innerWidth;
    setPos(s.pos - (dx / w) * 2.6);
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const s = startRef.current;
      startRef.current = null;
      if (!s) return;
      if (s.axis === "x") e.stopPropagation();
      setDragging(false);
      const moved = posRef.current - s.pos;
      snap(Math.abs(moved) > 0.08 ? s.pos + Math.sign(moved) : s.pos);
    },
    [snap],
  );

  const activeIndex = ((Math.round(pos) % N) + N) % N;

  return (
    <div
      ref={wrapRef}
      className="relative flex-1 min-h-0 flex flex-col items-center justify-center"
      style={{ touchAction: "pan-y", WebkitTapHighlightColor: "transparent" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full flex-1 min-h-0 flex items-center justify-center">
        {items.map((item, i) => {
          const d = signedDelta(i, pos);
          const ad = Math.abs(d);
          const scale = Math.max(0.5, 1 - ad * 0.22);
          const opacity = ad > 2.2 ? 0 : Math.max(0, 1 - ad * 0.42);
          const isActive = ad < 0.5;

          return (
            <div
              key={item.id}
              className="absolute"
              style={{
                width: "74%",
                transform: `translate3d(${d * 62}%, 0, 0) scale(${scale}) rotateY(${-d * 12}deg)`,
                transition: dragging
                  ? "none"
                  : "transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease-out",
                opacity,
                zIndex: 100 - Math.round(ad * 10),
                pointerEvents: opacity < 0.25 ? "none" : "auto",
                willChange: "transform, opacity",
              }}
            >
              <button
                type="button"
                aria-label={item.title}
                onClick={() => {
                  if (!isActive) snap(pos + d);
                  item.onClick();
                }}
                className="relative w-full block active:scale-[0.97] transition-transform duration-150"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <img
                  src={item.imageSrc}
                  alt={item.title}
                  className={`w-full h-auto select-none pointer-events-none ${
                    item.dimmed ? "opacity-40 grayscale-[80%] brightness-75 saturate-50" : ""
                  }`}
                  draggable={false}
                />
                {item.badge && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center">
                    {item.badge}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2 pb-2 pointer-events-none">
        <span className="px-4 py-1 rounded-full bg-black/35 backdrop-blur-sm text-white text-sm font-black uppercase tracking-wide">
          {items[activeIndex]?.title}
        </span>
        <div className="flex items-center gap-1.5">
          {items.map((it, i) => (
            <span
              key={it.id}
              className="rounded-full transition-all duration-200"
              style={{
                width: i === activeIndex ? 16 : 6,
                height: 6,
                background: i === activeIndex ? "hsl(var(--primary))" : "rgba(255,255,255,0.4)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomeCardCarousel;
