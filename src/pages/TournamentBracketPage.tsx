import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, LogOut, Clock, Crown, ArrowLeft, Swords, Flame, Shield, ChevronLeft } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTournament } from "@/hooks/useTournament";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { generateBotName, generateBotAvatar } from "@/utils/tournamentHelpers";
import { toast } from "sonner";
import { usePageResync } from "@/hooks/useGlobalResync";
import { useServerTimeContext } from "@/contexts/ServerTimeContext";
import nativeStorage, { STORAGE_KEYS } from "@/utils/nativeStorage";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { playPitchedBeep, preloadPitchedBeep } from "@/services/pitchedBeepService";
import { isSoundEffectsEnabled } from "@/utils/soundSettings";
import ExitConfirmCardDialog from "@/components/ExitConfirmCardDialog";

const BRACKET_BEEP_URL = "/onsaniyegerisayim.mp3";
preloadPitchedBeep(BRACKET_BEEP_URL).catch(() => {});

const triggerHaptic = (pattern: number | number[] = 18) => {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Haptik desteklenmiyor, sessizce geç
  }
};

// ── Tur bilgileri ─────────────────────────────────────────────────────────────
const ROUND_INFO = {
  1: {
    name: "Çeyrek Final",
    short: "ÇF",
    dot: "bg-indigo-400",
    ring: "ring-indigo-400/30",
    bg: "bg-indigo-500/10",
    icon: Swords,
  },
  2: {
    name: "Yarı Final",
    short: "YF",
    dot: "bg-amber-400",
    ring: "ring-amber-400/30",
    bg: "bg-amber-500/10",
    icon: Flame,
  },
  3: { name: "Final", short: "F", dot: "bg-rose-400", ring: "ring-rose-400/30", bg: "bg-rose-500/10", icon: Crown },
} as const;

