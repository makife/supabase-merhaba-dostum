import { useEffect, useState } from "react";
import { isNightTimeUTC } from "@/lib/homeIslandAssets";

const KEY = "night_mode_override"; // "night" | "day" | null
const BASE_KEY = "night_mode_override_base"; // override anındaki doğal faz
const EVENT = "night-mode-override-change";

export const getNightOverride = (): "night" | "day" | null => {
  const v = localStorage.getItem(KEY);
  if (v !== "night" && v !== "day") return null;

  // Doğal faz (GMT) değiştiyse override kendiliğinden düşer
  const base = localStorage.getItem(BASE_KEY);
  const naturalNow = isNightTimeUTC() ? "night" : "day";
  if (base && base !== naturalNow) {
    localStorage.removeItem(KEY);
    localStorage.removeItem(BASE_KEY);
    return null;
  }
  return v;
};

export const setNightOverride = (value: "night" | "day" | null) => {
  if (value) {
    localStorage.setItem(KEY, value);
    localStorage.setItem(BASE_KEY, isNightTimeUTC() ? "night" : "day");
  } else {
    localStorage.removeItem(KEY);
    localStorage.removeItem(BASE_KEY);
  }
  window.dispatchEvent(new Event(EVENT));
};

const resolve = () => {
  const o = getNightOverride();
  if (o) return o === "night";
  return isNightTimeUTC();
};

/**
 * GMT saatine göre gece modu (18:00 - 06:00 UTC).
 * Manuel seçim geçici: doğal faz değişince otomatik olarak GMT saatine döner.
 */
export const useNightMode = () => {
  const [isNight, setIsNight] = useState(resolve);

  useEffect(() => {
    const update = () => setIsNight(resolve());
    const id = setInterval(update, 60000);
    window.addEventListener(EVENT, update);
    return () => {
      clearInterval(id);
      window.removeEventListener(EVENT, update);
    };
  }, []);

  return isNight;
};

export default useNightMode;
