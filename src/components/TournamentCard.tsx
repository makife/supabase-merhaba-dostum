import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Clock, Swords } from 'lucide-react';
import { Tournament } from '@/types/tournament';

interface TournamentCardProps {
  tournament: Tournament;
  participantCount: number;
  onJoin: (tournamentId: string) => void;
  disabled?: boolean;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  participantCount,
  onJoin,
  disabled = false
}) => {
  const timeRemaining = tournament.expires_at 
    ? Math.max(0, Math.floor((new Date(tournament.expires_at).getTime() - Date.now()) / 1000))
    : 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-1">{tournament.name}</h3>
              
              <div className="flex items-center space-x-4 text-sm text-gray-300">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  <span>{participantCount}/8</span>
                </div>
                
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{formatTime(timeRemaining)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={() => onJoin(tournament.id)}
            disabled={disabled || participantCount >= 8 || timeRemaining === 0}
            className="bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
            size="sm"
          >
            <Swords className="w-4 h-4 mr-2" />
            {participantCount >= 8 ? 'Dolu' : 'Katıl'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};