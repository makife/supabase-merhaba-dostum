import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, RefreshCw, Trophy, LogOut, BookOpen } from "lucide-react";

type GameState = "MENU" | "PLAYING" | "GAMEOVER";

const GRID_SIZE = 9;
const INITIAL_TIME = 2500; // ms
const POINTS_PER_LETTER = 5;
const WORD_BONUS = 20;

const SAFE_FALLBACK = [
  "ELMAS", "KALEM", "SABAH", "DENIZ", "BAHAR",
  "ORMAN", "FENER", "ARABA", "EVLER", "KAPAK",
  "TARAF", "KITAP", "YAŞAM", "SEZON", "ÇIZGI",
];

const generateColor = () => {
  const hues = [180, 270, 330, 60, 120, 200, 30, 0];
  return `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 100%, 60%)`;
};

const NeonBlitz: React.FC = () => {
  const navigate = useNavigate();

  const [gameState, setGameState] = useState<GameState>("MENU");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(100); // 0-100 yüzde
  const [themeColor, setThemeColor] = useState("hsl(180, 100%, 60%)");
  const [currentWord, setCurrentWord] = useState("");
  const [letterIndex, setLetterIndex] = useState(0);
  const [completedWords, setCompletedWords] = useState<string[]>([]);
  const [bonusVisible, setBonusVisible] = useState(false);

  // Oyun state'i ref'lerde — stale closure'dan kaçınmak için
  const wordListRef = useRef<string[]>(SAFE_FALLBACK);
  const usedWordsRef = useRef<Set<string>>(new Set());
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const currentWordRef = useRef("");
  const letterIndexRef = useRef(0);
  const activeTileRef = useRef<number | null>(null);
  const completedWordsRef = useRef<string[]>([]);
  const maxTimeRef = useRef(INITIAL_TIME);
  const isPlayingRef = useRef(false);

  // Timer için ayrı ref'ler
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const turnStartRef = useRef<number>(0);

  useEffect(() => {
    fetch("/wordlist.txt")
      .then(r => r.text())
      .then(text => {
        const words = text.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(w => w.length === 5);
        if (words.length > 0) wordListRef.current = words;
      })
      .catch(() => {});
  }, []);

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const pickWord = () => {
    const list = wordListRef.current;
    const available = list.filter(w => !usedWordsRef.current.has(w));
    const pool = available.length > 0 ? available : list;
    if (available.length === 0) usedWordsRef.current.clear();
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const pickTile = (exclude: number | null): number => {
    let t: number;
    do { t = Math.floor(Math.random() * GRID_SIZE); } while (t === exclude);
    return t;
  };

  // Yeni tur başlat: yeni karo seç + timer'ı sıfırla
  const beginTurn = useCallback(() => {
    clearTimer();

    const tile = pickTile(activeTileRef.current);
    activeTileRef.current = tile;
    setActiveTile(tile);

    // Bar'ı %100'den başlat
    setTimeLeft(100);
    turnStartRef.current = Date.now();

    // Her 30ms'de bir bar'ı güncelle
    intervalRef.current = setInterval(() => {
      if (!isPlayingRef.current) { clearTimer(); return; }
      const elapsed = Date.now() - turnStartRef.current;
      const remaining = maxTimeRef.current - elapsed;
      if (remaining <= 0) {
        clearTimer();
        setTimeLeft(0);
        isPlayingRef.current = false;
        setGameState("GAMEOVER");
      } else {
        setTimeLeft((remaining / maxTimeRef.current) * 100);
      }
    }, 30);
  }, []);

  const startGame = useCallback(() => {
    clearTimer();
    isPlayingRef.current = false;

    usedWordsRef.current.clear();
    scoreRef.current = 0;
    levelRef.current = 1;
    completedWordsRef.current = [];
    maxTimeRef.current = INITIAL_TIME;
    activeTileRef.current = null;

    const word = pickWord();
    usedWordsRef.current.add(word);
    currentWordRef.current = word;
    letterIndexRef.current = 0;

    const color = generateColor();

    setScore(0);
    setLevel(1);
    setCompletedWords([]);
    setActiveTile(null);
    setTimeLeft(100);
    setCurrentWord(word);
    setLetterIndex(0);
    setThemeColor(color);
    setGameState("PLAYING");

    // gameState "PLAYING" olduktan sonra turn'ü başlat
    setTimeout(() => {
      isPlayingRef.current = true;
      beginTurn();
    }, 50);
  }, [beginTurn]);

  const handleTileClick = useCallback((id: number) => {
    if (!isPlayingRef.current) return;

    if (id !== activeTileRef.current) {
      // Yanlış karo
      isPlayingRef.current = false;
      clearTimer();
      setGameState("GAMEOVER");
      return;
    }

    // Doğru karo
    clearTimer(); // Önce mevcut timer'ı durdur

    const newScore = scoreRef.current + POINTS_PER_LETTER;
    scoreRef.current = newScore;
    setScore(newScore);

    const word = currentWordRef.current;
    const nextIdx = letterIndexRef.current + 1;

    if (nextIdx >= word.length) {
      // Kelime tamamlandı
      const bonusScore = newScore + WORD_BONUS;
      scoreRef.current = bonusScore;
      setScore(bonusScore);

      const newCompleted = [...completedWordsRef.current, word];
      completedWordsRef.current = newCompleted;
      setCompletedWords([...newCompleted]);

      levelRef.current += 1;
      setLevel(levelRef.current);
      maxTimeRef.current = Math.max(500, maxTimeRef.current * 0.9);

      setBonusVisible(true);
      setTimeout(() => setBonusVisible(false), 900);

      // Yeni kelime
      const newWord = pickWord();
      usedWordsRef.current.add(newWord);
      currentWordRef.current = newWord;
      letterIndexRef.current = 0;
      setCurrentWord(newWord);
      setLetterIndex(0);
      setThemeColor(generateColor());
    } else {
      // Sonraki harf
      letterIndexRef.current = nextIdx;
      setLetterIndex(nextIdx);
    }

    // Her durumda yeni tur başlat
    beginTurn();
  }, [beginTurn]);

  const returnToMenu = () => {
    clearTimer();
    isPlayingRef.current = false;
    setGameState("MENU");
  };

  useEffect(() => () => { clearTimer(); isPlayingRef.current = false; }, []);

  // ─── RENDER ─────────────────────────────────────────────────────

  const renderMenu = () => (
    <div style={s.center}>
      <h1 style={{ ...s.title, textShadow: `0 0 30px ${themeColor}` }}>DOKUNSANA</h1>
      <p style={s.subtitle}>Kelimeyi Harf Harf Tamamla</p>
      <button onClick={startGame} style={{ ...s.btn, background: themeColor, boxShadow: `0 0 20px ${themeColor}88`, marginBottom: 14 }}>
        <Play size={20} style={{ marginRight: 8 }} /> OYNA
      </button>
      <button onClick={() => navigate("/")} style={{ ...s.outlineBtn, borderColor: "rgba(255,255,255,0.25)", color: "#aaa" }}>
        <LogOut size={17} style={{ marginRight: 8 }} /> Çıkış
      </button>
    </div>
  );

  const renderPlaying = () => {
    const activeLetter = currentWord[letterIndex] ?? "";
    return (
      <div style={s.gameWrap}>
        {/* Header */}
        <div style={s.header}>
          <button onClick={returnToMenu} style={s.iconBtn}><ArrowLeft size={22} color="#fff" /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontWeight: "bold" }}>
            <span style={{ color: themeColor }}>LVL {level}</span>
            <span>{score} puan</span>
          </div>
        </div>

        {/* Progress bar — transition YOK, anlık güncelleniyor */}
        <div style={s.progWrap}>
          <div style={{
            ...s.progBar,
            width: `${timeLeft}%`,
            background: themeColor,
            boxShadow: `0 0 8px ${themeColor}`,
            // Transition kasıtlı olarak yok — interval zaten çok sık güncelliyor
          }} />
        </div>

        {/* Kelime harfleri */}
        <div style={s.wordRow}>
          {currentWord.split("").map((ch, i) => (
            <div key={i} style={{
              ...s.letterBox,
              background: i < letterIndex ? `${themeColor}25` : i === letterIndex ? themeColor : "rgba(255,255,255,0.04)",
              color: i === letterIndex ? "#000" : i < letterIndex ? themeColor : "#444",
              borderColor: i === letterIndex ? themeColor : i < letterIndex ? `${themeColor}55` : "rgba(255,255,255,0.1)",
              boxShadow: i === letterIndex ? `0 0 12px ${themeColor}` : "none",
              transform: i === letterIndex ? "scale(1.18)" : "scale(1)",
              fontWeight: i <= letterIndex ? 900 : 600,
            }}>
              {ch}
            </div>
          ))}
        </div>

        <div style={{ color: "#666", fontSize: "0.8rem", marginBottom: 14 }}>
          Hedef: <span style={{ color: themeColor, fontWeight: "bold", fontSize: "1rem" }}>{activeLetter}</span>
        </div>

        {/* Grid */}
        <div style={s.grid}>
          {Array.from({ length: GRID_SIZE }).map((_, i) => {
            const isActive = i === activeTile;
            return (
              <button key={i} onClick={() => handleTileClick(i)} style={{
                ...s.tile,
                background: isActive ? themeColor : "rgba(255,255,255,0.04)",
                borderColor: isActive ? "#fff" : "rgba(255,255,255,0.08)",
                boxShadow: isActive ? `0 0 22px ${themeColor}, 0 0 44px ${themeColor}44` : "none",
                transform: isActive ? "scale(1.06)" : "scale(1)",
              }}>
                {isActive && (
                  <span style={{ fontSize: "1.9rem", fontWeight: 900, color: "#000", fontFamily: "Georgia, serif" }}>
                    {activeLetter}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bonus animasyonu */}
        {bonusVisible && (
          <div style={{
            position: "absolute", top: "38%", left: "50%", transform: "translateX(-50%)",
            color: themeColor, fontSize: "1.7rem", fontWeight: 900,
            textShadow: `0 0 20px ${themeColor}`, animation: "floatUp 0.9s ease forwards",
            pointerEvents: "none", zIndex: 100,
          }}>
            +{WORD_BONUS} BONUS!
          </div>
        )}

        {/* Tamamlanan kelimeler */}
        {completedWords.length > 0 && (
          <div style={s.wordListBox}>
            <div style={s.wordListTitle}><BookOpen size={12} style={{ marginRight: 5 }} />Tamamlananlar</div>
            <div style={s.wordTags}>
              {completedWords.map((w, i) => (
                <span key={i} style={{ ...s.tag, borderColor: `${themeColor}55`, color: themeColor }}>{w}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGameOver = () => (
    <div style={s.center}>
      <Trophy size={52} color={themeColor} style={{ marginBottom: 14, filter: `drop-shadow(0 0 12px ${themeColor})` }} />
      <h2 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: 8 }}>OYUN BİTTİ</h2>
      <div style={{ fontSize: "2.4rem", fontWeight: 900, marginBottom: 4 }}>
        {score} <span style={{ fontSize: "1rem", color: "#888" }}>puan</span>
      </div>
      <div style={{ color: "#888", marginBottom: 4 }}>Level: <span style={{ color: themeColor }}>{level}</span></div>
      <div style={{ color: "#888", marginBottom: 20 }}>
        Tamamlanan: <span style={{ color: themeColor }}>{completedWords.length} kelime</span>
      </div>

      {completedWords.length > 0 && (
        <div style={{ ...s.wordListBox, marginBottom: 24, maxWidth: 300 }}>
          <div style={s.wordListTitle}><BookOpen size={12} style={{ marginRight: 5 }} />Kelimeler</div>
          <div style={s.wordTags}>
            {completedWords.map((w, i) => (
              <span key={i} style={{ ...s.tag, borderColor: `${themeColor}55`, color: themeColor }}>{w}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={startGame} style={{ ...s.btn, background: themeColor, boxShadow: `0 0 15px ${themeColor}66` }}>
          <RefreshCw size={17} style={{ marginRight: 8 }} /> Tekrar Dene
        </button>
        <button onClick={returnToMenu} style={{ ...s.outlineBtn, borderColor: themeColor, color: themeColor }}>
          Menüye Dön
        </button>
      </div>
    </div>
  );

  return (
    <div style={s.app}>
      <style>{`@keyframes floatUp{0%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-55px)}}`}</style>
      {gameState === "MENU" && renderMenu()}
      {gameState === "PLAYING" && renderPlaying()}
      {gameState === "GAMEOVER" && renderGameOver()}
    </div>
  );
};

const s: { [k: string]: React.CSSProperties } = {
  app: {
    width: "100%", height: "100vh", backgroundColor: "#0a0a0f", color: "#fff",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif", overflow: "hidden", userSelect: "none",
    position: "absolute", top: 0, left: 0, zIndex: 50,
  },
  center: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, position: "relative" },
  gameWrap: { width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 18px", maxWidth: 460, position: "relative", overflowY: "auto" },
  header: { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingTop: 8 },
  title: { fontSize: "2.7rem", fontWeight: 900, marginBottom: 8, letterSpacing: 3, color: "#fff" },
  subtitle: { fontSize: "0.95rem", color: "#666", marginBottom: 34, letterSpacing: 1 },
  btn: { padding: "13px 32px", fontSize: "1.05rem", fontWeight: "bold", color: "#000", border: "none", borderRadius: 50, cursor: "pointer", display: "flex", alignItems: "center" },
  outlineBtn: { padding: "11px 24px", fontSize: "0.9rem", fontWeight: "bold", backgroundColor: "transparent", border: "2px solid", borderRadius: 50, cursor: "pointer", display: "flex", alignItems: "center" },
  iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.08)" },
  progWrap: { width: "100%", height: 10, backgroundColor: "#1e1e2e", border: "1px solid #2a2a3a", borderRadius: 10, marginBottom: 18, overflow: "hidden" },
  progBar: { height: "100%", borderRadius: 10 },
  wordRow: { display: "flex", gap: 7, marginBottom: 10 },
  letterBox: { width: 42, height: 46, borderRadius: 9, border: "2px solid", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", transition: "all 0.15s", fontFamily: "Georgia, serif" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 11, width: "100%", maxWidth: 330, aspectRatio: "1/1", marginBottom: 14 },
  tile: { borderRadius: 13, border: "2px solid", cursor: "pointer", transition: "all 0.1s", outline: "none", WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center" },
  wordListBox: { width: "100%", maxWidth: 330, backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "9px 12px" },
  wordListTitle: { fontSize: "0.7rem", color: "#555", display: "flex", alignItems: "center", marginBottom: 7, letterSpacing: 1, textTransform: "uppercase" as const },
  wordTags: { display: "flex", flexWrap: "wrap" as const, gap: 5 },
  tag: { fontSize: "0.75rem", fontWeight: "bold", padding: "2px 9px", borderRadius: 20, border: "1px solid", letterSpacing: 1 },
};

export default NeonBlitz;
