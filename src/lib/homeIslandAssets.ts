/**
 * Ana sayfadaki yüzen ada görselleri + alfa maskeleri.
 * Modül seviyesinde önbelleğe alınır: oyuncu başka sayfalara gidip ana sayfaya
 * döndüğünde görseller ve maskeler zaten hazır olur (yeniden yükleme beklemesi yok).
 */
export type IslandKey = "oyunModlari" | "duello" | "carki" | "sohbet" | "arkadaslik";

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
}

export const ISLANDS: IslandDef[] = [
  { key: "oyunModlari", src: "/anaSayfa/adalar/oyunModlari.png", nightSrc: "/anaSayfa/adalar/gece/oyunModlari.png", left: 8.85, top: 3.47, width: 43.62, height: 21.88, px: 47.3, py: 31.7, label: "Oyun Modları" },
  { key: "duello", src: "/anaSayfa/adalar/duello.png", nightSrc: "/anaSayfa/adalar/gece/duello.png", left: 42.84, top: 10.94, width: 54.56, height: 30.38, px: 42.5, py: 29.3, label: "Düello & Challenge" },
  { key: "carki", src: "/anaSayfa/adalar/carki.png", nightSrc: "/anaSayfa/adalar/gece/carki.png", left: 3.65, top: 26.91, width: 50.39, height: 31.68, px: 43.3, py: 26.4, label: "Şans Çarkı" },
  { key: "sohbet", src: "/anaSayfa/adalar/sohbet.png", nightSrc: "/anaSayfa/adalar/gece/sohbet.png", left: 46.88, top: 41.41, width: 50.13, height: 30.64, px: 47.0, py: 33.0, label: "Sohbet" },
  { key: "arkadaslik", src: "/anaSayfa/adalar/arkadaslik.png", nightSrc: "/anaSayfa/adalar/gece/arkadaslik.png", left: 12.11, top: 57.99, width: 64.58, height: 39.24, px: 48.5, py: 40.4, label: "Arkadaşlık" },
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
