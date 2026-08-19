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

    // Satın alınan adetten bağımsız olarak bol miktarda ikon uçur (15-20)
    const total = 15 + Math.floor(Math.random() * 6);
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
    const DUR = 1100;
    const GAP = 55; // tren gibi peşpeşe: küçük sabit aralık
    const SIZE = 34;
    const half = SIZE / 2;

    // TEK ORTAK YÖRÜNGE: tüm ikonlar aynı yoldan, sırayla geçer
    const AMP = 42; // salınım genliği
    const WAVES = 2; // salınım sayısı
    const pathKeyframes: Keyframe[] = [];
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS;
      const env = Math.sin(Math.PI * t); // uçlarda salınım sıfırlanır
      const wave = Math.sin(t * WAVES * Math.PI * 2) * AMP * env;
      const x = startX + dx * t + nx * wave;
      const y = startY + dy * t + ny * wave - 50 * env;
      const scale = t < 0.12 ? 0.5 + t * 5 : 1.1 - t * 0.7;
      const opacity = t === 0 ? 0 : t > 0.95 ? 0.6 : 1;
      pathKeyframes.push({
        transform: `translate3d(${x - half}px, ${y - half}px, 0) scale(${scale}) rotate(${wave * 0.5}deg)`,
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
        // Hedef chip'e küçük bir "pop" efekti
        target.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.14)" },
            { transform: "scale(1)" },
          ],
          { duration: 200, easing: "ease-out" },
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
