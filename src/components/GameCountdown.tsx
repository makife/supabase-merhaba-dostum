import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  // serverStartTime ve offset artık gereksiz, çünkü bu bileşen
  // ekrana geldiği an saymaya başlayacak. Zamanlamayı GamePage yönetiyor.
  serverStartTime?: string | null;
  serverTimeOffset?: number;
}

// Resim yolları
const IMAGE_MAP: Record<string, string> = {
  "5": "/bes.png",
  "4": "/dort.png",
  "3": "/uc.png",
  "2": "/iki.png",
  "1": "/bir.png",
  start: "/basla.png",
};

const GameCountdown = memo(({ onComplete, className }: GameCountdownProps) => {
  const [count, setCount] = useState(5);
  const [showStart, setShowStart] = useState(false);

  // Sesler için basit referanslar
  const beepAudio = useRef<HTMLAudioElement | null>(null);
  const startAudio = useRef<HTMLAudioElement | null>(null);

  // Sesleri yükle
  useEffect(() => {
    beepAudio.current = new Audio("/gerisayim.mp3");
    startAudio.current = new Audio("/basla.mp3");
    beepAudio.current.volume = 0.7;
    startAudio.current.volume = 0.7;

    // Resimleri preload et (tarayıcı önbelleğine al)
    Object.values(IMAGE_MAP).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Sayaç Mantığı
  useEffect(() => {
    // 1. Fonksiyon: Sesi çal
    const playBeep = () => {
      if (beepAudio.current) {
        beepAudio.current.currentTime = 0;
        beepAudio.current.play().catch(() => {});
      }
    };

    const playStart = () => {
      if (startAudio.current) {
        startAudio.current.currentTime = 0;
        startAudio.current.play().catch(() => {});
      }
    };

    // İlk açılışta 5. saniye sesi
    playBeep();

    const timer = setInterval(() => {
      setCount((prev) => {
        const next = prev - 1;

        if (next > 0) {
          playBeep(); // 4, 3, 2, 1 sesleri
        } else if (next === 0) {
          // 0 olduğunda "BAŞLA" gösterilecek
          playStart(); // Başla sesi
          setShowStart(true);
        } else {
          // -1 olduğunda bitir
          clearInterval(timer);
          // Küçük bir gecikme ile onComplete çağır (Start yazısı görünsün)
          setTimeout(() => {
            onComplete();
          }, 800);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete]);

  // Render edilecek resim
  let imageSrc = null;
  if (showStart) {
    imageSrc = IMAGE_MAP["start"];
  } else if (count > 0) {
    imageSrc = IMAGE_MAP[String(count)];
  }

  if (!imageSrc) return null;

  // Portal kullanarak body'ye render et (z-index sorunlarını çözer)
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300",
        className,
      )}
    >
      <div key={showStart ? "start" : count} className="animate-bounce-in">
        <img
          src={imageSrc}
          alt={showStart ? "Başla" : String(count)}
          className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] object-contain drop-shadow-2xl"
          style={{
            willChange: "transform",
            filter: "drop-shadow(0 0 20px rgba(255,255,255,0.3))",
          }}
        />
      </div>
    </div>,
    document.body,
  );
});

GameCountdown.displayName = "GameCountdown";

export default GameCountdown;
