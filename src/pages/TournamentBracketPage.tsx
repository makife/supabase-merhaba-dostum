import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Home, Clock, Crown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTournament } from "@/hooks/useTournament";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSounds } from "@/hooks/useSounds";
import { generateBotName, generateBotAvatar } from "@/utils/tournamentHelpers";
import { toast } from "sonner";

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playSpecialSound } = useSounds();

  const { currentTournament, matches, participants, loading, fetchTournamentDetails, advanceToNextRound } =
    useTournament(tournamentId);

  const [countdown, setCountdown] = useState(10);
  const [showChampion, setShowChampion] = useState(false);
  const [showEliminated, setShowEliminated] = useState(false);
  const [navigatedToGame, setNavigatedToGame] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // Bracket'e ilk girişte hemen spinner göster

  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const matchesStartedRef = useRef<string | null>(null);
  const advancingRef = useRef(false);

  // Fetch tournament on mount
  useEffect(() => {
    if (tournamentId) {
      setInitialLoading(true); // Her yeni tournamentId'de loading'i resetle
      fetchTournamentDetails(tournamentId).finally(() => {
        // Data yüklendikten sonra kısa bir delay ile initialLoading'i kapat
        setTimeout(() => setInitialLoading(false), 300);
      });
      setNavigatedToGame(false);
    }
  }, [tournamentId]);

  // Reset navigation flag on round change
  useEffect(() => {
    if (currentTournament?.current_round) {
      setNavigatedToGame(false);
      matchesStartedRef.current = null;
    }
  }, [currentTournament?.current_round]);

  // Start all matches for current round
  const startAllMatches = useCallback(async () => {
    if (!tournamentId || !user || !currentTournament) return;

    // Only creator starts matches
    if (currentTournament.creator_id !== user.id) return;

    const currentRound = currentTournament.current_round || 1;
    const roundKey = `${tournamentId}-${currentRound}`;

    if (matchesStartedRef.current === roundKey) return;
    matchesStartedRef.current = roundKey;

    console.log(`🎮 Round ${currentRound} maçları başlatılıyor...`);

    try {
      // Get pending matches for this round
      const { data: pendingMatches } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round", currentRound)
        .eq("status", "pending");

      if (!pendingMatches || pendingMatches.length === 0) return;

      // Get bot info
      const botIds = new Set<string>();
      participants.forEach((p) => {
        if (p.is_bot && p.user_id) botIds.add(p.user_id);
      });

      for (const match of pendingMatches) {
        const player1IsBot = botIds.has(match.player1_id || "") || match.player1_id?.startsWith("bot_");
        const player2IsBot = botIds.has(match.player2_id || "") || match.player2_id?.startsWith("bot_");

        if (player1IsBot && player2IsBot) {
          // Both bots - complete immediately
          const p1Score = Math.floor(Math.random() * 50) + 20;
          const p2Score = Math.floor(Math.random() * 50) + 20;
          const winnerId = p1Score >= p2Score ? match.player1_id : match.player2_id;

          await supabase
            .from("tournament_matches")
            .update({
              status: "completed",
              player1_score: p1Score,
              player2_score: p2Score,
              winner_id: winnerId,
            })
            .eq("id", match.id);

          console.log(`🤖 Bot maçı tamamlandı: ${match.id}`);
        } else {
          // Real player match - start countdown
          // Özel oda ile aynı mantık: 5sn buffer + 5sn countdown + 120sn oyun = 130sn
          const now = new Date();
          const countdownStartedAt = now.toISOString();
          const endsAt = new Date(now.getTime() + 130 * 1000).toISOString();

          await supabase
            .from("tournament_matches")
            .update({
              status: "in_progress",
              countdown_started_at: countdownStartedAt,
              ends_at: endsAt,
            })
            .eq("id", match.id);

          console.log(`⚔️ Maç başladı: ${match.id}, countdown_started_at: ${countdownStartedAt}, ends_at: ${endsAt}`);
        }
      }

      // Check if we need to advance
      setTimeout(() => checkAndAdvance(), 2000);
    } catch (error) {
      console.error("❌ Maç başlatma hatası:", error);
      matchesStartedRef.current = null;
    }
  }, [tournamentId, user, currentTournament, participants]);

  // Check and advance round
  const checkAndAdvance = useCallback(async () => {
    if (!tournamentId || !user || !currentTournament || advancingRef.current) return;
    if (currentTournament.creator_id !== user.id) return;

    const currentRound = currentTournament.current_round || 1;

    const { data: roundMatches } = await supabase
      .from("tournament_matches")
      .select("status")
      .eq("tournament_id", tournamentId)
      .eq("round", currentRound);

    if (!roundMatches) return;

    const allCompleted = roundMatches.every((m) => m.status === "completed");

    if (allCompleted && currentRound < 3) {
      advancingRef.current = true;
      console.log(`📈 Round ${currentRound} tamamlandı, ilerleniyor...`);
      await advanceToNextRound(tournamentId);
      advancingRef.current = false;
    } else if (allCompleted && currentRound === 3) {
      await supabase
        .from("tournaments")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", tournamentId);
    }
  }, [tournamentId, user, currentTournament, advanceToNextRound]);

  // Countdown for next round
  useEffect(() => {
    if (!currentTournament || currentTournament.status !== "in_progress") return;
    if (!currentTournament.next_round_starts_at) return;

    const targetTime = new Date(currentTournament.next_round_starts_at).getTime();

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((targetTime - now) / 1000));
      setCountdown(remaining);

      if (remaining === 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        startAllMatches();
      }
    };

    tick();
    countdownRef.current = setInterval(tick, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [currentTournament?.next_round_starts_at, currentTournament?.status, startAllMatches]);

  // Navigate to game when my match starts - with realtime subscription
  useEffect(() => {
    if (!user || !tournamentId) return;
    if (!currentTournament || currentTournament.status !== "in_progress") return;
    if (navigatedToGame) return;

    // İlk yükleme kontrolü
    const checkMyMatch = () => {
      const myMatch = matches.find(
        (m) =>
          m.status === "in_progress" &&
          (m as any).countdown_started_at &&
          (m.player1_id === user.id || m.player2_id === user.id),
      );

      if (myMatch) {
        console.log("🎮 My match started, navigating to game:", myMatch.id);
        setNavigatedToGame(true);
        navigate(`/game?match=${myMatch.id}&tournament=${tournamentId}`);
        return true;
      }
      return false;
    };

    // İlk kontrol
    if (checkMyMatch()) return;

    // Realtime subscription - maç durumu değiştiğinde kontrol et
    const channel = supabase
      .channel(`my-match-updates-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournament_matches",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          const newMatch = payload.new as any;
          // Benim maçım mı ve in_progress mu?
          if (
            newMatch.status === "in_progress" &&
            newMatch.countdown_started_at &&
            (newMatch.player1_id === user.id || newMatch.player2_id === user.id)
          ) {
            console.log("🎮 [Realtime] My match started, navigating:", newMatch.id);
            setNavigatedToGame(true);
            navigate(`/game?match=${newMatch.id}&tournament=${tournamentId}`);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matches, user, navigatedToGame, tournamentId, navigate, currentTournament]);

  // Check for champion/eliminated
  useEffect(() => {
    if (!user || !matches.length) return;

    const finalMatch = matches.find((m) => m.round === 3 && m.status === "completed");
    if (!finalMatch?.winner_id) return;

    const isInFinal = finalMatch.player1_id === user.id || finalMatch.player2_id === user.id;

    if (finalMatch.winner_id === user.id && !showChampion) {
      setShowChampion(true);
      playSpecialSound("/sampiyon.mp3", 0.8);

      // 🏆 ŞAMPİYONA ÖDÜLÜ VER
      giveChampionReward();
    } else if (isInFinal && finalMatch.winner_id !== user.id && !showEliminated) {
      setShowEliminated(true);
    }
  }, [matches, user, showChampion, showEliminated, playSpecialSound]);

  // 🆕 Şampiyona ödül verme fonksiyonu
  const giveChampionReward = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase.rpc as any)("give_tournament_champion_reward", {
        p_user_id: user.id,
        p_reward_amount: 5,
      });

      if (error) {
        console.error("❌ RPC hatası:", error);
        throw error;
      }

      const result = data as { success: boolean; reward_amount: number; new_ink_count: number };

      if (result?.success) {
        toast.success("🎉 Tebrikler Şampiyon!", {
          description: `${result.reward_amount} damla mürekkep kazandınız! 💧`,
          duration: 5000,
        });

        console.log(
          `🏆 Şampiyona ödülü verildi: +${result.reward_amount} mürekkep (Yeni toplam: ${result.new_ink_count})`,
        );
      }
    } catch (error) {
      console.error("❌ Şampiyona ödülü verme hatası:", error);
      // Kullanıcıya hata gösterme - sessizce logla
      // (Şampiyonluk deneyimini bozmamak için)
    }
  };

  // Auto-redirect after champion/eliminated screens
  useEffect(() => {
    if (!showChampion && !showEliminated) return;
    const timer = setTimeout(() => navigate("/tournament"), 10000);
    return () => clearTimeout(timer);
  }, [showChampion, showEliminated, navigate]);

  // Periodically check for round advancement
  useEffect(() => {
    if (!tournamentId || !currentTournament || currentTournament.status !== "in_progress") return;

    const interval = setInterval(() => {
      checkAndAdvance();
    }, 5000);

    return () => clearInterval(interval);
  }, [tournamentId, currentTournament, checkAndAdvance]);

  // Organize matches by round
  const matchesByRound = useMemo(() => {
    const rounds: { [key: number]: typeof matches } = {};
    matches.forEach((m) => {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    });
    Object.values(rounds).forEach((arr) => arr.sort((a, b) => a.match_number - b.match_number));
    return rounds;
  }, [matches]);

  // Loading state
  if (!currentTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
          <p>Turnuva yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Champion screen
  if (showChampion) {
    const finalMatch = matches.find((m) => m.round === 3);
    const championName =
      finalMatch?.winner_id === finalMatch?.player1_id ? finalMatch?.player1?.username : finalMatch?.player2?.username;

    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-600 to-orange-700 p-4 flex items-center justify-center">
        <div className="text-center">
          <Crown className="w-20 h-20 text-yellow-200 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Şampiyon!</h1>
          <h2 className="text-2xl text-yellow-200 mb-6">{championName || "Tebrikler"}</h2>
          <Button onClick={() => navigate("/tournament")} className="bg-blue-600 hover:bg-blue-700">
            <Trophy className="w-4 h-4 mr-2" />
            Turnuva Listesi
          </Button>
        </div>
      </div>
    );
  }

  // Eliminated screen
  if (showEliminated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-700 to-purple-800 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <h1 className="text-4xl font-bold text-white mb-2">Elendiniz!</h1>
          <Button onClick={() => navigate("/tournament")} className="bg-blue-600 hover:bg-blue-700">
            <Trophy className="w-4 h-4 mr-2" />
            Turnuva Listesi
          </Button>
        </div>
      </div>
    );
  }

  // Check pending matches for countdown
  const currentRound = currentTournament.current_round || 1;
  const hasPendingMatches = matches.some((m) => m.round === currentRound && m.status === "pending");
  
  // Mevcut round maçları henüz oluşturulmadı mı kontrol et
  const currentRoundMatches = matches.filter((m) => m.round === currentRound);
  
  // Countdown aktifse (maçlar pending ve geri sayım var) spinner'ı gizle
  const hasActiveCountdown = hasPendingMatches && countdown > 0;
  
  // Loading spinner: maçlar oluşturulmadıysa VE countdown henüz başlamadıysa göster
  const isWaitingForRoundCreation = 
    currentTournament.status === "in_progress" && 
    !hasActiveCountdown && 
    (initialLoading || loading || currentRoundMatches.length === 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button onClick={() => navigate("/tournament")} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Home className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Ana Sayfa</span>
          </Button>
          <div className="text-center flex-1 mx-2">
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">{currentTournament.name}</h1>
            <p className="text-gray-300 text-xs sm:text-sm">Turnuva Ağacı</p>
          </div>
          <div className="w-16 sm:w-24" />
        </div>

        {/* Round Oluşturuluyor Loading - countdown başlayana kadar göster */}
        {isWaitingForRoundCreation && (
          <Card className="mb-4 bg-indigo-800 border-indigo-600">
            <CardContent className="p-4 text-center">
              <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-2 animate-spin" />
              <p className="text-yellow-200 text-sm font-medium">
                🔄 {currentRound === 2 ? "Yarı Final" : currentRound === 3 ? "Final" : "Round"} oluşturuluyor, lütfen bekleyin...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Countdown - maçlar oluştuktan sonra geri sayım */}
        {hasActiveCountdown && (
          <Card className="mb-4 bg-indigo-800 border-indigo-600">
            <CardContent className="p-3 text-center">
              <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
              <p className="text-white font-medium text-sm">
                {currentRound === 1 ? "Çeyrek Final" : currentRound === 2 ? "Yarı Final" : "Final"} başlıyor...
              </p>
              <p className="text-yellow-300 text-xl font-bold">{countdown} saniye</p>
            </CardContent>
          </Card>
        )}

        {/* Bracket */}
        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
          {[1, 2, 3].map((round) => {
            const roundInfo = {
              1: { name: "Çeyrek Final", icon: "⚔️", color: "bg-purple-700", border: "border-purple-500" },
              2: { name: "Yarı Final", icon: "🔥", color: "bg-orange-700", border: "border-orange-500" },
              3: { name: "Final", icon: "👑", color: "bg-yellow-600", border: "border-yellow-400" },
            }[round]!;

            return (
              <div key={round}>
                <div className="text-center mb-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${roundInfo.color}`}>
                    <span className="text-base">{roundInfo.icon}</span>
                    <span className="text-white font-semibold text-sm">{roundInfo.name}</span>
                  </div>
                </div>

                {matchesByRound[round]?.length ? (
                  matchesByRound[round].map((match) => <MatchCard key={match.id} match={match} roundInfo={roundInfo} />)
                ) : (
                  <Card className="bg-white/5 border-white/10 mb-3">
                    <CardContent className="p-3 text-center text-gray-400 text-sm">
                      Maçlar henüz oluşturulmadı
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Match Card Component
const MatchCard = ({ match, roundInfo }: { match: any; roundInfo: { color: string; border: string } }) => {
  const getPlayerInfo = (playerId: string | null, playerData: any) => {
    if (!playerId) return { name: "TBD", isBot: false, avatar_url: null };

    const isBot = playerData?.is_bot || playerId.startsWith("bot_");
    if (isBot) {
      const seed = [...playerId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const botName = playerData?.username || generateBotName(seed);
      return { 
        name: botName, 
        isBot: true, 
        avatar_url: generateBotAvatar(seed, botName) 
      };
    }

    return { name: playerData?.username || "Oyuncu", isBot: false, avatar_url: playerData?.avatar_url };
  };

  const player1 = getPlayerInfo(match.player1_id, match.player1);
  const player2 = getPlayerInfo(match.player2_id, match.player2);
  const isCompleted = match.status === "completed";
  const winner = match.winner_id;

  const statusText =
    match.status === "completed" ? "Tamamlandı" : match.status === "in_progress" ? "Oynanıyor" : "Bekliyor";
  const statusColor =
    match.status === "completed" ? "bg-green-600" : match.status === "in_progress" ? "bg-yellow-600" : "bg-blue-600";

  return (
    <Card className={`${roundInfo.color} border ${roundInfo.border} mb-3`}>
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-white text-sm font-medium">Maç {match.match_number}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColor} text-white`}>{statusText}</span>
        </div>

        {/* Player 1 */}
        <PlayerRow
          player={player1}
          score={match.player1_score}
          isWinner={isCompleted && winner === match.player1_id}
          isCompleted={isCompleted}
        />

        <div className="text-center text-white/60 text-xs my-1">VS</div>

        {/* Player 2 */}
        <PlayerRow
          player={player2}
          score={match.player2_score}
          isWinner={isCompleted && winner === match.player2_id}
          isCompleted={isCompleted}
        />

        {match.status === "in_progress" && (
          <div className="mt-2 text-center">
            <span className="text-yellow-300 text-xs">⚡ Maç devam ediyor</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const PlayerRow = ({
  player,
  score,
  isWinner,
  isCompleted,
}: {
  player: any;
  score: number;
  isWinner: boolean;
  isCompleted: boolean;
}) => (
  <div className={`rounded p-2 ${isWinner ? "bg-green-700 border border-green-400" : "bg-white/10"}`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Avatar className="w-7 h-7 flex-shrink-0">
          <AvatarImage src={player.avatar_url || undefined} />
          <AvatarFallback className="bg-blue-600 text-white text-xs">
            {player.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-white text-sm truncate">{player.name}</span>
      </div>
      {isCompleted && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {isWinner && <Trophy className="w-4 h-4 text-yellow-400" />}
          <span className="text-white font-bold">{score}</span>
        </div>
      )}
    </div>
  </div>
);

export default TournamentBracketPage;
