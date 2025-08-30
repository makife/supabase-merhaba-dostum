import { useState, useEffect } from 'react';
import { useTournament } from '@/hooks/useTournament';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import TournamentCountdown from '@/components/tournament/TournamentCountdown';
import TournamentRoundAdvance from '@/components/tournament/TournamentRoundAdvance';
import TournamentResultCard from '@/components/tournament/TournamentResultCard';
import TournamentBracket from '@/components/tournament/TournamentBracket';
import TournamentLobby from '@/components/tournament/TournamentLobby';

const TournamentFlowManager = () => {
  const { user } = useAuth();
  const { currentTournament, userParticipation, refreshTournament } = useTournament();
  const [currentStep, setCurrentStep] = useState<'lobby' | 'countdown' | 'bracket' | 'result'>('lobby');
  const [countdownType, setCountdownType] = useState<'waiting' | 'quarter' | 'semi' | 'final'>('waiting');
  const [matchResult, setMatchResult] = useState<{ won: boolean; round: number } | null>(null);

  useEffect(() => {
    if (!currentTournament || !user) return;

    const checkTournamentProgress = async () => {
      await refreshTournament();
      
      if (currentTournament.status === 'waiting') {
        setCurrentStep('lobby');
      } else if (currentTournament.status === 'active') {
        // Check user's current match status
        const { data: userMatch } = await supabase
          .from('tournament_matches')
          .select('*')
          .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
          .eq('tournament_id', currentTournament.id)
          .eq('round', currentTournament.current_round)
          .maybeSingle();

        if (userMatch) {
          if (userMatch.status === 'completed') {
            const userWon = userMatch.winner_id === user.id;
            setMatchResult({ won: userWon, round: currentTournament.current_round });
            setCurrentStep('result');
          } else {
            setCurrentStep('bracket');
          }
        }
      }
    };

    checkTournamentProgress();
    
    // Real-time subscription for tournament updates
    const channel = supabase
      .channel(`tournament-flow-${currentTournament.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${currentTournament.id}`
      }, (payload) => {
        checkTournamentProgress();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTournament, user, refreshTournament]);

  // Handle different steps of the tournament
  const renderStep = () => {
    if (!currentTournament) return null;
    
    switch (currentStep) {
      case 'lobby':
        return <TournamentLobby 
          tournament={currentTournament} 
          onLeave={() => window.location.href = '/tournament'}
        />;
      
      case 'countdown':
        return (
          <TournamentCountdown
            duration={10}
            title={`${countdownType === 'quarter' ? 'Çeyrek Final' : countdownType === 'semi' ? 'Yarı Final' : 'Final'} Başlıyor`}
            description={`${countdownType === 'quarter' ? 'Çeyrek final' : countdownType === 'semi' ? 'Yarı final' : 'Final'} maçları için hazırlanın`}
            onComplete={() => {
              setCurrentStep('bracket');
            }}
          />
        );
      
      case 'bracket':
        return (
          <TournamentBracket 
            tournament={currentTournament} 
            userParticipation={userParticipation} 
          />
        );
      
      case 'result':
        if (!matchResult) return null;
        
        return (
          <TournamentResultCard
            won={matchResult.won}
            round={matchResult.round}
            tournamentName={currentTournament.name}
            onContinue={() => {
              if (matchResult.won && matchResult.round < 3) {
                // Move to next round countdown
                setCountdownType(matchResult.round === 1 ? 'semi' : 'final');
                setCurrentStep('countdown');
              } else {
                // Return to tournament page
                window.location.href = '/tournament';
              }
            }}
          />
        );
      
      default:
        return null;
    }
  };

  return <div className="tournament-flow-manager">{renderStep()}</div>;
};

export default TournamentFlowManager;