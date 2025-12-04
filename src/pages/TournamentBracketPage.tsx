import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Home, Clock, Crown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useTournament } from "@/hooks/useTournament";
import { organizeMatchesByRound, getRoundName, getMatchStatus, generateBotName } from "@/utils/tournamentHelpers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSounds } from "@/hooks/useSounds";

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { currentTournament, matches, loading, fetchTournamentDetails, serverTimeOffset } = useTournament(tournamentId);
  const { user } = useAuth();
  const { playSpecialSound } = useSounds();

  const [countdown, setCountdown] = useState(10);
  const [showChampion, setShowChampion] = useState(false);
  const [showEliminated, setShowEliminated] = useState(false);
  const [navigatedToGame, setNavigatedToGame] = useState(false);
  const countdownGuard = useRef<{ round: number | null; active: boolean; anchorTs: number | null }>({
    round: null,
    active: false,
    anchorTs: null,
  });
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const placeholdersEnsuredRef = useRef(false);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails(tournamentId);
      setNavigatedToGame(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (currentTournament?.current_round) {
      setNavigatedToGame(false);
    }
  }, [currentTournament?.current_round]);

  const startAllMatches = async (forceRound?: number) => {
    if (!tournamentId) return;

    try {
      const currentRound = forceRound ?? (currentTournament?.current_round || 1);
      console.log(`🎬 Starting matches for round ${currentRound}...`);

      const { data: updateResult, error: updateError } = await supabase
        .from("tournament_matches")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("tournament_id", tournamentId)
        .eq("round", currentRound)
        .eq("status", "pending")
        .select();

      if (updateError) {
        console.error("❌ Failed to update matches to in_progress:", updateError);
        return;
      }

      console.log(`✅ Updated ${updateResult?.length || 0} matches to in_progress`);
      await simulateBotMatches(currentRound);
    } catch (e) {
      console.error("Error starting matches:", e);
    }
  };

  const simulateBotMatches = async (round: number) => {
    try {
      console.log(`🤖 simulateBotMatches called for round ${round}`);

      const { data: participants } = await supabase
        .from("tournament_participants")
        .select("user_id, is_bot")
        .eq("tournament_id", tournamentId);

      const botMap = new Map();
      participants?.forEach((p) => {
        if (p.user_id) {
          botMap.set(p.user_id, p.is_bot);
        }
        if (p.is_bot && p.user_id && p.user_id.startsWith("bot_")) {
          botMap.set(p.user_id, true);
        }
      });

      const { data: botMatches, error: matchError } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round", round)
        .eq("status", "in_progress");

      if (matchError || !botMatches || botMatches.length === 0) {
        return;
      }

      for (const match of botMatches) {
        const player1IsBot = botMap.get(match.player1_id) || match.player1_id?.startsWith("bot_") || false;
        const player2IsBot = botMap.get(match.player2_id) || match.player2_id?.startsWith("bot_") || false;
        const hasNullPlayer = !match.player1_id || !match.player2_id;

        if (hasNullPlayer) continue;

        if (player1IsBot && player2IsBot) {
          const player1Score = Math.floor(Math.random() * 50) + 20;
          const player2Score = Math.floor(Math.random() * 50) + 20;
          const winnerId = player1Score > player2Score ? match.player1_id : match.player2_id;

          await supabase
            .from("tournament_matches")
            .update({
              status: "completed",
              player1_score: player1Score,
              player2_score: player2Score,
              winner_id: winnerId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", match.id);
        } else {
          await supabase
            .from("tournament_matches")
            .update({
              room_id: match.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", match.id);

          const { data: countdownStart, error: rpcError } = await supabase.rpc("start_game_countdown", {
            p_room_id: match.id,
          });

          if (!rpcError && countdownStart) {
            await supabase
              .from("tournament_matches")
              .update({
                countdown_started_at: countdownStart,
                updated_at: new Date().toISOString(),
              })
              .eq("id", match.id);
          } else {
            const fallbackTime = new Date().toISOString();
            await supabase
              .from("tournament_matches")
              .update({
                countdown_started_at: fallbackTime,
                updated_at: new Date().toISOString(),
              })
              .eq("id", match.id);
          }
        }
      }

      setTimeout(() => {
        checkAndAdvanceRound(round);
      }, 2000);
    } catch (error) {
      console.error("Error simulating bot matches:", error);
    }
  };

  const checkAndAdvanceRound = async (round: number) => {
    try {
      const { data: participants } = await supabase
        .from("tournament_participants")
        .select("user_id, is_bot")
        .eq("tournament_id", tournamentId);

      const botMap = new Map();
      participants?.forEach((p) => {
        if (p.user_id) {
          botMap.set(p.user_id, p.is_bot);
        }
      });

      const { data: roundMatches } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round", round);

      if (!roundMatches) return;

      const allCompleted = roundMatches.every((m) => m.status === "completed");

      const hasRealPlayerMatches = roundMatches.some((m) => {
        const player1IsBot = botMap.get(m.player1_id) || m.player1_id?.startsWith("bot_") || false;
        const player2IsBot = botMap.get(m.player2_id) || m.player2_id?.startsWith("bot_") || false;
        return !player1IsBot || !player2IsBot;
      });

      if (hasRealPlayerMatches) {
        const realPlayerMatchesCompleted = roundMatches
          .filter((m) => {
            const player1IsBot = botMap.get(m.player1_id) || m.player1_id?.startsWith("bot_") || false;
            const player2IsBot = botMap.get(m.player2_id) || m.player2_id?.startsWith("bot_") || false;
            return !player1IsBot || !player2IsBot;
          })
          .every((m) => m.status === "completed");

        if (!realPlayerMatchesCompleted) return;
      }

      if (allCompleted && round < 3) {
        const { data: nextRoundMatches } = await supabase
          .from("tournament_matches")
          .select("*", { count: "exact" })
          .eq("tournament_id", tournamentId)
          .eq("round", round + 1);

        if (nextRoundMatches && nextRoundMatches.length > 0) return;

        await supabase
          .from("tournament_matches")
          .update({ countdown_started_at: null })
          .eq("tournament_id", tournamentId)
          .eq("round", round);

        const { data: result, error } = await supabase.rpc("advance_tournament_round", {
          p_tournament_id: tournamentId,
        });

        if (result && typeof result === "object" && "success" in result && result.success) {
          fetchTournamentDetails(tournamentId!);
        }
      } else if (allCompleted && round === 3) {
        await supabase
          .from("tournaments")
          .update({ status: "completed", finished_at: new Date().toISOString() })
          .eq("id", tournamentId);
      }
    } catch (error) {
      console.error("Error checking round completion:", error);
    }
  };

  useEffect(() => {
    if (!tournamentId || !currentTournament || !user) return;

    const finalMatch = matches.find((m) => m.round === 3 && m.status === "completed");
    if (!finalMatch || !finalMatch.winner_id) return;

    const championId = finalMatch.winner_id;
    const isUserInFinal = finalMatch.player1_id === user.id || finalMatch.player2_id === user.id;

    if (championId === user.id && !showChampion) {
      setShowChampion(true);
      playSpecialSound("/sampiyon.mp3", 0.8);
    } else if (isUserInFinal && championId !== user.id && !showEliminated) {
      setShowEliminated(true);
    }
  }, [matches, tournamentId, currentTournament, user, playSpecialSound, showChampion, showEliminated]);

  const botSimulationTriggeredRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!tournamentId || !currentTournament || currentTournament.status !== "in_progress") return;
    if (matches.length === 0) return;

    const currentRound = currentTournament.current_round;
    if (!currentRound) return;

    const inProgressMatches = matches.filter((m) => m.round === currentRound && m.status === "in_progress");

    if (inProgressMatches.length > 0) {
      const roundKey = `${tournamentId}-${currentRound}`;
      if (botSimulationTriggeredRef.current === roundKey) return;
      
      botSimulationTriggeredRef.current = roundKey;
      simulateBotMatches(currentRound);
    }
  }, [tournamentId, currentTournament?.status, currentTournament?.current_round, matches]);

  useEffect(() => {
    if (!tournamentId || !currentTournament || currentTournament.status !== "in_progress") return;
    if (matches.length === 0) return;

    const currentRound = currentTournament.current_round;
    if (!currentRound) return;

    const currentRoundMatches = matches.filter((m) => m.round === currentRound);
    if (currentRoundMatches.length === 0) return;

    const allCompleted = currentRoundMatches.every((m) => m.status === "completed");

    if (allCompleted && currentRound < 3) {
      setTimeout(() => {
        checkAndAdvanceRound(currentRound);
      }, 1000);
    }
  }, [matches, currentTournament, tournamentId]);

  useEffect(() => {
    if (!currentTournament || currentTournament.status !== "in_progress") return;
    if (matches.length === 0) return;

    const currentRound = currentTournament.current_round;
    if (!currentRound) return;

    const pendingMatches = matches.filter(
      (m) => m.round === currentRound && m.status === "pending" && m.player1_id && m.player2_id,
    );

    if (pendingMatches.length > 0) {
      const anchorTs = currentTournament.next_round_starts_at
        ? new Date(currentTournament.next_round_starts_at).getTime()
        : Date.now() + 10000;

      if (countdownGuard.current.round === currentRound && countdownGuard.current.active) return;

      countdownGuard.current = { round: currentRound, active: true, anchorTs };

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }

      const tick = () => {
        const now = Date.now() + serverTimeOffset;
        const remaining = Math.max(0, Math.ceil((anchorTs - now) / 1000));
        setCountdown(remaining);

        if (remaining <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          countdownGuard.current.active = false;
          startAllMatches(currentRound);
        }
      };

      tick();
      countdownIntervalRef.current = setInterval(tick, 1000);
    }
  }, [matches, currentTournament, serverTimeOffset, tournamentId]);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!user || navigatedToGame) return;
    if (!currentTournament || currentTournament.status !== "in_progress") return;

    const myInProgressMatch = matches.find(
      (m) =>
        m.status === "in_progress" &&
        (m as any).countdown_started_at &&
        (m.player1_id === user.id || m.player2_id === user.id),
    );

    if (myInProgressMatch) {
      supabase
        .from("tournament_matches")
        .select("status")
        .eq("id", myInProgressMatch.id)
        .single()
        .then(({ data }) => {
          if (data?.status === "in_progress") {
            setNavigatedToGame(true);
            navigate(`/game?match=${myInProgressMatch.id}&tournament=${tournamentId}`);
          }
        });
    }
  }, [matches, user, navigatedToGame, tournamentId, navigate, countdown]);

  useEffect(() => {
    if (!showChampion) return;
    const timer = setTimeout(() => {
      navigate("/tournament");
    }, 10000);
    return () => clearTimeout(timer);
  }, [showChampion, navigate]);

  useEffect(() => {
    if (!showEliminated) return;
    const timer = setTimeout(() => {
      navigate("/tournament");
    }, 10000);
    return () => clearTimeout(timer);
  }, [showEliminated, navigate]);

  if (!currentTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 p-4 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" style={{ animation: 'spin 1s linear infinite' }}></div>
          <p>Turnuva bracket yükleniyor...</p>
        </div>
      </div>
    );
  }

  const uniqueMatches = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of matches) {
      const key = `${m.round}-${m.match_number}`;
      const ex = map.get(key);
      if (!ex) {
        map.set(key, m);
        continue;
      }
      const rank = (s: string) => (s === "in_progress" ? 2 : s === "completed" ? 1 : 0);
      if (rank(m.status) > rank(ex.status)) {
        map.set(key, m);
      } else if (rank(m.status) === rank(ex.status)) {
        const exTime = (ex.updated_at || ex.created_at || "") as string;
        const mTime = (m.updated_at || m.created_at || "") as string;
        if (mTime > exTime) map.set(key, m);
      }
    }
    return Array.from(map.values());
  }, [matches]);

  const matchesByRound = organizeMatchesByRound(uniqueMatches);
  const pendingRounds = uniqueMatches.filter((m) => m.status === "pending").map((m) => m.round);
  const nextPendingRound = pendingRounds.length ? Math.min(...pendingRounds) : null;

  // Simplified MatchCard without animations
  const MatchCard = ({ match, roundNumber }: { match: any; roundNumber: number }) => {
    const getPlayerInfo = (playerId: string, isPlayer1: boolean) => {
      if (!playerId) return { name: "TBD", isBot: false, avatar_url: undefined };

      const playerInfo = isPlayer1 ? match.player1 : match.player2;
      const isBot = Boolean(playerInfo?.is_bot) || playerId.startsWith("bot_");

      if (isBot) {
        const seed = [...playerId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const name = playerInfo?.username || generateBotName(seed);
        return { name, isBot: true, avatar_url: undefined };
      }

      return {
        name: playerInfo?.username || "Oyuncu",
        isBot: false,
        avatar_url: playerInfo?.avatar_url,
      };
    };

    const player1 = getPlayerInfo(match.player1_id, true);
    const player2 = getPlayerInfo(match.player2_id, false);
    const isCompleted = match.status === "completed";
    const winner = match.winner_id;

    const roundColors = {
      1: { bg: "bg-purple-800", border: "border-purple-500" },
      2: { bg: "bg-orange-800", border: "border-orange-500" },
      3: { bg: "bg-yellow-700", border: "border-yellow-400" },
    };

    const colors = roundColors[roundNumber as keyof typeof roundColors];

    return (
      <Card className={`${colors.bg} border ${colors.border} mb-3`}>
        <CardContent className="p-3">
          {/* Match Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-medium">Maç {match.match_number}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                match.status === "completed"
                  ? "bg-green-600 text-white"
                  : match.status === "in_progress"
                    ? "bg-yellow-600 text-white"
                    : "bg-blue-600 text-white"
              }`}
            >
              {getMatchStatus(match)}
            </span>
          </div>

          {/* Player 1 */}
          <div
            className={`rounded p-2 mb-2 ${
              isCompleted && winner === match.player1_id
                ? "bg-green-700 border border-green-400"
                : "bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {player1.isBot ? (
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-sm flex-shrink-0">
                    🤖
                  </div>
                ) : (
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    <AvatarImage src={player1.avatar_url || undefined} />
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      {player1.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="text-white text-sm truncate">{player1.name}</span>
              </div>
              {isCompleted && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {winner === match.player1_id && <Trophy className="w-4 h-4 text-yellow-400" />}
                  <span className="text-white font-bold">{match.player1_score}</span>
                </div>
              )}
            </div>
          </div>

          {/* VS */}
          <div className="text-center text-white/60 text-xs my-1">VS</div>

          {/* Player 2 */}
          <div
            className={`rounded p-2 ${
              isCompleted && winner === match.player2_id
                ? "bg-green-700 border border-green-400"
                : "bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {player2.isBot ? (
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-sm flex-shrink-0">
                    🤖
                  </div>
                ) : (
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    <AvatarImage src={player2.avatar_url || undefined} />
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      {player2.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <span className="text-white text-sm truncate">{player2.name}</span>
              </div>
              {isCompleted && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {winner === match.player2_id && <Trophy className="w-4 h-4 text-yellow-400" />}
                  <span className="text-white font-bold">{match.player2_score}</span>
                </div>
              )}
            </div>
          </div>

          {/* In Progress Indicator */}
          {match.status === "in_progress" && (
            <div className="mt-2 text-center">
              <span className="text-yellow-300 text-xs">⚡ Maç devam ediyor</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Champion Screen (simplified)
  if (showChampion) {
    const finalMatch = matches.find((m) => m.round === 3);
    const championId = finalMatch?.winner_id;
    const championName =
      championId === finalMatch?.player1_id ? finalMatch?.player1?.username : finalMatch?.player2?.username;

    return (
      <div className="min-h-screen bg-gradient-to-b from-yellow-600 to-orange-700 p-4 flex items-center justify-center">
        <div className="text-center">
          <Crown className="w-20 h-20 text-yellow-200 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-white mb-2">Şampiyon!</h1>
          <h2 className="text-2xl text-yellow-200 mb-6">{championName || "Bilinmeyen"}</h2>
          <p className="text-white mb-4">10 saniye sonra turnuva listesine döneceksiniz...</p>
          <Button
            onClick={() => navigate("/tournament")}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Turnuva Listesi
          </Button>
        </div>
      </div>
    );
  }

  // Eliminated Screen (simplified)
  if (showEliminated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-700 to-purple-800 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😢</div>
          <h1 className="text-4xl font-bold text-white mb-2">Elendiniz!</h1>
          <h2 className="text-xl text-red-200 mb-6">Final maçında elendiniz</h2>
          <p className="text-white mb-4">10 saniye sonra turnuva listesine döneceksiniz...</p>
          <Button
            onClick={() => navigate("/tournament")}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Trophy className="w-4 h-4 mr-2" />
            Turnuva Listesi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Button
            onClick={() => navigate("/tournament")}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Home className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Ana Sayfa</span>
          </Button>
          <div className="text-center flex-1 mx-2">
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">{currentTournament.name}</h1>
            <p className="text-gray-300 text-xs sm:text-sm">Turnuva Ağacı</p>
          </div>
          <div className="w-16 sm:w-24"></div>
        </div>

        {/* Countdown */}
        {nextPendingRound !== null && countdown > 0 && (
          <Card className="mb-4 bg-indigo-800 border-indigo-600">
            <CardContent className="p-3 text-center">
              <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
              <p className="text-white font-medium text-sm">
                {nextPendingRound === 1 ? "Çeyrek Final" : nextPendingRound === 2 ? "Yarı Final" : "Final"} başlıyor...
              </p>
              <p className="text-yellow-300 text-xl font-bold">{countdown} saniye</p>
            </CardContent>
          </Card>
        )}

        {/* Bracket - Mobile First Grid */}
        <div className="space-y-4 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-4">
          {[1, 2, 3].map((round) => {
            const roundTitles = {
              1: { name: "Çeyrek Final", icon: "⚔️", color: "bg-purple-700" },
              2: { name: "Yarı Final", icon: "🔥", color: "bg-orange-700" },
              3: { name: "Final", icon: "👑", color: "bg-yellow-600" },
            };
            const roundInfo = roundTitles[round as keyof typeof roundTitles];

            return (
              <div key={round}>
                {/* Round Header */}
                <div className="text-center mb-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${roundInfo.color}`}>
                    <span className="text-base">{roundInfo.icon}</span>
                    <span className="text-white font-semibold text-sm">{roundInfo.name}</span>
                  </div>
                </div>

                {/* Matches */}
                {matchesByRound[round]?.map((match) => (
                  <MatchCard key={match.id} match={match} roundNumber={round} />
                )) || (
                  <Card className="bg-white/5 border-white/10">
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

export default TournamentBracketPage;
