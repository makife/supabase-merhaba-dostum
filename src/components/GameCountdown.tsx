import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useSounds } from '@/hooks/useSounds';

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
}

const GameCountdown = ({ onComplete, className }: GameCountdownProps) => {
  const [count, setCount] = useState(5);
  const [isVisible, setIsVisible] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const { playSound } = useSounds();

  useEffect(() => {
    if (count <= 4) {
      // Geri sayım sesi çal - hem buttonClick hem de özel countdown sesi
      console.log('🔊 Countdown ses çalıyor:', count);
      playSound('buttonClick');
    }
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          setCount(count - 1);
          setIsVisible(true);
        }, 200);
      }, 800);

      return () => clearTimeout(timer);
    } else if (count === 0 && !showStart) {
      setShowStart(true);
      // "Başla!" anında farklı ses çal
      console.log('🔊 Başla sesi çalıyor');
      playSound('correctWord');
      
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          onComplete();
        }, 200);
      }, 800);
    }
  }, [count, showStart, onComplete]);

  if (count === 0 && !showStart) return null;

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex items-center justify-center",
      className
    )}>
      <div className={cn(
        "text-9xl font-bold transition-all duration-200",
        isVisible 
          ? "scale-100 opacity-100" 
          : "scale-75 opacity-0",
        showStart 
          ? "text-primary animate-pulse" 
          : "text-foreground"
      )}>
        {showStart ? "Başla!" : count}
      </div>
    </div>
  );
};
export default GameCountdown;