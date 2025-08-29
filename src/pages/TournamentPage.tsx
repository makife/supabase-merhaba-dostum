import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Trophy } from 'lucide-react';
import TournamentLobby from '@/components/tournament/TournamentLobby';
import TournamentBracket from '@/components/tournament/TournamentBracket';
import { useTournament } from '@/hooks/useTournament';

const TournamentPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTournaments, setActiveTournaments] = useState([]);
  const [isJoining, setIsJoining] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tournament'>('list');
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    currentTournament,
    userParticipation,
    createTournament,
    joinTournament,
    leaveTournament,
    refreshTournament,
    clearTournament
  } = useTournament();

  // Aktif turnuvaları yükle
  const loadActiveTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          tournament_participants(user_id, is_bot)
        `)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        setActiveTournaments(data);
      }
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  };

  // İlk yükleme - sadece bir kez
  useEffect(() => {
    if (!isInitialized) {
      console.log('TournamentPage initializing');
      setIsInitialized(true);
      setViewMode('list');
      loadActiveTournaments();
    }
  }, [isInitialized]);

  // Periyodik güncelleme - sadece liste modundayken
  useEffect(() => {
    if (viewMode !== 'list') return;
    
    const interval = setInterval(() => {
      loadActiveTournaments();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [viewMode]);

  const handleCreateTournament = async () => {
    if (!user || isJoining) return;
    
    setIsJoining(true);
    
    try {
      console.log('Turnuva oluşturma/katılma işlemi başlatıldı');
      
      // Bekleyen turnuva kontrolü
      const { data: waitingTournaments } = await supabase
        .from('tournaments')
        .select('*, tournament_participants(user_id)')
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (waitingTournaments && waitingTournaments.length > 0) {
        const tournament = waitingTournaments[0];
        const participantCount = tournament.tournament_participants?.length || 0;
        
        console.log('Bekleyen turnuva bulundu:', tournament.name, 'Katılımcı:', participantCount);
        
        if (participantCount >= 8) {
          toast({
            title: 'Turnuva Dolu',
            description: 'Bu turnuva dolu, yeni turnuva oluşturuluyor...',
          });
          await createTournament();
        } else {
          const isAlreadyParticipant = tournament.tournament_participants?.some(
            (p: any) => p.user_id === user.id
          );
          
          if (isAlreadyParticipant) {
            console.log('Kullanıcı zaten katılmış');
            await refreshTournament();
            setViewMode('tournament');
            
            toast({
              title: 'Zaten Katıldınız!',
              description: 'Bu turnuvaya zaten katılmışsınız.',
            });
          } else {
            await joinTournament(tournament.id);
            setViewMode('tournament');
            
            toast({
              title: 'Turnuvaya Katıldınız!',
              description: `Bekleyen turnuvaya katıldınız (${participantCount + 1}/8)`,
            });
          }
        }
      } else {
        console.log('Yeni turnuva oluşturuluyor');
        await createTournament();
        setViewMode('tournament');
        
        toast({
          title: 'Turnuva Oluşturuldu!',
          description: 'Diğer oyuncular bekleniyor (1/8)...',
        });
      }
    } catch (error) {
      console.error('Turnuva işlemi hatası:', error);
      toast({
        title: 'Hata',
        description: 'Turnuva işlemi tamamlanamadı',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinExistingTournament = async (tournamentId: string) => {
    if (!user || isJoining) return;
    setIsJoining(true);
    
    try {
      await joinTournament(tournamentId);
      setViewMode('tournament');
      
      toast({
        title: 'Turnuvaya Katıldınız!',
        description: 'Turnuvaya başarıyla katıldınız!',
      });
    } catch (error) {
      console.error('Error joining tournament:', error);
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'Turnuvaya katılamadı',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveTournament = async () => {
    try {
      await leaveTournament();
      setViewMode('list');
      await loadActiveTournaments();
      
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

  const handleGoToTournament = async () => {
    await refreshTournament();
    setViewMode('tournament');
  };

  // Turnuva görünümü
  if (viewMode === 'tournament' && currentTournament && userParticipation) {
    if (currentTournament.status === 'waiting') {
      return (
        <TournamentLobby 
          tournament={currentTournament}
          onLeave={handleLeaveTournament}
        />
      );
    } else if (currentTournament.status === 'active') {
      return (
        <TournamentBracket 
          tournament={currentTournament}
          userParticipation={userParticipation}
        />
      );
    }
  }

  // Ana liste görünümü
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ana Sayfa
          </Button>
          <h1 className="text-2xl font-bold flex items-center">
            <Trophy className="w-6 h-6 mr-2" />
            Turnuvalar
          </h1>
          <div className="w-16" />
        </div>

        {/* Ana turnuva kartı */}
        <Card className="border-primary relative overflow-hidden hover:shadow-xl transition-all duration-300">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20"></div>
            <div className="relative p-8 text-center space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <Trophy className="w-8 h-8 text-primary" />
                <h3 className="text-2xl font-bold">8 Kişilik Turnuva</h3>
              </div>
              <p className="text-muted-foreground">
                Bekleyen turnuvaya katıl veya yeni turnuva oluştur
              </p>
              <Button 
                onClick={handleCreateTournament}
                className="font-semibold px-6 py-3 bg-primary hover:bg-primary/90"
                disabled={isJoining}
              >
                <Trophy className="w-4 h-4 mr-2" />
                {isJoining ? 'İşleniyor...' : 'Turnuvaya Katıl'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Aktif turnuvalar listesi */}
        {activeTournaments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Mevcut Turnuvalar</h2>
            {activeTournaments.map((tournament: any) => {
              const participantCount = tournament.tournament_participants?.length || 0;
              const realPlayerCount = tournament.tournament_participants?.filter((p: any) => !p.is_bot).length || 0;
              const isUserParticipant = tournament.tournament_participants?.some(
                (p: any) => p.user_id === user?.id
              );
              
              return (
                <Card key={tournament.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">
                          {tournament.name}
                          {isUserParticipant && (
                            <span className="text-green-600 ml-2 text-sm">(Katıldınız)</span>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {tournament.status === 'waiting' ? 
                            `Bekliyor - ${realPlayerCount} gerçek oyuncu, toplam ${participantCount}/8` : 
                            `${tournament.current_round}. tur devam ediyor`}
                        </p>
                      </div>
                      {isUserParticipant ? (
                        <Button 
                          onClick={handleGoToTournament}
                          variant="outline"
                        >
                          Turnuvama Git
                        </Button>
                      ) : (
                        tournament.status === 'waiting' && participantCount < 8 && (
                          <Button 
                            onClick={() => handleJoinExistingTournament(tournament.id)}
                            disabled={isJoining}
                          >
                            Katıl
                          </Button>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {activeTournaments.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Henüz Aktif Turnuva Yok</h3>
              <p className="text-muted-foreground">
                İlk turnuvayı sen başlat!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TournamentPage;