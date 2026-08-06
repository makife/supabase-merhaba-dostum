import { homeBackPath } from "@/utils/challengeBackPath";
import { useState, useEffect, useCallback, useRef } from "react";
import { playChallengeWinSound } from "@/utils/challengeWinSound";
import { useNavigate } from "react-router-dom";

import { ArrowLeft, Clock, Send, Trophy, RotateCcw, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  loadChallengeWordlist,
  isValidWord,
  generateLetterPool,
  canFormWord,
} from "@/utils/challengeWordlist";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";
import { useGameMute } from "@/hooks/useGameMute";
import { GameMuteButton } from "@/components/GameMuteButton";
 
const GAME_DURATION = 120;
const LETTER_COUNT = 14;
 
const WordHuntPage = () => {
  const navigate = useNavigate();
  const { requestExit, ExitConfirmDialog } = useExitGameConfirm();
  const { muted, playSound } = useGameMute("word_hunt");
  const inputRef = useRef<HTMLInputElement>(null);
  const { hasPlayedToday, todayScore, leaderboard, loading: challengeLoading, saveScore } = useDailyChallenge("word_hunt");
 
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<"ready" | "playing" | "finished">("ready");
  const [letters, setLetters] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState("");
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastWordTimeRef = useRef<number>(0); // timestamp of last scored word (or game start)
 
  useEffect(() => {
    loadChallengeWordlist().then(() => setLoading(false));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);
 
  const startGame = useCallback(() => {
    if (hasPlayedToday) {
      toast.error("Bugün zaten oynadın! Yarın tekrar gel 🕐");
      return;
    }
    const pool = generateLetterPool(LETTER_COUNT);
    setLetters(pool);
    setFoundWords([]);
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setCurrentWord("");
    setGameState("playing");
    lastWordTimeRef.current = Date.now();
    playSound("buttonClick");
 
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setGameState("finished");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [playSound, hasPlayedToday]);
 
  // Save score when game finishes
  useEffect(() => {
    if (gameState === "finished" && !hasPlayedToday) {
      // Score is already calculated per-word with time factor, save as-is
      const finalScore = parseFloat(score.toFixed(2));
      saveScore(finalScore, foundWords.length);
      if (!muted) playChallengeWinSound();
    }
  }, [gameState]);
 
  const handleLetterClick = (letter: string, index: number) => {
    if (gameState !== "playing") return;
    setCurrentWord((prev) => prev + letter);
    playSound("buttonClick");
  };
 
  const calculateWordPoints = (word: string): number => {
    const len = word.length;
    if (len === 3) return 10;
    if (len === 4) return 20;
    if (len === 5) return 35;
    if (len === 6) return 50;
    if (len === 7) return 70;
    return 70 + (len - 7) * 15;
  };
 
  const submitWord = () => {
    if (gameState !== "playing" || currentWord.length < 3) return;
    const upper = currentWord.toLocaleUpperCase("tr-TR");
 
    if (foundWords.includes(upper)) {
      toast.error("Bu kelimeyi zaten buldun!");
      setCurrentWord("");
      return;
    }
    if (!canFormWord(upper, letters)) {
      toast.error("Bu harfler havuzda yok!");
      setCurrentWord("");
      return;
    }
    if (!isValidWord(upper)) {
      toast.error("Geçersiz kelime!");
      playSound("wrongWord");
      setCurrentWord("");
      return;
    }
 
    const basePoints = calculateWordPoints(upper);
    const now = Date.now();
    const elapsedSec = Math.max(1, (now - lastWordTimeRef.current) / 1000);
    const points = parseFloat((basePoints / elapsedSec).toFixed(2));
    lastWordTimeRef.current = now;
    setScore((prev) => parseFloat((prev + points).toFixed(2)));
    setFoundWords((prev) => [...prev, upper]);
    setCurrentWord("");
    playSound("correctWord");
    toast.success(`+${points.toFixed(1)} puan! (${basePoints}÷${elapsedSec.toFixed(0)}s) 🎯`);
  };
 
  const clearWord = () => setCurrentWord("");
 
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };
 
  if (loading || challengeLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
 
  return (
    <div className="fixed inset-0 flex flex-col text-slate-100 font-sans overflow-hidden" style={{ background: "linear-gradient(135deg, #0a1628 0%, #132240 50%, #0d3320 100%)" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => {
            playSound("buttonClick");
            requestExit(() => {
              if (gameState === "playing") {
                clearInterval(timerRef.current!);
                setGameState("finished");
              } else {
                navigate(-1);
              }
            }, gameState !== "playing");
          }} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white">🔍 Kelime Avı</h1>
            <p className="text-[10px] text-emerald-400/80">Harflerden kelime oluştur</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {gameState === "playing" && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${timeLeft <= 15 ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white"}`}>
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
            </div>
          )}
          <GameMuteButton gameId="word_hunt" size={40} />
        </div>
      </div>
 
      {/* Game Content */}
      <div className="flex-1 flex flex-col overflow-hidden px-5 pb-8">
        {gameState === "ready" && (
          <div className="flex flex-col items-center gap-5 pt-6 flex-1 min-h-0">
            <div className="text-6xl shrink-0">🔍</div>
            <div className="text-center shrink-0">
              <h2 className="text-xl font-bold text-white mb-2">Kelime Avı</h2>
              <p className="text-sm text-slate-400 max-w-xs">
                Verilen harflerden 2 dakika içinde mümkün olduğunca çok kelime bul!
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs text-slate-500 shrink-0">
              <span>• 3 harf = 10 puan</span>
              <span>• 4 harf = 20 puan</span>
              <span>• 5 harf = 35 puan</span>
              <span>• 6+ harf = 50+ puan</span>
            </div>
 
            {hasPlayedToday ? (
              <div className="flex flex-col items-center gap-3 shrink-0">
                <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-400">Bugün oynadın!</span>
                  <span className="text-sm font-bold text-emerald-400">{todayScore} puan</span>
                </div>
              </div>
            ) : (
              <button onClick={startGame} className="shrink-0 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl font-bold text-white text-lg active:scale-95 transition-transform shadow-lg shadow-emerald-500/30">
                Başla! 🚀
              </button>
            )}
 
            {/* Leaderboard */}
            <div className="w-full max-w-sm mt-2 flex-1 min-h-0 flex flex-col">
              <ChallengeLeaderboard leaderboard={leaderboard} scrollable />
            </div>
          </div>
        )}
 
        {gameState === "playing" && (
          <div className="flex flex-col gap-5 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-amber-400">{score} puan</span>
              </div>
              <span className="text-xs text-slate-500">{foundWords.length} kelime bulundu</span>
            </div>
 
            <div className="rounded-3xl p-5" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)" }}>
              <div className="flex flex-wrap gap-2.5 justify-center">
                {letters.map((letter, i) => (
                  <button key={i} onClick={() => handleLetterClick(letter, i)} className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-black active:scale-90 transition-transform" style={{ background: "linear-gradient(160deg, #ffffff 0%, #f0fdf4 100%)", color: "#064e3b", border: "2px solid #10b981", letterSpacing: "0.05em" }}>
                    {letter}
                  </button>
                ))}
              </div>
            </div>
 
            <div className="flex gap-2">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center">
                <input
                  ref={inputRef}
                  value={currentWord}
                  onChange={(e) => setCurrentWord(e.target.value.toLocaleUpperCase("tr-TR"))}
                  onKeyDown={(e) => e.key === "Enter" && submitWord()}
                  placeholder="Kelime yaz veya harflere tıkla..."
                  className="bg-transparent text-white font-bold text-lg w-full outline-none placeholder:text-slate-600"
                />
                {currentWord && (
                  <button onClick={clearWord} className="text-slate-500 hover:text-white ml-2">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button onClick={submitWord} disabled={currentWord.length < 3} className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30 disabled:active:scale-100 shadow-lg shadow-emerald-500/30">
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
 
            {foundWords.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Bulunan Kelimeler</h3>
                <div className="flex flex-wrap gap-2">
                  {foundWords.map((word, i) => (
                    <span key={i} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-xl text-xs font-bold border border-emerald-500/20">
                      {word} (+{calculateWordPoints(word)})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
 
        {gameState === "finished" && (
          <div className="flex flex-col items-center gap-5 pt-6 flex-1 min-h-0">
            <div className="text-6xl shrink-0">🏆</div>
            <div className="text-center shrink-0">
              <h2 className="text-2xl font-black text-white mb-1">Süre Doldu!</h2>
              <p className="text-4xl font-black text-emerald-400">{score.toFixed(2)} Puan</p>
              <p className="text-sm text-slate-400 mt-2">{foundWords.length} kelime buldun</p>
            </div>
 
            {foundWords.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full max-w-xs max-h-24 overflow-y-auto shrink-0">
                <div className="flex flex-wrap gap-2 justify-center">
                  {foundWords.map((word, i) => (
                    <span key={i} className="px-2 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg text-[10px] font-bold">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
 
            {/* Leaderboard */}
            <div className="w-full max-w-sm flex-1 min-h-0 flex flex-col">
              <ChallengeLeaderboard leaderboard={leaderboard} scrollable />
            </div>
 
            <button onClick={() => { playSound("buttonClick"); navigate(homeBackPath()); }} className="shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform">
              Ana Sayfa
            </button>
          </div>
        )}
      </div>
      {ExitConfirmDialog}
    </div>
  );
};
 
export default WordHuntPage;
 
