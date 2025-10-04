import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tournament, TournamentParticipant, TournamentMatch } from '@/types/tournament';
import { toast } from '@/components/ui/use-toast';
import { nakamaService } from '@/services/nakamaService';

interface TournamentContextType {
  // State
  tournaments: Tournament[];
  currentTournament: Tournament | null;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  loading: boolean;
  
  // Actions
  createTournament: () => Promise<string | null>;
  createNakamaTournament: (name: string) => Promise<string | null>;
  joinTournament: (tournamentId: string) => Promise<boolean>;
  joinNakamaTournament: (tournamentId: string) => Promise<boolean>;
  leaveTournament: (tournamentId: string) => Promise<boolean>;
  startTournament: (tournamentId: string) => Promise<boolean>;
  fetchTournaments: () => Promise<void>;
  fetchTournamentDetails: (tournamentId: string) => Promise<void>;
  
  // Cleanup
  resetContext: () => void;
}

const TournamentContext = createContext<TournamentContextType | undefined>(undefined);

export const useTournamentContext = () => {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error('useTournamentContext must be used within TournamentProvider');
  }
  return context;
};

interface TournamentProviderProps {
  children: ReactNode;
}

export const TournamentProvider: React.FC<TournamentProviderProps> = ({ children }) => {
  const { user } = useAuth();
  
  // State
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(false);

  // Cleanup function
  const resetContext = () => {
    setTournaments([]);
    setCurrentTournament(null);
    setParticipants([]);
    setMatches([]);
    setLoading(false);
  };

  // Fetch active tournaments - Nakama only
  const fetchTournaments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('🏆 Fetching Nakama tournaments...');
      
      await nakamaService.authenticate(user.id);
      await nakamaService.createSocket();
      const nakamaTournaments = await nakamaService.listTournaments();
      
      // Nakama turnuvalarını yerel Tournament formatına dönüştür
      const converted = nakamaTournaments.map((nt: any) => ({
        id: nt.id,
        name: nt.title || 'Turnuva',
        creator_id: null,
        status: 'waiting' as const,
        game_type: 'timed' as const,
        max_participants: nt.max_size || 8,
        current_round: 1,
        timeout_duration: 30,
        created_at: new Date(nt.create_time * 1000).toISOString(),
        started_at: null,
        finished_at: null,
        updated_at: new Date(nt.create_time * 1000).toISOString(),
        expires_at: nt.end_time ? new Date(nt.end_time * 1000).toISOString() : null
      }));
      
      setTournaments(converted);
      console.log('✅ Nakama tournaments loaded:', converted.length);
    } catch (error) {
      console.error('❌ Nakama tournament fetch error:', error);
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  // Create Nakama tournament
  const createNakamaTournament = async (name: string): Promise<string | null> => {
    if (!user) return null;
    
    try {
      setLoading(true);
      console.log('🏆 Creating Nakama tournament:', name);
      
      await nakamaService.authenticate(user.id);
      await nakamaService.createSocket();
      const tournamentId = await nakamaService.createTournament(name);
      
      toast({
        title: "🏆 Nakama Turnuva Oluşturuldu",
        description: `${name} başarıyla oluşturuldu!`,
      });
      
      return tournamentId;
    } catch (error: any) {
      console.error('❌ Nakama tournament creation failed:', error);
      toast({
        title: "❌ Nakama Turnuva Hatası",
        description: error.message,
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  // Join Nakama tournament
  const joinNakamaTournament = async (tournamentId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      setLoading(true);
      console.log('🎯 Joining Nakama tournament:', tournamentId);
      
      await nakamaService.authenticate(user.id);
      await nakamaService.createSocket();
      await nakamaService.joinTournament(tournamentId);
      
      toast({
        title: "🎯 Nakama Turnuvaya Katıldınız",
        description: `Turnuva ID: ${tournamentId}`,
      });
      
      return true;
    } catch (error: any) {
      console.error('❌ Nakama tournament join failed:', error);
      toast({
        title: "❌ Nakama Katılma Hatası",
        description: error.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Create new tournament - Nakama only
  const createTournament = async (): Promise<string | null> => {
    if (!user) return null;
    return await createNakamaTournament(`Turnuva ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`);
  };

  // Join tournament - Nakama only
  const joinTournament = async (tournamentId: string): Promise<boolean> => {
    if (!user) return false;
    return await joinNakamaTournament(tournamentId);
  };

  // Leave tournament
  const leaveTournament = async (tournamentId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Ayrılma hatası:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Ayrılma hatası:', error);
      return false;
    }
  };

  // Start tournament
  const startTournament = async (tournamentId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('start_tournament_with_bracket', {
        p_tournament_id: tournamentId
      });

      const result = data as any;
      
      if (error || !result || typeof result !== 'object' || !result.success) {
        console.error('Turnuva başlatma hatası:', error || result?.error || 'Bilinmeyen hata');
        toast({
          title: "Hata",
          description: "Turnuva başlatılamadı"
        });
        return false;
      }

      toast({
        title: "Başarılı",
        description: "Turnuva başlatıldı!"
      });

      // Refresh data to get latest state
      await fetchTournaments();
      await fetchTournamentDetails(tournamentId);
      
      return true;
    } catch (error) {
      console.error('Turnuva başlatma hatası:', error);
      return false;
    }
  };

  // Fetch tournament details
  const fetchTournamentDetails = async (tournamentId: string) => {
    try {
      setLoading(true);

      // Fetch tournament
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError || !tournamentData) {
        console.error('Turnuva bulunamadı:', tournamentError);
        return;
      }

      setCurrentTournament({
        ...tournamentData,
        status: tournamentData.status as 'waiting' | 'in_progress' | 'completed' | 'cancelled'
      });

      // Fetch participants (without join due to user_id text vs uuid)
      const { data: participantData, error: participantError } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('seed');

      if (!participantError && participantData) {
        // Collect valid UUID user ids (exclude bots and non-uuid strings)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const userIds = (participantData as any[])
          .filter(p => !p.is_bot && typeof p.user_id === 'string' && uuidRegex.test(p.user_id))
          .map(p => p.user_id);

        let profilesMap: Record<string, { username: string; avatar_url: string | null }> = {};
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds as any);

          (profilesData || []).forEach((prof: any) => {
            profilesMap[prof.id] = { username: prof.username, avatar_url: prof.avatar_url };
          });
        }

        const enriched = (participantData as any[]).map(p => ({
          ...p,
          profiles: p.user_id && profilesMap[p.user_id] ? profilesMap[p.user_id] : null
        }));

        setParticipants(enriched as any);
      }

      // Fetch matches if tournament is in progress
      if (tournamentData.status === 'in_progress') {
        try {
          const { data: matchData, error: matchError } = await supabase
            .from('tournament_matches')
            .select('*')
            .eq('tournament_id', tournamentId)
            .order('round')
            .order('match_number');

          if (!matchError && matchData) {
            // Enrich matches with player info
            const enrichedMatches = await Promise.all(
              matchData.map(async (match: any) => {
                let player1Info = null;
                let player2Info = null;

                try {
                  // Get player1 info if not a bot
                  if (match.player1_id && !match.player1_id.startsWith('bot_')) {
                    const { data: p1 } = await supabase
                      .from('profiles')
                      .select('username, avatar_url')
                      .eq('id', match.player1_id)
                      .maybeSingle();
                    if (p1) {
                      player1Info = { username: p1.username, avatar_url: p1.avatar_url, is_bot: false };
                    }
                  } else if (match.player1_id?.startsWith('bot_')) {
                    const botNumber = match.player1_id.split('_').pop();
                    player1Info = { username: `Bot ${botNumber}`, avatar_url: null, is_bot: true };
                  }

                  // Get player2 info if not a bot
                  if (match.player2_id && !match.player2_id.startsWith('bot_')) {
                    const { data: p2 } = await supabase
                      .from('profiles')
                      .select('username, avatar_url')
                      .eq('id', match.player2_id)
                      .maybeSingle();
                    if (p2) {
                      player2Info = { username: p2.username, avatar_url: p2.avatar_url, is_bot: false };
                    }
                  } else if (match.player2_id?.startsWith('bot_')) {
                    const botNumber = match.player2_id.split('_').pop();
                    player2Info = { username: `Bot ${botNumber}`, avatar_url: null, is_bot: true };
                  }
                } catch (playerError) {
                  console.error('Error fetching player info:', playerError);
                }

                return {
                  ...match,
                  player1: player1Info,
                  player2: player2Info
                };
              })
            );

            setMatches(enrichedMatches as any);

          } else {
            console.error('Match fetch error:', matchError);
          }
        } catch (matchFetchError) {
          console.error('Error in match fetching process:', matchFetchError);
        }
      }

    } catch (error) {
      console.error('Turnuva detayları alınamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch tournaments on mount and setup realtime subscriptions
  useEffect(() => {
    fetchTournaments();

    // Realtime subscription for tournaments
    const tournamentsChannel = supabase
      .channel('tournaments-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tournaments' 
      }, () => {
        fetchTournaments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tournamentsChannel);
    };
  }, []);

  // Setup realtime subscription for current tournament details
  useEffect(() => {
    if (!currentTournament?.id) return;

    const tournamentId = currentTournament.id;
    
    // Participants subscription
    const participantsChannel = supabase
      .channel(`tournament-participants-${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        fetchTournamentDetails(tournamentId);
      })
      .subscribe();

    // Matches subscription  
    const matchesChannel = supabase
      .channel(`tournament-matches-${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public', 
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`
       }, (payload) => {
        console.log('Match updated:', payload);
        fetchTournamentDetails(tournamentId);
      })
      .subscribe();

    // Tournament status subscription
    const statusChannel = supabase
      .channel(`tournament-status-${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournamentId}`
      }, (payload) => {
        const newTournament = payload.new as any;
        setCurrentTournament(prev => prev ? {
          ...prev,
          ...newTournament,
          status: newTournament.status as 'waiting' | 'in_progress' | 'completed' | 'cancelled'
        } : null);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(participantsChannel);
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(statusChannel);
    };
  }, [currentTournament?.id]);

  // Auto-check tournament progress
  const checkTournamentProgress = async (tournamentId: string) => {
    try {
      const { data: matches } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('status', 'completed');

      const { data: tournament } = await supabase
        .from('tournaments')
        .select('current_round')
        .eq('id', tournamentId)
        .single();

      if (!matches || !tournament) return;

      const currentRound = tournament.current_round;
      const roundMatches = matches.filter(m => m.round === currentRound);
      
      // Count expected matches for current round
      const expectedMatches = currentRound === 1 ? 4 : currentRound === 2 ? 2 : 1;
      
      if (roundMatches.length === expectedMatches && currentRound < 3) {
        // Auto-advance to next round
        console.log(`Round ${currentRound} complete, advancing...`);
        
        await supabase.rpc('advance_tournament_round', {
          p_tournament_id: tournamentId
        });
      }
    } catch (error) {
      console.error('Error checking tournament progress:', error);
    }
  };

  const value: TournamentContextType = {
    tournaments,
    currentTournament,
    participants,
    matches,
    loading,
    createTournament,
    createNakamaTournament,
    joinTournament,
    joinNakamaTournament,
    leaveTournament,
    startTournament,
    fetchTournaments,
    fetchTournamentDetails,
    resetContext
  };

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
};