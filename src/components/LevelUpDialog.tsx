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
  const [showText, setShowText] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);

  // Seviyeyi iki rakama ayır (örn: 12 → ['1', '2'])
  const digits = String(newLevel).padStart(2, '0').split('');
  const firstDigit = digits[0];
  const secondDigit = digits[1];

  useEffect(() => {
    setShowText(false);
    setShowNumbers(false);
  }, [open]);

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

  // Lottie animasyonu bittiğinde tebriklerText.svg'yi göster (nokta→büyüme)
  const handleAnimationComplete = () => {
    setShowText(true);
  };

  // tebriklerText.svg büyüme animasyonu bittiğinde rakamları göster
  const handleTextGrowEnd = () => {
    setShowNumbers(true);
  };

  // Rakamlar kayarken ses çal
  useEffect(() => {
    if (showNumbers && isSoundEffectsEnabled()) {
      try {
        const audio = new Audio('/levelKayma.mp3');
        audio.volume = 0.6;
        // Rakamlar 0.8s'de kayıyor, ses de aynı hızda çalmalı
        // Eğer ses 400ms ise playbackRate = 0.5 yap (2x yavaşlat)
        // Eğer ses 800ms ise playbackRate = 1 bırak
        audio.playbackRate = 1;
        audio.play().catch(() => {});
        audioRef.current = audio;
      } catch {}
    }
  }, [showNumbers]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent 
        className="max-w-[calc(100%-2.5rem)] mx-auto p-0 overflow-hidden border-0 bg-transparent shadow-none [&>button]:hidden"
        onClick={(e) => {
          // Sayı animasyonları biterse kapatılabilsin
          if (showNumbers) {
            e.preventDefault();
            onClose();
          }
        }}
      >
        {open && (
          <div className="flex flex-col items-center justify-center gap-8 py-12">
            {/* Congrats Lottie Animasyonu */}
            <div className="w-full flex justify-center">
              <div style={{ width: 280, height: 280 }}>
                <Lottie
                  ref={lottieRef}
                  animationData={congratsAnimation}
                  loop={false}
                  autoplay={true}
                  onComplete={handleAnimationComplete}
                />
              </div>
            </div>

            {/* Tebrikler Text SVG - Küçük Nokta Halinde Başlayıp Büyüyerek Ortaya Gelir */}
            {showText && (
              <div className="w-full flex justify-center">
                <img
                  src="/tebriklerText.svg"
                  alt="Tebrikler"
                  onAnimationEnd={handleTextGrowEnd}
                  style={{
                    animation: 'growFromDot 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    transformOrigin: 'center center',
                  }}
                />
              </div>
            )}

            {/* Level Rakamları - Slide-in Animasyonu */}
            {showNumbers && (
              <div className="flex items-center justify-center gap-1">
                {/* İlk Rakam - Soldan Kayarak Gelecek */}
                <div
                  className="animate-slideInFromLeft"
                  style={{
                    animation: 'slideInFromLeft 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    animationDelay: '0.5s',
                  }}
                >
                  <img
                    src={`/${firstDigit}Level.png`}
                    alt={firstDigit}
                    className="h-32 w-auto drop-shadow-2xl"
                  />
                </div>

                {/* İkinci Rakam - Sağdan Kayarak Gelecek */}
                <div
                  className="animate-slideInFromRight"
                  style={{
                    animation: 'slideInFromRight 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                    animationDelay: '0.5s',
                  }}
                >
                  <img
                    src={`/${secondDigit}Level.png`}
                    alt={secondDigit}
                    className="h-32 w-auto drop-shadow-2xl"
                  />
                </div>
              </div>
            )}
            
            {/* CSS Animasyonları */}
            <style>{`
              @keyframes slideInFromLeft {
                from {
                  opacity: 0;
                  transform: translateX(-100px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }

              @keyframes slideInFromRight {
                from {
                  opacity: 0;
                  transform: translateX(100px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }

              @keyframes growFromDot {
                from {
                  opacity: 0;
                  transform: scale(0.02);
                }
                to {
                  opacity: 1;
                  transform: scale(1);
                }
              }

              @keyframes fadeIn {
                from {
                  opacity: 0;
                }
                to {
                  opacity: 1;
                }
              }
            `}</style>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
