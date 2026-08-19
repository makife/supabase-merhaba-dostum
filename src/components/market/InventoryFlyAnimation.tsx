import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface FlightRequest {
  /** Hedef chip anahtarı: degistir | fisilda | senyaz | hak */
  targetKey: string;
  /** Uçacak ikonun görsel yolu (svg/png) */
  icon: string;
  /** Kaç adet ikon uçacak */
  count: number;
  /** Animasyonu tekrar tetiklemek için benzersiz id */
  id: number;
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

    const layer = layerRef.current;
    const tRect = target.getBoundingClientRect();
    const endX = tRect.left + tRect.width / 2;
    const endY = tRect.top + tRect.height / 2;
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;

    const total = Math.min(Math.max(flight.count, 1), 10);
    const sprites: HTMLImageElement[] = [];
    const animations: Animation[] = [];

    for (let i = 0; i < total; i++) {
      const img = document.createElement("img");
      img.src = flight.icon;
      img.style.cssText =
        "position:fixed;width:38px;height:38px;left:0;top:0;pointer-events:none;will-change:transform,opacity;opacity:0;";
      layer.appendChild(img);
      sprites.push(img);

      // Kıvrımlı yol: yay şeklinde ara nokta (her sprite biraz farklı yaydan gitsin)
      const side = i % 2 === 0 ? 1 : -1;
      const spread = 40 + (i % 5) * 26;
      const midX = (startX + endX) / 2 + side * spread;
      const midY = (startY + endY) / 2 - (70 + (i % 4) * 30);

      const frame = (x: number, y: number, scale: number, opacity: number) => ({
        transform: `translate3d(${x - 19}px, ${y - 19}px, 0) scale(${scale})`,
        opacity: String(opacity),
      });

      const anim = img.animate(
        [
          { ...frame(startX, startY, 0.6, 0), offset: 0 },
          { ...frame(startX, startY, 1.15, 1), offset: 0.12 },
          { ...frame(midX, midY, 1, 1), offset: 0.55 },
          { ...frame(endX, endY, 0.45, 0.9), offset: 1 },
        ],
        {
          duration: 900,
          delay: i * 110,
          easing: "cubic-bezier(0.35, 0.05, 0.35, 1)",
          fill: "forwards",
        },
      );
      animations.push(anim);

      anim.onfinish = () => {
        img.style.opacity = "0";
        // Hedef chip'e küçük bir "pop" efekti
        target.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.18)" },
            { transform: "scale(1)" },
          ],
          { duration: 260, easing: "ease-out" },
        );
      };
    }

    const timeout = window.setTimeout(() => {
      sprites.forEach((s) => s.remove());
      onDone();
    }, 900 + total * 110 + 200);

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
