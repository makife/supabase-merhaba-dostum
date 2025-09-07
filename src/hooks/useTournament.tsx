import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTournamentContext } from '@/contexts/TournamentContext';
import { useAuth } from '@/contexts/AuthContext';

export const useTournament = (tournamentId?: string) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const context = useTournamentContext();
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [isCreator, setIsCreator] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [realPlayerCount, setRealPlayerCount] = useState(0);

  // Real-time subscriptions
  useEffect(() => {
    if (!tournamentId) return;

    const tournamentChannel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'tournaments',
          filter: `id=eq.${tournamentId}`
        },
        (payload) => {
          console.log('Tournament updated:', payload.new);
          
          if (payload.new.status === 'in_progress') {
            navigate(`/tournament-bracket/${tournamentId}`);
          } else if (payload.new.status === 'cancelled') {
            navigate('/tournament');
          }
          
          // Update current tournament
          context.fetchTournamentDetails(tournamentId);
        }
      )
      .subscribe();

    const participantsChannel = supabase
      .channel(`participants-${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_participants',
          filter: `tournament_id=eq.${tournamentId}`
        },
        () => {
          console.log('Participants updated');
          context.fetchTournamentDetails(tournamentId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tournamentChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [tournamentId, navigate, context]);

  // Calculate countdown
  useEffect(() => {
    if (!context.currentTournament?.expires_at) return;

    const interval = setInterval(() => {
      const expiresAt = new Date(context.currentTournament.expires_at!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      
      setTimeLeft(remaining);

      // Auto-start if creator and time is up
      if (remaining === 0 && isCreator) {
        startTournament();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [context.currentTournament?.expires_at, isCreator]);

  // Update derived state
  useEffect(() => {
    if (!context.currentTournament || !user) return;

    setIsCreator(context.currentTournament.creator_id === user.id);
    
    const userParticipant = context.participants.find(p => p.user_id === user.id);
    setHasJoined(!!userParticipant);
    
    const realPlayers = context.participants.filter(p => !p.is_bot);
    setRealPlayerCount(realPlayers.length);
  }, [context.currentTournament, context.participants, user]);

  const startTournament = async () => {
    if (!tournamentId || !isCreator) return;

    // Check minimum participants
    if (realPlayerCount < 2) {
      // Cancel tournament
      await supabase
        .from('tournaments')
        .update({ status: 'cancelled' })
        .eq('id', tournamentId);
      return;
    }

    const success = await context.startTournament(tournamentId);
    if (success) {
      navigate(`/tournament-bracket/${tournamentId}`);
    }
  };

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
      navigate('/tournament');
    }
    return success;
  };

  return {
    ...context,
    timeLeft,
    isCreator,
    hasJoined,
    realPlayerCount,
    startTournament,
    joinTournament,
    leaveTournament
  };
};