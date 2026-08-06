import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { prefetchRoute } from "@/utils/pageDataCache";
import { useSounds } from "@/hooks/useSounds";

/**
 * 🔥 Yatay sayfa geçişi (native swipe hissi)
 *
 * Ana sayfa → Liderlik → Profil → Market → Ayarlar
 * Parmakla sürüklerken içerik anlık takip eder, bırakınca hedef sayfaya geçer.
 * Kaydırma başlar başlamaz hedef sayfanın verisi prefetch edilir.
 */
export const SWIPE_ROUTES = ["/", "/leaderboard", "/profile", "/market", "/settings"] as const;

const DIR_KEY = "swipeNavDir";

interface Options {
  /** Bu sayfanın route'u (SWIPE_ROUTES içinde olmalı) */
  route: string;
  /** true ise sadece ekran kenarından başlayan sürüklemeler geçiş yapar */
  edgeOnly?: boolean;
  /** Devre dışı bırakmak için */
  enabled?: boolean;
}

export function usePageSwipeNav({ route, edgeOnly = false, enabled = true }: Options) {
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const containerRef = useRef<HTMLElement | null>(null);
  const stateRef = useRef<{
    x: number;
    y: number;
    dx: number;
    axis: "none" | "x" | "y";
    prefetched: number | null;
  } | null>(null);

  const index = SWIPE_ROUTES.indexOf(route as any);

  // Geçiş yönüne göre slide-in animasyonu
  useEffect(() => {
    if (!enabled) return;
    let dir = 0;
    try {
      dir = Number(sessionStorage.getItem(DIR_KEY) || 0);
      sessionStorage.removeItem(DIR_KEY);
    } catch {}
    const el = containerRef.current;
    if (!el || !dir) return;

    el.style.willChange = "transform, opacity";
    el.style.transition = "none";
    el.style.transform = `translate3d(${dir * 26}%,0,0)`;
    el.style.opacity = "0.55";
    requestAnimationFrame(() => {
      const n = containerRef.current;
      if (!n) return;
      n.style.transition = "transform 260ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease-out";
      n.style.transform = "translate3d(0,0,0)";
      n.style.opacity = "1";
    });
  }, [enabled]);

  const reset = useCallback((animated: boolean) => {
    const el = containerRef.current;
    if (!el) return;
    el.style.transition = animated
      ? "transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease-out"
      : "none";
    el.style.transform = "translate3d(0,0,0)";
    el.style.opacity = "1";
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || index < 0 || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (edgeOnly && t.clientX > 44 && t.clientX < window.innerWidth - 44) {
        stateRef.current = null;
        return;
      }
      stateRef.current = { x: t.clientX, y: t.clientY, dx: 0, axis: "none", prefetched: null };
      const el = containerRef.current;
      if (el) el.style.transition = "none";
    },
    [enabled, index, edgeOnly]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;

      if (s.axis === "none") {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        s.axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
        if (s.axis !== "x") return;
      }
      if (s.axis !== "x") return;

      const nextIdx = dx < 0 ? index + 1 : index - 1;
      const atEdge = nextIdx < 0 || nextIdx >= SWIPE_ROUTES.length;

      // Yön belirlendiği anda hedef sayfanın verisini çekmeye başla
      if (!atEdge && s.prefetched !== nextIdx) {
        s.prefetched = nextIdx;
        prefetchRoute(SWIPE_ROUTES[nextIdx]);
      }

      const eff = atEdge ? dx * 0.2 : dx * 0.85;
      s.dx = eff;

      const el = containerRef.current;
      if (!el) return;
      const w = el.offsetWidth || window.innerWidth;
      el.style.transform = `translate3d(${eff}px,0,0)`;
      el.style.opacity = String(Math.max(0.5, 1 - Math.abs(eff) / w));
    },
    [index]
  );

  const onTouchEnd = useCallback(() => {
    const s = stateRef.current;
    stateRef.current = null;
    if (!s) return;

    const el = containerRef.current;
    const w = el?.offsetWidth || window.innerWidth;
    const dir = s.dx < 0 ? 1 : -1;
    const nextIdx = index + dir;
    const commit =
      s.axis === "x" &&
      Math.abs(s.dx) > Math.min(90, w * 0.2) &&
      nextIdx >= 0 &&
      nextIdx < SWIPE_ROUTES.length;

    if (!commit) {
      reset(true);
      return;
    }

    try {
      sessionStorage.setItem(DIR_KEY, String(dir));
    } catch {}
    playSound("buttonClick");
    try {
      navigator.vibrate?.(8);
    } catch {}

    if (el) {
      el.style.transition = "transform 150ms ease-out, opacity 150ms ease-out";
      el.style.transform = `translate3d(${-dir * w * 0.3}px,0,0)`;
      el.style.opacity = "0.4";
    }

    // Anında geçiş - veri prefetch edildiği için sayfa hazır açılır
    navigate(SWIPE_ROUTES[nextIdx]);
  }, [index, navigate, reset, playSound]);

  return {
    containerRef: containerRef as React.MutableRefObject<any>,
    swipeHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
  };
}
