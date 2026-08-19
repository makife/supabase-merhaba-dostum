import React, { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { useJokerInventory } from "@/hooks/useJokerInventory";
import { useUser } from "@/contexts/UserContext";

/**
 * Market sayfasının üstünde sabit duran envanter şeridi:
 * sahip olunan jokerler + sahip olunan oyun hakkı.
 * Uçan ikon animasyonunun hedefleri data-inv-target attribute'u ile bulunur.
 */
const chipClass =
  "flex items-center gap-1 rounded-xl bg-white/90 border border-indigo-100 shadow-sm px-2 py-1";

export const MarketInventoryBar: React.FC = () => {
  const { jokers } = useJokerInventory();
  const { profile } = useUser();
  const [hakAnim, setHakAnim] = useState<any>(null);

  useEffect(() => {
    fetch("/sayfaHak.json")
      .then((r) => r.json())
      .then(setHakAnim)
      .catch(() => {});
  }, []);

  const credits = (profile?.game_credits || 0) + ((profile as any)?.bonus_credits || 0);

  const items = [
    { key: "degistir", icon: "/icons/degistir.svg", count: jokers.degistir, label: "Değiştir" },
    { key: "fisilda", icon: "/icons/fisilda.svg", count: jokers.fisilida, label: "Fısılda" },
    { key: "senyaz", icon: "/icons/senyaz.svg", count: jokers.senYaz, label: "Sen Yaz" },
  ];

  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <div className="flex items-center gap-1.5">
        {items.map((it) => (
          <div key={it.key} className={chipClass} data-inv-target={it.key} title={it.label}>
            <img src={it.icon} alt={it.label} className="w-6 h-6 object-contain" />
            <span className="text-xs font-bold text-slate-700 tabular-nums">{it.count}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
      <div className={chipClass} data-inv-target="hak" title="Oyun Hakkı">
        {hakAnim ? (
          <Lottie animationData={hakAnim} loop autoplay style={{ width: 26, height: 26 }} />
        ) : (
          <div className="w-[26px] h-[26px]" />
        )}
        <span className="text-xs font-bold text-slate-700 tabular-nums">{credits}</span>
      </div>
      </div>
    </div>
  );
};

export default MarketInventoryBar;
