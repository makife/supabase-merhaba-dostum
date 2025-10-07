import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Home, Clock, Crown } from "lucide-react";
import { useTournament } from "@/hooks/useTournament";
import { organizeMatchesByRound, getRoundName, getMatchStatus } from "@/utils/tournamentHelpers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSounds } from "@/hooks/useSounds";

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { currentTournament, matches, loading, fetchTournamentDetails } = useTournament(tournamentId);
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

  // Removed client-side placeholder creation to prevent duplicate matches

  // Çeyrek finallerin kazananları oluşur oluşmaz yarı final slotlarını doldur;
  // Yarı finaller tamamlanınca final slotlarını doldur (hemen)
  useEffect(() => {
    if (!tournamentId) return;

    const populate = async () => {
      try {
        // QF -> SF
        const qf = matches.filter((m) => m.round === 1);
        if (qf.length >= 4) {
          const w1 = qf.find((m) => m.match_number === 1)?.winner_id;
          const w2 = qf.find((m) => m.match_number === 2)?.winner_id;
          const w3 = qf.find((m) => m.match_number === 3)?.winner_id;
          const w4 = qf.find((m) => m.match_number === 4)?.winner_id;

          const sf1 = matches.find((m) => m.round === 2 && m.match_number === 1);
          const sf2 = matches.find((m) => m.round === 2 && m.match_number === 2);

          if (w1 && w2 && sf1 && (sf1.player1_id !== w1 || sf1.player2_id !== w2)) {
            await supabase
              .from("tournament_matches")
              .update({
                player1_id: w1,
                player2_id: w2,
                status: sf1.status === "in_progress" || sf1.status === "completed" ? sf1.status : "pending",
                updated_at: new Date().toISOString(),
              })
              .eq("tournament_id", tournamentId)
              .eq("round", 2)
              .eq("match_number", 1);
          }
          if (w3 && w4 && sf2 && (sf2.player1_id !== w3 || sf2.player2_id !== w4)) {
            await supabase
              .from("tournament_matches")
              .update({
                player1_id: w3,
                player2_id: w4,
                status: sf2.status === "in_progress" || sf2.status === "completed" ? sf2.status : "pending",
                updated_at: new Date().toISOString(),
              })
              .eq("tournament_id", tournamentId)
              .eq("round", 2)
              .eq("match_number", 2);
          }
        }

        // SF -> Final
        const sf = matches.filter((m) => m.round === 2);
        const f = matches.find((m) => m.round === 3 && m.match_number === 1);
        if (sf.length >= 2 && f) {
          const sfw1 = sf.find((m) => m.match_number === 1)?.winner_id;
          const sfw2 = sf.find((m) => m.match_number === 2)?.winner_id;
          if (sfw1 && sfw2 && (f.player1_id !== sfw1 || f.player2_id !== sfw2)) {
            await supabase
              .from("tournament_matches")
              .update({
                player1_id: sfw1,
                player2_id: sfw2,
                status: f.status === "in_progress" || f.status === "completed" ? f.status : "pending",
                updated_at: new Date().toISOString(),
              })
              .eq("tournament_id", tournamentId)
              .eq("round", 3)
              .eq("match_number", 1);
          }
        }
      } catch (err) {
        console.error("Populate next round slots failed:", err);
      }
    };

    populate();
  }, [matches, tournamentId]);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails(tournamentId);
    }
  }, [tournamentId]);

  const startAllMatches = async (forceRound?: number) => {
    if (!tournamentId) return;

    try {
      // Start all pending matches in specified or current round
      const currentRound = forceRound ?? (currentTournament?.current_round || 1);

      // Update all pending matches to in_progress
      await supabase
        .from("tournament_matches")
        .update({ status: "in_progress", updated_at: new Date().toISOString() })
        .eq("tournament_id", tournamentId)
        .eq("round", currentRound)
        .eq("status", "pending");

      // Simulate bot matches completion
      await simulateBotMatches(currentRound);
    } catch (e) {
      console.error("Error starting matches:", e);
    }
  };

  const simulateBotMatches = async (round: number) => {
    try {
      // Önce tüm katılımcıları al ve bot durumlarını kontrol et
      const { data: participants } = await supabase
        .from("tournament_participants")
        .select("user_id, is_bot")
        .eq("tournament_id", tournamentId);

      const botMap = new Map();
      participants?.forEach((p) => {
        if (p.user_id) {
          botMap.set(p.user_id, p.is_bot);
        }
        // Bot ID'leri için de mapping ekle
        if (p.is_bot && p.user_id && p.user_id.startsWith("bot_")) {
          botMap.set(p.user_id, true);
        }
      });

      console.log("🗺️ Bot mapping:", Array.from(botMap.entries()));

      const { data: botMatches } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round", round)
        .eq("status", "in_progress");

      if (!botMatches) return;

      // Process each match
      for (const match of botMatches) {
        // Bot kontrolü: hem botMap'ten kontrol et hem de ID formatını kontrol et
        const player1IsBot = botMap.get(match.player1_id) || match.player1_id?.startsWith("bot_") || false;
        const player2IsBot = botMap.get(match.player2_id) || match.player2_id?.startsWith("bot_") || false;
        const hasNullPlayer = !match.player1_id || !match.player2_id;

        console.log("🔍 Processing match:", {
          matchId: match.id.slice(-8),
          player1: match.player1_id?.slice(-8),
          player2: match.player2_id?.slice(-8),
          player1IsBot,
          player2IsBot,
          status: match.status,
        });

        // Eğer player eksikse maçı iptal et (4. round sorunu)
        if (hasNullPlayer) {
          console.log("⚠️ Match has null player, skipping:", match.id);
          continue;
        }

        // SADECE her iki oyuncu da bot ise otomatik tamamla
        // Gerçek oyuncular varsa maçı otomatik tamamlama
        if (player1IsBot && player2IsBot) {
          console.log("🤖 Both players are bots, auto-completing match");
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
          console.log("👤 Real player detected, NOT auto-completing match - leaving as in_progress");
          // Gerçek oyuncu varsa maçı olduğu gibi bırak (in_progress)
          // Bu maç gerçek oyuncu tarafından oynanmalı
        }
      }

      // Round completion kontrolünü geciktir (gerçek oyuncu maçları bitmesini bekle)
      setTimeout(() => {
        checkAndAdvanceRound(round);
      }, 2000);
    } catch (error) {
      console.error("Error simulating bot matches:", error);
    }
  };

  const checkAndAdvanceRound = async (round: number) => {
    try {
      console.log(`🔍 Checking round ${round} completion...`);

      // Katılımcı bilgilerini al
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

      console.log(
        `📊 Round ${round}: ${roundMatches.length} total matches, ${roundMatches.filter((m) => m.status === "completed").length} completed`,
      );

      const allCompleted = roundMatches.every((m) => m.status === "completed");
      const hasRealPlayerMatches = roundMatches.some((m) => {
        const player1IsBot = botMap.get(m.player1_id) || m.player1_id?.startsWith("bot_") || false;
        const player2IsBot = botMap.get(m.player2_id) || m.player2_id?.startsWith("bot_") || false;
        return !player1IsBot || !player2IsBot; // En az bir gerçek oyuncu varsa
      });

      // Eğer gerçek oyuncu maçları varsa ve tamamlanmadıysa bekle
      if (hasRealPlayerMatches) {
        const realPlayerMatchesCompleted = roundMatches
          .filter((m) => {
            const player1IsBot = botMap.get(m.player1_id) || m.player1_id?.startsWith("bot_") || false;
            const player2IsBot = botMap.get(m.player2_id) || m.player2_id?.startsWith("bot_") || false;
            return !player1IsBot || !player2IsBot;
          })
          .every((m) => m.status === "completed");

        if (!realPlayerMatchesCompleted) {
          console.log("⏳ Waiting for real player matches to complete...");
          return;
        }
      }

      if (allCompleted && round < 3) {
        console.log(`✅ Round ${round} completed, advancing to round ${round + 1}`);

        // Tüm maçlar tamamlandıysa advance fonksiyonunu çağır
        const { data: result, error } = await supabase.rpc("advance_tournament_round", {
          p_tournament_id: tournamentId,
        });

        console.log("🔄 Advance result:", result, "Error:", error);

        if (result && typeof result === "object" && "success" in result && result.success) {
          console.log(`🎯 Successfully advanced to round ${round + 1}`);

          // Yeni tur oluşturuldu; verileri yenile (maçlar 10 sn sonra başlayacak)
          setTimeout(() => {
            fetchTournamentDetails(tournamentId!);
          }, 2000);
        } else {
          console.error("❌ Failed to advance tournament round:", result);
        }
      } else if (allCompleted && round === 3) {
        console.log("🏆 Tournament completed!");

        // Turnuvayı completed olarak işaretle
        await supabase
          .from("tournaments")
          .update({ status: "completed", finished_at: new Date().toISOString() })
          .eq("id", tournamentId);

        // Final maçının kazananını belirle
        const finalMatch = roundMatches.find((m) => m.round === 3);
        const championId = finalMatch?.winner_id;

        // Turnuva tamamlandı; kartlar final maçı bitince gösterildi
        console.log("🏆 Tournament completed!");
      }
    } catch (error) {
      console.error("Error checking round completion:", error);
    }
  };

  // Final maçı bitince hemen şampiyon/elenen kartlarını göster
  useEffect(() => {
    if (!tournamentId || !currentTournament || !user) return;

    // Final maçı tamamlandı mı kontrol et
    const finalMatch = matches.find((m) => m.round === 3 && m.status === "completed");
    if (!finalMatch || !finalMatch.winner_id) return;

    const championId = finalMatch.winner_id;

    // Sadece maç bitince bir kez göster (turnuva status'ü için beklemeyiz)
    if (championId === user.id && !showChampion) {
      setShowChampion(true);
      playSpecialSound("/sampiyon.mp3", 0.8);
    } else if (
      (finalMatch.player1_id === user.id || finalMatch.player2_id === user.id) &&
      championId !== user.id &&
      !showEliminated
    ) {
      setShowEliminated(true);
    }
  }, [matches, tournamentId, currentTournament, user, playSpecialSound, showChampion, showEliminated]);

  // Tur ilerletme mantığı (şampiyon kartlarından ayrı)
  useEffect(() => {
    if (!tournamentId || !currentTournament) return;
    const round = currentTournament.current_round || 1;

    // Bu turdaki tüm maçlar tamamlandı mı?
    const roundMatches = matches.filter((m) => m.round === round);
    if (roundMatches.length === 0) return;

    const allCompleted = roundMatches.every((m) => m.status === "completed");
    if (!allCompleted) return;

    // Final turu tamamlandıysa turnuvayı bitir
    if (round === 3) {
      supabase
        .from("tournaments")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", tournamentId);
      return;
    }

    // Çift çağrıyı önlemek için: bir sonraki tur zaten oluşturulmuş mu?
    supabase
      .from("tournament_matches")
      .select("id")
      .eq("tournament_id", tournamentId)
      .eq("round", round + 1)
      .limit(1)
      .then(async ({ data }) => {
        try {
          if (!data || data.length === 0) {
            // Sadece turu ilerlet; maçların başlamasını 10 sn sayaca bırak
            const { data: result } = await supabase.rpc("advance_tournament_round", {
              p_tournament_id: tournamentId,
            });
            if (result && (result as any).success) {
              fetchTournamentDetails(tournamentId);
            }
          }
        } catch (e) {
          console.error("Auto-advance error:", e);
        }
      });
  }, [matches, currentTournament?.current_round, tournamentId]);

  // Countdown for match start (senkronize, DB zamanına göre)
  useEffect(() => {
    if (!currentTournament || currentTournament.status !== "in_progress") return;
    if (matches.length === 0) return;

    // PENDING olan en küçük round'u hedef al
    const pendingMatches = matches.filter((m) => m.status === "pending");
    if (pendingMatches.length === 0) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      countdownGuard.current = { active: false, round: null, anchorTs: null };
      setCountdown(0);
      return;
    }

    const targetRound = Math.min(...pendingMatches.map((m) => m.round));
    const targetRoundPending = pendingMatches
      .filter((m) => m.round === targetRound)
      // Oyuncular belirlenmiş maçları baz al (boş slotlar sahte başlangıç yaratmasın)
      .filter((m) => !!m.player1_id && !!m.player2_id);

    if (targetRoundPending.length === 0) return;

    // Senkron başlangıç zamanı: o round'daki pending maçların EN SON updated_at/created_at zamanı
    const latestTs =
      targetRoundPending
        .map((m) => new Date((m.updated_at || m.created_at) as string).getTime())
        .filter((ts) => !Number.isNaN(ts))
        .reduce((max, ts) => Math.max(max, ts), 0) || Date.now();

    // Eğer anchor ileriye taşındıysa geri sayımı yeniden başlat (çift eşleşme gecikmeleri için)
    const shouldRestart =
      !countdownGuard.current.active ||
      countdownGuard.current.round !== targetRound ||
      (countdownGuard.current.anchorTs ?? 0) < latestTs - 250;

    if (shouldRestart) {
      countdownGuard.current = { active: true, round: targetRound, anchorTs: latestTs };

      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      const tick = () => {
        const anchor = countdownGuard.current.anchorTs ?? latestTs;
        const elapsed = Math.floor((Date.now() - anchor) / 1000);
        const remaining = Math.max(0, 10 - elapsed);
        setCountdown(remaining);

        if (remaining === 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          // Geri sayım tamamlandı -> hedef turdaki tüm pending maçları başlat (yalnızca bir kez)
          startAllMatches(targetRound);
          countdownGuard.current = { active: false, round: null, anchorTs: null };
        }
      };

      // Hemen bir kez çalıştır, sonra her saniye güncelle
      tick();
      countdownIntervalRef.current = setInterval(tick, 1000);
    }
  }, [matches, currentTournament?.status]);

  // Bileşen unmount olduğunda interval'ı temizle
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Otomatik oyuncu yönlendirme: Kullanıcı maçı başladıysa oyuna gir
  useEffect(() => {
    if (!user || navigatedToGame || !tournamentId) return;

    const userId = user.id;
    console.log("🔍 Checking for user match:", { userId: userId.slice(-8), matchesCount: matches.length });

    const myInProgressMatch = matches.find((m) => {
      const isPlayer1 = m.player1_id === userId;
      const isPlayer2 = m.player2_id === userId;
      const isInProgress = m.status === "in_progress";

      console.log("🔍 Match check:", {
        matchId: m.id.slice(-8),
        player1: m.player1_id?.slice(-8),
        player2: m.player2_id?.slice(-8),
        status: m.status,
        isPlayer1,
        isPlayer2,
        isInProgress,
      });

      return isInProgress && (isPlayer1 || isPlayer2);
    });

    if (myInProgressMatch) {
      console.log("✅ Found user match, navigating:", myInProgressMatch.id.slice(-8));
      setNavigatedToGame(true);
      navigate(`/game?match=${myInProgressMatch.id}&tournament=${tournamentId}`);
    }
  }, [matches, user, navigatedToGame, tournamentId, navigate]);

  // Şampiyon ekranında 10 saniye sonra otomatik listeye dön
  useEffect(() => {
    if (!showChampion) return;
    const timer = setTimeout(() => {
      navigate("/tournament");
    }, 10000);
    return () => clearTimeout(timer);
  }, [showChampion, navigate]);

  // Elenme ekranında 10 saniye sonra otomatik listeye dön
  useEffect(() => {
    if (!showEliminated) return;
    const timer = setTimeout(() => {
      navigate("/tournament");
    }, 10000);
    return () => clearTimeout(timer);
  }, [showEliminated, navigate]);

  if (!currentTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
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

  const MatchCard = ({ match, roundNumber }: { match: any; roundNumber: number }) => {
    const getPlayerInfo = (playerId: string, isPlayer1: boolean) => {
      if (!playerId) return { name: "TBD", isBot: false };

      if (playerId.startsWith("bot_")) {
        return { name: `Bot ${playerId.split("_").pop()}`, isBot: true };
      }

      // Get from match player info
      const playerInfo = isPlayer1 ? match.player1 : match.player2;
      return {
        name: playerInfo?.username || "Oyuncu",
        isBot: playerInfo?.is_bot || false,
      };
    };

    const player1 = getPlayerInfo(match.player1_id, true);
    const player2 = getPlayerInfo(match.player2_id, false);
    const isCompleted = match.status === "completed";
    const winner = match.winner_id;

    return (
      <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-3">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Maç {match.match_number}</span>
              <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">{getMatchStatus(match)}</span>
            </div>

            {/* Player 1 */}
            <div
              className={`flex items-center justify-between p-2 rounded ${
                isCompleted && winner === match.player1_id
                  ? "bg-green-500/20 border border-green-500/40"
                  : "bg-gray-500/10"
              }`}
            >
              <span className="text-white font-medium">{player1.name}</span>
              {isCompleted && <span className="text-white font-bold">{match.player1_score}</span>}
            </div>

            {/* VS */}
            <div className="text-center text-gray-400 text-sm">VS</div>

            {/* Player 2 */}
            <div
              className={`flex items-center justify-between p-2 rounded ${
                isCompleted && winner === match.player2_id
                  ? "bg-green-500/20 border border-green-500/40"
                  : "bg-gray-500/10"
              }`}
            >
              <span className="text-white font-medium">{player2.name}</span>
              {isCompleted && <span className="text-white font-bold">{match.player2_score}</span>}
            </div>

            {match.status === "in_progress" && (
              <div className="text-center text-yellow-300 text-sm">⚡ Maç devam ediyor...</div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (showChampion) {
    const finalMatch = matches.find((m) => m.round === 3);
    const championId = finalMatch?.winner_id;
    const championName =
      championId === finalMatch?.player1_id ? finalMatch?.player1?.username : finalMatch?.player2?.username;

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-600 to-orange-600 p-4 flex items-center justify-center">
        <div className="text-center">
          <Crown className="w-24 h-24 text-yellow-200 mx-auto mb-6 animate-bounce" />
          <h1 className="text-6xl font-bold text-white mb-4">Şampiyon!</h1>
          <h2 className="text-3xl text-yellow-200 mb-8">{championName || "Bilinmeyen"}</h2>
          <p className="text-white text-lg mb-6">10 saniye sonra turnuva listesine döneceksiniz...</p>

          <Button
            onClick={() => navigate("/tournament")}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-full"
          >
            <Trophy className="w-5 h-5 mr-2" />
            Turnuva Listesi
          </Button>
        </div>
      </div>
    );
  }

  if (showEliminated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 to-purple-600 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 text-red-200 mx-auto mb-6 text-6xl">😢</div>
          <h1 className="text-6xl font-bold text-white mb-4">Elendiniz!</h1>
          <h2 className="text-3xl text-red-200 mb-8">Final maçında elendiniz</h2>
          <p className="text-white text-lg mb-6">10 saniye sonra turnuva listesine döneceksiniz...</p>

          <Button
            onClick={() => navigate("/tournament")}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-3 px-6 rounded-full"
          >
            <Trophy className="w-5 h-5 mr-2" />
            Turnuva Listesi
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate("/tournament")}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            <Home className="w-4 h-4 mr-2" />
            Ana Sayfa
          </Button>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white">{currentTournament.name}</h1>
            <p className="text-gray-300">Turnuva Bracket</p>
          </div>
          <div className="w-24"></div> {/* Spacer */}
        </div>

        {/* Countdown */}
        {nextPendingRound !== null && countdown > 0 && (
          <Card className="mb-6 bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-white font-bold">Maçlar başlıyor: {countdown}s</p>
            </CardContent>
          </Card>
        )}

        {/* Bracket */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((round) => (
            <div key={round} className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                  {getRoundName(round)}
                </h2>
              </div>

              {matchesByRound[round]?.map((match) => (
                <MatchCard key={match.id} match={match} roundNumber={round} />
              )) || (
                <Card className="bg-white/5 backdrop-blur-md border-white/10">
                  <CardContent className="p-4 text-center text-gray-400">
                    {matches.length === 0 ? "Maçlar henüz oluşturulmadı" : `Round ${round} maçları mevcut değil`}
                    <div className="text-xs mt-2">
                      Toplam maç: {matches.length} | Bu round: {matchesByRound[round]?.length || 0}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TournamentBracketPage;
