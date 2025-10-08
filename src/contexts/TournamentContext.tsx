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

  // Fetch active tournaments - Supabase
  const fetchTournaments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Önce süresi dolmuş turnuvaları temizle
      await supabase.rpc('cleanup_expired_tournaments');
      
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['waiting', 'in_progress'])
        .gt('expires_at', new Date().toISOString()) // Süresi dolmamış olanlar
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setTournaments((data || []) as Tournament[]);
    } catch (error) {
      console.error('Turnuvalar alınırken hata:', error);
      toast({
        title: "Hata",
        description: "Turnuvalar yüklenirken bir hata oluştu"
      });
    } finally {
      setLoading(false);
    }
  };

  // Create tournament - Supabase
  const createNakamaTournament = async (name: string): Promise<string | null> => {
    if (!user) return null;
    
    try {
      setLoading(true);
      
      // 30 saniye sonrasını hesapla
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + 30);
      
      // Supabase'de turnuva oluştur
      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          creator_id: user.id,
          name: name,
          status: 'waiting',
          game_type: 'timed',
          max_participants: 8,
          current_round: 1,
          timeout_duration: 15,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Yaratıcıyı otomatik olarak katılımcılara ekle
      const { error: participantError } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournament.id,
          user_id: user.id,
          is_bot: false
        });
      
      if (participantError) throw participantError;
      
      toast({
        title: "🏆 Turnuva Oluşturuldu",
        description: `${name} başarıyla oluşturuldu!`,
      });
      
      await fetchTournaments();
      return tournament.id;
    } catch (error: any) {
      console.error('Turnuva oluşturulurken hata:', error);
      toast({
        title: "❌ Hata",
        description: "Turnuva oluşturulamadı",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  // Join tournament - Supabase
  const joinNakamaTournament = async (tournamentId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      setLoading(true);
      
      // Turnuvaya katılımcı olarak ekle
      const { error } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournamentId,
          user_id: user.id,
          is_bot: false
        });
      
      if (error) throw error;
      
      toast({
        title: "🎯 Turnuvaya Katıldınız",
        description: "Başarıyla katıldınız!",
      });
      
      await fetchTournamentDetails(tournamentId);
      return true;
    } catch (error: any) {
      console.error('Turnuvaya katılırken hata:', error);
      toast({
        title: "❌ Hata",
        description: "Turnuvaya katılınamadı",
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
      setLoading(true);

      const { error } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournamentId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Turnuvadan ayrıldınız"
      });

      return true;
    } catch (error) {
      console.error('Ayrılma hatası:', error);
      toast({
        title: "Hata",
        description: "Turnuvadan ayrılınamadı",
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Start tournament
  const startTournament = async (tournamentId: string): Promise<boolean> => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc('create_matches_for_active_tournament', {
        p_tournament_id: tournamentId
      });

      if (error) throw error;

      toast({
        title: "Başarılı",
        description: "Turnuva başlatıldı!"
      });

      await fetchTournaments();
      await fetchTournamentDetails(tournamentId);
      
      return true;
    } catch (error) {
      console.error('Turnuva başlatma hatası:', error);
      toast({
        title: "Hata",
        description: "Turnuva başlatılamadı",
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get player info
  const getPlayerInfo = async (playerId: string | null, participants: TournamentParticipant[]) => {
    if (!playerId) return null;
    
    // Bot kontrolü
    if (playerId.startsWith('bot_')) {
      const botIndex = participants.filter(p => p.is_bot && p.user_id && p.user_id.startsWith('bot_')).findIndex(p => p.user_id === playerId);
      return {
        username: generateBotName(botIndex),
        avatar_url: null,
        is_bot: true
      };
    }

    // Gerçek oyuncu
    const participant = participants.find(p => p.user_id === playerId);
    if (participant?.profiles) {
      return {
        username: participant.profiles.username || 'Oyuncu',
        avatar_url: participant.profiles.avatar_url,
        is_bot: false
      };
    }

    return {
      username: 'Oyuncu',
      avatar_url: null,
      is_bot: false
    };
  };

  const generateBotName = (index: number): string => {
    const turkishNames = [
      'ahmet', 'mehmet', 'ayşe', 'fatma', 'ali', 'veli', 'zeynep', 'elif',
      'mustafa', 'emre', 'can', 'ece', 'selin', 'burak', 'deniz', 'yusuf',
      'merve', 'özge', 'berk', 'arda', 'sude', 'efe', 'ada', 'emir',
      'defne', 'kaan', 'ilayda', 'mert', 'asya', 'kerem', 'nisa', 'bora',
      'irem', 'doruk', 'ela', 'eren', 'nehir', 'alp', 'maya', 'ege',
      'eylül', 'tunç', 'lara', 'uras', 'derin', 'çağlar', 'pelin', 'koray',
      'damla', 'tolga', 'su', 'onur', 'ceren', 'umut', 'begüm', 'barış'
    ];
    
    const decorations = [
      (name: string) => name + Math.floor(Math.random() * 10000),
      (name: string) => name + '_',
      (name: string) => '_' + name,
      (name: string) => '_' + name + '_',
      (name: string) => name + name.charAt(name.length - 1).repeat(2),
      (name: string) => name.charAt(0) + name.slice(1).repeat(1) + Math.floor(Math.random() * 100),
      (name: string) => name + '.' + Math.floor(Math.random() * 100),
      (name: string) => name.charAt(0).toUpperCase() + name.slice(1) + Math.floor(Math.random() * 999),
      (name: string) => name,
    ];
    
    // Index'i seed olarak kullan
    const nameIndex = index % turkishNames.length;
    const decorationIndex = Math.floor(index / turkishNames.length) % decorations.length;
    
    const baseName = turkishNames[nameIndex];
    return decorations[decorationIndex](baseName);
  };

  // Fetch tournament details - Supabase
  const fetchTournamentDetails = async (tournamentId: string) => {
    try {
      if (!user) return;
      
      setLoading(true);
      
      // Turnuva bilgisini çek
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();
      
      if (tournamentError) throw tournamentError;
      
      // Katılımcıları çek
      const { data: rawParticipants, error: participantsError } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId);
      
      if (participantsError) throw participantsError;

      // Her katılımcı için profil bilgisini al
      const participantsWithProfiles = await Promise.all(
        (rawParticipants || []).map(async (p) => {
          if (p.is_bot || !p.user_id) {
            return {
              ...p,
              profiles: undefined
            };
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', p.user_id)
            .single();

          return {
            ...p,
            profiles: profile || undefined
          };
        })
      );
      
      // Maçları çek ve oyuncu bilgilerini de al
      const { data: rawMatches, error: matchesError } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true });
      
      if (matchesError) throw matchesError;

      // Her maç için oyuncu bilgilerini ekle
      const matchesWithPlayers = await Promise.all(
        (rawMatches || []).map(async (match) => {
          const player1Data = await getPlayerInfo(match.player1_id, participantsWithProfiles);
          const player2Data = await getPlayerInfo(match.player2_id, participantsWithProfiles);

          return {
            ...match,
            player1: player1Data,
            player2: player2Data
          };
        })
      );
      
      setCurrentTournament(tournament as Tournament);
      setParticipants(participantsWithProfiles as TournamentParticipant[]);
      setMatches(matchesWithPlayers as TournamentMatch[]);
    } catch (error) {
      console.error('Turnuva detayları alınırken hata:', error);
      toast({
        title: "Hata",
        description: "Turnuva detayları yüklenemedi",
        variant: "destructive"
      });
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