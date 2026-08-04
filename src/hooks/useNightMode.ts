import { useEffect, useState } from "react";
import { isNightTimeUTC } from "@/lib/homeIslandAssets";

/** GMT saatine göre gece modu (18:00 - 06:00 UTC). Her dakika kontrol edilir. */
export const useNightMode = () => {
  const [isNight, setIsNight] = useState(() => isNightTimeUTC());

  useEffect(() => {
    const id = setInterval(() => setIsNight(isNightTimeUTC()), 60000);
    return () => clearInterval(id);
  }, []);

  return isNight;
};

export default useNightMode;
