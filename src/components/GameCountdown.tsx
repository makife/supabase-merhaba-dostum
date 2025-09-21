import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
}

const GameCountdown = ({ onComplete, className }: GameCountdownProps) => {
  const [count, setCount] = useState(5);
  const [isVisible, setIsVisible] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Ses dosyaları için ref'ler
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);

  // Ses dosyalarını yükle
  useEffect(() => {
    countdownAudioRef.current = new Audio('/gerisayim.mp3');
    startAudioRef.current = new Audio('/basla.mp3');

    // Ses dosyalarını preload et
    if (countdownAudioRef.current) {
      countdownAudioRef.current.preload = 'auto';
      countdownAudioRef.current.volume = 0.7; // Ses seviyesi ayarla
    }
    if (startAudioRef.current) {
      startAudioRef.current.preload = 'auto';
      startAudioRef.current.volume = 0.7;
    }

    // Cleanup
    return () => {
      if (countdownAudioRef.current) {
        countdownAudioRef.current.pause();
        countdownAudioRef.current = null;
      }
      if (startAudioRef.current) {
        startAudioRef.current.pause();
        startAudioRef.current = null;
      }
    };
  }, []);

  // Ses çalma fonksiyonu
  const playCountdownSound = async () => {
    if (countdownAudioRef.current) {
      try {
        // Önceki ses varsa durdur ve başa sar
        countdownAudioRef.current.currentTime = 0;
        await countdownAudioRef.current.play();
        console.log('🔊 Geri sayım sesi çalıyor:', count);
      } catch (error) {
        console.warn('Geri sayım sesi çalamadı:', error);
      }
    }
  };

  const playStartSound = async () => {
    if (startAudioRef.current) {
      try {
        startAudioRef.current.currentTime = 0;
        await startAudioRef.current.play();
        console.log('🔊 Başla sesi çalıyor');
        
        // Ses bittiğinde event dinle
        startAudioRef.current.onended = () => {
          console.log('🔊 Başla sesi bitti');
        };
        
      } catch (error) {
        console.warn('Başla sesi çalamadı:', error);
      }
    }
  };

  // İlk başlatma için useEffect
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      setHasStarted(true);
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(initialTimer);
  }, []);

  useEffect(() => {
    if (!hasStarted) return;

    if (count > 0) {
      // Ses çalma - daha kısa gecikme ile
      const soundTimer = setTimeout(() => {
        playCountdownSound();
      }, 50);
      
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          setCount(count - 1);
          setIsVisible(true);
        }, 200);
      }, 800);

      return () => {
        clearTimeout(timer);
        clearTimeout(soundTimer);
      };
    } else if (count === 0 && !showStart) {
      // Önce sesi çal, sonra state'i güncelle
      playStartSound();
      setShowStart(true);
      
      // Yazıyı kısa göster ama sesi çalmaya devam et
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => {
          onComplete();
        }, 200);
      }, 1000); // 1 saniye - daha kısa ama sesin çalmasına izin ver
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