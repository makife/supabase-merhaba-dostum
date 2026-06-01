import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTournamentContext } from "@/contexts/TournamentContext";
import { useAuth } from "@/contexts/AuthContext";
import { useServerTimeContext } from "@/contexts/ServerTimeContext";

export const useTournament = (tournamentId?: string) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const context = useTournamentContext();
  const { serverNow, offset } = useServerTimeContext();

  const [timeLeft, setTimeLeft] = useState(0);
  const [isCreator, setIsCreator] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [realPlayerCount, setRealPlayerCount] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startingRef = useRef(false);
  const lastCreatorIdRef = useRef<string | null>(null);

  // Reset startingRef when creator changes (e.g., after creator leaves)
  useEffect(() => {
    const currentCreatorId = context.currentTournament?.creator_id || null;

    if (lastCreatorIdRef.current !== null && lastCreatorIdRef.current !== currentCreatorId) {
      // Creator changed - reset startingRef so new creator can trigger countdown end
      console.log("🔄 Kurucu değişti, startingRef sıfırlanıyor");
      startingRef.current = false;
    }

    lastCreatorIdRef.current = currentCreatorId;
  }, [context.currentTournament?.creator_id]);

  // Countdown timer - Server time kullanarak
  useEffect(() => {
    if (!context.currentTournament?.expires_at || context.currentTournament?.status !== "waiting") {
      setTimeLeft(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const expiresAt = new Date(context.currentTournament.expires_at).getTime();
    const creatorId = context.currentTournament.creator_id;

    const tick = () => {
      // Server time kullanarak doğru kalan süreyi hesapla
      const now = serverNow();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(remaining);

      // Auto-start when countdown ends - only if current user is creator
      if (remaining === 0 && !startingRef.current && user?.id === creatorId) {
        startingRef.current = true;
        handleCountdownEnd();
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    context.currentTournament?.expires_at,
    context.currentTournament?.status,
    context.currentTournament?.creator_id,
    user?.id,
    serverNow,
    offset,
  ]);

  // Handle countdown end
  const handleCountdownEnd = useCallback(async () => {
    if (!tournamentId || !user || !context.currentTournament) return;

    // Only creator starts the tournament
    if (context.currentTournament.creator_id !== user.id) {
      console.log("⏳ Bekliyor - kurucu başlatacak");
      return;
    }

    // 🔒 Güncel katılımcı sayısını VERITABANINDAN al (stale state önleme)
    const { data: freshParticipants } = await supabase
      .from("tournament_participants")
      .select("id, user_id, is_bot")
      .eq("tournament_id", tournamentId);

    const currentRealPlayers = freshParticipants?.filter((p) => !p.is_bot).length || 0;
    console.log("🎮 Gerçek oyuncu sayısı (DB'den):", currentRealPlayers);

    // Bot turnuvasında min oyuncu şartı yok, özel turnuvada 1 yeterli, normal turnuvada min 2
    const isBotTournament = (context.currentTournament as any)?.is_bot_tournament === true;
    const isPrivateTournament = (context.currentTournament as any)?.is_private === true;
    const minRealPlayers = isBotTournament ? 0 : isPrivateTournament ? 1 : 2;
    if (currentRealPlayers < minRealPlayers) {
      console.log(`❌ Yeterli oyuncu yok (min ${minRealPlayers} gerekli), iptal ediliyor`);
      await supabase.from("tournaments").update({ status: "cancelled" }).eq("id", tournamentId);
      return;
    }

    console.log("🏆 Kurucu turnuvayı başlatıyor...");
    const success = await context.startTournament(tournamentId);

    if (success) {
      // Hemen next_round_starts_at set et - yarı final ile aynı davranış
      const nextRoundStartsAt = new Date();
      nextRoundStartsAt.setSeconds(nextRoundStartsAt.getSeconds() + 10);

      await supabase
        .from("tournaments")
        .update({ next_round_starts_at: nextRoundStartsAt.toISOString() })
        .eq("id", tournamentId);

      navigate(`/tournament/bracket/${tournamentId}`);
    }
  }, [tournamentId, user, context.currentTournament, context.participants, navigate]);

  // Update derived state
  useEffect(() => {
    if (!context.currentTournament || !user) return;

    setIsCreator(context.currentTournament.creator_id === user.id);
    setHasJoined(context.participants.some((p) => p.user_id === user.id && !p.is_bot));
    setRealPlayerCount(context.participants.filter((p) => !p.is_bot).length);
  }, [context.currentTournament, context.participants, user]);

  // Reset starting ref when tournament changes
  useEffect(() => {
    startingRef.current = false;
  }, [tournamentId]);

  const joinTournament = async () => {
    if (!tournamentId) return false;
    const success = await context.joinTournament(tournamentId);
    if (success) {
      navigate(`/tournament-waiting/${tournamentId}`);
    }
    return success;
  };

  const leaveTournament = async () => {
    if (!tournamentId) return false;
    const success = await context.leaveTournament(tournamentId);
    if (success) {
      navigate("/tournament");
    }
    return success;
  };

  return {
    ...context,
    timeLeft,
    isCreator,
    hasJoined,
    realPlayerCount,
    joinTournament,
    leaveTournament,
  };
};
