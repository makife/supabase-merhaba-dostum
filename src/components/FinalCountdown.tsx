import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FinalCountdownProps {
  displayTime: number;
  onCountdownTick?: (second: number) => void;
}

/**
 * Son 9 saniye için büyüyüp kaybolan geri sayım animasyonu
 * Ekranın ortasında büyük rakamlar gösterir
 */
const FinalCountdown = ({ displayTime, onCountdownTick }: FinalCountdownProps) => {
  const lastTickRef = useRef<number | null>(null);
  
  // 9'dan 1'e kadar göster (0'da oyun biter)
  const showCountdown = displayTime >= 1 && displayTime <= 9;
  
  useEffect(() => {
    if (showCountdown && displayTime !== lastTickRef.current) {
      lastTickRef.current = displayTime;
      onCountdownTick?.(displayTime);
    }
  }, [displayTime, showCountdown, onCountdownTick]);

  if (!showCountdown) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={displayTime}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.5, opacity: 1 }}
          exit={{ scale: 3, opacity: 0 }}
          transition={{
            duration: 0.8,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="relative"
        >
          {/* Glow effect */}
          <div 
            className="absolute inset-0 blur-2xl rounded-full"
            style={{
              background: displayTime <= 3 
                ? 'radial-gradient(circle, rgba(239,68,68,0.6) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(251,146,60,0.5) 0%, transparent 70%)',
            }}
          />
          
          {/* Main number */}
          <span
            className={`relative font-mono font-black text-[12rem] leading-none drop-shadow-2xl ${
              displayTime <= 3 ? "text-red-500" : "text-orange-400"
            }`}
            style={{
              textShadow: displayTime <= 3
                ? '0 0 60px rgba(239,68,68,0.8), 0 0 120px rgba(239,68,68,0.4)'
                : '0 0 60px rgba(251,146,60,0.8), 0 0 120px rgba(251,146,60,0.4)',
              fontFamily: "'Orbitron', 'Courier New', monospace",
            }}
          >
            {displayTime}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default FinalCountdown;
