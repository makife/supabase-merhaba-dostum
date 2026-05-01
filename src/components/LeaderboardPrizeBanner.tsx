import { useState, useEffect } from "react";
import { Gift, Clock, Zap } from "lucide-react";
import Lottie from "lottie-react";

interface PrizeInfo {
  degistir: number;
  fisilida: number;
  senyaz: number;
  oyunHakki?: number;
  boostLabel: string;
}

interface LeaderboardPrizeBannerProps {
  tab: "all-time" | "weekly" | "monthly";
}

const PRIZE_CONFIG: Record<string, { prizes: PrizeInfo }> = {
  "all-time": {
    prizes: { degistir: 20, fisilida: 20, senyaz: 20, oyunHakki: 25, boostLabel: "1 ay boyunca maç sonu puanı x2" },
  },
  weekly: {
    prizes: { degistir: 3, fisilida: 3, senyaz: 3, oyunHakki: 3, boostLabel: "1 gün boyunca maç sonu puanı x2" },
  },
  monthly: {
    prizes: { degistir: 8, fisilida: 8, senyaz: 8, oyunHakki: 10, boostLabel: "1 hafta boyunca maç sonu puanı x2" },
  },
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
  const [giftAnim, setGiftAnim] = useState<any>(null);

  useEffect(() => {
    fetch("/liderlikhediye.json")
      .then((r) => r.json())
      .then(setGiftAnim)
      .catch(() => {});
  }, []);

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

  const config = PRIZE_CONFIG[tab];
  const { prizes } = config;

  const borderColor =
    tab === "all-time" ? "border-red-500/30" : tab === "weekly" ? "border-blue-500/30" : "border-green-500/30";

  const bgGlow =
    tab === "all-time"
      ? "from-red-500/10 to-orange-500/10"
      : tab === "weekly"
        ? "from-blue-500/10 to-cyan-500/10"
        : "from-green-500/10 to-emerald-500/10";

  const timerColor = tab === "all-time" ? "text-red-400" : tab === "weekly" ? "text-blue-400" : "text-green-400";

  return (
    <div
      className={`relative rounded-2xl border ${borderColor} bg-gradient-to-r ${bgGlow} backdrop-blur-md p-3 mb-4 overflow-hidden`}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse pointer-events-none" />

      <div className="flex items-center gap-3 relative z-10">
        {/* Gift Animation */}
        <div className="flex-shrink-0 w-14 h-14 drop-shadow-lg relative overflow-visible">
          {giftAnim ? (
            <div
              className="absolute pointer-events-none"
              style={{
                width: "200%",
                height: "200%",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <Lottie animationData={giftAnim} loop autoplay style={{ width: "100%", height: "100%" }} />
            </div>
          ) : null}
        </div>

        {/* Prize Info */}
        <div className="flex-1 min-w-0">
          {/* Countdown */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <Clock className={`w-3.5 h-3.5 ${timerColor}`} />
            <span className={`text-xs font-bold ${timerColor}`}>Ödül için: {remaining}</span>
          </div>

          {/* Prize items */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-300">
            <span className="flex items-center gap-1">
              <img src="/icons/degistir.svg" alt="" className="w-4 h-4" />
              {prizes.degistir} Değiştir
            </span>
            <span className="flex items-center gap-1">
              <img src="/icons/fisilda.svg" alt="" className="w-4 h-4" />
              {prizes.fisilida} Fısılda
            </span>
            <span className="flex items-center gap-1">
              <img src="/icons/senyaz.svg" alt="" className="w-4 h-4" />
              {prizes.senyaz} Senyaz
            </span>
            {prizes.oyunHakki && (
              <span className="flex items-center gap-1">
                <Gift className="w-3.5 h-3.5 text-amber-400" />+{prizes.oyunHakki} Oyun Sayfası
              </span>
            )}
          </div>

          {/* Boost rozeti */}
          <div className="flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 w-fit">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-300">{prizes.boostLabel}</span>
          </div>

          <p className="text-[10px] text-slate-500 mt-1">🏆 1. sıradaki oyuncuya verilecek</p>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPrizeBanner;
