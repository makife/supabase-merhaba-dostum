import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import Lottie from "lottie-react";
import { isSoundEffectsEnabled } from "@/utils/soundSettings";
import congratsAnimation from "@/assets/Congrats.json";
import seviyeDumanAnimation from "@/assets/seviyeDuman.json";

interface LevelUpDialogProps {
  open: boolean;
  onClose: () => void;
  newLevel: number;
}

export const LevelUpDialog: React.FC<LevelUpDialogProps> = ({ open, onClose, newLevel }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lottieRef = useRef<any>(null);
  const dumanLottieRef = useRef<any>(null);
  const tebriklerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dumanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTebrikler, setShowTebrikler] = useState(false);
  const [tebriklerAnimating, setTebriklerAnimating] = useState(false);
  const [showSeviye, setShowSeviye] = useState(false);
  const [seviyeAnimating, setSeviyeAnimating] = useState(false);
  const [showSeviyeDuman, setShowSeviyeDuman] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);

  const digitNames = ["sifir", "bir", "iki", "uc", "dort", "bes", "alti", "yedi", "sekiz", "dokuz"];
  const digitsRaw = String(newLevel).split("");
  const digitFiles = digitsRaw.map((d) => `/${digitNames[parseInt(d, 10)]}Level.webp`);

  useEffect(() => {
    setShowTebrikler(false);
    setTebriklerAnimating(false);
    setShowSeviye(false);
    setSeviyeAnimating(false);
    setShowSeviyeDuman(false);
    setShowNumbers(false);
    if (tebriklerTimeoutRef.current) {
      clearTimeout(tebriklerTimeoutRef.current);
      tebriklerTimeoutRef.current = null;
    }
    if (dumanTimeoutRef.current) {
      clearTimeout(dumanTimeoutRef.current);
      dumanTimeoutRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (showTebrikler) {
      const raf = requestAnimationFrame(() => setTebriklerAnimating(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [showTebrikler]);

  useEffect(() => {
    if (showSeviye) {
      const raf = requestAnimationFrame(() => setSeviyeAnimating(true));
      // seviyeAtladinText'in scale/opacity transition'ı 0.6s sürüyor;
      // bunun %60'ı tamamlanınca (0.36s) duman patlamaya başlasın
      dumanTimeoutRef.current = setTimeout(() => {
        setShowSeviyeDuman(true);
        playDumanSes();
      }, 0.1 * 600);
      return () => {
        cancelAnimationFrame(raf);
        if (dumanTimeoutRef.current) {
          clearTimeout(dumanTimeoutRef.current);
          dumanTimeoutRef.current = null;
        }
      };
    }
  }, [showSeviye]);

  const playLevelKayma = () => {
    if (!isSoundEffectsEnabled()) return;
    try {
      // Her çağrıda yeni bir Audio örneği: üst üste/ardışık digit'lerde
      // önceki sesin kesilmeden yenisiyle çakışabilmesi için audioRef'e dokunmuyoruz.
      const audio = new Audio("/levelKayma.mp3");
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch {}
  };

  const playDumanSes = () => {
    if (!isSoundEffectsEnabled()) return;
    try {
      const audio = new Audio("/dumanSes.mp3");
      audio.volume = 0.6;
      audio.play().catch(() => {});
    } catch {}
  };

  useEffect(() => {
    if (open && isSoundEffectsEnabled()) {
      try {
        const audio = new Audio("/seviyeAtlama.mp3");
        audio.volume = 0.7;
        audio.play().catch(() => {});
        audioRef.current = audio;
      } catch {}
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [open]);

  const handleCongratsDomLoaded = () => {
    // Lottie'nin toplam süresini saniye cinsinden al (getDuration(false))
    const duration =
      lottieRef.current && typeof lottieRef.current.getDuration === "function"
        ? lottieRef.current.getDuration(false)
        : undefined;
    // Süre alınamazsa makul bir fallback kullan
    const delayMs = duration ? duration * 1000 * 0.5 : 800;
    tebriklerTimeoutRef.current = setTimeout(() => {
      setShowTebrikler(true);
    }, delayMs);
  };

  const handleTebriklerGrowEnd = () => {
    setShowSeviye(true);
  };

  const handleSeviyeGrowEnd = () => {
    setShowNumbers(true);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2.5rem)] mx-auto p-0 overflow-hidden border-0 bg-transparent shadow-none [&>button]:hidden">
        {open && (
          <div className="flex flex-col items-center justify-start gap-0 py-8 relative">
            {/* Sağ üst X kapatma butonu - animasyon başlar başlamaz belirir */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="absolute top-2 right-2 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Congrats Lottie - sabit konum, kaymıyor */}
            <div className="w-full flex justify-center">
              <div style={{ width: 260, height: 260 }}>
                <Lottie
                  ref={lottieRef}
                  animationData={congratsAnimation}
                  loop={false}
                  autoplay={true}
                  onDOMLoaded={handleCongratsDomLoaded}
                />
              </div>
            </div>

            {/* tebriklerText.svg */}
            <div className="w-full flex justify-center -mt-14" style={{ minHeight: 60 }}>
              {showTebrikler && (
                <img
                  src="/tebriklerText.svg"
                  alt="Tebrikler"
                  onTransitionEnd={(e) => {
                    if (e.propertyName === "transform") handleTebriklerGrowEnd();
                  }}
                  style={{
                    opacity: tebriklerAnimating ? 1 : 0,
                    transform: tebriklerAnimating ? "scale(1)" : "scale(0.02)",
                    transformOrigin: "center center",
                    transition:
                      "opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
              )}
            </div>

            {/* seviyeAtladinText.svg */}
            <div className="w-full flex justify-center mt-4 relative" style={{ minHeight: 60 }}>
              {showSeviyeDuman && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, calc(-50% + 4px))",
                    width: 320,
                    height: 320,
                    zIndex: 0,
                    pointerEvents: "none",
                  }}
                >
                  <Lottie
                    ref={dumanLottieRef}
                    animationData={seviyeDumanAnimation}
                    loop={false}
                    autoplay={true}
                    onComplete={() => {
                      // loop=false zaten son karede durdurur; burada ekstra
                      // güvence olarak son kareye sabitliyoruz, replay olmasın
                      if (
                        dumanLottieRef.current &&
                        typeof dumanLottieRef.current.goToAndStop === "function" &&
                        typeof dumanLottieRef.current.getDuration === "function"
                      ) {
                        const totalFrames = dumanLottieRef.current.getDuration(true);
                        if (totalFrames) {
                          dumanLottieRef.current.goToAndStop(totalFrames - 1, true);
                        }
                      }
                    }}
                  />
                </div>
              )}
              {showSeviye && (
                <img
                  src="/seviyeAtladinText.svg"
                  alt="Seviye Atladın"
                  onTransitionEnd={(e) => {
                    if (e.propertyName === "transform") handleSeviyeGrowEnd();
                  }}
                  style={{
                    position: "relative",
                    zIndex: 1,
                    opacity: seviyeAnimating ? 1 : 0,
                    transform: seviyeAnimating ? "scale(1)" : "scale(0.02)",
                    transformOrigin: "center center",
                    transition:
                      "opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
              )}
            </div>

            {/* Level rakamları */}
            <div className="flex items-center justify-center gap-1 -mt-2" style={{ minHeight: 128 }}>
              {showNumbers &&
                digitFiles.map((src, idx) => {
                  const fromLeft = idx % 2 === 0;
                  return (
                    <div
                      key={`${src}-${idx}`}
                      onAnimationStart={playLevelKayma}
                      style={{
                        animation: `${fromLeft ? "slideInFromLeft" : "slideInFromRight"} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                        animationDelay: `${idx * 0.25}s`,
                        opacity: 0,
                      }}
                    >
                      <img src={src} alt={digitsRaw[idx]} className="h-32 w-auto drop-shadow-2xl" />
                    </div>
                  );
                })}
            </div>

            <style>{`
              @keyframes slideInFromLeft {
                from { opacity: 0; transform: translateX(-100px); }
                to { opacity: 1; transform: translateX(0); }
              }
              @keyframes slideInFromRight {
                from { opacity: 0; transform: translateX(100px); }
                to { opacity: 1; transform: translateX(0); }
              }
            `}</style>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
