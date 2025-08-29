// TournamentRoundAdvance.tsx
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
    const advanceRoundIfNeeded = async () => {
      if (!tournament) return;

      // Check if all matches in current round are completed
      const { data: matches, error } = await supabase
        .from('tournament_matches')
        .select('id, status')
        .eq('tournament_id', tournament.id)
        .eq('round', tournament.current_round);

      if (error) {
        console.error('Error fetching matches:', error);
        return;
      }

      const allMatchesCompleted = matches.every(match => match.status === 'completed');
      
      if (allMatchesCompleted && tournament.current_round < 3) {
        // Advance to next round
        const nextRound = tournament.current_round + 1;
        
        const { error: updateError } = await supabase
          .from('tournaments')
          .update({ current_round: nextRound })
          .eq('id', tournament.id);

        if (updateError) {
          console.error('Error advancing round:', updateError);
          return;
        }

        // Create matches for the next round
        await createMatchesForRound(tournament.id, nextRound);
        
        onRoundAdvanced(nextRound);
        
        toast({
          title: 'Tur Tamamlandı',
          description: `Turnuva ${nextRound}. tura geçti`,
        });
      }
    };

    advanceRoundIfNeeded();

    // Set up real-time listener for match updates
    const channel = supabase
      .channel(`tournament-round-advance-${tournament.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => {
        advanceRoundIfNeeded();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament, onRoundAdvanced, toast]);

  const createMatchesForRound = async (tournamentId: string, round: number) => {
    try {
      // Get winners from previous round
      const { data: winners } = await supabase
        .from('tournament_matches')
        .select('winner_id')
        .eq('tournament_id', tournamentId)
        .eq('round', round - 1)
        .order('match_number');

      if (!winners || winners.length === 0) {
        throw new Error('No winners found for previous round');
      }

      const winnerIds = winners.map(w => w.winner_id).filter(Boolean);
      
      let matches = [];
      
      if (round === 2) {
        // Semi-finals: 2 matches
        matches = [
          {
            tournament_id: tournamentId,
            round: 2,
            match_number: 1,
            player1_id: winnerIds[0],
            player2_id: winnerIds[1],
            status: 'pending'
          },
          {
            tournament_id: tournamentId,
            round: 2,
            match_number: 2,
            player1_id: winnerIds[2],
            player2_id: winnerIds[3],
            status: 'pending'
          }
        ];
      } else if (round === 3) {
        // Final: 1 match
        matches = [
          {
            tournament_id: tournamentId,
            round: 3,
            match_number: 1,
            player1_id: winnerIds[0],
            player2_id: winnerIds[1],
            status: 'pending'
          }
        ];
      }

      if (matches.length > 0) {
        const { error } = await supabase
          .from('tournament_matches')
          .insert(matches);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error creating matches for round:', error);
    }
  };

  return null;
};

export default TournamentRoundAdvance;
