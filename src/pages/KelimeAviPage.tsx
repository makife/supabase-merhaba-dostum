import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSounds } from "@/hooks/useSounds";
import { ArrowLeft, Clock, Trophy, Lock, Zap } from "lucide-react";
import { toast } from "sonner";
import { loadChallengeWordlist, isValidWord } from "@/utils/challengeWordlist";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import Lottie from "lottie-react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";


const GAME_DURATION = 90;
const GRID = 5;

// Frequency-weighted Turkish letter pool for grid generation
const VOWELS = "AAAAAEEEEEIİİOÖUÜ";
const CONS = "BBCÇDDFGĞHKKLLMMNNPRRSŞTTVYZ";

function generateGrid(): string[] {
  const cells: string[] = [];
  // ~40% vowels for playability
  const vowelCount = Math.round(GRID * GRID * 0.4);
  for (let i = 0; i < vowelCount; i++) {
    cells.push(VOWELS[Math.floor(Math.random() * VOWELS.length)]);
  }
  for (let i = vowelCount; i < GRID * GRID; i++) {
    cells.push(CONS[Math.floor(Math.random() * CONS.length)]);
  }
  // shuffle
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells;
}

const wordPoints = (len: number) => {
  if (len <= 3) return 5;
  if (len === 4) return 10;
  if (len === 5) return 20;
  if (len === 6) return 35;
  if (len === 7) return 55;
  return 55 + (len - 7) * 20;
};

const isAdjacent = (a: number, b: number) => {
  if (a === b) return false;
  const ar = Math.floor(a / GRID), ac = a % GRID;
  const br = Math.floor(b / GRID), bc = b % GRID;
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1;
};

