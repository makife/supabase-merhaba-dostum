import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Swords, Ban } from 'lucide-react';
import { Tournament } from '@/types/tournament';


interface TournamentCardProps {
  tournament: Tournament;
  onJoin: (tournamentId: string) => void;
  disabled?: boolean;
  hasLeft?: boolean; // Kullanıcı bu turnuvadan ayrılmış mı?
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  onJoin,
  disabled = false,
  hasLeft = false
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Calculate time remaining
  useEffect(() => {
    if (!tournament.expires_at) {
      setTimeRemaining(0);
      return;
    }

    const expiresAt = new Date(tournament.expires_at).getTime();
    
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeRemaining(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tournament.expires_at]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isDisabled = disabled || timeRemaining === 0 || hasLeft;
  
  const getButtonContent = () => {
    if (hasLeft) {
      return (
        <>
          <Ban className="w-4 h-4 mr-2" />
          Ayrıldın
        </>
      );
    }
    return (
      <>
        <Swords className="w-4 h-4 mr-2" />
        Katıl
      </>
    );
  };

  return (
    <Card className={`bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all ${hasLeft ? 'opacity-60' : ''}`}>
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
                  <Clock className="w-4 h-4 mr-1" />
                  <span>{formatTime(timeRemaining)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={() => onJoin(tournament.id)}
            disabled={isDisabled}
            className={`${hasLeft ? 'bg-gray-500' : 'bg-green-500 hover:bg-green-600'} text-white disabled:opacity-50`}
            size="sm"
          >
            {getButtonContent()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};