import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

  // Süzülme parametreleri (ada başına sabit) — daha belirgin salınım
  const motion = useMemo(
    () =>
      ISLANDS.map(() => ({
        duration: 4.5 + Math.random() * 3,
        delay: -(Math.random() * 5),
        distance: 9 + Math.random() * 6,
      })),
    [],
  );

  const rafRef = useRef<number | null>(null);
  const velRef = useRef(0);
  const lastRef = useRef<{ x: number; t: number } | null>(null);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => stopRaf, [stopRaf]);

  /** yumuşak: hedefe kritik sönümlü yaklaşım (yağ gibi) */
  const glideTo = useCallback(
    (target: number, initialVel = 0) => {
      stopRaf();
      let v = initialVel;
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(0.032, (now - last) / 1000);
        last = now;
        const cur = posRef.current;
        const diff = target - cur;
        // yay-sönüm
        v += diff * 130 * dt;
        v *= Math.pow(0.0025, dt);
        const next = cur + v * dt;
        if (Math.abs(target - next) < 0.0015 && Math.abs(v) < 0.05) {
          const norm = ((target % N) + N) % N;
          setPos(norm);
          rafRef.current = null;
          return;
        }
        setPos(next);
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [stopRaf],
  );

  const snap = useCallback((next: number) => {
    const norm = ((Math.round(next) % N) + N) % N;
    setPos(norm);
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      stopRaf();
      velRef.current = 0;
      lastRef.current = { x: e.touches[0].clientX, t: performance.now() };
      startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, pos: posRef.current, axis: "none" };
    },
    [stopRaf],
  );

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
    const next = s.pos - (dx / w) * 3.2;
    // anlık hız (ada/sn)
    const now = performance.now();
    const l = lastRef.current;
    if (l) {
      const dt = (now - l.t) / 1000;
      if (dt > 0.008) {
        velRef.current = -((e.touches[0].clientX - l.x) / w) * 3.2 / dt;
        lastRef.current = { x: e.touches[0].clientX, t: now };
      }
    } else {
      lastRef.current = { x: e.touches[0].clientX, t: now };
    }
    setPos(next);
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const s = startRef.current;
      startRef.current = null;
      lastRef.current = null;
      if (!s) return;
      if (s.axis === "x") e.stopPropagation();
      setDragging(false);
      if (s.axis !== "x") return;
      const v = velRef.current;
      // hız projeksiyonu ile hedefi belirle (flick desteği)
      const projected = posRef.current + v * 0.16;
      let target = Math.round(projected);
      const moved = posRef.current - s.pos;
      if (target === Math.round(s.pos) && Math.abs(moved) > 0.05) {
        target = Math.round(s.pos) + Math.sign(moved);
      }
      glideTo(target, v);
    },
    [glideTo],
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
        .island-red-glow {
          filter: drop-shadow(0 0 5px rgba(255,50,50,0.9)) drop-shadow(0 0 10px rgba(255,0,0,0.45));
        }
      `}</style>

      {ISLANDS.map((island, i) => {
        const d = signedDelta(i, pos);
        const ad = Math.abs(d);
        const scale = Math.max(0.4, 1.3 - ad * 0.46) * (island.scaleMul ?? 1);
        const opacity = ad > 1.8 ? 0 : Math.max(0, 1 - ad * 0.72);
        const x = d * 48;
        const isActive = ad < 0.5;

        return (
          <div
            key={island.key}
            className="absolute"
            style={{
              width: "72%",
              height: "42%",
              transform: `translate3d(${x}%, ${island.key === "radyo" ? -8 : 0}%, 0) scale(${scale})`,
              transition: dragging || animating ? "none" : "transform 300ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease-out",
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
                  className={`w-full h-full object-contain select-none pointer-events-none${alerts?.[island.key] ? " island-red-glow" : ""}`}
                  draggable={false}
                />

              </button>

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
