import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface Tournament {
  id: string;
  name: string;
  status: string;
  current_round: number;
  started_at: string;
  finished_at: string;
}

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: string;
  room_id: string | null;
  created_at: string;
}

interface Participant {
  id: string;
  user_id: string;
  is_bot: boolean;
  eliminated_at: string | null;
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
  const [currentMatch, setCurrentMatch] = useState<TournamentMatch | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Otomatik maç başlatma sistemi
const startAutoMatch = async (match: TournamentMatch) => {
  if (!user) return;

  try {
    console.log('🚀 Otomatik maç başlatılıyor:', match.id);

    // ✅ DOĞRUDAN GamePage'e yönlendir - room oluşturma
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
    console.error('Otomatik maç başlatma hatası:', error);
  }
};

  // Turnuva durumunu kontrol et ve sonraki turu başlat
const checkCurrentTournamentProgress = async () => {
  if (!tournamentId) return;

  try {
    console.log('🏆 Turnuva ilerlemesi kontrol ediliyor...', tournamentId);
    
    const { data: currentTournament } = await supabase
      .from('tournaments')
      .select('*')
      .eq('id', tournamentId)
      .single();

    if (!currentTournament) {
      console.log('❌ Tournament bulunamadı');
      return;
    }

    console.log('🏆 Mevcut turnuva durumu:', currentTournament);
    const currentRound = currentTournament.current_round;
    
    // Mevcut turun tüm maçları tamamlandı mı kontrol et
    const { data: roundMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', currentRound);

    console.log(`🏆 Tur ${currentRound} maçları:`, roundMatches);

    if (!roundMatches) return;

    const allCompleted = roundMatches.every(match => match.status === 'completed');
    console.log('🏆 Tüm maçlar tamamlandı mı?', allCompleted);
    
    if (allCompleted && currentRound < 3) {
      console.log('🏆 Tur tamamlandı, sonraki tur oluşturuluyor...');
      
      // Sonraki turu oluştur
      await createNextRound(currentRound + 1, roundMatches);
      
      // Tournament current_round güncelle
      await supabase
        .from('tournaments')
        .update({ current_round: currentRound + 1 })
        .eq('id', tournamentId);

      console.log('✅ Sonraki tur oluşturuldu');
      
      // Verileri yenile
      loadTournamentData();
    } else if (allCompleted && currentRound === 3) {
      console.log('🏆 Turnuva tamamlandı!');
      
      // Turnuvayı bitir
      await supabase
        .from('tournaments')
        .update({ 
          status: 'finished',
          finished_at: new Date().toISOString()
        })
        .eq('id', tournamentId);
    }
  } catch (error) {
    console.error('❌ Turnuva ilerleme kontrolü hatası:', error);
  }
};

  // Sonraki turu oluştur
  const createNextRound = async (nextRound: number, previousMatches: TournamentMatch[]) => {
    try {
      const winners = previousMatches
        .filter(match => match.winner_id)
        .map(match => match.winner_id);

      const nextRoundMatches = [];
      
      if (nextRound === 2) {
        // Yarı final: 4 kazanan -> 2 maç
        for (let i = 0; i < winners.length; i += 2) {
          nextRoundMatches.push({
            tournament_id: tournamentId,
            round: 2,
            match_number: Math.floor(i / 2) + 1,
            player1_id: winners[i],
            player2_id: winners[i + 1] || null,
            status: 'pending'
          });
        }
      } else if (nextRound === 3) {
        // Final: 2 kazanan -> 1 maç
        nextRoundMatches.push({
          tournament_id: tournamentId,
          round: 3,
          match_number: 1,
          player1_id: winners[0],
          player2_id: winners[1] || null,
          status: 'pending'
        });
      }

      if (nextRoundMatches.length > 0) {
        await supabase
          .from('tournament_matches')
          .insert(nextRoundMatches);
        
        console.log(`✅ ${nextRound}. tur maçları oluşturuldu:`, nextRoundMatches.length);
      }
    } catch (error) {
      console.error('Sonraki tur oluşturma hatası:', error);
    }
  };

 const loadTournamentData = async () => {
  if (!tournamentId || !user) return;

  try {
    // 3 sorguyu paralel çalıştır
    const [tournamentData, matchesData, participantsData] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', tournamentId).single(),
      supabase.from('tournament_matches').select('*')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true }),
      supabase.from('tournament_participants').select(`
        *,
        profiles:user_id (
          username,
          avatar_url
        )
      `).eq('tournament_id', tournamentId)
    ]);

    // Hızlıca state'leri güncelle
    if (tournamentData.data) setTournament(tournamentData.data);
    
    if (matchesData.data) {
      setMatches(matchesData.data);
      const userMatch = matchesData.data.find(match => 
        (match.player1_id === user.id || match.player2_id === user.id) && 
        match.status === 'pending'
      );
      setCurrentMatch(userMatch || null);
    }
    
    if (participantsData.data) setParticipants(participantsData.data);

  } catch (error) {
    console.error('Turnuva veri yükleme hatası:', error);
  } finally {
    setLoading(false);
  }
};

  const simulateBotMatch = async (match: TournamentMatch) => {
    // Simulate bot vs bot match
    const winner = Math.random() > 0.5 ? match.player1_id : match.player2_id;
    
    await supabase
      .from('tournament_matches')
      .update({
        status: 'completed',
        winner_id: winner
      })
      .eq('id', match.id);

    // Eliminate the loser
    const loserId = winner === match.player1_id ? match.player2_id : match.player1_id;
    if (loserId) {
      await supabase
        .from('tournament_participants')
        .update({ eliminated_at: new Date().toISOString() })
        .eq('tournament_id', tournamentId)
        .eq('user_id', loserId);
    }
  };

  const getPlayerName = (playerId: string | null): string => {
    if (!playerId) return 'Bot';
    const participant = participants.find(p => p.user_id === playerId);
    return participant?.profiles?.username || 'Bilinmeyen Oyuncu';
  };

  const renderCountdown = () => {
    if (countdown === null || !currentMatch) return null;

    return (
      <Card className="mb-6 border-orange-500 bg-orange-50">
        <CardContent className="p-6 text-center">
          <div className="text-6xl font-bold text-orange-600 mb-4">
            {countdown}
          </div>
          <h3 className="text-xl font-semibold mb-2">Maç Başlıyor!</h3>
          <p className="text-muted-foreground">
            {getPlayerName(currentMatch.player1_id)} vs {getPlayerName(currentMatch.player2_id)}
          </p>
          <p className="text-sm text-orange-600 mt-2">
            Otomatik olarak oyun başlatılacak...
          </p>
        </CardContent>
      </Card>
    );
  };

  const renderBracket = () => {
    const round1Matches = matches.filter(m => m.round === 1);
    const round2Matches = matches.filter(m => m.round === 2);
    const round3Matches = matches.filter(m => m.round === 3);

    return (
      <div className="space-y-8">
        {/* Round 1 - Quarterfinals */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Çeyrek Final</h3>
          <div className="grid grid-cols-2 gap-4">
            {round1Matches.map((match, index) => (
              <Card key={match.id} className="p-4">
                <div className="space-y-2">
                  <div className={`p-2 rounded ${match.winner_id === match.player1_id ? 'bg-green-100' : ''}`}>
                    {getPlayerName(match.player1_id)}
                  </div>
                  <div className="text-center text-sm text-muted-foreground">vs</div>
                  <div className={`p-2 rounded ${match.winner_id === match.player2_id ? 'bg-green-100' : ''}`}>
                    {getPlayerName(match.player2_id)}
                  </div>
                  <div className="text-center">
                    {match.status === 'active' && (
                      <div className="text-orange-600 font-medium">Devam Ediyor</div>
                    )}
                    {match.status === 'completed' && (
                      <div className="text-green-600 font-medium">Tamamlandı</div>
                    )}
                    {match.status === 'pending' && (
                      <div className="text-blue-600 font-medium">Bekliyor</div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Round 2 - Semifinals */}
        {round2Matches.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Yarı Final</h3>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              {round2Matches.map((match) => (
                <Card key={match.id} className="p-4">
                  <div className="space-y-2">
                    <div className={`p-2 rounded ${match.winner_id === match.player1_id ? 'bg-green-100' : ''}`}>
                      {getPlayerName(match.player1_id)}
                    </div>
                    <div className="text-center text-sm text-muted-foreground">vs</div>
                    <div className={`p-2 rounded ${match.winner_id === match.player2_id ? 'bg-green-100' : ''}`}>
                      {getPlayerName(match.player2_id)}
                    </div>
                    <div className="text-center">
                      {match.status === 'active' && (
                        <div className="text-orange-600 font-medium">Devam Ediyor</div>
                      )}
                      {match.status === 'completed' && (
                        <div className="text-green-600 font-medium">Tamamlandı</div>
                      )}
                      {match.status === 'pending' && (
                        <div className="text-blue-600 font-medium">Bekliyor</div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Round 3 - Final */}
        {round3Matches.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Final</h3>
            <div className="max-w-sm mx-auto">
              {round3Matches.map((match) => (
                <Card key={match.id} className="p-4">
                  <div className="space-y-2">
                    <div className={`p-2 rounded ${match.winner_id === match.player1_id ? 'bg-green-100' : ''}`}>
                      {getPlayerName(match.player1_id)}
                    </div>
                    <div className="text-center text-sm text-muted-foreground">vs</div>
                    <div className={`p-2 rounded ${match.winner_id === match.player2_id ? 'bg-green-100' : ''}`}>
                      {getPlayerName(match.player2_id)}
                    </div>
                    <div className="text-center">
                      {match.status === 'active' && (
                        <div className="text-orange-600 font-medium">Devam Ediyor</div>
                      )}
                      {match.status === 'completed' && (
                        <div className="text-green-600 font-medium">Tamamlandı</div>
                      )}
                      {match.status === 'pending' && (
                        <div className="text-blue-600 font-medium">Bekliyor</div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 10 saniye geri sayım ve otomatik başlatma
  useEffect(() => {
    if (!currentMatch || !user) return;

    // Sadece kullanıcının maçı varsa countdown başlat
    const isUserMatch = currentMatch.player1_id === user.id || currentMatch.player2_id === user.id;
    if (!isUserMatch) return;

    console.log('⏰ 10 saniye countdown başlıyor...');
    setCountdown(10);

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          // Otomatik maç başlat
          startAutoMatch(currentMatch);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [currentMatch, user]);

  // Real-time updates
useEffect(() => {
  if (!tournamentId) return;

  const channel = supabase
    .channel(`tournament-${tournamentId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`
      },
      async (payload) => {
        console.log('🔄 Turnuva maç güncellemesi:', payload);
        
        // Eğer bir maç tamamlandıysa, turnuva ilerlemesini kontrol et
        if (payload.eventType === 'UPDATE' && (payload.new as any).status === 'completed') {
          console.log('✅ Maç tamamlandı, ilerleme kontrolü yapılıyor...');
          
          try {
            const { error } = await supabase.rpc('check_tournament_progress_v2', {
              p_tournament_id: tournamentId
            });
            
            if (error) {
              console.error('❌ Turnuva ilerleme kontrolü hatası:', error);
            } else {
              console.log('✅ Turnuva ilerleme kontrolü başarılı');
              // Verileri yenile
              setTimeout(() => {
                loadTournamentData();
              }, 1000);
            }
          } catch (error) {
            console.error('❌ Turnuva ilerleme fonksiyonu hatası:', error);
          }
        } else {
          // Diğer güncellemeler için sadece verileri yenile
          loadTournamentData();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [tournamentId]);

  useEffect(() => {
    loadTournamentData();
  }, [tournamentId, user]);

  // Auto-simulate bot matches
  useEffect(() => {
    const checkBotMatches = async () => {
      const botMatches = matches.filter(match => 
        match.status === 'pending' && 
        (!match.player1_id || !match.player2_id || 
         participants.find(p => p.user_id === match.player1_id)?.is_bot ||
         participants.find(p => p.user_id === match.player2_id)?.is_bot)
      );

      for (const match of botMatches) {
        // Only simulate if both players are bots or one is missing
        const player1IsBot = !match.player1_id || participants.find(p => p.user_id === match.player1_id)?.is_bot;
        const player2IsBot = !match.player2_id || participants.find(p => p.user_id === match.player2_id)?.is_bot;
        
        if (player1IsBot && player2IsBot) {
          await simulateBotMatch(match);
        }
      }
    };

    if (matches.length > 0 && participants.length > 0) {
      checkBotMatches();
    }
  }, [matches, participants, tournamentId]);

if (loading) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        <p className="mt-4">Turnuva veriler yükleniyor...</p>
        <p className="text-sm text-muted-foreground mt-2">
          Sonraki tur eşleştirmesi kontrol ediliyor...
        </p>
      </div>
    </div>
  );
}

  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <p>Turnuva bulunamadı</p>
            <Button onClick={() => navigate('/tournaments')} className="mt-4">
              Turnuva Listesine Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Button 
          variant="outline" 
          onClick={() => navigate('/tournaments')}
          className="mb-4"
        >
          ← Turnuva Listesine Dön
        </Button>
        
        <Card>
          <CardHeader>
            <CardTitle>{tournament.name}</CardTitle>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Durum: {tournament.status === 'active' ? 'Aktif' : tournament.status === 'finished' ? 'Tamamlandı' : 'Bekliyor'}</span>
              <span>Tur: {tournament.current_round}</span>
              <span>Katılımcı: {participants.length}</span>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Countdown gösterimi */}
      {renderCountdown()}

      {/* Normal maç bilgileri */}
      {!countdown && currentMatch && (
        <Card className="mb-6 border-primary">
          <CardHeader>
            <CardTitle className="text-primary">Sıradaki Maçınız</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p>{getPlayerName(currentMatch.player1_id)} vs {getPlayerName(currentMatch.player2_id)}</p>
                <p className="text-sm text-muted-foreground">Tur {currentMatch.round}, Maç {currentMatch.match_number}</p>
                <p className="text-sm text-orange-600 mt-2">10 saniye içinde otomatik başlatılacak...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Turnuva Eşleşmeleri</CardTitle>
        </CardHeader>
        <CardContent>
          {renderBracket()}
        </CardContent>
      </Card>
    </div>
  );
};

export default TournamentMatchPage;