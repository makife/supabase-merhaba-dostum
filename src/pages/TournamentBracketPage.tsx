import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, LogOut, Clock, Crown } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { profile, refreshProfile, isSystemConnected } = useUser();
  const { playSpecialSound } = useSounds();
  const { serverNow, offset } = useServerTimeContext();

  const {
    currentTournament,
    matches,
    participants,
    loading,
    fetchTournamentDetails,
    advanceToNextRound,
    leaveTournament,
  } = useTournament(tournamentId);

  const [isLeaving, setIsLeaving] = useState(false);

  const REWARD_IMAGES = {
    ink: "/murekkepOdul.png",
    degistir: "/degistirOdul.png",
    senyaz: "/senyazOdul.png",
    fisilda: "/fisildaOdul.png",
    credits: "/ucsayfaOdul.png",
    extra_spin: "/carkOdul.png",
  };

  const [wonReward, setWonReward] = useState<any>(null);

  // Bracket'ten ayrılma fonksiyonu
  const handleLeaveBracket = async () => {
    if (!user || !tournamentId) return;

    setIsLeaving(true);
    try {
      const currentRound = currentTournament?.current_round || 1;

      const myActiveMatch = matches.find(
        (m) =>
          m.round === currentRound &&
          (m.player1_id === user.id || m.player2_id === user.id) &&
          (m.status === "pending" || m.status === "in_progress"),
      );

      if (myActiveMatch) {
        const winnerId = myActiveMatch.player1_id === user.id ? myActiveMatch.player2_id : myActiveMatch.player1_id;

        console.log(`🚪 Bracket'ten ayrılıyor, maç ${myActiveMatch.id} - Kazanan: ${winnerId}`);

        await supabase
          .from("tournament_matches")
          .update({
            status: "completed",
            winner_id: winnerId,
          })
          .eq("id", myActiveMatch.id);

        toast.info("Maçı bıraktınız, rakibiniz kazandı");
      }

      await leaveTournament();
      navigate("/tournament");
    } catch (error) {
      console.error("❌ Bracket ayrılma hatası:", error);
      toast.error("Ayrılırken bir hata oluştu");
    } finally {
      setIsLeaving(false);
    }
  };

  const [countdown, setCountdown] = useState(10);
  const [showChampion, setShowChampion] = useState(false);
  const [showEliminated, setShowEliminated] = useState(false);
  const [navigatedToGame, setNavigatedToGame] = useState(false);
  const navigatedMatchIdRef = useRef<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const fromCompletedMatchRef = useRef<string | null>(null);
  useEffect(() => {
    const state = location.state as { fromCompletedMatch?: string } | null;
    if (state?.fromCompletedMatch) {
      console.log(`🔒 Came from completed match: ${state.fromCompletedMatch}, blocking re-navigation`);
      fromCompletedMatchRef.current = state.fromCompletedMatch;
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const matchesStartedRef = useRef<string | null>(null);
  const advancingRef = useRef(false);

  // 🔄 Global Resync Hook - bağlantı kopup geldiğinde otomatik tazele
  const handleBracketResync = useCallback(async () => {
    if (tournamentId) {
      await fetchTournamentDetails(tournamentId);
    }
  }, [tournamentId, fetchTournamentDetails]);

  usePageResync(handleBracketResync, "TournamentBracketPage", true);

  useEffect(() => {
    if (tournamentId) {
      setInitialLoading(true);
      fetchTournamentDetails(tournamentId).finally(() => {
        setTimeout(() => setInitialLoading(false), 300);
      });
      setNavigatedToGame(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    if (currentTournament?.current_round) {
      console.log(`🔄 Round changed to ${currentTournament.current_round}, resetting navigation flags`);
      setNavigatedToGame(false);
      matchesStartedRef.current = null;
      navigatedMatchIdRef.current = null;
    }
  }, [currentTournament?.current_round]);

  // Start matches logic
  const startAllMatches = useCallback(async () => {
    if (!tournamentId || !user || !currentTournament) return;
    if (currentTournament.creator_id !== user.id) return;

    const currentRound = currentTournament.current_round || 1;
    const roundKey = `${tournamentId}-${currentRound}`;

    if (matchesStartedRef.current === roundKey) return;
    matchesStartedRef.current = roundKey;

    console.log(`🎮 Round ${currentRound} maçları başlatılıyor...`);

    try {
      const { data: pendingMatches } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round", currentRound)
        .eq("status", "pending");

      if (!pendingMatches || pendingMatches.length === 0) return;

      const botIds = new Set<string>();
      participants.forEach((p) => {
        if (p.is_bot && p.user_id) botIds.add(p.user_id);
      });

      for (const match of pendingMatches) {
        const player1IsBot = botIds.has(match.player1_id || "") || match.player1_id?.startsWith("bot_");
        const player2IsBot = botIds.has(match.player2_id || "") || match.player2_id?.startsWith("bot_");

        if (player1IsBot && player2IsBot) {
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
          const now = new Date();
          const countdownStartedAt = now.toISOString();
          // 5s countdown + 5s animasyon + 120s oyun = 132s
          // GamePage TOURNAMENT_START_OFFSET_MS (12000ms) ile tutarlı olmalı
          const endsAt = new Date(now.getTime() + 132 * 1000).toISOString();

          await supabase
            .from("tournament_matches")
            .update({
              status: "in_progress",
              countdown_started_at: countdownStartedAt,
              ends_at: endsAt,
            })
            .eq("id", match.id);

          console.log(`⚔️ Maç başladı: ${match.id}`);
        }
      }

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

    // TÜM alanları çekiyoruz (*) ki winner_id'ye erişelim
    const { data: roundMatches } = await supabase
      .from("tournament_matches")
      .select("*")
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
      // FİNAL BİTTİ - KAZANANI BUL VE BİLDİRİM GÖNDER

      await supabase
        .from("tournaments")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", tournamentId);

      const finalMatch = roundMatches[0];
      if (finalMatch && finalMatch.winner_id) {
        const winnerProfile = participants.find((p) => p.user_id === finalMatch.winner_id);
        const winnerName = winnerProfile?.profiles?.username || "Bir Oyuncu";

        // Bildirim RPC çağrısı - HATA DÜZELTİLDİ: (supabase.rpc as any)
        await (supabase.rpc as any)("notify_tournament_end", {
          p_tournament_id: tournamentId,
          p_winner_id: finalMatch.winner_id,
          p_winner_name: winnerName,
        });

        console.log("📢 Turnuva sonuç bildirimi gönderildi");
      }
    }
  }, [tournamentId, user, currentTournament, advanceToNextRound, participants]);

  // Süresi dolan maç kontrolü
  const expiredMatchCheckRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!tournamentId || !user || !currentTournament) return;
    if (currentTournament.status !== "in_progress") return;
    if (currentTournament.creator_id !== user.id) return;

    const checkExpiredMatches = async () => {
      try {
        const { data: expiredMatches } = await supabase
          .from("tournament_matches")
          .select("*")
          .eq("tournament_id", tournamentId)
          .eq("status", "in_progress")
          .lt("ends_at", new Date().toISOString());

        if (!expiredMatches || expiredMatches.length === 0) return;

        for (const match of expiredMatches) {
          const p1Score = match.player1_score || 0;
          const p2Score = match.player2_score || 0;
          let winnerId: string;
          if (p1Score >= p2Score) winnerId = match.player1_id;
          else winnerId = match.player2_id;

          await supabase
            .from("tournament_matches")
            .update({
              status: "completed",
              winner_id: winnerId,
            })
            .eq("id", match.id)
            .eq("status", "in_progress");
        }

        if (expiredMatches.length > 0) {
          fetchTournamentDetails(tournamentId);
          setTimeout(() => checkAndAdvance(), 1000);
        }
      } catch (err) {
        console.error("⏰ Süresi dolan maç kontrolü hatası:", err);
      }
    };

    checkExpiredMatches();
    expiredMatchCheckRef.current = setInterval(checkExpiredMatches, 5000);

    return () => {
      if (expiredMatchCheckRef.current) {
        clearInterval(expiredMatchCheckRef.current);
        expiredMatchCheckRef.current = null;
      }
    };
  }, [tournamentId, user?.id, currentTournament?.status, currentTournament?.creator_id, checkAndAdvance]);

  useEffect(() => {
    if (!currentTournament || currentTournament.status !== "in_progress") return;
    if (!currentTournament.next_round_starts_at) return;

    const targetTime = new Date(currentTournament.next_round_starts_at).getTime();

    const tick = () => {
      // Server time kullanarak doğru kalan süreyi hesapla
      const now = serverNow();
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
  }, [currentTournament?.next_round_starts_at, currentTournament?.status, startAllMatches, serverNow, offset]);

  // 🔒 Tamamlanmış maçları takip et - tekrar navigation'ı önle
  const completedMatchIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !tournamentId) return;
    if (!currentTournament || currentTournament.status !== "in_progress") return;

    const navigateToMatch = async (match: any, source: string) => {
      // 🔒 GUARD 1: fromCompletedMatch kontrolü - ayrıldığımız maça geri dönmeyi önle
      if (fromCompletedMatchRef.current === match.id) {
        console.log(`🚫 [${source}] Blocking navigation - came from this completed match:`, match.id);
        return false;
      }

      // 🔒 GUARD 2: Daha önce tamamlandığını bildiğimiz maçları atla
      if (completedMatchIdsRef.current.has(match.id)) {
        console.log(`🚫 [${source}] Blocking navigation - match already completed in this session:`, match.id);
        return false;
      }

      const completedKey = `${STORAGE_KEYS.TOURNAMENT_MATCH_COMPLETED_PREFIX}${match.id}`;
      const isLocallyCompleted = await nativeStorage.getItem(completedKey);

      if (isLocallyCompleted) {
        completedMatchIdsRef.current.add(match.id);
        console.log(`🚫 [${source}] Blocking navigation - locally marked as completed:`, match.id);
        return false;
      }

      if (match.status === "completed") {
        completedMatchIdsRef.current.add(match.id);
        console.log(`🚫 [${source}] Blocking navigation - status is completed:`, match.id);
        return false;
      }

      if (navigatedMatchIdRef.current === match.id) {
        console.log(`🚫 [${source}] Blocking navigation - already navigating to this match:`, match.id);
        return false;
      }

      if (match.winner_id) {
        completedMatchIdsRef.current.add(match.id);
        console.log(`🚫 [${source}] Blocking navigation - winner already set:`, match.id);
        return false;
      }

      console.log(`🎮 [${source}] My match started, navigating:`, match.id);
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

      if (myMatch && navigatedMatchIdRef.current !== myMatch.id) {
        return navigateToMatch(myMatch, "Initial");
      }
      return false;
    };

    if (!navigatedToGame) {
      if (checkMyMatch()) return;
    }

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
          const newMatch = payload.new as any;

          // 🔒 Tamamlanan maçları takip listesine ekle
          if (newMatch.status === "completed" || newMatch.winner_id) {
            completedMatchIdsRef.current.add(newMatch.id);
            console.log(`📝 Match marked as completed:`, newMatch.id);
            return;
          }

          if (
            newMatch.status === "in_progress" &&
            newMatch.countdown_started_at &&
            (newMatch.player1_id === user.id || newMatch.player2_id === user.id)
          ) {
            navigateToMatch(newMatch, "Realtime");
          }
        },
      )
      .subscribe();

    // ⚠️ CLEANUP DEVRE DIŞI - Bağlantı koruması
    return () => {
      console.log("⚠️ [TournamentBracketPage] Cleanup ATLANYOR (bağlantı koruması)");
      // ❌ DEVRE DIŞI: supabase.removeChannel(channel);
    };
  }, [matches, user, navigatedToGame, tournamentId, navigate, currentTournament]);

  useEffect(() => {
    if (!user || !matches.length) return;

    const finalMatch = matches.find((m) => m.round === 3 && m.status === "completed");
    if (!finalMatch?.winner_id) return;

    const isInFinal = finalMatch.player1_id === user.id || finalMatch.player2_id === user.id;

    if (finalMatch.winner_id === user.id && !showChampion) {
      setShowChampion(true);
      playSpecialSound("/sampiyon.mp3", 0.8);
      giveChampionReward();
    } else if (isInFinal && finalMatch.winner_id !== user.id && !showEliminated) {
      setShowEliminated(true);
    }
  }, [matches, user, showChampion, showEliminated, playSpecialSound]);

  const giveChampionReward = async () => {
    if (!user || !profile) return;

    const rewardPool = [
      { type: "ink", value: 5, key: "ink", label: "+5 Mürekkep" },
      { type: "joker", item: "degistir", value: 2, key: "degistir", label: "+2 Değiştir Jokeri" },
      { type: "joker", item: "senyaz", value: 2, key: "senyaz", label: "+2 Sen Yaz Jokeri" },
      { type: "joker", item: "fisilda", value: 2, key: "fisilda", label: "+2 Fısılda Jokeri" },
      { type: "credits", value: 3, key: "credits", label: "+3 Oyun Hakkı" },
      { type: "extra_spin", value: 1, key: "extra_spin", label: "+1 Çark Hakkı" },
    ];

    const selected = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    setWonReward(selected); // State'e kaydet ki ekranda resmi çıksın

    try {
      let updateData: any = {};

      if (selected.type === "ink") {
        updateData.ink_count = (profile.ink_count || 0) + selected.value;
      } else if (selected.type === "credits") {
        // 🔥 FIX: game_credits max 5, fazlası bonus_credits'e
        const currentGame = profile.game_credits || 0;
        const currentBonus = profile.bonus_credits || 0;
        const creditsToAdd = selected.value;
        const spaceInGame = Math.max(0, 5 - currentGame);
        const addToGame = Math.min(creditsToAdd, spaceInGame);
        const addToBonus = creditsToAdd - addToGame;
        updateData.game_credits = currentGame + addToGame;
        updateData.bonus_credits = currentBonus + addToBonus;
      } else if (selected.type === "joker" && selected.item) {
        // user_inventory tablosuna upsert yap
        const { data: existingItem } = await supabase
          .from("user_inventory")
          .select("quantity")
          .eq("user_id", user.id)
          .eq("item_type", selected.item)
          .single();

        if (existingItem) {
          await supabase
            .from("user_inventory")
            .update({ quantity: existingItem.quantity + selected.value })
            .eq("user_id", user.id)
            .eq("item_type", selected.item);
        } else {
          await supabase.from("user_inventory").insert({
            user_id: user.id,
            item_type: selected.item,
            quantity: selected.value,
          });
        }
      } else if (selected.type === "extra_spin") {
        // Bonus çark hakkını profiles tablosuna ekle
        const currentBonusSpins = profile?.bonus_spins || 0;
        await supabase
          .from("profiles")
          .update({ bonus_spins: currentBonusSpins + selected.value })
          .eq("id", user.id);

        console.log(`Bonus çark hakkı verildi. Yeni toplam: ${currentBonusSpins + selected.value}`);
      }

      // Sadece profil verisi değiştiyse (mürekkep/kredi) profili güncelle
      // Jokerler ve Çark için burası çalışmaz (onlar kendi tablolarına gitti)
      if (selected.type === "ink" || selected.type === "credits") {
        await supabase.from("profiles").update(updateData).eq("id", user.id);
      }

      refreshProfile?.();
    } catch (error) {
      console.error("Ödül hatası:", error);
    }
  };

  useEffect(() => {
    if (!showChampion && !showEliminated) return;
    const timer = setTimeout(() => navigate("/tournament"), 10000);
    return () => clearTimeout(timer);
  }, [showChampion, showEliminated, navigate]);

  useEffect(() => {
    if (!tournamentId || !currentTournament || currentTournament.status !== "in_progress") return;
    const interval = setInterval(() => {
      checkAndAdvance();
    }, 5000);
    return () => clearInterval(interval);
  }, [tournamentId, currentTournament, checkAndAdvance]);

  const matchesByRound = useMemo(() => {
    const rounds: { [key: number]: typeof matches } = {};
    matches.forEach((m) => {
      if (!rounds[m.round]) rounds[m.round] = [];
      rounds[m.round].push(m);
    });
    Object.values(rounds).forEach((arr) => arr.sort((a, b) => a.match_number - b.match_number));
    return rounds;
  }, [matches]);

  if (!currentTournament || initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 p-4 flex flex-col items-center justify-center">
        <Card className="w-full max-w-md bg-indigo-800 border-indigo-600">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-bold text-white mb-2">Turnuva Durumu Güncelleniyor</h2>
            <p className="text-yellow-200 animate-pulse">Sonuçlar işleniyor ve sonraki eşleşmeler hazırlanıyor...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showChampion) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
        {/* Arka Plan Görseli (Sabit) */}
        <img src="/Sampiyon.png" className="absolute inset-0 w-full h-full object-cover" alt="Şampiyon Arka Plan" />

        {/* İçerik Katmanı */}
        <div className="relative z-10 flex flex-col items-center justify-end w-full h-full pb-8">
          {wonReward && (
            <div className="text-center">
              {/* Ödülünüz Başlığı - 4 satır aşağı */}
              <h2 className="text-white text-2xl font-bold mb-4">Ödülünüz</h2>

              {/* Ödül Kartı Görseli - 2 satır aşağı */}
              <img
                src={REWARD_IMAGES[wonReward.key as keyof typeof REWARD_IMAGES]}
                className="w-48 h-auto mx-auto drop-shadow-2xl mt-8"
                alt="Kazanılan Ödül"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

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

  const currentRound = currentTournament.current_round || 1;
  const hasPendingMatches = matches.some((m) => m.round === currentRound && m.status === "pending");
  const currentRoundMatches = matches.filter((m) => m.round === currentRound);
  const hasActiveCountdown = hasPendingMatches && countdown > 0;
  const isWaitingForRoundCreation =
    currentTournament.status === "in_progress" &&
    !hasActiveCountdown &&
    (initialLoading || loading || currentRoundMatches.length === 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900 p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" disabled={isLeaving}>
                <LogOut className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">{isLeaving ? "Ayrılıyor..." : "Ayrıl"}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-gray-900 border-gray-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Turnuvadan Ayrıl</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-300">
                  Turnuvadan ayrılırsanız aktif maçınızı kaybetmiş sayılırsınız ve rakibiniz bir sonraki tura geçer. Bu
                  işlem geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600">
                  Vazgeç
                </AlertDialogCancel>
                <AlertDialogAction onClick={handleLeaveBracket} className="bg-red-600 hover:bg-red-700">
                  Ayrıl
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="text-center flex-1 mx-2">
            <h1 className="text-lg sm:text-xl font-bold text-white truncate">{currentTournament.name}</h1>
            <p className="text-gray-300 text-xs sm:text-sm">Turnuva Ağacı</p>
          </div>
          <div className="w-16 sm:w-24" />
        </div>

        {(isWaitingForRoundCreation || hasActiveCountdown) && (
          <div className="sticky top-0 z-50 -mx-3 sm:-mx-4 px-3 sm:px-4 py-2 bg-gradient-to-b from-purple-900 via-purple-900/95 to-transparent">
            {isWaitingForRoundCreation && (
              <Card className="bg-indigo-800 border-indigo-600 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full mx-auto mb-2 animate-spin" />
                  <p className="text-yellow-200 text-sm font-medium">
                    🔄 {currentRound === 2 ? "Yarı Final" : currentRound === 3 ? "Final" : "Round"} oluşturuluyor,
                    lütfen bekleyin...
                  </p>
                </CardContent>
              </Card>
            )}

            {hasActiveCountdown && (
              <Card className="bg-indigo-800 border-indigo-600 shadow-lg">
                <CardContent className="p-3 text-center">
                  <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                  <p className="text-white font-medium text-sm">
                    {currentRound === 1 ? "Çeyrek Final" : currentRound === 2 ? "Yarı Final" : "Final"} başlıyor...
                  </p>
                  <p className="text-yellow-300 text-xl font-bold">{countdown} saniye</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

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
        avatar_url: generateBotAvatar(seed, botName),
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
        <div className="flex items-center justify-between mb-2">
          <span className="text-white text-sm font-medium">Maç {match.match_number}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColor} text-white`}>{statusText}</span>
        </div>

        <PlayerRow
          player={player1}
          score={match.player1_score || 0}
          isWinner={isCompleted && winner === match.player1_id}
          isCompleted={isCompleted}
          isInProgress={match.status === "in_progress"}
        />

        <div className="text-center text-white/60 text-xs my-1">VS</div>

        <PlayerRow
          player={player2}
          score={match.player2_score || 0}
          isWinner={isCompleted && winner === match.player2_id}
          isCompleted={isCompleted}
          isInProgress={match.status === "in_progress"}
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
  isInProgress,
}: {
  player: any;
  score: number;
  isWinner: boolean;
  isCompleted: boolean;
  isInProgress: boolean;
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
      {(isCompleted || isInProgress) && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {isWinner && <Trophy className="w-4 h-4 text-yellow-400" />}
          <span className={`font-bold ${isInProgress ? "text-yellow-300" : "text-white"}`}>{score}</span>
        </div>
      )}
    </div>
  </div>
);

export default TournamentBracketPage;
