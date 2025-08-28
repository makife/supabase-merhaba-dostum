import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Trophy, Clock, User, Bot } from 'lucide-react';

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: string; // Database'den gelen genel string türü
  player1_score?: number;
  player2_score?: number;
  created_at: string;
}

interface Tournament {
  id: string;
  name: string;
  status: string; // Database'den gelen genel string türü
  current_round: number;
}

interface Participant {
  id: string;
  user_id: string | null;
  is_bot: boolean;
  seed: number;
  profiles?: {
    username: string;
    avatar_url: string;
  };
}

const TournamentMatchPage: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentUserMatch, setCurrentUserMatch] = useState<TournamentMatch | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // VERİ YÜKLEME FONKSİYONU
  const loadTournamentData = async () => {
    if (!tournamentId || !user) return;

    try {
      console.log('📊 Turnuva verileri yükleniyor:', tournamentId);
      
      // Paralel olarak tüm verileri çek
      const [tournamentRes, matchesRes, participantsRes] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
        supabase.from('tournament_matches').select('*').eq('tournament_id', tournamentId).order('round').order('match_number'),
        supabase.from('tournament_participants').select(`
          *,
          profiles:user_id (username, avatar_url)
        `).eq('tournament_id', tournamentId).order('seed')
      ]);

      if (tournamentRes.data) setTournament(tournamentRes.data as Tournament);
      if (matchesRes.data) {
        setMatches(matchesRes.data as TournamentMatch[]);
        
        // Kullanıcının aktif maçını bul
        const userMatch = (matchesRes.data as TournamentMatch[]).find(match => 
          (match.player1_id === user.id || match.player2_id === user.id) && 
          match.status === 'pending'
        );
        setCurrentUserMatch(userMatch || null);
      }
      if (participantsRes.data) setParticipants(participantsRes.data as Participant[]);

    } catch (error) {
      console.error('❌ Turnuva veri yükleme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  // OTOMATIK MAÇ BAŞLATMA
  const startUserMatch = async (match: TournamentMatch) => {
    if (!user) return;

    try {
      console.log('🚀 Kullanıcı maçı başlatılıyor:', match.id);

      // Maçı active duruma getir
      await supabase
        .from('tournament_matches')
        .update({ status: 'active' })
        .eq('id', match.id);

      // Oyun sayfasına yönlendir
      navigate(`/game?tournament=${tournamentId}&match=${match.id}&type=timed`, {
        state: {
          gameMode: 'tournament',
          tournamentMatch: match,
          gameType: 'timed',
          participants: participants.filter(p => 
            p.user_id === match.player1_id || p.user_id === match.player2_id
          )
        }
      });

    } catch (error) {
      console.error('Maç başlatma hatası:', error);
      toast({
        title: 'Hata',
        description: 'Maç başlatılamadı',
        variant: 'destructive',
      });
    }
  };

  // BOT MAÇLARI SİMÜLE ET
 const simulateBotMatch = async (match: TournamentMatch) => {
  console.log('🤖 BOT MAÇI SİMÜLE EDİLİYOR:', {
    id: match.id.slice(-8),
    status: match.status,
    player1: match.player1_id?.slice(-8) || 'null',
    player2: match.player2_id?.slice(-8) || 'null'
  });
  
  // Eğer zaten completed ise atla
  if (match.status === 'completed') {
    console.log('⚠️ Maç zaten tamamlanmış, atlanıyor');
    return;
  }
  
  // Bot maçında rastgele kazanan seç
  // Eğer player1_id null ise player2 kazansın, değilse rastgele
  let winner: string | null;
  
  if (match.player1_id === null && match.player2_id === null) {
    // İki bot da null - rastgele birini seç (1 veya 2)
    winner = Math.random() > 0.5 ? 'bot1' : 'bot2';
  } else if (match.player1_id === null) {
    winner = match.player2_id; // Player2 kazanır
  } else if (match.player2_id === null) {
    winner = match.player1_id; // Player1 kazanır  
  } else {
    // İki gerçek oyuncu - rastgele
    winner = Math.random() > 0.5 ? match.player1_id : match.player2_id;
  }
  
  const winnerScore = Math.floor(Math.random() * 200) + 100; // 100-300 arası
  const loserScore = Math.floor(Math.random() * winnerScore); // Kazanandan düşük

  console.log('🏆 Bot maçı sonucu:', {
    matchId: match.id.slice(-8),
    winner: winner === 'bot1' || winner === 'bot2' ? winner : winner?.slice(-8),
    winnerScore,
    loserScore
  });

  // ⚠️ ÖZEL DURUM: İki bot da null ise dummy winner koy
  if (match.player1_id === null && match.player2_id === null) {
    winner = match.player1_id || match.player2_id || 'dummy-bot-winner';
  }

  const { error } = await supabase
    .from('tournament_matches')
    .update({
      status: 'completed',
      winner_id: winner,
      player1_score: winner === match.player1_id ? winnerScore : loserScore,
      player2_score: winner === match.player2_id ? winnerScore : loserScore
    })
    .eq('id', match.id);

  if (error) {
    console.error('❌ Bot maçı güncelleme hatası:', error);
  } else {
    console.log('✅ Bot maçı tamamlandı');
  }
};

  // OYUNCU İSMİ ALMA
  const getPlayerName = (playerId: string | null): string => {
    if (!playerId) return 'Bot';
    
    const participant = participants.find(p => p.user_id === playerId);
    
    if (participant) {
      if (participant.is_bot) {
        return `Bot ${participant.seed}`;
      }
      return participant.profiles?.username || 'Bilinmeyen Oyuncu';
    }
    
    if (playerId === user?.id) {
      return 'Sen';
    }
    
    return 'Bilinmeyen Oyuncu';
  };

  // TUR İSMİ ALMA
  const getRoundName = (round: number): string => {
    switch (round) {
      case 1: return 'Çeyrek Final';
      case 2: return 'Yarı Final'; 
      case 3: return 'Final';
      default: return `Tur ${round}`;
    }
  };

  // SONRAKİ TUR MAÇLARİNİ OLUŞTUR
const createNextRoundMatches = async (completedRound: number) => {
  try {
    console.log('⚔️ Sonraki tur maçları oluşturuluyor:', completedRound + 1);
    
    const { data: roundMatches, error: matchError } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', completedRound)
      .eq('status', 'completed');

    if (matchError) {
      console.error('Maç sorgulama hatası:', matchError);
      return;
    }

    console.log(`🏆 ${completedRound}. tur tamamlanan maç sayısı:`, roundMatches?.length || 0);
    
    // HER MAÇI DETAYLI KONTROL ET - TYPE ASSERTION KULLAN
    roundMatches?.forEach((match: any, index) => {
      console.log(`Maç ${index + 1}:`, {
        id: match.id.slice(-8),
        player1: match.player1_id?.slice(-8) || 'null',
        player2: match.player2_id?.slice(-8) || 'null', 
        winner: match.winner_id?.slice(-8) || 'NULL',
        score1: match.player1_score || 0,
        score2: match.player2_score || 0,
        status: match.status
      });
    });
    
    if (!roundMatches || roundMatches.length === 0) {
      console.log('⏳ Tamamlanan maç bulunamadı');
      return;
    }

    const winners = roundMatches
      .map((m: any) => {
        console.log('Kazanan kontrol:', m.winner_id ? m.winner_id.slice(-8) : 'NULL');
        return m.winner_id;
      })
      .filter(Boolean) as string[];

    console.log('🏆 Filtreli kazananlar:', winners.map(w => w.slice(-8)));
    console.log('🏆 Kazanan sayısı:', winners.length);

    if (winners.length < 2) {
      console.log('⏳ Sonraki tur için yeterli kazanan yok');
      return;
    }

    const nextRound = completedRound + 1;
    
    // Sonraki tur maçları zaten var mı kontrol et
    const { data: existingMatches } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('round', nextRound);

    if (existingMatches && existingMatches.length > 0) {
      console.log('⛔ Sonraki tur maçları zaten mevcut');
      return;
    }

    // Sonraki tur maçları oluştur
    const nextRoundMatches = [];
    const matchesPerRound = Math.floor(winners.length / 2);

    console.log(`🎯 ${nextRound}. tur için ${matchesPerRound} maç oluşturuluyor`);

    for (let i = 0; i < matchesPerRound; i++) {
      nextRoundMatches.push({
        tournament_id: tournamentId,
        round: nextRound,
        match_number: i + 1,
        player1_id: winners[i * 2],
        player2_id: winners[i * 2 + 1],
        winner_id: null,
        status: 'pending',
        player1_score: 0,
        player2_score: 0,
        created_at: new Date().toISOString()
      });
    }

    // Maçları veritabanına kaydet
    for (const match of nextRoundMatches) {
      const { error: insertError } = await supabase
        .from('tournament_matches')
        .insert(match);

      if (insertError) {
        console.error('Maç ekleme hatası:', insertError);
        return;
      }
    }

    // Turnuva round'unu güncelle
    const { error: updateError } = await supabase
      .from('tournaments')
      .update({ current_round: nextRound })
      .eq('id', tournamentId);

    if (updateError) {
      console.error('Turnuva round güncelleme hatası:', updateError);
      return;
    }

    console.log(`✅ ${nextRound}. tur maçları başarıyla oluşturuldu`);

    // Verileri yenile
    setTimeout(() => {
      loadTournamentData();
    }, 1000);

  } catch (error) {
    console.error('❌ Sonraki tur oluşturma hatası:', error);
  }
};
  
  // TURNUVA BİTİRME
  const finishTournament = async (finalWinner: string | null) => {
    if (!finalWinner) return;

    try {
      await supabase
        .from('tournaments')
        .update({ 
          status: 'finished',
          finished_at: new Date().toISOString() 
        })
        .eq('id', tournamentId);

      console.log('🏆 Turnuva tamamlandı, şampiyon:', finalWinner);

      toast({
        title: '🏆 Turnuva Tamamlandı!',
        description: `Şampiyon: ${getPlayerName(finalWinner)}`,
        duration: 5000,
      });

    } catch (error) {
      console.error('❌ Turnuva bitirme hatası:', error);
    }
  };

  // 10 SANİYE GERİ SAYIM EFEKTİ
  useEffect(() => {
    if (!currentUserMatch || !user) return;

    const isUserMatch = currentUserMatch.player1_id === user.id || currentUserMatch.player2_id === user.id;
    if (!isUserMatch) return;

    console.log('⏰ 10 saniye geri sayım başlıyor...');
    setCountdown(10);

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          startUserMatch(currentUserMatch);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [currentUserMatch, user]);

  // BOT MAÇLARINI OTOMATIK SİMÜLE ET
useEffect(() => {
  const handleBotMatches = async () => {
    console.log('🔍 Bot maçları kontrol ediliyor...');
    console.log('📊 Toplam maç sayısı:', matches.length);
    console.log('👥 Katılımcı sayısı:', participants.length);
    console.log('👤 User ID:', user?.id?.slice(-8));

    const botMatches = matches.filter(match => 
      match.status === 'pending' && (
        (match.player1_id === null || match.player2_id === null) ||
        (match.player1_id !== user?.id && match.player2_id !== user?.id)
      )
    );

    console.log('🤖 Simüle edilecek bot maçları:', botMatches.length);
    botMatches.forEach(match => {
      console.log('Bot maç:', {
        id: match.id.slice(-8),
        status: match.status,
        player1: match.player1_id?.slice(-8) || 'null',
        player2: match.player2_id?.slice(-8) || 'null'
      });
    });

    for (const match of botMatches) {
      if (match.status !== 'completed') {
        console.log('🎯 Simüle ediliyor:', match.id.slice(-8));
        await simulateBotMatch(match);
      }
    }
  };

  if (matches.length > 0 && participants.length > 0 && user) {
    console.log('🚀 Bot maç simülasyonu başlatılıyor...');
    setTimeout(handleBotMatches, 2000);
  } else {
    console.log('⏸️ Bot simülasyonu için koşullar hazır değil');
  }
}, [matches, participants, user]);

  
  // MAÇ TAMAMLANMA KONTROLÜ VE SONRAKİ TUR
 useEffect(() => {
  const checkRoundCompletion = async () => {
    if (!tournament || matches.length === 0) return;

    const currentRound = tournament.current_round;
    const currentRoundMatches = matches.filter(m => m.round === currentRound);
    const completedMatches = currentRoundMatches.filter(m => m.status === 'completed');

    console.log(`🔍 Tur kontrolü - Round: ${currentRound}, Total: ${currentRoundMatches.length}, Completed: ${completedMatches.length}`);

    // Tur tamamlandı mı?
    if (currentRoundMatches.length > 0 && completedMatches.length === currentRoundMatches.length) {
      console.log('✅ Tur tamamlandı:', currentRound);

      if (currentRound === 3) {
        // Final tamamlandı, turnuva bitir
        const finalMatch = completedMatches[0];
        await finishTournament(finalMatch.winner_id);
      } else {
        // Sonraki tur maçlarını oluştur
        console.log('🔄 3 saniye sonra sonraki tur oluşturulacak...');
        setTimeout(() => {
          createNextRoundMatches(currentRound);
        }, 3000);
      }
    } else {
      console.log(`⏳ Tur henüz tamamlanmadı: ${completedMatches.length}/${currentRoundMatches.length}`);
    }
  };

  checkRoundCompletion();
}, [matches, tournament]);

  // REAL-TIME GÜNCELLEMELER
  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        loadTournamentData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  // İLK YÜKLEME
  useEffect(() => {
    loadTournamentData();
  }, [tournamentId, user]);

  // MAÇ KARTI BİLEŞENİ
  const MatchCard = ({ match }: { match: TournamentMatch }) => {
    const isCompleted = match.status === 'completed';
    const isActive = match.status === 'active';
    const isPending = match.status === 'pending';
    const isUserMatch = match.player1_id === user?.id || match.player2_id === user?.id;

    return (
      <Card className={`transition-all duration-300 ${
        isActive ? 'border-primary bg-primary/5 shadow-lg animate-pulse' : 
        isCompleted ? 'border-green-500 bg-green-50' : 
        isUserMatch ? 'border-orange-500 bg-orange-50' : 'border-muted'
      }`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="text-center">
              <Badge variant={isActive ? 'default' : isCompleted ? 'secondary' : 'outline'} className="text-xs">
                Maç {match.match_number}
              </Badge>
            </div>
            
            {/* Oyuncu 1 */}
            <div className={`flex items-center justify-between p-2 rounded-lg ${
              match.winner_id === match.player1_id ? 'bg-green-100 border border-green-300' : 'bg-muted/50'
            }`}>
              <div className="flex items-center space-x-2">
                {match.player1_id ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                <span className="font-medium">{getPlayerName(match.player1_id)}</span>
              </div>
              {isCompleted && (
                <Badge variant="outline">{match.player1_score || 0}</Badge>
              )}
            </div>

            <div className="text-center text-xs text-muted-foreground">VS</div>

            {/* Oyuncu 2 */}
            <div className={`flex items-center justify-between p-2 rounded-lg ${
              match.winner_id === match.player2_id ? 'bg-green-100 border border-green-300' : 'bg-muted/50'
            }`}>
              <div className="flex items-center space-x-2">
                {match.player2_id ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                <span className="font-medium">{getPlayerName(match.player2_id)}</span>
              </div>
              {isCompleted && (
                <Badge variant="outline">{match.player2_score || 0}</Badge>
              )}
            </div>

            {/* Durum */}
            <div className="text-center">
              {isActive && <Badge variant="default" className="animate-pulse">Devam Ediyor</Badge>}
              {isCompleted && <Badge variant="secondary" className="bg-green-100 text-green-800">Tamamlandı</Badge>}
              {isPending && isUserMatch && <Badge variant="outline" className="bg-orange-100 text-orange-800">Sıran Geliyor!</Badge>}
              {isPending && !isUserMatch && <Badge variant="outline">Bekliyor</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // YÜKLEME EKRANI
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">Turnuva verileri yükleniyor...</p>
        </div>
      </div>
    );
  }

  // TURNUVA BULUNAMADI
  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="mb-4">Turnuva bulunamadı</p>
            <Button onClick={() => navigate('/tournaments')}>
              Turnuva Listesine Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // TURNUVA BİTTİ EKRANI
  if (tournament.status === 'finished') {
    const finalMatch = matches.find(m => m.round === 3 && m.status === 'completed');
    const champion = finalMatch?.winner_id;

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 p-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="border-yellow-400 bg-gradient-to-r from-yellow-100 to-orange-100">
            <CardContent className="p-8 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-600" />
              <h1 className="text-3xl font-bold mb-2 text-yellow-800">Turnuva Tamamlandı!</h1>
              <h2 className="text-xl font-semibold mb-4 text-yellow-700">
                Şampiyon: {getPlayerName(champion)}
              </h2>
              <div className="space-y-2">
                <Button onClick={() => navigate('/tournaments')} className="w-full">
                  Turnuva Sayfasına Dön
                </Button>
                <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                  Ana Sayfaya Dön
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ANA TURNUVA EKRANI
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/tournaments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Turnuva Listesi
          </Button>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <div className="w-24" />
        </div>

        {/* Turnuva Durumu */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{getRoundName(tournament.current_round)}</span>
              <Badge variant="default">{tournament.status === 'active' ? 'Devam Ediyor' : 'Bekliyor'}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Kullanıcı Maçı Geri Sayım */}
        {countdown !== null && currentUserMatch && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center space-x-2">
                  <Clock className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold">Maçın Başlıyor!</h3>
                </div>
                <div className="text-4xl font-bold text-primary">{countdown}</div>
                <p className="text-muted-foreground">
                  {getPlayerName(currentUserMatch.player1_id)} vs {getPlayerName(currentUserMatch.player2_id)}
                </p>
                <p className="text-sm text-primary">Hazır ol, maç {countdown} saniye içinde başlayacak!</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Maç Ağacı */}
        <div className="space-y-8">
          {[1, 2, 3].map(round => {
            const roundMatches = matches.filter(m => m.round === round);
            if (roundMatches.length === 0) return null;

            return (
              <div key={round} className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-bold">{getRoundName(round)}</h3>
                  <div className="w-24 h-1 bg-primary/30 rounded-full mx-auto mt-2" />
                </div>
                
                <div className={`grid gap-4 ${
                  round === 1 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
                  round === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-lg mx-auto' :
                  'grid-cols-1 max-w-sm mx-auto'
                }`}>
                  {roundMatches
                    .sort((a, b) => a.match_number - b.match_number)
                    .map(match => (
                      <MatchCard key={match.id} match={match} />
                    ))
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TournamentMatchPage;