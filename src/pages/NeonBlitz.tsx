import React, { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Play, RefreshCw, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

// --- TİP TANIMLAMALARI ---
type GameState = "MENU" | "PLAYING" | "GAMEOVER";

interface Tile {
  id: number;
}

// --- SABİTLER ---
const GRID_SIZE = 9; // 3x3 Grid
const INITIAL_TIME = 2000; // Milisaniye cinsinden başlangıç süresi
const LEVEL_THRESHOLD = 5; // Her 5 puanda bir level atla

const App: React.FC = () => {
  // --- STATE YÖNETİMİ ---
  const [gameState, setGameState] = useState<GameState>("MENU");
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(100); // Yüzdelik bar için
  const [themeColor, setThemeColor] = useState<string>("hsl(180, 100%, 50%)"); // Başlangıç rengi (Cyan)

  // Zamanlayıcı referansları
  const timerRef = useRef<number | null>(null);
  const progressRef = useRef<number | null>(null);
  const maxTimeRef = useRef<number>(INITIAL_TIME);
  const startTimeRef = useRef<number>(0);

  // --- YARDIMCI FONKSİYONLAR ---

  // Rastgele canlı bir renk üretir
  const generateRandomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 100%, 60%)`;
  };

  // Yeni bir hedef kutucuk seçer (bir öncekiyle aynı olamaz)
  const pickNewTile = useCallback((current: number | null) => {
    let newTile;
    do {
      newTile = Math.floor(Math.random() * GRID_SIZE);
    } while (newTile === current);
    return newTile;
  }, []);

  // --- OYUN MANTIĞI ---

  const startGame = () => {
    setScore(0);
    setLevel(1);
    maxTimeRef.current = INITIAL_TIME;
    setThemeColor(generateRandomColor());
    setGameState("PLAYING");
    nextTurn(true);
  };

  const stopGame = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) cancelAnimationFrame(progressRef.current);
    setGameState("GAMEOVER");
  };

  const returnHome = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) cancelAnimationFrame(progressRef.current);
    setGameState("MENU");
  };

  // Her turda çalışacak döngü
  const nextTurn = (isFirst: boolean = false) => {
    // Önceki zamanlayıcıları temizle
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) cancelAnimationFrame(progressRef.current);

    // Yeni hedef belirle
    const nextTile = pickNewTile(isFirst ? null : activeTile);
    setActiveTile(nextTile);

    // Zamanlayıcıyı başlat
    startTimeRef.current = Date.now();

    // Progress bar animasyonu loop'u
    const updateProgress = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      const remaining = Math.max(0, maxTimeRef.current - elapsed);
      const percentage = (remaining / maxTimeRef.current) * 100;

      setTimeLeft(percentage);

      if (remaining > 0) {
        progressRef.current = requestAnimationFrame(updateProgress);
      } else {
        stopGame(); // Süre bitti
      }
    };

    progressRef.current = requestAnimationFrame(updateProgress);
  };

  const handleTileClick = (id: number) => {
    if (gameState !== "PLAYING") return;

    if (id === activeTile) {
      // DOĞRU TIKLAMA
      const newScore = score + 1;
      setScore(newScore);

      // Level Kontrolü
      if (newScore % LEVEL_THRESHOLD === 0) {
        setLevel((prev) => prev + 1);
        setThemeColor(generateRandomColor()); // Level atlayınca renk değişsin
        // Süreyi kısalt (Zorlaştırma) - En az 400ms'ye kadar düşebilir
        maxTimeRef.current = Math.max(400, maxTimeRef.current * 0.92);
      }

      nextTurn();
    } else {
      // YANLIŞ TIKLAMA -> Oyun biter
      stopGame();
    }
  };

  // --- EKRAN BİLEŞENLERİ ---

  // 1. Ana Menü
  const renderMenu = () => (
    <div style={styles.centerContainer}>
      <h1 style={{ ...styles.title, textShadow: `0 0 20px ${themeColor}` }}>NEON REFLEKS</h1>
      <p style={styles.subtitle}>Hızını Test Et. Rengi Yakala.</p>
      <button
        onClick={startGame}
        style={{ ...styles.button, backgroundColor: themeColor, boxShadow: `0 0 15px ${themeColor}` }}
      >
        <Play size={24} style={{ marginRight: 8 }} /> OYNA
      </button>
    </div>
  );

  // 2. Oyun Ekranı
  const renderGame = () => (
    <div style={styles.gameContainer}>
      {/* Üst Bar */}
      <div style={styles.header}>
        <button onClick={returnHome} style={styles.iconButton}>
          <ArrowLeft size={28} color="#fff" />
        </button>
        <div style={styles.scoreBoard}>
          <div style={{ color: themeColor }}>LVL {level}</div>
          <div>SKOR: {score}</div>
        </div>
      </div>

      {/* Süre Çubuğu */}
      <div style={styles.progressContainer}>
        <div
          style={{
            ...styles.progressBar,
            width: `${timeLeft}%`,
            backgroundColor: themeColor,
            boxShadow: `0 0 10px ${themeColor}`,
          }}
        />
      </div>

      {/* Oyun Alanı Grid */}
      <div style={styles.grid}>
        {Array.from({ length: GRID_SIZE }).map((_, index) => (
          <button
            key={index}
            onClick={() => handleTileClick(index)}
            style={{
              ...styles.tile,
              backgroundColor: index === activeTile ? themeColor : "rgba(255,255,255,0.05)",
              boxShadow: index === activeTile ? `0 0 30px ${themeColor}` : "none",
              transform: index === activeTile ? "scale(1.05)" : "scale(1)",
              borderColor: index === activeTile ? "#fff" : "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>
    </div>
  );

  // 3. Game Over Ekranı
  const renderGameOver = () => (
    <div style={styles.centerContainer}>
      <Trophy size={64} color={themeColor} style={{ marginBottom: 20 }} />
      <h2 style={styles.gameOverTitle}>OYUN BİTTİ</h2>
      <div style={styles.finalScore}>Skorun: {score}</div>
      <div style={styles.finalLevel}>Ulaşılan Level: {level}</div>

      <div style={styles.buttonGroup}>
        <button onClick={startGame} style={{ ...styles.button, backgroundColor: themeColor, marginRight: 10 }}>
          <RefreshCw size={20} style={{ marginRight: 8 }} /> Tekrar Dene
        </button>
        <button onClick={returnHome} style={{ ...styles.outlineButton, borderColor: themeColor, color: themeColor }}>
          Ana Sayfa
        </button>
      </div>
    </div>
  );

  return (
    <div style={styles.appContainer}>
      {gameState === "MENU" && renderMenu()}
      {gameState === "PLAYING" && renderGame()}
      {gameState === "GAMEOVER" && renderGameOver()}
    </div>
  );
};

// --- STYLES (CSS-in-JS) ---
// Not: Normalde ayrı bir CSS dosyası önerilir ama kopyala-yapıştır kolaylığı için buraya ekledim.
const styles: { [key: string]: React.CSSProperties } = {
  appContainer: {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#0f0f13", // Çok koyu gri/siyah arka plan
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    overflow: "hidden",
    userSelect: "none",
  },
  centerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 20,
    animation: "fadeIn 0.5s ease",
  },
  gameContainer: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    maxWidth: "500px", // Mobilde tam ekran, masaüstünde limitli
  },
  header: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    paddingTop: "20px", // Safe area
  },
  scoreBoard: {
    fontSize: "1.2rem",
    fontWeight: "bold",
    textAlign: "right",
  },
  title: {
    fontSize: "3rem",
    fontWeight: "900",
    marginBottom: "10px",
    letterSpacing: "2px",
    color: "#fff",
  },
  subtitle: {
    fontSize: "1.2rem",
    color: "#aaa",
    marginBottom: "40px",
  },
  gameOverTitle: {
    fontSize: "2.5rem",
    fontWeight: "bold",
    marginBottom: "10px",
  },
  finalScore: {
    fontSize: "2rem",
    fontWeight: "bold",
    marginBottom: "5px",
  },
  finalLevel: {
    fontSize: "1rem",
    color: "#888",
    marginBottom: "30px",
  },
  button: {
    padding: "15px 40px",
    fontSize: "1.2rem",
    fontWeight: "bold",
    color: "#000",
    border: "none",
    borderRadius: "50px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    transition: "transform 0.1s",
  },
  outlineButton: {
    padding: "13px 30px",
    fontSize: "1rem",
    fontWeight: "bold",
    backgroundColor: "transparent",
    border: "2px solid",
    borderRadius: "50px",
    cursor: "pointer",
  },
  iconButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "10px",
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  buttonGroup: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  progressContainer: {
    width: "100%",
    height: "10px",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "10px",
    marginBottom: "30px",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    transition: "width 0.1s linear", // Akıcı azalma için
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "15px",
    width: "100%",
    aspectRatio: "1/1", // Kare kalmasını sağlar
  },
  tile: {
    borderRadius: "15px",
    border: "2px solid",
    cursor: "pointer",
    transition: "background-color 0.1s, transform 0.1s",
    outline: "none",
    // Dokunmatik cihazlar için tap highlight'ı kaldır
    WebkitTapHighlightColor: "transparent",
  },
};

export default App;
