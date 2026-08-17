import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PressableZone } from "@/components/ui/pressable-zone";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Lottie from "lottie-react";
import genel1 from "@/assets/genel1lik.png";
import genel2 from "@/assets/genel2lik.png";
import genel3 from "@/assets/genel3luk.png";
import aylik1 from "@/assets/aylik1lik.png";
import aylik2 from "@/assets/aylik2lik.png";
import aylik3 from "@/assets/aylik3luk.png";
import haftalik1 from "@/assets/haftalik1lik.png";
import haftalik2 from "@/assets/haftalik2lik.png";
import haftalik3 from "@/assets/haftalik3luk.png";

interface PrizeNotification {
  id: string;
  message: string;
}

type PeriodType = "weekly" | "monthly" | "season";

const CARDS: Record<PeriodType, string[]> = {
  season: [genel1, genel2, genel3],
  monthly: [aylik1, aylik2, aylik3],
  weekly: [haftalik1, haftalik2, haftalik3],
};

const getPeriod = (message: string): PeriodType => {
  if (message.includes("Haftal")) return "weekly";
  if (message.includes("Ayl")) return "monthly";
  return "season";
};

const getRank = (message: string): 1 | 2 | 3 => {
  const m = message.match(/tablosunda\s*(\d)\./);
  const r = m ? parseInt(m[1], 10) : 1;
  return (r >= 1 && r <= 3 ? r : 1) as 1 | 2 | 3;
};

const LeaderboardPrizeDialog = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [queue, setQueue] = useState<PrizeNotification[]>([]);
  const [index, setIndex] = useState(0);
  const [confettiAnim, setConfettiAnim] = useState<any>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [claiming, setClaiming] = useState(false);
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
        .ilike("message", "%liderlik tablosunda%")
        .order("created_at", { ascending: false })
        .limit(3);

      if (!error && data && data.length > 0) {
        setQueue(data);
        setIndex(0);
        setOpen(true);
        try {
          const anim = await fetch("/kazanmajson.json").then((r) => r.json());
          setConfettiAnim(anim);
        } catch (e) {
          console.warn("Konfeti yuklenemedi:", e);
        }
      }
    };

    const timeout = setTimeout(checkPrizeNotifications, 3000);
    return () => clearTimeout(timeout);
  }, [user]);

  const stopMusic = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  };

  const current = queue[index];

  const handleClaim = async () => {
    if (!current || claiming) return;
    setClaiming(true);

    // Konfeti patlat
    setShowConfetti(true);
    try {
      const { isSoundEffectsEnabled } = await import("@/utils/soundSettings");
      if (isSoundEffectsEnabled()) {
        const audio = new Audio("/odulMuzik.mp3");
        audio.volume = 0.7;
        audioRef.current = audio;
        await audio.play();
      }
    } catch (e) {
      console.warn("Muzik calinamadi:", e);
    }

    // Ödüller dönem bitiminde hesaba işlendi; bildirimi okundu olarak kapat
    await supabase.from("notifications").update({ is_read: true }).eq("id", current.id);

    setTimeout(() => {
      setShowConfetti(false);
      setClaiming(false);
      if (index < queue.length - 1) {
        setIndex((p) => p + 1);
      } else {
        setOpen(false);
        stopMusic();
      }
    }, 2600);
  };

  if (!current) return null;

  const period = getPeriod(current.message);
  const rank = getRank(current.message);
  const src = CARDS[period][rank - 1];

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val && !claiming) { setOpen(false); stopMusic(); } }}>
      <DialogContent className="bg-transparent border-0 shadow-none max-w-[calc(100%-2.5rem)] mx-auto p-0 overflow-visible">
        <div className="relative">
          <img src={src} alt="Ödül kartı" className="w-full h-auto rounded-2xl" draggable={false} />

          {/* Görselin üzerindeki "Ödülleri Al" butonuna görünmez hit-zone */}
          <PressableZone
            label="Ödülleri Al"
            haptic="medium"
            className="rounded-full"
            style={{ top: "78.5%", left: "23%", width: "54%", height: "5.5%" }}
            onPress={handleClaim}
            disabled={claiming}
          />

          {showConfetti && confettiAnim && (
            <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
              <Lottie animationData={confettiAnim} loop={false} autoplay style={{ width: "100%", height: "100%" }} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeaderboardPrizeDialog;
