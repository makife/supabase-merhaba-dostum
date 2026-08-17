/**
 * Global buton ses efekti
 *
 * Tüm uygulamada <button>, [role="button"], <a> ve data-sfx işaretli
 * elemanlara tek merkezden tık sesi ekler. Böylece her yeni butona
 * ayrı ayrı ses kodu yazmak gerekmez.
 *
 * Sessize almak için elemana `data-no-sfx` ekle.
 */

import { Capacitor } from "@capacitor/core";
import { isSoundEffectsEnabled } from "@/utils/soundSettings";
import { isNativePlatform, playNativeSound } from "@/services/nativeAudioService";
import { isIOSWebAudioTarget, playIOSWebSound } from "@/services/iosWebAudioService";

const CLICK_URL = "/oyunicibutonsesi.mp3";
const VOLUME = 0.5;
const POOL_SIZE = 3;

let installed = false;
let pool: HTMLAudioElement[] = [];
let poolIndex = 0;
let lastPlay = 0;

const isIOS = isIOSWebAudioTarget();
const isAndroidNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

const ensurePool = () => {
  if (pool.length) return;
  for (let i = 0; i < POOL_SIZE; i++) {
    const a = new Audio(CLICK_URL);
    a.preload = "auto";
    a.volume = VOLUME;
    a.setAttribute("playsinline", "true");
    pool.push(a);
  }
};

export const playGlobalButtonSound = () => {
  if (!isSoundEffectsEnabled()) return;

  // Aynı tık için çift çalmayı engelle (pointerdown + click gibi)
  const now = Date.now();
  if (now - lastPlay < 70) return;
  lastPlay = now;

  if (isIOS) {
    void playIOSWebSound("button_click", VOLUME, CLICK_URL);
    return;
  }
  if (isAndroidNative && isNativePlatform()) {
    void playNativeSound("button_click", VOLUME);
    return;
  }

  try {
    ensurePool();
    const audio = pool[poolIndex % pool.length];
    poolIndex++;
    try {
      audio.currentTime = 0;
    } catch {
      /* ignore */
    }
    audio.volume = VOLUME;
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    /* ignore */
  }
};

const isInteractive = (el: Element | null): boolean => {
  if (!el) return false;
  const target = el.closest(
    'button, [role="button"], a[href], summary, [data-sfx], input[type="button"], input[type="submit"], input[type="checkbox"], input[type="radio"], label[for], select, [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], [role="radio"]'
  );
  if (!target) return false;
  if (target.closest("[data-no-sfx]")) return false;
  if (target.hasAttribute("disabled")) return false;
  if (target.getAttribute("aria-disabled") === "true") return false;
  return true;
};

export const installGlobalButtonSound = () => {
  if (installed || typeof document === "undefined") return;
  installed = true;

  document.addEventListener(
    "pointerdown",
    (e) => {
      const t = e.target as Element | null;
      if (isInteractive(t)) playGlobalButtonSound();
    },
    { capture: true, passive: true }
  );

  // Klavye ile tetiklenen (pointer olmayan) tıklamalar
  document.addEventListener(
    "click",
    (e) => {
      const ev = e as MouseEvent;
      if (ev.detail !== 0) return; // pointerdown zaten çaldı
      const t = e.target as Element | null;
      if (isInteractive(t)) playGlobalButtonSound();
    },
    { capture: true, passive: true }
  );
};

/**
 * Global katman az önce tık sesi çaldı mı?
 * Kendi buton sesini çalan eski bileşenlerin çift ses çıkarmasını önler.
 */
export const globalButtonSoundJustPlayed = (windowMs = 250): boolean =>
  Date.now() - lastPlay < windowMs;
