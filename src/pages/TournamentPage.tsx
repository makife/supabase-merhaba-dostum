// TournamentPage.tsx - Eksik state'leri ve fonksiyonları ekle

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
  
  // Local state for current tournament (fallback if hook doesn't provide it)
  const [localTournament, setLocalTournament] = useState<any>(null);
  
  const {
    currentTournament,
    userParticipation,
    createTournament,
    joinTournament,
    leaveTournament
  } = useTournament();

  // Use currentTournament from hook, fallback to local state
  const tournament = currentTournament || localTournament;

  // Load tournament data function
  const loadTournamentData = async () => {
    if (!tournament?.id) return;
    
    try {
      const { data: updatedTournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournament.id)
        .single();
        
      if (updatedTournament) {
        setLocalTournament(updatedTournament);
      }
    } catch (error) {
      console.error('Error loading tournament data:', error);
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!tournament?.id) return;

    console.log('Setting up tournament real-time subscriptions');

    // Tournament durumu değişikliklerini dinle
    const tournamentChannel = supabase
      .channel(`tournament-${tournament.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournament.id}`
      }, (payload) => {
        console.log('Tournament updated:', payload);
        if (payload.new) {
          setLocalTournament(payload.new);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public', 
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournament.id}`
      }, (payload) => {
        console.log('Tournament match updated:', payload);
        loadTournamentData();
      })
      .subscribe();

    // Auto-refresh timer (fallback)
    const refreshInterval = setInterval(() => {
      loadTournamentData();
    }, 10000);

    return () => {
      console.log('Cleaning up tournament subscriptions');
      supabase.removeChannel(tournamentChannel);
      clearInterval(refreshInterval);
    };
  }, [tournament?.id]);

  // Aktif turnuvaları yükle
  const loadActiveTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['waiting', 'active'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        setActiveTournaments(data);
      }
    } catch (error) {
      console.error('Error loading tournaments:', error);
    }
  };

  const handleCreateTournament = async () => {
    if (!user || isJoining) return;
    setIsJoining(true);
    
    try {
      // Önce bekleyen turnuva var mı kontrol et
      const { data: waitingTournaments } = await supabase
        .from('tournaments')
        .select('*')
        .eq('status', 'waiting')
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (waitingTournaments && waitingTournaments.length > 0) {
        // Bekleyen turnuva var, ona katıl
        const tournament = waitingTournaments[0];
        
        // Zaten katılım kontrolü
        const { data: existingParticipation } = await supabase
          .from('tournament_participants')
          .select('id')
          .eq('tournament_id', tournament.id)
          .eq('user_id', user.id)
          .single();
        
        if (existingParticipation) {
          toast({
            title: 'Zaten Katıldınız!',
            description: 'Bu turnuvaya zaten katılmışsınız.',
            variant: 'destructive',
          });
          setIsJoining(false);
          return;
        }
        
        // Turnuvaya katıl
        await joinTournament(tournament.id);
        toast({
          title: 'Turnuvaya Katıldınız!',
          description: 'Bekleyen turnuvaya katıldınız...',
        });
      } else {
        // Bekleyen turnuva yok, yeni oluştur
        await createTournament();
        toast({
          title: 'Turnuva Oluşturuldu!',
          description: '30 saniye içinde turnuva başlayacak...',
        });
      }
    } catch (error) {
      console.error('Error handling tournament:', error);
      toast({
        title: 'Hata',
        description: 'Turnuva işlemi tamamlanamadı',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  const handleJoinTournament = async (tournamentId: string) => {
    if (!user || isJoining) return;
    setIsJoining(true);
    
    try {
      await joinTournament(tournamentId);
      toast({
        title: 'Turnuvaya Katıldınız!',
        description: '30 saniye içinde turnuva başlayacak...',
      });
    } catch (error) {
      console.error('Error joining tournament:', error);
      toast({
        title: 'Hata',
        description: 'Turnuvaya katılamadı',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  // Match başlatma fonksiyonu
  const startMatch = async (match: any) => {
    if (!userParticipation || !user) return;
    
    // Kullanıcının bu maçta olduğunu kontrol et
    const isUserInMatch = match.player1_id === user.id || match.player2_id === user.id;
    
    if (!isUserInMatch) {
      toast({
        title: 'Hata',
        description: 'Bu maç size ait değil',
        variant: 'destructive',
      });
      return;
    }

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
      navigate(`/game/tournament?tournament=${tournament.id}&match=${match.id}&type=timed`);
      
    } catch (error) {
      console.error('Error starting match:', error);
      toast({
        title: 'Hata',
        description: 'Maç başlatılamadı',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadActiveTournaments();
    const interval = setInterval(loadActiveTournaments, 30000);
    return () => clearInterval(interval);
  }, []);

  // Tournament lobby veya bracket göster
  if (tournament && userParticipation) {
    if (tournament.status === 'waiting') {
      return (
        <TournamentLobby 
          tournament={tournament}
          onLeave={leaveTournament}
        />
      );
    } else if (tournament.status === 'active') {
      return (
        <TournamentBracket 
          tournament={tournament}
          userParticipation={userParticipation}
          onStartMatch={startMatch}
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
            Geri
          </Button>
          <h1 className="text-2xl font-bold flex items-center">
            <Trophy className="w-6 h-6 mr-2" />
            Süreli Turnuvalar
          </h1>
          <div className="w-16" />
        </div>

        {/* YENİ TURNUVA OLUŞTUR */}
        <Card className="border-primary relative overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20"></div>
            <div className="relative p-8 text-center space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <Trophy className="w-8 h-8 text-primary" />
                <h3 className="text-2xl font-bold">Yeni Süreli Turnuva</h3>
              </div>
              <p className="text-muted-foreground">8 kişilik süreli turnuva oluştur</p>
              <Button 
                onClick={handleCreateTournament}
                className="font-semibold px-6 py-3"
                disabled={isJoining}
              >
                <Trophy className="w-4 h-4 mr-2" />
                {isJoining ? 'Oluşturuluyor...' : 'Yeni Turnuva Oluştur'}
              </Button>
            </div>
          </div>
        </Card>

        {/* AKTİF TURNUVALAR */}
        {activeTournaments.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Aktif Turnuvalar</h2>
            {activeTournaments.map((tournament: any) => (
              <Card key={tournament.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{tournament.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {tournament.status === 'waiting' ? 
                          `Kalan süre: ${tournament.expires_at ? 
                            Math.max(0, Math.ceil((new Date(tournament.expires_at).getTime() - new Date().getTime()) / 1000)) 
                            : 0}s` : 
                          `${tournament.current_round}. tur devam ediyor`}
                      </p>
                    </div>
                    <Button 
                      onClick={() => {
                        if (tournament.status === 'waiting') {
                          handleJoinTournament(tournament.id);
                        } else {
                          navigate(`/tournament`);
                        }
                      }}
                      disabled={isJoining}
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