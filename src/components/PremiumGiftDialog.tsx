import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';
import { isSoundEffectsEnabled } from '@/utils/soundSettings';

interface PremiumGiftDialogProps {
  open: boolean;
  onClose: () => void;
  message?: string;
}

export const PremiumGiftDialog: React.FC<PremiumGiftDialogProps> = ({ open, onClose, message }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2.5rem)] mx-auto p-0 overflow-hidden border-0 bg-transparent shadow-none [&>button]:hidden">
        {open && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              backgroundColor: '#0a1628',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#3b82f6',
              boxShadow: '0 0 40px rgba(59,130,246,0.35)',
            }}
          >
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #60a5fa)',
                boxShadow: '0 0 24px rgba(96,165,250,0.6)',
              }}
            >
              <Crown className="w-10 h-10 text-white" />
            </div>

            <p className="font-bold text-sm uppercase tracking-widest mb-1" style={{ color: '#60a5fa' }}>
              Tebrikler!
            </p>

            <h2 className="text-2xl font-black mb-3" style={{ color: '#93c5fd' }}>
              🤑 Milyoner
            </h2>

            <p className="text-sm mb-5 leading-relaxed" style={{ color: '#cbd5e1' }}>
              {message ||
                '1 milyon puana ulaşmanın şerefine sana 2 gün premium üyelik hediye ediyoruz. Tadını çıkar!'}
            </p>

            <Button
              onClick={onClose}
              className="w-full text-white font-bold py-3 rounded-xl border-0"
              style={{ backgroundColor: '#2563eb' }}
            >
              Süper! 👑
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
