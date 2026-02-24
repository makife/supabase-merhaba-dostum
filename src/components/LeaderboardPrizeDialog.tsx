import { useState, useEffect } from "react";
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

const LeaderboardPrizeDialog = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notification, setNotification] = useState<PrizeNotification | null>(null);

  useEffect(() => {
    if (!user) return;

    const checkPrizeNotifications = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, message")
        .eq("user_id", user.id)
        .eq("type", "leaderboard_prize")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setNotification(data);
        setOpen(true);
      }
    };

    // Small delay so homepage renders first
    const timeout = setTimeout(checkPrizeNotifications, 1500);
    return () => clearTimeout(timeout);
  }, [user]);

  const handleClose = async () => {
    setOpen(false);
    if (notification) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);
    }
  };

  // Parse prizes from the notification message
  const parsePrizes = (message: string) => {
    const prizes: { label: string; amount: string; icon: string }[] = [];
    
    const degistirMatch = message.match(/(\d+)\s*Değiştir/);
    if (degistirMatch) prizes.push({ label: "Değiştir", amount: degistirMatch[1], icon: "/degistirIkon.png" });
    
    const fisildaMatch = message.match(/(\d+)\s*Fısılda/);
    if (fisildaMatch) prizes.push({ label: "Fısılda", amount: fisildaMatch[1], icon: "/fisildaIkon.png" });
    
    const senyazMatch = message.match(/(\d+)\s*Senyaz/);
    if (senyazMatch) prizes.push({ label: "Senyaz", amount: senyazMatch[1], icon: "/senyazIkon.png" });
    
    const oyunMatch = message.match(/\+?(\d+)\s*Oyun Sayfası/);
    if (oyunMatch) prizes.push({ label: "Oyun Sayfası", amount: oyunMatch[1], icon: "" });

    return prizes;
  };

  // Extract period name
  const getPeriodLabel = (message: string) => {
    if (message.includes("Haftalık")) return "Haftalık";
    if (message.includes("Aylık")) return "Aylık";
    if (message.includes("Sezon")) return "Sezon";
    return "Liderlik";
  };

  if (!notification) return null;

  const prizes = parsePrizes(notification.message);
  const period = getPeriodLabel(notification.message);

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent className="bg-[#1a1a2e] border-amber-500/30 text-white max-w-sm p-0 overflow-hidden">
        {/* Top glow */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-amber-500/20 to-transparent pointer-events-none" />
        
        <div className="relative p-6 flex flex-col items-center text-center">
          {/* Trophy animation */}
          <AnimatePresence>
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/40 mb-4"
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
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="absolute top-12 right-10"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xl font-bold mb-1">🎉 Tebrikler!</h2>
            <p className="text-sm text-amber-300 font-semibold mb-4">
              {period} sıralamada 1. oldun!
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
              <Gift className="w-3.5 h-3.5 text-amber-400" />
              Kazandığın Hediyeler
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
                    <Gift className="w-7 h-7 text-amber-400" />
                  )}
                  <span className="text-lg font-bold text-amber-400">+{prize.amount}</span>
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
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-amber-500/20"
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
