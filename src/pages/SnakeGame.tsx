import React, { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, RotateCcw, Trophy, Target, ArrowLeft } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";

const GRID_SIZE = 20;
const CELL_SIZE_PERCENT = 100 / GRID_SIZE;

const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 0, y: -1 };
const FALLBACK_WORDS = ["YAZICI", "KLAVYE", "EKRANI", "SİSTEM", "PİYASA", "MEYDAN", "KARTAL", "SİNCAP"];

// --- ÖZEL HOOK: useInterval ---
// Bu hook, React state'i değişse bile sayacı sıfırlamaz.
// Dan Abramov'un meşhur useInterval pattern'i.
// --- ÖZEL HOOK: useInterval (DÜZELTİLMİŞ) ---
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef<() => void>();

  // Son callback'i hatırla.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Interval'ı kur.
  useEffect(() => {
    function tick() {
      // Düzeltme burada: "?.()" ekleyerek sadece doluysa çalıştır diyoruz.
      savedCallback.current?.();
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

const SnakeGame = () => {
  const { playSound: playButtonSound } = useSounds();
  const { requestExit, ExitConfirmDialog } = useExitGameConfirm();

  const doNavigate = () => {
    playButtonSound("buttonClick");
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  };
  // navigate tanımı, gameRunning/gameOver state'lerinden sonra aşağıda yapılıyor.

  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [wordList, setWordList] = useState<string[]>([]);
  const [targetWord, setTargetWord] = useState("");
  const [targetLetterIdx, setTargetLetterIdx] = useState(0);
  const [food, setFood] = useState({ x: 5, y: 5, letter: "" });

  // Yönü ref ile tutuyoruz, state ile değil. Bu sayede render tetiklemez.
  const directionRef = useRef(INITIAL_DIRECTION);

  const [gameRunning, setGameRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const navigate = () => requestExit(doNavigate, !gameRunning || gameOver);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [speed, setSpeed] = useState(200);
  const [highScore, setHighScore] = useState(0);

  const gameAreaRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);

  // --- Kelime Listesi ---
  useEffect(() => {
    fetch("/wordlist.txt")
      .then((res) => {
        if (!res.ok) throw new Error("Dosya bulunamadı");
        return res.text();
      })
      .then((text) => {
        const words = text
          .split("\n")
          .map((w) => w.trim().toUpperCase())
          // BURAYI DÜZELTİYORUZ: Sadece 6 harfli olanları al
          .filter((w) => w.length === 6);

        if (words.length > 0) {
          setWordList(words);
          const randomWord = words[Math.floor(Math.random() * words.length)];
          setTargetWord(randomWord);
          setFood((prev) => ({ ...prev, letter: randomWord[0] }));
        } else {
          // Eğer 6 harfli hiç kelime bulamazsa yedeğe dön
          setWordList(FALLBACK_WORDS);
          setTargetWord(FALLBACK_WORDS[0]);
          setFood((prev) => ({ ...prev, letter: FALLBACK_WORDS[0][0] }));
        }
      })
      .catch(() => {
        setWordList(FALLBACK_WORDS);
        const startWord = FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
        setTargetWord(startWord);
        setFood((prev) => ({ ...prev, letter: startWord[0] }));
      });
  }, []);

  // --- Audio ---
  useEffect(() => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return () => {
      // Cleanup gerekmiyor, audio context kalabilir
    };
  }, []);

  useEffect(() => {
    const savedScore = Number(sessionStorage.getItem("snakeHighScore")) || 0;
    setHighScore(savedScore);
  }, []);

  const playSound = useCallback((frequency: number, duration = 100, type: OscillatorType = "sine") => {
    if (!audioContextRef.current) return;
    try {
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = type;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration / 1000);
    } catch (e) {
      console.log(e);
    }
  }, []);

  const changeDirection = useCallback(
    (newDirection) => {
      const prev = directionRef.current;
      // Geriye dönüşü engelle (Sağa giderken sola dönemezsin)
      if (prev.x + newDirection.x === 0 && prev.y + newDirection.y === 0) return;
      directionRef.current = newDirection;
      if (!gameRunning && !gameOver) setGameRunning(true);
    },
    [gameRunning, gameOver],
  );

  const generateFood = useCallback((currentSnake, specificLetter) => {
    let newFood;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
        letter: specificLetter,
      };
    } while (currentSnake.some((segment) => segment.x === newFood.x && segment.y === newFood.y));
    return newFood;
  }, []);

  // --- OYUN MANTIĞI (Tek Fonksiyon) ---
  // Bu fonksiyon artık useEffect içinde değil, useInterval içinde çağrılacak.
  const gameStep = () => {
    if (gameOver || !gameRunning) return;

    setSnake((prevSnake) => {
      const newSnake = [...prevSnake];
      const head = { ...newSnake[0] };

      head.x += directionRef.current.x;
      head.y += directionRef.current.y;

      // Duvarlardan geçiş
      if (head.x < 0) head.x = GRID_SIZE - 1;
      if (head.x >= GRID_SIZE) head.x = 0;
      if (head.y < 0) head.y = GRID_SIZE - 1;
      if (head.y >= GRID_SIZE) head.y = 0;

      // Kendine çarptı mı? (Hareket etmeden önceki kuyruk hariç kontrol et)
      // Not: pop() yapılmadan kontrol edersek kuyruğa çarpabiliriz, o yüzden önce yemeği kontrol edelim.

      // Yeme Kontrolü (Henüz kuyruk silinmedi)
      const ateFood = head.x === food.x && head.y === food.y;

      // Yeni kafa kendine çarpıyor mu?
      // Dikkat: Kuyruk son elemanı hareket edeceği için çarpışma kontrolüne dahil edilmemeli,
      // ama eğer yemek yendiyse kuyruk uzayacağı için dahil edilmeli.
      // Basit çözüm: Şimdilik çarpışmayı kontrol et, kuyruğu sonra sil.
      if (newSnake.some((segment) => segment.x === head.x && segment.y === head.y)) {
        setGameOver(true);
        setGameRunning(false);
        playSound(200, 500, "sawtooth");
        return prevSnake; // State değişmesin
      }

      newSnake.unshift(head);

      if (ateFood) {
        // Puan artışı
        const pointGain = 10 * level;
        const newScore = score + pointGain;
        setScore(newScore);
        playSound(600 + level * 50, 150, "sine");

        if (newScore > highScore) {
          setHighScore(newScore);
          sessionStorage.setItem("snakeHighScore", newScore.toString());
        }

        const nextIdx = targetLetterIdx + 1;
        if (nextIdx >= targetWord.length) {
          // Kelime tamamlandı
          playSound(800, 300, "square");
          setLevel((prev) => prev + 1);
          setSpeed((prev) => Math.max(80, prev - 10)); // Hızlanma
          const newWord = wordList[Math.floor(Math.random() * wordList.length)];
          setTargetWord(newWord);
          setTargetLetterIdx(0);
          setFood(generateFood(newSnake, newWord[0]));
        } else {
          // Sonraki harf
          setTargetLetterIdx(nextIdx);
          setFood(generateFood(newSnake, targetWord[nextIdx]));
        }
      } else {
        // Yemek yenmedi, kuyruğu sil
        newSnake.pop();
      }

      return newSnake;
    });
  };

  // --- KRİTİK DEĞİŞİKLİK: useInterval Kullanımı ---
  // setInterval yerine bu hook'u kullanıyoruz.
  // gameRunning true ise 'speed' kadar sürede çalışır.
  // gameRunning false ise (null) çalışmaz.
  useInterval(gameStep, gameRunning && !gameOver ? speed : null);

  // Klavye Kontrolü
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (gameOver) return;
      switch (e.key) {
        case "ArrowUp":
          changeDirection({ x: 0, y: -1 });
          break;
        case "ArrowDown":
          changeDirection({ x: 0, y: 1 });
          break;
        case "ArrowLeft":
          changeDirection({ x: -1, y: 0 });
          break;
        case "ArrowRight":
          changeDirection({ x: 1, y: 0 });
          break;
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [gameOver, changeDirection]);

  // Touch Kontrolü
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e) => {
    if (gameOver) return;
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 30) return; // Çok kısa kaydırma

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      deltaX > 0 ? changeDirection({ x: 1, y: 0 }) : changeDirection({ x: -1, y: 0 });
    } else {
      deltaY > 0 ? changeDirection({ x: 0, y: 1 }) : changeDirection({ x: 0, y: -1 });
    }
  };

  const startGame = () => {
    setGameRunning(true);
    setGameOver(false);
  };
  const pauseGame = () => {
    setGameRunning(false);
  };
  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    const randomWord = wordList.length > 0 ? wordList[Math.floor(Math.random() * wordList.length)] : "SNAKE";
    setTargetWord(randomWord);
    setTargetLetterIdx(0);
    setFood({ x: 5, y: 5, letter: randomWord[0] });
    directionRef.current = INITIAL_DIRECTION;
    setGameRunning(false);
    setGameOver(false);
    setScore(0);
    setLevel(1);
    setSpeed(200);
  };

  const getLevelColor = () => {
    const colors = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444"];
    return colors[(level - 1) % colors.length];
  };

  // Dinamik Harf Boyutu
  const calculateLetterSize = () => {
    const maxLength = targetWord.length;
    if (maxLength <= 5) return { size: "40px", fontSize: "20px" };
    if (maxLength <= 8) return { size: "32px", fontSize: "16px" };
    if (maxLength <= 12) return { size: "24px", fontSize: "12px" };
    return { size: "18px", fontSize: "10px" };
  };

  const letterStyle = calculateLetterSize();

  const directionBtnStyle = (disabled) => ({
    width: "50px",
    height: "50px",
    borderRadius: "12px",
    background: "linear-gradient(45deg, #667eea, #764ba2)",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    color: "white",
    fontSize: "20px",
    cursor: !disabled ? "pointer" : "not-allowed",
    opacity: disabled ? 0.5 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    touchAction: "manipulation",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overscrollBehavior: "none",
      }}
    >
      <div
        style={{
          background: "rgba(255, 255, 255, 0.1)",
          borderRadius: "24px",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          padding: "24px",
          maxWidth: "448px",
          width: "100%",
        }}
      >
        {/* Geri Dön */}
        <div style={{ marginBottom: "16px" }}>
          <button
            onClick={() => navigate()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "rgba(255, 255, 255, 0.8)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            <ArrowLeft size={20} /> Geri Dön
          </button>
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <h1 style={{ fontSize: "20px", fontWeight: "bold", color: "white", marginBottom: "8px" }}>
            🐍 Kelime Yılanı 🐍
          </h1>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "14px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                color: "#FFD700",
                background: "rgba(255, 215, 0, 0.1)",
                padding: "6px 10px",
                borderRadius: "12px",
              }}
            >
              <Trophy size={16} /> <span>{highScore}</span>
            </div>
            <div
              style={{
                padding: "4px 12px",
                borderRadius: "99px",
                color: "white",
                fontWeight: "bold",
                backgroundColor: getLevelColor(),
              }}
            >
              Seviye {level}
            </div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                color: "#60A5FA",
                background: "rgba(96, 165, 250, 0.1)",
                padding: "6px 10px",
                borderRadius: "12px",
              }}
            >
              <Target size={16} /> <span>{score}</span>
            </div>
          </div>

          {/* Kelime Göstergesi */}
          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              padding: "12px",
              borderRadius: "12px",
              marginBottom: "12px",
              border: `1px solid ${getLevelColor()}40`,
            }}
          >
            <p style={{ color: "#aaa", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase" }}>
              Hedef Kelime
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "4px",
                flexWrap: "nowrap",
                overflowX: "auto",
                paddingBottom: "4px",
              }}
            >
              {targetWord.split("").map((letter, index) => (
                <span
                  key={index}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: letterStyle.size,
                    height: letterStyle.size,
                    minWidth: letterStyle.size,
                    fontSize: letterStyle.fontSize,
                    borderRadius: "6px",
                    fontWeight: "bold",
                    backgroundColor:
                      index < targetLetterIdx
                        ? "#10b981"
                        : index === targetLetterIdx
                          ? "#f59e0b"
                          : "rgba(255,255,255,0.1)",
                    color:
                      index < targetLetterIdx ? "white" : index === targetLetterIdx ? "white" : "rgba(255,255,255,0.4)",
                    border: index === targetLetterIdx ? "2px solid white" : "none",
                    boxShadow: index === targetLetterIdx ? "0 0 10px #f59e0b" : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Oyun Alanı */}
        <div
          ref={gameAreaRef}
          style={{
            position: "relative",
            background: "rgba(0, 0, 0, 0.3)",
            borderRadius: "12px",
            border: "4px solid rgba(255, 255, 255, 0.2)",
            margin: "0 auto",
            width: "100%",
            maxWidth: "400px",
            aspectRatio: "1/1",
            overflow: "hidden",
            touchAction: "none",
            boxSizing: "border-box",
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {snake.map((segment, index) => (
            <div
              key={index}
              style={{
                position: "absolute",
                left: `${segment.x * CELL_SIZE_PERCENT}%`,
                top: `${segment.y * CELL_SIZE_PERCENT}%`,
                width: `${CELL_SIZE_PERCENT}%`,
                height: `${CELL_SIZE_PERCENT}%`,
                borderRadius: index === 0 ? "50%" : "2px",
                background: index === 0 ? "white" : getLevelColor(),
                boxShadow: index === 0 ? "0 0 10px white" : "none",
                zIndex: 2,
                // DİKKAT: transition kaldırıldı. Yılan "snap" (anlık) hareket edecek, bu çok daha akıcı hissettirir.
              }}
            />
          ))}

          <div
            style={{
              position: "absolute",
              left: `${food.x * CELL_SIZE_PERCENT}%`,
              top: `${food.y * CELL_SIZE_PERCENT}%`,
              width: `${CELL_SIZE_PERCENT}%`,
              height: `${CELL_SIZE_PERCENT}%`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: "bold",
              color: "#fff",
              textShadow: "0 0 5px black",
              animation: "bounce 1s infinite",
              zIndex: 1,
            }}
          >
            {food.letter}
          </div>

          {gameOver && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0, 0, 0, 0.8)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                zIndex: 10,
              }}
            >
              <h2 style={{ fontSize: "24px", marginBottom: "8px" }}>💥 Oyun Bitti!</h2>
              <p>Tamamlanan Kelime: {targetWord}</p>
              <p style={{ marginTop: "4px" }}>Toplam Skor: {score}</p>
            </div>
          )}
        </div>

        {/* Yön Kontrolleri */}
        <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => {
              if (directionRef.current.y === 0) changeDirection({ x: 0, y: -1 });
            }}
            disabled={gameOver}
            style={directionBtnStyle(gameOver)}
          >
            ⬆️
          </button>
          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <button
              onClick={() => {
                if (directionRef.current.x === 0) changeDirection({ x: -1, y: 0 });
              }}
              disabled={gameOver}
              style={directionBtnStyle(gameOver)}
            >
              ⬅️
            </button>
            <button
              onClick={() => {
                if (directionRef.current.y === 0) changeDirection({ x: 0, y: 1 });
              }}
              disabled={gameOver}
              style={directionBtnStyle(gameOver)}
            >
              ⬇️
            </button>
            <button
              onClick={() => {
                if (directionRef.current.x === 0) changeDirection({ x: 1, y: 0 });
              }}
              disabled={gameOver}
              style={directionBtnStyle(gameOver)}
            >
              ➡️
            </button>
          </div>
        </div>

        {/* Alt Butonlar */}
        <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", gap: "16px" }}>
          {!gameRunning && !gameOver && (
            <button onClick={startGame} style={btnStyle("#10b981")}>
              <Play size={20} /> Başla
            </button>
          )}
          {gameRunning && !gameOver && (
            <button onClick={pauseGame} style={btnStyle("#f59e0b")}>
              <Pause size={20} /> Duraklat
            </button>
          )}
          <button onClick={resetGame} style={btnStyle("#ef4444")}>
            <RotateCcw size={20} /> Yeniden
          </button>
        </div>
      </div>
      <style>{`@keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.3); } }`}</style>
      {ExitConfirmDialog}
    </div>
  );
};

const btnStyle = (color) => ({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: color,
  color: "white",
  padding: "10px 20px",
  borderRadius: "10px",
  border: "none",
  cursor: "pointer",
  fontWeight: "bold",
});

export default SnakeGame;
