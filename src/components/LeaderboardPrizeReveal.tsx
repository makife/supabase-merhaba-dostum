import { useEffect, useRef, useState } from "react";
import Lottie from "lottie-react";
import LeaderboardPrizeBanner from "@/components/LeaderboardPrizeBanner";
import odulBuradaAnim from "@/assets/odulBurada.json";
import { useSounds } from "@/hooks/useSounds";

interface Props {
  tab: "all-time" | "weekly" | "monthly";
}

const LeaderboardPrizeReveal = ({ tab }: Props) => {
  const [open, setOpen] = useState(false);
  const [confetti, setConfetti] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const confettiTimer = useRef<number | null>(null);
  const { playSound } = useSounds();

  useEffect(() => {
    fetch("/gunlukKonfeti.json")
      .then((r) => r.json())
      .then(setConfetti)
      .catch(() => {});
    return () => {
      if (confettiTimer.current) window.clearTimeout(confettiTimer.current);
    };
  }, []);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    playSound("buttonClick");
    if (next) {
      if (confettiTimer.current) window.clearTimeout(confettiTimer.current);
      setConfettiKey((k) => k + 1);
      setShowConfetti(true);
      confettiTimer.current = window.setTimeout(() => setShowConfetti(false), 3500);
    } else {
      setShowConfetti(false);
    }
  };


  const borderColor =
    tab === "all-time" ? "border-red-500/30" : tab === "weekly" ? "border-blue-500/30" : "border-green-500/30";

  return (
    <div className="relative">
      {/* Kapalı/başlık kartı — sekme kartıyla aynı ölçülerde */}
      <button
        type="button"
        onClick={handleToggle}
        className={`relative w-full grid grid-cols-3 items-center bg-[#1e2d45] border ${borderColor} rounded-xl p-1 h-auto overflow-hidden active:scale-[0.99] transition-transform`}
      >
        <div className="h-9 w-full">
          <Lottie animationData={odulBuradaAnim} loop autoplay style={{ width: "100%", height: "100%" }} />
        </div>
        <span className="text-sm font-black tracking-wider text-amber-300 whitespace-nowrap text-center">
          ÖDÜL BURADA
        </span>
        <div className="h-9 w-full">
          <Lottie animationData={odulBuradaAnim} loop autoplay style={{ width: "100%", height: "100%" }} />
        </div>
      </button>

      {/* Açılan ödül kartı */}
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-500 ease-out"
        style={{ maxHeight: open ? 600 : 0, opacity: open ? 1 : 0 }}
      >
        <div className="pt-2">
          <LeaderboardPrizeBanner tab={tab} />
        </div>
      </div>

      {/* Konfeti (tek seferlik) */}
      {showConfetti && confetti && (
        <div className="absolute inset-x-0 top-0 h-[420px] z-30 pointer-events-none">
          <Lottie animationData={confetti} loop={false} style={{ width: "100%", height: "100%" }} />
        </div>
      )}
    </div>
  );
};

export default LeaderboardPrizeReveal;
