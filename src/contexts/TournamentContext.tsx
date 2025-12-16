import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tournament, TournamentParticipant, TournamentMatch } from "@/types/tournament";
import { toast } from "@/components/ui/use-toast";
import { generateBotName, generateBotAvatar } from "@/utils/tournamentHelpers";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";

interface TournamentContextType {
  tournaments: Tournament[];
  currentTournament: Tournament | null;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  loading: boolean;

  createTournament: () => Promise<string | null>;
  joinTournament: (tournamentId: string) => Promise<boolean>;
  leaveTournament: (tournamentId: string) => Promise<boolean>;
  startTournament: (tournamentId: string) => Promise<boolean>;
  fetchTournaments: () => Promise<void>;
  fetchTournamentDetails: (tournamentId: string) => Promise<void>;
  advanceToNextRound: (tournamentId: string) => Promise<boolean>;
  resetContext: () => void;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const useTournamentContext = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error("useTournamentContext must be used within TournamentProvider");
  }
  return context;
};

export const TournamentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(false);
  
  const fetchingRef = useRef(false);

  const resetContext = () => {
    setTournaments([]);
    setCurrentTournament(null);
    setParticipants([]);
    setMatches([]);
    setLoading(false);
  };

  // Fetch active tournaments
  const fetchTournaments = async () => {
    if (!user || fetchingRef.current) return;
    
    try {
      fetchingRef.current = true;
      setLoading(true);

      // Cleanup expired tournaments first
      await supabase.rpc("cleanup_expired_tournaments");

      // Sadece beklemedeki turnuvaları getir (in_progress olan turnuvalar bracket'ta gösterilmeli)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("status", "waiting")
        .gt("created_at", oneHourAgo)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTournaments((data || []) as Tournament[]);
    } catch (error) {
      console.error("❌ Turnuva listesi hatası:", error);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  };

  // Create tournament
  const createTournament = async (): Promise<string | null> => {
    if (!user) return null;

    try {
      setLoading(true);

      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + 30);

      const tournamentName = `Turnuva ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;

      const { data: tournament, error } = await supabase
        .from("tournaments")
        .insert({
          name: tournamentName,
          creator_id: user.id,
          status: "waiting",
          game_type: "timed",
          max_participants: 8,
          current_round: 1,
          timeout_duration: 120,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Add creator as participant
      const { error: participantError } = await supabase
        .from("tournament_participants")
        .insert({
          tournament_id: tournament.id,
          user_id: user.id,
          is_bot: false,
        });

      if (participantError) throw participantError;

      console.log("✅ Turnuva oluşturuldu:", tournament.id);
      await fetchTournaments();
      return tournament.id;
    } catch (error: any) {
      console.error("❌ Turnuva oluşturma hatası:", error);
      toast({ title: "Hata", description: "Turnuva oluşturulamadı", variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Join tournament
  const joinTournament = async (tournamentId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("tournament_participants")
        .insert({
          tournament_id: tournamentId,
          user_id: user.id,
          is_bot: false,
        });

      // Duplicate key = already joined
      if (error && error.code === "23505") {
        console.log("✅ Zaten katılmış");
        return true;
      }

      if (error) throw error;

      console.log("✅ Turnuvaya katıldı");
      await fetchTournamentDetails(tournamentId);
      return true;
    } catch (error) {
      console.error("❌ Katılma hatası:", error);
      toast({ title: "Hata", description: "Turnuvaya katılınamadı", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Leave tournament
  const leaveTournament = async (tournamentId: string): Promise<boolean> => {
    if (!user) {
      console.error("❌ Ayrılma: Kullanıcı yok");
      return false;
    }

    try {
      setLoading(true);
      console.log("🚪 Turnuvadan ayrılıyor:", { tournamentId, userId: user.id });

      // 1. Önce turnuva bilgisini al
      const { data: tournament } = await supabase
        .from("tournaments")
        .select("creator_id, status")
        .eq("id", tournamentId)
        .maybeSingle();

      if (!tournament) {
        console.error("❌ Turnuva bulunamadı");
        toast({ title: "Hata", description: "Turnuva bulunamadı", variant: "destructive" });
        return false;
      }

      const isCreator = tournament.creator_id === user.id;

      // 2. Katılımcıları al
      const { data: allParticipants } = await supabase
        .from("tournament_participants")
        .select("id, user_id, is_bot")
        .eq("tournament_id", tournamentId);

      // 3. Doğrudan tablo silme (RPC geçici olarak çalışmıyor)
      const { error: deleteError } = await supabase
        .from("tournament_participants")
        .delete()
        .eq("tournament_id", tournamentId)
        .eq("user_id", user.id)
        .eq("is_bot", false);

      if (deleteError) {
        console.error("❌ Silme hatası:", deleteError);
        throw deleteError;
      }
      console.log("✅ Katılımcı kaydı silindi");

      // 3. Eğer kurucu ayrılıyorsa, başka bir oyuncuya kuruculuk devret
      if (isCreator && tournament.status === 'waiting') {
        const otherPlayers = allParticipants?.filter(p => p.user_id !== user.id && !p.is_bot);

        if (otherPlayers && otherPlayers.length > 0) {
          const newCreatorId = otherPlayers[0].user_id;
          await supabase
            .from("tournaments")
            .update({ creator_id: newCreatorId })
            .eq("id", tournamentId);
          console.log("✅ Kuruculuk devredildi:", newCreatorId);
        } else {
          await supabase
            .from("tournaments")
            .update({ status: "cancelled" })
            .eq("id", tournamentId);
          console.log("🚫 Turnuva iptal edildi");
        }
      }

      toast({ title: "Başarılı", description: "Turnuvadan ayrıldınız" });
      
      // Context'i temizle
      setCurrentTournament(null);
      setParticipants([]);
      setMatches([]);
      
      return true;
    } catch (error: any) {
      console.error("❌ Ayrılma hatası:", error);
      toast({ title: "Hata", description: error?.message || "Turnuvadan ayrılınamadı", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Start tournament - called when countdown ends
  const startTournament = async (tournamentId: string): Promise<boolean> => {
    try {
      setLoading(true);
      console.log("🏆 Turnuva başlatılıyor:", tournamentId);

      // Server-side RPC fonksiyonu kullan (RLS bypass için)
      const { data, error } = await supabase.rpc("start_tournament_with_bots_v2", {
        p_tournament_id: tournamentId,
      });

      if (error) {
        console.error("❌ RPC hatası:", error);
        throw error;
      }

      const result = data as { success: boolean; error?: string; bots_added?: number };
      
      if (!result.success) {
        console.error("❌ Turnuva başlatılamadı:", result.error);
        toast({ title: "Turnuva İptal", description: result.error || "Yeterli oyuncu yok" });
        return false;
      }

      console.log(`✅ Turnuva başladı, ${result.bots_added} bot eklendi`);
      await fetchTournamentDetails(tournamentId);
      return true;
    } catch (error) {
      console.error("❌ Turnuva başlatma hatası:", error);
      toast({ title: "Hata", description: "Turnuva başlatılamadı", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Advance to next round
  const advanceToNextRound = async (tournamentId: string): Promise<boolean> => {
    try {
      const { data: tournament } = await supabase
        .from("tournaments")
        .select("current_round")
        .eq("id", tournamentId)
        .single();

      if (!tournament) return false;

      const currentRound = tournament.current_round || 1;
      const nextRound = currentRound + 1;

      // Get completed matches from current round
      const { data: completedMatches } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .eq("round", currentRound)
        .eq("status", "completed")
        .order("match_number", { ascending: true });

      if (!completedMatches) return false;

      // Check if all matches in current round are completed
      const expectedMatches = currentRound === 1 ? 4 : currentRound === 2 ? 2 : 1;
      if (completedMatches.length < expectedMatches) {
        console.log(`⏳ Tur ${currentRound} henüz tamamlanmadı`);
        return false;
      }

      if (currentRound >= 3) {
        // Tournament finished
        await supabase
          .from("tournaments")
          .update({ status: "completed", finished_at: new Date().toISOString() })
          .eq("id", tournamentId);
        
        console.log("🏆 Turnuva tamamlandı!");
        return true;
      }

      // Create next round matches from winners
      const winners = completedMatches.map((m) => m.winner_id);
      
      const nextRoundMatches = [];
      for (let i = 0; i < winners.length; i += 2) {
        nextRoundMatches.push({
          tournament_id: tournamentId,
          round: nextRound,
          match_number: Math.floor(i / 2) + 1,
          player1_id: winners[i],
          player2_id: winners[i + 1],
          status: "pending",
          player1_score: 0,
          player2_score: 0,
        });
      }

      const { error: insertError } = await supabase
        .from("tournament_matches")
        .insert(nextRoundMatches);

      if (insertError) throw insertError;

      // Update tournament round
      const nextRoundStartsAt = new Date();
      nextRoundStartsAt.setSeconds(nextRoundStartsAt.getSeconds() + 10);

      await supabase
        .from("tournaments")
        .update({
          current_round: nextRound,
          next_round_starts_at: nextRoundStartsAt.toISOString(),
        })
        .eq("id", tournamentId);

      console.log(`✅ Tur ${nextRound} oluşturuldu`);
      await fetchTournamentDetails(tournamentId);
      return true;
    } catch (error) {
      console.error("❌ Tur ilerleme hatası:", error);
      return false;
    }
  };

  // Fetch tournament details
  const fetchTournamentDetails = async (tournamentId: string) => {
    if (!user) return;

    try {
      setLoading(true);

      // Get tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", tournamentId)
        .single();

      if (tournamentError) throw tournamentError;

      // Get participants with profiles
      const { data: rawParticipants } = await supabase
        .from("tournament_participants")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("joined_at", { ascending: true });

      const participantsWithProfiles = await Promise.all(
        (rawParticipants || []).map(async (p) => {
          if (p.is_bot || !p.user_id) {
            const seed = Array.from(String(p.user_id || "")).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
            const botName = generateBotName(seed);
            return {
              ...p,
              profiles: { username: botName, avatar_url: generateBotAvatar(seed, botName) },
            };
          }

          const { data: profile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", p.user_id)
            .single();

          return { ...p, profiles: profile || undefined };
        })
      );

      // Get matches with player info
      const { data: rawMatches } = await supabase
        .from("tournament_matches")
        .select("*")
        .eq("tournament_id", tournamentId)
        .order("round", { ascending: true })
        .order("match_number", { ascending: true });

      const matchesWithPlayers = (rawMatches || []).map((match) => {
        const player1 = participantsWithProfiles.find((p) => p.user_id === match.player1_id);
        const player2 = participantsWithProfiles.find((p) => p.user_id === match.player2_id);

        return {
          ...match,
          player1: player1 ? {
            username: player1.profiles?.username || "Oyuncu",
            avatar_url: player1.profiles?.avatar_url,
            is_bot: player1.is_bot,
          } : null,
          player2: player2 ? {
            username: player2.profiles?.username || "Oyuncu",
            avatar_url: player2.profiles?.avatar_url,
            is_bot: player2.is_bot,
          } : null,
        };
      });

      setCurrentTournament(tournament as Tournament);
      setParticipants(participantsWithProfiles as TournamentParticipant[]);
      setMatches(matchesWithPlayers as TournamentMatch[]);
    } catch (error) {
      console.error("❌ Detay hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  // Realtime subscriptions with auto-reconnect
  useEffect(() => {
    if (!user) return;

    fetchTournaments();

    const channelName = "tournament-global";
    autoReconnect.registerChannel(channelName, () =>
      supabase
        .channel(channelName)
        .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, () => {
          fetchTournaments();
        })
        .subscribe()
    );

    return () => {
      autoReconnect.unregisterChannel(channelName);
    };
  }, [user]);

  useEffect(() => {
    if (!currentTournament?.id) return;

    const tournamentId = currentTournament.id;
    const channelName = `tournament-details-${tournamentId}`;

    autoReconnect.registerChannel(channelName, () =>
      supabase
        .channel(channelName)
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "tournament_participants",
          filter: `tournament_id=eq.${tournamentId}`,
        }, () => {
          fetchTournamentDetails(tournamentId);
        })
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "tournament_matches",
          filter: `tournament_id=eq.${tournamentId}`,
        }, () => {
          fetchTournamentDetails(tournamentId);
        })
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `id=eq.${tournamentId}`,
        }, (payload) => {
          setCurrentTournament((prev) => prev ? { ...prev, ...payload.new } as Tournament : null);
        })
        .subscribe()
    );

    return () => {
      autoReconnect.unregisterChannel(channelName);
    };
  }, [currentTournament?.id]);

  const value: TournamentContextType = {
    tournaments,
    currentTournament,
    participants,
    matches,
    loading,
    createTournament,
    joinTournament,
    leaveTournament,
    startTournament,
    fetchTournaments,
    fetchTournamentDetails,
    advanceToNextRound,
    resetContext,
  };

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
};
