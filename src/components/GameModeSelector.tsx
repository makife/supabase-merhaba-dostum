import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, X, Play } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";
import { useUser } from "@/contexts/UserContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GameModeSelectorProps {
  mode: string;
  onStart: (gameType: "timed" | "score") => void;
  onClose: () => void;
}

const GameModeSelector = ({ mode, onStart, onClose }: GameModeSelectorProps) => {
  const [selectedType, setSelectedType] = useState<"timed" | "score">("timed");
  const { playSound } = useSounds();
  const { profile, isPremium } = useUser();
  const { user } = useAuth();
  const { toast } = useToast();

  const getTheme = () => {
    switch (mode) {
      case "vs-computer":
        return {
          title: "Yapay Zekaya Karşı",
          gradient: "from-blue-600 via-cyan-500 to-blue-600",
          bgGlow: "bg-blue-500/10",
          border: "border-blue-500/50",
          iconSrc: "/icons/aimod.svg",
          shadow: "shadow-blue-500/20",
        };
      case "private-room":
        return {
          title: "Özel Oda Kur",
          gradient: "from-green-600 via-emerald-500 to-green-600",
          bgGlow: "bg-green-500/10",
          border: "border-green-500/50",
          iconSrc: "/icons/ozeloda.svg",
          shadow: "shadow-green-500/20",
        };
      case "random-match":
        return {
          title: "Rastgele Rakip",
          gradient: "from-purple-600 via-pink-500 to-purple-600",
          bgGlow: "bg-purple-500/10",
          border: "border-purple-500/50",
          iconSrc: "/icons/rastgele.svg",
          shadow: "shadow-purple-500/20",
        };
      default:
        return {
          title: "Oyun Modu",
          gradient: "from-yellow-600 via-orange-500 to-yellow-600",
          bgGlow: "bg-yellow-500/10",
          border: "border-yellow-500/50",
          iconSrc: "/icons/turnuva.svg",
          shadow: "shadow-yellow-500/20",
        };
    }
  };

  const theme = getTheme();

  const handleStart = async () => {
    playSound("buttonClick");
    let hasCredit = Boolean(
      isPremium ||
      (profile?.game_credits || 0) + (profile?.bonus_credits || 0) > 0 ||
      (profile?.unlimited_lives_until && new Date(profile.unlimited_lives_until) > new Date())
    );

    if (!hasCredit && user?.id) {
      const { data } = await supabase
        .from("profiles")
        .select("game_credits, bonus_credits, premium_until, unlimited_lives_until")
        .eq("id", user.id)
        .maybeSingle();
      const now = new Date();
      hasCredit = Boolean(
        ((data?.game_credits || 0) + (data?.bonus_credits || 0) > 0) ||
        (data?.premium_until && new Date(data.premium_until) > now) ||
        (data?.unlimited_lives_until && new Date(data.unlimited_lives_until) > now)
      );
    }

    if (!hasCredit) {
      toast({
        title: "Oyun için yeterli sayfan yok!",
        description: "Oyun oynamak için sayfa satın al veya dolmasını bekle.",
        variant: "navy" as any,
      });
      return;
    }
    onStart(selectedType);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 z-[9999] animate-in fade-in duration-300">
      {/* GENİŞLİK: max-w-sm (384px) yapılarak daha dikey ve orantılı bir görünüm sağlandı */}
      <div
        className={`relative w-full max-w-sm bg-zinc-950/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col ${theme.shadow}`}
      >
        {/* Dekoratif Işık */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-gradient-to-b ${theme.gradient} opacity-20 blur-3xl pointer-events-none`}
        />

        {/* HEADER */}
        <div className="relative pt-10 pb-6 px-6 text-center z-10">
          <button
            onClick={() => {
              playSound("buttonClick");
              onClose();
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <img src={theme.iconSrc} alt="" className="w-16 h-16 object-contain mx-auto mb-4 drop-shadow-lg" />

          <h2 className="text-xl font-black uppercase tracking-tighter text-white">{theme.title}</h2>
        </div>

        {/* CONTENT - MOD SEÇİMİ */}
        <div className="px-8 pb-8 space-y-4 z-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-center">
            {/* Kart Boyutu Küçültüldü ve Genişlik Butonla Hizalandı */}
            <button
              onClick={() => {
                playSound("buttonClick");
                setSelectedType("timed");
              }}
              className={`relative group flex flex-col items-center p-6 rounded-2xl border-2 transition-all duration-300 w-full
                        ${
                          selectedType === "timed"
                            ? `${theme.border} ${theme.bgGlow} scale-[1.02]`
                            : "border-white/5 bg-white/5 hover:bg-white/10"
                        }
                    `}
            >
              <div
                className={`p-3 rounded-xl mb-4 ${selectedType === "timed" ? `bg-gradient-to-r ${theme.gradient}` : "bg-zinc-800"}`}
              >
                <Clock className={`w-6 h-6 ${selectedType === "timed" ? "text-white" : "text-zinc-500"}`} />
              </div>

              <div className="text-center">
                <span
                  className={`block font-bold text-base ${selectedType === "timed" ? "text-white" : "text-zinc-400"}`}
                >
                  Zamana Karşı
                </span>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  2 Dakika içinde maksimum
                  <br />
                  kelimeyi bulmaya çalış!
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* FOOTER - BAŞLAT BUTONU */}
        <div className="px-8 pb-8 z-10">
          <Button
            onClick={handleStart}
            className={`w-full py-7 text-base font-black uppercase tracking-widest text-white rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
                    bg-gradient-to-r ${theme.gradient} shadow-[0_10px_20px_-10px_rgba(0,0,0,0.5)]
                `}
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            BAŞLAT
          </Button>

          <button
            onClick={() => {
              playSound("buttonClick");
              onClose();
            }}
            className="w-full mt-6 py-3 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors tracking-widest uppercase border border-red-500/50 rounded-xl bg-red-500/5 hover:bg-red-500/10"
          >
            İPTAL ET
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameModeSelector;
