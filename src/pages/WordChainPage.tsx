import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSounds } from "@/hooks/useSounds";
import { ArrowLeft, Clock, Send, Trophy, Link } from "lucide-react";
import { toast } from "sonner";
import {
  loadChallengeWordlist,
  isValidWord,
  getRandomWord,
  getWordsStartingWith,
} from "@/utils/challengeWordlist";

const GAME_DURATION = 90; // 90 seconds

const WordChainPage = () => {
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    loadChallengeWordlist().then(() => setLoading(false));
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startGame = useCallback(() => {
    // Pick a random starter word
    const starter = getRandomWord(3, 5);
    if (!starter) {
      toast.error("Kelime bulunamadı!");
      return;
    }
    const lastLetter = starter[starter.length - 1];
    
    setChain([starter]);
    setRequiredLetter(lastLetter);
    setCurrentWord("");
    setScore(10);
    setTimeLeft(GAME_DURATION);
    setLongestChain(1);
    setGameState("playing");
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
  }, [playSound]);

  const calculateWordPoints = (word: string, chainLen: number): number => {
    const basePoints = word.length * 5;
    const chainBonus = Math.floor(chainLen / 3) * 5; // Every 3 chain = +5 bonus
    return basePoints + chainBonus;
  };

  const submitWord = () => {
    if (gameState !== "playing" || currentWord.length < 3) return;

    const upper = currentWord.toLocaleUpperCase("tr-TR");

    // Check starts with required letter
    if (upper[0] !== requiredLetter) {
      toast.error(`"${requiredLetter}" harfi ile başlamalı!`);
      setCurrentWord("");
      return;
    }

    // Check not already used
    if (chain.includes(upper)) {
      toast.error("Bu kelimeyi zaten kullandın!");
      setCurrentWord("");
      return;
    }

    // Validate word
    if (!isValidWord(upper)) {
      toast.error("Geçersiz kelime!");
      playSound("wrongWord");
      setCurrentWord("");
      return;
    }

    const newChain = [...chain, upper];
    const points = calculateWordPoints(upper, newChain.length);
    const newLastLetter = upper[upper.length - 1];

    setChain(newChain);
    setRequiredLetter(newLastLetter);
    setScore((prev) => prev + points);
    setCurrentWord("");
    if (newChain.length > longestChain) setLongestChain(newChain.length);
    playSound("correctWord");
    toast.success(`+${points} puan! Zincir: ${newChain.length} 🔗`);

    // Check if there are valid words starting with the new last letter
    const available = getWordsStartingWith(newLastLetter);
    const unusedAvailable = available.filter(w => !newChain.includes(w));
    if (unusedAvailable.length === 0) {
      // Bonus for dead-end
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

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col text-slate-100 font-sans overflow-hidden" style={{ background: "linear-gradient(135deg, #1a0a00 0%, #2d1a05 50%, #3d2008 100%)" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => { navigate(-1); playSound("buttonClick"); }} className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white">⛓️ Kelime Zinciri</h1>
            <p className="text-[10px] text-amber-400/80">Son harfle yeni kelime</p>
          </div>
        </div>
        {gameState === "playing" && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${timeLeft <= 15 ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white"}`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      {/* Game Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {gameState === "ready" && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-6xl">⛓️</div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2">Kelime Zinciri</h2>
              <p className="text-sm text-slate-400 max-w-xs">
                Her kelimenin son harfiyle yeni bir kelime yaz! 90 saniye içinde en uzun zinciri kur!
              </p>
            </div>
            <div className="flex flex-col gap-1.5 text-xs text-slate-500">
              <span>• Örnek: KALEM → MASA → ARABA</span>
              <span>• Uzun kelimeler daha çok puan</span>
              <span>• Her 3 zincirde bonus puan</span>
            </div>
            <button onClick={startGame} className="px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl font-bold text-white text-lg active:scale-95 transition-transform shadow-lg shadow-amber-500/30">
              Başla! 🚀
            </button>
          </div>
        )}

        {gameState === "playing" && (
          <div className="flex flex-col gap-4 mt-4">
            {/* Score & Chain Count */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-amber-400">{score} puan</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Link className="w-3.5 h-3.5" />
                <span>Zincir: {chain.length}</span>
              </div>
            </div>

            {/* Required Letter Banner */}
            <div className="bg-amber-500/20 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-center gap-3">
              <span className="text-sm text-amber-300/80">Sıradaki harf:</span>
              <span className="text-4xl font-black text-amber-400">{requiredLetter}</span>
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 flex items-center">
                <span className="text-amber-400 font-bold text-lg mr-1">{requiredLetter}</span>
                <input
                  ref={inputRef}
                  value={currentWord.length > 0 ? currentWord.slice(1) : ""}
                  onChange={(e) => {
                    const val = requiredLetter + e.target.value.toLocaleUpperCase("tr-TR");
                    setCurrentWord(val);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && submitWord()}
                  placeholder="devamını yaz..."
                  className="bg-transparent text-white font-bold text-lg w-full outline-none placeholder:text-slate-600"
                />
              </div>
              <button
                onClick={submitWord}
                disabled={currentWord.length < 3}
                className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-30 disabled:active:scale-100 shadow-lg shadow-amber-500/30"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Chain Visualization */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 max-h-60 overflow-y-auto">
              <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">Zincir</h3>
              <div className="flex flex-wrap gap-1.5 items-center">
                {chain.map((word, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-xl text-xs font-bold border border-amber-500/20">
                      {word}
                    </span>
                    {i < chain.length - 1 && (
                      <span className="text-amber-500/50 text-xs">→</span>
                    )}
                  </div>
                ))}
                <div ref={chainEndRef} />
              </div>
            </div>
          </div>
        )}

        {gameState === "finished" && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-6xl">{chain.length >= 10 ? "🏆" : chain.length >= 5 ? "🔥" : "⛓️"}</div>
            <div className="text-center">
              <h2 className="text-2xl font-black text-white mb-1">Süre Doldu!</h2>
              <p className="text-4xl font-black text-amber-400">{score} Puan</p>
              <p className="text-sm text-slate-400 mt-2">Zincir uzunluğu: {chain.length} kelime</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full max-w-xs max-h-40 overflow-y-auto">
              <div className="flex flex-wrap gap-1.5">
                {chain.map((word, i) => (
                  <span key={i} className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-[10px] font-bold">
                    {word}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={startGame} className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl font-bold text-white active:scale-95 transition-transform">
                Tekrar Oyna 🔄
              </button>
              <button onClick={() => navigate("/")} className="px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform">
                Ana Sayfa
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WordChainPage;
