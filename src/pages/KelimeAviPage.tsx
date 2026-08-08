import { homeBackPath } from "@/utils/challengeBackPath";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { playChallengeWinSound } from "@/utils/challengeWinSound";
import { useNavigate } from "react-router-dom";
import { useGameMute } from "@/hooks/useGameMute";
import { GameMuteButton } from "@/components/GameMuteButton";
import { ArrowLeft, Clock, Trophy, Lock, Zap } from "lucide-react";
import { toast } from "sonner";
import { loadChallengeWordlist, isValidWord } from "@/utils/challengeWordlist";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";
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

// Türkçe harf nadirlik değerleri (Scrabble mantığı)
const LETTER_VALUES: Record<string, number> = {
  A: 1, E: 1, İ: 1, I: 1, K: 1, L: 1, N: 1, R: 1, T: 1,
  B: 2, D: 2, G: 2, M: 2, O: 2, S: 2, U: 2, Y: 2,
  C: 3, Ç: 3, H: 3, Ö: 3, P: 3, Ş: 3, Z: 3,
  F: 5, Ğ: 5, J: 5, V: 5,
};

const lengthBase = (len: number) => {
  if (len <= 3) return 2;
  if (len === 4) return 6;
  if (len === 5) return 15;
  if (len === 6) return 30;
  if (len === 7) return 50;
  return 80 + (len - 8) * 20;
};

const wordPoints = (word: string) => {
  const len = word.length;
  let letterSum = 0;
  for (const ch of word.toUpperCase()) {
    letterSum += LETTER_VALUES[ch] ?? 1;
  }
  return lengthBase(len) + letterSum;
};

const isAdjacent = (a: number, b: number) => {
  if (a === b) return false;
  const ar = Math.floor(a / GRID), ac = a % GRID;
  const br = Math.floor(b / GRID), bc = b % GRID;
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1;
};

