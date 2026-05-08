import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Gift, PartyPopper, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Lottie from "lottie-react";

interface PrizeNotification {
  id: string;
  message: string;
}

type ChallengeType = "puzzle" | "reaktor" | "neon_blitz" | "memory" | "default";

const CHALLENGE_THEMES: Record<ChallengeType, {
  bg: string;
  bgGradient: string;
  accentColor: string;
  borderColor: string;
  glowColor: string;
  iconFile: string;
  badgeBg: string;
  shimmer: string;
  label: string;
  tagline: string;
}> = {
  puzzle: {
    bg: "#0d0817",
    bgGradient: "linear-gradient(160deg, #1a0f2e 0%, #0d0817 50%, #150c2a 100%)",
    accentColor: "#c084fc",
    borderColor: "rgba(192,132,252,0.25)",
    glowColor: "rgba(168,85,247,0.35)",
    iconFile: "/puzzleIkon.svg",
    badgeBg: "rgba(168,85,247,0.15)",
    shimmer: "from-purple-500/0 via-purple-400/20 to-purple-500/0",
    label: "Kelime Puzzle",
    tagline: "Zihni çözdün, ödül senindir",
  },
  reaktor: {
    bg: "#071a0d",
    bgGradient: "linear-gradient(160deg, #0f2e1a 0%, #071a0d 50%, #0c2415 100%)",
    accentColor: "#86efac",
    borderColor: "rgba(134,239,172,0.25)",
    glowColor: "rgba(74,222,128,0.35)",
    iconFile: "/reactorIkon.svg",
    badgeBg: "rgba(74,222,128,0.15)",
    shimmer: "from-green-500/0 via-green-400/20 to-green-500/0",
    label: "Reaktör Koşusu",
    tagline: "Reaktörü fethettin, kazan!",
  },
  neon_blitz: {
    bg: "#070d1a",
    bgGradient: "linear-gradient(160deg, #0a1628 0%, #070d1a 50%, #091522 100%)",
    accentColor: "#67e8f9",
    borderColor: "rgba(103,232,249,0.25)",
    glowColor: "rgba(34,211,238,0.35)",
    iconFile: "/neonIkon.svg",
    badgeBg: "rgba(34,211,238,0.15)",
    shimmer: "from-cyan-500/0 via-cyan-400/20 to-cyan-500/0",
    label: "Neon Refleks",
    tagline: "Reflekslerin zirveye ulaştı",
  },
  memory: {
    bg: "#1a0f07",
    bgGradient: "linear-gradient(160deg, #2e1a0a 0%, #1a0f07 50%, #241508 100%)",
    accentColor: "#fcd34d",
    borderColor: "rgba(252,211,77,0.25)",
    glowColor: "rgba(251,191,36,0.35)",
    iconFile: "/brainIkon.svg",
    badgeBg: "rgba(251,191,36,0.15)",
    shimmer: "from-amber-500/0 via-amber-400/20 to-amber-500/0",
    label: "Kelime Hafıza",
    tagline: "Belleğin seni ödüllendiriyor",
  },
  default: {
    bg: "#0a0a1a",
    bgGradient: "linear-gradient(160deg, #111128 0%, #0a0a1a 50%, #0f0f22 100%)",
    accentColor: "#818cf8",
    borderColor: "rgba(129,140,248,0.25)",
    glowColor: "rgba(99,102,241,0.35)",
    iconFile: "/gorevIkon.svg",
    badgeBg: "rgba(99,102,241,0.15)",
    shimmer: "from-indigo-500/0 via-indigo-400/20 to-indigo-500/0",
    label: "Günlük Görev",
    tagline: "Görevi tamamladın!",
  },
};

