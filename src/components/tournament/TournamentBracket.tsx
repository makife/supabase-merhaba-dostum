import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Trophy, Clock, Users, ArrowLeft } from 'lucide-react';
import TournamentAdvanceCard from './TournamentAdvanceCard';

interface TournamentBracketProps {
  tournament: any;
  userParticipation: any;
}

const TournamentBracket = ({ tournament, userParticipation }: TournamentBracketProps) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [countdown, setCountdown] = useState(10);
  const [userMatch, setUserMatch] = useState<any>(null);
  const [showAdvanceCard, setShowAdvanceCard] = useState(false);
  const [advanceCardData, setAdvanceCardData] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  // Maçları ve katılımcıları yükle
  const loadTournamentData = async () => {
    try {
      // Maçları yükle
      const { data: matchesData, error: matchesError } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournament.id)
        .eq('round', tournament.current_round)
        .order('match_number');

      if (!matchesError && matchesData) {
        setMatches(matchesData);
        
        // Kullanıcının maçını bul
        const currentUserMatch = matchesData.find(
          m => m.player1_id === user?.id || m.player2_id === user?.id
        );
        setUserMatch(currentUserMatch);
      }

      // Katılımcıları yükle
      const { data: participantsData, error: participantsError } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('tournament_id', tournament.id);

      if (!participantsError && participantsData) {
        setParticipants(participantsData);
      }
    } catch (error) {
      console.error('Error loading tournament data:', error);
    }
  };

  // Kullanıcının maçını başlat
  const startUserMatch = () => {
    if (userMatch) {
      navigate(`/tournament/match/${userMatch.id}`);
    }
  };

  // Geri sayım ve otomatik başlatma
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      startUserMatch();
    }
  }, [countdown]);

  // Real-time updates
  useEffect(() => {
    loadTournamentData();
    
    const matchesChannel = supabase
      .channel(`tournament-matches-${tournament.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournament.id}`
      }, () => {
        loadTournamentData();
      })
      .subscribe();

    const tournamentChannel = supabase
      .channel(`tournament-${tournament.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournament.id}`
      }, (payload) => {
        const updatedTournament = payload.new;
        
        // Tur değiştiğinde ilerleme kartını göster
        if (updatedTournament.current_round !== tournament.current_round) {
          const roundNames = {
            2: 'yarı finale',
            3: 'finale'
          };
          
          setAdvanceCardData({
            nextRound: roundNames[updatedTournament.current_round as keyof typeof roundNames] || 'bir sonraki tura',
            currentRound: updatedTournament.current_round
          });
          setShowAdvanceCard(true);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(matchesChannel);
      supabase.removeChannel(tournamentChannel);
    };
  }, [tournament.id]);

  const getParticipantName = (userId: string) => {
    const participant = participants.find(p => p.user_id === userId);
    if (participant?.is_bot) {
      return `Bot ${participant.seed}`;
    }
    return participant?.profiles?.username || 'Oyuncu';
  };

  const getRoundName = (round: number) => {
    switch (round) {
      case 1: return 'Çeyrek Final';
      case 2: return 'Yarı Final';
      case 3: return 'Final';
      default: return `${round}. Tur`;
    }
  };

  if (showAdvanceCard) {
    return (
      <TournamentAdvanceCard
        nextRound={advanceCardData.nextRound}
        onContinue={() => {
          setShowAdvanceCard(false);
          setCountdown(10); // Yeni tur için geri sayım
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/tournament')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Turnuvalar
          </Button>
          <h1 className="text-2xl font-bold flex items-center">
            <Trophy className="w-6 h-6 mr-2" />
            {tournament.name}
          </h1>
          <Badge variant="default">
            {getRoundName(tournament.current_round)}
          </Badge>
        </div>

        {/* Geri sayım kartı */}
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center justify-center">
              <Clock className="w-5 h-5 mr-2" />
              {getRoundName(tournament.current_round)} Başlıyor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <div className="text-4xl font-bold text-primary">{countdown}</div>
              <div className="text-lg">saniye sonra maçınız başlayacak</div>
              <div className="text-sm text-muted-foreground">
                2 dakika süreniz olacak
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Maç eşleşmeleri */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              {getRoundName(tournament.current_round)} Eşleşmeleri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {matches.map((match, index) => (
                <div 
                  key={match.id} 
                  className={`p-4 rounded-lg border-2 ${
                    match.player1_id === user?.id || match.player2_id === user?.id
                      ? 'border-primary bg-primary/5'
                      : 'border-muted bg-muted/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <div className="font-medium">
                        {getParticipantName(match.player1_id)}
                      </div>
                    </div>
                    <div className="mx-4 text-2xl font-bold text-muted-foreground">
                      VS
                    </div>
                    <div className="text-center flex-1">
                      <div className="font-medium">
                        {getParticipantName(match.player2_id)}
                      </div>
                    </div>
                  </div>
                  <div className="text-center mt-2">
                    <Badge variant="outline">
                      Maç {index + 1}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TournamentBracket;