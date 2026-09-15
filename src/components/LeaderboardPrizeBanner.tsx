import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { PressableZone } from "@/components/ui/pressable-zone";
import genel1 from "@/assets/genel1lik.webp";
import genel2 from "@/assets/genel2lik.webp";
import genel3 from "@/assets/genel3luk.webp";
import aylik1 from "@/assets/aylik1lik.webp";
import aylik2 from "@/assets/aylik2lik.webp";
import aylik3 from "@/assets/aylik3luk.webp";
import haftalik1 from "@/assets/haftalik1lik.webp";
import haftalik2 from "@/assets/haftalik2lik.webp";
import haftalik3 from "@/assets/haftalik3luk.webp";

interface LeaderboardPrizeBannerProps {
  tab: "all-time" | "weekly" | "monthly";
}

const PRIZE_CARDS: Record<LeaderboardPrizeBannerProps["tab"], string[]> = {
  "all-time": [genel1, genel2, genel3],
  monthly: [aylik1, aylik2, aylik3],
  weekly: [haftalik1, haftalik2, haftalik3],
};


// 4-month seasons: Jan-Apr, May-Aug, Sep-Dec
function getSeasonEnd(): Date {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  // Season boundaries: months 0-3, 4-7, 8-11
  const seasonEndMonth = month < 4 ? 4 : month < 8 ? 8 : 12;
  const endYear = seasonEndMonth === 12 ? year + 1 : year;
  const endMonth = seasonEndMonth === 12 ? 0 : seasonEndMonth;
  return new Date(endYear, endMonth, 1, 0, 0, 0, 0);
}

function getWeekEnd(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const end = new Date(now);
  end.setDate(now.getDate() + daysUntilMonday);
  end.setHours(0, 0, 0, 0);
  return end;
}

function getMonthEnd(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Süre doldu!";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}g ${hours}s ${minutes}dk`;
  if (hours > 0) return `${hours}s ${minutes}dk ${seconds}sn`;
  return `${minutes}dk ${seconds}sn`;
}

const LeaderboardPrizeBanner = ({ tab }: LeaderboardPrizeBannerProps) => {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const tick = () => {
      const endDate = tab === "all-time" ? getSeasonEnd() : tab === "weekly" ? getWeekEnd() : getMonthEnd();
      const ms = endDate.getTime() - Date.now();
      setRemaining(formatCountdown(ms));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tab]);

  const cards = PRIZE_CARDS[tab];

  const borderColor =
    tab === "all-time" ? "border-red-500/30" : tab === "weekly" ? "border-blue-500/30" : "border-green-500/30";

  const timerColor = tab === "all-time" ? "text-red-400" : tab === "weekly" ? "text-blue-400" : "text-green-400";

  return (
    <div className={`relative rounded-2xl border ${borderColor} bg-black/20 backdrop-blur-md p-2.5 mb-4`}>
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <Clock className={`w-3.5 h-3.5 ${timerColor}`} />
        <span className={`text-xs font-bold ${timerColor}`}>Ödül için: {remaining}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {cards.map((src, i) => (
          <div key={i} className="relative">
            <img
              src={src}
              alt={`${i + 1}. ödül kartı`}
              className="w-full h-auto select-none rounded-xl"
              draggable={false}
            />
            {/* Görselin üzerindeki "Ödülleri Al" butonuna görünmez hit-zone */}
            <PressableZone
              label="Ödülleri Al"
              haptic="medium"
              className="rounded-full"
              style={{ top: "78.5%", left: "23%", width: "54%", height: "5.5%" }}
            />
          </div>
        ))}
      </div>


      <p className="text-[10px] text-slate-400 text-center mt-1.5">🏆 İlk 3 oyuncuya verilecek</p>
    </div>
  );
};

export default LeaderboardPrizeBanner;

