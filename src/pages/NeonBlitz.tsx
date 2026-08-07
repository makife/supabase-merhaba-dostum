import { homeBackPath } from "@/utils/challengeBackPath";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { playChallengeWinSound } from "@/utils/challengeWinSound";
import Lottie from "lottie-react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Play, RefreshCw, Trophy, LogOut, BookOpen } from "lucide-react";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import { useGameMute } from "@/hooks/useGameMute";
import { GameMuteButton } from "@/components/GameMuteButton";
import { playTileBeep } from "@/utils/genericBeep";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";
import { toast } from "sonner";

type GameState = "MENU" | "PLAYING" | "GAMEOVER";

const GRID_SIZE = 9;
const INITIAL_TIME = 2500; // ms
const POINTS_PER_LETTER = 5;
const WORD_BONUS = 20;

const SAFE_FALLBACK = [
  "ELMAS",
  "KALEM",
  "SABAH",
  "DENIZ",
  "BAHAR",
  "ORMAN",
  "FENER",
  "ARABA",
  "EVLER",
  "KAPAK",
  "TARAF",
  "KITAP",
  "YAŞAM",
  "SEZON",
  "ÇIZGI",
];

const generateColor = () => {
  const hues = [180, 270, 330, 60, 120, 200, 30, 0];
  return `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 100%, 60%)`;
};

