import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useSounds } from '@/hooks/useSounds';

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
}

const GameCountdown = ({ onComplete, className }: GameCountdownProps) => {
  const [count, setCount] = useState(5);
  const [isVisible, setIsVisible] = useState(false); // false ile başla
  const [showStart, setShowStart] = useState(false);
  const [hasStarted, setHasStarted] = useState(false); // Yeni state
  const { playSound } = useSounds();

  // İlk başlatma için useEffect
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      setHasStarted(true);
      setIsVisible(true);
    }, 1000); // 1 saniye bekle

    return () => clearTimeout(initialTimer);
  }, []);

  useEffect(() => {
    if (!hasStarted) return; // Henüz başlamamışsa hiçbir şey yapma

    if (count > 0) {
      // Sadece 4, 3, 2, 1 için ses çal (5 için değil)
      if (count <= 5) {
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
      console.log('🔊 Başla sesi çalıyor');
      playSound('correctWord');
      
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          onComplete();
        }, 200);
      }, 800);
    }
  }, [count, showStart, onComplete, hasStarted]);

  // Henüz başlamamışsa hiçbir şey gösterme
  if (!hasStarted) return null;

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