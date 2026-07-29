import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Lottie from 'lottie-react';
import { isSoundEffectsEnabled } from '@/utils/soundSettings';
import congratsAnimation from '@/assets/Congrats.json';

interface LevelUpDialogProps {
  open: boolean;
  onClose: () => void;
  newLevel: number;
}

export const LevelUpDialog: React.FC<LevelUpDialogProps> = ({ open, onClose, newLevel }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lottieRef = useRef<any>(null);
  const [showTebrikler, setShowTebrikler] = useState(false);
  const [tebriklerAnimating, setTebriklerAnimating] = useState(false);
  const [showSeviye, setShowSeviye] = useState(false);
  const [seviyeAnimating, setSeviyeAnimating] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);

  const digitNames = ['sifir', 'bir', 'iki', 'uc', 'dort', 'bes', 'alti', 'yedi', 'sekiz', 'dokuz'];
  const digitsRaw = String(newLevel).split('');
  const digitFiles = digitsRaw.map(d => `/${digitNames[parseInt(d, 10)]}Level.png`);

  useEffect(() => {
    setShowTebrikler(false);
    setTebriklerAnimating(false);
    setShowSeviye(false);
    setSeviyeAnimating(false);
    setShowNumbers(false);
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
      return () => cancelAnimationFrame(raf);
    }
  }, [showSeviye]);

  const playLevelKayma = () => {
    if (!isSoundEffectsEnabled()) return;
    try {
      const audio = new Audio('/levelKayma.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {});
      audioRef.current = audio;
    } catch {}
  };

  useEffect(() => {
    if (open && isSoundEffectsEnabled()) {
      try {
        const audio = new Audio('/seviyeAtlama.mp3');
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

  const handleCongratsComplete = () => setShowTebrikler(true);

  const handleTebriklerGrowEnd = () => {
    setShowSeviye(true);
    playLevelKayma();
  };

  const handleSeviyeGrowEnd = () => {
    setShowNumbers(true);
    playLevelKayma();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-[calc(100%-2.5rem)] mx-auto p-0 overflow-hidden border-0 bg-transparent shadow-none [&>button]:hidden"
        onClick={(e) => {
          if (showNumbers) {
            e.preventDefault();
            onClose();
          }
        }}
      >
        {open && (
          <div className="flex flex-col items-center justify-start gap-6 py-8">
            {/* Congrats Lottie - sabit konum, kaymıyor */}
            <div className="w-full flex justify-center">
              <div style={{ width: 260, height: 260 }}>
                <Lottie
                  ref={lottieRef}
                  animationData={congratsAnimation}
                  loop={false}
                  autoplay={true}
                  onComplete={handleCongratsComplete}
                />
              </div>
            </div>

            {/* tebriklerText.svg */}
            <div className="w-full flex justify-center" style={{ minHeight: 60 }}>
              {showTebrikler && (
                <img
                  src="/tebriklerText.svg"
                  alt="Tebrikler"
                  onTransitionEnd={(e) => {
                    if (e.propertyName === 'transform') handleTebriklerGrowEnd();
                  }}
                  style={{
                    opacity: tebriklerAnimating ? 1 : 0,
                    transform: tebriklerAnimating ? 'scale(1)' : 'scale(0.02)',
                    transformOrigin: 'center center',
                    transition: 'opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                />
              )}
            </div>

            {/* seviyeAtladinText.svg */}
            <div className="w-full flex justify-center" style={{ minHeight: 60 }}>
              {showSeviye && (
                <img
                  src="/seviyeAtladinText.svg"
                  alt="Seviye Atladın"
                  onTransitionEnd={(e) => {
                    if (e.propertyName === 'transform') handleSeviyeGrowEnd();
                  }}
                  style={{
                    opacity: seviyeAnimating ? 1 : 0,
                    transform: seviyeAnimating ? 'scale(1)' : 'scale(0.02)',
                    transformOrigin: 'center center',
                    transition: 'opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                />
              )}
            </div>

            {/* Level rakamları */}
            <div className="flex items-center justify-center gap-1" style={{ minHeight: 128 }}>
              {showNumbers && digitFiles.map((src, idx) => {
                const fromLeft = idx % 2 === 0;
                return (
                  <div
                    key={`${src}-${idx}`}
                    style={{
                      animation: `${fromLeft ? 'slideInFromLeft' : 'slideInFromRight'} 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                      animationDelay: `${idx * 0.25}s`,
                      opacity: 0,
                    }}
                  >
                    <img
                      src={src}
                      alt={digitsRaw[idx]}
                      className="h-32 w-auto drop-shadow-2xl"
                    />
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
