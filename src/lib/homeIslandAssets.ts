/**
 * Ana sayfadaki yüzen ada görselleri + alfa maskeleri.
 * Modül seviyesinde önbelleğe alınır: oyuncu başka sayfalara gidip ana sayfaya
 * döndüğünde görseller ve maskeler zaten hazır olur (yeniden yükleme beklemesi yok).
 */
import radyoAdasi from "@/assets/radyoAdasi.png";

export type IslandKey = "oyunModlari" | "duello" | "carki" | "radyo" | "arkadaslik";

export interface IslandDef {
  key: IslandKey;
  src: string;
  /** gece versiyonu */
  nightSrc: string;
  /** kapsayıcıya göre yüzde konum/boyut (768x1152 orijinal ölçüden) */
  left: number;
  top: number;
  width: number;
  height: number;
  /** ada içinde harita noktasının yüzde konumu */
  px: number;
  py: number;
  label: string;
  /** gece modunda yatay ince kaydırma (yüzde) */
  nightDx?: number;
  /** karuselde ek boyut çarpanı */
  scaleMul?: number;
}

export const ISLANDS: IslandDef[] = [
  { key: "oyunModlari", src: "/anaSayfa/adalar/oyunModlari.png", nightSrc: "/anaSayfa/adalar/gece/oyunModlari.png", left: 10.16, top: 4.34, width: 41.15, height: 20.23, px: 47, py: 30, label: "Oyun Modları" },
  { key: "duello", src: "/anaSayfa/adalar/duello.png", nightSrc: "/anaSayfa/adalar/gece/duello.png", left: 42.64, top: 11.81, width: 51.95, height: 28.73, px: 45, py: 28, label: "Düello & Challenge", nightDx: -1.2 },
  { key: "carki", src: "/anaSayfa/adalar/carki.png", nightSrc: "/anaSayfa/adalar/gece/carki.png", left: 6.32, top: 27.78, width: 47.92, height: 29.95, px: 40, py: 25, label: "Şans Çarkı", nightDx: 1.2 },
  { key: "radyo", src: radyoAdasi, nightSrc: radyoAdasi, left: 46.68, top: 42.27, width: 47.53, height: 28.91, px: 50, py: 32, label: "Radyo", nightDx: -1.2, scaleMul: 1.5 },
  { key: "arkadaslik", src: "/anaSayfa/adalar/arkadaslik.png", nightSrc: "/anaSayfa/adalar/gece/arkadaslik.png", left: 14.91, top: 58.85, width: 61.98, height: 37.5, px: 46, py: 40, label: "Arkadaşlık", nightDx: 1.2 },
];

/** Görsel elemanlarını canlı tutar (tarayıcı belleğinden düşürmesin) */
const imageCache = new Map<string, HTMLImageElement>();
/** Şeffaf alan testi için düşük çözünürlüklü alfa maskeleri */
const maskCache = new Map<string, ImageData>();

let preloadPromise: Promise<void> | null = null;

const buildMask = (img: HTMLImageElement, src: string) => {
  if (maskCache.has(src) || !img.naturalWidth) return;
  try {
    const w = 160;
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    maskCache.set(src, ctx.getImageData(0, 0, w, h));
  } catch {
    /* maske alınamazsa sadece kutu testi kullanılır */
  }
};

const loadOne = (src: string) =>
  new Promise<void>((resolve) => {
    const existing = imageCache.get(src);
    if (existing?.complete) {
      buildMask(existing, src);
      resolve();
      return;
    }
    const img = new Image();
    img.decoding = "async";
    imageCache.set(src, img);
    img.onload = () => {
      buildMask(img, src);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });

/** Tüm ada görsellerini (ve maskelerini) önceden yükler. Tekrar çağrılırsa aynı promise döner. */
export const preloadHomeIslands = () => {
  if (!preloadPromise) {
    preloadPromise = Promise.all([
      ...ISLANDS.map((i) => loadOne(i.src)),
      ...ISLANDS.map((i) => loadOne(i.nightSrc)),
    ]).then(() => undefined);
  }
  return preloadPromise;
};

export const getIslandMask = (src: string) => maskCache.get(src) ?? null;

export const areHomeIslandsReady = () => ISLANDS.every((i) => imageCache.get(i.src)?.complete);

/** GMT (UTC) saatine göre akşam/gece mi? 18:00 - 06:00 arası gece kabul edilir. */
export const isNightTimeUTC = (d: Date = new Date()) => {
  const h = d.getUTCHours();
  return h >= 18 || h < 6;
};
