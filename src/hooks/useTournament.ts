import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useTournament = () => {
  const [currentTournament, setCurrentTournament] = useState<any>(null);
  const [userParticipation, setUserParticipation] = useState<any>(null);
  const { user } = useAuth();

  // Kullanıcının aktif turnuvasını kontrol et
  const checkUserTournament = async () => {
    if (!user) return;

    try {
      // Kullanıcının katıldığı aktif turnuvaları bul
      const { data: participation, error } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          tournaments!inner(*)
        `)
        .eq('user_id', user.id)
        .in('tournaments.status', ['waiting', 'active'])
        .single();

      if (!error && participation) {
        setCurrentTournament(participation.tournaments);
        setUserParticipation(participation);
      } else {
        setCurrentTournament(null);
        setUserParticipation(null);
      }
    } catch (error) {
      console.error('Error checking user tournament:', error);
    }
  };

  // Turnuva oluştur
  const createTournament = async () => {
    if (!user) throw new Error('Kullanıcı giriş yapmalı');

    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        name: `Süreli Turnuva ${new Date().toLocaleTimeString('tr-TR')}`,
        status: 'waiting',
        current_round: 1,
        max_participants: 8,
        game_type: 'timed',
        expires_at: new Date(Date.now() + 30 * 1000).toISOString()
      })
      .select()
      .single();

    if (error) throw error;

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
      throw new Error('Bu turnuvaya zaten katılmışsınız');
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

    // Turnuva durumunu yenile
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

    setCurrentTournament(null);
    setUserParticipation(null);
  };

  // Real-time updates
  useEffect(() => {
    checkUserTournament();

    if (!user) return;

    // Kullanıcının katılımcı durumunu dinle
    const participationChannel = supabase
      .channel(`user-tournament-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_participants',
        filter: `user_id=eq.${user.id}`
      }, () => {
        checkUserTournament();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(participationChannel);
    };
  }, [user]);

  return {
    currentTournament,
    userParticipation,
    createTournament,
    joinTournament,
    leaveTournament,
    refreshTournament: checkUserTournament
  };
};