import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import TournamentBracket from './TournamentBracket';
import GamePage from './GamePage';
import { 
  ArrowLeft, 
  Trophy, 
  Users, 
  Clock, 
  Play
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
  game_type: string;
}

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score?: number;
  player2_score?: number;
  winner_id: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  room_id?: string;
}

interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string | null;
  seed: number;
  is_bot: boolean;
  eliminated_at: string | null;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
}

const TournamentMatchPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  // 🎯 Oyun bitince sonraki aşama kontrolü
const checkNextRoundOrFinish = async () => {
  if (!tournament) return;

  try {
    // ÖNEMLİ: Güncel turnuva verisini tekrar çek
    const { data: currentTournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (!currentTournament) return;

    // Mevcut turdaki tüm maçları kontrol et
    const { data: currentRoundMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', currentTournament.current_round);

    const completedMatches = currentRoundMatches?.filter(m => m.status === 'completed') || [];
    const totalMatches = currentRoundMatches?.length || 0;

    console.log(`🔍 Tur ${currentTournament.current_round}: ${completedMatches.length}/${totalMatches} maç tamamlandı`);

    // Eğer tüm maçlar tamamlandıysa
    if (completedMatches.length === totalMatches) {
      if (currentTournament.current_round === 3) {
        // 🏆 FİNAL BİTTİ - TURNUVA TAMAMLANDI
        const finalMatch = completedMatches[0];
        const winner = participants.find(p => p.user_id === finalMatch.winner_id);

        await supabase
          .from('tournaments')
          .update({ 
            status: 'finished',
            finished_at: new Date().toISOString()
          })
          .eq('id', tournamentId);

        toast({
          title: '🏆 Turnuva Bitti!',
          description: `Şampiyon: ${winner?.profiles?.username || 'Bilinmeyen'}`,
          duration: 5000,
        });

        // Turnuva verisini güncelle
        await loadTournamentData();

      } else {
        // 📈 SONRAKİ TURA GEÇ
        const nextRound = currentTournament.current_round + 1;
        console.log(`📈 Sonraki tura geçiliyor: ${nextRound}`);

        // Kazananları al
        const winners = completedMatches.map(match => match.winner_id).filter(Boolean);
        
        // Sonraki tur maçlarını oluştur
        const nextRoundMatches = [];
        for (let i = 0; i < winners.length; i += 2) {
          nextRoundMatches.push({
            tournament_id: tournamentId,
            round: nextRound,
            match_number: Math.floor(i / 2) + 1,
            player1_id: winners[i] || null,
            player2_id: winners[i + 1] || null,
            status: 'pending'
          });
        }

        // Veritabanını güncelle
        const { error: insertError } = await supabase.from('tournament_matches').insert(nextRoundMatches);
        if (insertError) throw insertError;
        
        const { error: updateError } = await supabase
          .from('tournaments')
          .update({ current_round: nextRound })
          .eq('id', tournamentId);
        if (updateError) throw updateError;

        toast({
          title: `🎉 ${nextRound === 2 ? 'Yarı Final' : 'Final'} Başlıyor!`,
          description: 'Sonraki tur maçları oluşturuldu',
          duration: 3000,
        });

        // Verileri yeniden yükle
        await loadTournamentData();
      }
    }
  } catch (error) {
    console.error('❌ Sonraki tur kontrolü hatası:', error);
  }
};

// MEVCUT loadTournamentData fonksiyonunu bununla değiştir:
const loadTournamentData = async () => {
  if (!tournamentId) return;

  try {
    // 🔥 ÖNCELİKLE participants'ı yükle
    const { data: participantsData, error: participantsError } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        profiles:user_id (username, avatar_url)
      `)
      .eq('tournament_id', tournamentId)
      .order('seed');

    if (participantsError) throw participantsError;
    
    console.log('✅ Participants yüklendi:', participantsData?.length || 0);
    setParticipants(participantsData || []);

    // Sonra tournament
    const { data: tournamentData, error: tournamentError } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (tournamentError) throw tournamentError;
    setTournament(tournamentData);

    // Son olarak matches
    const { data: matchesData, error: matchesError } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round')
      .order('match_number');

    if (matchesError) throw matchesError;

    // 🔍 DEBUG: Matches'ı kontrol et
    console.log('📊 Matches yüklendi:', {
      count: matchesData?.length || 0,
      matches: matchesData?.map(m => ({
        id: m.id.slice(-8),
        player1: m.player1_id?.slice(-8) || 'NULL',
        player2: m.player2_id?.slice(-8) || 'NULL', 
        status: m.status
      }))
    });
    
    setMatches(matchesData || []);

    // Aktif maç kontrolü
    if (user && matchesData) {
      const userActiveMatch = matchesData.find(match => 
        (match.player1_id === user.id || match.player2_id === user.id) && 
        match.status === 'active'
      );

    console.log('👤 Kullanıcının aktif maçı:', {
      found: !!userActiveMatch,
      matchId: userActiveMatch?.id?.slice(-8),
      player1: userActiveMatch?.player1_id?.slice(-8) || 'NULL',
      player2: userActiveMatch?.player2_id?.slice(-8) || 'NULL',
      status: userActiveMatch?.status
    });
      
      setCurrentMatch(userActiveMatch || null);
    }

  } catch (error) {
    console.error('Error loading tournament data:', error);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId, user]);

  // Real-time güncellemeler için subscription
  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, () => {
        loadTournamentData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournamentId}`
      }, () => {
        loadTournamentData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  // Otomatik maç başlatma effect'i ekle
useEffect(() => {
  if (!tournament || !user) return;

  // Kullanıcının pending maçı var mı?
  const userPendingMatch = matches.find(match => 
    (match.player1_id === user.id || match.player2_id === user.id) && 
    match.status === 'pending'
  );

  if (userPendingMatch) {
    console.log('⏰ Pending maç bulundu:', userPendingMatch.id);
    
    // GERÇEK RAKIP KONTROLÜ
    const opponentId = userPendingMatch.player1_id === user.id ? 
      userPendingMatch.player2_id : 
      userPendingMatch.player1_id;
    
    const isOpponentBot = !opponentId || opponentId.startsWith('bot_');
    console.log('🤖 Rakip bot mu?', isOpponentBot, 'Rakip ID:', opponentId?.slice(-8));
    
    if (isOpponentBot) {
      // Bot rakip - hemen başlat (3 saniye bekle)
      setTimeout(() => {
        console.log('🤖 Bot rakip ile maç başlatılıyor');
        autoStartMatch(userPendingMatch.id);
      }, 3000);
    } else {
      // Gerçek rakip - 10 saniye bekle
      let countdown = 10;
      const countdownInterval = setInterval(() => {
        countdown--;
        console.log(`⏰ Gerçek rakip ile ${countdown} saniye kaldı`);
        
        if (countdown <= 0) {
          clearInterval(countdownInterval);
          console.log('👥 Gerçek rakip ile maç başlatılıyor');
          autoStartMatch(userPendingMatch.id);
        }
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }
}, [tournament, matches, user]);

// Otomatik maç başlatma fonksiyonu
const autoStartMatch = async (matchId: string) => {
  try {
    console.log('🎮 Maç otomatik başlatılıyor:', matchId);

    // 🔥 GRID SEED EKLE - Aynı ızgarayı sağlamak için
    const gridSeed = Date.now().toString();
    console.log('🎯 Grid seed oluşturuldu:', gridSeed);

    // Maçı aktif duruma getir VE grid seed'i kaydet
    const { error } = await supabase
      .from('tournament_matches')
      .update({ 
        status: 'active',
        room_id: gridSeed, // room_id'ye seed'i kaydet
        updated_at: new Date().toISOString()
      })
      .eq('id', matchId);

    if (error) throw error;

    toast({
      title: '🎮 Turnuva Maçı Başladı!',
      description: 'Maç otomatik olarak başlatıldı',
      duration: 3000,
    });

    await loadTournamentData(); // Güncel verileri yükle

  } catch (error) {
    console.error('Error auto-starting match:', error);
  }
};

  // 🏁 Maçı bitirme fonksiyonu
  const completeMatch = async (winnerId: string, player1Score: number, player2Score: number) => {
    if (!currentMatch) return;

    try {
      console.log('🏁 Maç bitiriliyor:', { winnerId, player1Score, player2Score });

      // Önce maçı tamamla
      const { error: updateError } = await supabase
        .from('tournament_matches')
        .update({
          status: 'completed',
          winner_id: winnerId,
          player1_score: player1Score,
          player2_score: player2Score,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentMatch.id);

      if (updateError) throw updateError;

      // 🎯 ÖNEMLİ: İSTATİSTİKLERİ GÜNCELLE!
    
      // Player 1 istatistikleri
      if (currentMatch.player1_id && !currentMatch.player1_id.startsWith('bot_')) {
        const isPlayer1Winner = winnerId === currentMatch.player1_id;
      
        // Player 1 kelimelerini oluştur (simüle et)
        const player1Words = Array.from({length: Math.floor(player1Score / 8)}, (_, i) => ({
          word: `KELIME${i + 1}`,
          score: 8
        }));
      
        await updatePlayerStatistics(
          currentMatch.player1_id,
          player1Score,
          player1Words,
          isPlayer1Winner
        );
      
        // Rozet kontrolü
        await checkBadges(currentMatch.player1_id, player1Words.length);
      }
    
      // Player 2 istatistikleri
      if (currentMatch.player2_id && !currentMatch.player2_id.startsWith('bot_')) {
        const isPlayer2Winner = winnerId === currentMatch.player2_id;
      
        // Player 2 kelimelerini oluştur (simüle et)
        const player2Words = Array.from({length: Math.floor(player2Score / 8)}, (_, i) => ({
          word: `KELIME${i + 1}`,
          score: 8
        }));
      
        await updatePlayerStatistics(
          currentMatch.player2_id,
          player2Score,
          player2Words,
          isPlayer2Winner
        );
      
        // Rozet kontrolü
        await checkBadges(currentMatch.player2_id, player2Words.length);
      }

    // Kaybedeni eleme
      const loserId = winnerId === currentMatch.player1_id ? currentMatch.player2_id : currentMatch.player1_id;
      if (loserId) {
        await supabase
          .from('tournament_participants')
          .update({ eliminated_at: new Date().toISOString() })
          .eq('user_id', loserId)
          .eq('tournament_id', tournamentId);
      }

      setIsPlaying(false);
      setCurrentMatch(null);

      toast({
        title: '🏆 Maç Tamamlandı!',
        description: 'İstatistikler güncellendi, sonraki tur kontrol ediliyor...',
      });

      // Verileri yeniden yükle
      await loadTournamentData();
    
      // Sonraki tur kontrolü yap
      setTimeout(() => {
        checkNextRoundOrFinish();
      }, 1000);

    } catch (error) {
      console.error('Error completing match:', error);
      toast({
        title: 'Hata',
        description: 'Maç tamamlanamadı',
        variant: 'destructive',
      });
    }
  };

  const updatePlayerStatistics = async (
    userId: string,
    gameScore: number,
    words: Array<{word: string, score: number}>,
    isWinner: boolean
  ) => {
    try {
      console.log('📊 Turnuva istatistikleri güncelleniyor:', { userId, gameScore, words: words.length, isWinner });
    
      await supabase.rpc('update_game_statistics', {
        p_user_id: userId,
        p_game_score: gameScore,
        p_words: words,
        p_is_winner: isWinner
      });
    
      console.log('✅ Turnuva istatistikleri güncellendi');
    } catch (error) {
      console.error('❌ Turnuva istatistik güncelleme hatası:', error);
    }
  };

  const checkBadges = async (userId: string, wordsCount?: number) => {
    try {
      console.log('🏆 Turnuva rozet kontrolü yapılıyor:', userId);
    
      // General badge check
      const { data: generalBadges, error: generalError } = await supabase.rpc('check_and_award_badges', {
        p_user_id: userId
      });
    
      if (generalError) {
        console.error('❌ Genel rozet kontrolü hatası:', generalError);
      } else if (generalBadges && generalBadges.length > 0) {
        generalBadges.forEach((badge: any) => {
          toast({
            title: '🏆 Yeni Rozet!',
            description: `"${badge.new_badge_name}" rozetini kazandınız! ${badge.new_badge_icon}`,
            duration: 4000,
          });
        });
      }
    
      // Words per game badge check
      if (wordsCount && wordsCount > 0) {
        const { data: wordsBadges, error: wordsError } = await supabase.rpc('check_words_per_game_badge', {
          p_user_id: userId,
          p_words_count: wordsCount
        });
      
        if (wordsError) {
          console.error('❌ Kelime rozeti kontrolü hatası:', wordsError);
        } else if (wordsBadges && wordsBadges.length > 0) {
          wordsBadges.forEach((badge: any) => {
            toast({
              title: '🏆 Yeni Rozet!',
              description: `"${badge.new_badge_name}" rozetini kazandınız! ${badge.new_badge_icon}`,
              duration: 4000,
            });
          });
        }
      }
    
      console.log('✅ Turnuva rozet kontrolü tamamlandı');
    } catch (error) {
      console.error('❌ Turnuva rozet kontrolü hatası:', error);
    }
  };


  // Kullanıcının sıradaki maçını bul
  const getUserNextMatch = () => {
    if (!user) return null;
    return matches.find(match => 
      (match.player1_id === user.id || match.player2_id === user.id) && 
      match.status === 'pending'
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-4xl mx-auto text-center py-8">
          <h2 className="text-2xl font-bold mb-4">Turnuva Bulunamadı</h2>
          <Button onClick={() => navigate('/tournaments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Turnuvalara Dön
          </Button>
        </div>
      </div>
    );
  }

  // 🎮 Oyun modunda ise GamePage'i göster
  if (isPlaying && currentMatch) {
    return (
      <GamePage 
        gameMode="tournament"
        onGameComplete={completeMatch}
        tournamentMatch={currentMatch}
        gameType={(tournament.game_type as string) === 'score' ? 'score' : 'timed'}
        participants={participants}
      />
    );
  }

  const userNextMatch = getUserNextMatch();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/tournaments')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Turnuvalara Dön
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <div className="flex items-center justify-center space-x-4 mt-2">
              <Badge variant={tournament.status === 'active' ? 'default' : 'secondary'}>
                {tournament.status === 'active' ? '🎮 Aktif' : 
                 tournament.status === 'finished' ? '🏆 Bitti' : '⏳ Bekliyor'}
              </Badge>
              <Badge variant="outline">
                {(tournament.game_type as string) === 'timed' ? '⏱️ Süreli' : '🎯 Puanlı'}
              </Badge>
              <Badge variant="outline">
                🏆 {tournament.current_round === 1 ? 'Çeyrek Final' : 
                    tournament.current_round === 2 ? 'Yarı Final' : 
                    tournament.current_round === 3 ? 'Final' : `${tournament.current_round}. Tur`}
              </Badge>
            </div>
          </div>
          <div className="w-16" />
        </div>

        {/* Kullanıcının Durumu */}
{user && (
  <Card className="border-primary">
    <CardHeader>
      <CardTitle className="flex items-center">
        <Users className="w-5 h-5 mr-2" />
        Sizin Durumunuz
      </CardTitle>
    </CardHeader>
    <CardContent>
      {currentMatch ? (
        <div className="space-y-4">
          <div className="text-center">
            <Badge variant="default" className="text-lg px-4 py-2">
              🎮 Aktif Maçınız Var!
            </Badge>
          </div>
          <div className="flex justify-center">
            <Button 
              onClick={() => setIsPlaying(true)} // Devam et
              className="px-8 py-3"
            >
              <Play className="w-4 h-4 mr-2" />
              Maça Devam Et
            </Button>
          </div>
        </div>
      ) : userNextMatch ? (
        <div className="space-y-4">
          <div className="text-center">
            <Badge variant="secondary" className="text-lg px-4 py-2 animate-pulse">
              ⏰ Maç 10 Saniye İçinde Başlayacak
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              {userNextMatch.round === 2 ? 'Yarı Final' : 
               userNextMatch.round === 3 ? 'Final' : 'Çeyrek Final'} - 
              Maç {userNextMatch.match_number}
            </p>
          </div>
          <div className="text-center">
            <div className="animate-pulse text-primary font-medium">
              🎮 Otomatik başlatılıyor...
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Rakibinizle birlikte otomatik oyuna alınacaksınız
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <Badge variant="outline" className="text-lg px-4 py-2">
            👀 Turnuvayı İzliyorsunuz
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            {tournament.status === 'finished' ? 
              'Turnuva sona erdi' : 
              'Elendikten sonra turnuvayı takip edebilirsiniz'}
          </p>
        </div>
      )}
    </CardContent>
  </Card>
)}
        {/* Turnuva Ağacı */}
        <TournamentBracket 
          matches={matches}
          participants={participants}
          currentUserId={user?.id}
        />

        {/* Rest of the existing JSX... */}
        {/* (Diğer kartlar ve istatistikler aynı kalacak) */}
      </div>
    </div>
  );
};

export default TournamentMatchPage;
