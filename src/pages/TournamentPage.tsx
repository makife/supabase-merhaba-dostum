import { useState, useEffect } from 'react';
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
    }
  } catch (error) {
    console.error('Error loading participants:', error);
  }
};

const startTournamentWithBots = async () => {
  if (!currentTournament) return;

  console.log('🏁 Turnuva başlatılıyor:', currentTournament.id);

  try {
    // GERÇEK KATILIMCI KONTROLÜ - DOĞRU FİLTRE
    const { data: allParticipants, error } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .eq('tournament_id', currentTournament.id)
      .order('seed');

    if (error) throw error;

    console.log('🔍 TÜM KATILIMCILAR (RAW DATA):', allParticipants);
    console.log('🔍 İlk katılımcı detay:', allParticipants?.[0]);

    // DOĞRU FİLTRE - null kontrolü ve is_bot kontrolü
    const realPlayers = allParticipants?.filter(p => {
      const isReal = p.user_id !== null && p.is_bot === false;
      console.log(`👤 Katılımcı ${p.id}: user_id=${p.user_id?.slice(-8) || 'null'}, is_bot=${p.is_bot}, isReal=${isReal}`);
      return isReal;
    }) || [];

    console.log('👥 Gerçek oyuncu sayısı:', realPlayers.length);
    console.log('👥 Gerçek oyuncular:', realPlayers.map(p => ({
      id: p.user_id?.slice(-8),
      username: p.profiles?.username,
      seed: p.seed
    })));

    if (realPlayers.length < 1) {
      toast({
        title: '⚠️ Yetersiz Katılımcı', 
        description: 'Turnuva için en az 1 gerçek oyuncu gereklidir.',
        variant: 'destructive',
      });
      return;
    }

    // BOT EKLEME KONTROLÜ
    const currentTotalCount = allParticipants?.length || 0;
    const botCount = 8 - currentTotalCount;
    console.log('🤖 Bot durumu:', {
      currentTotal: currentTotalCount,
      botsNeeded: botCount,
      realPlayers: realPlayers.length
    });

    if (botCount > 0) {
      console.log('🤖 Bot ekleniyor:', botCount, 'adet');
      
      const botsToAdd = [];
      for (let i = 0; i < botCount; i++) {
        botsToAdd.push({
          tournament_id: currentTournament.id,
          user_id: null, // NULL - bot için
          seed: currentTotalCount + i + 1,
          is_bot: true
        });
      }

      const { error: botError } = await supabase
        .from('tournament_participants')
        .insert(botsToAdd);
      
      if (botError) {
        console.error('🤖 Bot ekleme hatası:', botError);
      } else {
        console.log('✅ Botlar eklendi');
      }
    }

    // GÜNCELLENMİŞ KATILIMCILAR
    const { data: finalParticipants } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .eq('tournament_id', currentTournament.id)
      .order('seed');

    console.log('🔍 FİNAL KATILIMCILAR:', finalParticipants?.length);
    console.log('🔍 Final liste:', finalParticipants?.map(p => ({
      user_id: p.user_id?.slice(-8) || 'null',
      is_bot: p.is_bot,
      seed: p.seed
    })));

    // MANUEL MAÇ OLUŞTURMA
    console.log('🎯 createTournamentMatches çağrılıyor...');
    await createTournamentMatches(currentTournament.id, finalParticipants || []);

    // TURNUVAYI AKTİF YAP
    await supabase
      .from('tournaments')
      .update({ 
        status: 'active',
        started_at: new Date().toISOString()
      })
      .eq('id', currentTournament.id);

    toast({
      title: '🏁 Turnuva Başladı!',
      description: `${realPlayers.length} gerçek oyuncu ile turnuva başladı.`,
      duration: 3000,
    });

    navigate(`/tournament/${currentTournament.id}`);

  } catch (error) {
    console.error('❌ Turnuva başlatma hatası:', error);
    
    toast({
      title: 'Hata',
      description: typeof error === 'object' && error !== null && 'message' in error 
        ? (error as Error).message 
        : 'Turnuva başlatılamadı',
      variant: 'destructive',
    });
  }
};

