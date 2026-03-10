import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';
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
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative rounded-2xl overflow-hidden"
            >
              {/* Background */}
              <div className="bg-gradient-to-b from-yellow-500 via-amber-500 to-orange-600 p-[2px] rounded-2xl">
                <div className="bg-gradient-to-b from-amber-950 to-amber-900 rounded-2xl p-6 text-center">
                  
                  {/* Crown icon */}
                  <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex justify-center mb-3"
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-b from-yellow-400 to-amber-500 flex items-center justify-center">
                      <Crown className="w-8 h-8 text-amber-950" />
                    </div>
                  </motion.div>

                  {/* Title */}
                  <motion.p
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-yellow-300 font-bold text-sm uppercase tracking-widest mb-1"
                  >
                    Seviye Atladın! 🎉
                  </motion.p>

                  {/* Level number */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: 'spring', damping: 12 }}
                    className="text-5xl font-black text-yellow-400 mb-1"
                  >
                    {newLevel}
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-amber-200/70 text-xs mb-5"
                  >
                    Tebrikler, yeni seviyeye ulaştın!
                  </motion.p>

                  {/* Close button */}
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.6 }}
                  >
                    <Button
                      onClick={onClose}
                      className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 text-amber-950 font-bold py-3 rounded-xl border-0"
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
