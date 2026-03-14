import React, { useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';
import { isSoundEffectsEnabled } from '@/utils/soundSettings';

const THEMES = [
  { bg: '#1a0533', border: '#a855f7', icon: '#9333ea', text: '#d8b4fe', sub: '#c084fc', btn: '#9333ea' },
  { bg: '#0a1628', border: '#3b82f6', icon: '#2563eb', text: '#93c5fd', sub: '#60a5fa', btn: '#2563eb' },
  { bg: '#0d2818', border: '#22c55e', icon: '#16a34a', text: '#86efac', sub: '#4ade80', btn: '#16a34a' },
  { bg: '#2a1507', border: '#f59e0b', icon: '#d97706', text: '#fcd34d', sub: '#fbbf24', btn: '#d97706' },
  { bg: '#1a0a1e', border: '#ec4899', icon: '#db2777', text: '#f9a8d4', sub: '#f472b6', btn: '#db2777' },
  { bg: '#1a1a0a', border: '#eab308', icon: '#ca8a04', text: '#fef08a', sub: '#facc15', btn: '#ca8a04' },
  { bg: '#0f1729', border: '#06b6d4', icon: '#0891b2', text: '#67e8f9', sub: '#22d3ee', btn: '#0891b2' },
  { bg: '#1c0f0f', border: '#ef4444', icon: '#dc2626', text: '#fca5a5', sub: '#f87171', btn: '#dc2626' },
];

interface LevelUpDialogProps {
  open: boolean;
  onClose: () => void;
  newLevel: number;
}

export const LevelUpDialog: React.FC<LevelUpDialogProps> = ({ open, onClose, newLevel }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const theme = useMemo(() => {
    return THEMES[Math.floor(Math.random() * THEMES.length)];
  }, [open, newLevel]);

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
            style={{ backgroundColor: theme.bg, borderWidth: 1, borderStyle: 'solid', borderColor: theme.border }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: theme.icon }}
            >
              <Crown className="w-8 h-8 text-white" />
            </div>

            <p className="font-bold text-sm uppercase tracking-widest mb-1" style={{ color: theme.sub }}>
              Seviye Atladın!
            </p>

            <span className="text-6xl font-black" style={{ color: theme.text }}>
              {newLevel}
            </span>

            <p className="text-xs mb-5 mt-1" style={{ color: theme.sub + '99' }}>
              Tebrikler, yeni seviyeye ulaştın!
            </p>

            <Button
              onClick={onClose}
              className="w-full text-white font-bold py-3 rounded-xl border-0"
              style={{ backgroundColor: theme.btn }}
            >
              Harika! 🏆
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
