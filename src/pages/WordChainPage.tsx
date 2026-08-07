import { homeBackPath } from "@/utils/challengeBackPath";
import { useState, useEffect, useCallback, useRef } from "react";
import { playChallengeWinSound } from "@/utils/challengeWinSound";
import { useNavigate } from "react-router-dom";
import { useGameMute } from "@/hooks/useGameMute";
import { GameMuteButton } from "@/components/GameMuteButton";
import { ArrowLeft, Clock, Send, Trophy, Link, Lock } from "lucide-react";
import { toast } from "sonner";
import { TurkishKeyboard } from "@/components/TurkishKeyboard";
import {
  loadChallengeWordlist,
  isValidWord,
  getRandomWord,
  getWordsStartingWith,
} from "@/utils/challengeWordlist";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";

const GAME_DURATION = 90;

const WordChainPage = () => {
  const navigate = useNavigate();
  const { requestExit, ExitConfirmDialog } = useExitGameConfirm();
  const { muted, playSound } = useGameMute("word_chain");
  const inputRef = useRef<HTMLInputElement>(null);
  const { hasPlayedToday, todayScore, leaderboard, loading: challengeLoading, saveScore } = useDailyChallenge("word_chain");

  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<"ready" | "playing" | "finished">("ready");
  const [chain, setChain] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState("");
  const [requiredLetter, setRequiredLetter] = useState("");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [longestChain, setLongestChain] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chainEndRef = useRef<HTMLDivElement>(null);
  const scoreSavedRef = useRef(false);
  const lastWordTimeRef = useRef<number>(0);

  useEffect(() => {
    loadChallengeWordlist().then(() => setLoading(false));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Save score when finished
  useEffect(() => {
    if (gameState === "finished" && !scoreSavedRef.current && !hasPlayedToday) {
      scoreSavedRef.current = true;
      const finalScore = parseFloat(score.toFixed(2));
      saveScore(finalScore, chain.length);
      if (!muted) playChallengeWinSound();
    }
  }, [gameState]);

  const startGame = useCallback(() => {
    if (hasPlayedToday) {
      toast.error("Bugün zaten oynadın! Yarın tekrar gel 🕐");
      return;
    }
    scoreSavedRef.current = false;
    const starter = getRandomWord(3, 5);
    if (!starter) {
      toast.error("Kelime bulunamadı!");
      return;
    }
    const lastLetter = starter[starter.length - 1];

    setChain([starter]);
    setRequiredLetter(lastLetter);
    setCurrentWord(lastLetter);
    setScore(10);
    setTimeLeft(GAME_DURATION);
    setLongestChain(1);
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

    setTimeout(() => inputRef.current?.focus(), 300);
  }, [playSound, hasPlayedToday]);

  const calculateWordPoints = (word: string, chainLen: number): number => {
    const basePoints = word.length * 5;
    const chainBonus = Math.floor(chainLen / 3) * 5;
    return basePoints + chainBonus;
  };

  const submitWord = () => {
    if (gameState !== "playing" || currentWord.length < 3) return;
    const upper = currentWord.toLocaleUpperCase("tr-TR");

    if (upper[0] !== requiredLetter) {
      toast.error(`"${requiredLetter}" harfi ile başlamalı!`);
      setCurrentWord(requiredLetter);
      return;
    }
    if (chain.includes(upper)) {
      toast.error("Bu kelimeyi zaten kullandın!");
      setCurrentWord(requiredLetter);
      return;
    }
    if (!isValidWord(upper)) {
      toast.error("Geçersiz kelime!");
      playSound("wrongWord");
      setCurrentWord(requiredLetter);
      return;
    }

    const newChain = [...chain, upper];
    const basePoints = calculateWordPoints(upper, newChain.length);
    const now = Date.now();
    const elapsedSec = Math.max(1, (now - lastWordTimeRef.current) / 1000);
    const points = parseFloat((basePoints / elapsedSec).toFixed(2));
    lastWordTimeRef.current = now;
    const newLastLetter = upper[upper.length - 1];

    setChain(newChain);
    setRequiredLetter(newLastLetter);
    setScore((prev) => parseFloat((prev + points).toFixed(2)));
    setCurrentWord(newLastLetter);
    if (newChain.length > longestChain) setLongestChain(newChain.length);
    playSound("correctWord");
    toast.success(`+${points.toFixed(1)} puan! (${basePoints}÷${elapsedSec.toFixed(0)}s) Zincir: ${newChain.length} 🔗`);

    const available = getWordsStartingWith(newLastLetter);
    const unusedAvailable = available.filter(w => !newChain.includes(w));
    if (unusedAvailable.length === 0) {
      toast.info("Bu harfle başlayan kelime kalmadı! Zincir tamamlandı! 🎊", { duration: 3000 });
      setScore(prev => prev + 25);
      clearInterval(timerRef.current!);
      setTimeout(() => setGameState("finished"), 2000);
    }

    setTimeout(() => {
      chainEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }, 100);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (loading || challengeLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col text-slate-100 font-sans overflow-hidden" style={{ background: "linear-gradient(135deg, #1a0a00 0%, #2d1a05 50%, #3d2008 100%)" }}>
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => {
            playSound("buttonClick");
            requestExit(() => {
              if (gameState === "playing") {
                clearInterval(timerRef.current!);
                setGameState("finished");
              } else {
                navigate(homeBackPath());
              }
            }, gameState !== "playing");
          }} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white">⛓️ Kelime Zinciri</h1>
            <p className="text-[10px] text-yellow-400">Son harfle yeni kelime</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {gameState === "playing" && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${timeLeft <= 15 ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white"}`}>
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
            </div>
          )}
          <GameMuteButton gameId="word_chain" size={40} />
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto px-5 ${gameState === "playing" ? "pb-2" : "pb-8"}`}>
        {gameState === "ready" && (
          <div className="flex flex-col items-center justify-center gap-6 pt-8">
            <div className="text-6xl">⛓️</div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2">Kelime Zinciri</h2>
              <p className="text-sm text-slate-400 max-w-xs">Her kelimenin son harfiyle yeni bir kelime yaz! 90 saniye!</p>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-slate-500">
              <span>• Örnek: KALEM → MASA → ARABA</span>
              <span>• Uzun kelimeler daha çok puan</span>
              <span>• Her 3 zincirde bonus puan</span>
            </div>

            {hasPlayedToday ? (
              <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">Bugün oynadın!</span>
                <span className="text-sm font-bold text-yellow-400">{todayScore} puan</span>
              </div>
            ) : (
              <button onClick={startGame} className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl font-bold text-white text-lg active:scale-95 transition-transform shadow-lg shadow-yellow-500/40">
                Başla! 🚀
              </button>
            )}

            <div className="w-full max-w-sm mt-2">
              <ChallengeLeaderboard leaderboard={leaderboard} />
            </div>
          </div>
        )}

        {gameState === "playing" && (
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="font-bold text-yellow-400">{score} puan</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Link className="w-3.5 h-3.5" />
                <span>Zincir: {chain.length}</span>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center min-h-[48px]">
              <span className="text-yellow-400 font-bold text-lg mr-1">{requiredLetter}</span>
              <span className="text-white font-bold text-lg">
                {currentWord.length > 1 ? currentWord.slice(1) : ""}
              </span>
              {currentWord.length <= 1 && (
                <span className="text-slate-600 text-lg">devamını yaz...</span>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 max-h-36 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5 items-center">
                {chain.map((word, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-lg text-[11px] font-bold border border-yellow-500/30">{word}</span>
                    {i < chain.length - 1 && <span className="text-yellow-500/60 text-[10px]">→</span>}
                  </div>
                ))}
                <div ref={chainEndRef} />
              </div>
            </div>
          </div>
        )}

        {gameState === "finished" && (
          <div className="flex flex-col items-center justify-center gap-6 pt-8">
            <div className="text-6xl">{chain.length >= 10 ? "🏆" : chain.length >= 5 ? "🔥" : "⛓️"}</div>
            <div className="text-center">
              <h2 className="text-2xl font-black text-white mb-1">Süre Doldu!</h2>
              <p className="text-4xl font-black text-yellow-400">{score} Puan</p>
              <p className="text-sm text-slate-400 mt-2">Zincir uzunluğu: {chain.length} kelime</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full max-w-xs max-h-40 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {chain.map((word, i) => (
                  <span key={i} className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded-lg text-[10px] font-bold">{word}</span>
                ))}
              </div>
            </div>

            <div className="w-full max-w-sm">
              <ChallengeLeaderboard leaderboard={leaderboard} />
            </div>

            <button onClick={() => { playSound("buttonClick"); navigate(homeBackPath()); }} className="px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform">
              Ana Sayfa
            </button>
          </div>
        )}
      </div>

      {/* Fixed keyboard at bottom when playing */}
      {gameState === "playing" && (
        <div className="shrink-0 border-t border-white/5 bg-black/40 backdrop-blur-md pb-safe mb-20">
          <TurkishKeyboard
            onKeyPress={(letter) => {
              if (currentWord.length === 0) {
                setCurrentWord(requiredLetter + letter);
              } else {
                setCurrentWord((prev) => prev + letter);
              }
              playSound("buttonClick");
            }}
            onBackspace={() => {
              setCurrentWord((prev) => {
                if (prev.length <= 1) return requiredLetter;
                return prev.slice(0, -1);
              });
            }}
            onSubmit={submitWord}
            disabled={gameState !== "playing"}
            highlightLetter={requiredLetter}
          />
        </div>
      )}
      {ExitConfirmDialog}
    </div>
  );
};

export default WordChainPage;