// ── Bileşen: Oyuncu satırı ────────────────────────────────────────────────────
const PlayerRow = ({
  player,
  score,
  isWinner,
  isCompleted,
  isInProgress,
}: {
  player: any;
  score: number;
  isWinner: boolean;
  isCompleted: boolean;
  isInProgress: boolean;
}) => (
  <div
    className={`rounded-xl px-3 py-2 flex items-center justify-between transition-all
    ${isWinner ? "bg-emerald-500/15 ring-1 ring-emerald-400/30" : "bg-white/5 ring-1 ring-white/8"}`}
  >
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <Avatar className="w-7 h-7 flex-shrink-0">
        <AvatarImage src={player.avatar_url || undefined} />
        <AvatarFallback className="bg-indigo-500/30 text-white text-xs font-bold">
          {player.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-white/90 text-xs font-medium truncate">{player.name}</span>
    </div>
    {(isCompleted || isInProgress) && (
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
        {isWinner && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
        <span
          className={`text-sm font-black ${isWinner ? "text-emerald-300" : isInProgress ? "text-amber-300" : "text-white/60"}`}
        >
          {score}
        </span>
      </div>
    )}
  </div>
);

// ── Bileşen: Maç zamanlayıcı ──────────────────────────────────────────────────
const MatchTimer = ({ endsAt }: { endsAt: string | null }) => {
  const [remaining, setRemaining] = useState<number | null>(null);
  const { serverNow } = useServerTimeContext();

  useEffect(() => {
    if (!endsAt) {
      setRemaining(null);
      return;
    }
    const endTime = new Date(endsAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((endTime - serverNow()) / 1000));
      setRemaining(left);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [endsAt, serverNow]);

  if (remaining === null) return null;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isLow = remaining <= 15 && remaining > 0;

  return (
    <div className={`flex items-center gap-1 ${isLow ? "text-red-400 animate-pulse" : "text-sky-300"}`}>
      <Clock className="w-3 h-3" />
      <span className="text-[10px] font-bold tabular-nums">
        {mins}:{secs.toString().padStart(2, "0")}
      </span>
    </div>
  );
};

// ── Bileşen: Maç kartı ────────────────────────────────────────────────────────
const MatchCard = ({ match, round }: { match: any; round: 1 | 2 | 3 }) => {
  const info = ROUND_INFO[round];

  const getPlayerInfo = (playerId: string | null, playerData: any) => {
    if (!playerId) return { name: "TBD", isBot: false, avatar_url: null };
    const isBot = playerData?.is_bot || playerId.startsWith("bot_");
    if (isBot) {
      const seed = [...playerId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const botName = playerData?.username || generateBotName(seed);
      return { name: botName, isBot: true, avatar_url: generateBotAvatar(seed, botName) };
    }
    return { name: playerData?.username || "Oyuncu", isBot: false, avatar_url: playerData?.avatar_url };
  };

  const player1 = getPlayerInfo(match.player1_id, match.player1);
  const player2 = getPlayerInfo(match.player2_id, match.player2);
  const isCompleted = match.status === "completed";
  const isInProgress = match.status === "in_progress";
  const winner = match.winner_id;

  const statusDot = isCompleted ? "bg-emerald-400" : isInProgress ? "bg-amber-400" : "bg-slate-500";
  const statusText = isCompleted ? "Bitti" : isInProgress ? "Oynanıyor" : "Bekliyor";

  return (
    <div className={`rounded-2xl p-3 ring-1 ${info.ring} ${info.bg} space-y-1.5`}>
      {/* Maç başlığı */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Maç {match.match_number}</span>
        <div className="flex items-center gap-1.5">
          {isInProgress && <MatchTimer endsAt={match.ends_at} />}
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
          <span className="text-[10px] text-white/50">{statusText}</span>
        </div>
      </div>

      <PlayerRow
        player={player1}
        score={match.player1_score || 0}
        isWinner={isCompleted && winner === match.player1_id}
        isCompleted={isCompleted}
        isInProgress={isInProgress}
      />
      <div className="text-center text-white/20 text-[10px] font-black tracking-widest">VS</div>
      <PlayerRow
        player={player2}
        score={match.player2_score || 0}
        isWinner={isCompleted && winner === match.player2_id}
        isCompleted={isCompleted}
        isInProgress={isInProgress}
      />
    </div>
  );
};

// ── Ana sayfa ─────────────────────────────────────────────────────────────────
const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { playSpecialSound } = useSounds();
  const { serverNow, offset } = useServerTimeContext();

  const { currentTournament, matches, participants, loading, fetchTournamentDetails, leaveTournament } =
    useTournament(tournamentId);

  const [isLeaving, setIsLeaving] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [showChampion, setShowChampion] = useState(false);
  const [showEliminated, setShowEliminated] = useState(false);
  const [eliminatedRound, setEliminatedRound] = useState<number | null>(null);
  const [eliminatedLottie, setEliminatedLottie] = useState<any>(null);
  const [eliminatedLottieLoadDone, setEliminatedLottieLoadDone] = useState(false);
  const [navigatedToGame, setNavigatedToGame] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [wonReward, setWonReward] = useState<any>(null);
  const [championLottie, setChampionLottie] = useState<any>(null);
  const [konfetiLottie, setKonfetiLottie] = useState<any>(null);
  const [cupLottie, setCupLottie] = useState<any>(null);
  const [bracket321Lottie, setBracket321Lottie] = useState<any>(null);
  const [bracket10Lottie, setBracket10Lottie] = useState<any>(null);
  const championLottieIndexRef = useRef<number>(Math.floor(Math.random() * 8) + 1);
  const eliminatedSoundPlayedRef = useRef(false);

  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitDialogMode, setExitDialogMode] = useState<"back" | "leave">("back");

  const openExitDialog = useCallback((mode: "back" | "leave") => {
    triggerHaptic([12, 28, 12]);
    setExitDialogMode(mode);
    setShowExitDialog(true);
  }, []);

  const closeExitDialog = useCallback(() => {
    setShowExitDialog(false);
  }, []);

  const handleConfirmExit = useCallback(async () => {
    triggerHaptic(22);
    setShowExitDialog(false);

    if (exitDialogMode === "back") {
      navigate("/tournament");
      return;
    }

    // leave mode
    setIsLeaving(true);
    try {
      if (!user || !tournamentId) return;

      const isTournamentOver =
        currentTournament?.status === "completed" || currentTournament?.status === "cancelled";

      if (isTournamentOver) {
        navigate("/tournament");
        return;
      }

      await leaveTournament();
      navigate("/tournament");
    } catch (e) {
      console.error("❌ Bracket ayrılma hatası:", e);
      toast.error("Ayrılırken bir hata oluştu");
    } finally {
      setIsLeaving(false);
    }
  }, [exitDialogMode, navigate, user, tournamentId, currentTournament, leaveTournament]);

  useEffect(() => {
    if (!showChampion) return;

    const idx = championLottieIndexRef.current;
    let cancelled = false;
    Promise.all([
      fetch(`/turnuvaKazanma${idx}.json`).then((r) => r.json()).catch(() => null),
      fetch(`/turnuvaKazanmaKonfeti.json`).then((r) => r.json()).catch(() => null),
    ]).then(([champ, konfeti]) => {
      if (cancelled) return;
      setChampionLottie(champ);
      setKonfetiLottie(konfeti);
    });
    return () => {
      cancelled = true;
    };
  }, [showChampion]);

  // Kupa Lottie yükle
  useEffect(() => {
    fetch('/kupajson.json')
      .then((r) => r.json())
      .then((data) => setCupLottie(data))
      .catch(() => {});
    fetch('/turnuvaBracket321.json')
      .then((r) => r.json())
      .then((data) => setBracket321Lottie(data))
      .catch(() => {});
    fetch('/turnuvaBracket10saniye.json')
      .then((r) => r.json())
      .then((data) => setBracket10Lottie(data))
      .catch(() => {});
  }, []);


  // Çeyrek/Yarı finalde elenme tespiti — Lottie + ses
  useEffect(() => {
    if (!user || !matches.length || !tournamentId) return;
    if (showEliminated || showChampion) return;
    if (eliminatedSoundPlayedRef.current) return;

    const myLostEarlyMatch = matches.find(
      (m) =>
        (m.round === 1 || m.round === 2 || m.round === 3) &&
        m.status === "completed" &&
        (m.player1_id === user.id || m.player2_id === user.id) &&
        m.winner_id &&
        m.winner_id !== user.id,
    );

    if (!myLostEarlyMatch) return;

    eliminatedSoundPlayedRef.current = true;
    const round = myLostEarlyMatch.round;
    const lottieFile =
      round === 1
        ? "/turnuvaElenme2.json"
        : round === 2
        ? "/turnuvaElenme1.json"
        : "/turnuvaElenme3.json";

    setEliminatedRound(round);
    setEliminatedLottie(null);
    setEliminatedLottieLoadDone(false);
    setShowEliminated(true);
    playSpecialSound("/turnuvaElenmeSes.mp3", 0.8);

    fetch(lottieFile)
      .then((r) => r.json())
      .then((data) => {
        setEliminatedLottie(data);
        setEliminatedLottieLoadDone(true);
      })
      .catch(() => {
        setEliminatedLottieLoadDone(true);
      });
  }, [matches, user, tournamentId, showEliminated, showChampion, playSpecialSound]);




  const REWARD_IMAGES = {
    ink: "/murekkepOdul.jpg",
    degistir: "/degistirOdul.jpg",
    senyaz: "/senyazOdul.jpg",
    fisilda: "/fisildaOdul.jpg",
    credits: "/ucsayfaOdul.jpg",
    extra_spin: "/carkOdul.jpg",
  };


  const navigatedMatchIdRef = useRef<string | null>(null);
  const fromCompletedMatchRef = useRef<string | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const matchesStartedRef = useRef<string | null>(null);
  const advancingRef = useRef(false);
  const completedMatchIdsRef = useRef<Set<string>>(new Set());
  const expiredMatchCheckRef = useRef<NodeJS.Timeout | null>(null);
  const tournamentEndToastShownRef = useRef(false);
  const roundWinSoundPlayedRef = useRef<Set<number>>(new Set());
  const championSoundPlayedRef = useRef(false);
  const playedCountdownSecondsRef = useRef<Set<number>>(new Set());
  const bracket10LottieRef = useRef<LottieRefCurrentProps | null>(null);
  const bracket321LottieRef = useRef<LottieRefCurrentProps | null>(null);

  // Component içine ekle (useRef'ler yanına)
  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  const confettiAnimRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user || !matches.length || !currentTournament || !tournamentId) return;

    // Şampiyon sesi zaten çalındıysa tur sesini çalma
    if (championSoundPlayedRef.current) return;

    // Turnuva tamamlandıysa tur atlama sesi çalma (final sesiyle çakışmayı önle)
    if (currentTournament.status !== "in_progress") return;

    // Final sonuçlandıysa tur atlama sesi çalma (şampiyon sesiyle çakışmayı önle)
    const isFinalCompleted = matches.some((m) => m.round === 3 && m.status === "completed");
    if (isFinalCompleted) return;

    // Kullanıcının final maçı bittiyse tur sesi çalma
    const myFinalMatch = matches.find((m) => m.round === 3 && (m.player1_id === user.id || m.player2_id === user.id));
    if (myFinalMatch?.status === "completed" || myFinalMatch?.winner_id) return;

    // Sadece "bir önceki tur" için ses çal (round 1 veya 2 kazanıldığında):
    const justCompletedRound = (currentTournament.current_round || 1) - 1;
    if (justCompletedRound !== 1 && justCompletedRound !== 2) return;

    const wonMatch = matches.find(
      (m) => m.round === justCompletedRound && m.status === "completed" && m.winner_id === user.id,
    );

    if (!wonMatch) return;

    if (roundWinSoundPlayedRef.current.has(justCompletedRound)) return;
    roundWinSoundPlayedRef.current.add(justCompletedRound);

    const roundSoundKey = `tournament_round_win_sound_${tournamentId}_${wonMatch.id}`;

    let cancelled = false;
    (async () => {
      // Aynı tur sesi aynı turnuva-maç kombinasyonunda bir kez çalsın (sayfaya tekrar dönünce tekrar etmesin)
      const alreadyPlayed = await nativeStorage.getItem(roundSoundKey);
      if (alreadyPlayed || cancelled) return;

      // Sunucudan güncel durumu doğrula (stale state yüzünden finalde tur sesi çalmasın)
      const [{ data: latestTournament }, { data: latestFinalMatch }] = await Promise.all([
        supabase.from("tournaments").select("status").eq("id", tournamentId).maybeSingle(),
        supabase
          .from("tournament_matches")
          .select("status, winner_id")
          .eq("tournament_id", tournamentId)
          .eq("round", 3)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const serverTournamentCompleted = latestTournament?.status !== "in_progress";
      const serverFinalCompleted = latestFinalMatch?.status === "completed" || !!latestFinalMatch?.winner_id;

      if (championSoundPlayedRef.current || serverTournamentCompleted || serverFinalCompleted) return;

      await nativeStorage.setItem(roundSoundKey, "1");
      if (cancelled || championSoundPlayedRef.current) return;

      playSpecialSound("/turKazanma.mp3", 0.8);
    })();

    return () => {
      cancelled = true;
    };
  }, [matches, user, currentTournament, playSpecialSound, tournamentId]);

  // useEffect ekle (diğer useEffect'lerin yanına)
  useEffect(() => {
    if (!showChampion) return;

    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces: {
      x: number;
      y: number;
      r: number;
      color: string;
      speed: number;
      angle: number;
      spin: number;
      opacity: number;
    }[] = [];

    const colors = [
      "#FFD700",
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98FB98",
      "#F0E68C",
      "#FF69B4",
    ];

    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: -Math.random() * canvas.height,
        r: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() * 3 + 2,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        opacity: Math.random() * 0.6 + 0.4,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.y += p.speed;
        p.angle += p.spin;
        p.x += Math.sin(p.angle) * 1.5;
        if (p.y > canvas.height) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
        }
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
        ctx.restore();
      });
      confettiAnimRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (confettiAnimRef.current) cancelAnimationFrame(confettiAnimRef.current);
    };
  }, [showChampion]);

  // fromCompletedMatch state
  useEffect(() => {
    const state = location.state as { fromCompletedMatch?: string } | null;
    if (state?.fromCompletedMatch) {
      fromCompletedMatchRef.current = state.fromCompletedMatch;
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Resync
  const handleBracketResync = useCallback(async () => {
    if (tournamentId) await fetchTournamentDetails(tournamentId);
  }, [tournamentId, fetchTournamentDetails]);
  usePageResync(handleBracketResync, "TournamentBracketPage", true);

  useEffect(() => {
    if (tournamentId) {
      setInitialLoading(true);
      fetchTournamentDetails(tournamentId).finally(() => setTimeout(() => setInitialLoading(false), 300));
      setNavigatedToGame(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (currentTournament?.current_round) {
      setNavigatedToGame(false);
      matchesStartedRef.current = null;
      navigatedMatchIdRef.current = null;
    }
  }, [currentTournament?.current_round]);

  // Start all matches
  const startAllMatches = useCallback(async () => {
    if (!tournamentId || !user || !currentTournament) return;
    // Herhangi bir oyuncu maçları başlatabilir (idempotent) — kurucu transferinde gecikme sorununu önler

    const currentRound = currentTournament.current_round || 1;
    const roundKey = `${tournamentId}-${currentRound}`;
    if (matchesStartedRef.current === roundKey) return;
    matchesStartedRef.current = roundKey;

    try {
      const { data: pendingMatches } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round", currentRound)
        .eq("status", "pending");

      if (!pendingMatches || pendingMatches.length === 0) return;

      // 🔒 Güncel katılımcı listesini DB'den al (turnuvayı terk edenler dahil)
      const { data: freshParticipants } = await supabase
        .from("tournament_participants")
        .select("user_id, is_bot")
        .eq("tournament_id", tournamentId);

      const botIds = new Set<string>();
      const presentUserIds = new Set<string>();
      (freshParticipants || []).forEach((p) => {
        if (p.user_id) {
          presentUserIds.add(p.user_id);
          if (p.is_bot) botIds.add(p.user_id);
        }
      });

      for (const match of pendingMatches) {
        const p1Bot = botIds.has(match.player1_id || "") || match.player1_id?.startsWith("bot_");
        const p2Bot = botIds.has(match.player2_id || "") || match.player2_id?.startsWith("bot_");

        // 🚪 Geri sayım sırasında ayrılan oyuncuyu tespit et
        const p1Missing = !p1Bot && !!match.player1_id && !presentUserIds.has(match.player1_id);
        const p2Missing = !p2Bot && !!match.player2_id && !presentUserIds.has(match.player2_id);

        if (p1Missing || p2Missing) {
          // En az bir oyuncu turnuvadan ayrılmış → kalan oyuncu otomatik kazanır
          let winnerId: string | null = null;
          if (p1Missing && p2Missing) {
            // İkisi de ayrılmış (nadir) — rastgele
            winnerId = Math.random() < 0.5 ? match.player1_id : match.player2_id;
          } else if (p1Missing) {
            winnerId = match.player2_id;
          } else {
            winnerId = match.player1_id;
          }
          await supabase
            .from("tournament_matches")
            .update({
              status: "completed",
              winner_id: winnerId,
              player1_score: p1Missing ? 0 : 1,
              player2_score: p2Missing ? 0 : 1,
            })
            .eq("id", match.id);
          console.log("🚪 Ayrılan oyuncu tespit edildi, maç otomatik sonuçlandırıldı:", { matchId: match.id, winnerId });
          continue;
        }

        if (p1Bot && p2Bot) {
          const p1s = Math.floor(Math.random() * 50) + 20;
          const p2s = Math.floor(Math.random() * 50) + 20;
          await supabase
            .from("tournament_matches")
            .update({
              status: "completed",
              player1_score: p1s,
              player2_score: p2s,
              winner_id: p1s >= p2s ? match.player1_id : match.player2_id,
            })
            .eq("id", match.id);
        } else {
          // 🔒 SUNUCU OTORİTESİ: başlangıç anı istemci saatiyle değil, sunucu saatiyle yazılır
          const { error: cdError } = await supabase.rpc("start_tournament_match_countdown", {
            p_match_id: match.id,
            p_idle_ms: 3000,
          });
          if (cdError) {
            console.error("❌ Turnuva countdown RPC hatası:", cdError);
          }
        }
      }
      setTimeout(() => checkAndAdvance(), 2000);
    } catch (error) {
      console.error("❌ Maç başlatma hatası:", error);
      matchesStartedRef.current = null;
    }
  }, [tournamentId, user, currentTournament, participants]);

  // Check and advance round — uses SECURITY DEFINER RPC
  const checkAndAdvance = useCallback(async () => {
    if (!tournamentId || !user || !currentTournament || advancingRef.current) return;

    const currentRound = currentTournament.current_round || 1;
    const { data: roundMatches } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .eq("round", currentRound);

    if (!roundMatches) return;
    const allCompleted = roundMatches.every((m) => m.status === "completed");

    if (allCompleted) {
      advancingRef.current = true;
      try {
        const { data, error } = await supabase.rpc("advance_tournament_round" as any, {
          p_tournament_id: tournamentId,
        });

        if (error) {
          console.error("❌ checkAndAdvance RPC hatası:", error);
        } else {
          const result = data as any;
          console.log("✅ checkAndAdvance RPC:", result);

          if (result?.action === "tournament_completed") {
            const finalMatch = roundMatches.find((m) => m.round === 3);
            if (finalMatch?.winner_id) {
              const winnerProfile = participants.find((p) => p.user_id === finalMatch.winner_id);
              await (supabase.rpc as any)("notify_tournament_end", {
                p_tournament_id: tournamentId,
                p_winner_id: finalMatch.winner_id,
                p_winner_name: winnerProfile?.profiles?.username || "Bir Oyuncu",
              });
            }
          }

          await fetchTournamentDetails(tournamentId);
        }
      } finally {
        advancingRef.current = false;
      }
    }
  }, [tournamentId, user, currentTournament, participants, fetchTournamentDetails]);

  // Expired match check
  useEffect(() => {
    if (!tournamentId || !user || !currentTournament) return;
    if (currentTournament.status !== "in_progress") return;

    // Herhangi bir oyuncu expired maç kontrolü ve ilerleme yapabilir (idempotent)
    const checkExpired = async () => {
      const expiredGraceMs = 3000;
      const { data: expired } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("status", "in_progress")
        .lt("ends_at", new Date(serverNow() - expiredGraceMs).toISOString());

      if (!expired?.length) {
        // Expired maç yoksa bile, tüm maçlar tamamlanmışsa advance dene
        checkAndAdvance();
        return;
      }

      for (const match of expired) {
        const w = (match.player1_score || 0) >= (match.player2_score || 0) ? match.player1_id : match.player2_id;
        await supabase
          .from("tournament_matches")
          .update({ status: "completed", winner_id: w })
          .eq("id", match.id)
          .eq("status", "in_progress");
      }
      fetchTournamentDetails(tournamentId);
      setTimeout(() => checkAndAdvance(), 1000);
    };

    checkExpired();
    expiredMatchCheckRef.current = setInterval(checkExpired, 5000);
    return () => {
      if (expiredMatchCheckRef.current) clearInterval(expiredMatchCheckRef.current);
    };
  }, [tournamentId, user?.id, currentTournament?.status, checkAndAdvance]);

  // Countdown
  useEffect(() => {
    if (!currentTournament || currentTournament.status !== "in_progress") return;
    if (!currentTournament.next_round_starts_at) return;

    const target = new Date(currentTournament.next_round_starts_at).getTime();
    playedCountdownSecondsRef.current.clear();

    // Lottie süreleri (ms) — animasyonlar toplam 10s ve 3s'ye normalize edilir.
    const LOTTIE_10_MS = 10000;
    const LOTTIE_321_MS = 3000;

    const tick = () => {
      const nowMs = serverNow();
      const remainingMs = Math.max(0, target - nowMs);
      const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
      setCountdown(remaining);

      // ── 10s Lottie'yi gerçek kalan süreye göre frame'e kilitle ──
      const l10 = bracket10LottieRef.current;
      if (l10) {
        const total = l10.getDuration(true) as number | undefined;
        if (total && isFinite(total) && total > 0) {
          const elapsed = Math.min(LOTTIE_10_MS, LOTTIE_10_MS - Math.min(remainingMs, LOTTIE_10_MS));
          const frame = (elapsed / LOTTIE_10_MS) * total;
          try { l10.goToAndStop(frame, true); } catch {}
        }
      }

      // ── 3-2-1 Lottie'yi gerçek kalan süreye göre frame'e kilitle ──
      if (remainingMs <= LOTTIE_321_MS) {
        const l321 = bracket321LottieRef.current;
        if (l321) {
          const total = l321.getDuration(true) as number | undefined;
          if (total && isFinite(total) && total > 0) {
            const elapsed = Math.min(LOTTIE_321_MS, LOTTIE_321_MS - remainingMs);
            const frame = (elapsed / LOTTIE_321_MS) * total;
            try { l321.goToAndStop(frame, true); } catch {}
          }
        }
      }

      // ── Son 5 saniyede beep (her saniye artan pitch) — gerçek saniye sınırında tetiklenir ──
      // 100ms tick ile Math.ceil, tam saniye sınırında düşer; erken/ geç tetikleme olmaz.
      if (remaining >= 1 && remaining <= 5 && !playedCountdownSecondsRef.current.has(remaining)) {
        playedCountdownSecondsRef.current.add(remaining);
        if (isSoundEffectsEnabled()) {
          const pitchRate = 1.0 + (5 - remaining) * 0.22;
          playPitchedBeep(BRACKET_BEEP_URL, pitchRate, 0.7).catch(() => {});
        }
      }

      if (remainingMs <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        startAllMatches();
      }
    };
    tick();
    // rAF ile ~60fps Lottie frame güncellemesi (akıcı animasyon).
    let rafId = 0;
    const loop = () => {
      tick();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [currentTournament?.next_round_starts_at, currentTournament?.status, startAllMatches, serverNow, offset]);

  // Navigate to match
  useEffect(() => {
    if (!user || !tournamentId) return;
    if (!currentTournament || currentTournament.status !== "in_progress") return;

    const navigateToMatch = async (match: any, source: string) => {
      if (fromCompletedMatchRef.current === match.id) return false;
      if (completedMatchIdsRef.current.has(match.id)) return false;

      const completedKey = `${STORAGE_KEYS.TOURNAMENT_MATCH_COMPLETED_PREFIX}${match.id}`;
      const isLocallyDone = await nativeStorage.getItem(completedKey);
      if (isLocallyDone) {
        completedMatchIdsRef.current.add(match.id);
        return false;
      }
      if (match.status === "completed") {
        completedMatchIdsRef.current.add(match.id);
        return false;
      }
      if (navigatedMatchIdRef.current === match.id) return false;
      if (match.winner_id) {
        completedMatchIdsRef.current.add(match.id);
        return false;
      }

      navigatedMatchIdRef.current = match.id;
      setNavigatedToGame(true);
      navigate(`/tournament/game/${match.id}`);
      return true;
    };

    const checkMyMatch = () => {
      const myMatch = matches.find(
        (m) =>
          m.status === "in_progress" &&
          (m as any).countdown_started_at &&
          (m.player1_id === user.id || m.player2_id === user.id),
      );
      if (myMatch && navigatedMatchIdRef.current !== myMatch.id) return navigateToMatch(myMatch, "Initial");
      return false;
    };

    if (!navigatedToGame) checkMyMatch();

    const channel = supabase
      .channel(`my-match-updates-${user.id}-${currentTournament.current_round}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournament_matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          const m = payload.new as any;
          if (m.status === "completed" || m.winner_id) {
            completedMatchIdsRef.current.add(m.id);
            return;
          }
          if (
            m.status === "in_progress" &&
            m.countdown_started_at &&
            (m.player1_id === user.id || m.player2_id === user.id)
          )
            navigateToMatch(m, "Realtime");
        },
      )
      .subscribe();

    return () => {
      console.log("⚠️ [TournamentBracketPage] Cleanup ATLANYOR");
    };
  }, [matches, user, navigatedToGame, tournamentId, navigate, currentTournament]);

  // Champion / eliminated + tournament end toast for all participants
  useEffect(() => {
    if (!user || !matches.length || !currentTournament || !tournamentId) return;

    // Final sesi sadece turnuva gerçekten tamamlandığında çalışsın
    if (currentTournament.status !== "completed") return;

    const finalMatch = matches.find(
      (m) => m.tournament_id === tournamentId && m.round === 3 && m.status === "completed",
    );
    if (!finalMatch?.winner_id) return;

    const isInFinal = finalMatch.player1_id === user.id || finalMatch.player2_id === user.id;

    // Kazanan adını bul
    const winnerParticipant = participants.find((p) => p.user_id === finalMatch.winner_id);
    const winnerName = winnerParticipant?.profiles?.username || "Bir Oyuncu";

    // Tüm katılımcılara (finalist olmayanlar dahil) turnuva bitiş toastı göster
    if (!tournamentEndToastShownRef.current) {
      tournamentEndToastShownRef.current = true;

      // 🎯 Turnuva puanını oynanan aşama sayısına böl (idempotent, tüm katılımcılar için)
      (async () => {
        try {
          const { data: finRes, error: finErr } = await (supabase.rpc as any)("finalize_tournament_score", {
            p_user_id: user.id,
            p_tournament_id: tournamentId,
          });
          if (finErr) console.error("❌ finalize_tournament_score:", finErr);
          else {
            console.log("✅ finalize_tournament_score:", finRes);
            refreshProfile?.();
          }
        } catch (e) {
          console.error("❌ finalize_tournament_score exception:", e);
        }
      })();

      if (finalMatch.winner_id === user.id) {
        // Şampiyon
        championSoundPlayedRef.current = true;
        setShowChampion(true);
        playSpecialSound("/sampiyon.mp3", 0.8);
        giveChampionReward();
        toast.success("🏆 T E B R İ K L E R!", {
          description: (
            <span>
              <span style={{ color: "#f0fdf4" }}>Turnuva Şampiyonu oldunuz! </span>
              <span style={{ color: "#10b981" }}>İşte Ödülünüz</span>
            </span>
          ),
          duration: 8000,
          style: {
            background: "linear-gradient(135deg, #1a1a2e, #16213e)",
            border: "1px solid rgba(16,185,129,0.4)",
            color: "#f0fdf4",
          },
          classNames: {
            title: "!text-amber-400",
          },
        });
      } else if (isInFinal) {
        // Finalde ama kaybetti
        setShowEliminated(true);
        toast.custom(
          () => (
            <div
              className="backdrop-blur-md rounded-xl p-4 shadow-lg"
              style={{
                background: "linear-gradient(135deg, #1a1a2e, #16213e)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fef2f2",
              }}
            >
              <p className="text-base font-medium text-white">🏆 Turnuva Sona Erdi</p>

              <p className="mt-1 text-sm text-red-200 font-normal">Şampiyon: {winnerName} — İyi oyun!</p>
            </div>
          ),
          {
            duration: 8000,
          },
        );
      } else {
        // Finalistte olmayan katılımcı
        toast(`🏆 Turnuva Sona Erdi`, {
          description: `Şampiyon: ${winnerName}`,
          duration: 8000,
          style: {
            background: "linear-gradient(135deg, #1a1a2e, #16213e)",
            border: "1px solid rgba(251,191,36,0.3)",
            color: "#fefce8",
          },
          descriptionClassName: "!text-amber-200",
          classNames: {
            title: "!text-yellow-100",
          },
          icon: "🥇",
        });
      }
    }
  }, [matches, user, participants, currentTournament, tournamentId, showChampion, showEliminated]);

  const giveChampionReward = async () => {
    if (!user || !profile) return;
    const pool = [
      { type: "ink", value: 5, key: "ink", label: "+5 Mürekkep" },
      { type: "joker", value: 2, key: "degistir", label: "+2 Değiştir Jokeri", item: "degistir" },
      { type: "joker", value: 2, key: "senyaz", label: "+2 Sen Yaz Jokeri", item: "senyaz" },
      { type: "joker", value: 2, key: "fisilda", label: "+2 Fısılda Jokeri", item: "fisilda" },
      { type: "credits", value: 3, key: "credits", label: "+3 Oyun Hakkı" },
      { type: "extra_spin", value: 1, key: "extra_spin", label: "+1 Çark Hakkı" },
    ];
    const selected = pool[Math.floor(Math.random() * pool.length)];
    setWonReward(selected);
    try {
      if (selected.type === "ink") {
        await supabase
          .from("profiles")
          .update({ ink_count: (profile.ink_count || 0) + selected.value })
          .eq("id", user.id);
      } else if (selected.type === "credits") {
        const g = profile.game_credits || 0,
          b = profile.bonus_credits || 0;
        const space = Math.max(0, 5 - g);
        const toG = Math.min(selected.value, space);
        await supabase
          .from("profiles")
          .update({ game_credits: g + toG, bonus_credits: b + (selected.value - toG) })
          .eq("id", user.id);
      } else if (selected.type === "joker" && (selected as any).item) {
        const { data: ex } = await supabase
          .from("user_inventory")
          .select("quantity")
          .eq("user_id", user.id)
          .eq("item_type", (selected as any).item)
          .single();
        if (ex)
          await supabase
            .from("user_inventory")
            .update({ quantity: ex.quantity + selected.value })
            .eq("user_id", user.id)
            .eq("item_type", (selected as any).item);
        else
          await supabase
            .from("user_inventory")
            .insert({ user_id: user.id, item_type: (selected as any).item, quantity: selected.value });
      } else if (selected.type === "extra_spin") {
        await supabase
          .from("profiles")
          .update({ bonus_spins: (profile?.bonus_spins || 0) + selected.value })
          .eq("id", user.id);
      }
      refreshProfile?.();
    } catch (e) {
      console.error("Ödül hatası:", e);
    }
  };

  useEffect(() => {
    if (!showChampion && !showEliminated) return;
    const t = setTimeout(() => navigate("/tournament"), 10000);
    return () => clearTimeout(t);
  }, [showChampion, showEliminated, navigate]);

  useEffect(() => {
    if (!tournamentId || !currentTournament || currentTournament.status !== "in_progress") return;
    const interval = setInterval(() => checkAndAdvance(), 5000);
    return () => clearInterval(interval);
  }, [tournamentId, currentTournament, checkAndAdvance]);

  const matchesByRound = useMemo(() => {
    const rounds: { [k: number]: typeof matches } = {};
    matches.forEach((m) => {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    });
    Object.values(rounds).forEach((arr) => arr.sort((a, b) => a.match_number - b.match_number));
    return rounds;
  }, [matches]);

  // ── Türetilmiş state ─────────────────────────────────────────────────────
  const currentRound = currentTournament?.current_round || 1;
  const hasPendingMatches = matches.some((m) => m.round === currentRound && m.status === "pending");
  const currentRoundMatches = matches.filter((m) => m.round === currentRound);
  const hasActiveCountdown = hasPendingMatches && countdown > 0;

  // "Birazdan maç başlayacak" — tur oluşturuldu ama henüz geri sayım yok
  const isWaitingForCountdown =
    currentTournament?.status === "in_progress" &&
    currentRoundMatches.length > 0 &&
    hasPendingMatches &&
    !hasActiveCountdown &&
    !loading;

  // Tur henüz oluşturulmamış (round geçişi bekleniyor)
  const isWaitingForRoundCreation =
    currentTournament?.status === "in_progress" &&
    !hasActiveCountdown &&
    !isWaitingForCountdown &&
    (initialLoading || loading || currentRoundMatches.length === 0);

  // ── Özel ekranlar ────────────────────────────────────────────────────────

  if (!currentTournament || initialLoading) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        <div className="w-24 h-24 mb-4">
          {cupLottie ? (
            <Lottie animationData={cupLottie} loop autoplay />
          ) : (
            <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-amber-400 animate-spin mx-auto mt-6" />
          )}
        </div>
        <p className="text-white/60 text-sm font-medium uppercase tracking-widest">Turnuva yükleniyor</p>
      </div>
    );
  }

  if (showChampion) {
    return (
      <div
        className="fixed inset-0 z-[100] flex flex-col items-center overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        {/* Üst katman: random kazanma görseli */}
        <div className="relative w-full flex-1 flex items-center justify-center">
          {championLottie && (
            <Lottie
              animationData={championLottie}
              loop
              autoplay
              className="w-full h-full max-h-[55vh] object-contain"
            />
          )}
          {/* Konfeti üst katman */}
          {konfetiLottie && (
            <div className="absolute inset-0 pointer-events-none z-20">
              <Lottie animationData={konfetiLottie} loop autoplay className="w-full h-full" />
            </div>
          )}
        </div>
        {/* Eski canvas konfeti (yedek partikül efekti) */}
        <canvas ref={confettiCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />
        {/* Ödül kartı (aynı kalıyor) */}
        <div className="relative z-30 flex flex-col items-center justify-end w-full pb-8 -translate-y-[70px]">
          {wonReward && (
            <div className="text-center">
              <h2 className="text-white text-2xl font-bold mb-4">Ödülünüz</h2>
              <img
                src={REWARD_IMAGES[wonReward.key as keyof typeof REWARD_IMAGES] ?? REWARD_IMAGES.ink}
                className="w-[86vw] max-w-[360px] h-auto mx-auto rounded-2xl drop-shadow-2xl mt-4 select-none"
                draggable={false}
                alt={wonReward.label ?? "Kazanılan Ödül"}
              />

            </div>
          )}
        </div>
      </div>
    );
  }

  if (showEliminated) {
    const detectedEarlyLostRound = matches.find(
      (m) =>
        user &&
        (m.round === 1 || m.round === 2 || m.round === 3) &&
        m.status === "completed" &&
        (m.player1_id === user.id || m.player2_id === user.id) &&
        m.winner_id &&
        m.winner_id !== user.id,
    )?.round;
    const resolvedEliminatedRound = eliminatedRound ?? detectedEarlyLostRound ?? null;

    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-6"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        <div className="w-full max-w-md px-6 min-h-[260px] flex items-center justify-center">
          {eliminatedLottie ? (
            <Lottie animationData={eliminatedLottie} loop autoplay className="w-full h-full" />
          ) : !eliminatedLottieLoadDone ? (
            <div className="w-12 h-12 rounded-full border-2 border-white/20 border-t-amber-400 animate-spin" />
          ) : null}
        </div>

        <div className="w-full max-w-md px-6 flex items-center justify-center">
          <img
            src="/elendinGif.gif"
            alt="Elendin"
            className="w-full max-w-[16rem] h-auto select-none pointer-events-none"
            draggable={false}
          />
        </div>

        <div
          onClick={() => navigate("/tournament")}
          className="flex items-center gap-3 cursor-pointer rounded-2xl px-4 py-3 bg-white/8 ring-1 ring-white/10 hover:bg-white/12 active:scale-95 transition-all"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="text-sm font-semibold text-white/95">Turnuvalara Dön</span>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/20 text-amber-300">
            <Trophy className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }



  // ── Ana bracket ekranı ───────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 flex flex-col text-slate-100 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      {/* Arka plan ışık efekti */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none opacity-40" />

      {/* ── Ekran ortası 3-2-1 Lottie ── */}
      {hasActiveCountdown && countdown <= 3 && bracket321Lottie && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div style={{ width: "min(95vw, 600px)", height: "min(95vw, 600px)" }}>
            <Lottie
              key={`321-${currentTournament?.next_round_starts_at || "cd"}`}
              lottieRef={bracket321LottieRef}
              animationData={bracket321Lottie}
              loop={false}
              autoplay={false}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
        </div>
      )}


      {/* ── HEADER ── */}
      <div
        className="flex-none z-10 px-5 pt-6 pb-4 border-b border-white/5 shadow-xl"
        style={{ backgroundColor: "#1a1a2e" }}
      >
        <div className="flex items-center justify-between">
          {/* Geri butonu */}
          <button
            type="button"
            disabled={isLeaving}
            onClick={() => openExitDialog("back")}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white/80 bg-white/8 ring-1 ring-white/15 active:scale-90 transition-transform hover:bg-white/12 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            Geri
          </button>

          {/* Başlık */}
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 bg-amber-400 rounded-full" />
            <h1 className="text-sm font-black text-white uppercase tracking-widest truncate max-w-[140px]">
              {currentTournament.name}
            </h1>
          </div>

          {/* Ayrıl butonu */}
          <button
            type="button"
            disabled={isLeaving}
            onClick={() => openExitDialog("leave")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-300 bg-red-500/10 ring-1 ring-red-500/20 active:scale-90 transition-transform hover:bg-red-500/15 disabled:opacity-40"
          >
            <LogOut className="w-3.5 h-3.5" />
            {isLeaving ? "Çıkıyor..." : "Ayrıl"}
          </button>
        </div>
      </div>

      {/* Lottie'li çıkış onay diyaloğu */}
      <ExitConfirmCardDialog
        open={showExitDialog}
        variant="tournament-bracket"
        onContinue={closeExitDialog}
        onExit={handleConfirmExit}
      />


      {/* ── Sticky geri sayım ve banner'lar ── */}
      {(isWaitingForCountdown || isWaitingForRoundCreation || hasActiveCountdown) && (
        <div className="flex-none z-20 px-5 pt-3 pb-0">
          {/* ── "Birazdan maç başlayacak" banner'ı ── */}
          {isWaitingForCountdown && (
            <div className="bg-[#16213e]/95 ring-1 ring-amber-400/20 rounded-3xl px-5 py-4 flex flex-col items-center gap-3 shadow-xl backdrop-blur-sm">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 ring-1 ring-amber-400/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-black text-white uppercase tracking-widest mb-1">Birazdan Maç Başlayacak</p>
                <p className="text-xs text-slate-400">
                  {currentRound === 1 ? "Çeyrek Final" : currentRound === 2 ? "Yarı Final" : "Final"} hazırlanıyor,
                  lütfen bekleyin…
                </p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Tur geçiş loading ── */}
          {isWaitingForRoundCreation && (
            <div className="bg-[#16213e]/95 ring-1 ring-indigo-400/20 rounded-3xl px-5 py-4 flex flex-col items-center gap-3 shadow-xl backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-indigo-400 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-black text-white uppercase tracking-widest mb-1">
                  {currentRound === 2 ? "Yarı Final" : currentRound === 3 ? "Final" : "Tur"} Oluşturuluyor
                </p>
                <p className="text-xs text-slate-400">Eşleşmeler hazırlanıyor…</p>
              </div>
            </div>
          )}

          {/* ── Aktif geri sayım ── */}
          {hasActiveCountdown && (
            <div className="bg-[#16213e]/95 ring-1 ring-rose-400/30 rounded-3xl px-5 py-1.5 flex items-center gap-4 shadow-xl backdrop-blur-sm">
              <div className="w-24 h-12 flex-shrink-0 flex items-center justify-center relative" style={{ overflow: "visible" }}>
                {bracket10Lottie ? (
                  <div style={{ width: 160, height: 160, position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none" }}>
                    <Lottie
                      key={currentTournament?.next_round_starts_at || "cd"}
                      lottieRef={bracket10LottieRef}
                      animationData={bracket10Lottie}
                      loop={false}
                      autoplay={false}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-red-500/20 ring-2 ring-red-500/40 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-red-400 leading-none">{countdown}</span>
                    <span className="text-[9px] text-red-400/70 uppercase tracking-wider">sn</span>
                  </div>
                )}
              </div>
              <div className="pl-4">
                <p className="text-sm font-black text-white uppercase tracking-widest">
                  {currentRound === 1 ? "Çeyrek Final" : currentRound === 2 ? "Yarı Final" : "Final"} Başlıyor
                </p>
                <p className="text-xs text-slate-400 mt-0.5">Hazır ol!</p>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── SCROLLABLE İÇERİK ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-8 relative z-10">
        {/* ── Bracket ── */}
        {[1, 2, 3].map((round) => {
          const info = ROUND_INFO[round as 1 | 2 | 3];
          const Icon = info.icon;
          const isCurrentRound = round === currentRound;

          return (
            <div
              key={round}
              className={`bg-[#16213e]/80 ring-1 rounded-3xl overflow-hidden shadow-xl transition-all
                ${isCurrentRound ? "ring-white/15" : "ring-white/5 opacity-70"}`}
            >
              {/* Tur başlığı */}
              <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1 h-5 ${info.dot} rounded-full`} />
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">{info.name}</h3>
                </div>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${info.bg} ring-1 ${info.ring}`}>
                  <Icon className="w-4 h-4 text-white/70" />
                </div>
              </div>

              {/* Maçlar */}
              <div className="px-4 py-4 space-y-3">
                {matchesByRound[round]?.length ? (
                  matchesByRound[round].map((match) => (
                    <MatchCard key={match.id} match={match} round={round as 1 | 2 | 3} />
                  ))
                ) : (
                  <div className="flex items-center gap-2 py-3 opacity-40">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                    <p className="text-xs text-slate-400">Maçlar henüz oluşturulmadı</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TournamentBracketPage;
