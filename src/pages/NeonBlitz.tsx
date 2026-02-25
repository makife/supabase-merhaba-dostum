import React, { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, RefreshCw, Trophy, LogOut, BookOpen } from "lucide-react";

// --- TİP TANIMLAMALARI ---
type GameState = "MENU" | "PLAYING" | "GAMEOVER";

// --- SABİTLER ---
const GRID_SIZE = 9;
const INITIAL_TIME = 2500;
const POINTS_PER_LETTER = 5;
const WORD_BONUS = 20;

const NeonBlitz: React.FC = () => {
  const navigate = useNavigate();

  // --- STATE YÖNETİMİ ---
  const [gameState, setGameState] = useState<GameState>("MENU");
  const [score, setScore] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(100);
  const [themeColor, setThemeColor] = useState<string>("hsl(180, 100%, 60%)");

  // Kelime sistemi
  const [wordList, setWordList] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState<string>("");
  const [currentLetterIndex, setCurrentLetterIndex] = useState<number>(0);
  const [completedWords, setCompletedWords] = useState<string[]>([]);
  const [showBonus, setShowBonus] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);
  const progressRef = useRef<number | null>(null);
  const maxTimeRef = useRef<number>(INITIAL_TIME);
  const startTimeRef = useRef<number>(0);
  const usedWordsRef = useRef<Set<string>>(new Set());
  const scoreRef = useRef<number>(0);
  const levelRef = useRef<number>(1);
  const currentWordRef = useRef<string>("");
  const currentLetterIndexRef = useRef<number>(0);
  const activeTileRef = useRef<number | null>(null);
  const completedWordsRef = useRef<string[]>([]);
  const themeColorRef = useRef<string>("hsl(180, 100%, 60%)");

  // --- WORDLIST YÜKLEME ---
  useEffect(() => {
    fetch("/wordlist.txt")
      .then((res) => res.text())
      .then((text) => {
        const words = text
          .split("\n")
          .map((w) => w.trim().toUpperCase())
          .filter((w) => w.length === 5 && /^[A-ZÇĞİÖŞÜ]+$/.test(w));
        setWordList(words);
      })
      .catch(() => {
        // Fallback kelimeler
        const fallback = [
          "ELMAS", "KALEM", "SABAH", "DENIZ", "GÜNEŞ",
          "YILDIZ", "BULUT", "NEHIR", "ORMAN", "ÇIÇEK",
          "TAŞIM", "RÜZGAR", "BAHAR", "KUŞAK", "FENER",
        ].filter(w => w.length === 5);
        setWordList(fallback);
      });
  }, []);

  // --- YARDIMCI FONKSİYONLAR ---
  const generateRandomColor = () => {
    const hues = [180, 270, 330, 60, 120, 200, 30];
    const hue = hues[Math.floor(Math.random() * hues.length)];
    return `hsl(${hue}, 100%, 60%)`;
  };

  const pickRandomWord = useCallback((words: string[]) => {
    const available = words.filter(w => !usedWordsRef.current.has(w));
    if (available.length === 0) {
      usedWordsRef.current.clear();
      return words[Math.floor(Math.random() * words.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }, []);

  const pickNewTile = useCallback((current: number | null) => {
    let newTile;
    do {
      newTile = Math.floor(Math.random() * GRID_SIZE);
    } while (newTile === current);
    return newTile;
  }, []);

  // --- OYUN MANTIĞI ---
  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressRef.current) cancelAnimationFrame(progressRef.current);
  };

  const stopGame = useCallback(() => {
    clearTimers();
    setGameState("GAMEOVER");
  }, []);

  const startTurn = useCallback((currentTile: number | null) => {
    clearTimers();
    const newTile = pickNewTile(currentTile);
    setActiveTile(newTile);
    activeTileRef.current = newTile;

    startTimeRef.current = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
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
  }, [pickNewTile, stopGame]);

  const startNewWord = useCallback((words: string[], currentTile: number | null) => {
    const word = pickRandomWord(words);
    usedWordsRef.current.add(word);
    currentWordRef.current = word;
    currentLetterIndexRef.current = 0;
    setCurrentWord(word);
    setCurrentLetterIndex(0);

    const newColor = generateRandomColor();
    themeColorRef.current = newColor;
    setThemeColor(newColor);

    startTurn(currentTile);
  }, [pickRandomWord, startTurn]);

  const startGame = useCallback(() => {
    if (wordList.length === 0) return;
    clearTimers();
    usedWordsRef.current.clear();
    scoreRef.current = 0;
    levelRef.current = 1;
    completedWordsRef.current = [];
    maxTimeRef.current = INITIAL_TIME;

    setScore(0);
    setLevel(1);
    setCompletedWords([]);
    setActiveTile(null);
    activeTileRef.current = null;
    setGameState("PLAYING");

    startNewWord(wordList, null);
  }, [wordList, startNewWord]);

  const returnToGameMenu = () => {
    clearTimers();
    setGameState("MENU");
  };

  const exitToAppHome = () => {
    clearTimers();
    navigate("/");
  };

  const handleTileClick = useCallback((id: number) => {
    if (activeTileRef.current === null) return;
    if (id !== activeTileRef.current) {
      stopGame();
      return;
    }

    // Doğru karo tıklandı
    const newScore = scoreRef.current + POINTS_PER_LETTER;
    scoreRef.current = newScore;
    setScore(newScore);

    const word = currentWordRef.current;
    const nextIndex = currentLetterIndexRef.current + 1;

    if (nextIndex >= word.length) {
      // Kelime tamamlandı!
      const bonusScore = newScore + WORD_BONUS;
      scoreRef.current = bonusScore;
      setScore(bonusScore);

      const newCompleted = [...completedWordsRef.current, word];
      completedWordsRef.current = newCompleted;
      setCompletedWords(newCompleted);

      // Level up
      const newLevel = levelRef.current + 1;
      levelRef.current = newLevel;
      setLevel(newLevel);
      maxTimeRef.current = Math.max(500, maxTimeRef.current * 0.9);

      // Bonus animasyonu
      setShowBonus(true);
      setTimeout(() => setShowBonus(false), 1000);

      // Yeni kelimeye geç
      startNewWord(wordList, activeTileRef.current);
    } else {
      // Sonraki harfe geç
      currentLetterIndexRef.current = nextIndex;
      setCurrentLetterIndex(nextIndex);
      startTurn(activeTileRef.current);
    }
  }, [stopGame, startNewWord, startTurn, wordList]);

  // --- EKRAN BİLEŞENLERİ ---

  const renderMenu = () => (
    <div style={styles.centerContainer}>
      <div style={{ ...styles.glowRing, borderColor: themeColor, boxShadow: `0 0 40px ${themeColor}33` }} />
      <h1 style={{ ...styles.title, textShadow: `0 0 30px ${themeColor}, 0 0 60px ${themeColor}55` }}>
        DOKUNSANA
      </h1>
      <p style={styles.subtitle}>Kelimeyi Harf Harf Tamamla</p>

      {wordList.length === 0 && (
        <p style={{ color: "#f88", fontSize: "0.85rem", marginBottom: 16 }}>
          Kelime listesi yükleniyor...
        </p>
      )}

      <button
        onClick={startGame}
        disabled={wordList.length === 0}
        style={{
          ...styles.button,
          backgroundColor: themeColor,
          boxShadow: `0 0 20px ${themeColor}88`,
          marginBottom: 16,
          opacity: wordList.length === 0 ? 0.5 : 1,
        }}
      >
        <Play size={22} style={{ marginRight: 8 }} /> OYNA
      </button>

      <button onClick={exitToAppHome} style={{ ...styles.outlineButton, borderColor: "rgba(255,255,255,0.3)", color: "#ccc" }}>
        <LogOut size={18} style={{ marginRight: 8 }} /> Oyundan Çık
      </button>
    </div>
  );

  const renderGame = () => {
    const currentLetter = currentWord[currentLetterIndex] || "";

    return (
      <div style={styles.gameContainer}>
        {/* Header */}
        <div style={styles.header}>
          <button onClick={returnToGameMenu} style={styles.iconButton}>
            <ArrowLeft size={24} color="#fff" />
          </button>
          <div style={styles.scoreBoard}>
            <span style={{ color: themeColor, marginRight: 16, fontSize: "0.95rem" }}>LVL {level}</span>
            <span style={{ fontWeight: "bold" }}>{score} <span style={{ color: "#888", fontSize: "0.8rem" }}>puan</span></span>
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

        {/* Kelime Göstergesi */}
        <div style={styles.wordDisplay}>
          {currentWord.split("").map((letter, i) => (
            <div
              key={i}
              style={{
                ...styles.letterBox,
                backgroundColor: i < currentLetterIndex
                  ? `${themeColor}33`
                  : i === currentLetterIndex
                  ? themeColor
                  : "rgba(255,255,255,0.05)",
                color: i === currentLetterIndex ? "#000" : i < currentLetterIndex ? themeColor : "#555",
                borderColor: i === currentLetterIndex ? themeColor : i < currentLetterIndex ? `${themeColor}66` : "rgba(255,255,255,0.1)",
                boxShadow: i === currentLetterIndex ? `0 0 15px ${themeColor}` : "none",
                transform: i === currentLetterIndex ? "scale(1.15)" : "scale(1)",
                fontWeight: i === currentLetterIndex ? "900" : "bold",
              }}
            >
              {letter}
            </div>
          ))}
        </div>

        {/* Aktif harf ipucu */}
        <div style={{ color: "#888", fontSize: "0.85rem", marginBottom: 16, letterSpacing: 1 }}>
          Hedef harf: <span style={{ color: themeColor, fontWeight: "bold", fontSize: "1rem" }}>{currentLetter}</span>
        </div>

        {/* Grid */}
        <div style={styles.grid}>
          {Array.from({ length: GRID_SIZE }).map((_, index) => {
            const isActive = index === activeTile;
            return (
              <button
                key={index}
                onClick={() => handleTileClick(index)}
                style={{
                  ...styles.tile,
                  backgroundColor: isActive ? themeColor : "rgba(255,255,255,0.04)",
                  boxShadow: isActive ? `0 0 25px ${themeColor}, 0 0 50px ${themeColor}44` : "none",
                  transform: isActive ? "scale(1.06)" : "scale(1)",
                  borderColor: isActive ? "#fff" : "rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isActive && (
                  <span style={{
                    fontSize: "1.8rem",
                    fontWeight: "900",
                    color: "#000",
                    textShadow: "none",
                    fontFamily: "'Georgia', serif",
                    letterSpacing: "-1px",
                  }}>
                    {currentLetter}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bonus animasyonu */}
        {showBonus && (
          <div style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translateX(-50%)",
            color: themeColor,
            fontSize: "1.8rem",
            fontWeight: "900",
            textShadow: `0 0 20px ${themeColor}`,
            animation: "floatUp 1s ease forwards",
            pointerEvents: "none",
            zIndex: 100,
          }}>
            +{WORD_BONUS} BONUS!
          </div>
        )}

        {/* Tamamlanan kelimeler listesi */}
        {completedWords.length > 0 && (
          <div style={styles.completedWordsContainer}>
            <div style={styles.completedWordsTitle}>
              <BookOpen size={14} style={{ marginRight: 6 }} /> Tamamlanan Kelimeler
            </div>
            <div style={styles.completedWordsList}>
              {completedWords.map((word, i) => (
                <span key={i} style={{ ...styles.completedWordTag, borderColor: `${themeColor}55`, color: themeColor }}>
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGameOver = () => (
    <div style={styles.centerContainer}>
      <Trophy size={56} color={themeColor} style={{ marginBottom: 16, filter: `drop-shadow(0 0 15px ${themeColor})` }} />
      <h2 style={{ ...styles.gameOverTitle, textShadow: `0 0 20px ${themeColor}55` }}>OYUN BİTTİ</h2>
      <div style={styles.finalScore}>{score} <span style={{ fontSize: "1rem", color: "#888" }}>puan</span></div>
      <div style={styles.finalLevel}>Ulaşılan Level: <span style={{ color: themeColor }}>{level}</span></div>
      <div style={styles.finalLevel}>Tamamlanan Kelime: <span style={{ color: themeColor }}>{completedWords.length}</span></div>

      {completedWords.length > 0 && (
        <div style={{ ...styles.completedWordsContainer, marginBottom: 24, maxWidth: 300 }}>
          <div style={styles.completedWordsTitle}>
            <BookOpen size={13} style={{ marginRight: 5 }} /> Kelime Listesi
          </div>
          <div style={styles.completedWordsList}>
            {completedWords.map((word, i) => (
              <span key={i} style={{ ...styles.completedWordTag, borderColor: `${themeColor}55`, color: themeColor }}>
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={styles.buttonGroup}>
        <button
          onClick={startGame}
          style={{ ...styles.button, backgroundColor: themeColor, boxShadow: `0 0 15px ${themeColor}66`, marginRight: 10 }}
        >
          <RefreshCw size={18} style={{ marginRight: 8 }} /> Tekrar Dene
        </button>
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
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
        }
      `}</style>
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
    backgroundColor: "#0a0a0f",
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
  glowRing: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: "50%",
    border: "1px solid",
    opacity: 0.15,
    pointerEvents: "none",
  },
  centerContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 20,
    position: "relative",
  },
  gameContainer: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "16px 20px",
    maxWidth: "480px",
    position: "relative",
    overflowY: "auto",
  },
  header: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
    paddingTop: "10px",
  },
  scoreBoard: {
    fontSize: "1.1rem",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
  },
  title: {
    fontSize: "2.8rem",
    fontWeight: "900",
    marginBottom: "8px",
    letterSpacing: "3px",
    color: "#fff",
  },
  subtitle: {
    fontSize: "1rem",
    color: "#777",
    marginBottom: "36px",
    letterSpacing: 1,
  },
  gameOverTitle: {
    fontSize: "2.2rem",
    fontWeight: "bold",
    marginBottom: "10px",
  },
  finalScore: {
    fontSize: "2.5rem",
    fontWeight: "900",
    marginBottom: "6px",
  },
  finalLevel: {
    fontSize: "0.95rem",
    color: "#888",
    marginBottom: "6px",
  },
  button: {
    padding: "14px 36px",
    fontSize: "1.1rem",
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
    padding: "12px 26px",
    fontSize: "0.95rem",
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
    padding: "8px",
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  buttonGroup: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  progressContainer: {
    width: "100%",
    height: "10px",
    backgroundColor: "#1e1e2e",
    border: "1px solid #333",
    borderRadius: "10px",
    marginBottom: "20px",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: "10px",
    transition: "width 0.08s linear",
  },
  // Kelime göstergesi
  wordDisplay: {
    display: "flex",
    gap: "8px",
    marginBottom: "10px",
  },
  letterBox: {
    width: 44,
    height: 48,
    borderRadius: 10,
    border: "2px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.3rem",
    transition: "all 0.15s ease",
    fontFamily: "'Georgia', serif",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
    width: "100%",
    maxWidth: 340,
    aspectRatio: "1/1",
    marginBottom: "16px",
  },
  tile: {
    borderRadius: "14px",
    border: "2px solid",
    cursor: "pointer",
    transition: "background-color 0.1s, transform 0.12s, box-shadow 0.15s",
    outline: "none",
    WebkitTapHighlightColor: "transparent",
  },
  // Tamamlanan kelimeler
  completedWordsContainer: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: "10px 14px",
  },
  completedWordsTitle: {
    fontSize: "0.75rem",
    color: "#666",
    display: "flex",
    alignItems: "center",
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  completedWordsList: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
  },
  completedWordTag: {
    fontSize: "0.8rem",
    fontWeight: "bold",
    padding: "3px 10px",
    borderRadius: 20,
    border: "1px solid",
    letterSpacing: 1,
  },
};

export default NeonBlitz;
