import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Target, Trophy, Bot, Users, Zap, X, Shield, Play } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";

interface GameModeSelectorProps {
  mode: string;
  onStart: (gameType: "timed" | "score") => void;
  onClose: () => void;
}

const GameModeSelector = ({ mode, onStart, onClose }: GameModeSelectorProps) => {
  const [selectedType, setSelectedType] = useState<"timed" | "score">("timed");
  const { playSound } = useSounds();
  const { profile, isPremium } = useUser();

  // Modlara göre renk ve tema ayarları
  const getTheme = () => {
    switch (mode) {
      case "vs-computer":
        return {
          title: "Yapay Zekaya Karşı",
          gradient: "from-blue-600 via-cyan-500 to-blue-600",
          bgGlow: "bg-blue-500/10",
          border: "border-blue-500/50",
          text: "text-blue-400",
          icon: Bot,
          ring: "ring-blue-500",
          shadow: "shadow-blue-500/20",
        };
      case "private-room":
        return {
          title: "Özel Oda Kur",
          gradient: "from-green-600 via-emerald-500 to-green-600",
          bgGlow: "bg-green-500/10",
          border: "border-green-500/50",
          text: "text-green-400",
          icon: Users,
          ring: "ring-green-500",
          shadow: "shadow-green-500/20",
        };
      case "random-match":
        return {
          title: "Rastgele Rakip",
          gradient: "from-purple-600 via-pink-500 to-purple-600",
          bgGlow: "bg-purple-500/10",
          border: "border-purple-500/50",
          text: "text-purple-400",
          icon: Zap,
          ring: "ring-purple-500",
          shadow: "shadow-purple-500/20",
        };
      default: // Turnuva veya varsayılan
        return {
          title: "Oyun Modu",
          gradient: "from-yellow-600 via-orange-500 to-yellow-600",
          bgGlow: "bg-yellow-500/10",
          border: "border-yellow-500/50",
          text: "text-yellow-400",
          icon: Trophy,
          ring: "ring-yellow-500",
          shadow: "shadow-yellow-500/20",
        };
    }
  };

  const theme = getTheme();

  const handleStart = () => {
    playSound("buttonClick");

    // Kredi kontrolü
    if (!isPremium && (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0) {
      toast.error("Yetersiz oyun hakkı!", {
        description: "Oyun oynamak için hak satın alın veya dolmasını bekleyin.",
        duration: 4000,
      });
      return;
    }

    onStart(selectedType);
  };

  return (
    // Ana Overlay
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300">
      {/* Kartın Kendisi */}
      <div
        className={`relative w-full max-w-lg bg-zinc-950/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${theme.shadow}`}
      >
        {/* Dekoratif Arka Plan Işığı */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-48 bg-gradient-to-b ${theme.gradient} opacity-20 blur-3xl pointer-events-none`}
        />

        {/* --- HEADER --- */}
        <div className="relative pt-8 pb-4 px-6 text-center z-10">
          <button
            onClick={() => {
              playSound("buttonClick");
              onClose();
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className={`w-20 h-20 mx-auto bg-gradient-to-br ${theme.gradient} rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 mb-4 border border-white/20`}
          >
            <theme.icon className="w-10 h-10 text-white drop-shadow-md" />
          </div>

          <h2 className="text-2xl font-black uppercase tracking-wider text-white drop-shadow-lg">{theme.title}</h2>
        </div>

        {/* --- CONTENT (SEÇİM ALANI) --- */}
        {/* ANIMASYON BURAYA EKLENDİ: animate-in slide-in-from-left-8 */}
        <div className="p-6 space-y-4 overflow-y-auto z-10 animate-in slide-in-from-left-8 fade-in duration-500">
          <div className="grid grid-cols-2 gap-4">
            {/* Seçenek 1: Zamana Karşı */}
            <button
              onClick={() => {
                playSound("buttonClick");
                setSelectedType("timed");
              }}
              className={`relative group flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300 h-44 justify-between
                        ${
                          selectedType === "timed"
                            ? `${theme.border} ${theme.bgGlow} shadow-[0_0_20px_rgba(0,0,0,0.3)] scale-[1.02]`
                            : "border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20"
                        }
                    `}
            >
              <div
                className={`p-3 rounded-full ${selectedType === "timed" ? `bg-gradient-to-r ${theme.gradient}` : "bg-zinc-800"}`}
              >
                <Clock className={`w-6 h-6 ${selectedType === "timed" ? "text-white" : "text-zinc-500"}`} />
              </div>

              <div className="text-center">
                <span
                  className={`block font-bold text-lg ${selectedType === "timed" ? "text-white" : "text-zinc-400"}`}
                >
                  Zamana Karşı
                </span>
                <span className="text-xs text-zinc-500 mt-1 block px-2">2 Dakika içinde maksimum kelime bul</span>
              </div>

              {selectedType === "timed" && (
                <div
                  className={`absolute inset-0 border-2 ${theme.border} rounded-xl blur-[2px] pointer-events-none`}
                />
              )}
            </button>
          </div>
        </div>

        {/* --- FOOTER (BAŞLAT BUTONU) --- */}
        {/* Buraya da slide-in-from-bottom ekleyerek alttan gelmesini sağladık */}
        <div className="p-6 pt-0 z-10 mt-auto animate-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
          <div className="mb-4 flex items-center justify-center gap-2 text-xs text-zinc-500"></div>

          <Button
            onClick={handleStart}
            className={`w-full py-6 text-lg font-bold uppercase tracking-wider text-white shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]
                    bg-gradient-to-r ${theme.gradient} hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]
                `}
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            OYUNU BAŞLAT
          </Button>

          <button onClick={onClose} className="w-full mt-3 text-sm text-zinc-500 hover:text-white transition-colors">
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameModeSelector;
