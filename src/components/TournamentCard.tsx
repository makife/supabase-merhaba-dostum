import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Clock, Swords, Ban } from 'lucide-react';
import { Tournament } from '@/types/tournament';
import { supabase } from '@/integrations/supabase/client';


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
  const [participantCount, setParticipantCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Fetch real participant count
  useEffect(() => {
    const fetchParticipants = async () => {
      const { count } = await supabase
        .from('tournament_participants')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id);
      
      setParticipantCount(count || 0);
    };

    fetchParticipants();
  }, [tournament.id]);

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

  const isDisabled = disabled || participantCount >= 8 || timeRemaining === 0 || hasLeft;
  
  const getButtonContent = () => {
    if (hasLeft) {
      return (
        <>
          <Ban className="w-4 h-4 mr-2" />
          Ayrıldın
        </>
      );
    }
    if (participantCount >= 8) {
      return 'Dolu';
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