const KelimeAviPage = () => {
  const navigate = useNavigate();
  const { requestExit, ExitConfirmDialog } = useExitGameConfirm();
  const { muted, playSound } = useGameMute("kelime_avi");
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
  const [boostButtonAnim, setBoostButtonAnim] = useState<any>(null);
  const [boostEnergyAnim, setBoostEnergyAnim] = useState<any>(null);
  const [playButtonAnim, setPlayButtonAnim] = useState(false);
  const [playEnergyAnim, setPlayEnergyAnim] = useState(false);
  
  const [rocketAnim, setRocketAnim] = useState<any>(null);
  const [surukleAnim, setSurukleAnim] = useState<any>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());
  const [gridSize, setGridSize] = useState(0);

  const pendingMin = Number((profile as any)?.pending_boost_minutes || 0);
  const boostUntilDate = (profile as any)?.score_boost_until ? new Date((profile as any).score_boost_until) : null;
  const boostSource = (profile as any)?.score_boost_source;
  const kelimeAviBoostActivated =
    !!boostUntilDate && boostUntilDate.getTime() > nowTs && boostSource === "kelime_avi";

  useEffect(() => {
    if (!boostUntilDate || boostUntilDate.getTime() <= Date.now()) return;
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [boostUntilDate?.getTime()]);

  // Auto-refresh profile shortly after expiry to clear stale fields
  useEffect(() => {
    if (!boostUntilDate) return;
    const ms = boostUntilDate.getTime() - Date.now();
    if (ms <= 0 || ms > 60 * 60 * 1000 + 5000) return;
    const t = setTimeout(() => { refreshProfile(true); }, ms + 500);
    return () => clearTimeout(t);
  }, [boostUntilDate?.getTime(), refreshProfile]);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);

  // Track grid pixel size for SVG overlay
  useEffect(() => {
    if (gameState !== "playing") return;
    const measure = () => {
      if (gridRef.current) setGridSize(gridRef.current.clientWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [gameState]);

  // Compute pixel center of a cell index (gap-1.5 = 6px)
  const GAP = 6;
  const cellCenter = (idx: number) => {
    const cell = (gridSize - GAP * (GRID - 1)) / GRID;
    const r = Math.floor(idx / GRID);
    const c = idx % GRID;
    return {
      x: c * (cell + GAP) + cell / 2,
      y: r * (cell + GAP) + cell / 2,
    };
  };

  useEffect(() => {
    loadChallengeWordlist().then(() => setLoading(false));
    fetch("/boostRoket.json").then(r => r.json()).then(setRocketAnim).catch(() => {});
    fetch("/kelimeAviSurukle.json").then(r => r.json()).then(setSurukleAnim).catch(() => {});
    
    // Yeni animasyonların yüklenmesi
    fetch("/boostButonBasildi.json").then(r => r.json()).then(setBoostButtonAnim).catch(() => {});
    fetch("/boostButonBasildiEnerji.json").then(r => r.json()).then(setBoostEnergyAnim).catch(() => {});

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleClaimBoost = async () => {
    if (claiming || pendingMin <= 0) return;
    setClaiming(true);
    playSound("buttonClick");
    const { data, error } = await supabase.rpc("claim_score_boost" as any);
    if (error || !(data as any)?.success) {
      toast.error("Boost aktif edilemedi");
      setClaiming(false);
    } else {
      setNowTs(Date.now());
      
      // 1. ADIM: Buton içi animasyonu başlat
      setPlayButtonAnim(true);
      
      // 2. ADIM: Hemen peşinden (300ms sonra) tam ekran enerji animasyonunu başlat
      setTimeout(() => {
        setPlayEnergyAnim(true);
      }, 300);

      // 3. ADIM: Animasyonlar bittikten sonra arayüzü güncelle ve temizle (2.5 saniye sonra)
      setTimeout(async () => {
        toast.success(`⚡ ${(data as any).minutes_added} dakikalık x2 boost aktif!`);
        await refreshProfile(true);
        setPlayButtonAnim(false);
        setPlayEnergyAnim(false);
        setClaiming(false);
      }, 2500);
    }
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
      if (!muted) playChallengeWinSound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Drag selection — iOS-safe: native touch events + ref tabanlı path (stale state yok)
  const pathRef = useRef<number[]>([]);
  useEffect(() => { pathRef.current = path; }, [path]);

  const cellFromPoint = (clientX: number, clientY: number): number => {
    const grid = gridRef.current;
    if (!grid) return -1;
    const rect = grid.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return -1;
    const cell = (rect.width - GAP * (GRID - 1)) / GRID;
    const step = cell + GAP;
    let col = Math.floor(x / step);
    let row = Math.floor(y / step);
    col = Math.max(0, Math.min(GRID - 1, col));
    row = Math.max(0, Math.min(GRID - 1, row));
    // Geniş tolerans: hücrenin neredeyse tamamı (kenardan %4) hit sayılır
    const localX = x - col * step;
    const localY = y - row * step;
    const margin = cell * 0.04;
    if (localX < margin || localX > cell + GAP - margin) return -1;
    if (localY < margin || localY > cell + GAP - margin) return -1;
    return row * GRID + col;
  };

  const pushCell = (idx: number) => {
    const cur = pathRef.current;
    if (cur.includes(idx)) return;
    if (cur.length > 0 && !isAdjacent(cur[cur.length - 1], idx)) return;
    const next = [...cur, idx];
    pathRef.current = next;
    setPath(next);
    playSound("buttonClick");
  };

  const tryAddCell = (idx: number) => {
    if (idx < 0) return;
    const cur = pathRef.current;
    if (cur.length === 0) { pushCell(idx); return; }
    const last = cur[cur.length - 1];
    if (idx === last) return;
    // Geri adım: sondan bir öncekine dönülürse son harfi sil
    if (cur.length >= 2 && cur[cur.length - 2] === idx) {
      const next = cur.slice(0, -1);
      pathRef.current = next;
      setPath(next);
      return;
    }
    if (cur.includes(idx)) return;
    if (isAdjacent(last, idx)) { pushCell(idx); return; }
    // Hızlı sürüklemede atlanan hücreleri ara adımlarla doldur
    const r0 = Math.floor(last / GRID), c0 = last % GRID;
    const r1 = Math.floor(idx / GRID), c1 = idx % GRID;
    const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
    for (let s = 1; s <= steps; s++) {
      const r = r0 + Math.round(((r1 - r0) * s) / steps);
      const c = c0 + Math.round(((c1 - c0) * s) / steps);
      pushCell(r * GRID + c);
    }
  };

  const startDrag = (clientX: number, clientY: number) => {
    if (gameState !== "playing") return;
    isDraggingRef.current = true;
    pathRef.current = [];
    setPath([]);
    const idx = cellFromPoint(clientX, clientY);
    if (idx >= 0) {
      pathRef.current = [idx];
      setPath([idx]);
      playSound("buttonClick");
    }
  };
  const moveDrag = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current || gameState !== "playing") return;
    tryAddCell(cellFromPoint(clientX, clientY));
  };
  const endDrag = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    submitPath();
  };

  // Native touch listeners (React synthetic touch/pointer iOS WKWebView'de güvenilir değil)
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || gameState !== "playing") return;
    const onTS = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) startDrag(t.clientX, t.clientY);
    };
    const onTM = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) moveDrag(t.clientX, t.clientY);
    };
    const onTE = (e: TouchEvent) => { e.preventDefault(); endDrag(); };
    grid.addEventListener("touchstart", onTS, { passive: false });
    grid.addEventListener("touchmove", onTM, { passive: false });
    grid.addEventListener("touchend", onTE, { passive: false });
    grid.addEventListener("touchcancel", onTE, { passive: false });
    return () => {
      grid.removeEventListener("touchstart", onTS);
      grid.removeEventListener("touchmove", onTM);
      grid.removeEventListener("touchend", onTE);
      grid.removeEventListener("touchcancel", onTE);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, letters]);

  // Masaüstü (mouse) fallback
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    startDrag(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    moveDrag(e.clientX, e.clientY);
  };
  const onPointerUp = (e?: React.PointerEvent) => {
    if (e && e.pointerType === "touch") return;
    endDrag();
  };

  const submitPath = () => {
    const word = pathRef.current.map(i => letters[i] || "").join("").toLocaleUpperCase("tr-TR");
    pathRef.current = [];
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
    const pts = wordPoints(word);
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
              playSound("buttonClick");
              requestExit(() => {
                if (gameState === "playing") {
                  if (timerRef.current) clearInterval(timerRef.current);
                  setGameState("finished");
                } else {
                  navigate(homeBackPath());
                }
              }, gameState !== "playing");
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
        <div className="flex items-center gap-2">
          {gameState === "playing" ? (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${timeLeft <= 15 ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white"}`}>
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold text-sm">{formatTime(timeLeft)}</span>
            </div>
          ) : (
            <button
              onClick={() => { playSound("buttonClick"); setShowLeaderboard(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 border border-white/10 active:scale-95 transition-transform"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white">Sıralama</span>
            </button>
          )}
          <GameMuteButton gameId="kelime_avi" size={40} />
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-5 pb-6">
        {gameState === "ready" && (
          <div className="flex flex-col items-center gap-5 pt-4 flex-1 min-h-0">
            <div className="shrink-0 flex justify-center">
              {surukleAnim ? (
                <Lottie animationData={surukleAnim} loop autoplay style={{ width: 120, height: 120 }} />
              ) : (
                <div className="text-6xl">🕸️</div>
              )}
            </div>
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
            {(pendingMin > 0 || kelimeAviBoostActivated) && (
              <div className="shrink-0 w-full max-w-sm flex items-center justify-center gap-3 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <button
                  onClick={handleClaimBoost}
                  disabled={pendingMin <= 0 || claiming}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white text-sm transition-all ${
                    kelimeAviBoostActivated && pendingMin <= 0
                      ? "bg-emerald-500/30 border border-emerald-400/40"
                      : pendingMin > 0
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 active:scale-95 shadow-lg shadow-amber-500/30"
                      : "bg-white/10 opacity-50"
                  }`}
                >
                  {kelimeAviBoostActivated && pendingMin <= 0
                    ? "⚡ Boost Aktif"
                    : pendingMin > 0
                    ? `Boostu Aktif Et (${pendingMin} dk)`
                    : "Boost yok"}
                </button>
                <div className="w-14 h-14 shrink-0">
                  {playButtonAnim && boostButtonAnim ? (
                    <Lottie animationData={boostButtonAnim} loop={false} autoplay={true} style={{ width: "100%", height: "100%" }} />
                  ) : rocketAnim ? (
                    <Lottie
                      animationData={rocketAnim}
                      loop={kelimeAviBoostActivated}
                      autoplay={kelimeAviBoostActivated}
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : null}
                </div>
              </div>
            )}

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
              className="relative grid grid-cols-5 gap-1.5 select-none touch-none mx-auto"
              style={{ width: "min(100%, 360px)" }}
            >
              {letters.map((letter, i) => {
                const selected = path.includes(i);
                const isLast = path[path.length - 1] === i;
                return (
                  <div
                    key={i}
                    data-cell={i}
                    className={`aspect-square rounded-xl flex items-center justify-center text-xl font-black border-2 transition-all ${
                      isLast
                        ? "bg-fuchsia-300 border-fuchsia-600 text-fuchsia-900 shadow-lg shadow-fuchsia-500/30 scale-105"
                        : selected
                        ? "bg-fuchsia-100 border-fuchsia-400 text-fuchsia-800"
                        : "bg-gradient-to-br from-white to-emerald-50 border-emerald-400 text-emerald-900"
                    }`}
                  >
                    {letter}
                  </div>
                );
              })}

              {/* Path line overlay */}
              {gridSize > 0 && path.length > 0 && (
                <svg
                  className="absolute inset-0 pointer-events-none"
                  width={gridSize}
                  height={gridSize}
                  viewBox={`0 0 ${gridSize} ${gridSize}`}
                >
                  {path.length > 1 && (
                    <polyline
                      points={path.map(i => {
                        const { x, y } = cellCenter(i);
                        return `${x},${y}`;
                      }).join(" ")}
                      fill="none"
                      stroke="rgba(232, 121, 249, 0.85)"
                      strokeWidth={Math.max(6, gridSize * 0.025)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {path.map((i, idx) => {
                    const { x, y } = cellCenter(i);
                    return (
                      <circle
                        key={idx}
                        cx={x}
                        cy={y}
                        r={Math.max(5, gridSize * 0.018)}
                        fill="rgba(240, 171, 252, 0.95)"
                      />
                    );
                  })}
                </svg>
              )}
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

            <button
              onClick={() => { playSound("buttonClick"); navigate(homeBackPath()); }}
              className="shrink-0 px-6 py-3 bg-white/10 border border-white/10 rounded-2xl font-bold text-white active:scale-95 transition-transform"
            >
              Ana Sayfa
            </button>
          </div>
        )}
      </div>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#1a0a2e] border border-fuchsia-500/30 rounded-3xl p-5 max-h-[80vh] flex flex-col animate-scale-in"
          >
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white">Günlük Sıralama</h3>
              </div>
              <button
                onClick={() => { playSound("buttonClick"); setShowLeaderboard(false); }}
                className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white text-lg active:scale-90"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <ChallengeLeaderboard leaderboard={leaderboard} scrollable />
            </div>
          </div>
        </div>
      )}

      {/* Sayfayı komple kaplayan Enerji Animasyonu Katmanı */}
      {playEnergyAnim && boostEnergyAnim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 pointer-events-none animate-fade-in">
          <div className="w-full h-full">
            <Lottie 
              animationData={boostEnergyAnim} 
              loop={false} 
              autoplay={true} 
              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
            />
          </div>
        </div>
      )}

      {ExitConfirmDialog}
    </div>
  );
};

export default KelimeAviPage;
