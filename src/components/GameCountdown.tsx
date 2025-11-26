import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface GameCountdownProps {
  onComplete: () => void;
  className?: string;
  serverStartTime?: string | null;
  serverTimeOffset?: number;
}

const GameCountdown = ({
  onComplete,
  className,
  serverStartTime,
  serverTimeOffset = 0,
}: GameCountdownProps) => {
  const [count, setCount] = useState(5);
  const [isVisible, setIsVisible] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [preloadComplete, setPreloadComplete] = useState(false);

  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedCountRef = useRef<number>(-1);
  const hasPlayedStartRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const countdownLockRef = useRef<boolean>(false); // 🔒 Tek-seferlik countdown kilidi

  // === 1. PRELOAD (Görsel + Ses + AudioContext) ===
  useEffect(() => {
    let cancelled = false;

    const preload = async () => {
      // AudioContext'i erkenden oluştur (mobile unlock için)
      try {
        audioContextRef.current = new AudioContext();
      } catch (e) {
        console.log("AudioContext erken oluşturulamadı, sonra deneriz");
      }

      // Görseller
      const images = ["/bir.png", "/iki.png", "/uc.png", "/dort.png", "/bes.png", "/basla.png"];
      const imgPromises = images.map(src => 
        new Promise<void>((res, rej) => {
          const img = new Image();
          img.src = src;
          img.onload = () => res();
          img.onerror = () => rej(new Error(`Image: ${src}`));
        })
      );

      // Sesler (decodeAudioData ile tam preload)
      const sounds = ["/gerisayim.mp3", "/basla.mp3"];
      const soundPromises = sounds.map(src => 
        new Promise<void>((res, rej) => {
          fetch(src)
            .then(r => r.arrayBuffer())
            .then(buffer => {
              if (audioContextRef.current) {
                audioContextRef.current.decodeAudioData(buffer, () => res(), rej);
              } else {
                res();
              }
            })
            .catch(rej);
        })
      );

      await Promise.all([...imgPromises, ...soundPromises]);
      
      if (!cancelled) {
        // Audio elementleri hazırla
        countdownAudioRef.current = new Audio("/gerisayim.mp3");
        startAudioRef.current = new Audio("/basla.mp3");
        [countdownAudioRef.current, startAudioRef.current]?.forEach(a => {
          if (a) {
            a.preload = "auto";
            a.volume = 0.7;
            a.load(); // Force reload
          }
        });
        setPreloadComplete(true);
      }
    };

    preload().catch(e => {
      console.error("Preload error:", e);
      setPreloadComplete(true); // Devam et
    });

    return () => { cancelled = true; };
  }, []);

  // === 2. MOBILE AUDIO UNLOCK (Sessiz - Otomatik) ===
  const ensureAudioUnlocked = useCallback(async () => {
    if (audioContextRef.current?.state === 'running') return true;

    // 1. AudioContext resume
    if (audioContextRef.current) {
      await audioContextRef.current.resume().catch(() => {});
    }

    // 2. HTML5 Audio unlock (çok kısa sessiz ses)
    try {
      const unlock = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
      unlock.volume = 0.0;
      await unlock.play();
      unlock.pause();
    } catch (e) {}

    // 3. Test sesi (gerçekten unlocked mı?)
    if (countdownAudioRef.current) {
      try {
        await countdownAudioRef.current.play();
        countdownAudioRef.current.pause();
        countdownAudioRef.current.currentTime = 0;
      } catch (e) {}
    }

    return audioContextRef.current?.state !== 'suspended' && audioContextRef.current?.state !== 'closed';
  }, []);

  // === 3. SERVER TIME GERİ SAYIM (HER ŞEY OTOMATİK) ===
  useEffect(() => {
    if (!serverStartTime || !preloadComplete) return;
    
    // 🔒 Countdown zaten başlamışsa tekrar başlatma
    if (countdownLockRef.current) {
      console.log("⚠️ Countdown zaten başlamış - duplicate trigger engellendi");
      return;
    }
    
    countdownLockRef.current = true;
    console.log("🔒 Countdown kilidi aktif edildi", { serverStartTime });

    const startTime = new Date(serverStartTime).getTime();
    startTimeRef.current = startTime;
    
    // Audio unlock'u başlat (arka planda)
    ensureAudioUnlocked();

    setHasStarted(true);
    setIsVisible(true);

    const updateCountdown = () => {
      const now = Date.now() + serverTimeOffset;
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, 5 - elapsed);

      if (remaining > 0) {
        setCount((prev) => {
          if (prev !== remaining) {
            // 5. saniye dahil TÜM sesler ZORLA çal
            if (countdownAudioRef.current && lastPlayedCountRef.current !== remaining) {
              countdownAudioRef.current.currentTime = 0;
              countdownAudioRef.current.play().catch(e => {
                console.log(`Ses ${remaining} başarısız:`, e);
              });
              lastPlayedCountRef.current = remaining;
              console.log(`${remaining} sesi çalındı`);
            }
            setAnimKey((k) => k + 1);
          }
          return remaining;
        });
      } else if (remaining === 0 && !hasPlayedStartRef.current) {
        setCount(0);
        setAnimKey((k) => k + 1);
        
        // Başla sesi
        if (startAudioRef.current) {
          startAudioRef.current.currentTime = 0;
          startAudioRef.current.play().catch(e => console.log("Başla sesi hatası:", e));
          hasPlayedStartRef.current = true;
        }
        
        setShowStart(true);
        
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
            onComplete();
          }, 200);
        }, 1000);
      }
    };

    // Hemen başla + 100ms interval (hassas timing)
    updateCountdown();
    const interval = setInterval(updateCountdown, 100);

    return () => {
      clearInterval(interval);
    };
  }, [serverStartTime, serverTimeOffset, onComplete, preloadComplete]);

  // Sadece component unmount olduğunda lock'u kaldır
  useEffect(() => {
    return () => {
      countdownLockRef.current = false;
    };
  }, []);

  // === RENDER (Sadece sayım sırasında görünür) ===
  if (!hasStarted || !preloadComplete) return null;
  if (count === 0 && !showStart) return null;

  const getImageForCount = (num: number): string => {
    const imageMap: Record<number, string> = {
      1: "/bir.png",
      2: "/iki.png", 
      3: "/uc.png",
      4: "/dort.png",
      5: "/bes.png",
    };
    return imageMap[num] || "";
  };

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/50", className)}>
      <div className="relative">
        <img
          key={animKey}
          src={showStart ? "/basla.png" : getImageForCount(count)}
          alt={showStart ? "Başla" : `${count}`}
          className={cn(
            "transition-all duration-300 object-contain",
            "w-[280px] h-[280px]",
            "sm:w-[360px] sm:h-[360px]",
            "md:w-[420px] md:h-[420px]",
            "lg:w-[480px] lg:h-[480px]",
            showStart ? "scale-110" : "scale-100",
          )}
          style={{
            filter: showStart
              ? "drop-shadow(0 0 60px rgba(255, 107, 107, 0.9)) drop-shadow(0 0 30px rgba(255, 215, 0, 0.7))"
              : "drop-shadow(0 0 60px rgba(102, 126, 234, 0.9)) drop-shadow(0 0 30px rgba(244, 143, 177, 0.7))",
            animation: "pulse 0.3s ease-out",
          }}
        />
        <div
          className={cn(
            "absolute inset-0 transition-all duration-300 pointer-events-none",
            showStart ? "opacity-100" : "opacity-70",
          )}
          style={{
            background: showStart
              ? "radial-gradient(circle at center, rgba(255,255,255,0.3) 0%, transparent 70%)"
              : "radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%)",
            mixBlendMode: "overlay",
            filter: "blur(10px)",
          }}
        />
      </div>
    </div>
  );
};

export default GameCountdown;
