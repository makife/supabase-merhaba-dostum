import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Gift, Trophy, PartyPopper, Sparkles, Target } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PrizeNotification {
  id: string;
  message: string;
}

type ChallengeType = "puzzle" | "reaktor" | "neon_blitz" | "memory" | "default";

const CHALLENGE_THEMES: Record<ChallengeType, {
  bg: string;
  border: string;
  glow: string;
  icon: string;
  iconBg: string;
  iconShadow: string;
  text: string;
  subtext: string;
  button: string;
  buttonHover: string;
  buttonShadow: string;
  giftIcon: string;
  label: string;
}> = {
  puzzle: {
    bg: "#1a0f2e",
    border: "border-purple-500/30",
    glow: "from-purple-500/20",
    icon: "🧩",
    iconBg: "from-purple-400 to-purple-600",
    iconShadow: "shadow-purple-500/40",
    text: "text-purple-300",
    subtext: "text-purple-200",
    button: "from-purple-500 to-purple-700",
    buttonHover: "hover:from-purple-600 hover:to-purple-800",
    buttonShadow: "shadow-purple-500/20",
    giftIcon: "text-purple-400",
    label: "Kelime Puzzle",
  },
  reaktor: {
    bg: "#1a2e0f",
    border: "border-lime-500/30",
    glow: "from-lime-500/20",
    icon: "☢️",
    iconBg: "from-lime-400 to-lime-600",
    iconShadow: "shadow-lime-500/40",
    text: "text-lime-300",
    subtext: "text-lime-200",
    button: "from-lime-500 to-lime-700",
    buttonHover: "hover:from-lime-600 hover:to-lime-800",
    buttonShadow: "shadow-lime-500/20",
    giftIcon: "text-lime-400",
    label: "Reaktör Koşusu",
  },
  neon_blitz: {
    bg: "#0f1a2e",
    border: "border-cyan-500/30",
    glow: "from-cyan-500/20",
    icon: "⚡",
    iconBg: "from-cyan-400 to-cyan-600",
    iconShadow: "shadow-cyan-500/40",
    text: "text-cyan-300",
    subtext: "text-cyan-200",
    button: "from-cyan-500 to-cyan-700",
    buttonHover: "hover:from-cyan-600 hover:to-cyan-800",
    buttonShadow: "shadow-cyan-500/20",
    giftIcon: "text-cyan-400",
    label: "Refleks",
  },
  memory: {
    bg: "#2e1a0f",
    border: "border-amber-500/30",
    glow: "from-amber-500/20",
    icon: "🧠",
    iconBg: "from-amber-400 to-amber-600",
    iconShadow: "shadow-amber-500/40",
    text: "text-amber-300",
    subtext: "text-amber-200",
    button: "from-amber-500 to-amber-700",
    buttonHover: "hover:from-amber-600 hover:to-amber-800",
    buttonShadow: "shadow-amber-500/20",
    giftIcon: "text-amber-400",
    label: "Kelime Hafıza",
  },
  default: {
    bg: "#1a1a2e",
    border: "border-indigo-500/30",
    glow: "from-indigo-500/20",
    icon: "🎯",
    iconBg: "from-indigo-400 to-indigo-600",
    iconShadow: "shadow-indigo-500/40",
    text: "text-indigo-300",
    subtext: "text-indigo-200",
    button: "from-indigo-500 to-indigo-700",
    buttonHover: "hover:from-indigo-600 hover:to-indigo-800",
    buttonShadow: "shadow-indigo-500/20",
    giftIcon: "text-indigo-400",
    label: "Challenge",
  },
};

