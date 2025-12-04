import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface GameCountdownProps {
  onComplete: (finishTime?: number) => void; // Bitiş zamanını parent'a bildir
  className?: string;
  serverStartTime?: string | null;
  serverTimeOffset?: number;
}

const GameCountdown = ({ onComplete, className, serverStartTime, serverTimeOffset = 0 }: GameCountdownProps) => {
  const [count, setCount] = useState(5);
  const [isVisible, setIsVisible] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedCountRef = useRef<number>(-1);
  const hasPlayedStartRef = useRef<boolean>(false);

  // Bu Ref'ler döngüyü kırmadan durumu yönetmemizi sağlar
  const hasCompletedRef = useRef<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // === PRELOAD & SETUP ===
  useEffect(() => {
    isMountedRef.current = true;

    countdownAudioRef.current = new Audio("/gerisayim.mp3");
    startAudioRef.current = new Audio("/basla.mp3");

    [countdownAudioRef.current, startAudioRef.current].forEach((a) => {
      if (a) {
        a.preload = "auto";
        a.volume = 0.7;
        a.load();
      }
    });

    const images = ["/bir.png", "/iki.png", "/uc.png", "/dort.png", "/bes.png", "/basla.png"];
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const ensureAudioUnlocked = useCallback(() => {
    try {
      const unlock = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
      unlock.volume = 0.0;
      unlock.play().catch(() => {});
    } catch (e) {}
  }, []);

  // === SERVER TIME COUNTDOWN LOGIC ===
  useEffect(() => {
    if (!serverStartTime) return;

    // Geçersiz tarih koruması
    const startTimeMs = new Date(serverStartTime).getTime();
    if (isNaN(startTimeMs)) {
      console.error("GameCountdown: Geçersiz tarih", serverStartTime);
      onComplete(Date.now());
      return;
    }

    console.log("🎯 Countdown Başlatılıyor. Hedef:", serverStartTime);
    ensureAudioUnlocked();
    setIsVisible(true);

    const checkTime = () => {
      if (!isMountedRef.current) return;
      if (hasCompletedRef.current) return;

      const now = Date.now() + serverTimeOffset;
      const elapsedSeconds = (now - startTimeMs) / 1000;

      // 5 saniyeden geriye say
      const remaining = 5 - elapsedSeconds;
      const displayCount = Math.max(0, Math.ceil(remaining));

      // 1. DURUM: Geç kalınmış (7 saniyeden fazla geçmiş)
      // Bu durumda animasyonu bekleme, direkt oyunu başlat.
      if (elapsedSeconds > 7) {
        console.log("⚠️ Countdown süresi çoktan dolmuş, direkt başlatılıyor.");
        completeCountdown();
        return;
      }

      // 2. DURUM: Geri sayım devam ediyor
      if (displayCount > 0) {
        setCount((prev) => {
          if (prev !== displayCount) {
            if (countdownAudioRef.current && lastPlayedCountRef.current !== displayCount) {
              countdownAudioRef.current.currentTime = 0;
              countdownAudioRef.current.play().catch(() => {});
              lastPlayedCountRef.current = displayCount;
            }
            setAnimKey((k) => k + 1);
          }
          return displayCount;
        });
      }
      // 3. DURUM: Süre bitti, BAŞLA göster
      else if (displayCount <= 0 && !hasPlayedStartRef.current) {
        console.log("✅ Geri sayım bitti -> BAŞLA");
        hasPlayedStartRef.current = true;
        setCount(0);
        setShowStart(true);
        setAnimKey((k) => k + 1);

        if (startAudioRef.current) {
          startAudioRef.current.currentTime = 0;
          startAudioRef.current.play().catch(() => {});
        }

        // "BAŞLA" yazısını 800ms gösterip bitir
        setTimeout(() => {
          if (isMountedRef.current) completeCountdown();
        }, 800);
      }
    };

    // Tekrar eden timer'ı temizle ve başlat
    if (intervalRef.current) clearInterval(intervalRef.current);
    checkTime(); // İlk kontrol
    intervalRef.current = setInterval(checkTime, 100);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // Dependency Array'e dikkat: 'count' veya 'hasStarted' buraya koyulmamalı!
  }, [serverStartTime, serverTimeOffset, onComplete, ensureAudioUnlocked]);

  const completeCountdown = () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;

    setIsVisible(false);
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Oyunun başlangıç zamanı olarak ŞU ANI gönder
    // Bu sayede 1:45 sorunu çözülür
    onComplete(Date.now());
  };

  if (!isVisible && !hasCompletedRef.current) return null;
  // Animasyon bittikten sonra null dön
  if (hasCompletedRef.current && !isVisible) return null;

  const getImageForCount = (num: number): string => {
    const map: Record<number, string> = {
      1: "/bir.png",
      2: "/iki.png",
      3: "/uc.png",
      4: "/dort.png",
      5: "/bes.png",
    };
    return map[num] || "/bes.png";
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
            showStart ? "scale-110" : "scale-100",
          )}
          style={{
            filter: showStart
              ? "drop-shadow(0 0 60px rgba(255, 107, 107, 0.9))"
              : "drop-shadow(0 0 60px rgba(102, 126, 234, 0.9))",
            animation: "pulse 0.3s ease-out",
          }}
        />
      </div>
    </div>
  );
};

export default GameCountdown;
