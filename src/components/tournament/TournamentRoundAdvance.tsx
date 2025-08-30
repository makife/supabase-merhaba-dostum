// TournamentRoundAdvance.tsx - Basitleştirilmiş versiyon
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TournamentRoundAdvanceProps {
  tournament: any;
  onRoundAdvanced: (newRound: number) => void;
}

const TournamentRoundAdvance = ({ tournament, onRoundAdvanced }: TournamentRoundAdvanceProps) => {
  const { toast } = useToast();

  useEffect(() => {
    if (!tournament?.id) return;

    console.log('TournamentRoundAdvance - Listening for tournament changes:', tournament.id);

    // Sadece turnuva güncellemelerini dinle
    const channel = supabase
      .channel(`tournament-round-advance-${tournament.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournament.id}`
      }, (payload) => {
        console.log('Tournament updated:', payload.new);
        const newTournament = payload.new as any;
        
        if (newTournament.current_round > tournament.current_round) {
          console.log(`Round advanced: ${tournament.current_round} -> ${newTournament.current_round}`);
          
          onRoundAdvanced(newTournament.current_round);
          
          const roundName = newTournament.current_round === 2 ? 'Yarı Final' : 
                           newTournament.current_round === 3 ? 'Final' : `${newTournament.current_round}. Tur`;
          
          toast({
            title: 'Tur Tamamlandı',
            description: `Turnuva ${roundName}'e geçti`,
          });
        }
      })
      .subscribe();

    return () => {
      console.log('Cleaning up tournament round advance subscription');
      supabase.removeChannel(channel);
    };
  }, [tournament?.id, tournament?.current_round, onRoundAdvanced, toast]);

  return null;
};

export default TournamentRoundAdvance;