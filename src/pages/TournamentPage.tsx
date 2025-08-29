import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [showTournamentView, setShowTournamentView] = useState(false);
  const mountedRef = useRef(false);

  // Hook'u hemen çağır
  const {
    currentTournament,
    userParticipation,
    createTournament,
    joinTournament,
    leaveTournament,
    refreshTournament,
    clearTournament
  } = useTournament();

  // Stabil callback fonksiyonları
  const handleClearTournament = useCallback(() => {
    if (mountedRef.current) {
      console.log('TournamentPage - clearing tournament data');
      clearTournament();
      setShowTournamentView(false);
    }
  }, [clearTournament]);

  // Aktif turnuvaları yükle - memoized
  const loadActiveTournaments = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select(`
          *,
          tournament_participants(user_id, is_bot)
        `)
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false });

      if (!error && data && mountedRef.current) {
        setActiveTournaments(data);
      }
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  }, []);

  // Mount/unmount tracking
  useEffect(() => {
    mountedRef.current = true;
    
    // İlk yükleme
    handleClearTournament();
    loadActiveTournaments();
    
    return () => {
      mountedRef.current = false;
    };
  }, [handleClearTournament, loadActiveTournaments]);

  // Periyodik güncelleme
  useEffect(() => {
    const interval = setInterval(() => {
      if (mountedRef.current && !showTournamentView) {
        loadActiveTournaments();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadActiveTournaments, showTournamentView]);

  const handleCreateTournament = async () => {
    if (!user || isJoining || !mountedRef.current) return;
    setIsJoining(true);
    
    try {
      console.log('🎮 Turnuva oluşturma/katılma işlemi başlatıldı');
      
      const { data: waitingTournaments } = await supabase
        .from('tournaments')
        .select('*, tournament_participants(user_id)')
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (waitingTournaments && waitingTournaments.length > 0) {
        const tournament = waitingTournaments[0];
        const participantCount = tournament.tournament_participants?.length || 0;
        
        console.log('📋 Bekleyen turnuva bulundu:', tournament.name, 'Katılımcı:', participantCount);
        
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
            console.log('⚠️ Kullanıcı zaten katılmış');
            await refreshTournament();
            if (mountedRef.current) {
              setShowTournamentView(true);
              toast({
                title: 'Zaten Katıldınız!',
                description: 'Bu turnuvaya zaten katılmışsınız.',
              });
            }
          } else {
            await joinTournament(tournament.id);
            if (mountedRef.current) {
              setShowTournamentView(true);
              toast({
                title: 'Turnuvaya Katıldınız!',
                description: `Bekleyen turnuvaya katıldınız (${participantCount + 1}/8)`,
              });
            }
          }
        }
      } else {
        console.log('🆕 Yeni turnuva oluşturuluyor');
        await createTournament();
        if (mountedRef.current) {
          setShowTournamentView(true);
          toast({
            title: 'Turnuva Oluşturuldu!',
            description: 'Diğer oyuncular bekleniyor (1/8)...',
          });
        }
      }
    } catch (error) {
      console.error('❌ Turnuva işlemi hatası:', error);
      if (mountedRef.current) {
        toast({
          title: 'Hata',
          description: 'Turnuva işlemi tamamlanamadı',
          variant: 'destructive',
        });
      }
    } finally {
      if (mountedRef.current) {
        setIsJoining(false);
      }
    }
  };

  const handleJoinExistingTournament = async (tournamentId: string) => {
    if (!user || isJoining || !mountedRef.current) return;
    setIsJoining(true);
    
    try {
      await joinTournament(tournamentId);
      if (mountedRef.current) {
        setShowTournamentView(true);
        toast({
          title: 'Turnuvaya Katıldınız!',
          description: 'Turnuvaya başarıyla katıldınız!',
        });
      }
    } catch (error) {
      console.error('Error joining tournament:', error);
      if (mountedRef.current) {
        toast({
          title: 'Hata',
          description: error instanceof Error ? error.message : 'Turnuvaya katılamadı',
          variant: 'destructive',
        });
      }
    } finally {
      if (mountedRef.current) {
        setIsJoining(false);
      }
    }
  };

  const handleLeaveTournament = async () => {
    try {
      await leaveTournament();
      if (mountedRef.current) {
        setShowTournamentView(false);
        await loadActiveTournaments();
        toast({
          title: 'Turnuvadan Ayrıldınız',
          description: 'Başarıyla turnuvadan ayrıldınız.',
        });
      }
    } catch (error) {
      console.error('Error leaving tournament:', error);
      if (mountedRef.current) {
        toast({
          title: 'Hata',
          description: 'Turnuvadan ayrılamadı',
          variant: 'destructive',
        });
      }
    }
  };

  // Turnuva view conditionally render
  if (showTournamentView && currentTournament && userParticipation) {
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

  // Ana turnuva listesi
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

        {/* Aktif turnuvalar */}
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
                          onClick={async () => {
                            await refreshTournament();
                            if (mountedRef.current) {
                              setShowTournamentView(true);
                            }
                          }}
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