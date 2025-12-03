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

  // Removed client-side placeholder creation to prevent duplicate matches

  // ✅ SERVER-SIDE WINNER PROMOTION (Removed Frontend Logic)
  // Database trigger 'auto_promote_tournament_winner' automatically handles
  // winner promotion to next round when match status becomes 'completed'.
  // No frontend intervention needed - server is authoritative source.
  // Trigger handles: QF Match 1,2 → SF Match 1; QF Match 3,4 → SF Match 2; SF Match 1,2 → Final Match 1

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails(tournamentId);
      // Yeni turnuva veya bracket sayfasına döndüğünde navigation guard'ı resetle
      setNavigatedToGame(false);
    }
  }, [tournamentId]);

  // Yeni tur başladığında navigation guard'ı resetle
  useEffect(() => {
    if (currentTournament?.current_round) {
      setNavigatedToGame(false);
    }
  }, [currentTournament?.current_round]);

  const startAllMatches = async (forceRound?: number) => {
    if (!tournamentId) return;

    try {
      // Start all pending matches in specified or current round
      const currentRound = forceRound ?? (currentTournament?.current_round || 1);

      console.log(`🎬 Starting matches for round ${currentRound}...`);

      // Update all pending matches to in_progress
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

      // Simulate bot matches completion
      await simulateBotMatches(currentRound);
    } catch (e) {
      console.error("Error starting matches:", e);
    }
  };

  const simulateBotMatches = async (round: number) => {
    try {
      console.log(`🤖 simulateBotMatches called for round ${round}`);

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

      const { data: botMatches, error: matchError } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round", round)
        .eq("status", "in_progress");

      if (matchError) {
        console.error("❌ Error fetching in_progress matches:", matchError);
        return;
      }

      if (!botMatches || botMatches.length === 0) {
        console.log("⚠️ No in_progress matches found for round", round);
        return;
      }

      console.log(`📋 Found ${botMatches.length} in_progress matches for round ${round}`);

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
        // Gerçek oyuncular varsa countdown_started_at set et (server-sync için)
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
          // Gerçek oyuncu varsa: SERVER-SIDE countdown başlat (RPC ile)
          console.log(`👤 Real player match detected, starting server-side countdown via RPC`);

          // Önce match'e room_id ataması gerekiyor, countdown RPC'si room_id bekliyor
          // Tournament maçları için room_id'yi match_id olarak kullanabiliriz
          await supabase
            .from("tournament_matches")
            .update({
              room_id: match.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", match.id);

          // Şimdi server-side countdown başlat
          const { data: countdownStart, error: rpcError } = await supabase.rpc("start_game_countdown", {
            p_room_id: match.id,
          });

          if (!rpcError && countdownStart) {
            console.log(`✅ Server-side countdown started for tournament match:`, countdownStart);

            // countdown_started_at'ı server'dan gelen değerle güncelle
            await supabase
              .from("tournament_matches")
              .update({
                countdown_started_at: countdownStart,
                updated_at: new Date().toISOString(),
              })
              .eq("id", match.id);
          } else {
            console.error("❌ RPC countdown error:", rpcError);
            // Fallback: Local timestamp kullan
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
        // Bir sonraki tur zaten oluşturulmuş mu kontrol et (çift çağrıyı önle)
        const { data: nextRoundMatches, count } = await supabase
          .from("tournament_matches")
          .select("*", { count: "exact" })
          .eq("tournament_id", tournamentId)
          .eq("round", round + 1);

        // Eğer bir sonraki round için maçlar zaten varsa, skip
        if (nextRoundMatches && nextRoundMatches.length > 0) {
          console.log(`⚠️ Round ${round + 1} already has ${nextRoundMatches.length} matches, skipping advancement`);
          return;
        }

        console.log(`✅ Round ${round} completed, advancing to round ${round + 1}`);

        // 🧹 Eski round'daki tüm countdown state'lerini temizle
        await supabase
          .from("tournament_matches")
          .update({ countdown_started_at: null })
          .eq("tournament_id", tournamentId)
          .eq("round", round);

        // Tüm maçlar tamamlandıysa advance fonksiyonunu çağır
        const { data: result, error } = await supabase.rpc("advance_tournament_round", {
          p_tournament_id: tournamentId,
        });

        console.log("🔄 Advance result:", result, "Error:", error);

        if (result && typeof result === "object" && "success" in result && result.success) {
          console.log(`🎯 Successfully advanced to round ${round + 1}`);

          // 🧹 Yeni round'un matches'lerini kontrol et ve doğrula
          const { data: newRoundMatches } = await supabase
            .from("tournament_matches")
            .select("*")
            .eq("tournament_id", tournamentId)
            .eq("round", round + 1);

          console.log(`🎯 Yeni round ${round + 1} matches:`, newRoundMatches?.length, "maç");
          newRoundMatches?.forEach((m, i) => {
            console.log(
              `  - Match ${i + 1}: ${m.player1_id?.slice(-8)} vs ${m.player2_id?.slice(-8)}, status: ${m.status}`,
            );
          });

          // Yeni tur oluşturuldu; verileri hemen yenile - countdown otomatik başlayacak
          fetchTournamentDetails(tournamentId!);
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
    const isUserInFinal = finalMatch.player1_id === user.id || finalMatch.player2_id === user.id;

    // Sadece maç bitince bir kez göster (turnuva status'ü için beklemeyiz)
    if (championId === user.id && !showChampion) {
      setShowChampion(true);
      playSpecialSound("/sampiyon.mp3", 0.8);
    } else if (isUserInFinal && championId !== user.id && !showEliminated) {
      setShowEliminated(true);
    }
  }, [matches, tournamentId, currentTournament, user, playSpecialSound, showChampion, showEliminated]);

  // Bot maçlarını otomatik tamamla (bracket page açıldığında)
  // simulateBotMatches fonksiyonu zaten doğru bot kontrolü yapıyor (tournament_participants'tan is_bot flag'ini kontrol ediyor)
  const botSimulationTriggeredRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!tournamentId || !currentTournament || currentTournament.status !== "in_progress") return;
    if (matches.length === 0) return;

    const currentRound = currentTournament.current_round;
    if (!currentRound) return;

    // Mevcut round'daki "in_progress" durumunda maçları kontrol et
    const inProgressMatches = matches.filter((m) => m.round === currentRound && m.status === "in_progress");

    if (inProgressMatches.length > 0) {
      // Bu round için zaten simülasyon tetiklendi mi kontrol et
      const roundKey = `${tournamentId}-${currentRound}`;
      if (botSimulationTriggeredRef.current === roundKey) {
        return;
      }
      
      console.log(`🤖 Bracket page - ${inProgressMatches.length} in_progress maç bulundu, bot maçları kontrol ediliyor...`);
      botSimulationTriggeredRef.current = roundKey;
      
      // simulateBotMatches fonksiyonu içinde zaten doğru bot kontrolü yapılıyor
      // (tournament_participants tablosundan is_bot flag'i kontrol ediliyor)
      simulateBotMatches(currentRound);
    }
  }, [tournamentId, currentTournament?.status, currentTournament?.current_round, matches]);

  // Matches güncellendiğinde round advancement kontrolü yap
  useEffect(() => {
    if (!tournamentId || !currentTournament || currentTournament.status !== "in_progress") return;
    if (matches.length === 0) return;

    const currentRound = currentTournament.current_round;
    if (!currentRound) return;

    // Mevcut round'daki maçları kontrol et
    const currentRoundMatches = matches.filter((m) => m.round === currentRound);
    if (currentRoundMatches.length === 0) return;

    const allCompleted = currentRoundMatches.every((m) => m.status === "completed");

    if (allCompleted && currentRound < 3) {
      console.log(`🔄 Round ${currentRound} tamamlandı, advancement kontrolü yapılıyor...`);
      console.log(
        `📊 Tamamlanan maçlar:`,
        currentRoundMatches.map((m) => ({
          match: m.match_number,
          winner: m.winner_id?.slice(-8),
          status: m.status,
          scores: `${m.player1_score}-${m.player2_score}`,
        })),
      );

      // Biraz gecikme ekle - tüm maç skorlarının DB'ye yazılmasını bekle
      setTimeout(() => {
        checkAndAdvanceRound(currentRound);
      }, 1000);
    }
  }, [matches, currentTournament, tournamentId]);

  // Yeni round oluşturulduğunda pending maçları tespit et ve countdown'u tetikle
  useEffect(() => {
    if (!currentTournament || currentTournament.status !== "in_progress") return;
    if (matches.length === 0) return;

    const currentRound = currentTournament.current_round;
    if (!currentRound) return;

    // ⚠️ KRİTİK: SADECE mevcut round'daki pending maçları al
    const pendingMatches = matches.filter(
      (m) => m.round === currentRound && m.status === "pending" && m.player1_id && m.player2_id,
    );

    if (pendingMatches.length > 0) {
      console.log(`🎯 Round ${currentRound} için ${pendingMatches.length} pending maç bulundu`);
      console.log(
        `📋 Pending maçlar:`,
        pendingMatches.map((m) => ({
          match: m.match_number,
          player1: m.player1_id?.slice(-8),
          player2: m.player2_id?.slice(-8),
        })),
      );
      console.log(`⏰ 10 saniyelik countdown başlatılacak, sonra maçlar başlayacak`);
      // Countdown effect'i otomatik tetiklenecek (lines 436-518)
    }
  }, [currentTournament?.current_round, matches]);

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
        .reduce((max, ts) => Math.max(max, ts), 0) || Date.now() + serverTimeOffset;

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
        const elapsed = Math.floor((Date.now() + serverTimeOffset - anchor) / 1000);
        const remaining = Math.max(0, 10 - elapsed);
        setCountdown(remaining);

        if (remaining === 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          console.log(`🚀 Countdown tamamlandı! Round ${targetRound} maçları başlatılıyor...`);
          // Geri sayım tamamlandı -> hedef turdaki tüm pending maçları başlat (yalnızca bir kez)
          startAllMatches(targetRound);

          // Kullanıcının bu turdaki maçını bul ve otomatik olarak oyun sayfasına yönlendir
          // ⚠️ KRİTİK: SADECE 'pending' veya 'in_progress' durumundaki maçlara yönlendir
          const userMatch = targetRoundPending.find(
            (m) =>
              (m.player1_id === user?.id || m.player2_id === user?.id) &&
              (m.status === "pending" || m.status === "in_progress"),
          );

          if (userMatch && !navigatedToGame) {
            console.log("🎮 Kullanıcının maçı başlatılıyor, oyun sayfasına yönlendiriliyor:", userMatch.id);
            console.log("📊 Match status:", userMatch.status);
            setNavigatedToGame(true);
            setTimeout(() => {
              navigate(`/game/${userMatch.id}?mode=tournament&tournamentId=${tournamentId}`);
            }, 2000); // 2 saniye gecikme ile (maçlar başlatıldıktan sonra)
          } else if (!userMatch) {
            console.log("⚠️ Kullanıcı için uygun maç bulunamadı (pending/in_progress statüsünde)");
          }
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
  // SADECE countdown 0'a ulaştıktan sonra yönlendir
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

    // SADECE countdown 0 ise oyuna yönlendir - ama önce DB'den fresh status kontrol et
    if (myInProgressMatch && countdown === 0) {
      console.log("🔍 Verifying match status before navigation:", myInProgressMatch.id.slice(-8));

      // Fresh status check to prevent redirect loop
      supabase
        .from("tournament_matches")
        .select("status")
        .eq("id", myInProgressMatch.id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error("❌ Error checking match status:", error);
            return;
          }

          if (data?.status === "in_progress") {
            console.log("✅ Match confirmed in_progress, navigating:", myInProgressMatch.id.slice(-8));
            setNavigatedToGame(true);
            navigate(`/game?match=${myInProgressMatch.id}&tournament=${tournamentId}`);
          } else {
            console.log("🚫 Match no longer in_progress, skipping navigation. Current status:", data?.status);
          }
        });
    }
  }, [matches, user, navigatedToGame, tournamentId, navigate, countdown]);

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
      if (!playerId) return { name: "TBD", isBot: false, avatar_url: undefined };

      // Önce match içindeki zenginleştirilmiş player bilgisini kullan
      const playerInfo = isPlayer1 ? match.player1 : match.player2;
      const isBot = Boolean(playerInfo?.is_bot) || playerId.startsWith("bot_");

      if (isBot) {
        // Zenginleştirilmiş isim varsa onu kullan; yoksa seed'li üret
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

    // Round'a göre gradient renkleri
    const roundGradients = {
      1: "from-purple-600/80 via-fuchsia-600/80 to-pink-600/80", // Çeyrek Final
      2: "from-amber-600/80 via-orange-600/80 to-red-600/80", // Yarı Final
      3: "from-yellow-500/80 via-amber-500/80 to-orange-500/80", // Final
    };

    const roundBorders = {
      1: "border-purple-400/30",
      2: "border-orange-400/30",
      3: "border-yellow-400/40",
    };

    return (
      <Card
        className={`bg-gradient-to-br ${roundGradients[roundNumber as keyof typeof roundGradients]} backdrop-blur-xl border-2 ${roundBorders[roundNumber as keyof typeof roundBorders]} mb-4 hover:scale-[1.02] transition-all duration-300 shadow-2xl`}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="space-y-2">
            {/* Match Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${roundGradients[roundNumber as keyof typeof roundGradients]} flex items-center justify-center border-2 border-white/30`}
                >
                  <span className="text-white font-bold text-sm">{match.match_number}</span>
                </div>
                <span className="text-xs sm:text-sm text-white/90 font-semibold">Maç {match.match_number}</span>
              </div>
              <span
                className={`text-xs px-2 sm:px-3 py-1 rounded-full font-medium ${
                  match.status === "completed"
                    ? "bg-green-500/30 text-green-100 border border-green-400/40"
                    : match.status === "in_progress"
                      ? "bg-yellow-500/30 text-yellow-100 border border-yellow-400/40"
                      : "bg-blue-500/30 text-blue-100 border border-blue-400/40"
                }`}
              >
                {getMatchStatus(match)}
              </span>
            </div>

            {/* Players Container */}
            <div className="space-y-2">
              {/* Player 1 */}
              <div
                className={`relative overflow-hidden rounded-xl p-3 sm:p-4 transition-all duration-300 ${
                  isCompleted && winner === match.player1_id
                    ? "bg-gradient-to-r from-green-500/40 via-emerald-500/40 to-green-600/40 border-2 border-green-400/60 shadow-lg shadow-green-500/30 scale-[1.02]"
                    : "bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    {/* Player Avatar/Icon */}
                    {player1.isBot ? (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg sm:text-xl flex-shrink-0 bg-gradient-to-br from-gray-600 to-gray-800">
                        🤖
                      </div>
                    ) : (
                      <Avatar className="w-8 h-8 sm:w-10 sm:h-10" showFrame={true}>
                        <AvatarImage src={player1.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm">
                          {player1.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="text-white font-bold text-sm sm:text-base truncate">{player1.name}</span>
                  </div>
                  {isCompleted && (
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      {winner === match.player1_id && <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" />}
                      <span className="text-white font-black text-lg sm:text-2xl">{match.player1_score}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* VS Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-white/20"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-gradient-to-r from-purple-500 to-pink-500 px-3 sm:px-4 py-1 rounded-full text-white font-black text-xs sm:text-sm border-2 border-white/30 shadow-lg">
                    VS
                  </span>
                </div>
              </div>

              {/* Player 2 */}
              <div
                className={`relative overflow-hidden rounded-xl p-3 sm:p-4 transition-all duration-300 ${
                  isCompleted && winner === match.player2_id
                    ? "bg-gradient-to-r from-green-500/40 via-emerald-500/40 to-green-600/40 border-2 border-green-400/60 shadow-lg shadow-green-500/30 scale-[1.02]"
                    : "bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/15"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    {/* Player Avatar/Icon */}
                    {player2.isBot ? (
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg sm:text-xl flex-shrink-0 bg-gradient-to-br from-gray-600 to-gray-800">
                        🤖
                      </div>
                    ) : (
                      <Avatar className="w-8 h-8 sm:w-10 sm:h-10" showFrame={true}>
                        <AvatarImage src={player2.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-sm">
                          {player2.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="text-white font-bold text-sm sm:text-base truncate">{player2.name}</span>
                  </div>
                  {isCompleted && (
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      {winner === match.player2_id && <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" />}
                      <span className="text-white font-black text-lg sm:text-2xl">{match.player2_score}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Match Status Message */}
            {match.status === "in_progress" && (
              <div className="mt-3 text-center">
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-yellow-500/20 border border-yellow-400/40 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></div>
                  <span className="text-yellow-100 font-semibold text-xs sm:text-sm">Maç devam ediyor</span>
                </div>
              </div>
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
            <p className="text-gray-300">Turnuva Ağacı</p>
          </div>
          <div className="w-24"></div> {/* Spacer */}
        </div>

        {/* Countdown */}
        {nextPendingRound !== null && countdown > 0 && (
          <Card className="mb-6 bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-white font-bold text-lg">
                {nextPendingRound === 1 ? "Çeyrek Final" : nextPendingRound === 2 ? "Yarı Final" : "Final"} başlıyor...
              </p>
              <p className="text-white/90 text-xl font-black mt-1">{countdown} saniye</p>
            </CardContent>
          </Card>
        )}

        {/* Bracket */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {[1, 2, 3].map((round) => {
            const roundTitles = {
              1: { name: "Çeyrek Final", icon: "⚔️", gradient: "from-purple-500 to-fuchsia-500" },
              2: { name: "Yarı Final", icon: "🔥", gradient: "from-orange-500 to-red-500" },
              3: { name: "Final", icon: "👑", gradient: "from-yellow-400 to-amber-500" },
            };
            const roundInfo = roundTitles[round as keyof typeof roundTitles];

            return (
              <div key={round} className="space-y-3 sm:space-y-4">
                {/* Round Header */}
                <div className="text-center">
                  <div
                    className={`inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl bg-gradient-to-r ${roundInfo.gradient} shadow-2xl border-2 border-white/30 backdrop-blur-sm`}
                  >
                    <span className="text-xl sm:text-2xl">{roundInfo.icon}</span>
                    <h2 className="text-base sm:text-xl font-black text-white tracking-wide">{roundInfo.name}</h2>
                    <Trophy className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-100" />
                  </div>
                </div>

                {/* Matches */}
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
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TournamentBracketPage;
