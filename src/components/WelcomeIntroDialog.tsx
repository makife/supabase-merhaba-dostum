import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Users,
  Trophy,
  Zap,
  MessageSquare,
  Gamepad2,
  Sparkles,
  Gift,
  Target,
  Brain,
  Puzzle,
  Dices,
} from "lucide-react";

interface WelcomeIntroDialogProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeIntroDialog = ({ open, onClose }: WelcomeIntroDialogProps) => {
  const handleComplete = () => {
    localStorage.setItem("kelimeci-intro-completed", "true");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleComplete();
      }}
    >
      <DialogContent
        className="max-w-sm w-[calc(100%-2rem)] rounded-3xl border-0 p-0 shadow-2xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #0f1729 0%, #1a1a2e 50%, #16213e 100%)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.07)",
        }}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Glow efektleri */}
        <div
          className="absolute -top-20 -right-20 w-52 h-52 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(234,179,8,0.08) 0%, transparent 70%)" }}
        />

        {/* Header */}
        <div
          className="relative z-10 px-6 pt-7 pb-5 text-center"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-center mb-3">
            <div className="relative">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.25)" }}
              >
                <Sparkles className="w-7 h-7 text-yellow-400 animate-pulse" />
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.4)" }}
              >
                <Gift className="w-3.5 h-3.5 text-indigo-300" />
              </div>
            </div>
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Kelimele'ye Hoş Geldin! 🎉</h2>
          <p className="text-sm text-white/45">Seni aramızda görmekten mutluluk duyuyoruz</p>
        </div>

        {/* İçerik */}
        <ScrollArea className="relative z-10 h-[52vh] px-6 py-5">
          <div className="space-y-3 text-sm pr-1">
            {/* Hoşgeldin Hediyesi */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)" }}
            >
              <h3 className="font-bold text-yellow-400 flex items-center gap-2 mb-3">
                <Gift className="w-4 h-4" /> Hoş Geldin Hediyesi!
              </h3>
              <p className="text-white/55 text-xs mb-3">
                Sana özel <span className="font-bold text-yellow-300">3'er adet joker</span> hediye ettik:
              </p>
              <div className="space-y-2">
                {[
                  { icon: "/degistirIkon.png", label: "3x Değiştir Jokeri", desc: "Harfleri yenile" },
                  { icon: "/fisildaIkon.png", label: "3x Fısılda Jokeri", desc: "Kelime önerisi al" },
                  { icon: "/senyazIkon.png", label: "3x Sen Yaz Jokeri", desc: "AI sana kelime yazsın" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 p-2 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <img src={item.icon} alt={item.label} className="w-7 h-7 object-contain" />
                    <div>
                      <p className="text-white/85 font-semibold text-xs">{item.label}</p>
                      <p className="text-white/40 text-[11px]">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Oyun Modları */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <h3 className="font-bold text-white/80 flex items-center gap-2 mb-3">
                <Gamepad2 className="w-4 h-4 text-indigo-400" /> Oyun Modları
              </h3>
              <div className="space-y-2">
                {[
                  {
                    icon: Bot,
                    color: "#60a5fa",
                    bg: "rgba(96,165,250,0.1)",
                    label: "Yapay Zekaya Karşı",
                    desc: "AI rakibine karşı antrenman yap!",
                  },
                  {
                    icon: Zap,
                    color: "#c084fc",
                    bg: "rgba(192,132,252,0.1)",
                    label: "Rastgele Eşleşme",
                    desc: "Gerçek oyuncularla eşleş ve rekabet et!",
                  },
                  {
                    icon: Users,
                    color: "#4ade80",
                    bg: "rgba(74,222,128,0.1)",
                    label: "Özel Oda",
                    desc: "Arkadaşlarınla özel oda oluştur!",
                  },
                  {
                    icon: Trophy,
                    color: "#fbbf24",
                    bg: "rgba(251,191,36,0.1)",
                    label: "Turnuva",
                    desc: "8 kişilik turnuvalara katıl, ödüller kazan!",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-start gap-3 p-3 rounded-xl"
                    style={{ background: item.bg }}
                  >
                    <item.icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: item.color }} />
                    <div>
                      <p className="font-semibold text-xs" style={{ color: item.color }}>
                        {item.label}
                      </p>
                      <p className="text-white/45 text-[11px] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sohbet */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <h3 className="font-bold text-white/80 flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-sky-400" /> Sohbet
              </h3>
              <p className="text-white/45 text-xs leading-relaxed">
                Diğer oyuncularla sohbet et, arkadaşlık kur! Genel sohbet veya özel mesaj gönder.
              </p>
            </div>

            {/* Mini Oyunlar */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <h3 className="font-bold text-white/80 flex items-center gap-2 mb-3">
                <Dices className="w-4 h-4 text-orange-400" /> Mini Oyunlar
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Brain, color: "#f472b6", label: "Hafıza Oyunu" },
                  { icon: Puzzle, color: "#fb923c", label: "Puzzle" },
                  { icon: Target, color: "#22d3ee", label: "Yılan Oyunu" },
                  { icon: Sparkles, color: "#818cf8", label: "Ve daha fazlası..." },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: item.color }} />
                    <span className="text-white/60">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Günlük Çark */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}
            >
              <h3 className="font-bold text-purple-300 mb-2">🎡 Günlük Çark</h3>
              <p className="text-white/45 text-xs leading-relaxed">
                Her gün çarkı çevir ve sürpriz ödüller kazan! Jokerler, mürekkep ve daha fazlası seni bekliyor.
              </p>
            </div>

            {/* İpucu */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}
            >
              <h3 className="font-bold text-indigo-300 mb-2">💡 İpucu</h3>
              <p className="text-white/45 text-xs leading-relaxed">
                İlk olarak <span className="text-indigo-300 font-semibold">"Yapay Zekaya Karşı"</span> modunda antrenman
                yapmanı öneriyoruz. Böylece oyunu öğrenip rakiplerine karşı hazır olabilirsin!
              </p>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="relative z-10 px-6 pb-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={handleComplete}
            className="w-full py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
            }}
          >
            <Sparkles className="w-4 h-4" />
            Hadi Başlayalım!
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
