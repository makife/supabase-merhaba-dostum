import { useState, useEffect, useCallback, useRef } from "react";
import { playChallengeWinSound } from "@/utils/challengeWinSound";
import { useNavigate } from "react-router-dom";
import { useSounds } from "@/hooks/useSounds";
import { ArrowLeft, Clock, Check, SkipForward, Trophy, Lock } from "lucide-react";
import { toast } from "sonner";
import { loadChallengeWordlist, getRandomWord } from "@/utils/challengeWordlist";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";

const LEVELS = [
  { wordLen: 3, timeLimit: 30, points: 15 },
  { wordLen: 4, timeLimit: 30, points: 25 },
  { wordLen: 5, timeLimit: 30, points: 40 },
  { wordLen: 6, timeLimit: 35, points: 60 },
  { wordLen: 7, timeLimit: 40, points: 85 },
];

const shuffleWord = (word: string): string => {
  const arr = word.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const shuffled = arr.join("");
  return shuffled === word ? shuffleWord(word) : shuffled;
};

const AnagramPage = () => {
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { hasPlayedToday, todayScore, leaderboard, loading: challengeLoading, saveScore } = useDailyChallenge("anagram");

  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<"ready" | "playing" | "finished">("ready");
  const [currentLevel, setCurrentLevel] = useState(0);
  const [targetWord, setTargetWord] = useState("");
  const [scrambled, setScrambled] = useState("");
  const [selectedLetters, setSelectedLetters] = useState<number[]>([]);
  const [userAnswer, setUserAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [correctCount, setCorrectCount] = useState(0);
  const [results, setResults] = useState<{ word: string; correct: boolean; points: number }[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const scoreSavedRef = useRef(false);
  const timeBonusRef = useRef(0);

  useEffect(() => {
    loadChallengeWordlist().then(() => setLoading(false));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Save score when finished
  useEffect(() => {
    if (gameState === "finished" && !scoreSavedRef.current && !hasPlayedToday) {
      scoreSavedRef.current = true;
      saveScore(score, correctCount);
      playChallengeWinSound();
    }
  }, [gameState]);

  const loadLevel = useCallback((level: number) => {
    const config = LEVELS[level];
    const word = getRandomWord(config.wordLen, config.wordLen);
    if (!word) {
      toast.error("Kelime bulunamadı!");
      return;
    }
    setTargetWord(word);
    setScrambled(shuffleWord(word));
    setSelectedLetters([]);
    setUserAnswer("");
    setTimeLeft(config.timeLimit);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleLevelEnd(false, word, level);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleLevelEnd = (correct: boolean, word: string, level: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const basePoints = correct ? LEVELS[level].points : 0;
    const levelTimeBonus = correct ? Math.floor(timeLeft * 1.5) : 0;
    const totalPoints = basePoints + levelTimeBonus;
    if (correct) timeBonusRef.current += levelTimeBonus;

    setResults(prev => [...prev, { word, correct, points: totalPoints }]);
    if (correct) {
      setScore(prev => prev + totalPoints);
      setCorrectCount(prev => prev + 1);
      playSound("correctWord");
      toast.success(`Doğru! +${basePoints} + ⏱${levelTimeBonus} bonus 🎉`);
    } else {
      playSound("wrongWord");
      toast.error(`Cevap: ${word}`);
    }

    setTimeout(() => {
      if (level < LEVELS.length - 1) {
        const next = level + 1;
        setCurrentLevel(next);
        loadLevel(next);
      } else {
        setGameState("finished");
      }
    }, 1500);
  };

  const startGame = () => {
    if (hasPlayedToday) {
      toast.error("Bugün zaten oynadın! Yarın tekrar gel 🕐");
      return;
    }
    timeBonusRef.current = 0;
    scoreSavedRef.current = false;
    setCurrentLevel(0);
    setScore(0);
    setCorrectCount(0);
    setResults([]);
    setGameState("playing");
    loadLevel(0);
    playSound("buttonClick");
  };

  const handleLetterClick = (index: number) => {
    if (selectedLetters.includes(index)) return;
    const newSelected = [...selectedLetters, index];
    setSelectedLetters(newSelected);
    const newAnswer = newSelected.map(i => scrambled[i]).join("");
    setUserAnswer(newAnswer);
    playSound("buttonClick");

    if (newAnswer.length === targetWord.length) {
      setTimeout(() => {
        const isCorrect = newAnswer === targetWord;
        handleLevelEnd(isCorrect, targetWord, currentLevel);
      }, 300);
    }
  };

  const undoLetter = () => {
    if (selectedLetters.length === 0) return;
    const newSelected = selectedLetters.slice(0, -1);
    setSelectedLetters(newSelected);
    setUserAnswer(newSelected.map(i => scrambled[i]).join(""));
  };

  const skipLevel = () => handleLevelEnd(false, targetWord, currentLevel);

  if (loading || challengeLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col text-slate-100 font-sans overflow-hidden" style={{ background: "linear-gradient(135deg, #12082a 0%, #1e1045 50%, #2d1560 100%)" }}>
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => { 
            if (gameState === "playing") {
              if (timerRef.current) clearInterval(timerRef.current);
              setGameState("finished");
            } else {
              navigate(-1);
            }
            playSound("buttonClick"); 
          }} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white">🔤 Anagram</h1>
            <p className="text-[10px] text-violet-400/80">Karışık harfleri çöz</p>
          </div>
        </div>
        {gameState === "playing" && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${timeLeft <= 10 ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white"}`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono font-bold text-sm">{timeLeft}s</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-5 pb-8">
        {gameState === "ready" && (
          <div className="flex flex-col items-center gap-5 pt-6 flex-1 min-h-0">
            <div className="text-6xl shrink-0">🔤</div>
            <div className="text-center shrink-0">
              <h2 className="text-xl font-bold text-white mb-2">Anagram Challenge</h2>
              <p className="text-sm text-slate-400 max-w-xs">5 seviye karışık harf! Doğru kelimeyi bul.</p>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-slate-500 shrink-0">
              {LEVELS.map((l, i) => (
                <span key={i}>Seviye {i + 1}: {l.wordLen} harf — {l.points} puan — {l.timeLimit}s</span>
              ))}
            </div>

            {hasPlayedToday ? (
              <div className="shrink-0 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">Bugün oynadın!</span>
                <span className="text-sm font-bold text-violet-400">{todayScore} puan</span>
              </div>
            ) : (
              <button onClick={startGame} className="shrink-0 px-8 py-3 bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl font-bold text-white text-lg active:scale-95 transition-transform shadow-lg shadow-violet-500/30">
                Başla! 🚀
              </button>
            )}

            <div className="w-full max-w-sm mt-2 flex-1 min-h-0 flex flex-col">
              <ChallengeLeaderboard leaderboard={leaderboard} scrollable />
            </div>
          </div>
        )}

        {gameState === "playing" && (
          <div className="flex flex-col items-center gap-6 mt-8">
            <div className="flex items-center gap-2">
              {LEVELS.map((_, i) => (
                <div key={i} className={`w-8 h-1.5 rounded-full transition-all ${
                  i < currentLevel ? "bg-emerald-400" : i === currentLevel ? "bg-violet-400" : "bg-white/10"
                }`} />
              ))}
            </div>
            <div className="text-center">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Seviye {currentLevel + 1}/{LEVELS.length}</span>
              <p className="text-sm text-violet-300 font-medium mt-1">{LEVELS[currentLevel].wordLen} harfli kelime</p>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-amber-400">{score} puan</span>
            </div>

            <div className="flex gap-2 mb-2">
              {targetWord.split("").map((_, i) => (
                <div key={i} className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-black transition-all ${
                  userAnswer[i] ? "bg-violet-500/30 border-violet-400/50 text-white" : "bg-white/5 border-white/10 text-slate-600"
                }`}>
                  {userAnswer[i] || ""}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              {scrambled.split("").map((letter, i) => {
                const isUsed = selectedLetters.includes(i);
                return (
                  <button key={i} onClick={() => handleLetterClick(i)} disabled={isUsed}
                    className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-black transition-all active:scale-90 ${
                      isUsed ? "bg-white/5 border border-white/5 text-slate-700 scale-90"
                        : "bg-gradient-to-b from-violet-500/40 to-purple-600/40 border border-violet-400/30 text-white hover:from-violet-400/50 hover:to-purple-500/50"
                    }`}>
                    {letter}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={undoLetter} disabled={selectedLetters.length === 0} className="px-5 py-2.5 bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-white active:scale-95 transition-transform disabled:opacity-30">
                Geri Al ↩
              </button>
              <button onClick={skipLevel} className="px-5 py-2.5 bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-slate-400 active:scale-95 transition-transform flex items-center gap-1.5">
                <SkipForward className="w-3.5 h-3.5" /> Atla
              </button>
            </div>
          </div>
        )}

        {gameState === "finished" && (
          <div className="flex flex-col items-center gap-5 pt-6 flex-1 min-h-0">
            <div className="text-6xl shrink-0">{correctCount >= 4 ? "🏆" : correctCount >= 2 ? "🎉" : "💪"}</div>
            <div className="text-center shrink-0">
              <h2 className="text-2xl font-black text-white mb-1">Bitti!</h2>
              <p className="text-4xl font-black text-violet-400">{score} Puan</p>
              <p className="text-sm text-slate-400 mt-2">{correctCount}/{LEVELS.length} doğru</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full max-w-xs shrink-0">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg ${r.correct ? "text-emerald-400" : "text-red-400"}`}>{r.correct ? "✓" : "✗"}</span>
                    <span className="text-sm text-white font-bold">{r.word}</span>
                  </div>
                  <span className={`text-xs font-bold ${r.correct ? "text-emerald-400" : "text-slate-600"}`}>
                    {r.correct ? `+${r.points}` : "0"}
                  </span>
                </div>
              ))}
            </div>

            <div className="w-full max-w-sm flex-1 min-h-0 flex flex-col">
              <ChallengeLeaderboard leaderboard={leaderboard} scrollable />
            </div>

            <button onClick={() => { playSound("buttonClick"); navigate("/"); }} className="shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform">
              Ana Sayfa
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnagramPage;
