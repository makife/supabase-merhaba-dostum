import React, { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, RefreshCw, Trophy, LogOut } from "lucide-react";

// --- TİP TANIMLAMALARI ---
type GameState = "MENU" | "PLAYING" | "GAMEOVER";

// --- SABİTLER ---
const GRID_SIZE = 9;
const INITIAL_TIME = 2000;
const LEVEL_THRESHOLD = 5;

const NeonBlitz: React.FC = () => {
  const navigate = useNavigate();

  // --- STATE YÖNETİMİ ---
  const [gameState, setGameState] = useState<GameState>("MENU");
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(100);
  const [themeColor, setThemeColor] = useState<string>("hsl(180, 100%, 50%)");

  const timerRef = useRef<number | null>(null);
  const progressRef = useRef<number | null>(null);
  const maxTimeRef = useRef<number>(INITIAL_TIME);
  const startTimeRef = useRef<number>(0);

  // --- YARDIMCI FONKSİYONLAR ---
  const generateRandomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 100%, 60%)`;
  };

  const pickNewTile = useCallback((current: number | null) => {
    let newTile;
    do {
      newTile = Math.floor(Math.random() * GRID_SIZE);
    } while (newTile === current);
    return newTile;
  }, []);

  // --- OYUN MANTIĞI & NAVİGASYON ---

  // 1. Oyunu Başlat
  const startGame = () => {
    setScore(0);
    setLevel(1);
    maxTimeRef.current = INITIAL_TIME;
    setThemeColor(generateRandomColor());
    setGameState("PLAYING");
    nextTurn(true);
  };

  // 2. Oyunu Durdur (Game Over)
  const stopGame = () => {
    clearTimers();
    setGameState("GAMEOVER");
  };

  // 3. Oyunun Ana Menüsüne Dön (Oyun içindeki sol üst tuş için)
  const returnToGameMenu = () => {
    clearTimers();
    setGameState("MENU");
  };

  // 4. Uygulamanın Ana Sayfasına Çık (Menüdeki çıkış tuşu için)
  const exitToAppHome = () => {
    clearTimers();
    navigate("/");
  };

  // Timer temizleme yardımcısı
  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) cancelAnimationFrame(progressRef.current);
  };

  const nextTurn = (isFirst: boolean = false) => {
    clearTimers();

    const nextTile = pickNewTile(isFirst ? null : activeTile);
    setActiveTile(nextTile);

    startTimeRef.current = Date.now();

    const updateProgress = () => {
      const now = Date.now();
      const elapsed = now - startTimeRef.current;
      const remaining = Math.max(0, maxTimeRef.current - elapsed);
      const percentage = (remaining / maxTimeRef.current) * 100;

      setTimeLeft(percentage);

      if (remaining > 0) {
        progressRef.current = requestAnimationFrame(updateProgress);
      } else {
        stopGame();
      }
    };

    progressRef.current = requestAnimationFrame(updateProgress);
  };

  const handleTileClick = (id: number) => {
    if (gameState !== "PLAYING") return;

    if (id === activeTile) {
      const newScore = score + 1;
      setScore(newScore);

      if (newScore % LEVEL_THRESHOLD === 0) {
        setLevel((prev) => prev + 1);
        setThemeColor(generateRandomColor());
        maxTimeRef.current = Math.max(400, maxTimeRef.current * 0.89);
      }

      nextTurn();
    } else {
      stopGame();
    }
  };

  // --- EKRAN BİLEŞENLERİ ---

  // 1. GİRİŞ EKRANI (MENU)
  const renderMenu = () => (
    <div style={styles.centerContainer}>
      <h1 style={{ ...styles.title, textShadow: `0 0 20px ${themeColor}` }}>DOKUNSANA</h1>
      <p style={styles.subtitle}>Hızını Test Et. Rengi Yakala.</p>

      {/* Oyna Butonu */}
      <button
        onClick={startGame}
        style={{ ...styles.button, backgroundColor: themeColor, boxShadow: `0 0 15px ${themeColor}`, marginBottom: 20 }}
      >
        <Play size={24} style={{ marginRight: 8 }} /> OYNA
      </button>

      {/* Oyundan Çıkış Butonu (App Ana Sayfasına Gider) */}
      <button onClick={exitToAppHome} style={{ ...styles.outlineButton, borderColor: "#fff", color: "#fff" }}>
        <LogOut size={20} style={{ marginRight: 8 }} /> Oyundan Çık
      </button>
    </div>
  );

  // 2. OYUN EKRANI (PLAYING)
  const renderGame = () => (
    <div style={styles.gameContainer}>
      <div style={styles.header}>
        {/* Sol üst geri tuşu: Sadece MENÜYE döner */}
        <button onClick={returnToGameMenu} style={styles.iconButton}>
          <ArrowLeft size={28} color="#fff" />
        </button>
        <div style={styles.scoreBoard}>
          <div style={{ color: themeColor }}>LVL {level}</div>
          <div>SKOR: {score}</div>
        </div>
      </div>

      {/* Süre Çubuğu (Daha belirgin hale getirildi) */}
      <div style={styles.progressContainer}>
        <div
          style={{
            ...styles.progressBar,
            width: `${timeLeft}%`,
            backgroundColor: themeColor,
            boxShadow: `0 0 15px ${themeColor}`,
          }}
        />
      </div>

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

  // 3. OYUN BİTTİ (GAMEOVER)
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

        {/* Menüye dönme butonu */}
        <button
          onClick={returnToGameMenu}
          style={{ ...styles.outlineButton, borderColor: themeColor, color: themeColor }}
        >
          Menüye Dön
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

const styles: { [key: string]: React.CSSProperties } = {
  appContainer: {
    width: "100%",
    height: "100vh",
    backgroundColor: "#0f0f13",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    overflow: "hidden",
    userSelect: "none",
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 50,
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
    maxWidth: "500px",
  },
  header: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    paddingTop: "20px",
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
    display: "flex",
    alignItems: "center",
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
  // SÜRE ÇUBUĞU GÖRÜNÜRLÜĞÜ GÜNCELLENDİ
  progressContainer: {
    width: "100%",
    height: "16px", // Biraz kalınlaştırdım
    backgroundColor: "#333", // Arkaya koyu gri bir fon atadım ki bar belli olsun
    border: "1px solid #555", // Hafif çerçeve
    borderRadius: "10px",
    marginBottom: "30px",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    transition: "width 0.1s linear",
    borderRadius: "10px", // Barın ucu da oval olsun
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "15px",
    width: "100%",
    aspectRatio: "1/1",
  },
  tile: {
    borderRadius: "15px",
    border: "2px solid",
    cursor: "pointer",
    transition: "background-color 0.1s, transform 0.1s",
    outline: "none",
    WebkitTapHighlightColor: "transparent",
  },
};

export default NeonBlitz;
