import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import TournamentBracket from './TournamentBracket';
import GamePage from './GamePage';
import { 
  ArrowLeft, 
  Trophy, 
  Users, 
  Clock, 
  Play
} from 'lucide-react';

interface Tournament {
  id: string;
  name: string;
  status: string;
  current_round: number;
  max_participants: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  expires_at: string | null;
  timeout_duration: number;
  game_type: string; // Database'den string gelir, cast edilecek
}

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score?: number; // Optional çünkü database'de olmayabilir
  player2_score?: number; // Optional çünkü database'de olmayabilir
  winner_id: string | null;
  status: string; // Database'den string gelir
  created_at: string;
  updated_at?: string; // Optional çünkü database'de olmayabilir
  room_id?: string; // Database'de varsa
}

interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string | null;
  seed: number;
  is_bot: boolean;
  eliminated_at: string | null;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

const TournamentMatchPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  // Turnuva verilerini yükle
  const loadTournamentData = async () => {
    if (!tournamentId) return;

    try {
      // Turnuva bilgilerini getir
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournamentError) throw tournamentError;
      
      // Type casting ile game_type'ı düzelt
      const processedTournament = {
        ...tournamentData,
        game_type: (tournamentData.game_type === 'score' ? 'score' : 'timed') as 'timed' | 'score'
      };
      setTournament(processedTournament);

      // Maçları getir
      const { data: matchesData, error: matchesError } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round')
        .order('match_number');

      if (matchesError) throw matchesError;
      
      // Matches için default değerler ekle
      const processedMatches = (matchesData || []).map(match => ({
        ...match,
        player1_score: match.player1_score || 0,
        player2_score: match.player2_score || 0,
        updated_at: match.updated_at || match.created_at,
        status: match.status as 'pending' | 'active' | 'completed'
      }));
      setMatches(processedMatches);

      // Katılımcıları getir
      const { data: participantsData, error: participantsError } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('tournament_id', tournamentId)
        .order('seed');

      if (participantsError) throw participantsError;
      setParticipants(participantsData || []);

      // Kullanıcının aktif maçını bul
      if (user && processedMatches) {
        const userActiveMatch = processedMatches.find(match => 
          (match.player1_id === user.id || match.player2_id === user.id) && 
          match.status === 'active'
        );
        setCurrentMatch(userActiveMatch || null);
      }

    } catch (error) {
      console.error('Error loading tournament data:', error);
      toast({
        title: 'Hata',
        description: 'Turnuva verileri yüklenirken hata oluştu',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId, user]);

  // Real-time güncellemeler için subscription
  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        loadTournamentData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournamentId}`
      }, () => {
        loadTournamentData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  // Maça başlama fonksiyonu
  const startMatch = async (matchId: string) => {
    try {
      // Maçı aktif duruma getir
      const { error } = await supabase
        .from('tournament_matches')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId);

      if (error) throw error;

      setIsPlaying(true);
      
      toast({
        title: '🎮 Maç Başladı!',
        description: 'Turnuva maçı başlatıldı',
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

  // Maçı bitirme ve sonraki tura geçme fonksiyonu
  const completeMatch = async (winnerId: string, player1Score: number, player2Score: number) => {
    if (!currentMatch) return;

    try {
      // Önce maçı tamamla
      const { error: updateError } = await supabase
        .from('tournament_matches')
        .update({
          status: 'completed',
          winner_id: winnerId,
          player1_score: player1Score,
          player2_score: player2Score,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentMatch.id);

      if (updateError) throw updateError;

      // Kaybedeni eleme
      const loserId = winnerId === currentMatch.player1_id ? currentMatch.player2_id : currentMatch.player1_id;
      if (loserId) {
        await supabase
          .from('tournament_participants')
          .update({ eliminated_at: new Date().toISOString() })
          .eq('user_id', loserId)
          .eq('tournament_id', tournamentId);
      }

      setIsPlaying(false);
      setCurrentMatch(null);

      toast({
        title: '🏆 Maç Tamamlandı!',
        description: 'Sonraki tur kontrol ediliyor...',
      });

      // Verileri yeniden yükle
      loadTournamentData();

    } catch (error) {
      console.error('Error completing match:', error);
      toast({
        title: 'Hata',
        description: 'Maç tamamlanamadı',
        variant: 'destructive',
      });
    }
  };

  // Kullanıcının sıradaki maçını bul
  const getUserNextMatch = () => {
    if (!user) return null;
    return matches.find(match => 
      (match.player1_id === user.id || match.player2_id === user.id) && 
      match.status === 'pending'
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-4xl mx-auto text-center py-8">
          <h2 className="text-2xl font-bold mb-4">Turnuva Bulunamadı</h2>
          <Button onClick={() => navigate('/tournaments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Turnuvalara Dön
          </Button>
        </div>
      </div>
    );
  }

  // Oyun modunda ise GamePage'i göster
  if (isPlaying && currentMatch) {
    return (
      <GamePage 
        gameMode="tournament"
        onGameComplete={completeMatch}
        tournamentMatch={currentMatch}
        gameType={(tournament.game_type as string) === 'score' ? 'score' : 'timed'}
      />
    );
  }

  const userNextMatch = getUserNextMatch();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/tournaments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Turnuvalara Dön
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <div className="flex items-center justify-center space-x-4 mt-2">
              <Badge variant={tournament.status === 'active' ? 'default' : 'secondary'}>
                {tournament.status === 'active' ? '🎮 Aktif' : 
                 tournament.status === 'finished' ? '🏆 Bitti' : '⏳ Bekliyor'}
              </Badge>
              <Badge variant="outline">
                {(tournament.game_type as string) === 'timed' ? '⏱️ Süreli' : '🎯 Puanlı'}
              </Badge>
              <Badge variant="outline">
                🏆 {tournament.current_round === 1 ? 'Çeyrek Final' : 
                    tournament.current_round === 2 ? 'Yarı Final' : 
                    tournament.current_round === 3 ? 'Final' : `${tournament.current_round}. Tur`}
              </Badge>
            </div>
          </div>
          <div className="w-16" />
        </div>

        {/* Kullanıcının Durumu */}
        {user && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Sizin Durumunuz
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentMatch ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <Badge variant="default" className="text-lg px-4 py-2">
                      🎮 Aktif Maçınız Var!
                    </Badge>
                  </div>
                  <div className="flex justify-center">
                    <Button 
                      onClick={() => startMatch(currentMatch.id)}
                      className="px-8 py-3"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Maça Devam Et
                    </Button>
                  </div>
                </div>
              ) : userNextMatch ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <Badge variant="secondary" className="text-lg px-4 py-2">
                      ⏳ Sıradaki Maçınız Hazır
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      {userNextMatch.round === 2 ? 'Yarı Final' : 
                       userNextMatch.round === 3 ? 'Final' : 'Çeyrek Final'} - 
                      Maç {userNextMatch.match_number}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <Button 
                      onClick={() => startMatch(userNextMatch.id)}
                      className="px-8 py-3"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Maçı Başlat
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    👀 Turnuvayı İzliyorsunuz
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-2">
                    Elendikten sonra turnuvayı takip edebilirsiniz
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Turnuva Ağacı */}
        <TournamentBracket 
          matches={matches}
          participants={participants}
          currentUserId={user?.id}
        />

        {/* Turnuva İstatistikleri */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-primary mb-2">
                {participants.filter(p => !p.eliminated_at).length}
              </div>
              <div className="text-sm text-muted-foreground">Kalan Oyuncu</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-orange-500 mb-2">
                {matches.filter(m => m.status === 'completed').length}
              </div>
              <div className="text-sm text-muted-foreground">Tamamlanan Maç</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-500 mb-2">
                {tournament.current_round}
              </div>
              <div className="text-sm text-muted-foreground">Mevcut Tur</div>
            </CardContent>
          </Card>
        </div>

        {/* Turnuva Geçmişi */}
        {matches.filter(m => m.status === 'completed').length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Tamamlanan Maçlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {matches
                  .filter(m => m.status === 'completed')
                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                  .slice(0, 5)
                  .map((match) => {
                    const player1 = participants.find(p => p.user_id === match.player1_id);
                    const player2 = participants.find(p => p.user_id === match.player2_id);
                    const winner = participants.find(p => p.user_id === match.winner_id);
                    
                    return (
                      <div key={match.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Badge variant="secondary" className="text-xs">
                            {match.round === 1 ? 'ÇF' : match.round === 2 ? 'YF' : 'F'} {match.match_number}
                          </Badge>
                          <span className="text-sm">
                            {player1?.profiles?.username || `Oyuncu ${player1?.seed}`} vs{' '}
                            {player2?.profiles?.username || `Oyuncu ${player2?.seed}`}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-mono">
                            {match.player1_score || 0}-{match.player2_score || 0}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            🏆 {winner?.profiles?.username || `Oyuncu ${winner?.seed}`}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TournamentMatchPage;