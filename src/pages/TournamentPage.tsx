import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import turnuvaGif from '@/assets/turnuvagif.gif';
import GameModeSelector from '@/components/GameModeSelector';
import {
  ArrowLeft,
  Trophy,
  Users,
  Clock,
  Crown,
  Zap,
  Bot,
  User,
  Target
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
  game_type: 'timed' | 'score';
}

interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  seed: number;
  is_bot: boolean;
  eliminated_at: string | null;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

const TournamentPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTournaments, setActiveTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [waitingTime, setWaitingTime] = useState(60);
  const [isJoining, setIsJoining] = useState(false);
  const [gameType, setGameType] = useState<'timed' | 'score'>('timed');
  const [showGameModeSelector, setShowGameModeSelector] = useState(false);
  
  // Get game type from navigation state if available
  useEffect(() => {
    const state = location.state as { gameType?: 'timed' | 'score' } | null;
    if (state?.gameType) {
      setGameType(state.gameType);
    }
  }, []);

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

// Real-time katılımcı güncellemeleri için subscription
useEffect(() => {
  if (!currentTournament?.id) return;

  console.log('🔗 Turnuva real-time dinlemeye başlıyor:', currentTournament.id);
  
  let channel: any = null;

  const setupSubscription = async () => {
    try {
      channel = supabase
        .channel(`tournament-participants-${currentTournament.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'tournament_participants',
          filter: `tournament_id=eq.${currentTournament.id}`
        }, (payload) => {
          console.log('📡 Katılımcı değişikliği:', payload);
          
          // Debounced update
          setTimeout(() => {
            loadTournamentParticipants(currentTournament.id);
          }, 200);
        })
        .subscribe((status) => {
          console.log('📡 Subscription durumu:', status);
        });

      // İlk yükleme
      await loadTournamentParticipants(currentTournament.id);
      
    } catch (error) {
      console.error('❌ Subscription kurulum hatası:', error);
    }
  };

  setupSubscription();

  return () => {
    if (channel) {
      console.log('🔌 Turnuva real-time dinlemesi kesildi');
      supabase.removeChannel(channel);
    }
  };
}, [currentTournament?.id]);

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
        setActiveTournaments(data as Tournament[]);
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

const createTournament = async (selectedGameType: 'timed' | 'score') => {
  if (!user) return;

  try {
    const { data: tournament, error } = await supabase
      .from('tournaments')
      .insert({
        name: `Turnuva ${new Date().toLocaleTimeString('tr-TR')}`,
        status: 'waiting',
        current_round: 1,
        max_participants: 8,
        game_type: selectedGameType
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
      const { data: existingParticipant } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('user_id', user.id)
        .maybeSingle();

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

      // Join tournament directly - no game type selection needed since tournament already has a type
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
        setCurrentTournament(tournament as Tournament);
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
    console.log('🔄 loadTournamentParticipants çağrıldı:', tournamentId);
    
    const { data, error } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .eq('tournament_id', tournamentId)
      .order('seed');

    console.log('📊 Katılımcı sorgusu sonucu:', {
      error,
      count: data?.length || 0,
      data: data?.map(p => ({
        id: p.id,
        seed: p.seed,
        username: p.profiles?.username,
        is_bot: p.is_bot,
        user_id: p.user_id
      }))
    });

    if (!error && data) {
      setParticipants(data);
      
      // Debug için: Tüm katılımcıları konsola yazdır
      data.forEach((participant, index) => {
        console.log(`👥 Katılımcı ${index + 1}:`, {
          id: participant.id,
          user_id: participant.user_id,
          username: participant.profiles?.username,
          is_bot: participant.is_bot,
          seed: participant.seed
        });
      });
    }
  } catch (error) {
    console.error('Error loading participants:', error);
  }
};

let isStarting = false; // Race condition önleyici

const startTournamentWithBots = async () => {
 if (!currentTournament || isStarting) return;
 
 isStarting = true;
 try {
   // ÖNCE TURNUVA DURUMUNU KONTROL ET
   const { data: tournamentCheck } = await supabase
     .from('tournaments')
     .select('status')
     .eq('id', currentTournament.id)
     .single();
   if (tournamentCheck?.status !== 'waiting') {
     console.log('⚠️ Turnuva zaten başlamış, detay sayfasına yönlendiriliyor...');
     navigate(`/tournament/${currentTournament.id}`);
     return;
   }
   console.log('🏁 Turnuva başlatılıyor:', currentTournament.id);
   
   // Önce turnuvayı active yap ki duplicate işlem olmasın
   await supabase
     .from('tournaments')
     .update({ status: 'active', started_at: new Date().toISOString() })
     .eq('id', currentTournament.id)
     .eq('status', 'waiting');
   
   // KATILIMCI KONTROLÜ
   const { data: allParticipants, error } = await supabase
     .from('tournament_participants')
     .select(`
       *,
       profiles:user_id (username, avatar_url)
     `)
     .eq('tournament_id', currentTournament.id)
     .order('seed');

   if (error) throw error;
   console.log('🔍 TÜM KATILIMCILAR:', allParticipants?.length);
   
   // GERÇEK OYUNCULAR - is_bot false ve user_id null olmayan
   const realPlayers = allParticipants?.filter(p => 
     p.user_id !== null && p.is_bot === false
   ) || [];
   
   console.log('👥 Gerçek oyuncu sayısı:', realPlayers.length);
   
   if (realPlayers.length < 1) {
     // Turnuvayı geri waiting durumuna çevir
     await supabase
       .from('tournaments')
       .update({ status: 'waiting' })
       .eq('id', currentTournament.id);
       
     toast({
       title: '⚠️ Yetersiz Katılımcı',
       description: 'Turnuva için en az 1 gerçek oyuncu gereklidir.',
       variant: 'destructive',
     });
     return;
   }
   
   // BOT EKLEME
   const currentTotal = allParticipants?.length || 0;
   const botsNeeded = 8 - currentTotal;
   
   if (botsNeeded > 0) {
     console.log('🤖 Bot ekleniyor:', botsNeeded);
     const botsToAdd = [];
     for (let i = 0; i < botsNeeded; i++) {
       botsToAdd.push({
         tournament_id: currentTournament.id,
         user_id: null,
         seed: currentTotal + i + 1,
         is_bot: true
       });
     }
     await supabase.from('tournament_participants').insert(botsToAdd);
     console.log('✅ Botlar eklendi');
   }
   
   // Bot eklendikten sonra TÜM katılımcıları al (gerçek + bot)
   const { data: allFinalParticipants } = await supabase
     .from('tournament_participants')
     .select(`
       *,
       profiles:user_id (username, avatar_url)
     `)
     .eq('tournament_id', currentTournament.id)
     .order('seed');
   
   // MAÇ OLUŞTURMA - TÜM katılımcıları gönder
   console.log('🎯 Maç oluşturma başlıyor...');
   await createTournamentMatches(currentTournament.id, allFinalParticipants || []);
   
   toast({
     title: '🏁 Turnuva Başladı!',
     description: `${realPlayers.length} gerçek oyuncu ile turnuva başladı.`,
     duration: 3000,
   });
   
   navigate(`/tournament/${currentTournament.id}`);
   
 } catch (error) {
   console.error('❌ Turnuva başlatma hatası:', error);
   
   // Hata durumunda turnuvayı geri waiting durumuna çevir
   if (currentTournament) {
     await supabase
       .from('tournaments')
       .update({ status: 'waiting' })
       .eq('id', currentTournament.id);
   }
   
   toast({
     title: 'Hata',
     description: typeof error === 'object' && error !== null && 'message' in error 
       ? (error as Error).message 
       : 'Turnuva başlatılamadı',
     variant: 'destructive',
   });
 } finally {
   isStarting = false;
 }
};

// 🔧 Bu fonksiyonu TournamentPage component'inin içine ekleyin (diğer fonksiyonların yanına)
const createTournamentMatches = async (tournamentId: string, realParticipants: any[]) => {
  try {
    console.log('🏟️ Manuel maç oluşturma başlıyor:', tournamentId);
    console.log('👥 Gelen katılımcılar:', realParticipants.length);

    const participants = realParticipants;
    console.log('✅ Katılımcılar:', participants.length);

    if (participants.length < 1) {
      throw new Error('En az 1 gerçek oyuncu bulunmalı');
    }

    const shuffledParticipants = [...participants].sort(() => Math.random() - 0.5);
    const matches = [];

    // 4 maç oluştur (çeyrek final)
    for (let i = 0; i < 4; i++) {
      let player1_id = null;
      let player2_id = null;

      // Gerçek oyuncuları sırayla yerleştir
      if (i * 2 < shuffledParticipants.length) {
        // ✅ user_id'yi kontrol et
        const p1 = shuffledParticipants[i * 2];
        player1_id = p1?.user_id || null;
        console.log(`🔍 Player 1 for match ${i+1}:`, {
          participant: p1,
          user_id: player1_id,
          is_bot: p1?.is_bot
        });
      }
      
      if (i * 2 + 1 < shuffledParticipants.length) {
        // ✅ user_id'yi kontrol et
        const p2 = shuffledParticipants[i * 2 + 1];
        player2_id = p2?.user_id || null;
        console.log(`🔍 Player 2 for match ${i+1}:`, {
          participant: p2,
          user_id: player2_id,
          is_bot: p2?.is_bot
        });
      }

      const match = {
        tournament_id: tournamentId,
        round: 1,
        match_number: i + 1,
        player1_id,
        player2_id,
        status: 'pending'
      };

      matches.push(match);
      console.log(`🥊 Maç ${i + 1}: ${player1_id ? '👤 ' + player1_id.slice(-8) : '🤖 Bot'} vs ${player2_id ? '👤 ' + player2_id.slice(-8) : '🤖 Bot'}`);
    }

    // Database'e kaydet
    const { data, error } = await supabase
      .from('tournament_matches')
      .insert(matches)
      .select();

    if (error) {
      console.error('❌ Maç kaydetme hatası:', error);
      throw error;
    }

    console.log('✅ Maçlar başarıyla oluşturuldu:', data?.length);
    return data;

  } catch (error) {
    console.error('❌ createTournamentMatches hatası:', error);
    throw error;
  }
};

  // Bu fonksiyon artık kullanılmıyor, Supabase fonksiyonu kullanıyoruz
  // const createTournamentMatches = async (tournamentId: string) => {
  //   // Artık start_tournament_automatically fonksiyonu içinde yapılıyor
  // };

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
                  {currentTournament.status === 'waiting' ? 
                    'Diğer oyuncular bekleniyor' : 
                    'Turnuva başladı!'
                  }
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
    <CardDescription>
      {participants.length >= 2 ? `${participants.length} oyuncu katıldı` : 'Diğer oyuncular bekleniyor'}
    </CardDescription>
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
            {participant.is_bot ? 
              `Bot ${index + 1}` : 
              (participant.profiles?.username || `Oyuncu ${participant.seed}`)
            }
            {!participant.is_bot && participant.user_id === user?.id && ' (Siz)'}
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
    
    {/* Debug info for development */}
    {process.env.NODE_ENV === 'development' && (
      <div className="mt-4 p-2 bg-gray-100 rounded text-xs">
        <p>🔍 Debug: {participants.length} katılımcı</p>
        {participants.map((p, i) => (
          <p key={i}>
            {i+1}. {p.is_bot ? '🤖' : '👤'} {p.profiles?.username || 'Unknown'} 
            {p.user_id === user?.id ? ' (SİZ)' : ''}
          </p>
        ))}
      </div>
    )}
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

   <Card className="border-primary relative overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-300">
  <div className="relative">
    <img 
      src={turnuvaGif} 
      alt="Turnuva" 
      className="w-full h-48 object-cover"
      style={{ objectPosition: '50% 15%' }}
    />
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Trophy className="w-8 h-8 text-white" />
          <h3 className="text-2xl font-bold text-white">Yeni Turnuva</h3>
        </div>
        <p className="text-white/90 text-sm">8 kişilik turnuva oluştur</p>
        <Button 
          onClick={() => setShowGameModeSelector(true)} 
          className="bg-white/20 hover:bg-white/30 text-white border-white/30 hover:border-white/50 backdrop-blur-sm font-semibold px-6 py-3"
          variant="outline"
          disabled={isJoining}
        >
          <Trophy className="w-4 h-4 mr-2" />
          Yeni Turnuva Oluştur
        </Button>
      </div>
    </div>
  </div>
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
                        <Badge variant="outline">
                          {tournament.game_type === 'timed' ? 'Süreli (30s)' : 'Puanlı (500)'}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {tournament.max_participants} kişi
                        </span>
                      </div>
                    </div>
                 <Button 
                    onClick={() => {
                    if (tournament.status === 'waiting') {
                    joinTournament(tournament.id);
                    } else {
                    navigate(`/tournament/${tournament.id}`);  // Turnuva detayına git
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

       {/* Game Mode Selector Modal */}
        {showGameModeSelector && (
         <GameModeSelector
           mode="tournament"
           onStart={(selectedGameType) => {
           setShowGameModeSelector(false);
           createTournament(selectedGameType);
          }}
         onClose={() => setShowGameModeSelector(false)}
        />
        )}
        
      </div>
    </div>
  );
};

export default TournamentPage;