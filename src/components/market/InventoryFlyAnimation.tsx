import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { playGenericTone } from "@/utils/genericBeep";
import { isSoundEffectsEnabled } from "@/utils/soundSettings";

export interface FlightRequest {
  /** Hedef chip anahtarı: degistir | fisilda | senyaz | hak */
  targetKey: string;
  /** Uçacak ikonun görsel yolu (svg/png) */
  icon: string;
  /** Kaç adet ikon uçacak */
  count: number;
  /** Animasyonu tekrar tetiklemek için benzersiz id */
  id: number;
  /** Uçuşun başlayacağı market kartındaki ikonun item id'si */
  sourceItemId?: string;
}

interface Props {
  flight: FlightRequest | null;
  onDone: () => void;
}

/**
 * Satın alınan öğelerin ekranın ortasından üstteki envanter chip'ine
 * kıvrılarak peşpeşe uçtuğu animasyon.
 */
export const InventoryFlyAnimation: React.FC<Props> = ({ flight, onDone }) => {
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!flight || !layerRef.current) return;

    const target = document.querySelector<HTMLElement>(`[data-inv-target="${flight.targetKey}"]`);
    if (!target) {
      onDone();
      return;
    }

    const targetIcon = target.querySelector<HTMLElement>("[data-inv-icon]") || target;

    const layer = layerRef.current;
    const tRect = targetIcon.getBoundingClientRect();
    const endX = tRect.left + tRect.width / 2;
    const endY = tRect.top + tRect.height / 2;
    // Başlangıç: satın alınan öğenin karttaki ikonunun tam üstü
    const source = flight.sourceItemId
      ? document.querySelector<HTMLElement>(`[data-market-item="${flight.sourceItemId}"]`)
      : null;
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight / 2;
    if (source) {
      const sRect = source.getBoundingClientRect();
      startX = sRect.left + sRect.width / 2;
      startY = sRect.top - 6; // ikonun tam üstü
    }

    // Daha seyrek akış: 7-9 ikon
    const total = 7 + Math.floor(Math.random() * 3);
    const sprites: HTMLImageElement[] = [];
    const animations: Animation[] = [];
    const soundOn = isSoundEffectsEnabled();

    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    // Yola dik birim vektör (salınım için)
    const nx = -dy / dist;
    const ny = dx / dist;

    const STEPS = 24;
    const DUR = 700;
    const GAP = 80; // ikonlar arası sıklık azaltıldı
    const SIZE = 34;
    const half = SIZE / 2;

    // TEK ORTAK YÖRÜNGE: zikzak yok, tek yumuşak eğri (yay)
    const side = dx >= 0 ? -1 : 1; // yay dışa doğru kavis yapar
    const AMP = Math.min(120, Math.max(50, dist * 0.28)) * side;
    const pathKeyframes: Keyframe[] = [];
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS;
      const bow = Math.sin(Math.PI * t) * AMP; // tek kavis
      const x = startX + dx * t + nx * bow;
      const y = startY + dy * t + ny * bow;
      const scale = 0.5 + 0.8 * Math.sin(Math.PI * t);
      const opacity = t === 0 ? 0 : t > 0.95 ? 0.6 : 1;
      pathKeyframes.push({
        transform: `translate3d(${x - half}px, ${y - half}px, 0) scale(${scale})`,
        opacity: String(opacity),
        offset: t,
      });
    }

    for (let i = 0; i < total; i++) {
      const img = document.createElement("img");
      img.src = flight.icon;
      img.style.cssText = `position:fixed;width:${SIZE}px;height:${SIZE}px;left:0;top:0;pointer-events:none;will-change:transform,opacity;opacity:0;`;
      layer.appendChild(img);
      sprites.push(img);

      const anim = img.animate(pathKeyframes, {
        duration: DUR,
        delay: i * GAP,
        easing: "linear", // sabit hız → aralar bozulmaz, zincir gibi akar
        fill: "forwards",
      });
      animations.push(anim);

      anim.onfinish = () => {
        img.style.opacity = "0";
        if (soundOn) {
          // Her varışta yükselen kısa "toplama" sesi
          playGenericTone(880 + (i % 8) * 90, "triangle", 0.07, 0.07);
        }
        // Hedef ikonuna küçük bir "pop" efekti
        targetIcon.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.14)" },
            { transform: "scale(1)" },
          ],
          { duration: 140, easing: "ease-out" },
        );
      };
    }

    const timeout = window.setTimeout(() => {
      sprites.forEach((s) => s.remove());
      onDone();
    }, DUR + total * GAP + 300);

    return () => {
      window.clearTimeout(timeout);
      animations.forEach((a) => a.cancel());
      sprites.forEach((s) => s.remove());
    };
  }, [flight, onDone]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div ref={layerRef} className="fixed inset-0 z-[9999] pointer-events-none" aria-hidden />,
    document.body,
  );
};

export default InventoryFlyAnimation;
