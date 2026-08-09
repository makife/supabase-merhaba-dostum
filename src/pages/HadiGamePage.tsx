import { homeBackPath } from "@/utils/challengeBackPath";
import { useState, useEffect, useCallback, useRef } from "react";
import { playChallengeWinSound } from "@/utils/challengeWinSound";
import { useNavigate } from "react-router-dom";
import { useGameMute } from "@/hooks/useGameMute";
import { GameMuteButton } from "@/components/GameMuteButton";
import { ArrowLeft, Trophy, Lock, Zap } from "lucide-react";
import { toast } from "sonner";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { ChallengeLeaderboard } from "@/components/ChallengeLeaderboard";
import { useExitGameConfirm } from "@/hooks/useExitGameConfirm";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import Lottie from "lottie-react";
import abcHarflerHadiAnimation from "../assets/abcHarflerHadi.json";

/**
 * HADİ — 2048 mekaniği, sayı yerine harf.
 * 2=A, 4=B, 8=C, 16=D, 32=E, 64=F, 128=G, 256=H ...
 */
const SIZE = 4;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const valueToLetter = (v: number) => {
  if (!v) return "";
  const idx = Math.round(Math.log2(v)) - 1;
  return ALPHABET[idx] ?? "?";
};

const TILE_STYLES: Record<number, { bg: string; fg: string }> = {
  2: { bg: "linear-gradient(160deg,#ffffff,#f1f5f9)", fg: "#0f172a" },
  4: { bg: "linear-gradient(160deg,#fef3c7,#fde68a)", fg: "#78350f" },
  8: { bg: "linear-gradient(160deg,#fdba74,#fb923c)", fg: "#7c2d12" },
  16: { bg: "linear-gradient(160deg,#fb7185,#f43f5e)", fg: "#ffffff" },
  32: { bg: "linear-gradient(160deg,#f472b6,#db2777)", fg: "#ffffff" },
  64: { bg: "linear-gradient(160deg,#c084fc,#7c3aed)", fg: "#ffffff" },
  128: { bg: "linear-gradient(160deg,#60a5fa,#2563eb)", fg: "#ffffff" },
  256: { bg: "linear-gradient(160deg,#38bdf8,#0284c7)", fg: "#ffffff" },
  512: { bg: "linear-gradient(160deg,#34d399,#059669)", fg: "#ffffff" },
  1024: { bg: "linear-gradient(160deg,#a3e635,#4d7c0f)", fg: "#ffffff" },
  2048: { bg: "linear-gradient(160deg,#fbbf24,#b45309)", fg: "#ffffff" },
};
const tileStyle = (v: number) =>
  TILE_STYLES[v] ?? { bg: "linear-gradient(160deg,#0f172a,#1e293b)", fg: "#fbbf24" };

type Board = number[][];

const emptyBoard = (): Board => Array.from({ length: SIZE }, () => Array(SIZE).fill(0));

const cloneBoard = (b: Board): Board => b.map((row) => [...row]);

