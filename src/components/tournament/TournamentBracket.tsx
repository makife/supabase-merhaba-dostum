import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Trophy, User, Bot, Play, Clock, CheckCircle } from 'lucide-react';

interface TournamentBracketProps {
  tournament: any;
  userParticipation: any;
  onBackToList?: () => void;
}

const TournamentBracket = ({ tournament, userParticipation }: TournamentBracketProps) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Maçları ve katılımcıları yükle
  const loadTournamentData = async () => {
    try {
      // Maçları yükle
      const { data: matchData } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('round')
        .order('match_number');

      // Katılımcıları yükle
      const { data: participantData } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('tournament_id', tournament.id)
        .order('seed');

      if (matchData) setMatches(matchData);
      if (participantData) setParticipants(participantData);
      
    } catch (error) {
      console.error('Error loading tournament data:', error);
    }
  };

  // Katılımcı bilgisini al
const getParticipantInfo = (userId: string | null) => {
  if (!userId) {
    // user_id null = Bot
    const participant = participants.find(p => p.user_id === null);
    const seed = participant?.seed || Math.floor(Math.random() * 8) + 1;
    return { 
      name: `Bot ${seed}`, 
      isBot: true, 
      avatar: null 
    };
  }
  
  const participant = participants.find(p => p.user_id === userId);
  if (!participant) return { name: 'Bilinmiyor', isBot: false, avatar: null };
  
  if (participant.is_bot) {
    return { 
      name: `Bot ${participant.seed}`, 
      isBot: true, 
      avatar: null 
    };
  }
  
  return {
    name: participant.profiles?.username || `Oyuncu ${participant.seed}`,
    isBot: false,
    avatar: participant.profiles?.avatar_url
  };
};

  // Maça başla
  const startMatch = async (match: any) => {
    if (!user || loading) return;
    
    // Kullanıcının bu maçta olduğunu kontrol et
    const isUserInMatch = match.player1_id === user.id || match.player2_id === user.id;
    
    if (!isUserInMatch) {
      toast({
        title: 'Bu Maç Size Ait Değil',
        description: 'Bu maçta oynamıyorsunuz.',
        variant: 'destructive',
      });
      return;
    }

    if (match.status !== 'pending') {
      toast({
        title: 'Maç Zaten Başladı',
        description: 'Bu maç zaten başlamış veya tamamlanmış.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      // Maçı aktif olarak işaretle
      const { error } = await supabase
        .from('tournament_matches')
        .update({ 
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', match.id);

      if (error) throw error;

      // GamePage'e yönlendir
      navigate(`/game?gameMode=tournament&tournament=${tournament.id}&match=${match.id}&type=timed`);
      
    } catch (error) {
      console.error('Error starting match:', error);
      toast({
        title: 'Hata',
        description: 'Maç başlatılamadı',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Round adını al
  const getRoundName = (round: number) => {
    switch (round) {
      case 1: return 'Çeyrek Final';
      case 2: return 'Yarı Final';
      case 3: return 'Final';
      default: return `${round}. Tur`;
    }
  };

  // Round'a göre maçları grupla
  const getMatchesByRound = (round: number) => {
    return matches.filter(m => m.round === round);
  };

  // Real-time updates
  useEffect(() => {
    loadTournamentData();
    
    const channel = supabase
      .channel(`tournament-bracket-${tournament.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => {
        loadTournamentData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournament.id]);

  // Match card component
  const MatchCard = ({ match }: { match: any }) => {
    const player1 = getParticipantInfo(match.player1_id);
    const player2 = getParticipantInfo(match.player2_id);
    const isUserMatch = match.player1_id === user?.id || match.player2_id === user?.id;
    
    return (
      <Card className={`${isUserMatch ? 'border-primary ring-2 ring-primary/20' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Maç {match.match_number}
            </CardTitle>
            <Badge variant={
              match.status === 'completed' ? 'default' :
              match.status === 'active' ? 'destructive' : 'secondary'
            }>
              {match.status === 'completed' ? 'Bitti' :
               match.status === 'active' ? 'Devam Ediyor' : 'Bekliyor'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Player 1 */}
          <div className={`flex items-center justify-between p-2 rounded ${
            match.winner_id === match.player1_id ? 'bg-green-100 border border-green-300' : 'bg-muted'
          }`}>
            <div className="flex items-center space-x-2">
              {player1.isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              <span className={`font-medium ${match.player1_id === user?.id ? 'text-primary' : ''}`}>
                {player1.name}
              </span>
              {match.winner_id === match.player1_id && <CheckCircle className="w-4 h-4 text-green-600" />}
            </div>
            <span className="font-bold">
              {match.player1_score !== null ? match.player1_score : '-'}
            </span>
          </div>
          
          {/* VS */}
          <div className="text-center text-sm text-muted-foreground">VS</div>
          
          {/* Player 2 */}
          <div className={`flex items-center justify-between p-2 rounded ${
            match.winner_id === match.player2_id ? 'bg-green-100 border border-green-300' : 'bg-muted'
          }`}>
            <div className="flex items-center space-x-2">
              {player2.isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              <span className={`font-medium ${match.player2_id === user?.id ? 'text-primary' : ''}`}>
                {player2.name}
              </span>
              {match.winner_id === match.player2_id && <CheckCircle className="w-4 h-4 text-green-600" />}
            </div>
            <span className="font-bold">
              {match.player2_score !== null ? match.player2_score : '-'}
            </span>
          </div>

          {/* Action button */}
          {isUserMatch && match.status === 'pending' && (
            <Button 
              onClick={() => startMatch(match)}
              disabled={loading}
              className="w-full"
            >
              <Play className="w-4 h-4 mr-2" />
              {loading ? 'Başlatılıyor...' : 'Maça Başla'}
            </Button>
          )}
          
          {isUserMatch && match.status === 'active' && (
            <Button 
              onClick={() => navigate(`/game/tournament?tournament=${tournament.id}&match=${match.id}&type=timed`)}
              variant="destructive"
              className="w-full"
            >
              <Clock className="w-4 h-4 mr-2" />
              Maça Devam Et
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
<Button 
  variant="outline" 
  size="sm" 
  onClick={() => {
    console.log('Turnuva Listesi butonuna tıklandı');
    if (onBackToList) {
      onBackToList(); // Parent'a state değiştirmesini söyle
    } else {
      navigate('/tournament');
    }
  }}
>
  <ArrowLeft className="w-4 h-4 mr-2" />
  Turnuva Listesi
</Button>
          <h1 className="text-2xl font-bold flex items-center">
            <Trophy className="w-6 h-6 mr-2" />
            {tournament.name}
          </h1>
          <div className="w-16" />
        </div>

        {/* Tournament Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Turnuva Durumu</h3>
                <p className="text-sm text-muted-foreground">
                  {getRoundName(tournament.current_round)} - {tournament.status === 'active' ? 'Devam Ediyor' : 'Tamamlandı'}
                </p>
              </div>
              <Badge variant={tournament.status === 'active' ? 'default' : 'secondary'}>
                {tournament.status === 'active' ? 'Aktif' : 'Bitti'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Bracket */}
        <div className="space-y-8">
          {[1, 2, 3].map(round => {
            const roundMatches = getMatchesByRound(round);
            if (roundMatches.length === 0) return null;
            
            return (
              <div key={round}>
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <Trophy className="w-5 h-5 mr-2" />
                  {getRoundName(round)}
                </h2>
                <div className={`grid gap-4 ${
                  round === 1 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
                  round === 2 ? 'grid-cols-1 md:grid-cols-2' :
                  'grid-cols-1'
                }`}>
                  {roundMatches.map(match => (
                    <MatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tournament Winner */}
        {tournament.status === 'completed' && tournament.winner_id && (
          <Card className="border-yellow-500 bg-yellow-50">
            <CardContent className="p-6 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-yellow-600" />
              <h2 className="text-2xl font-bold text-yellow-800 mb-2">
                Turnuva Şampiyonu!
              </h2>
              <p className="text-lg text-yellow-700">
                {getParticipantInfo(tournament.winner_id).name}
              </p>
            </CardContent>
          </Card>
        )}

        {matches.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Maçlar Hazırlanıyor</h3>
              <p className="text-muted-foreground">
                Turnuva maçları oluşturuluyor...
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TournamentBracket;