import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tournament, TournamentParticipant, TournamentMatch } from '@/types/tournament';
import { toast } from '@/components/ui/use-toast';

interface TournamentContextType {
  // State
  tournaments: Tournament[];
  currentTournament: Tournament | null;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  loading: boolean;
  
  // Actions
  createTournament: () => Promise<string | null>;
  joinTournament: (tournamentId: string) => Promise<boolean>;
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

  // Fetch active tournaments
  const fetchTournaments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Turnuva listesi alınamadı:', error);
        return;
      }

      setTournaments((data || []).map(tournament => ({
        ...tournament,
        status: tournament.status as 'waiting' | 'in_progress' | 'completed' | 'cancelled'
      })));
    } catch (error) {
      console.error('Turnuva fetch hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create new tournament
  const createTournament = async (): Promise<string | null> => {
    if (!user) return null;

    try {
      setLoading(true);
      
      // Create tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          creator_id: user.id,
          name: `Turnuva ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
          status: 'waiting',
          game_type: 'timed',
          max_participants: 8,
          current_round: 1,
          timeout_duration: 30, // 30 saniye
          expires_at: new Date(Date.now() + 30000).toISOString() // 30 saniye sonra
        })
        .select()
        .single();

      if (tournamentError || !tournament) {
        console.error('Turnuva oluşturulamadı:', tournamentError);
        toast({
          title: "Hata",
          description: "Turnuva oluşturulamadı",
          variant: "destructive"
        });
        return null;
      }

      // Add creator as participant
      const { error: participantError } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournament.id,
          user_id: user.id,
          is_bot: false,
          seed: 1
        });

      if (participantError) {
        console.error('Katılımcı eklenemedi:', participantError);
        // Tournament created but user couldn't join - clean up
        await supabase.from('tournaments').delete().eq('id', tournament.id);
        return null;
      }

      toast({
        title: "Başarılı",
        description: "Turnuva oluşturuldu!"
      });

      await fetchTournaments();
      return tournament.id;
      
    } catch (error) {
      console.error('Turnuva oluşturma hatası:', error);
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

      // Check if already joined
      const { data: existing } = await supabase
        .from('tournament_participants')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        toast({
          title: "Bilgi",
          description: "Zaten bu turnuvaya katıldınız"
        });
        return true;
      }

      // Check participant count
      const { count } = await supabase
        .from('tournament_participants')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournamentId);

      if (count && count >= 8) {
        toast({
          title: "Turnuva Dolu",
          description: "Bu turnuva dolu"
        });
        return false;
      }

      // Add participant
      const { error } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournamentId,
          user_id: user.id,
          is_bot: false,
          seed: (count || 0) + 1
        });

      if (error) {
        console.error('Katılma hatası:', error);
        toast({
          title: "Hata",
          description: "Turnuvaya katılamadınız"
        });
        return false;
      }

      toast({
        title: "Başarılı",
        description: "Turnuvaya katıldınız!"
      });

      return true;
      
    } catch (error) {
      console.error('Katılma hatası:', error);
      return false;
    } finally {
      setLoading(false);
    }
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
        return false;
      }

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

      // Fetch participants
      const { data: participantData, error: participantError } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('tournament_id', tournamentId)
        .order('seed');

      if (!participantError && participantData) {
        setParticipants(participantData as any);
      }

      // Fetch matches if tournament is in progress
      if (tournamentData.status === 'in_progress') {
        const { data: matchData, error: matchError } = await supabase
          .from('tournament_matches')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('round')
          .order('match_number');

        if (!matchError && matchData) {
          setMatches(matchData as any);
        }
      }

    } catch (error) {
      console.error('Turnuva detayları alınamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch tournaments on mount
  useEffect(() => {
    fetchTournaments();
  }, []);

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
    resetContext
  };

  return (
    <TournamentContext.Provider value={value}>
      {children}
    </TournamentContext.Provider>
  );
};