// Bir satırı sola kaydır + birleştir
const collapseRow = (row: number[]): { row: number[]; gained: number; moved: boolean } => {
  const nums = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < nums.length; i++) {
    if (i + 1 < nums.length && nums[i] === nums[i + 1]) {
      const merged = nums[i] * 2;
      out.push(merged);
      gained += merged;
      i++;
    } else {
      out.push(nums[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  const moved = out.some((v, i) => v !== row[i]);
  return { row: out, gained, moved };
};

type Dir = "left" | "right" | "up" | "down";

const hasMoves = (b: Board): boolean => {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (!b[r][c]) return true;
      if (c + 1 < SIZE && b[r][c] === b[r][c + 1]) return true;
      if (r + 1 < SIZE && b[r][c] === b[r + 1][c]) return true;
    }
  return false;
};

/* ---------- Tile modeli (kayma animasyonu için) ---------- */
type Tile = { id: number; r: number; c: number; v: number; isNew?: boolean; merged?: boolean; ghost?: boolean };

let TILE_ID = 1;
const nextId = () => TILE_ID++;

// Grid geometrisi: container padding 8px, gap 8px, 4 kolon
const CELL = "calc((100% - 40px) / 4)";
const cellOffset = (i: number) => `calc(8px + ${i} * ((100% - 40px) / 4 + 8px))`;

const boardFromTiles = (ts: Tile[]): Board => {
  const b = emptyBoard();
  ts.forEach((t) => { b[t.r][t.c] = t.v; });
  return b;
};

const spawnTile = (b: Board): Tile | null => {
  const empties: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!b[r][c]) empties.push([r, c]);
  if (!empties.length) return null;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const v = Math.random() < 0.9 ? 2 : 4;
  b[r][c] = v;
  return { id: nextId(), r, c, v, isNew: true };
};

const posAt = (dir: Dir, k: number, i: number): [number, number] =>
  dir === "left" ? [k, i] : dir === "right" ? [k, SIZE - 1 - i] : dir === "up" ? [i, k] : [SIZE - 1 - i, k];

const moveTiles = (ts: Tile[], dir: Dir): { tiles: Tile[]; ghosts: Tile[]; gained: number; moved: boolean } => {
  const at = (r: number, c: number) => ts.find((t) => t.r === r && t.c === c);
  const out: Tile[] = [];
  const ghosts: Tile[] = [];
  let gained = 0;
  let moved = false;

  for (let k = 0; k < SIZE; k++) {
    const line: Tile[] = [];
    for (let i = 0; i < SIZE; i++) {
      const [r, c] = posAt(dir, k, i);
      const t = at(r, c);
      if (t) line.push(t);
    }
    let idx = 0;
    for (let i = 0; i < line.length; i++) {
      const [tr, tc] = posAt(dir, k, idx);
      if (i + 1 < line.length && line[i].v === line[i + 1].v) {
        const nv = line[i].v * 2;
        gained += nv;
        moved = true;
        out.push({ ...line[i], r: tr, c: tc, v: nv, merged: true, isNew: false });
        ghosts.push({ ...line[i + 1], r: tr, c: tc, merged: false, isNew: false, ghost: true });
        i++;
      } else {
        if (line[i].r !== tr || line[i].c !== tc) moved = true;
        out.push({ ...line[i], r: tr, c: tc, merged: false, isNew: false });
      }
      idx++;
    }
  }

  return { tiles: out, ghosts, gained, moved };
};


const HadiGamePage = () => {
  const navigate = useNavigate();
  const { requestExit, ExitConfirmDialog } = useExitGameConfirm();
  const { muted, playSound } = useGameMute("kelime_avi");
  const { profile, refreshProfile } = useUser();
  const { hasPlayedToday, todayScore, leaderboard, loading: challengeLoading, saveScore, markAsPlayed } =
    useDailyChallenge("kelime_avi" as any);

  const [gameState, setGameState] = useState<"ready" | "playing" | "finished">("ready");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [ghosts, setGhosts] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [bestLetter, setBestLetter] = useState("");
  const [moves, setMoves] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  // Boost Animasyon State'leri
  const [rocketAnim, setRocketAnim] = useState<any>(null);
  const [boostButtonAnim, setBoostButtonAnim] = useState<any>(null);
  const [boostEnergyAnim, setBoostEnergyAnim] = useState<any>(null);
  const [playButtonAnim, setPlayButtonAnim] = useState(false);
  const [playEnergyAnim, setPlayEnergyAnim] = useState(false);

  const tilesRef = useRef<Tile[]>([]);
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(gameState);
  const gridElRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { stateRef.current = gameState; }, [gameState]);
  useEffect(() => () => { if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current); }, []);

  // Animasyon JSON Dosyalarının Yüklenmesi
  useEffect(() => {
    fetch("/boostRoket.json").then(r => r.json()).then(setRocketAnim).catch(() => {});
    fetch("/boostButonBasildi.json").then(r => r.json()).then(setBoostButtonAnim).catch(() => {});
    fetch("/boostButonBasildiEnerji.json").then(r => r.json()).then(setBoostEnergyAnim).catch(() => {});
  }, []);

  const pendingMin = Number((profile as any)?.pending_boost_minutes || 0);
  const boostUntilDate = (profile as any)?.score_boost_until ? new Date((profile as any).score_boost_until) : null;
  const boostSource = (profile as any)?.score_boost_source;
  const boostActivated = !!boostUntilDate && boostUntilDate.getTime() > nowTs && boostSource === "kelime_avi";

  useEffect(() => {
    if (!boostUntilDate || boostUntilDate.getTime() <= Date.now()) return;
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [boostUntilDate?.getTime()]);

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
      
      // 1. ADIM: Buton içi animasyonu başlat (roket yerine buton animasyonu oynar)
      setPlayButtonAnim(true);
      
      // 2. ADIM: 300 milisaniye sonra tam ekran enerji animasyonunu patlat
      setTimeout(() => {
        setPlayEnergyAnim(true);
      }, 300);

      // 3. ADIM: 2.5 saniye sonra tüm animasyonları temizle, profili yenile ve bildirimi göster
      setTimeout(async () => {
        toast.success(`⚡ ${(data as any).minutes_added} dakikalık x2 boost aktif!`);
        await refreshProfile(true);
        setPlayButtonAnim(false);
        setPlayEnergyAnim(false);
        setClaiming(false);
      }, 2500);
    }
  };

  const startGame = useCallback(() => {
    if (hasPlayedToday) {
      toast.error("Bugün zaten oynadın! Yarın tekrar gel 🕐");
      return;
    }
    const b = emptyBoard();
    const t1 = spawnTile(b);
    const t2 = spawnTile(b);
    const initial = [t1, t2].filter(Boolean) as Tile[];
    tilesRef.current = initial;
    setTiles(initial);
    setGhosts([]);
    setScore(0);
    setMoves(0);
    setBestLetter("A");
    setGameState("playing");
    markAsPlayed();
    playSound("buttonClick");
  }, [hasPlayedToday, markAsPlayed, playSound]);

  const doMove = useCallback((dir: Dir) => {
    if (stateRef.current !== "playing") return;
    const res = moveTiles(tilesRef.current, dir);
    if (!res.moved) return;

    const nb = boardFromTiles(res.tiles);
    const spawn = spawnTile(nb);
    const nextTiles = spawn ? [...res.tiles, spawn] : res.tiles;

    tilesRef.current = nextTiles;
    setTiles(nextTiles);
    setGhosts(res.ghosts);
    // Kayma animasyonu bitince birleşen taşın hayaletini kaldır
    if (ghostTimerRef.current) clearTimeout(ghostTimerRef.current);
    ghostTimerRef.current = setTimeout(() => setGhosts([]), 170);

    setMoves((m) => m + 1);
    if (res.gained > 0) {
      setScore((s) => s + res.gained);
      playSound("correctWord");
    } else {
      playSound("buttonClick");
    }
    const finalBoard = boardFromTiles(nextTiles);
    setBestLetter(valueToLetter(Math.max(...finalBoard.flat())));
    if (!hasMoves(finalBoard)) {
      setGameState("finished");
    }
  }, [playSound]);

  // Save score on finish
  useEffect(() => {
    if (gameState !== "finished") return;
    if (score > 0) {
      saveScore(score, moves);
      if (!muted) playChallengeWinSound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Klavye
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      doMove(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  // Native touch swipe (iOS WKWebView güvenli)
  useEffect(() => {
    const el = gridElRef.current;
    if (!el || gameState !== "playing") return;
    let sx = 0, sy = 0, active = false;
    const onTS = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      active = true;
      sx = t.clientX; sy = t.clientY;
    };
    const onTM = (e: TouchEvent) => { if (active) e.preventDefault(); };
    const onTE = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      const absX = Math.abs(dx), absY = Math.abs(dy);
      if (Math.max(absX, absY) < 24) return;
      doMove(absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
    };
    el.addEventListener("touchstart", onTS, { passive: false });
    el.addEventListener("touchmove", onTM, { passive: false });
    el.addEventListener("touchend", onTE, { passive: false });
    el.addEventListener("touchcancel", () => { active = false; }, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTS);
      el.removeEventListener("touchmove", onTM);
      el.removeEventListener("touchend", onTE);
    };
  }, [gameState, doMove]);

  // Mouse swipe (masaüstü)
  const mouseStart = useRef<{ x: number; y: number } | null>(null);
  const onMouseDown = (e: React.MouseEvent) => { mouseStart.current = { x: e.clientX, y: e.clientY }; };
  const onMouseUp = (e: React.MouseEvent) => {
    const s = mouseStart.current;
    mouseStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (Math.max(absX, absY) < 24) return;
    doMove(absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  if (challengeLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col text-slate-100 font-sans overflow-hidden" style={{ background: "linear-gradient(135deg, #14121f 0%, #1d1633 50%, #2a1a10 100%)" }}>
      {/* Header */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playSound("buttonClick");
              requestExit(() => {
                if (gameState === "playing") setGameState("finished");
                else navigate(homeBackPath());
              }, gameState !== "playing");
            }}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-black text-white">🔤 HADİ</h1>
            <p className="text-[10px] text-amber-400/80">Aynı harfleri birleştir</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {gameState === "playing" ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 text-white">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-mono font-bold text-sm">{score}</span>
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
          <div className="flex flex-col items-center gap-1 pt-4 flex-1 min-h-0">
            <div className="w-32 h-32 shrink-0">
              <Lottie 
                animationData={abcHarflerHadiAnimation} 
                loop={true} 
                className="w-full h-full"
              />
            </div>
            <div className="text-center shrink-0">
              <h2 className="text-xl font-bold text-white mb-2">HADİ</h2>
              <p className="text-sm text-slate-400 max-w-xs">
                Kaydır, aynı harfleri birleştir ve alfabede ilerle! A + A = B, B + B = C...
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center shrink-0 max-w-xs">
              {[2, 4, 8, 16, 32, 64, 128, 256].map((v) => {
                const st = tileStyle(v);
                return (
                  <div key={v} className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: st.bg, color: st.fg }}>
                    {valueToLetter(v)}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col gap-1 text-xs text-slate-500 shrink-0 items-center">
              <span>• Parmağını kaydırarak harfleri hareket ettir</span>
              <span>• Aynı harfler birleşince bir sonraki harfe geçer</span>
              <span>• Hamle kalmayınca oyun biter</span>
              <div className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" /> 1.'lik ödülü: 1 saatlik x2 puan boost
              </div>
            </div>

            {hasPlayedToday ? (
              <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-2 shrink-0">
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">Bugün oynadın!</span>
                <span className="text-sm font-bold text-amber-400">{todayScore} puan</span>
              </div>
            ) : (
              <button
                onClick={startGame}
                className="shrink-0 px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl font-bold text-white text-lg active:scale-95 transition-transform shadow-lg shadow-amber-500/30"
              >
                Başla! 🚀
              </button>
            )}

            {(pendingMin > 0 || boostActivated) && (
              <div className="shrink-0 w-full max-w-sm flex items-center justify-center gap-3 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                <button
                  onClick={handleClaimBoost}
                  disabled={pendingMin <= 0 || claiming}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white text-sm transition-all ${
                    boostActivated && pendingMin <= 0
                      ? "bg-emerald-500/30 border border-emerald-400/40"
                      : pendingMin > 0
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 active:scale-95 shadow-lg shadow-amber-500/30"
                      : "bg-white/10 opacity-50"
                  }`}
                >
                  {boostActivated && pendingMin <= 0
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
                      loop={boostActivated}
                      autoplay={boostActivated}
                      style={{ width: "100%", height: "100%" }}
                    />
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {gameState === "playing" && (
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-amber-400">{score} puan</span>
              </div>
              <span className="text-xs text-slate-500">En büyük harf: <b className="text-white">{bestLetter}</b></span>
            </div>

            <style>{`
              @keyframes hadi-appear { 0% { transform: scale(0.2); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
              @keyframes hadi-pop { 0% { transform: scale(1); } 45% { transform: scale(1.18); } 100% { transform: scale(1); } }
            `}</style>
            <div
              ref={gridElRef}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              className="relative mx-auto rounded-3xl select-none touch-none"
              style={{ width: "min(100%, 340px)", aspectRatio: "1 / 1", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)" }}
            >
              {/* Boş hücre katmanı */}
              <div className="absolute inset-0 grid grid-cols-4 gap-2 p-2">
                {Array.from({ length: SIZE * SIZE }).map((_, i) => (
                  <div key={i} className="rounded-xl" style={{ background: "rgba(255,255,255,0.05)" }} />
                ))}
              </div>

              {/* Kayan harf taşları */}
              {[...ghosts, ...tiles].map((t) => {
                const st = tileStyle(t.v);
                const isGhost = (t as any).ghost;
                return (
                  <div
                    key={(isGhost ? "g" : "t") + t.id}
                    className="absolute flex items-center justify-center text-2xl font-black rounded-xl"
                    style={{
                      width: CELL,
                      height: CELL,
                      left: cellOffset(t.c),
                      top: cellOffset(t.r),
                      background: st.bg,
                      color: st.fg,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                      transition: "left 130ms ease-in-out, top 130ms ease-in-out",
                      zIndex: isGhost ? 1 : 2,
                      animation: t.isNew
                        ? "hadi-appear 150ms ease-out"
                        : t.merged
                          ? "hadi-pop 180ms ease-out 110ms"
                          : undefined,
                      willChange: "left, top, transform",
                    }}
                  >
                    {valueToLetter(t.v)}
                  </div>
                );
              })}
            </div>

            {/* Yön butonları */}
            <div className="flex flex-col items-center gap-2 mt-1">
              <button onClick={() => doMove("up")} className="w-14 h-10 rounded-xl bg-white/10 border border-white/10 font-bold active:scale-90 transition-transform">↑</button>
              <div className="flex gap-2">
                <button onClick={() => doMove("left")} className="w-14 h-10 rounded-xl bg-white/10 border border-white/10 font-bold active:scale-90 transition-transform">←</button>
                <button onClick={() => doMove("down")} className="w-14 h-10 rounded-xl bg-white/10 border border-white/10 font-bold active:scale-90 transition-transform">↓</button>
                <button onClick={() => doMove("right")} className="w-14 h-10 rounded-xl bg-white/10 border border-white/10 font-bold active:scale-90 transition-transform">→</button>
              </div>
            </div>
          </div>
        )}

        {gameState === "finished" && (
          <div className="flex flex-col items-center gap-4 pt-4 flex-1 min-h-0">
            <div className="text-6xl shrink-0">🏆</div>
            <div className="text-center shrink-0">
              <h2 className="text-2xl font-black text-white mb-1">Oyun Bitti!</h2>
              <p className="text-4xl font-black text-amber-400">{score} Puan</p>
              <p className="text-sm text-slate-400 mt-2">En büyük harf: {bestLetter} • {moves} hamle</p>
              <p className="text-[11px] text-amber-300/80 mt-2 max-w-xs">
                Gece 00:00'da 1. olan oyuncu 1 saatlik x2 puan boost'u kazanır ⚡
              </p>
            </div>

            <div className="w-full max-w-sm flex-1 min-h-0 flex flex-col">
              <ChallengeLeaderboard leaderboard={leaderboard} scrollable />
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

      {showLeaderboard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowLeaderboard(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#1a1226] border border-amber-500/30 rounded-3xl p-5 max-h-[80vh] flex flex-col animate-scale-in"
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

export default HadiGamePage;
