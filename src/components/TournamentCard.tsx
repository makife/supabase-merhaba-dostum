import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Swords, Ban } from 'lucide-react';
import { Tournament } from '@/types/tournament';
import { useServerTimeContext } from '@/contexts/ServerTimeContext';


interface TournamentCardProps {
  tournament: Tournament;
  onJoin: (tournamentId: string) => void;
  disabled?: boolean;
  hasLeft?: boolean; // Kullanıcı bu turnuvadan ayrılmış mı?
  onExpired?: (tournamentId: string) => void;
}

export const TournamentCard: React.FC<TournamentCardProps> = ({
  tournament,
  onJoin,
  disabled = false,
  hasLeft = false,
  onExpired,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(0);
  const { serverNow } = useServerTimeContext();

  // Calculate time remaining
  useEffect(() => {
    if (!tournament.expires_at) {
      setTimeRemaining(0);
      return;
    }

    const expiresAt = new Date(tournament.expires_at).getTime();
    
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - serverNow()) / 1000));
      setTimeRemaining(remaining);
      if (remaining === 0) onExpired?.(tournament.id);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [onExpired, serverNow, tournament.expires_at, tournament.id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isPrivate = Boolean((tournament as any).is_private);
  const isDisabled = disabled || isPrivate || timeRemaining === 0 || hasLeft;
  
  const getButtonContent = () => {
    if (isPrivate) {
      return "Özel";
    }
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
    <Card className={`bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-all ${hasLeft || isPrivate ? 'opacity-70' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
              {tournament.avatar_url ? (
                <img src={tournament.avatar_url} alt="" className="w-12 h-12 object-contain" />
              ) : (
                <Trophy className="w-6 h-6 text-amber-400" />
              )}
            </div>
            
            <div>
              <h3 className="font-bold text-white mb-1">{tournament.name}</h3>
              
              <div className="flex items-center space-x-4 text-sm text-gray-300">
                {!isPrivate && (
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    <span>{formatTime(timeRemaining)}</span>
                  </div>
                )}
                {isPrivate && (
                  <span className="text-xs text-red-200/90">Davetli oyuncular</span>
                )}
              </div>
            </div>
          </div>
          
          <Button 
            onClick={() => !isPrivate && onJoin(tournament.id)}
            disabled={isDisabled}
            className={`${
              isPrivate
                ? 'bg-red-600 hover:bg-red-600 text-white !opacity-100 cursor-not-allowed'
                : hasLeft
                  ? 'bg-gray-500 text-white disabled:opacity-50'
                  : 'bg-green-500 hover:bg-green-600 text-white disabled:opacity-50'
            }`}
            size="sm"
          >
            {getButtonContent()}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};