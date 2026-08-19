import { playGenericTone } from "@/utils/genericBeep";
import { isSoundEffectsEnabled } from "@/utils/soundSettings";

export interface FlyIconsOptions {
  /** Hedef elementi bulmak için data-inv-target değeri */
  targetKey: string;
  /** Uçacak ikon görseli */
  icon: string;
  /** Başlangıç elementi (yoksa ekran ortası) */
  sourceEl?: HTMLElement | null;
  /** Kaç ikon uçacak (varsayılan 8) */
  count?: number;
}

const DUR = 700;
const GAP = 80; // ikonlar arası sıklık (düşük yoğunluk)
const STEPS = 24;
const SIZE = 34;

/**
 * Kaynak noktadan (ya da ekran ortasından) `data-inv-target` ile işaretli
 * envanter ikonuna doğru tek kavisli bir yörüngede peşpeşe ikon uçurur.
 */
export function flyIconsToInventory(opts: FlyIconsOptions): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve();

    const target = document.querySelector<HTMLElement>(`[data-inv-target="${opts.targetKey}"]`);
    if (!target) return resolve();

    const layer = document.createElement("div");
    layer.style.cssText =
      "position:fixed;inset:0;z-index:99999;pointer-events:none;";
    document.body.appendChild(layer);

    const tRect = target.getBoundingClientRect();
    const endX = tRect.left + tRect.width / 2;
    const endY = tRect.top + tRect.height / 2;

    let startX = window.innerWidth / 2;
    let startY = window.innerHeight / 2;
    if (opts.sourceEl) {
      const sRect = opts.sourceEl.getBoundingClientRect();
      startX = sRect.left + sRect.width / 2;
      startY = sRect.top - 6;
    }

    const total = Math.max(1, opts.count ?? 8);
    const soundOn = isSoundEffectsEnabled();

    const dx = endX - startX;
    const dy = endY - startY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / dist;
    const ny = dx / dist;

    const side = dx >= 0 ? -1 : 1;
    const AMP = Math.min(120, Math.max(50, dist * 0.28)) * side;
    const half = SIZE / 2;

    const pathKeyframes: Keyframe[] = [];
    for (let s = 0; s <= STEPS; s++) {
      const t = s / STEPS;
      const bow = Math.sin(Math.PI * t) * AMP;
      const x = startX + dx * t + nx * bow;
      const y = startY + dy * t + ny * bow;
      const scale = t < 0.12 ? 0.5 + t * 5 : 1.1 - t * 0.7;
      const opacity = t === 0 ? 0 : t > 0.95 ? 0.6 : 1;
      pathKeyframes.push({
        transform: `translate3d(${x - half}px, ${y - half}px, 0) scale(${scale})`,
        opacity: String(opacity),
        offset: t,
      });
    }

    for (let i = 0; i < total; i++) {
      const img = document.createElement("img");
      img.src = opts.icon;
      img.style.cssText = `position:fixed;width:${SIZE}px;height:${SIZE}px;left:0;top:0;pointer-events:none;will-change:transform,opacity;opacity:0;`;
      layer.appendChild(img);

      const anim = img.animate(pathKeyframes, {
        duration: DUR,
        delay: i * GAP,
        easing: "linear",
        fill: "forwards",
      });

      anim.onfinish = () => {
        img.style.opacity = "0";
        if (soundOn) playGenericTone(880 + (i % 8) * 90, "triangle", 0.07, 0.07);
        target.animate(
          [{ transform: "scale(1)" }, { transform: "scale(1.14)" }, { transform: "scale(1)" }],
          { duration: 140, easing: "ease-out" },
        );
      };
    }

    window.setTimeout(() => {
      layer.remove();
      resolve();
    }, DUR + total * GAP + 250);
  });
}

export interface ParsedReward {
  targetKey: string;
  icon: string;
  count: number;
}

/**
 * Ödül bildirim metninden hangi ikonların uçacağını çıkarır.
 * Ör: "Ödüllerin: 2 Değiştir, 3 Fısılda, 1 Senyaz, +2 Oyun Sayfası"
 */
export function parseRewardIcons(message: string): ParsedReward[] {
  const out: ParsedReward[] = [];
  const push = (targetKey: string, icon: string, n: number) => {
    if (n > 0) out.push({ targetKey, icon, count: Math.min(10, Math.max(6, n * 2)) });
  };

  const num = (re: RegExp) => {
    const m = message.match(re);
    return m ? parseInt(m[1], 10) || 0 : 0;
  };

  const degistir = num(/\+?\s*(\d+)\s*Değiştir/i);
  const fisilda = num(/\+?\s*(\d+)\s*Fısılda/i);
  const senyaz = num(/\+?\s*(\d+)\s*(?:Sen\s*Yaz|Senyaz)/i);
  const hak = num(/\+?\s*(\d+)\s*(?:Oyun\s*Sayfası|Oyun\s*Hakkı|Sayfa)/i);
  const murekkep = num(/\+?\s*(\d+)\s*Mürekkep/i);

  push("degistir", "/icons/degistir.svg", degistir);
  push("fisilda", "/icons/fisilda.svg", fisilda);
  push("senyaz", "/icons/senyaz.svg", senyaz);
  push("hak", "/icons/kredifazlasi-badge.svg", hak);
  push("murekkep", "/damlaMurekkep.png", murekkep);

  return out;
}

/** Ödülleri sırayla (biri bitince diğeri) uçurur */
export async function flyRewardsSequentially(message: string) {
  const rewards = parseRewardIcons(message);
  for (const r of rewards) {
    await flyIconsToInventory({ targetKey: r.targetKey, icon: r.icon, count: r.count });
  }
}
