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


  // Calculate countdown
  useEffect(() => {
    if (!context.currentTournament?.expires_at || context.currentTournament?.status !== 'waiting') return;

    const interval = setInterval(() => {
      const expiresAt = new Date(context.currentTournament.expires_at!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      
      setTimeLeft(remaining);

      // Auto-start or cancel when time is up AND tournament is still waiting
      if (remaining === 0 && context.currentTournament?.status === 'waiting') {
        const effectiveReal = Math.max(realPlayerCount, isCreator ? 1 : 0);
        if (effectiveReal >= 1) {
          if (isCreator) {
            startTournament();
          }
        } else {
          // Cancel tournament if not enough players - any participant can trigger this
          supabase
            .from('tournaments')
            .update({ status: 'cancelled' })
            .eq('id', tournamentId)
            .then(() => {
              // Force refetch tournament details to get updated status
              context.fetchTournamentDetails(tournamentId);
            });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [context.currentTournament?.expires_at, context.currentTournament?.status, isCreator, realPlayerCount, tournamentId]);

  // Update derived state
  useEffect(() => {
    if (!context.currentTournament || !user) return;

    setIsCreator(context.currentTournament.creator_id === user.id);
    
    const userParticipant = context.participants.find(p => p.user_id === user.id);
    console.log('🔍 User participant check:', {
      userId: user.id.slice(-8),
      participantsCount: context.participants.length,
      participants: context.participants.map(p => ({ id: p.user_id?.slice(-8), isBot: p.is_bot })),
      found: !!userParticipant
    });
    setHasJoined(!!userParticipant);
    
    const realPlayers = context.participants.filter(p => !p.is_bot);
    setRealPlayerCount(realPlayers.length);
  }, [context.currentTournament, context.participants, user]);

  const startTournament = async () => {
    if (!tournamentId || !isCreator || !context.currentTournament) return;
    
    // Check if tournament is already started or in progress
    if (context.currentTournament.status !== 'waiting') {
      console.log('Tournament already started or not waiting:', context.currentTournament.status);
      return;
    }

    // Check minimum participants (at least 1 real player, bots will fill the rest)
    if (realPlayerCount < 1) {
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