const NeonBlitz: React.FC = () => {
  const navigate = useNavigate();
  const { requestExit, ExitConfirmDialog } = useExitGameConfirm();
  const { muted, playSound } = useGameMute("neon_blitz");
  const { hasPlayedToday, todayScore, leaderboard, loading, saveScore, markAsPlayed } = useDailyChallenge("neon_blitz");

  const [gameState, setGameState] = useState<GameState>("MENU");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(100);
  const [themeColor, setThemeColor] = useState("hsl(180, 100%, 60%)");
  const [currentWord, setCurrentWord] = useState("");
  const [letterIndex, setLetterIndex] = useState(0);
  const [completedWords, setCompletedWords] = useState<string[]>([]);
  const [bonusVisible, setBonusVisible] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [simsekAnim, setSimsekAnim] = useState<any>(null);

  useEffect(() => {
    fetch("/simsekReflex.json").then(r => r.json()).then(setSimsekAnim).catch(() => {});
  }, []);

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

  const rafRef = useRef<number | null>(null);
  const turnStartRef = useRef<number>(0);
  const timeLeftRef = useRef(100);

  useEffect(() => {
    fetch("/wordlist.txt")
      .then((r) => r.text())
      .then((text) => {
        const words = text
          .split(/\r?\n/)
          .map((w) => w.trim().toUpperCase())
          .filter((w) => w.length === 5);
        if (words.length > 0) wordListRef.current = words;
      })
      .catch(() => {});
  }, []);

  const clearTimer = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const pickWord = () => {
    const list = wordListRef.current;
    const available = list.filter((w) => !usedWordsRef.current.has(w));
    const pool = available.length > 0 ? available : list;
    if (available.length === 0) usedWordsRef.current.clear();
    return pool[Math.floor(Math.random() * pool.length)];
  };

  const pickTile = (exclude: number | null): number => {
    let t: number;
    do {
      t = Math.floor(Math.random() * GRID_SIZE);
    } while (t === exclude);
    return t;
  };

  const beginTurn = useCallback(() => {
    clearTimer();
    const tile = pickTile(activeTileRef.current);
    activeTileRef.current = tile;
    setActiveTile(tile);
    timeLeftRef.current = 100;
    setTimeLeft(100);
    turnStartRef.current = Date.now();

    const tick = () => {
      if (!isPlayingRef.current) {
        clearTimer();
        return;
      }
      const elapsed = Date.now() - turnStartRef.current;
      const remaining = maxTimeRef.current - elapsed;
      if (remaining <= 0) {
        clearTimer();
        timeLeftRef.current = 0;
        setTimeLeft(0);
        isPlayingRef.current = false;
        setGameState("GAMEOVER");
      } else {
        const pct = (remaining / maxTimeRef.current) * 100;
        timeLeftRef.current = pct;
        setTimeLeft(pct);
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startGame = useCallback(() => {
    if (hasPlayedToday) return;
    markAsPlayed();

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
    setShowLeaderboard(false);

    setTimeout(() => {
      isPlayingRef.current = true;
      beginTurn();
    }, 50);
  }, [beginTurn, hasPlayedToday, markAsPlayed]);

  // Save score on game over
  useEffect(() => {
    if (gameState === "GAMEOVER") {
      const finalLevel = levelRef.current;
      const finalWords = completedWordsRef.current.length;
      if (!muted) playChallengeWinSound();
      saveScore(finalLevel, finalWords).then((saved) => {

        if (saved) {
          if (finalLevel >= 25) {
            toast.success("🎉 Harika! 2 Fısılda + 2 Değiştir + 2 Senyaz kazandın!", { duration: 5000 });
          } else if (finalLevel >= 20) {
            toast.success("🎉 Süper! 2 Fısılda + 2 Değiştir kazandın!", { duration: 5000 });
          } else if (finalLevel >= 15) {
            toast.success("🎉 İyi oyun! 2 Fısılda kazandın!", { duration: 5000 });
          }
        }
      });
    }
  }, [gameState]);

  const handleTileClick = useCallback(
    (id: number) => {
      if (!isPlayingRef.current) return;
      if (!muted) playTileBeep(letterIndexRef.current);
      if (id !== activeTileRef.current) {
        isPlayingRef.current = false;
        clearTimer();
        setGameState("GAMEOVER");
        return;
      }

      clearTimer();
      const newScore = scoreRef.current + POINTS_PER_LETTER;
      scoreRef.current = newScore;
      setScore(newScore);

      const word = currentWordRef.current;
      const nextIdx = letterIndexRef.current + 1;

      if (nextIdx >= word.length) {
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
        const newWord = pickWord();
        usedWordsRef.current.add(newWord);
        currentWordRef.current = newWord;
        letterIndexRef.current = 0;
        setCurrentWord(newWord);
        setLetterIndex(0);
        setThemeColor(generateColor());
      } else {
        letterIndexRef.current = nextIdx;
        setLetterIndex(nextIdx);
      }
      beginTurn();
    },
    [beginTurn, playSound],
  );

  const returnToMenu = () => {
    clearTimer();
    isPlayingRef.current = false;
    setGameState("MENU");
  };

  useEffect(
    () => () => {
      clearTimer();
      isPlayingRef.current = false;
    },
    [],
  );

  // ─── RENDER ─────────────────────────────────────────────────────

  const renderMenu = () => (
    <div style={s.center}>
      <button
        onClick={() => {
          playSound("buttonClick");
          requestExit(() => navigate(homeBackPath()), true);
        }}
        style={{ position: "absolute", top: 16, left: 16, ...s.iconBtn }}
      >
        <ArrowLeft size={22} color="#fff" />
      </button>
      <div style={{ position: "absolute", top: 16, right: 16 }}>
        <GameMuteButton gameId="neon_blitz" size={40} />
      </div>
      {simsekAnim && (
        <div style={{ width: 100, height: 100, marginBottom: 8 }}>
          <Lottie animationData={simsekAnim} loop autoplay style={{ width: "100%", height: "100%" }} />
        </div>
      )}
      <h1 style={{ ...s.title, textShadow: `0 0 30px ${themeColor}` }}>REFLEKS</h1>
      <p style={s.subtitle}>Hızlı Olan Kazanır</p>

      <div
        style={{
          background: "rgba(255,165,0,0.1)",
          border: "1px solid rgba(255,165,0,0.25)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 14,
          width: "100%",
          maxWidth: 320,
        }}
      >
        <p style={{ fontSize: 12, color: "#FFD700", fontWeight: "bold", marginBottom: 6, textAlign: "center" }}>
          🏆 Level Ödülleri
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <p style={{ fontSize: 11, color: "#ccc" }}>
            📌 Lvl 15-19: <span style={{ color: "#a78bfa" }}>+2 Fısılda</span>
          </p>
          <p style={{ fontSize: 11, color: "#ccc" }}>
            📌 Lvl 20-24: <span style={{ color: "#a78bfa" }}>+2 Fısılda</span>,{" "}
            <span style={{ color: "#60a5fa" }}>+2 Değiştir</span>
          </p>
          <p style={{ fontSize: 11, color: "#ccc" }}>
            📌 Lvl 25+: <span style={{ color: "#a78bfa" }}>+2 Fısılda</span>,{" "}
            <span style={{ color: "#60a5fa" }}>+2 Değiştir</span>, <span style={{ color: "#4ade80" }}>+2 Senyaz</span>
          </p>
        </div>
      </div>

      {hasPlayedToday ? (
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ color: "#4ade80", fontWeight: "bold", fontSize: "1rem", marginBottom: 6 }}>
            Bugünkü challenge tamamlandı! ✅
          </p>
          <p style={{ color: "#888", fontSize: "0.85rem" }}>
            Ulaştığın Level: <span style={{ color: themeColor, fontWeight: "bold" }}>{todayScore}</span>
          </p>
          <p style={{ color: "#666", fontSize: "0.75rem", marginTop: 4 }}>Yarın tekrar gel! 🎯</p>
        </div>
      ) : (
        <button
          onClick={startGame}
          style={{ ...s.btn, background: themeColor, boxShadow: `0 0 20px ${themeColor}88`, marginBottom: 14 }}
        >
          <Play size={20} style={{ marginRight: 8 }} /> OYNA
        </button>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          style={{ ...s.outlineBtn, borderColor: themeColor, color: themeColor }}
        >
          <Trophy size={17} style={{ marginRight: 6 }} /> Sıralama
        </button>
      </div>

      {showLeaderboard && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            style={{
              background: "#1a1a2e",
              border: `1px solid ${themeColor}33`,
              borderRadius: 16,
              padding: 20,
              width: "100%",
              maxWidth: 400,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>🏆 Günlük Refleks Sıralaması</h3>
              <button
                onClick={() => setShowLeaderboard(false)}
                style={{ background: "none", border: "none", color: "#888", fontSize: 22, cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <ChallengeLeaderboard leaderboard={leaderboard} title="" showLevel />
          </div>
        </div>
      )}
    </div>
  );

  const renderPlaying = () => {
    const activeLetter = currentWord[letterIndex] ?? "";
    return (
      <div style={s.gameWrap}>
        <div style={s.header}>
          <button
            onClick={() => {
              playSound("buttonClick");
              requestExit(() => returnToMenu());
            }}
            style={s.iconBtn}
          >
            <ArrowLeft size={22} color="#fff" />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontWeight: "bold" }}>
            <span style={{ color: themeColor }}>LVL {level}</span>
            <span>{score} puan</span>
          </div>
        </div>

        <div style={s.progWrap}>
          <div
            style={{ ...s.progBar, width: `${timeLeft}%`, background: themeColor, boxShadow: `0 0 8px ${themeColor}` }}
          />
        </div>

        <div style={s.wordRow}>
          {currentWord.split("").map((ch, i) => (
            <div
              key={i}
              style={{
                ...s.letterBox,
                background:
                  i < letterIndex ? `${themeColor}25` : i === letterIndex ? themeColor : "rgba(255,255,255,0.04)",
                color: i === letterIndex ? "#000" : i < letterIndex ? themeColor : "#444",
                borderColor:
                  i === letterIndex ? themeColor : i < letterIndex ? `${themeColor}55` : "rgba(255,255,255,0.1)",
                boxShadow: i === letterIndex ? `0 0 12px ${themeColor}` : "none",
                transform: i === letterIndex ? "scale(1.18)" : "scale(1)",
                fontWeight: i <= letterIndex ? 900 : 600,
              }}
            >
              {ch}
            </div>
          ))}
        </div>

        <div style={{ color: "#666", fontSize: "0.8rem", marginBottom: 14 }}>
          Hedef: <span style={{ color: themeColor, fontWeight: "bold", fontSize: "1rem" }}>{activeLetter}</span>
        </div>

        <div style={s.grid}>
          {Array.from({ length: GRID_SIZE }).map((_, i) => {
            const isActive = i === activeTile;
            return (
              <button
                key={i}
                onClick={() => handleTileClick(i)}
                style={{
                  ...s.tile,
                  background: isActive ? themeColor : "rgba(255,255,255,0.04)",
                  borderColor: isActive ? "#fff" : "rgba(255,255,255,0.08)",
                  boxShadow: isActive ? `0 0 22px ${themeColor}, 0 0 44px ${themeColor}44` : "none",
                  transform: isActive ? "scale(1.06)" : "scale(1)",
                }}
              >
                {isActive && (
                  <span style={{ fontSize: "1.9rem", fontWeight: 900, color: "#000", fontFamily: "Georgia, serif" }}>
                    {activeLetter}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {bonusVisible && (
          <div
            style={{
              position: "absolute",
              top: "38%",
              left: "50%",
              transform: "translateX(-50%)",
              color: themeColor,
              fontSize: "1.7rem",
              fontWeight: 900,
              textShadow: `0 0 20px ${themeColor}`,
              animation: "floatUp 0.9s ease forwards",
              pointerEvents: "none",
              zIndex: 100,
            }}
          >
            +{WORD_BONUS} BONUS!
          </div>
        )}

        {completedWords.length > 0 && (
          <div style={s.wordListBox}>
            <div style={s.wordListTitle}>
              <BookOpen size={12} style={{ marginRight: 5 }} />
              Tamamlananlar
            </div>
            <div style={s.wordTags}>
              {completedWords.map((w, i) => (
                <span key={i} style={{ ...s.tag, borderColor: `${themeColor}55`, color: themeColor }}>
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderGameOver = () => (
    <div style={s.center}>
      <Trophy
        size={52}
        color={themeColor}
        style={{ marginBottom: 14, filter: `drop-shadow(0 0 12px ${themeColor})` }}
      />
      <h2 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: 8 }}>OYUN BİTTİ</h2>
      <div style={{ fontSize: "2.4rem", fontWeight: 900, marginBottom: 4 }}>
        {score} <span style={{ fontSize: "1rem", color: "#888" }}>puan</span>
      </div>
      <div style={{ color: "#888", marginBottom: 4 }}>
        Level: <span style={{ color: themeColor }}>{level}</span>
      </div>
      <div style={{ color: "#888", marginBottom: 20 }}>
        Tamamlanan: <span style={{ color: themeColor }}>{completedWords.length} kelime</span>
      </div>

      {completedWords.length > 0 && (
        <div style={{ ...s.wordListBox, marginBottom: 24, maxWidth: 300 }}>
          <div style={s.wordListTitle}>
            <BookOpen size={12} style={{ marginRight: 5 }} />
            Kelimeler
          </div>
          <div style={s.wordTags}>
            {completedWords.map((w, i) => (
              <span key={i} style={{ ...s.tag, borderColor: `${themeColor}55`, color: themeColor }}>
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 16 }}>
        {!hasPlayedToday && (
          <button
            onClick={() => {
              playSound("buttonClick");
              startGame();
            }}
            style={{ ...s.btn, background: themeColor, boxShadow: `0 0 15px ${themeColor}66` }}
          >
            <RefreshCw size={17} style={{ marginRight: 8 }} /> Tekrar Dene
          </button>
        )}
        <button
          onClick={() => {
            playSound("buttonClick");
            setShowLeaderboard(!showLeaderboard);
          }}
          style={{ ...s.outlineBtn, borderColor: themeColor, color: themeColor }}
        >
          <Trophy size={17} style={{ marginRight: 6 }} /> Sıralama
        </button>
        <button
          onClick={() => {
            playSound("buttonClick");
            navigate(homeBackPath());
          }}
          style={{ ...s.outlineBtn, borderColor: themeColor, color: themeColor }}
        >
          Ana Sayfaya Dön
        </button>
      </div>

      {hasPlayedToday && (
        <p style={{ color: "#4ade80", fontSize: "0.85rem", fontWeight: "bold", marginBottom: 12 }}>
          Bugünkü challenge kaydedildi! ✅ Yarın tekrar gel 🎯
        </p>
      )}

      {showLeaderboard && (
        <div style={{ width: "100%", maxWidth: 380 }}>
          <ChallengeLeaderboard leaderboard={leaderboard} title="Günlük Refleks Sıralaması" showLevel />
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div style={s.app}>
        <div style={{ color: "#888" }}>Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div style={s.app}>
      <style>{`@keyframes floatUp{0%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-55px)}}`}</style>
      {gameState === "MENU" && renderMenu()}
      {gameState === "PLAYING" && renderPlaying()}
      {gameState === "GAMEOVER" && renderGameOver()}
      {ExitConfirmDialog}
    </div>
  );
};

const s: { [k: string]: React.CSSProperties } = {
  app: {
    width: "100%",
    height: "100vh",
    backgroundColor: "#0a0a0f",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif",
    overflow: "hidden",
    userSelect: "none",
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 50,
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 24,
    position: "relative",
    maxHeight: "100vh",
    overflowY: "auto",
    width: "100%",
  },
  gameWrap: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "14px 18px",
    maxWidth: 460,
    position: "relative",
    overflow: "hidden",
  },
  header: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingTop: 8,
  },
  title: { fontSize: "2.7rem", fontWeight: 900, marginBottom: 8, letterSpacing: 3, color: "#fff" },
  subtitle: { fontSize: "0.95rem", color: "#666", marginBottom: 34, letterSpacing: 1 },
  btn: {
    padding: "13px 32px",
    fontSize: "1.05rem",
    fontWeight: "bold",
    color: "#000",
    border: "none",
    borderRadius: 50,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  outlineBtn: {
    padding: "11px 24px",
    fontSize: "0.9rem",
    fontWeight: "bold",
    backgroundColor: "transparent",
    border: "2px solid",
    borderRadius: 50,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  iconBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 8,
    borderRadius: "50%",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progWrap: {
    width: "100%",
    height: 10,
    backgroundColor: "#1e1e2e",
    border: "1px solid #2a2a3a",
    borderRadius: 10,
    marginBottom: 18,
    overflow: "hidden",
  },
  progBar: { height: "100%", borderRadius: 10 },
  wordRow: { display: "flex", gap: 7, marginBottom: 10 },
  letterBox: {
    width: 42,
    height: 46,
    borderRadius: 9,
    border: "2px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.2rem",
    transition: "all 0.15s",
    fontFamily: "Georgia, serif",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 11,
    width: "100%",
    maxWidth: 330,
    marginBottom: 14,
  },
  tile: {
    borderRadius: 13,
    border: "2px solid",
    cursor: "pointer",
    transition: "all 0.1s",
    outline: "none",
    WebkitTapHighlightColor: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: "1/1",
    width: "100%",
  },
  wordListBox: {
    width: "100%",
    maxWidth: 330,
    backgroundColor: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: "9px 12px",
    maxHeight: 90,
    overflowY: "auto" as const,
  },
  wordListTitle: {
    fontSize: "0.7rem",
    color: "#555",
    display: "flex",
    alignItems: "center",
    marginBottom: 7,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },
  wordTags: { display: "flex", flexWrap: "wrap" as const, gap: 5 },
  tag: {
    fontSize: "0.75rem",
    fontWeight: "bold",
    padding: "2px 9px",
    borderRadius: 20,
    border: "1px solid",
    letterSpacing: 1,
  },
};

export default NeonBlitz;
