import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import GamePage from '@/pages/GamePage';

const TournamentMatchPage = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [match, setMatch] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [gameRoom, setGameRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (matchId) {
      loadMatch();
    }
  }, [matchId]);

  useEffect(() => {
    if (countdown > 0 && !gameStarted) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !gameStarted) {
      startMatch();
    }
  }, [countdown, gameStarted]);

  const loadMatch = async () => {
    try {
      const { data: matchData, error } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          tournaments(*)
        `)
        .eq('id', matchId)
        .single();

      if (error) throw error;

      setMatch(matchData);
      setTournament(matchData.tournaments);
      
      // Eğer maç zaten oyun odası oluşturmuşsa, o odaya yönlendir
      if (matchData.room_id) {
        setGameRoom({ id: matchData.room_id });
        setGameStarted(true);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading match:', error);
      toast({
        title: 'Hata',
        description: 'Maç bilgileri yüklenemedi',
        variant: 'destructive',
      });
      navigate('/tournament');
    }
  };

  const startMatch = async () => {
    try {
      // Oyun odası oluştur
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .insert({
          host_id: user?.id,
          game_mode: 'timed',
          game_type_new: 'timed',
          time_limit: 120, // 2 dakika
          max_players: 2,
          status: 'active',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Maçı güncelle
      await supabase
        .from('tournament_matches')
        .update({ 
          room_id: room.id,
          status: 'active'
        })
        .eq('id', matchId);

      setGameRoom(room);
      setGameStarted(true);

      toast({
        title: '🚀 Maç Başladı!',
        description: '2 dakika süreniz var!',
      });
    } catch (error) {
      console.error('Error starting match:', error);
      toast({
        title: 'Hata',
        description: 'Maç başlatılamadı',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Maç yükleniyor...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameStarted && gameRoom) {
    return <GamePage gameMode="tournament" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {tournament?.name}
          </CardTitle>
          <div className="text-center text-sm text-muted-foreground">
            {match?.round === 1 && 'Çeyrek Final'}
            {match?.round === 2 && 'Yarı Final'}
            {match?.round === 3 && 'Final'}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-6xl font-bold text-primary mb-2">{countdown}</div>
            <div className="text-lg">saniye sonra maç başlayacak</div>
            <div className="text-sm text-muted-foreground mt-2">
              Hazır olun! 2 dakika süreniz olacak.
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-center font-semibold">Eşleşme</div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="text-center">
                <div className="font-medium">Oyuncu 1</div>
                <div className="text-sm text-muted-foreground">VS</div>
              </div>
              <div className="text-center">
                <div className="font-medium">Oyuncu 2</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentMatchPage;