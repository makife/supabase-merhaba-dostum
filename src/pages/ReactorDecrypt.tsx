import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Lock, Unlock, Timer } from "lucide-react";

// --- TİPLER ---
interface Particle {
  id: number;
  char: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  isTarget: boolean; // Sırada bu mu var? (Debug için değil, mantık için)
}

interface ReactorDecryptProps {
  word?: string; // Dışarıdan kelime gönderilebilir
  onComplete?: (success: boolean) => void; // Oyun bitince ne olacak?
  onClose?: () => void; // Kapatma butonu
}

const ReactorDecrypt: React.FC<ReactorDecryptProps> = ({ 
  word = "ÇEKİRDEK", 
  onComplete, 
  onClose 
}) => {
  // --- AYARLAR ---
  const GAME_WIDTH = 600;
  const GAME_HEIGHT = 400;
  const TIME_LIMIT = 15; // Saniye

  // --- STATE ---
  const [targetWord, setTargetWord] = useState(word.toUpperCase());
  const [foundIndex, setFoundIndex] = useState(0); // Kaçıncı harfteyiz
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [gameState, setGameState] = useState<"playing" | "won" | "lost">("playing");
  const [particles, setParticles] = useState<Particle[]>([]);
  const [shake, setShake] = useState(false); // Hata efekt

  // --- REF ---
  const reqRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- SES (Basit bip sesi) ---
  const playTone = (freq: number, type: "sine" | "square" | "sawtooth", duration: number) => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  };

  // --- BAŞLANGIÇ ---
  useEffect(() => {
    // Harfleri parçacık olarak oluştur
    const chars = targetWord.split("");
    // Biraz kafa karıştırmak için rastgele 3-4 harf daha ekleyelim
    const decoChars = ["X", "Q", "W", "Z", "1", "0"];
    const allChars = [...chars, ...decoChars.slice(0, 3)].sort(() => Math.random() - 0.5);

    const newParticles: Particle[] = allChars.map((char, i) => ({
      id: i,
      char,
      x: Math.random() * (GAME_WIDTH - 60) + 30,
      y: Math.random() * (GAME_HEIGHT - 60) + 30,
      vx: (Math.random() - 0.5) * 3, // Rastgele hız
      vy: (Math.random() - 0.5) * 3,
      size: 40 + Math.random() * 10,
      isTarget: false
    }));

    particlesRef.current = newParticles;
    setParticles(newParticles);
    
    // Oyun Döngüsünü Başlat
    reqRef.current = requestAnimationFrame(gameLoop);

    // Zaman Sayacı
    const timer = setInterval(() => {
      if (gameState === "playing") {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleGameOver(false);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      clearInterval(timer);
    };
  }, []); // Sadece mount olduğunda çalış

  // --- OYUN SONU ---
  const handleGameOver = (success: boolean) => {
    setGameState(success ? "won" : "lost");
    if (reqRef.current) cancelAnimationFrame(reqRef.current);
    if (success) playTone(880, "square", 0.5);
    else playTone(150, "sawtooth", 0.8);

    // 2 saniye sonra callback çağır
    setTimeout(() => {
      if (onComplete) onComplete(success);
    }, 2000);
  };

  // --- FİZİK MOTORU ---
  const gameLoop = () => {
    if (gameState !== "playing") return;

    particlesRef.current = particlesRef.current.map(p => {
      let { x, y, vx, vy } = p;

      x += vx;
      y += vy;

      // Duvarlardan sekme
      if (x <= 0 || x >= GAME_WIDTH - p.size) vx *= -1;
      if (y <= 0 || y >= GAME_HEIGHT - p.size) vy *= -1;

      return { ...p, x, y, vx, vy };
    });

    setParticles([...particlesRef.current]);
    reqRef.current = requestAnimationFrame(gameLoop);
  };

  // --- TIKLAMA MANTIĞI ---
  const handleParticleClick = (p: Particle) => {
    if (gameState !== "playing") return;

    const neededChar = targetWord[foundIndex];

    if (p.char === neededChar) {
      // DOĞRU HARF
      playTone(600 + (foundIndex * 100), "sine", 0.1);
      
      // O harfi parçacık listesinden kaldır (veya görünmez yap)
      const newParticles = particlesRef.current.filter(particle => particle.id !== p.id);
      particlesRef.current = newParticles;
      setParticles(newParticles);

      const nextIndex = foundIndex + 1;
      setFoundIndex(nextIndex);

      if (nextIndex === targetWord.length) {
        handleGameOver(true);
      }
    } else {
      // YANLIŞ HARF
      playTone(150, "sawtooth", 0.3);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setTimeLeft(prev => Math.max(0, prev - 2)); // 2 saniye ceza!
    }
  };

  // --- RENDER ---
  return (
    <div className="mini-game-overlay">
      <div className={`mini-game-container ${shake ? "shake" : ""}`}>
        
        {/* HEADER */}
        <div className="mg-header">
          <div className="mg-title">
             <Lock size={18} /> ŞİFRE ÇÖZÜCÜ
          </div>
          <div className={`mg-timer ${timeLeft < 5 ? "danger" : ""}`}>
            <Timer size={18} /> {timeLeft}s
          </div>
          {onClose && (
            <button onClick={onClose} className="mg-close-btn">
              <X size={20} />
            </button>
          )}
        </div>

        {/* OYUN ALANI */}
        <div className="mg-stage" style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
          
          {/* Parçacıklar */}
          {particles.map((p) => (
            <div
              key={p.id}
              className="mg-particle"
              onPointerDown={(e) => {
                e.stopPropagation(); // Arkaya tıklamayı engelle
                handleParticleClick(p);
              }}
              style={{
                left: p.x,
                top: p.y,
                width: p.size,
                height: p.size,
                fontSize: p.size * 0.6,
                borderColor: targetWord[foundIndex] === p.char ? "#00ff00" : "#444" // İpucu (isteğe bağlı kapatılabilir)
              }}
            >
              {p.char}
            </div>
          ))}

          {/* Hedef Kelime Göstergesi (Alt Bar) */}
          <div className="mg-word-display">
            {targetWord.split("").map((char, i) => (
              <div 
                key={i} 
                className={`mg-char-slot ${i < foundIndex ? "found" : ""} ${i === foundIndex ? "active" : ""}`}
              >
                {i < foundIndex ? char : (i === foundIndex ? "?" : "_")}
              </div>
            ))}
          </div>

          {/* Sonuç Ekranı */}
          {gameState !== "playing" && (
            <div className="mg-result-overlay">
              <div className={`mg-result-card ${gameState}`}>
                {gameState === "won" ? (
                  <>
                    <Unlock size={48} />
                    <h3>Erişim Sağlandı!</h3>
                  </>
                ) : (
                  <>
                    <Lock size={48} />
                    <h3>Süre Doldu!</h3>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        .mini-game-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(5px);
          display: flex; align-items: center; justify-content: center;
          z-index: 100;
        }
        .mini-game-container {
          background: #111;
          border: 2px solid #333;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 0 40px rgba(0, 255, 255, 0.2);
          width: 100%; max-width: 620px;
        }
        .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }

        .mg-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 20px;
          background: #222; border-bottom: 1px solid #333;
          color: #fff;
        }
        .mg-title { display: flex; gap: 8px; align-items: center; font-weight: bold; color: #00ffff; }
        .mg-timer { 
            font-family: monospace; font-size: 20px; color: #00ff00; 
            display: flex; align-items: center; gap: 5px; 
        }
        .mg-timer.danger { color: #ff0000; animation: pulse 0.5s infinite; }
        
        .mg-close-btn {
            background: none; border: none; color: #666; cursor: pointer;
        }
        .mg-close-btn:hover { color: #fff; }

        .mg-stage {
          position: relative;
          background: radial-gradient(circle at center, #1a1a2e 0%, #000 100%);
          overflow: hidden;
          margin: 0 auto;
        }

        .mg-particle {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: 2px solid #444;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-weight: bold;
          cursor: pointer;
          user-select: none;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
          transition: transform 0.1s, border-color 0.2s;
        }
        .mg-particle:active { transform: scale(0.9); background: rgba(255,255,255,0.2); }

        .mg-word-display {
          position: absolute; bottom: 20px; left: 0; width: 100%;
          display: flex; justify-content: center; gap: 10px;
          pointer-events: none;
        }
        
        .mg-char-slot {
          width: 40px; height: 50px;
          border-bottom: 3px solid #444;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; font-weight: bold; color: #666;
          font-family: monospace;
        }
        .mg-char-slot.found { color: #00ff00; border-color: #00ff00; text-shadow: 0 0 10px #00ff00; }
        .mg-char-slot.active { border-color: #00ffff; color: #00ffff; animation: blink 1s infinite; }

        .mg-result-overlay {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 20;
        }
        .mg-result-card {
            background: #222; color: #fff; padding: 30px; border-radius: 20px;
            display: flex; flex-direction: column; align-items: center; gap: 10px;
            border: 2px solid #444;
        }
        .mg-result-card.won { border-color: #00ff00; color: #00ff00; box-shadow: 0 0 30px rgba(0,255,0,0.3); }
        .mg-result-card.lost { border-color: #ff0000; color: #ff0000; box-shadow: 0 0 30px rgba(255,0,0,0.3); }

        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
        @keyframes blink { 0% { border-color: #444; } 50% { border-color: #00ffff; } 100% { border-color: #444; } }
      `}</style>
    </div>
  );
};

export default ReactorDecrypt;
            
