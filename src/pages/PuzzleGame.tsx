import { homeBackPath } from "@/utils/challengeBackPath";
import React, { useState, useEffect, useCallback, useRef } from "react";
import Lottie from "lottie-react";
import { Timer, RotateCcw, Trophy, ArrowLeft, Type } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import { useGameMute } from "@/hooks/useGameMute";
import { GameMuteButton } from "@/components/GameMuteButton";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";
import { playChallengeWinSound } from "@/utils/challengeWinSound";


interface GameState {
  board: number[];
  emptyIndex: number;
  moves: number;
  timeElapsed: number;
  isRunning: boolean;
  isCompleted: boolean;
  targetWord: string;
  started: boolean;
}

const DIFFICULTY = 3 as const;
const WORD_LENGTH = 8;

// Deterministic seeded PRNG (mulberry32)
const createSeededRandom = (seed: number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Deterministic daily seed from date string (Europe/Istanbul)
const getDailySeed = (dayOffset = 0): number => {
  const dayMs = 24 * 60 * 60 * 1000;
  const targetDate = new Date(Date.now() + dayOffset * dayMs);
  const dateKey = targetDate.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash;
};

// Deterministic daily word: same word for all players on the same day
// Also guarantees different word from previous day when possible
const getDailyWord = (words: string[]): string => {
  if (words.length === 0) return "PORTAKAL";
  if (words.length === 1) return words[0];

  const todayIndex = getDailySeed() % words.length;
  const yesterdayIndex = getDailySeed(-1) % words.length;

  if (todayIndex === yesterdayIndex) {
    return words[(todayIndex + 1) % words.length];
  }

  return words[todayIndex];
};

const PuzzleGamePage: React.FC = () => {
  const navigate = useNavigate();
  const { requestExit, ExitConfirmDialog } = useExitGameConfirm();
  const { muted, playSound } = useGameMute("puzzle");
  const {
    hasPlayedToday,
    todayScore,
    leaderboard,
    loading: challengeLoading,
    saveScore,
    markAsPlayed,
  } = useDailyChallenge("puzzle");

  const wordsRef = useRef<string[]>([]);
  const [isWordsLoaded, setIsWordsLoaded] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showCongratsDialog, setShowCongratsDialog] = useState(false);
  const [puzzleAnim, setPuzzleAnim] = useState<any>(null);


  useEffect(() => {
    fetch("/kelimePuzzle.json").then(r => r.json()).then(setPuzzleAnim).catch(() => {});
  }, []);

  const [gameState, setGameState] = useState<GameState>({
    board: [],
    emptyIndex: 8,
    moves: 0,
    timeElapsed: 0,
    isRunning: false,
    isCompleted: false,
    targetWord: "",
    started: false,
  });

  // Load words
  useEffect(() => {
    const fetchWords = async () => {
      try {
        const response = await fetch("/wordlist.txt");
        const text = await response.text();
        const allWords = text.split("\n").map((w) => w.trim().toLocaleUpperCase("tr-TR"));
        const words8 = allWords.filter((w) => w.length === WORD_LENGTH);
        if (words8.length === 0) words8.push("PORTAKAL", "BİLGİSAY", "ÇEKİRDEK");
        // Shuffle with a fixed seed for deterministic but non-alphabetical indexing
        words8.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        let shuffleSeed = 0x9e3779b9;
        for (let i = words8.length - 1; i > 0; i--) {
          shuffleSeed = (shuffleSeed ^ (shuffleSeed << 13)) >>> 0;
          shuffleSeed = (shuffleSeed ^ (shuffleSeed >> 17)) >>> 0;
          shuffleSeed = (shuffleSeed ^ (shuffleSeed << 5)) >>> 0;
          const j = shuffleSeed % (i + 1);
          [words8[i], words8[j]] = [words8[j], words8[i]];
        }
        wordsRef.current = words8;
        setIsWordsLoaded(true);
      } catch {
        wordsRef.current = ["PORTAKAL", "TEKNOLOJ"];
        setIsWordsLoaded(true);
      }
    };
    fetchWords();
  }, []);

  const initializeBoard = useCallback(() => {
    if (!wordsRef.current.length) return;

    const size = DIFFICULTY * DIFFICULTY;
    const dailyWord = getDailyWord(wordsRef.current);

    let board = Array.from({ length: size - 1 }, (_, i) => i + 1);
    board.push(0);

    // ✅ Deterministik karıştırma: herkes aynı board'u görür
    const seededRandom = createSeededRandom(getDailySeed() + 7919); // farklı seed offset

    let emptyIndex = size - 1;
    let previousIndex = -1;
    for (let i = 0; i < 100; i++) {
      const possibleMoves: number[] = [];
      const row = Math.floor(emptyIndex / DIFFICULTY);
      const col = emptyIndex % DIFFICULTY;

      if (row > 0) possibleMoves.push(emptyIndex - DIFFICULTY);
      if (row < DIFFICULTY - 1) possibleMoves.push(emptyIndex + DIFFICULTY);
      if (col > 0) possibleMoves.push(emptyIndex - 1);
      if (col < DIFFICULTY - 1) possibleMoves.push(emptyIndex + 1);

      const validMoves = possibleMoves.filter((idx) => idx !== previousIndex);
      if (validMoves.length > 0) {
        const randomMove = validMoves[Math.floor(seededRandom() * validMoves.length)];
        [board[emptyIndex], board[randomMove]] = [board[randomMove], board[emptyIndex]];
        previousIndex = emptyIndex;
        emptyIndex = randomMove;
      }
    }

    setGameState({
      board,
      emptyIndex,
      moves: 0,
      timeElapsed: 0,
      isRunning: false,
      isCompleted: false,
      targetWord: dailyWord,
      started: true,
    });
    scoreSavedRef.current = false;
  }, []);

  // Timer counting UP
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameState.isRunning && !gameState.isCompleted) {
      interval = setInterval(() => {
        setGameState((prev) => ({ ...prev, timeElapsed: prev.timeElapsed + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState.isRunning, gameState.isCompleted]);

  const scoreSavedRef = useRef(false);

  // Save score when completed: score = moves + time/5 (lower is better)
  useEffect(() => {
    if (gameState.isCompleted && gameState.moves > 0 && !scoreSavedRef.current) {
      scoreSavedRef.current = true;
      const finalScore = parseFloat((gameState.moves + gameState.timeElapsed / 5).toFixed(2));
      saveScore(finalScore, gameState.moves, {
        moves_count: gameState.moves,
        time_seconds: gameState.timeElapsed,
      });
      markAsPlayed();
      if (!muted) playChallengeWinSound();
      setShowCongratsDialog(true);
    }
  }, [gameState.isCompleted, gameState.moves, gameState.timeElapsed]);


  const isValidMove = (index: number, emptyIndex: number) => {
    const row = Math.floor(index / DIFFICULTY);
    const col = index % DIFFICULTY;
    const emptyRow = Math.floor(emptyIndex / DIFFICULTY);
    const emptyCol = emptyIndex % DIFFICULTY;
    return (Math.abs(row - emptyRow) === 1 && col === emptyCol) || (Math.abs(col - emptyCol) === 1 && row === emptyRow);
  };

  const makeMove = (index: number) => {
    if (gameState.isCompleted || !gameState.started || !isValidMove(index, gameState.emptyIndex)) return;

    const newBoard = [...gameState.board];
    [newBoard[index], newBoard[gameState.emptyIndex]] = [newBoard[gameState.emptyIndex], newBoard[index]];

    const newMoves = gameState.moves + 1;

    const currentLetters = newBoard.slice(0, -1).map((n) => gameState.targetWord[n - 1] || "");
    const targetLetters = gameState.targetWord.split("");
    const isSolved =
      newBoard[newBoard.length - 1] === 0 && currentLetters.every((letter, i) => letter === targetLetters[i]);

    if (isSolved) {
      playSound("correctWord");
      setGameState((prev) => ({
        ...prev,
        board: newBoard,
        emptyIndex: index,
        moves: newMoves,
        isCompleted: true,
        isRunning: false,
      }));
    } else {
      playSound("buttonClick");
      setGameState((prev) => ({
        ...prev,
        board: newBoard,
        emptyIndex: index,
        moves: newMoves,
        isRunning: true,
      }));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getLetterForTile = (number: number) => {
    if (number === 0) return "";
    return gameState.targetWord[number - 1] || "?";
  };

  if (!isWordsLoaded || challengeLoading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const calculateScore = () => {
    return (gameState.moves + gameState.timeElapsed / 5).toFixed(2);
  };

  return (
    <div
      className="fixed inset-0 flex flex-col text-slate-100 font-sans overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a1028 0%, #2d1b4e 50%, #1a1040 100%)" }}
    >
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playSound("buttonClick");
              requestExit(() => navigate(homeBackPath()), !gameState.started || gameState.isCompleted);
            }}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white">Kelime Puzzle</h1>
            <p className="text-[10px] text-purple-400/80">Harfleri doğru sıraya diz</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GameMuteButton gameId="puzzle" size={40} />
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <Trophy className="w-5 h-5 text-amber-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-5 pb-8">
        {showLeaderboard ? (
          <div className="flex-1 flex flex-col min-h-0 mt-4">
            <ChallengeLeaderboard
              leaderboard={leaderboard}
              title="Günlük Puzzle Sıralaması"
              scrollable
              showPuzzleColumns
              ascendingSort
            />
            <button
              onClick={() => setShowLeaderboard(false)}
              className="mt-3 shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform text-sm"
            >
              Oyuna Dön
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 mt-2 flex-1 overflow-y-auto">
            {/* Start Screen */}
            {!gameState.started && !gameState.isCompleted && (
              <div className="flex flex-col items-center gap-4 mt-8">
                <div className="bg-white/10 p-5 rounded-xl backdrop-blur-sm border border-white/10 w-full text-center">
                  <div className="flex justify-center mb-3">
                    {puzzleAnim ? (
                      // Yaklaşık 170. satırda, Lottie componentini şu şekilde güncelle:
<Lottie 
  animationData={puzzleAnim} 
  loop 
  autoplay 
  style={{ width: 120, height: 120 }} 
  rendererSettings={{
    preserveAspectRatio: 'xMidYMid slice'
  }}
/>
                    ) : (
                      <div className="text-4xl">🧩</div>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Kelime Puzzle</h2>
                  <p className="text-sm text-white/60 mb-1">3x3 ızgarada harfleri doğru sıraya diz</p>
                  <p className="text-xs text-white/40 mt-1">Skor = Hamle + Süre÷5</p>
                  <p className="text-xs text-white/40 mt-1">(en düşük puan = en iyi sıralama)</p>
                  <div className="mt-3 bg-amber-500/10 border border-amber-400/20 rounded-lg p-3">
                    <p className="text-xs text-amber-300 font-bold">🏆 1. Lik Ödülü</p>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <img src="/damlaMurekkep.webp" alt="mürekkep" className="w-5 h-5 object-contain brightness-110" />
                      <span className="text-sm text-white">3 Damla Mürekkep</span>
                    </div>
                  </div>
                </div>

                {hasPlayedToday ? (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center w-full">
                    <span className="text-sm text-slate-400">Bugün zaten oynadın! Yarın tekrar gel 🕐</span>
                    {todayScore != null && <div className="text-amber-400 font-bold mt-2">Skorun: {todayScore}</div>}
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      initializeBoard();
                      markAsPlayed();
                      playSound("buttonClick");
                    }}
                    disabled={!isWordsLoaded}
                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl font-bold text-white text-lg active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-purple-500/30"
                  >
                    🚀 Başlat
                  </button>
                )}

                <button
                  onClick={() => {
                    playSound("buttonClick");
                    navigate(homeBackPath());
                  }}
                  className="w-full px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform text-sm"
                >
                  Ana Sayfa
                </button>
              </div>
            )}

            {/* Game Area */}
            {gameState.started && (
              <>
                {/* Stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-white/80">
                      <Timer size={14} />
                      <span className="text-sm font-mono">{formatTime(gameState.timeElapsed)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/80">
                      <span className="text-sm">
                        Hamle: <span className="font-bold text-white">{gameState.moves}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Target Word */}
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <div className="text-center">
                    <div className="text-white/60 text-xs uppercase mb-1 flex items-center justify-center gap-1">
                      <Type size={12} />
                      Hedef Kelime
                    </div>
                    <div className="text-2xl font-bold text-white tracking-widest font-mono">
                      {gameState.targetWord}
                    </div>
                  </div>
                </div>

                {/* Game Board */}
                <div
                  className="grid gap-2 p-4 bg-black/20 rounded-2xl backdrop-blur-sm"
                  style={{ gridTemplateColumns: `repeat(${DIFFICULTY}, 1fr)` }}
                >
                  {gameState.board.map((number, index) => (
                    <button
                      key={index}
                      onClick={() => makeMove(index)}
                      disabled={gameState.isCompleted}
                      className={`aspect-square rounded-lg font-bold text-2xl transition-all duration-200 transform flex items-center justify-center ${
                        number === 0
                          ? "bg-transparent"
                          : `bg-gradient-to-br from-cyan-400 to-purple-500 text-white shadow-lg border-2 border-white/20 ${
                              isValidMove(index, gameState.emptyIndex) && !gameState.isCompleted
                                ? "hover:scale-105 active:scale-95 hover:shadow-cyan-400/50 cursor-pointer"
                                : "cursor-not-allowed opacity-70"
                            }`
                      }`}
                    >
                      {number !== 0 && getLetterForTile(number)}
                    </button>
                  ))}
                </div>

                {/* Completed */}
                {gameState.isCompleted && (
                  <div className="p-4 bg-green-500/20 border border-green-400/30 rounded-xl text-center">
                    <div className="text-green-400 font-bold text-lg mb-1">🎉 Harika!</div>
                    <div className="text-white font-semibold mb-1">"{gameState.targetWord}"</div>
                    <div className="text-white/80 text-sm">
                      {gameState.moves} hamlede, {formatTime(gameState.timeElapsed)} sürede tamamladın!
                    </div>
                    <div className="text-amber-400 font-bold text-lg mt-2">
                      Skor: {calculateScore()} (en düşük skor = en iyi sıralama)
                    </div>
                  </div>
                )}

                {/* Home button */}
                {(gameState.isCompleted || hasPlayedToday) && (
                  <button
                    onClick={() => {
                      playSound("buttonClick");
                      navigate(homeBackPath());
                    }}
                    className="shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform text-sm"
                  >
                    Ana Sayfa
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {showCongratsDialog && gameState.isCompleted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-5 animate-fade-in">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl border border-white/20 bg-[#1e2d45] shadow-2xl shadow-purple-950/50 p-6 text-center animate-scale-in"
          >
            <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-black text-white">🎉 Tebrikler!</div>
            <div className="mt-2 text-sm text-purple-200">
              "{gameState.targetWord}" kelimesini {gameState.moves} hamlede,{" "}
              {formatTime(gameState.timeElapsed)} sürede tamamladın!
            </div>
            <div className="mt-3 text-amber-400 font-bold text-lg">
              Skor: {calculateScore()}
            </div>
            <div className="mt-1 text-[11px] text-white/50">
              (en düşük skor = en iyi sıralama)
            </div>
            <button
              onClick={() => {
                playSound("buttonClick");
                setShowCongratsDialog(false);
              }}
              className="mt-5 w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl font-bold text-white active:scale-95 transition-transform shadow-lg shadow-purple-500/30"
            >
              Harika!
            </button>
          </div>
        </div>
      )}

      {ExitConfirmDialog}

    </div>
  );
};

export default PuzzleGamePage;
