import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PressableZone } from "@/components/ui/pressable-zone";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSounds } from "@/hooks/useSounds";
import genel1 from "@/assets/genel1lik.png";
import genel2 from "@/assets/genel2lik.png";
import genel3 from "@/assets/genel3luk.png";
import aylik1 from "@/assets/aylik1lik.png";
import aylik2 from "@/assets/aylik2lik.png";
import aylik3 from "@/assets/aylik3luk.png";
import haftalik1 from "@/assets/haftalik1lik.png";
import haftalik2 from "@/assets/haftalik2lik.png";
import haftalik3 from "@/assets/haftalik3luk.png";

export type PodiumTab = "season" | "monthly" | "weekly";

const CARDS: Record<PodiumTab, string[]> = {
  season: [genel1, genel2, genel3],
  monthly: [aylik1, aylik2, aylik3],
  weekly: [haftalik1, haftalik2, haftalik3],
};

const PERIOD_LABEL: Record<PodiumTab, string> = {
  season: "Sezon",
  monthly: "Aylık",
  weekly: "Haftalık",
};

interface Props {
  tab: PodiumTab;
  rank: 1 | 2 | 3;
  /** Podyumdaki oyuncu (ödülü sadece kendi kartında talep edebilir) */
  userId: string;
  width?: number;
}

/**
 * Podyumdaki 1./2./3. oyuncunun ödül kartı.
 * Küçük görsel olarak gösterilir, tıklanınca büyük kart + "Ödülleri Al" açılır.
 */
const PodiumPrizeCard = ({ tab, rank, userId, width = 76 }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { playSound } = useSounds();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ id: string; message: string } | null>(null);
  const [claiming, setClaiming] = useState(false);

  const isMe = !!user && user.id === userId;
  const src = CARDS[tab][rank - 1];

  // Kendi kartıysa bekleyen ödül bildirimi var mı?
  useEffect(() => {
    if (!isMe) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, message")
        .eq("user_id", userId)
        .eq("type", "leaderboard_prize")
        .eq("is_read", false)
        .ilike("message", `%${PERIOD_LABEL[tab]} liderlik%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setPending(data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [isMe, userId, tab, open]);

  const handleClaim = async () => {
    if (!isMe) {
      toast({ title: "Bu ödül sana ait değil", description: "Sadece kendi ödülünü alabilirsin." });
      return;
    }
    if (!pending) {
      toast({
        title: "Bekleyen ödül yok",
        description: `${PERIOD_LABEL[tab]} ödüller dönem bitiminde otomatik hesabına eklenir.`,
      });
      return;
    }
    setClaiming(true);
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", pending.id);
    setClaiming(false);
    if (error) {
      toast({ title: "Ödül alınamadı", description: "Lütfen tekrar dene.", variant: "destructive" });
      return;
    }
    playSound("buttonClick");
    toast({ title: "🎁 Ödüller hesabına eklendi!", description: pending.message });
    setPending(null);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          playSound("buttonClick");
          setOpen(true);
        }}
        className="relative mt-1 active:scale-95 transition-transform"
        style={{ width }}
        aria-label={`${PERIOD_LABEL[tab]} ${rank}. ödül kartı`}
      >
        <img src={src} alt={`${PERIOD_LABEL[tab]} ${rank}. ödül kartı`} className="w-full h-auto rounded-lg" draggable={false} />
        {isMe && pending && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#1e2d45] border border-indigo-500/20 text-white max-w-[calc(100%-2.5rem)] rounded-2xl p-3">
          <div className="relative">
            <img src={src} alt={`${PERIOD_LABEL[tab]} ${rank}. ödül kartı`} className="w-full h-auto rounded-xl" draggable={false} />
            {/* Görselin üzerindeki "Ödülleri Al" butonuna görünmez hit-zone */}
            <PressableZone
              label="Ödülleri Al"
              haptic="medium"
              className="rounded-full"
              style={{ top: "78.5%", left: "23%", width: "54%", height: "5.5%" }}
              onClick={handleClaim}
              disabled={claiming}
            />
          </div>
          <p className="text-[11px] text-slate-400 text-center">
            {isMe
              ? pending
                ? "Ödülün hazır — kartın üzerindeki “Ödülleri Al” butonuna bas."
                : "Ödüller dönem bitiminde otomatik hesabına eklenir."
              : "Bu ödül bu oyuncuya ait."}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PodiumPrizeCard;
