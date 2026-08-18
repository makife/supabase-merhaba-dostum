import { useEffect, useMemo, useRef, useState } from "react";
import Lottie from "lottie-react";

interface UnlimitedFlowBadgeProps {
  /** Sınırsız akışın bitiş zamanı (ISO string) */
  until?: string | null;
}

const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");

/**
 * Ana sayfa kayan yazıların altında, sol kenara yaslı sınırsız akış göstergesi.
 * Lottie'ye basılınca beyaz gradient fon sağa doğru açılır ve kalan süre
 * dijital saat rakamlarıyla yeşil olarak gösterilir.
 */
export default function UnlimitedFlowBadge({ until }: UnlimitedFlowBadgeProps) {
  const [animData, setAnimData] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/sinirsizAkis.json")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setAnimData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const remaining = useMemo(() => {
    if (!until) return null;
    const diff = new Date(until).getTime() - now;
    if (!Number.isFinite(diff) || diff <= 0) return null;
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [until, now]);

  if (!remaining) return null;

  const handlePress = () => {
    setOpen((prev) => !prev);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 6000);
  };

  return (
    <div className="flex items-center pointer-events-auto">
      <button
        type="button"
        onClick={handlePress}
        aria-label="Sınırsız akış kalan süre"
        className="flex items-center gap-1 pl-1 pr-1 py-0.5 rounded-r-full active:scale-95 transition-transform overflow-hidden"
        style={{
          background:
            "linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.75) 55%, rgba(255,255,255,0) 100%)",
          width: open ? 148 : 44,
          transition: "width 320ms cubic-bezier(0.16, 1, 0.3, 1), transform 150ms ease",
        }}
      >
        <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
          {animData ? (
            <Lottie animationData={animData} loop autoplay style={{ width: 32, height: 32 }} />
          ) : null}
        </span>
        <span
          className="whitespace-nowrap tabular-nums text-[15px] font-bold leading-none"
          style={{
            fontFamily: "'Share Tech Mono', 'Courier New', monospace",
            color: "#15c93f",
            textShadow: "0 0 6px rgba(21,201,63,0.65)",
            opacity: open ? 1 : 0,
            transition: "opacity 220ms ease",
            letterSpacing: "1px",
          }}
        >
          {remaining}
        </span>
      </button>
    </div>
  );
}