const ChallengePrizeDialog = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<PrizeNotification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkChallengePrizes = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, message")
        .eq("user_id", user.id)
        .eq("type", "challenge_prize")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!error && data && data.length > 0) {
        setNotifications(data);
        setCurrentIndex(0);
        setOpen(true);

        try {
          const { isSoundEffectsEnabled } = await import("@/utils/soundSettings");
          if (isSoundEffectsEnabled()) {
            const audio = new Audio("/odulMuzik.mp3");
            audio.volume = 0.7;
            audioRef.current = audio;
            await audio.play();
          }
        } catch (e) {
          console.warn("Müzik çalınamadı:", e);
        }
      }
    };

    // LeaderboardPrizeDialog 3s'de çalışıyor, bu 5s'de çalışsın çakışmasın
    const timeout = setTimeout(checkChallengePrizes, 5000);
    return () => clearTimeout(timeout);
  }, [user]);

  const handleClose = async () => {
    // Mevcut bildirimi okundu yap
    const current = notifications[currentIndex];
    if (current) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", current.id);
    }

    // Daha fazla bildirim varsa sonrakine geç
    if (currentIndex < notifications.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Hepsini gördü, kapat
      setOpen(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    }
  };

  const detectChallengeType = (message: string): ChallengeType => {
    if (message.includes("Puzzle") || message.includes("puzzle")) return "puzzle";
    if (message.includes("Reaktör") || message.includes("reaktor") || message.includes("Reaktor")) return "reaktor";
    if (message.includes("Refleks") || message.includes("refleks") || message.includes("neon") || message.includes("Neon")) return "neon_blitz";
    if (message.includes("Hafıza") || message.includes("hafıza") || message.includes("memory") || message.includes("Memory")) return "memory";
    return "default";
  };

  const parsePrizes = (message: string) => {
    const prizes: { label: string; amount: string; icon: string }[] = [];

    const inkMatch = message.match(/(\d+)\s*Mürekkep\s*Damla/i);
    if (inkMatch) prizes.push({ label: "Mürekkep", amount: inkMatch[1], icon: "/murekkepikon.png" });

    const creditMatch = message.match(/(\d+)\s*Oyun\s*Sayfas/i);
    if (creditMatch) prizes.push({ label: "Oyun Sayfası", amount: creditMatch[1], icon: "" });

    const spinMatch = message.match(/(\d+)\s*Çark\s*Çevirme/i);
    if (spinMatch) prizes.push({ label: "Çark Hakkı", amount: spinMatch[1], icon: "/carkOdul.png" });

    const fisildaMatch = message.match(/(\d+)\s*Fısıl[dt]a/i);
    if (fisildaMatch) prizes.push({ label: "Fısılda", amount: fisildaMatch[1], icon: "/fisildaIkon.png" });

    const degistirMatch = message.match(/(\d+)\s*Değiştir/i);
    if (degistirMatch) prizes.push({ label: "Değiştir", amount: degistirMatch[1], icon: "/degistirIkon.png" });

    const senyazMatch = message.match(/(\d+)\s*Senyaz/i);
    if (senyazMatch) prizes.push({ label: "Senyaz", amount: senyazMatch[1], icon: "/senyazIkon.png" });

    return prizes;
  };

  if (notifications.length === 0) return null;

  const current = notifications[currentIndex];
  if (!current) return null;

  const challengeType = detectChallengeType(current.message);
  const theme = CHALLENGE_THEMES[challengeType];
  const prizes = parsePrizes(current.message);
  const hasMultiple = notifications.length > 1;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent
        className={`${theme.border} text-white max-w-[calc(100%-2.5rem)] mx-auto p-0 overflow-hidden`}
        style={{ backgroundColor: theme.bg }}
      >
        {/* Top glow */}
        <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b ${theme.glow} to-transparent pointer-events-none`} />

        <div className="relative p-6 flex flex-col items-center text-center">
          {/* Icon */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 20 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className={`w-20 h-20 bg-gradient-to-br ${theme.iconBg} rounded-full flex items-center justify-center mb-4`}
            >
              <span className="text-4xl">{theme.icon}</span>
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
            key={`title-${currentIndex}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-bold mb-1">🎯 Görev Ödülü!</h2>
            <p className={`text-sm ${theme.text} font-semibold mb-1`}>
              {theme.label} Challenge
            </p>
            {hasMultiple && (
              <p className="text-[10px] text-slate-500 mb-2">
                {currentIndex + 1} / {notifications.length}
              </p>
            )}
          </motion.div>

          {/* Prizes */}
          <motion.div
            key={`prizes-${currentIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full bg-slate-800/60 border border-white/10 rounded-2xl p-4 mb-4"
          >
            <p className="text-xs text-slate-400 mb-3 flex items-center justify-center gap-1.5">
              <Gift className={`w-3.5 h-3.5 ${theme.giftIcon}`} />
              Kazandığın Hediyeler
            </p>
            {prizes.length > 0 ? (
              <div className={`grid ${prizes.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
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
            ) : (
              <p className="text-sm text-slate-300 py-2">
                {current.message.replace(/^🎯\s*/, "").replace(/^🧠\s*/, "")}
              </p>
            )}
          </motion.div>

          {/* Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="w-full"
          >
            <Button
              onClick={handleClose}
              className={`w-full bg-gradient-to-r ${theme.button} text-white font-bold py-3 rounded-xl`}
            >
              <PartyPopper className="w-4 h-4 mr-2" />
              {currentIndex < notifications.length - 1 ? "Sonraki Ödül →" : "Harika!"}
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChallengePrizeDialog;
