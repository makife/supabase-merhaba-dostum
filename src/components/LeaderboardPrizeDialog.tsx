import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Gift, Trophy, PartyPopper, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PrizeNotification {
  id: string;
  message: string;
}

type PeriodType = "weekly" | "monthly" | "season";

const THEMES: Record<PeriodType, {
  bg: string;
  border: string;
  glow: string;
  trophy: string;
  trophyshadow: string;
  text: string;
  subtext: string;
  button: string;
  buttonHover: string;
  buttonshadow: string;
  giftIcon: string;
}> = {
  weekly: {
    bg: "#0f1a2e",
    border: "border-blue-500/30",
    glow: "from-blue-500/20",
    trophy: "from-blue-400 to-blue-600",
    trophyshadow: "shadow-blue-500/40",
    text: "text-blue-300",
    subtext: "text-blue-200",
    button: "from-blue-500 to-blue-700",
    buttonHover: "hover:from-blue-600 hover:to-blue-800",
    buttonshadow: "shadow-blue-500/20",
    giftIcon: "text-blue-400",
  },
  monthly: {
    bg: "#0f2e1a",
    border: "border-green-500/30",
    glow: "from-green-500/20",
    trophy: "from-green-400 to-green-600",
    trophyshadow: "shadow-green-500/40",
    text: "text-green-300",
    subtext: "text-green-200",
    button: "from-green-500 to-green-700",
    buttonHover: "hover:from-green-600 hover:to-green-800",
    buttonshadow: "shadow-green-500/20",
    giftIcon: "text-green-400",
  },
  season: {
    bg: "#2e0f0f",
    border: "border-red-500/30",
    glow: "from-red-500/20",
    trophy: "from-red-400 to-red-700",
    trophyshadow: "shadow-red-500/40",
    text: "text-red-300",
    subtext: "text-red-200",
    button: "from-red-500 to-red-700",
    buttonHover: "hover:from-red-600 hover:to-red-800",
    buttonshadow: "shadow-red-500/20",
    giftIcon: "text-red-400",
  },
};

const LeaderboardPrizeDialog = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notification, setNotification] = useState<PrizeNotification | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkPrizeNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, message")
        .eq("user_id", user.id)
        .eq("type", "leaderboard_prize")
        .eq("is_read", false)
        .ilike("message", "%liderlik tablosunda 1. oldun%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setNotification(data);
        setOpen(true);

        try {
          const audio = new Audio("/odulMuzik.mp3");
          audio.volume = 0.7;
          audioRef.current = audio;
          await audio.play();
        } catch (e) {
          console.warn("Muzik calinamadi:", e);
        }
      }
    };

    const timeout = setTimeout(checkPrizeNotifications, 3000);
    return () => clearTimeout(timeout);
  }, [user]);

  const handleClose = async () => {
    setOpen(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (notification) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);
    }
  };

  const parsePrizes = (message: string) => {
    const prizes: { label: string; amount: string; icon: string }[] = [];

    const degistirMatch = message.match(/(\d+)\s*De\u011fi\u015ftir/);
    if (degistirMatch) prizes.push({ label: "De\u011fi\u015ftir", amount: degistirMatch[1], icon: "/degistirIkon.png" });

    const fisildaMatch = message.match(/(\d+)\s*F[\u0131i]s[\u0131i]lda/);
    if (fisildaMatch) prizes.push({ label: "F\u0131s\u0131lda", amount: fisildaMatch[1], icon: "/fisildaIkon.png" });

    const senyazMatch = message.match(/(\d+)\s*Senyaz/);
    if (senyazMatch) prizes.push({ label: "Senyaz", amount: senyazMatch[1], icon: "/senyazIkon.png" });

    const oyunMatch = message.match(/\+?(\d+)\s*Oyun Sayfas[\u0131i]/);
    if (oyunMatch) prizes.push({ label: "Oyun Sayfas\u0131", amount: oyunMatch[1], icon: "" });

    return prizes;
  };

  const getPeriod = (message: string): { label: string; type: PeriodType } => {
    if (message.includes("Haftal")) return { label: "Haftal\u0131k", type: "weekly" };
    if (message.includes("Ayl")) return { label: "Ayl\u0131k", type: "monthly" };
    if (message.includes("Sezon")) return { label: "Sezon", type: "season" };
    return { label: "Liderlik", type: "monthly" };
  };

  if (!notification) return null;

  const prizes = parsePrizes(notification.message);
  const { label: period, type: periodType } = getPeriod(notification.message);
  const theme = THEMES[periodType];

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent
        className={`${theme.border} text-white max-w-sm p-0 overflow-hidden`}
        style={{ backgroundColor: theme.bg }}
      >
        {/* Top glow */}
        <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${theme.glow} to-transparent pointer-events-none`} />

        <div className="relative p-6 flex flex-col items-center text-center">
          {/* Trophy */}
          <AnimatePresence>
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className={`w-20 h-20 bg-gradient-to-br ${theme.trophy} rounded-full flex items-center justify-center shadow-2xl ${theme.trophyshadow} mb-4`}
            >
              <Trophy className="w-10 h-10 text-white" />
            </motion.div>
          </AnimatePresence>

          {/* Sparkles */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute top-8 left-8"
          >
            <Sparkles className={`w-5 h-5 ${theme.text} animate-pulse`} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="absolute top-12 right-10"
          >
            <Sparkles className={`w-4 h-4 ${theme.subtext} animate-pulse`} />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-bold mb-1">{"\uD83C\uDF89"} Tebrikler!</h2>
            <p className={`text-sm ${theme.text} font-semibold mb-4`}>
              {period} s{"\u0131"}ralamada 1. oldun!
            </p>
          </motion.div>

          {/* Prizes */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full bg-slate-800/60 border border-white/10 rounded-2xl p-4 mb-4"
          >
            <p className="text-xs text-slate-400 mb-3 flex items-center justify-center gap-1.5">
              <Gift className={`w-3.5 h-3.5 ${theme.giftIcon}`} />
              Kazand{"\u0131\u011F\u0131n"} Hediyeler
            </p>
            <div className="grid grid-cols-2 gap-2">
              {prizes.map((prize, i) => (
                <motion.div
                  key={prize.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
                  className="bg-slate-700/50 border border-white/5 rounded-xl p-3 flex flex-col items-center gap-1.5"
                >
                  {prize.icon ? (
                    <img src={prize.icon} alt="" className="w-8 h-8 object-contain" />
                  ) : (
                    <Gift className={`w-7 h-7 ${theme.giftIcon}`} />
                  )}
                  <span className={`text-lg font-bold ${theme.text}`}>+{prize.amount}</span>
                  <span className="text-[10px] text-slate-400">{prize.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Close button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="w-full"
          >
            <Button
              onClick={handleClose}
              className={`w-full bg-gradient-to-r ${theme.button} ${theme.buttonHover} text-white font-bold py-3 rounded-xl shadow-lg ${theme.buttonshadow}`}
            >
              <PartyPopper className="w-4 h-4 mr-2" />
              Harika!
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeaderboardPrizeDialog;
