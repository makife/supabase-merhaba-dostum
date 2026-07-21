import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tournament, TournamentParticipant, TournamentMatch } from "@/types/tournament";
import { toast } from "@/components/ui/use-toast";
import { generateBotName, generateBotAvatar } from "@/utils/tournamentHelpers";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";
import { fetchActiveTournamentList } from "@/utils/activeTournaments";

interface TournamentContextType {
  tournaments: Tournament[];
  currentTournament: Tournament | null;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  loading: boolean;
  leftTournaments: string[];

  createTournament: (options?: {
    name?: string;
    avatarUrl?: string | null;
    isPrivate?: boolean;
  }) => Promise<string | null>;
  startPrivateCountdown: (tournamentId: string, seconds?: number) => Promise<boolean>;
  joinTournament: (tournamentId: string) => Promise<boolean>;
  leaveTournament: (tournamentId: string) => Promise<boolean>;
  startTournament: (tournamentId: string) => Promise<boolean>;
  fetchTournaments: () => Promise<void>;
  fetchTournamentDetails: (tournamentId: string) => Promise<void>;
  advanceToNextRound: (tournamentId: string) => Promise<boolean>;
  resetContext: () => void;
  hasLeftTournament: (tournamentId: string) => boolean;
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
  const [leftTournaments, setLeftTournaments] = useState<string[]>([]);

  const fetchingRef = useRef(false);
  const hasLoadedTournamentsRef = useRef(false);

  const hasLeftTournament = (tournamentId: string): boolean => {
    return leftTournaments.includes(tournamentId);
  };

  const resetContext = () => {
    setTournaments([]);
    setCurrentTournament(null);
    setParticipants([]);
    setMatches([]);
    setLoading(false);
    hasLoadedTournamentsRef.current = false;
    // leftTournaments'ı resetleme - oturum boyunca kalmalı
  };

  // Fetch active tournaments
  const fetchTournaments = async () => {
    if (!user || fetchingRef.current) return;

    const showInitialLoader = !hasLoadedTournamentsRef.current;

    try {
      fetchingRef.current = true;
      if (showInitialLoader) setLoading(true);

      const activeTournaments = await fetchActiveTournamentList();
      setTournaments(activeTournaments);
      hasLoadedTournamentsRef.current = true;
    } catch (error) {
      console.error("❌ Turnuva listesi hatası:", error);
    } finally {
      if (showInitialLoader) setLoading(false);
      fetchingRef.current = false;
    }
  };

