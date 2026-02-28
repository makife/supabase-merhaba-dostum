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
        .eq("type", "system")
        .eq("is_read", false)
        .ilike("message", "%liderlik tablosunda 1. oldun%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setNotification(data);
        setOpen(true);

        // M\u00fczik \u00e7al
        try {
          const audio = new Audio("/odulMuzik.mp3");
          audio.volume = 0.7;
          audioRef.current = audio;
          await audio.play();
        } catch (e) {
          console.warn("M\u00fczik \u00e7al\u0131namad\u0131:", e);
        }
      }
    };

    const timeout = setTimeout(checkPrizeNotifications, 1500);
    return () => clearTimeout(timeout);
  }, [user]);

  const handleClose = async () => {
    setOpen(false);

    // M\u00fczi\u011fi durdur ve s\u0131f\u0131rla
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

    const fisildaMatch = message.match(/(\d+)\s*F\u0131s\u0131lda/);
