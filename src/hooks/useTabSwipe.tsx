import { useCallback, useRef } from "react";
import { useSounds } from "@/hooks/useSounds";

/**
 * 🔥 Sekmeler arası native swipe hissi (drag-follow)
 *
 * - Parmakla sürüklerken içerik anlık takip eder
 * - Aktif gösterge (pill) parmakla birlikte kayar
 * - Bırakınca hedef sekmeye oturur veya yay gibi geri döner
 * - Geçiş anında tıklama ses efekti + haptic
 */
interface Options {
  /** Sekme sırası (soldan sağa) */
  tabs: string[];
  /** Aktif sekme */
  activeTab: string;
  /** Sekme değiştirme */
  setActiveTab: (tab: string) => void;
  /** Pill kolonları arasındaki boşluk (CSS değeri, örn "0.25rem") */
  pillGap?: string;
  /** Devre dışı */
  enabled?: boolean;
}

export function useTabSwipe({
  tabs,
  activeTab,
  setActiveTab,
  pillGap = "0rem",
  enabled = true,
}: Options) {
  const { playSound } = useSounds();
  const dragLayerRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<{ x: number; y: number; dx: number; axis: "none" | "x" | "y" } | null>(null);

  const pillTransform = useCallback(
    (pos: number) =>
      pillGap === "0rem"
        ? `translate3d(${pos * 100}%,0,0)`
        : `translate3d(calc(${pos} * (100% + ${pillGap})),0,0)`,
    [pillGap]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) return;
      // Sekme alanındaki kaydırma sayfa geçişini tetiklemesin
      e.stopPropagation();
      stateRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, axis: "none" };
      if (dragLayerRef.current) dragLayerRef.current.style.transition = "none";
      if (pillRef.current) pillRef.current.style.transition = "none";
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const s = stateRef.current;
      if (!s) return;
      e.stopPropagation();
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;
      if (s.axis === "none") {
        if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
        // Sadece belirgin yatay hareket sekme geçişi başlatır
        s.axis = Math.abs(dx) > Math.abs(dy) * 2 ? "x" : "y";
      }
      if (s.axis !== "x") return;
      // Yatay sürükleme sırasında dikey kaçış olursa geçişi iptal et (360 derece hissi olmasın)
      if (Math.abs(dy) > 34) {
        s.axis = "y";
        s.dx = 0;
        const layer = dragLayerRef.current;
        if (layer) {
          layer.style.transition = "transform 180ms ease-out, opacity 180ms ease-out";
          layer.style.transform = "translate3d(0,0,0)";
          layer.style.opacity = "1";
        }
        if (pillRef.current) {
          pillRef.current.style.transition = "transform 180ms ease-out";
          pillRef.current.style.transform = pillTransform(tabs.indexOf(activeTab));
        }
        return;
      }

      const idx = tabs.indexOf(activeTab);
      const atEdge = (dx < 0 && idx === tabs.length - 1) || (dx > 0 && idx === 0);
      const eff = atEdge ? dx * 0.25 : dx;
      s.dx = eff;

      const el = dragLayerRef.current;
      if (!el) return;
      const w = el.offsetWidth || 1;
      el.style.transform = `translate3d(${eff}px,0,0)`;
      el.style.opacity = String(Math.max(0.45, 1 - Math.abs(eff) / w));
      if (pillRef.current) {
        const frac = Math.max(-1, Math.min(1, (-eff / w) * 1.6));
        pillRef.current.style.transform = pillTransform(idx + frac);
      }
    },
    [tabs, activeTab, pillTransform]
  );

  const onTouchEnd = useCallback(() => {
    const s = stateRef.current;
    stateRef.current = null;
    const el = dragLayerRef.current;
    if (!s || !el) return;

    const w = el.offsetWidth || 1;
    const idx = tabs.indexOf(activeTab);
    const dir = s.dx < 0 ? 1 : -1;
    const nextIdx = idx + dir;
    const commit =
      s.axis === "x" && Math.abs(s.dx) > Math.min(90, w * 0.22) && nextIdx >= 0 && nextIdx < tabs.length;

    const settlePill = (target: number) => {
      const pill = pillRef.current;
      if (!pill) return;
      pill.style.transition = "transform 260ms cubic-bezier(0.22,1,0.36,1)";
      pill.style.transform = pillTransform(target);
    };

    if (!commit) {
      el.style.transition = "transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease-out";
      el.style.transform = "translate3d(0,0,0)";
      el.style.opacity = "1";
      settlePill(idx);
      return;
    }

    playSound("buttonClick");
    try {
      navigator.vibrate?.(8);
    } catch {}
    settlePill(nextIdx);

    setActiveTab(tabs[nextIdx]);
    el.style.transition = "none";
    el.style.transform = `translate3d(${dir * w * 0.35}px,0,0)`;
    el.style.opacity = "0.6";
    requestAnimationFrame(() => {
      const n2 = dragLayerRef.current;
      if (!n2) return;
      n2.style.transition = "transform 240ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease-out";
      n2.style.transform = "translate3d(0,0,0)";
      n2.style.opacity = "1";
    });
  }, [tabs, activeTab, setActiveTab, playSound, pillTransform]);

  return {
    dragLayerRef,
    pillRef,
    /** Aktif sekmenin pill transform değeri (render sırasında kullan) */
    pillStyleTransform: pillTransform(Math.max(0, tabs.indexOf(activeTab))),
    swipeHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
  };
}
