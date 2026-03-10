import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Sparkles, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LevelUpDialogProps {
  open: boolean;
  onClose: () => void;
  newLevel: number;
}

export const LevelUpDialog: React.FC<LevelUpDialogProps> = ({ open, onClose, newLevel }) => {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[calc(100%-2.5rem)] mx-auto p-0 overflow-hidden border-0 bg-transparent shadow-none [&>button]:hidden">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotateY: -30 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.5, opacity: 0, rotateY: 30 }}
              transition={{ type: 'spring', damping: 18, stiffness: 280 }}
              className="relative rounded-2xl overflow-hidden"
            >
              {/* Outer glow border */}
              <div className="bg-gradient-to-b from-purple-400 via-violet-500 to-purple-700 p-[2px] rounded-2xl shadow-[0_0_40px_rgba(139,92,246,0.5)]">
                <div className="bg-gradient-to-b from-[#1a0533] via-[#0f0a1e] to-[#1a0533] rounded-2xl p-6 text-center relative overflow-hidden">
                  
                  {/* Animated background particles */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(6)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 100, x: Math.random() * 200 }}
                        animate={{ 
                          opacity: [0, 0.7, 0],
                          y: [-20, -120],
                          x: Math.random() * 200,
                        }}
                        transition={{ 
                          duration: 2 + Math.random() * 2,
                          repeat: Infinity,
                          delay: i * 0.4,
                        }}
                        className="absolute bottom-0"
                      >
                        <Sparkles className="w-3 h-3 text-purple-400/60" />
                      </motion.div>
                    ))}
                  </div>

                  {/* Top glow effect */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-purple-500/20 rounded-full blur-3xl" />

                  {/* Crown icon with pulse */}
                  <motion.div
                    initial={{ y: -30, opacity: 0, scale: 0 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', damping: 10 }}
                    className="flex justify-center mb-3 relative"
                  >
                    {/* Glow ring behind icon */}
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute w-20 h-20 rounded-full bg-purple-500/30 blur-xl"
                    />
                    <div className="w-16 h-16 rounded-full bg-gradient-to-b from-purple-400 to-violet-600 flex items-center justify-center shadow-[0_0_25px_rgba(139,92,246,0.6)] relative z-10">
                      <Crown className="w-8 h-8 text-white drop-shadow-lg" />
                    </div>
                  </motion.div>

                  {/* Stars decoration */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="absolute top-6 left-6"
                  >
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}>
                      <Star className="w-4 h-4 text-purple-300/50 fill-purple-300/30" />
                    </motion.div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="absolute top-10 right-8"
                  >
                    <motion.div animate={{ rotate: -360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}>
                      <Star className="w-3 h-3 text-violet-300/50 fill-violet-300/30" />
                    </motion.div>
                  </motion.div>

                  {/* Title */}
                  <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-purple-300 font-bold text-sm uppercase tracking-widest mb-1"
                  >
                    Seviye Atladın! 🎉
                  </motion.p>

                  {/* Level number with glow */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: 'spring', damping: 10, stiffness: 200 }}
                    className="relative inline-block"
                  >
                    <span className="text-6xl font-black bg-gradient-to-b from-purple-200 via-violet-300 to-purple-400 bg-clip-text text-transparent drop-shadow-[0_0_20px_rgba(139,92,246,0.8)]">
                      {newLevel}
                    </span>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-purple-300/60 text-xs mb-5 mt-1"
                  >
                    Tebrikler, yeni seviyeye ulaştın!
                  </motion.p>

                  {/* Close button */}
                  <motion.div
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <Button
                      onClick={onClose}
                      className="w-full bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl border-0 shadow-[0_4px_20px_rgba(139,92,246,0.4)] hover:shadow-[0_4px_30px_rgba(139,92,246,0.6)] transition-all duration-300 hover:scale-[1.02] active:scale-95"
                    >
                      Harika! 🏆
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};