const KelimeAviPage = () => {
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { profile, refreshProfile } = useUser();
  const { hasPlayedToday, todayScore, leaderboard, loading: challengeLoading, saveScore, markAsPlayed } =
    useDailyChallenge("kelime_avi" as any);

  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<"ready" | "playing" | "finished">("ready");
  const [letters, setLetters] = useState<string[]>([]);
  const [path, setPath] = useState<number[]>([]);
  const [foundWords, setFoundWords] = useState<{ w: string; p: number }[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [rocketAnim, setRocketAnim] = useState<any>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const pendingMin = Number((profile as any)?.pending_boost_minutes || 0);
  const boostUntil = (profile as any)?.score_boost_until ? new Date((profile as any).score_boost_until) : null;
  const boostActive = !!boostUntil && boostUntil.getTime() > Date.now();

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    loadChallengeWordlist().then(() => setLoading(false));
    fetch("/boostRoket.json").then(r => r.json()).then(setRocketAnim).catch(() => {});
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleClaimBoost = async () => {
    if (claiming || pendingMin <= 0) return;
    setClaiming(true);
    playSound("buttonClick");
    const { data, error } = await supabase.rpc("claim_score_boost" as any);
    if (error || !(data as any)?.success) {
      toast.error("Boost aktif edilemedi");
    } else {
      toast.success(`⚡ ${(data as any).minutes_added} dakikalık x2 boost aktif!`);
      await refreshProfile(true);
    }
    setClaiming(false);
  };

  const currentWord = useMemo(() => path.map(i => letters[i] || "").join(""), [path, letters]);

  const startGame = useCallback(() => {
    if (hasPlayedToday) {
      toast.error("Bugün zaten oynadın! Yarın tekrar gel 🕐");
      return;
    }
    setLetters(generateGrid());
    setFoundWords([]);
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setPath([]);
    setGameState("playing");
    markAsPlayed();
    playSound("buttonClick");

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameState("finished");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [hasPlayedToday, markAsPlayed, playSound]);

  // Save score on finish (boost ödülü gece 12'de award-challenge-prizes tarafından veriliyor)
  useEffect(() => {
    if (gameState !== "finished") return;
    if (score > 0) {
      saveScore(score, foundWords.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Pointer drag selection
  const cellFromPoint = (x: number, y: number): number => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return -1;
    const idxAttr = el.closest("[data-cell]")?.getAttribute("data-cell");
    return idxAttr ? parseInt(idxAttr, 10) : -1;
  };

  const tryAddCell = (idx: number) => {
    if (idx < 0) return;
    if (path.includes(idx)) {
      // allow back-step: if user moves to second-to-last, pop last
      if (path.length >= 2 && path[path.length - 2] === idx) {
        setPath(prev => prev.slice(0, -1));
      }
      return;
    }
    if (path.length === 0 || isAdjacent(path[path.length - 1], idx)) {
      setPath(prev => [...prev, idx]);
      playSound("buttonClick");
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (gameState !== "playing") return;
    isDraggingRef.current = true;
    setPath([]);
    const idx = cellFromPoint(e.clientX, e.clientY);
    if (idx >= 0) setPath([idx]);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || gameState !== "playing") return;
    const idx = cellFromPoint(e.clientX, e.clientY);
    tryAddCell(idx);
  };
  const onPointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    submitPath();
  };

  const submitPath = () => {
    const word = currentWord.toLocaleUpperCase("tr-TR");
    setPath([]);
    if (word.length < 3) return;
    if (foundWords.some(f => f.w === word)) {
      toast.error("Bu kelimeyi zaten buldun!");
      return;
    }
    if (!isValidWord(word)) {
      playSound("wrongWord");
      toast.error(`"${word}" geçersiz!`);
      return;
    }
    const pts = wordPoints(word.length);
    setScore(s => s + pts);
    setFoundWords(f => [{ w: word, p: pts }, ...f]);
    playSound("correctWord");
    toast.success(`+${pts} 🎯 ${word}`);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading || challengeLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="w-8 h-8 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col text-slate-100 font-sans overflow-hidden" style={{ background: "linear-gradient(135deg, #1a0a2e 0%, #1f1245 50%, #2a0a3a 100%)" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (gameState === "playing") {
                if (timerRef.current) clearInterval(timerRef.current);
                setGameState("finished");
              } else {
                navigate(-1);
              }
              playSound("buttonClick");
            }}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white">🕸️ Kelime Avı</h1>
            <p className="text-[10px] text-fuchsia-400/80">Komşu harfleri birleştir</p>
          </div>
        </div>
        {gameState === "playing" && (
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${timeLeft <= 15 ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white"}`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-5 pb-6">
        {gameState === "ready" && (
          <div className="flex flex-col items-center gap-5 pt-4 flex-1 min-h-0">
            <div className="text-6xl shrink-0">🕸️</div>
            <div className="text-center shrink-0">
              <h2 className="text-xl font-bold text-white mb-2">Kelime Avı</h2>
              <p className="text-sm text-slate-400 max-w-xs">
                5x5 ızgarada parmağınla komşu harflere dokunarak kelimeler oluştur. 90 saniye içinde en yüksek puanı topla!
              </p>
            </div>
            <div className="flex flex-col gap-1 text-xs text-slate-500 shrink-0 items-center">
              <span>• Yatay, dikey ve çapraz komşular geçerli</span>
              <span>• Aynı harf bir kelimede tekrar kullanılamaz</span>
              <span>• Uzun kelimeler çok daha fazla puan</span>
              <div className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" /> 1.'lik ödülü: 1 saatlik x2 puan boost
              </div>
            </div>

            {hasPlayedToday ? (
              <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-2 shrink-0">
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">Bugün oynadın!</span>
                <span className="text-sm font-bold text-fuchsia-400">{todayScore} puan</span>
              </div>
            ) : (
              <button
                onClick={startGame}
                className="shrink-0 px-8 py-3 bg-gradient-to-r from-fuchsia-500 to-purple-600 rounded-2xl font-bold text-white text-lg active:scale-95 transition-transform shadow-lg shadow-fuchsia-500/30"
              >
                Başla! 🚀
              </button>
            )}

            {/* Boost activation: button + rocket lottie (animates only when boost active) */}
            {(pendingMin > 0 || boostActive) && (
              <div className="shrink-0 w-full max-w-sm flex items-center justify-center gap-3 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <button
                  onClick={handleClaimBoost}
                  disabled={pendingMin <= 0 || claiming}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white text-sm transition-all ${
                    boostActive && pendingMin <= 0
                      ? "bg-emerald-500/30 border border-emerald-400/40"
                      : pendingMin > 0
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 active:scale-95 shadow-lg shadow-amber-500/30"
                      : "bg-white/10 opacity-50"
                  }`}
                >
                  {boostActive && pendingMin <= 0
                    ? "⚡ Boost Aktif"
                    : pendingMin > 0
                    ? `Boostu Aktif Et (${pendingMin} dk)`
                    : "Boost yok"}
                </button>
                <div className="w-14 h-14 shrink-0">
                  {rocketAnim && (
                    <Lottie
                      animationData={rocketAnim}
                      loop={boostActive}
                      autoplay={boostActive}
                      style={{ width: "100%", height: "100%" }}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="w-full max-w-sm mt-2 flex-1 min-h-0 flex flex-col">
              <ChallengeLeaderboard leaderboard={leaderboard} scrollable />
            </div>
          </div>
        )}

        {gameState === "playing" && (
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-amber-400">{score} puan</span>
              </div>
              <span className="text-xs text-slate-500">{foundWords.length} kelime</span>
            </div>

            {/* Current word display */}
            <div className="h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center">
              <span className="text-2xl font-black text-white tracking-[0.3em]">
                {currentWord || <span className="text-slate-600 text-sm tracking-normal">Harflere dokun ve sürükle</span>}
              </span>
            </div>

            {/* 5x5 grid */}
            <div
              ref={gridRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="grid grid-cols-5 gap-1.5 select-none touch-none mx-auto"
              style={{ width: "min(100%, 360px)" }}
            >
              {letters.map((letter, i) => {
                const selected = path.includes(i);
                const isLast = path[path.length - 1] === i;
                return (
                  <div
                    key={i}
                    data-cell={i}
                    className={`aspect-square rounded-xl flex items-center justify-center text-lg font-black border transition-colors ${
                      isLast
                        ? "bg-fuchsia-400/80 border-fuchsia-200 text-white shadow-lg shadow-fuchsia-500/40"
                        : selected
                        ? "bg-fuchsia-500/40 border-fuchsia-300/60 text-white"
                        : "bg-white/10 border-white/10 text-white"
                    }`}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>

            {foundWords.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 max-h-32 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {foundWords.map((f, i) => (
                    <span key={i} className="px-2 py-1 bg-fuchsia-500/20 text-fuchsia-200 rounded-lg text-[11px] font-bold border border-fuchsia-500/20">
                      {f.w} +{f.p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {gameState === "finished" && (
          <div className="flex flex-col items-center gap-4 pt-4 flex-1 min-h-0">
            <div className="text-6xl shrink-0">🎯</div>
            <div className="text-center shrink-0">
              <h2 className="text-2xl font-black text-white mb-1">Süre Doldu!</h2>
              <p className="text-4xl font-black text-fuchsia-400">{score} Puan</p>
              <p className="text-sm text-slate-400 mt-2">{foundWords.length} kelime buldun</p>
              <p className="text-[11px] text-amber-300/80 mt-2 max-w-xs">
                Gece 00:00'da 1. olan oyuncu 1 saatlik x2 puan boost'u kazanır ⚡
              </p>
            </div>

            <div className="w-full max-w-sm flex-1 min-h-0 flex flex-col">
              <ChallengeLeaderboard leaderboard={leaderboard} scrollable />
            </div>

            <button
              onClick={() => { playSound("buttonClick"); navigate("/"); }}
              className="shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform"
            >
              Ana Sayfa
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default KelimeAviPage;