// 2. createTournamentMatches - DÜZELTİLMİŞ VERSİYON
const createTournamentMatches = async (tournamentId: string, allParticipants: any[]) => {
  try {
    console.log('🏟️ Manuel maç oluşturma başlıyor:', tournamentId);
    console.log('👥 Gelen toplam katılımcı:', allParticipants.length);

    // DEBUG: Hangi katılımcılar geldi?
    console.log('🔍 KATILIMCI ANALİZİ:');
    allParticipants.forEach((p, index) => {
      console.log(`  ${index + 1}. ID: ${p.user_id?.slice(-8) || 'null'} | is_bot: ${p.is_bot} | seed: ${p.seed}`);
    });

    // GERÇEK VE BOT KATILIMCILAR - HEPSİNİ DAHIL ET
    const realPlayers = allParticipants.filter(p => p.user_id !== null && p.is_bot === false);
    const botPlayers = allParticipants.filter(p => p.user_id === null || p.is_bot === true);
    
    console.log('✅ Gerçek oyuncu:', realPlayers.length);
    console.log('🤖 Bot sayısı:', botPlayers.length);
    console.log('📊 Toplam:', realPlayers.length + botPlayers.length);

    if (allParticipants.length < 8) {
      throw new Error(`Toplam 8 katılımcı olmalı. Şu an ${allParticipants.length} katılımcı var.`);
    }

    // TÜM KATILIMCILARI SEED SIRASINA GÖRE SIRALA
    const sortedParticipants = [...allParticipants].sort((a, b) => a.seed - b.seed);
    
    console.log('📋 Sıralanmış katılımcılar:');
    sortedParticipants.forEach((p, index) => {
      console.log(`  ${index + 1}. Seed ${p.seed}: ${p.user_id?.slice(-8) || 'BOT'} (${p.is_bot ? 'Bot' : 'Human'})`);
    });

    const matches = [];

    // 4 MAÇ OLUŞTUR (8 kişilik turnuva için)
    for (let i = 0; i < 4; i++) {
      const player1Index = i * 2;
      const player2Index = i * 2 + 1;
      
      const player1 = sortedParticipants[player1Index];
      const player2 = sortedParticipants[player2Index];
      
      // Player ID'leri belirle
      let player1_id = player1?.user_id;
      let player2_id = player2?.user_id;
      
      // Bot ise özel ID oluştur
      if (!player1_id || player1?.is_bot) {
        player1_id = `bot_${Math.random().toString(36).substr(2, 9)}`;
      }
      if (!player2_id || player2?.is_bot) {
        player2_id = `bot_${Math.random().toString(36).substr(2, 9)}`;
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
      
      console.log(`🥊 Maç ${i + 1}:`, {
        player1: player1_id.includes('bot_') ? '🤖 Bot' : `👤 ${player1_id.slice(-8)}`,
        player2: player2_id.includes('bot_') ? '🤖 Bot' : `👤 ${player2_id.slice(-8)}`
      });
    }

    // DATABASE'E KAYDET
    const { data, error } = await supabase
      .from('tournament_matches')
      .insert(matches)
      .select();

    if (error) {
      console.error('❌ Supabase maç kaydetme hatası:', error);
      throw error;
    }

    console.log('✅ Maçlar başarıyla oluşturuldu:', data?.length);
    return data;

  } catch (error) {
    console.error('❌ createTournamentMatches hatası:', error);
    throw error;
  }
};

const createTournamentMatches = async (tournamentId: string, allParticipants: any[]) => {
  try {
    console.log('🏟️ Manuel maç oluşturma başlıyor:', tournamentId);
    console.log('👥 Gelen toplam katılımcı:', allParticipants.length);

    // DEBUG: Hangi katılımcılar geldi?
    console.log('🔍 KATILIMCI ANALİZİ:');
    allParticipants.forEach((p, index) => {
      console.log(`  ${index + 1}. ID: ${p.user_id?.slice(-8) || 'null'} | is_bot: ${p.is_bot} | seed: ${p.seed}`);
    });

    // GERÇEK VE BOT KATILIMCILAR - HEPSİNİ DAHIL ET
    const realPlayers = allParticipants.filter(p => p.user_id !== null && p.is_bot === false);
    const botPlayers = allParticipants.filter(p => p.user_id === null || p.is_bot === true);
    
    console.log('✅ Gerçek oyuncu:', realPlayers.length);
    console.log('🤖 Bot sayısı:', botPlayers.length);
    console.log('📊 Toplam:', realPlayers.length + botPlayers.length);

    if (allParticipants.length < 8) {
      throw new Error(`Toplam 8 katılımcı olmalı. Şu an ${allParticipants.length} katılımcı var.`);
    }

    // TÜM KATILIMCILARI SEED SIRASINA GÖRE SIRALA
    const sortedParticipants = [...allParticipants].sort((a, b) => a.seed - b.seed);
    
    console.log('📋 Sıralanmış katılımcılar:');
    sortedParticipants.forEach((p, index) => {
      console.log(`  ${index + 1}. Seed ${p.seed}: ${p.user_id?.slice(-8) || 'BOT'} (${p.is_bot ? 'Bot' : 'Human'})`);
    });

    const matches = [];

    // 4 MAÇ OLUŞTUR (8 kişilik turnuva için)
    for (let i = 0; i < 4; i++) {
      const player1Index = i * 2;
      const player2Index = i * 2 + 1;
      
      const player1 = sortedParticipants[player1Index];
      const player2 = sortedParticipants[player2Index];
      
      // Player ID'leri belirle
      let player1_id = player1?.user_id;
      let player2_id = player2?.user_id;
      
      // Bot ise özel ID oluştur
      if (!player1_id || player1?.is_bot) {
        player1_id = `bot_${Math.random().toString(36).substr(2, 9)}`;
      }
      if (!player2_id || player2?.is_bot) {
        player2_id = `bot_${Math.random().toString(36).substr(2, 9)}`;
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
      
      console.log(`🥊 Maç ${i + 1}:`, {
        player1: player1_id.includes('bot_') ? '🤖 Bot' : `👤 ${player1_id.slice(-8)}`,
        player2: player2_id.includes('bot_') ? '🤖 Bot' : `👤 ${player2_id.slice(-8)}`
      });
    }

    // DATABASE'E KAYDET
    const { data, error } = await supabase
      .from('tournament_matches')
      .insert(matches)
      .select();

    if (error) {
      console.error('❌ Supabase maç kaydetme hatası:', error);
      throw error;
    }

    console.log('✅ Maçlar başarıyla oluşturuldu:', data?.length);
    return data;

  } catch (error) {
    console.error('❌ createTournamentMatches hatası:', error);
    throw error;
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
                     (participant.profiles?.username || `Oyuncu ${index + 1}`)
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