  // Create tournament
  const createTournament = async (options?: {
    name?: string;
    avatarUrl?: string | null;
    isPrivate?: boolean;
  }): Promise<string | null> => {
    if (!user) return null;

    try {
      setLoading(true);

      // ✅ Önceki turnuva verisini temizle — cancelled dialog tetiklenmesin
      setCurrentTournament(null);
      setParticipants([]);
      setMatches([]);

      const { data: profile } = await supabase
        .from("profiles")
        .select("game_credits, bonus_credits, premium_until, unlimited_lives_until")
        .eq("id", user.id)
        .single();

      if (profile) {
        const now = new Date();
        const isPremium =
          (profile.premium_until && new Date(profile.premium_until) > now) ||
          (profile.unlimited_lives_until && new Date(profile.unlimited_lives_until) > now);

        if (!isPremium) {
          const totalCredits = (profile.game_credits || 0) + (profile.bonus_credits || 0);
          if (totalCredits < 3) {
            toast({
              title: "Yetersiz Sayfa",
              description: "Turnuvaya katılmak için en az 3 sayfa gerekli",
              variant: "destructive",
            });
            return null;
          }
        }
      }

      const isPrivate = options?.isPrivate === true;

      // Özel turnuva: expires_at başlangıçta null (geri sayım yok, manuel başlatılır).
      // Genel turnuva: 30sn geri sayım.
      const expiresAtIso = isPrivate
        ? null
        : (() => {
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + 30);
            return expiresAt.toISOString();
          })();

      const tournamentName = options?.name?.trim() || "Turnuva";

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
          expires_at: expiresAtIso,
          is_private: isPrivate,
          avatar_url: options?.avatarUrl ?? null,
        } as any)
        .select()
        .single();

      if (error) throw error;

      const { error: participantError } = await supabase.from("tournament_participants").insert({
        tournament_id: tournament.id,
        user_id: user.id,
        is_bot: false,
      });

      if (participantError) throw participantError;

      console.log("✅ Turnuva oluşturuldu:", tournament.id, isPrivate ? "(özel)" : "(genel)");
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

      // ✅ Önceki turnuva verisini temizle — cancelled dialog tetiklenmesin
      setCurrentTournament(null);
      setParticipants([]);
      setMatches([]);

      const { data: existing } = await supabase
        .from("tournament_participants")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        console.log("✅ Zaten katılmış");
        return true;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("game_credits, bonus_credits, premium_until, unlimited_lives_until")
        .eq("id", user.id)
        .single();

      if (profile) {
        const now = new Date();
        const isPremium =
          (profile.premium_until && new Date(profile.premium_until) > now) ||
          (profile.unlimited_lives_until && new Date(profile.unlimited_lives_until) > now);

        if (!isPremium) {
          const totalCredits = (profile.game_credits || 0) + (profile.bonus_credits || 0);
          if (totalCredits < 3) {
            toast({
              title: "Yetersiz Sayfa",
              description: "Turnuvaya katılmak için en az 3 sayfa gerekli",
              variant: "destructive",
            });
            return false;
          }
        }
      }

      const { count: realPlayerCount } = await supabase
        .from("tournament_participants")
        .select("id", { count: "exact", head: true })
        .eq("tournament_id", tournamentId)
        .eq("is_bot", false);

      if ((realPlayerCount || 0) >= 8) {
        toast({ title: "Turnuva dolu", description: "Bu turnuvada 8 gerçek oyuncu var." });
        return false;
      }

      const { data: joinResult, error } = await supabase.rpc("join_tournament_replacing_bot" as any, {
        p_tournament_id: tournamentId,
      });

      if (error) throw error;

      const result = joinResult as {
        success?: boolean;
        error?: string;
        already_joined?: boolean;
        replaced_bot?: boolean;
      };
      if (!result?.success) {
        const isFull = result?.error === "Turnuva dolu";
        toast({
          title: isFull ? "Turnuva dolu" : "Turnuvaya katılınamadı",
          description: isFull ? "Bu turnuvada 8 gerçek oyuncu var." : result?.error || "Lütfen tekrar deneyin.",
          variant: isFull ? undefined : "destructive",
        });
        return false;
      }

      console.log(result.replaced_bot ? "✅ Bot slotu gerçek oyuncuyla değiştirildi" : "✅ Turnuvaya katıldı");

      try {
        await fetchTournamentDetails(tournamentId);
      } catch (fetchErr) {
        console.warn("⚠️ Katılım sonrası detay çekilemedi (turnuva başlamış olabilir):", fetchErr);
      }
      return true;
    } catch (error: any) {
      console.error("❌ Katılma hatası:", error);
      const msg = String(error?.message || "").toLowerCase();
      // Turnuva son saniyede başlamış/dolmuş olabilir - sessizce yut
      if (msg.includes("started") || msg.includes("in_progress") || msg.includes("başla") || msg.includes("expired")) {
        return false;
      }
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

      const { data: allParticipants } = await supabase
        .from("tournament_participants")
        .select("id, user_id, is_bot")
        .eq("tournament_id", tournamentId);

      // 🎮 Turnuva in_progress ise, ayrılan oyuncunun aktif maçını rakip lehine sonuçlandır
      let matchesAutoCompleted = false;
      if (tournament.status === "in_progress") {
        const { data: activeMatches } = await supabase
          .from("tournament_matches")
          .select("id, player1_id, player2_id, status")
          .eq("tournament_id", tournamentId)
          .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
          .in("status", ["pending", "in_progress"]);

        if (activeMatches && activeMatches.length > 0) {
          for (const match of activeMatches) {
            const winnerId = match.player1_id === user.id ? match.player2_id : match.player1_id;
            await supabase
              .from("tournament_matches")
              .update({ status: "completed", winner_id: winnerId })
              .eq("id", match.id);
            console.log("✅ Maç otomatik sonuçlandırıldı, kazanan:", winnerId);
          }
          matchesAutoCompleted = true;
        }
      }

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

      if (isCreator && (tournament.status === "waiting" || tournament.status === "in_progress")) {
        const otherPlayers = allParticipants?.filter((p) => p.user_id !== user.id && !p.is_bot);

        if (otherPlayers && otherPlayers.length > 0) {
          const newCreatorId = otherPlayers[0].user_id;
          await supabase.from("tournaments").update({ creator_id: newCreatorId }).eq("id", tournamentId);
          console.log("✅ Kuruculuk devredildi:", newCreatorId);
        } else if (tournament.status === "waiting") {
          await supabase.from("tournaments").update({ status: "cancelled" }).eq("id", tournamentId);
          console.log("🚫 Turnuva iptal edildi");
        }
      }

      // 🔄 Maçlar otomatik sonuçlandırıldıysa, tur ilerlemesini kontrol et
      if (matchesAutoCompleted && tournament.status === "in_progress") {
        console.log("🔄 Maç sonuçlandırıldı, tur ilerlemesi kontrol ediliyor...");
        // Kısa gecikme ile advance et - DB'nin güncellenmesi için
        setTimeout(async () => {
          try {
            await advanceToNextRound(tournamentId);
          } catch (e) {
            console.error("❌ Otomatik tur ilerleme hatası:", e);
          }
        }, 1500);
      }

      setLeftTournaments((prev) => [...prev, tournamentId]);

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

  // Start tournament
  const startTournament = async (tournamentId: string): Promise<boolean> => {
    try {
      setLoading(true);
      console.log("🏆 Turnuva başlatılıyor:", tournamentId);

      const { data, error } = await supabase.rpc("start_tournament_with_bots_v2", {
        p_tournament_id: tournamentId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; bots_added?: number };
      if (!result.success) {
        toast({ title: "Turnuva İptal", description: result.error || "Yeterli oyuncu yok" });
        return false;
      }

      // 💰 Tüm katılımcıların kredilerini düş (SECURITY DEFINER RPC - RLS bypass)
      const { data: creditResult, error: creditError } = await supabase.rpc("deduct_tournament_credits", {
        p_tournament_id: tournamentId,
      });

      if (creditError) {
        console.error("❌ Kredi düşme hatası:", creditError);
      } else {
        console.log("💰 Krediler düşürüldü:", creditResult);
      }

      await fetchTournamentDetails(tournamentId);
      return true;
    } catch (error) {
      console.error("❌ Turnuva başlatma hatası:", error);

      // Son saniyede birden fazla istemci/geri sayım aynı anda başlatmayı
      // deneyebilir. İlk istek başarılı olduysa sonraki RPC hata döndürse bile
      // kullanıcıya yanlış bir hata göstermeyip başlamış turnuvayı başarılı say.
      const { data: latestTournament } = await supabase
        .from("tournaments")
        .select("status")
        .eq("id", tournamentId)
        .maybeSingle();

      if (latestTournament?.status === "in_progress" || latestTournament?.status === "completed") {
        console.log("✅ Turnuva başka bir istek tarafından zaten başlatılmış");
        try {
          await fetchTournamentDetails(tournamentId);
        } catch (fetchError) {
          console.warn("⚠️ Başlatılmış turnuva detayları yenilenemedi:", fetchError);
        }
        return true;
      }

      toast({ title: "Hata", description: "Turnuva başlatılamadı", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Advance to next round — uses SECURITY DEFINER RPC to bypass RLS
  const advanceToNextRound = async (tournamentId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc("advance_tournament_round" as any, {
        p_tournament_id: tournamentId,
      });

      if (error) {
        console.error("❌ Tur ilerleme RPC hatası:", error);
        return false;
      }

      const result = data as { success: boolean; error?: string; action?: string; new_round?: number };
      if (!result.success) {
        console.log(`⏳ Tur ilerleme: ${result.error}`);
        return false;
      }

      console.log(`✅ Tur ilerleme: ${result.action}`, result.new_round ? `→ Tur ${result.new_round}` : "");
      await fetchTournamentDetails(tournamentId);
      return true;
    } catch (error) {
      console.error("❌ Tur ilerleme hatası:", error);
      return false;
    }
  };

  // Manuel başlatma — özel turnuvalar için kısa geri sayım tetikler (varsayılan 5sn).
  const startPrivateCountdown = async (tournamentId: string, seconds: number = 5): Promise<boolean> => {
    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + seconds);
      const { error } = await supabase
        .from("tournaments")
        .update({ expires_at: expiresAt.toISOString() })
        .eq("id", tournamentId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error("❌ Özel turnuva başlatma hatası:", error);
      toast({ title: "Hata", description: "Turnuva başlatılamadı", variant: "destructive" });
      return false;
    }
  };

  // Fetch tournament details
  const fetchTournamentDetails = async (tournamentId: string) => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: tournament, error: tournamentError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", tournamentId)
        .single();

      if (tournamentError) throw tournamentError;

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
        }),
      );

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
          player1: player1
            ? {
                username: player1.profiles?.username || "Oyuncu",
                avatar_url: player1.profiles?.avatar_url,
                is_bot: player1.is_bot,
              }
            : null,
          player2: player2
            ? {
                username: player2.profiles?.username || "Oyuncu",
                avatar_url: player2.profiles?.avatar_url,
                is_bot: player2.is_bot,
              }
            : null,
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

  // Realtime subscriptions
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
        .subscribe(),
    );

    const handleAppResumed = () => {
      console.log("🔄 [Tournament] 🎯 App resumed eventi alındı!");
      fetchTournaments().catch((e) => {
        console.error("[Tournament] ❌ Resume turnuva yenileme hatası:", e);
      });
    };

    window.addEventListener("app-resumed", handleAppResumed);
    console.log("[Tournament] ✅ app-resumed listener kaydedildi");

    return () => {
      autoReconnect.unregisterChannel(channelName);
      window.removeEventListener("app-resumed", handleAppResumed);
    };
  }, [user]);

  useEffect(() => {
    if (!currentTournament?.id) return;

    const tournamentId = currentTournament.id;
    const channelName = `tournament-details-${tournamentId}`;

    const matchStatusCache = new Map<string, string>();
    matches.forEach((m) => matchStatusCache.set(m.id, m.status));

    autoReconnect.registerChannel(channelName, () =>
      supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tournament_participants",
            filter: `tournament_id=eq.${tournamentId}`,
          },
          () => {
            fetchTournamentDetails(tournamentId);
          },
        )
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
            const oldMatch = payload.old as any;

            const statusChanged = oldMatch?.status !== newMatch?.status;
            const winnerChanged = oldMatch?.winner_id !== newMatch?.winner_id;
            const countdownChanged = !oldMatch?.countdown_started_at && newMatch?.countdown_started_at;

            if (statusChanged || winnerChanged || countdownChanged) {
              console.log(
                `🔄 Bracket yenileniyor: status=${statusChanged}, winner=${winnerChanged}, countdown=${countdownChanged}`,
              );
              fetchTournamentDetails(tournamentId);
            } else {
              setMatches((prev) =>
                prev.map((m) =>
                  m.id === newMatch.id
                    ? { ...m, player1_score: newMatch.player1_score, player2_score: newMatch.player2_score }
                    : m,
                ),
              );
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tournament_matches",
            filter: `tournament_id=eq.${tournamentId}`,
          },
          () => {
            fetchTournamentDetails(tournamentId);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tournaments",
            filter: `id=eq.${tournamentId}`,
          },
          (payload) => {
            setCurrentTournament((prev) => (prev ? ({ ...prev, ...payload.new } as Tournament) : null));
          },
        )
        .subscribe(),
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
    leftTournaments,
    createTournament,
    joinTournament,
    leaveTournament,
    startTournament,
    startPrivateCountdown,
    fetchTournaments,
    fetchTournamentDetails,
    advanceToNextRound,
    resetContext,
    hasLeftTournament,
  };

  return <TournamentContext.Provider value={value}>{children}</TournamentContext.Provider>;
};
