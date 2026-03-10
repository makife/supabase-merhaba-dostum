import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';

interface LevelUpDialogProps {
  open: boolean;
  onClose: () => void;
  newLevel: number;
}

export const LevelUpDialog: React.FC<LevelUpDialogProps> = ({ open, onClose, newLevel }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open) {
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
          <div className="bg-[#1a0533] rounded-2xl p-6 text-center border border-purple-400">
            <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center mx-auto mb-3">
              <Crown className="w-8 h-8 text-white" />
            </div>

            <p className="text-purple-300 font-bold text-sm uppercase tracking-widest mb-1">
              Seviye Atladın!
            </p>

            <span className="text-6xl font-black text-purple-200">
              {newLevel}
            </span>

            <p className="text-purple-300/60 text-xs mb-5 mt-1">
              Tebrikler, yeni seviyeye ulaştın!
            </p>

            <Button
              onClick={onClose}
              className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl border-0"
            >
              Harika! 🏆
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
