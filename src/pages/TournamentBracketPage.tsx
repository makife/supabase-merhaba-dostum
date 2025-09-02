// TournamentBracketPage.tsx - Tam düzeltme

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Home, User, Bot } from 'lucide-react';
import { TournamentMatch } from '@/types/tournament';

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [globalCountdown, setGlobalCountdown] = useState(10);
  const [userMatchId, setUserMatchId] = useState<string | null>(null);

useEffect(() => {
  if (tournamentId) {
    fetchMatches();
    
    const channel = supabase
      .channel(`tournament-matches-${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, (payload) => {
        const updatedMatch = payload.new as any;
        console.log('🔄 Maç güncellendi:', updatedMatch.status);
        
        const userIdString = String(user?.id);
        const isUserMatch = user && (
          String(updatedMatch.player1_id) === userIdString || 
          String(updatedMatch.player2_id) === userIdString
        );
        
        if (isUserMatch && updatedMatch.status === 'in_progress') {
          console.log('🚀 Kullanıcı maçı başladı, yönlendiriliyor...');
          
          // ÇÖZÜM: Hem navigate hem de window.location kullan
          // Navigate çalışmazsa window.location çalışır
          navigate(`/game?match=${updatedMatch.id}&tournament=${tournamentId}`);
          
          // Backup yönlendirme - 1 saniye sonra
          setTimeout(() => {
            if (window.location.pathname !== '/game') {
              console.log('🔧 Backup yönlendirme aktif');
              window.location.href = `/game?match=${updatedMatch.id}&tournament=${tournamentId}`;
            }
          }, 1000);
        }
        
        fetchMatches();
      })
      .subscribe();

    // ÇÖZÜM: Timer'ı daha kısa yap
    const startTimer = setTimeout(() => {
      startAllMatches();
    }, 1000); // 3000 -> 1000

    // ÇÖZÜM: Ek kontrol - 5 saniye sonra manuel kontrol
    const fallbackTimer = setTimeout(async () => {
      console.log('🔧 Fallback kontrol - Maç başladı mı?');
      
      const { data: userMatch } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .or(`player1_id.eq.${user?.id},player2_id.eq.${user?.id}`)
        .eq('status', 'in_progress')
        .single();
      
      if (userMatch && window.location.pathname !== '/game') {
        console.log('🔧 Fallback yönlendirme aktif');
        window.location.href = `/game?match=${userMatch.id}&tournament=${tournamentId}`;
      }
    }, 5000);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(fallbackTimer);
      supabase.removeChannel(channel);
    };
  }
}, [tournamentId, user, navigate]);

  useEffect(() => {
    if (tournamentId && matches.length > 0) {
      // Global geri sayım
      const countdownTimer = setInterval(() => {
        setGlobalCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownTimer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownTimer);
    }
  }, [tournamentId, matches.length]);

useEffect(() => {
  // Page visibility değişikliklerini dinle
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      console.log('🔍 Sayfa aktif oldu, maç kontrolü yapılıyor...');
      
      // Sayfaya geri dönüldüğünde kontrol et
      setTimeout(async () => {
        if (user && tournamentId) {
          const { data: userMatch } = await supabase
            .from('tournament_matches')
            .select('*')
            .eq('tournament_id', tournamentId)
            .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
            .eq('status', 'in_progress')
            .single();
          
          if (userMatch && window.location.pathname !== '/game') {
            console.log('🔧 Visibility yönlendirmesi aktif');
            window.location.href = `/game?match=${userMatch.id}&tournament=${tournamentId}`;
          }
        }
      }, 500);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [user, tournamentId]);

 const fetchMatches = async () => {
  try {
    console.log('⚔️ Maçlar alınıyor...');
    
    const { data, error } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round', { ascending: true })
      .order('match_number', { ascending: true });

    if (error) {
      console.error('Maçlar alınamadı:', error);
      return;
    }

    if (!data) {
      setMatches([]);
      return;
    }

    console.log('✅ Maçlar alındı:', data.length);

    // TIP DÜZELTMESİ: UUID'yi string'e çevir
    if (user) {
      const userIdString = String(user.id); // UUID'yi string'e çevir
      
      const userMatch = data.find(match => 
        String(match.player1_id) === userIdString || 
        String(match.player2_id) === userIdString
      );
      
      if (userMatch) {
        console.log('✅ Kullanıcı maçı bulundu:', userMatch.id);
        setUserMatchId(userMatch.id);
      } else {
        console.log('❌ Kullanıcı maçı bulunamadı');
        setUserMatchId(null);
      }
    }

    // Oyuncu bilgilerini yükle
    const matchesWithPlayerInfo = await Promise.all(
      data.map(async (match) => {
        let player1Info = { username: 'Oyuncu', avatar_url: null, is_bot: false };
        let player2Info = { username: 'Oyuncu', avatar_url: null, is_bot: false };

        // Player 1 bilgilerini al
        if (match.player1_id && String(match.player1_id).startsWith('bot_')) {
          player1Info = {
            username: `Bot ${String(match.player1_id).split('_').pop()}`,
            avatar_url: null,
            is_bot: true
          };
        } else if (match.player1_id) {
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', match.player1_id) // Burada UUID karşılaştırması olacak
              .single();

            if (profileData) {
              player1Info = { ...profileData, is_bot: false };
            }
          } catch (error) {
            console.error('Player 1 bilgisi alınamadı:', error);
          }
        }

        // Player 2 bilgilerini al
        if (match.player2_id && String(match.player2_id).startsWith('bot_')) {
          player2Info = {
            username: `Bot ${String(match.player2_id).split('_').pop()}`,
            avatar_url: null,
            is_bot: true
          };
        } else if (match.player2_id) {
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('username, avatar_url')
              .eq('id', match.player2_id)
              .single();

            if (profileData) {
              player2Info = { ...profileData, is_bot: false };
            }
          } catch (error) {
            console.error('Player 2 bilgisi alınamadı:', error);
          }
        }

        return {
          ...match,
          player1: player1Info,
          player2: player2Info
        } as TournamentMatch;
      })
    );

    setMatches(matchesWithPlayerInfo);
    
  } catch (error) {
    console.error('fetchMatches error:', error);
  }
};

const checkAndCreateNextRound = async (tournamentId: string) => {
  try {
    // Mevcut turdaki tüm maçlar tamamlandı mı?
    const { data: incompleteMatches } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('status', 'pending')
      .limit(1);

    if (incompleteMatches.length === 0) {
      // Bir sonraki turu başlat
      const { data: currentRound } = await supabase
        .from('tournament_matches')
        .select('round')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: false })
        .limit(1);

      const nextRound = currentRound[0].round + 1;
      
      if (nextRound <= 3) { // Finale kadar
        await createTournamentMatches(tournamentId, nextRound);
        
        // YENİ: Sonraki tur maçları oluşturulduktan sonra kullanıcıyı bracket sayfasına yönlendir
        navigate(`/tournament-bracket/${tournamentId}`);
      } else {
        // Turnuvayı tamamla
        await supabase
          .from('tournaments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', tournamentId);
          
        // YENİ: Turnuva tamamlandığında ana sayfaya yönlendir
        navigate('/');
      }
    }
  } catch (error) {
    console.error('Sonraki tur kontrol hatası:', error);
  }
};

const createTournamentMatches = async (tournamentId: string, round: number) => {
  try {
    // Önceki turun kazananlarını al
    const { data: winners } = await supabase
      .from('tournament_matches')
      .select('winner_id')
      .eq('tournament_id', tournamentId)
      .eq('round', round - 1)
      .eq('status', 'completed');

    if (!winners || winners.length === 0) {
      console.error('Önceki tur kazananları bulunamadı');
      return;
    }

    // Kazananları rastgele sırala
    const winnerIds = winners.map(w => w.winner_id).filter(id => id !== null);
    const shuffled = [...winnerIds].sort(() => Math.random() - 0.5);
    const matchCount = Math.ceil(shuffled.length / 2);

    // Yeni tur maçlarını oluştur
    for (let i = 0; i < matchCount; i++) {
      const player1Id = shuffled[i * 2];
      const player2Id = shuffled[i * 2 + 1] || null; // Eğer tek sayıda kazanan varsa

      await supabase
        .from('tournament_matches')
        .insert({
          tournament_id: tournamentId,
          round: round,
          match_number: i + 1,
          player1_id: player1Id,
          player2_id: player2Id,
          status: 'pending'
        });
    }

    console.log(`✅ Round ${round} maçları oluşturuldu`);

  } catch (error) {
    console.error('Maç oluşturma hatası:', error);
  }
};
  
const startAllMatches = async () => {
  if (!tournamentId) return;

  try {
    console.log('🎮 Tüm maçlar başlatılıyor...');
    
    // Maç durumlarını güncelle
    const { error: updateError } = await supabase
      .from('tournament_matches')
      .update({ 
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('tournament_id', tournamentId)
      .eq('status', 'pending');

    if (updateError) {
      console.error('Maçlar başlatılamadı:', updateError);
      return;
    }

    console.log('✅ Tüm maçlar başlatıldı!');
    
    // ÇÖZÜM: Hemen kontrol et ve yönlendir
    if (user && userMatchId) {
      console.log('🎯 Anında kullanıcı maçına yönlendiriliyor:', userMatchId);
      
      // Çoklu yönlendirme stratejisi
      try {
        navigate(`/game?match=${userMatchId}&tournament=${tournamentId}`);
      } catch (navError) {
        console.log('Navigate hatası, window.location kullanılıyor:', navError);
        window.location.href = `/game?match=${userMatchId}&tournament=${tournamentId}`;
      }
      
      return;
    }
    
    // ÇÖZÜM: Maçı bulamadıysa tekrar kontrol et
    if (user && !userMatchId) {
      console.log('🔍 UserMatchId bulunamadı, tekrar kontrol ediliyor...');
      
      setTimeout(async () => {
        const { data: matches } = await supabase
          .from('tournament_matches')
          .select('*')
          .eq('tournament_id', tournamentId)
          .eq('status', 'in_progress');
        
        const userMatch = matches?.find(match => 
          String(match.player1_id) === String(user.id) || 
          String(match.player2_id) === String(user.id)
        );
        
        if (userMatch) {
          console.log('🎯 Gecikmeli kullanıcı maçı bulundu:', userMatch.id);
          window.location.href = `/game?match=${userMatch.id}&tournament=${tournamentId}`;
        }
      }, 2000);
    }
    
    // Bot maçlarını başlat
    await startBotMatches();

  } catch (error) {
    console.error('Maç başlatma hatası:', error);
  }
};

  
  const startBotMatches = async () => {
    const botMatches = matches.filter(m => 
      m.status === 'in_progress' && 
      (!m.player1_id || m.player1_id.startsWith('bot_') || !m.player2_id || m.player2_id.startsWith('bot_'))
    );
    
    console.log('🤖 Bot maçları başlatılıyor:', botMatches.length);

    for (const match of botMatches) {
      // Bot vs bot veya bot vs oyuncu - bot skorlarını simüle et
      setTimeout(async () => {
        const player1Score = Math.floor(Math.random() * 30) + 15; // 15-45
        const player2Score = Math.floor(Math.random() * 30) + 15; // 15-45
        const winnerId = player1Score > player2Score ? match.player1_id : match.player2_id;

        await supabase
          .from('tournament_matches')
          .update({
            status: 'completed',
            player1_score: player1Score,
            player2_score: player2Score,
            winner_id: winnerId,
            updated_at: new Date().toISOString()
          })
          .eq('id', match.id);
          
        console.log(`✅ Bot maçı tamamlandı: ${player1Score}-${player2Score}`);
      }, Math.random() * 10000 + 5000); // 5-15 saniye
    }
  };

  const getRoundName = (round: number) => {
    switch (round) {
      case 1: return 'Çeyrek Final';
      case 2: return 'Yarı Final';
      case 3: return 'Final';
      default: return `${round}. Tur`;
    }
  };

  const getPlayerDisplayName = (player: any) => {
    if (!player) return 'Belirsiz';
    
    if (player.is_bot) {
      return player.username;
    }
    
    return player.username || 'Oyuncu';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Başlık */}
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">Turnuva Kurgusu</h1>
          <p className="text-gray-300 mb-4">Turnuva #{tournamentId?.slice(-8)}</p>
          
          {/* Kullanıcı maçı varsa özel mesaj */}
          {userMatchId && (
            <div className="bg-green-500/20 rounded-lg p-4 max-w-md mx-auto mb-4">
              <div className="text-green-400 text-lg font-bold">
                🎯 Maçınız Var!
              </div>
              <div className="text-green-300 text-sm">
                Maçlar başladığında otomatik yönlendirileceksiniz
              </div>
            </div>
          )}
          
          {/* Global geri sayım */}
          {globalCountdown > 0 && (
            <div className="bg-yellow-500/20 rounded-lg p-4 max-w-md mx-auto">
              <div className="text-yellow-400 text-2xl font-bold mb-2">
                {globalCountdown}s
              </div>
              <div className="text-yellow-300">
                Tüm maçlar otomatik olarak başlayacak...
              </div>
              <div className="text-yellow-200 text-sm mt-2">
                ⚡ Hazır olun!
              </div>
            </div>
          )}

          {/* Maçlar başladığında göster */}
          {globalCountdown === 0 && matches.some(m => m.status === 'in_progress') && (
            <div className="bg-green-500/20 rounded-lg p-4 max-w-md mx-auto">
              <div className="text-green-400 text-lg font-bold">
                🚀 Maçlar Başladı!
              </div>
              <div className="text-green-300 text-sm">
                Tüm maçlar aynı anda oynanıyor...
              </div>
            </div>
          )}
        </div>

        {/* Maçlar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((round) => (
            <div key={round} className="space-y-4">
              <h2 className="text-xl font-bold text-white text-center">
                {getRoundName(round)}
              </h2>
              
              {matches
                .filter(match => match.round === round)
                .map((match) => (
                  <Card 
                    key={match.id} 
                    className={`bg-white/10 backdrop-blur-md border-white/20 ${
                      userMatchId === match.id ? 'ring-2 ring-yellow-400 ring-opacity-75' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="text-center text-sm text-gray-300 mb-2">
                        Maç {match.match_number}
                        {userMatchId === match.id && (
                          <span className="ml-2 text-yellow-400 font-bold">
                            👤 SİZİN MAÇINIZ
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        {/* Player 1 */}
                        <div className={`flex items-center justify-between p-2 rounded ${
                          match.winner_id === match.player1_id ? 'bg-green-500/20' : 'bg-white/5'
                        }`}>
                          <div className="flex items-center">
                            {match.player1?.is_bot ? (
                              <Bot className="w-4 h-4 text-gray-400 mr-2" />
                            ) : (
                              <User className="w-4 h-4 text-blue-400 mr-2" />
                            )}
                            <span className={`text-white text-sm ${
                              match.player1_id === user?.id ? 'font-bold text-yellow-300' : ''
                            }`}>
                              {getPlayerDisplayName(match.player1)}
                              {match.player1_id === user?.id && ' (SİZ)'}
                            </span>
                          </div>
                          <span className="font-bold text-white">
                            {match.player1_score || 0}
                          </span>
                        </div>

                        {/* VS */}
                        <div className="text-center text-gray-400 text-xs">VS</div>

                        {/* Player 2 */}
                        <div className={`flex items-center justify-between p-2 rounded ${
                          match.winner_id === match.player2_id ? 'bg-green-500/20' : 'bg-white/5'
                        }`}>
                          <div className="flex items-center">
                            {match.player2?.is_bot ? (
                              <Bot className="w-4 h-4 text-gray-400 mr-2" />
                            ) : (
                              <User className="w-4 h-4 text-blue-400 mr-2" />
                            )}
                            <span className={`text-white text-sm ${
                              match.player2_id === user?.id ? 'font-bold text-yellow-300' : ''
                            }`}>
                              {getPlayerDisplayName(match.player2)}
                              {match.player2_id === user?.id && ' (SİZ)'}
                            </span>
                          </div>
                          <span className="font-bold text-white">
                            {match.player2_score || 0}
                          </span>
                        </div>
                      </div>

                      <div className="text-center mt-2 text-sm">
                        {match.status === 'completed' ? (
                          <span className="text-green-400">✓ Tamamlandı</span>
                        ) : match.status === 'in_progress' ? (
                          <span className="text-yellow-400">▶️ Devam Ediyor</span>
                        ) : (
                          <span className="text-gray-400">⏳ Bekleniyor</span>
                        )}
                      </div>

                      {/* Kullanıcı maçıysa ve başlamamışsa manuel başlatma butonu */}
                      {userMatchId === match.id && match.status === 'in_progress' && globalCountdown === 0 && (
                        <div className="mt-3">
                          <Button
                            onClick={() => navigate(`/game?match=${match.id}&tournament=${tournamentId}`)}
                            className="w-full bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            🎮 Maçı Başlat
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          ))}
        </div>

        {/* Ana sayfa butonu */}
        <div className="text-center">
          <Button 
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
          >
            <Home className="w-4 h-4 mr-2" />
            Ana Sayfaya Dön
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TournamentBracketPage;