const ChallengePrizeDialog = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<PrizeNotification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [konfettiAnim, setKonfettiAnim] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/gunlukKonfeti.json")
      .then((r) => r.json())
      .then(setKonfettiAnim)
      .catch(console.error);
  }, []);

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
    const timeout = setTimeout(checkChallengePrizes, 5000);
    return () => clearTimeout(timeout);
  }, [user]);

  const handleClose = async () => {
    const current = notifications[currentIndex];
    if (current) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", current.id);
    }
    if (currentIndex < notifications.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
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
    if (inkMatch) prizes.push({ label: "Mürekkep", amount: inkMatch[1], icon: "/damlaMurekkep.png" });
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
  const isLast = currentIndex === notifications.length - 1;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent
        className="text-white max-w-[calc(100%-2rem)] sm:max-w-sm mx-auto p-0 overflow-hidden border-0 rounded-3xl"
        style={{
          background: theme.bgGradient,
          boxShadow: `0 0 80px ${theme.glowColor}, 0 30px 60px rgba(0,0,0,0.8), inset 0 1px 0 ${theme.borderColor}`,
        }}
      >
        {/* Konfeti katmanı */}
        {konfettiAnim && (
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-3xl">
            <Lottie animationData={konfettiAnim} loop={false} style={{ width: "100%", height: "100%" }} />
          </div>
        )}

        {/* Üst radyal parıltı */}
        <div
          className="absolute inset-0 pointer-events-none rounded-3xl"
          style={{ background: `radial-gradient(ellipse 90% 55% at 50% -5%, ${theme.glowColor}, transparent)` }}
        />
        {/* İnce border */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{ border: `1px solid ${theme.borderColor}` }}
        />
        {/* Tepe parlama çizgisi */}
        <div
          className="absolute top-0 left-[15%] right-[15%] h-px pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${theme.accentColor}90, transparent)` }}
        />

        <div className="relative z-10 flex flex-col items-center text-center px-6 pt-8 pb-6">

          {/* Ana ikon */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`icon-${currentIndex}`}
              initial={{ scale: 0, y: -24, rotate: -20 }}
              animate={{ scale: 1, y: 0, rotate: 0 }}
              exit={{ scale: 0, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
              className="relative mb-5"
            >
              {/* Nabız halkası */}
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute rounded-full pointer-events-none"
                style={{
                  inset: "-28px",
                  background: `radial-gradient(circle, ${theme.glowColor} 0%, transparent 70%)`,
                }}
              />
              {/* İkon kutusu */}
              <div
                className="relative w-24 h-24 rounded-2xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(145deg, ${theme.badgeBg}, rgba(0,0,0,0.4))`,
                  border: `1.5px solid ${theme.borderColor}`,
                  boxShadow: `0 10px 40px ${theme.glowColor}, inset 0 1px 0 ${theme.accentColor}25`,
                }}
              >
                <img
                  src={theme.iconFile}
                  alt={theme.label}
                  className="w-14 h-14 object-contain"
                  style={{ filter: `drop-shadow(0 0 14px ${theme.accentColor}99)` }}
                />
                {/* Dönen sparkle köşede */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-2 -right-2"
                >
                  <Sparkles className="w-4 h-4" style={{ color: theme.accentColor }} />
                </motion.div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Başlık */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`title-${currentIndex}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ delay: 0.25, duration: 0.35 }}
              className="mb-5 w-full"
            >
              {/* Oyun etiketi */}
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3"
                style={{
                  background: theme.badgeBg,
                  color: theme.accentColor,
                  border: `1px solid ${theme.borderColor}`,
                }}
              >
                <span>✦</span>
                {theme.label}
                <span>✦</span>
              </div>

              <h2
                className="text-[1.6rem] font-black mb-1.5 leading-tight"
                style={{
                  background: `linear-gradient(135deg, #ffffff 20%, ${theme.accentColor})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  fontFamily: "'Trebuchet MS', 'Gill Sans', sans-serif",
                  letterSpacing: "-0.02em",
                }}
              >
                Tebrikler! 🎉
              </h2>
              <p
                className="text-sm font-medium"
                style={{ color: `${theme.accentColor}bb` }}
              >
                {theme.tagline}
              </p>

              {/* Sayfa göstergeleri */}
              {hasMultiple && (
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  {notifications.map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{ width: i === currentIndex ? 18 : 6 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-full h-1.5"
                      style={{ background: i === currentIndex ? theme.accentColor : `${theme.accentColor}35` }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Ödül kartı */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`prizes-${currentIndex}`}
              initial={{ opacity: 0, y: 22, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="w-full mb-5 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${theme.borderColor}`,
                boxShadow: `inset 0 1px 0 ${theme.accentColor}12`,
              }}
            >
              {/* Kart başlığı */}
              <div
                className="flex items-center justify-center gap-2 px-4 py-2.5"
                style={{
                  background: `linear-gradient(90deg, transparent, ${theme.badgeBg}, transparent)`,
                  borderBottom: `1px solid ${theme.borderColor}`,
                }}
              >
                <Gift className="w-3.5 h-3.5" style={{ color: theme.accentColor }} />
                <span
                  className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: theme.accentColor }}
                >
                  Kazandığın Ödüller
                </span>
              </div>

              <div className="p-4">
                {prizes.length > 0 ? (
                  <div
                    className={`grid gap-2.5 ${
                      prizes.length === 1 ? "grid-cols-1" :
                      prizes.length <= 4 ? "grid-cols-2" : "grid-cols-3"
                    }`}
                  >
                    {prizes.map((prize, i) => (
                      <motion.div
                        key={prize.label}
                        initial={{ opacity: 0, scale: 0.65, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.55 + i * 0.09, type: "spring", stiffness: 220 }}
                        className="flex flex-col items-center gap-2 rounded-xl py-3.5 px-2"
                        style={{
                          background: `linear-gradient(145deg, ${theme.badgeBg}, rgba(0,0,0,0.25))`,
                          border: `1px solid ${theme.borderColor}`,
                        }}
                      >
                        {prize.icon ? (
                          <img
                            src={prize.icon}
                            alt={prize.label}
                            className="w-10 h-10 object-contain"
                            style={{ filter: `drop-shadow(0 0 8px ${theme.accentColor}70)` }}
                          />
                        ) : (
                          <Gift className="w-9 h-9" style={{ color: theme.accentColor }} />
                        )}
                        <span
                          className="text-2xl font-black leading-none"
                          style={{
                            background: `linear-gradient(135deg, #fff, ${theme.accentColor})`,
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                          }}
                        >
                          +{prize.amount}
                        </span>
                        <span
                          className="text-[10px] font-semibold tracking-wide"
                          style={{ color: `${theme.accentColor}99` }}
                        >
                          {prize.label}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm py-3" style={{ color: `${theme.accentColor}cc` }}>
                    {current.message.replace(/^🎯\s*/, "").replace(/^🧠\s*/, "")}
                  </p>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Buton */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="w-full"
          >
            <button
              onClick={handleClose}
              className="w-full relative overflow-hidden rounded-2xl py-3.5 font-black text-sm tracking-wide transition-all active:scale-[0.97]"
              style={{
                background: `linear-gradient(135deg, ${theme.accentColor}25, ${theme.accentColor}45)`,
                border: `1.5px solid ${theme.accentColor}55`,
                color: theme.accentColor,
                boxShadow: `0 0 24px ${theme.glowColor}`,
                letterSpacing: "0.04em",
              }}
            >
              {/* Shimmer sweep animasyonu */}
              <motion.div
                animate={{ x: ["-120%", "220%"] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
                className={`absolute inset-0 bg-gradient-to-r ${theme.shimmer} pointer-events-none`}
                style={{ skewX: "-18deg" }}
              />
              <span className="relative flex items-center justify-center gap-2">
                <PartyPopper className="w-4 h-4" />
                {isLast ? "Harika, teşekkürler!" : "Sonraki Ödül →"}
              </span>
            </button>
          </motion.div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChallengePrizeDialog;
