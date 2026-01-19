import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Sparkles, Upload, CheckCircle } from 'lucide-react';

interface PhotoUploadOverlayProps {
  isVisible: boolean;
  stage: 'capturing' | 'optimizing' | 'uploading' | 'complete';
}

const stageMessages = {
  capturing: 'Fotoğraf alınıyor...',
  optimizing: 'Resminiz optimize ediliyor...',
  uploading: 'Resminiz yükleniyor...',
  complete: 'Tamamlandı!'
};

const stageIcons = {
  capturing: Camera,
  optimizing: Sparkles,
  uploading: Upload,
  complete: CheckCircle
};

export function PhotoUploadOverlay({ isVisible, stage }: PhotoUploadOverlayProps) {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    if (!isVisible || stage === 'complete') return;
    
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    
    return () => clearInterval(interval);
  }, [isVisible, stage]);

  const Icon = stageIcons[stage];
  const message = stageMessages[stage];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 shadow-2xl"
          >
            {/* Animated Icon Container */}
            <div className="relative">
              {/* Outer glow ring */}
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
                className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl"
                style={{ width: 100, height: 100, top: -10, left: -10 }}
              />
              
              {/* Spinning ring */}
              {stage !== 'complete' && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-500 border-r-amber-500/50"
                  style={{ width: 80, height: 80 }}
                />
              )}
              
              {/* Icon */}
              <motion.div
                animate={stage === 'complete' ? { scale: [1, 1.2, 1] } : { y: [0, -5, 0] }}
                transition={{ 
                  duration: stage === 'complete' ? 0.5 : 1.5,
                  repeat: stage === 'complete' ? 0 : Infinity,
                  ease: 'easeInOut'
                }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg"
              >
                <Icon className="w-10 h-10 text-white" />
              </motion.div>
            </div>

            {/* Message */}
            <div className="text-center">
              <motion.p
                key={stage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xl font-medium text-white"
              >
                {message}{stage !== 'complete' && dots}
              </motion.p>
              
              {stage !== 'complete' && (
                <p className="text-sm text-slate-400 mt-2">
                  Lütfen bekleyin
                </p>
              )}
            </div>

            {/* Progress dots */}
            {stage !== 'complete' && (
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.3, 1, 0.3]
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                    className="w-2 h-2 rounded-full bg-amber-500"
                  />
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Global state for overlay
let overlayState = {
  isVisible: false,
  stage: 'capturing' as 'capturing' | 'optimizing' | 'uploading' | 'complete'
};

const overlayListeners = new Set<(state: typeof overlayState) => void>();

export const showPhotoOverlay = (stage: typeof overlayState['stage']) => {
  overlayState = { isVisible: true, stage };
  overlayListeners.forEach(l => l(overlayState));
};

export const hidePhotoOverlay = () => {
  overlayState = { isVisible: false, stage: 'capturing' };
  overlayListeners.forEach(l => l(overlayState));
};

export const subscribeToPhotoOverlay = (listener: (state: typeof overlayState) => void) => {
  overlayListeners.add(listener);
  return () => overlayListeners.delete(listener);
};

export const getPhotoOverlayState = () => overlayState;
