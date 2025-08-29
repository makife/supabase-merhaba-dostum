import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Tournament match türü tanımı
interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  winner_id: string | null;
  status: string;
  room_id: string | null;
  created_at: string;
  updated_at: string;
}

export const useTournament = () => {
  const [currentTournament, setCurrentTournament] = useState<any>(null);
  const [userParticipation, setUserParticipation] = useState<any>(null);
  const { user } = useAuth();

  // Manuel refresh - sadece istendiğinde çağırılır
  const checkUserTournament = async () => {
    if (!user) {
      setCurrentTournament(null);
      setUserParticipation(null);
      return;
    }

    try {
      // Kullanıcının katıldığı aktif turnuvayı bul
      const { data: participation, error } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          tournaments!inner(*)
        `)
        .eq('user_id', user.id)
        .in('tournaments.status', ['waiting', 'active'])
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && participation) {
        console.log('✅ User tournament found:', participation.tournaments.name);
        setCurrentTournament(participation.tournaments);
        setUserParticipation(participation);
      } else {
        console.log('ℹ️ No active tournament for user');
        setCurrentTournament(null);
        setUserParticipation(null);
      }
    } catch (error) {
      console.error('Error checking user tournament:', error);
      setCurrentTournament(null);
      setUserParticipation(null);
    }
  };

  const checkUserRoundResult = async (tournamentId: string, round: number) => {
    if (!user) return null;

    try {
      const { data: match, error } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('round', round)
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .maybeSingle();

      if (error) throw error;

      // Türü açıkça belirt
      const typedMatch = match as TournamentMatch;

      if (typedMatch && typedMatch.status === 'completed') {
        return {
          won: typedMatch.winner_id === user.id,
          score: typedMatch.player1_id === user.id ? typedMatch.player1_score : typedMatch.player2_score,
          opponentScore: typedMatch.player1_id === user.id ? typedMatch.player2_score : typedMatch.player1_score
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking round result:', error);
      return null;
    }
  };

  // TEMİZLEME FONKSİYONU - önemli!
  const clearTournament = useCallback(() => {
    console.log('🧹 Clearing tournament data');
    setCurrentTournament(null);
    setUserParticipation(null);
  }, []);

  // Turnuva oluştur
  const createTournament = async () => {
    if (!user) throw new Error('Kullanıcı giriş yapmalı');

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        name: `Turnuva ${new Date().toLocaleTimeString('tr-TR')}`,
        status: 'waiting',
        current_round: 1,
        max_participants: 8,
        game_type: 'timed',
        expires_at: new Date(Date.now() + 30 * 1000).toISOString() // 30 saniye
      })
      .select()
      .single();

    if (error) throw error;

    console.log('🏆 Tournament created:', tournament.name);

    // Otomatik katıl
    await joinTournament(tournament.id);
    
    return tournament;
  };

  // Turnuvaya katıl
  const joinTournament = async (tournamentId: string) => {
    if (!user) throw new Error('Kullanıcı giriş yapmalı');

    // Zaten katılmış mı kontrol et
    const { data: existingParticipant } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingParticipant) {
      console.log('⚠️ User already joined tournament');
      // Mevcut turnuva bilgisini al
      await checkUserTournament();
      return;
    }

    // Mevcut katılımcı sayısını kontrol et
    const { data: currentParticipants } = await supabase
      .from('tournament_participants')
      .select('*')
      .eq('tournament_id', tournamentId);

    const participantCount = currentParticipants?.length || 0;
    if (participantCount >= 8) {
      throw new Error('Bu turnuva dolu');
    }

    // Katıl
    const { error } = await supabase
      .from('tournament_participants')
      .insert({
        tournament_id: tournamentId,
        user_id: user.id,
        seed: participantCount + 1,
        is_bot: false
      });

    if (error) throw error;

    console.log('✅ User joined tournament');

    // Turnuva durumunu güncelle
    await checkUserTournament();
  };

  // Turnuvadan ayrıl
  const leaveTournament = async () => {
    if (!user || !currentTournament) return;

    const { error } = await supabase
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', currentTournament.id)
      .eq('user_id', user.id);

    if (error) throw error;

    console.log('👋 User left tournament');
    
    // Durumu temizle
    clearTournament();
  };

  // Sadece mevcut turnuva varsa real-time dinle
  useEffect(() => {
    if (!currentTournament?.id) return;

    console.log('🔄 Setting up real-time for tournament:', currentTournament.name);

    const tournamentChannel = supabase
      .channel(`tournament-${currentTournament.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${currentTournament.id}`
      }, (payload) => {
        console.log('🏆 Tournament updated:', payload.new);
        setCurrentTournament(payload.new);
      })
      .subscribe();

    return () => {
      console.log('🔌 Cleaning tournament channel');
      supabase.removeChannel(tournamentChannel);
    };
  }, [currentTournament?.id]);

  return {
    currentTournament,
    userParticipation,
    createTournament,
    joinTournament,
    leaveTournament,
    refreshTournament: checkUserTournament,
    clearTournament,
    checkUserRoundResult // Bu fonksiyonu da export et
  };
};