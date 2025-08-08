import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import turnuvaGif from '@/assets/turnuvagif.gif';
import {
  ArrowLeft,
  Trophy,
  Users,
  Clock,
  Crown,
  Zap,
  Bot,
  User
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
}

interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  seed: number;
  is_bot: boolean;
  eliminated_at: string | null;
}

const TournamentPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTournaments, setActiveTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [waitingTime, setWaitingTime] = useState(60);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    loadActiveTournaments();
    // Set up interval to periodically clean up expired tournaments and reload list
    const interval = setInterval(() => {
      cleanupExpiredTournaments();
      loadActiveTournaments();
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentTournament && currentTournament.status === 'waiting') {
      // Calculate remaining time based on expires_at
      const updateTimer = () => {
        if (currentTournament.expires_at) {
          const expiresAt = new Date(currentTournament.expires_at).getTime();
          const now = new Date().getTime();
          const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
          
          if (remaining <= 0) {
            startTournamentWithBots();
            return;
          }
          
          setWaitingTime(remaining);
        }
      };

      updateTimer(); // Initial call
      const timer = setInterval(updateTimer, 1000);

      return () => clearInterval(timer);
    }
  }, [currentTournament]);

  const loadActiveTournaments = async () => {
    try {
      // First cleanup expired tournaments
      await cleanupExpiredTournaments();
      
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['waiting', 'active'])
        .gt('expires_at', new Date().toISOString()) // Only show non-expired tournaments
        .order('created_at', { ascending: false });

      if (!error && data) {
        setActiveTournaments(data);
      }
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  };

  const cleanupExpiredTournaments = async () => {
    try {
      const { error } = await supabase.rpc('cleanup_expired_tournaments');
      if (error) {
        console.error('Error cleaning up tournaments:', error);
      }
    } catch (error) {
      console.error('Error in cleanup function:', error);
    }
  };

  const createTournament = async () => {
    if (!user) return;

    try {
      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          name: `Turnuva ${new Date().toLocaleTimeString('tr-TR')}`,
          status: 'waiting',
          current_round: 1,
          max_participants: 8
        })
        .select()
        .single();

      if (error) throw error;

      // Join the tournament
      await joinTournament(tournament.id);
      
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast({
        title: 'Hata',
        description: 'Turnuva oluşturulamadı',
        variant: 'destructive',
      });
    }
  };

  const joinTournament = async (tournamentId: string) => {
    if (!user || isJoining) return;

    setIsJoining(true);

    try {
      // Check if already in tournament
      const { data: existingParticipant } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('user_id', user.id)
        .single();

      if (existingParticipant) {
        toast({
          title: 'Zaten Katıldınız',
          description: 'Bu turnuvaya zaten katılmışsınız.',
          variant: 'destructive',
        });
        setIsJoining(false);
        return;
      }

      // Get current participant count
      const { data: currentParticipants, error: countError } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId);

      if (countError) throw countError;

      const participantCount = currentParticipants?.length || 0;
      if (participantCount >= 8) {
        toast({
          title: 'Turnuva Dolu',
          description: 'Bu turnuva zaten dolu.',
          variant: 'destructive',
        });
        setIsJoining(false);
        return;
      }

      // Join tournament
      await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournamentId,
          user_id: user.id,
          seed: participantCount + 1,
          is_bot: false
        });

      // Load tournament details
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournament) {
        setCurrentTournament(tournament);
        loadTournamentParticipants(tournamentId);
        // Calculate initial waiting time from expires_at
        if (tournament.expires_at) {
          const expiresAt = new Date(tournament.expires_at).getTime();
          const now = new Date().getTime();
          const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
          setWaitingTime(remaining);
        }
      }

      toast({
        title: 'Turnuvaya Katıldınız!',
        description: 'Diğer oyuncular bekleniyor...',
      });

    } catch (error) {
      console.error('Error joining tournament:', error);
      toast({
        title: 'Hata',
        description: 'Turnuvaya katılamadı',
        variant: 'destructive',
      });
    }

    setIsJoining(false);
  };

  const loadTournamentParticipants = async (tournamentId: string) => {
    try {
      const { data, error } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('seed');

      if (!error && data) {
        setParticipants(data);
      }
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const startTournamentWithBots = async () => {
    if (!currentTournament) return;

    try {
      const participantCount = participants.length;
      const botsNeeded = 8 - participantCount;

      // Add bots if needed
      if (botsNeeded > 0) {
        const botInserts = [];
        for (let i = 0; i < botsNeeded; i++) {
          botInserts.push({
            tournament_id: currentTournament.id,
            user_id: null,
            seed: participantCount + i + 1,
            is_bot: true
          });
        }

        await supabase
          .from('tournament_participants')
          .insert(botInserts);
      }

      // Start tournament
      await supabase
        .from('tournaments')
        .update({
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', currentTournament.id);

      // Create first round matches
      await createTournamentMatches(currentTournament.id);

      toast({
        title: 'Turnuva Başladı!',
        description: 'İlk tur maçları oluşturuldu.',
      });

      // Navigate to first match
      navigate(`/tournament/${currentTournament.id}/match`);

    } catch (error) {
      console.error('Error starting tournament:', error);
      toast({
        title: 'Hata',
        description: 'Turnuva başlatılamadı',
        variant: 'destructive',
      });
    }
  };

  const createTournamentMatches = async (tournamentId: string) => {
    try {
      // Get all participants
      const { data: allParticipants } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('seed');

      if (!allParticipants || allParticipants.length !== 8) return;

      // Create 4 first round matches
      const matches = [];
      for (let i = 0; i < 4; i++) {
        const player1 = allParticipants[i * 2];
        const player2 = allParticipants[i * 2 + 1];

        matches.push({
          tournament_id: tournamentId,
          round: 1,
          match_number: i + 1,
          player1_id: player1.user_id,
          player2_id: player2.user_id,
          status: 'pending'
        });
      }

      await supabase
        .from('tournament_matches')
        .insert(matches);

    } catch (error) {
      console.error('Error creating matches:', error);
    }
  };

  const leaveTournament = async () => {
    if (!user || !currentTournament) return;

    try {
      await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', currentTournament.id)
        .eq('user_id', user.id);

      setCurrentTournament(null);
      setParticipants([]);
      loadActiveTournaments();

      toast({
        title: 'Turnuvadan Ayrıldınız',
        description: 'Başarıyla turnuvadan ayrıldınız.',
      });

    } catch (error) {
      console.error('Error leaving tournament:', error);
      toast({
        title: 'Hata',
        description: 'Turnuvadan ayrılamadı',
        variant: 'destructive',
      });
    }
  };

  if (currentTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={leaveTournament}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Ayrıl
            </Button>
            <h1 className="text-2xl font-bold">{currentTournament.name}</h1>
            <div className="w-16" />
          </div>

          {currentTournament.status === 'waiting' && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Turnuva Başlıyor
                </CardTitle>
                <CardDescription>
                  Diğer oyuncular bekleniyor veya botlarla başlatılacak
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{waitingTime}s</div>
                    <Progress value={currentTournament.expires_at ? 
                      Math.max(0, 100 - ((waitingTime / (currentTournament.timeout_duration || 300)) * 100)) : 0} 
                      className="mt-2" />
                  </div>
                  <div className="text-sm text-muted-foreground text-center">
                    {participants.length}/8 oyuncu katıldı
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Katılımcılar ({participants.length}/8)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {participants.map((participant, index) => (
                  <div key={participant.id} className="flex items-center space-x-2 p-2 rounded-lg bg-muted">
                    {participant.is_bot ? (
                      <Bot className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                    <span className="font-medium">
                      {participant.is_bot ? `Bot ${index + 1}` : `Oyuncu ${index + 1}`}
                    </span>
                    <Badge variant="outline" className="ml-auto">
                      #{participant.seed}
                    </Badge>
                  </div>
                ))}
                {Array.from({ length: 8 - participants.length }, (_, i) => (
                  <div key={`empty-${i}`} className="flex items-center space-x-2 p-2 rounded-lg border-2 border-dashed border-muted">
                    <div className="w-5 h-5 bg-muted rounded" />
                    <span className="text-muted-foreground">Bekleniyor...</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <h1 className="text-2xl font-bold flex items-center">
            <Trophy className="w-6 h-6 mr-2" />
            Turnuvalar
          </h1>
          <div className="w-16" />
        </div>

        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="w-5 h-5 mr-2" />
              Yeni Turnuva
            </CardTitle>
            <CardDescription>
              8 kişilik turnuva oluştur veya mevcut turnuvaya katıl
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center space-x-4">
            <div className="flex-1">
              <Button 
                onClick={createTournament} 
                className="w-full"
                disabled={isJoining}
              >
                <Trophy className="w-4 h-4 mr-2" />
                Yeni Turnuva Oluştur
              </Button>
            </div>
            <div className="w-20 h-20 rounded-lg overflow-hidden">
              <img 
                src={turnuvaGif} 
                alt="Turnuva" 
                className="w-full h-full object-cover"
              />
            </div>
          </CardContent>
        </Card>

        {activeTournaments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Aktif Turnuvalar</h2>
            {activeTournaments.map((tournament) => (
              <Card key={tournament.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{tournament.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {tournament.status === 'waiting' ? 
                          `Kalan süre: ${tournament.expires_at ? 
                            Math.max(0, Math.ceil((new Date(tournament.expires_at).getTime() - new Date().getTime()) / 1000 / 60)) 
                            : 0} dk` : 
                          `${tournament.current_round}. tur`}
                      </p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant={tournament.status === 'waiting' ? 'secondary' : 'default'}>
                          {tournament.status === 'waiting' ? 'Bekliyor' : 'Aktif'}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {tournament.max_participants} kişi
                        </span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => joinTournament(tournament.id)}
                      disabled={isJoining || tournament.status !== 'waiting'}
                    >
                      {tournament.status === 'waiting' ? 'Katıl' : 'Görüntüle'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default TournamentPage;