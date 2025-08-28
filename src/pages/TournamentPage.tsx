// 1. TournamentPage.tsx - Sadece süreli mod, basitleştirilmiş akış
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Trophy, Users, Clock, Bot, User } from 'lucide-react';

interface Tournament {
  id: string;
  name: string;
  status: 'waiting' | 'active' | 'finished';
  current_round: number;
  max_participants: number;
  created_at: string;
  started_at: string | null;
  expires_at: string | null;
}

interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string | null;
  seed: number;
  is_bot: boolean;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

const TournamentPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTournaments, setActiveTournaments] = useState<Tournament[]>([]);
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [waitingTime, setWaitingTime] = useState(30); // 30 saniye sabit
  const [isJoining, setIsJoining] = useState(false);

  // Aktif turnuvaları yükle
  const loadActiveTournaments = async () => {
    try {
      await cleanupExpiredTournaments();
      
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .in('status', ['waiting', 'active'])
        .gt('expires_at', new Date().toISOString())
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
      if (error) console.error('Error cleaning up tournaments:', error);
    } catch (error) {
      console.error('Error in cleanup function:', error);
    }
  };

  // YENİ TURNUVA OLUŞTUR - SADECE SÜRELİ MOD
  const createTournament = async () => {
    if (!user || isJoining) return;
    
    setIsJoining(true);
    try {
      console.log('🏆 Yeni süreli turnuva oluşturuluyor...');
      
      const { data: tournament, error } = await supabase
        .from('tournaments')
        .insert({
          name: `Süreli Turnuva ${new Date().toLocaleTimeString('tr-TR')}`,
          status: 'waiting',
          current_round: 1,
          max_participants: 8,
          game_type: 'timed', // SADECE TIMED!
          expires_at: new Date(Date.now() + 30 * 1000).toISOString() // 30 saniye
        })
        .select()
        .single();
      
      if (error) throw error;

      await joinTournament(tournament.id);
      
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast({
        title: 'Hata',
        description: 'Turnuva oluşturulamadı',
        variant: 'destructive',
      });
    } finally {
      setIsJoining(false);
    }
  };

  // TURNUVAYA KATIL
  const joinTournament = async (tournamentId: string) => {
    if (!user || isJoining) return;

    setIsJoining(true);
    try {
      // Zaten katılmış mı kontrol et
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

      // Mevcut katılımcı sayısını kontrol et
      const { data: currentParticipants } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId);

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

      // Katıl
      await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournamentId,
          user_id: user.id,
          seed: participantCount + 1,
          is_bot: false
        });

      // Turnuva detaylarını yükle
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tournament) {
        setCurrentTournament(tournament as Tournament);
        loadTournamentParticipants(tournamentId);
        
        // 30 saniye timer başlat
        if (tournament.expires_at) {
          const expiresAt = new Date(tournament.expires_at).getTime();
          const now = new Date().getTime();
          const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
          setWaitingTime(remaining);
        }
      }

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

  // KATILIMCI YÜK
  const loadTournamentParticipants = async (tournamentId: string) => {
    try {
      const { data, error } = await supabase
        .from('tournament_participants')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('tournament_id', tournamentId)
        .order('seed');

      if (!error && data) {
        setParticipants(data);
        console.log('👥 Katılımcılar yüklendi:', data.length);
      }
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  // TURNUVA OTOMATIK BAŞLATMA
  let isStarting = false;
  const startTournamentWithBots = async () => {
    if (!currentTournament || isStarting) return;
    
    isStarting = true;
    try {
      console.log('🚀 Turnuva başlatılıyor (30s bitti)...');
      
      // Önce turnuva durumunu kontrol et
      const { data: tournamentCheck } = await supabase
        .from('tournaments')
        .select('status')
        .eq('id', currentTournament.id)
        .single();
        
      if (tournamentCheck?.status !== 'waiting') {
        console.log('⚠️ Turnuva zaten başlamış');
        navigate(`/tournament/${currentTournament.id}`);
        return;
      }

      // Turnuvayı active yap
      await supabase
        .from('tournaments')
        .update({ 
          status: 'active', 
          started_at: new Date().toISOString() 
        })
        .eq('id', currentTournament.id);

      // Mevcut gerçek oyuncu sayısını kontrol et
      const { data: realPlayers } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', currentTournament.id)
        .eq('is_bot', false)
        .not('user_id', 'is', null);

      const realPlayerCount = realPlayers?.length || 0;
      console.log('👥 Gerçek oyuncu sayısı:', realPlayerCount);

      if (realPlayerCount < 1) {
        toast({
          title: '⚠️ Yetersiz Katılımcı',
          description: 'Turnuva için en az 1 oyuncu gereklidir.',
          variant: 'destructive',
        });
        
        // Turnuvayı geri waiting yap
        await supabase
          .from('tournaments')
          .update({ status: 'waiting' })
          .eq('id', currentTournament.id);
        return;
      }

      // Bot ekleme - Toplam 8 olana kadar
      const { data: allParticipants } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', currentTournament.id);

      const currentTotal = allParticipants?.length || 0;
      const botsNeeded = 8 - currentTotal;

      if (botsNeeded > 0) {
  console.log('Bot ekleniyor:', botsNeeded);
  const botsToAdd = [];
  for (let i = 0; i < botsNeeded; i++) {
    // Bot için UUID oluştur
    const botUserId = crypto.randomUUID();
    botsToAdd.push({
      tournament_id: currentTournament.id,
      user_id: botUserId,  // NULL yerine UUID
      seed: currentTotal + i + 1,
      is_bot: true
    });
  }
  await supabase.from('tournament_participants').insert(botsToAdd);
}

      // Çeyrek final maçları oluştur (4 maç)
      await createQuarterFinalMatches(currentTournament.id);
      
      toast({
        title: '🏆 Turnuva Başladı!',
        description: 'Çeyrek final maçları başlıyor...',
        duration: 3000,
      });
      
      // Turnuva detay sayfasına yönlendir
      navigate(`/tournament/${currentTournament.id}`);
      
    } catch (error) {
      console.error('❌ Turnuva başlatma hatası:', error);
      toast({
        title: 'Hata',
        description: 'Turnuva başlatılamadı',
        variant: 'destructive',
      });
      
      if (currentTournament) {
        await supabase
          .from('tournaments')
          .update({ status: 'waiting' })
          .eq('id', currentTournament.id);
      }
    } finally {
      isStarting = false;
    }
  };

  // ÇEYREK FİNAL MAÇLARI OLUŞTUR
  const createQuarterFinalMatches = async (tournamentId: string) => {
    try {
      console.log('⚔️ Çeyrek final maçları oluşturuluyor...');

      // Mevcut maç var mı kontrol et
      const { data: existingMatches } = await supabase
        .from('tournament_matches')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('round', 1);

      if (existingMatches && existingMatches.length > 0) {
        console.log('⛔ Çeyrek final maçları zaten mevcut');
        return;
      }

      // Tüm katılımcıları seed sırasına göre al
      const { data: allParticipants } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('seed');

      if (!allParticipants || allParticipants.length !== 8) {
        throw new Error('8 katılımcı bulunamadı');
      }

      // 4 maç oluştur: 1vs2, 3vs4, 5vs6, 7vs8
      const matches = [];
      for (let i = 0; i < 4; i++) {
        const player1 = allParticipants[i * 2];
        const player2 = allParticipants[i * 2 + 1];

        matches.push({
          tournament_id: tournamentId,
          round: 1, // Çeyrek final
          match_number: i + 1,
          player1_id: player1?.user_id || null,
          player2_id: player2?.user_id || null,
          winner_id: null,
          status: 'pending',
          player1_score: 0,
          player2_score: 0,
          created_at: new Date().toISOString()
        });
      }

      // Maçları kaydet
      for (const match of matches) {
        const { error } = await supabase
          .from('tournament_matches')
          .insert(match);
        if (error) throw error;
      }

      console.log('✅ 4 çeyrek final maçı oluşturuldu');
    } catch (error) {
      console.error('❌ Çeyrek final maçları oluşturma hatası:', error);
      throw error;
    }
  };

  // TURNUVADAN AYRIL
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

  // 30 SANİYE TIMER EFEKTİ
  useEffect(() => {
    if (currentTournament && currentTournament.status === 'waiting') {
      const timer = setInterval(() => {
        setWaitingTime(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            startTournamentWithBots(); // Otomatik başlat
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentTournament]);

  // REAL-TIME UPDATES
  useEffect(() => {
    if (!currentTournament?.id) return;

    const channel = supabase
      .channel(`tournament-participants-${currentTournament.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${currentTournament.id}`
      }, () => {
        loadTournamentParticipants(currentTournament.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTournament?.id]);

  // İLK YÜKLEME
  useEffect(() => {
    loadActiveTournaments();
    const interval = setInterval(loadActiveTournaments, 30000);
    return () => clearInterval(interval);
  }, []);

  // MEVCUT TURNUVA BEKLEME EKRANI
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
                  30 saniye içinde otomatik başlayacak
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{waitingTime}s</div>
                    <Progress value={((30 - waitingTime) / 30) * 100} className="mt-2" />
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
                      {participant.is_bot ? 
                        `Bot ${participant.seed}` : 
                        (participant.profiles?.username || `Oyuncu ${participant.seed}`)
                      }
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

  // ANA TURNUVA LİSTESİ
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

        {/* YENİ TURNUVA OLUŞTUR KARTI */}
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
                onClick={createTournament}
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
            {activeTournaments.map((tournament) => (
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
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant={tournament.status === 'waiting' ? 'secondary' : 'default'}>
                          {tournament.status === 'waiting' ? 'Bekliyor' : 'Aktif'}
                        </Badge>
                        <Badge variant="outline">Süreli (2dk)</Badge>
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
                          navigate(`/tournament/${tournament.id}`);
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