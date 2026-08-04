import { useEffect, useState } from "react";
import { isNightTimeUTC } from "@/lib/homeIslandAssets";

const KEY = "night_mode_override"; // "night" | "day" | null
const EVENT = "night-mode-override-change";

export const getNightOverride = (): "night" | "day" | null => {
  const v = localStorage.getItem(KEY);
  return v === "night" || v === "day" ? v : null;
};

export const setNightOverride = (value: "night" | "day" | null) => {
  if (value) localStorage.setItem(KEY, value);
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
};

const resolve = () => {
  const o = getNightOverride();
  if (o) return o === "night";
  return isNightTimeUTC();
};

/** GMT saatine göre gece modu (18:00 - 06:00 UTC). Test için override edilebilir. */
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
