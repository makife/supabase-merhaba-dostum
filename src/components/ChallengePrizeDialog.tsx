import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Lottie from "lottie-react";
import refleksOdul2 from "@/assets/refleksOdulPenceresi2.png";
import refleksOdul4 from "@/assets/refleksOdulPenceresi4.png";
import refleksOdul6 from "@/assets/refleksOdulPenceresi6.png";
import kelimePuzzleOdul from "@/assets/kelimePuzzleOdulPenceresi.png";
import kelimeAviOdul from "@/assets/kelimeAviOdulPenceresi.png";
import harfKosusuOdul from "@/assets/harfKosusuOdulPenceresi.png";
import sansCarkiOdul from "@/assets/sansCarkiOdulPenceresi.png";


interface PrizeNotification {
  id: string;
  message: string;
}

// Görsel oranı: tüm ödül penceresi png'leri 832x1248 boyutunda
const IMAGE_ASPECT = 832 / 1248;

// "Ödülü Al" butonunun görsel üzerindeki konumu (yüzde olarak).
// Tüm png'lerde buton aynı bölgede olduğu için tek bir sabit yeterli.
const BUTTON_AREA = {
  top: "73.5%",
  left: "26%",
  width: "48%",
  height: "8.5%",
};

const getPrizeImage = (message: string): string => {
  const isRefleks =
    message.includes("Refleks") || message.includes("refleks");

  if (isRefleks) {
    // Refleks ödül görseli, mesajda hangi joker türlerinin verildiğine göre belirlenir:
    // sadece Fısılda -> 15-19 seviye (refleksOdulPenceresi2)
    // Fısılda + Değiştir -> 20-24 seviye (refleksOdulPenceresi4)
    // Fısılda + Değiştir + Sen Yaz -> 25+ seviye (refleksOdulPenceresi6)
    const hasSenyaz = /Sen\s*Yaz|Senyaz/i.test(message);
    const hasDegistir = /Değiştir/i.test(message);

    if (hasSenyaz) return "/assets/refleksOdulPenceresi6.png";
    if (hasDegistir) return "/assets/refleksOdulPenceresi4.png";
    return "/assets/refleksOdulPenceresi2.png";
  }

  if (message.includes("Puzzle") || message.includes("puzzle")) {
    return "/assets/kelimePuzzleOdulPenceresi.png";
  }

  if (message.includes("Kelime Avı") || message.includes("kelime avı") || message.includes("Kelime Avi")) {
    return "/assets/kelimeAviOdulPenceresi.png";
  }

  if (message.includes("Harf Koşusu") || message.includes("harf koşusu")) {
    return "/assets/harfKosusuOdulPenceresi.png";
  }

  // Hafıza / diğer tüm oyun türleri için genel çark ödül görseli
  return "/assets/sansCarkiOdulPenceresi.png";
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

  if (notifications.length === 0) return null;
  const current = notifications[currentIndex];
  if (!current) return null;

  const imageSrc = getPrizeImage(current.message);

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); }}>
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-sm mx-auto p-0 overflow-hidden border-0 bg-transparent shadow-none"
        style={{ boxShadow: "none" }}
      >
        <div className="relative w-full" style={{ aspectRatio: IMAGE_ASPECT }}>
          <img
            src={imageSrc}
            alt="Ödül"
            className="w-full h-full object-contain select-none"
            draggable={false}
          />

          {/* Konfeti katmanı - görselin üzerinde, tıklamaları engellemez */}
          {konfettiAnim && (
            <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
              <Lottie animationData={konfettiAnim} loop={false} style={{ width: "100%", height: "100%" }} />
            </div>
          )}

          {/* Görsel üzerindeki "Ödülü Al" butonunun tam üstüne görünmez, tıklanabilir katman */}
          <button
            onClick={handleClose}
            aria-label="Ödülü Al"
            className="absolute z-20 bg-transparent border-0 outline-none cursor-pointer active:scale-[0.97] transition-transform"
            style={{
              top: BUTTON_AREA.top,
              left: BUTTON_AREA.left,
              width: BUTTON_AREA.width,
              height: BUTTON_AREA.height,
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChallengePrizeDialog;
