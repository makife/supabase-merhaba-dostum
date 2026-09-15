import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Sparkles, Gift } from "lucide-react";
import Lottie from "lottie-react";
import { useEffect, useState } from "react";

interface WelcomeIntroDialogProps {
  open: boolean;
  onClose: () => void;
}

export const WelcomeIntroDialog = ({ open, onClose }: WelcomeIntroDialogProps) => {
  const [ziplaAnim, setZiplaAnim] = useState<any>(null);

  useEffect(() => {
    fetch("/ziplaKarakter.json")
      .then((r) => r.json())
      .then(setZiplaAnim)
      .catch(() => {});
  }, []);

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
          className="relative z-10 px-6 pt-5 pb-5 text-center"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center justify-center mb-2">
            <div className="w-32 h-32 -mb-2">
              {ziplaAnim && (
                <Lottie animationData={ziplaAnim} loop autoplay style={{ width: "100%", height: "100%" }} />
              )}
            </div>
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Kelimele'ye Hoş Geldin</h2>
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
                Sana özel <span className="font-bold text-yellow-300">5'er adet joker</span> hediye ettik:
              </p>
              <div className="space-y-2">
                {[
                  { icon: "/icons/degistir.svg", label: "5x Değiştir Jokeri", desc: "Harfleri yenile" },
                  { icon: "/icons/fisilda.svg", label: "5x Fısılda Jokeri", desc: "Kelime önerisi al" },
                  { icon: "/icons/senyaz.svg", label: "5x Sen Yaz Jokeri", desc: "AI sana kelime yazsın" },
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
                <img src="/icons/oyun.svg" alt="" className="w-4 h-4" /> Oyun Modları
              </h3>
              <div className="space-y-2">
                {[
                  {
                    icon: "/icons/aimod.svg",
                    color: "#60a5fa",
                    bg: "rgba(96,165,250,0.1)",
                    label: "Yapay Zekaya Karşı",
                    desc: "AI rakibine karşı antrenman yap!",
                  },
                  {
                    icon: "/icons/rastgele.svg",
                    color: "#c084fc",
                    bg: "rgba(192,132,252,0.1)",
                    label: "Rastgele Eşleşme",
                    desc: "Gerçek oyuncularla eşleş ve rekabet et!",
                  },
                  {
                    icon: "/icons/ozeloda.svg",
                    color: "#4ade80",
                    bg: "rgba(74,222,128,0.1)",
                    label: "Özel Oda",
                    desc: "Arkadaşlarınla özel oda oluştur!",
                  },
                  {
                    icon: "/icons/turnuva.svg",
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
                    <img src={item.icon} alt="" className="w-5 h-5 mt-0.5 flex-shrink-0" />
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

            {/* Düello & Görev */}
            <div
              className="p-4 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <h3 className="font-bold text-white/80 flex items-center gap-2 mb-3">
                <img src="/gorevIkon.svg" alt="" className="w-4 h-4" /> Düello & Challenge
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: "/icons/kelimepuzzle.svg", color: "#fbbf24", label: "Kelime Puzzle" },
                  { icon: "/icons/reaktor.svg", color: "#fb923c", label: "Harf Koşusu" },
                  { icon: "/icons/refleks.svg", color: "#22d3ee", label: "Refleks" },
                  { icon: "/icons/kelimehafiza.svg", color: "#f472b6", label: "Kelime Hafıza" },
                  { icon: "/brainIkon.svg", color: "#a78bfa", label: "Karma" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <img src={item.icon} alt="" className="w-5 h-5 flex-shrink-0" />
                    <span className="text-white/70">{item.label}</span>
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
