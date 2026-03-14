import React, { useEffect, useRef, useMemo } from 'react';
import { isSoundEffectsEnabled } from '@/utils/soundSettings';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RankTier } from '@/utils/rankSystem';

interface RankUpDialogProps {
  open: boolean;
  onClose: () => void;
  tier: RankTier | null;
}

export const RankUpDialog: React.FC<RankUpDialogProps> = ({ open, onClose, tier }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const theme = useMemo(() => ({
    bg: '#1a0f05',
    border: '#f59e0b',
    icon: '#d97706',
    text: '#fcd34d',
    sub: '#fbbf24',
    btn: '#d97706',
  }), []);

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

  if (!tier) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2.5rem)] mx-auto p-0 overflow-hidden border-0 bg-transparent shadow-none [&>button]:hidden">
        {open && (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ backgroundColor: theme.bg, borderWidth: 1, borderStyle: 'solid', borderColor: theme.border }}
          >
            <div className="w-24 h-24 mx-auto mb-3">
              <img
                src={tier.image}
                alt={tier.name}
                className="w-full h-full object-contain rounded-2xl border-2"
                style={{ borderColor: theme.border }}
              />
            </div>

            <p className="font-bold text-sm uppercase tracking-widest mb-2" style={{ color: theme.sub }}>
              Rank Yükseldin!
            </p>

            <span className="text-3xl font-black" style={{ color: theme.text }}>
              Tebrikler!
            </span>

            <p className="text-sm mt-2 mb-5" style={{ color: theme.sub + 'cc' }}>
              Artık bir <strong style={{ color: theme.text }}>{tier.name}</strong>'sin! 🎉
            </p>

            <Button
              onClick={onClose}
              className="w-full text-white font-bold py-3 rounded-xl border-0"
              style={{ backgroundColor: theme.btn }}
            >
              Harika! 🏅
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
