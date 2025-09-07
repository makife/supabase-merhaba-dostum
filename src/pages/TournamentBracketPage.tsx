// TournamentBracketPage.tsx - Tam düzeltme

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Home, User, Bot } from 'lucide-react';
import { TournamentMatch } from '@/types/tournament';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// TypeScript tip tanımları
interface TournamentMatchUpdate {
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
  [key: string]: any;
}

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
const { user } = useAuth();
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [globalCountdown, setGlobalCountdown] = useState(10);
  const [userMatchId, setUserMatchId] = useState<string | null>(null);
  // Bu tur için otomasyonun tetiklenip tetiklenmediğini takip eder
  const [handledRound, setHandledRound] = useState<number | null>(null);
  // Turnuva bitiş ve şampiyon kartı
  const [isTournamentCompleted, setIsTournamentCompleted] = useState(false);
  const [championShown, setChampionShown] = useState(false);
  const [championVisible, setChampionVisible] = useState(false);
  const [championName, setChampionName] = useState<string>('Şampiyon');


  // Ana useEffect - Real-time subscription (timer yok)
  useEffect(() => {
    if (tournamentId) {
      fetchMatches();
      
      const channel = supabase
        .channel(`tournament-matches-${tournamentId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'tournament_matches',
          filter: `tournament_id=eq.${tournamentId}`
        }, (payload) => {
          const updatedMatch = payload.new as TournamentMatchUpdate;
          console.log('🔄 Maç güncellendi:', updatedMatch.status);
          
          const userIdString = String(user?.id);
          const isUserMatch = user && (
            String(updatedMatch.player1_id) === userIdString || 
            String(updatedMatch.player2_id) === userIdString
          );
          
          if (isUserMatch && updatedMatch.status === 'in_progress') {
            console.log('🚀 Kullanıcı maçı başladı, yönlendiriliyor...');
            navigate(`/game?match=${updatedMatch.id}&tournament=${tournamentId}`);
          }
          
          // Kullanıcının maçı tamamlandığında bot maçlarını da tamamla
          if (isUserMatch && updatedMatch.status === 'completed') {
            console.log('🏁 Kullanıcı maçı tamamlandı!');
            handleUserMatchCompleted();
          }
          
          fetchMatches();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [tournamentId, user, navigate]);

  // Backup kontrol - Tab aktif olduğunda
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && user && tournamentId && globalCountdown === 0) {
        console.log('🔍 Sayfa aktif oldu, maç kontrolü yapılıyor...');
        
        const { data: userMatch } = await supabase
          .from('tournament_matches')
          .select('*')
          .eq('tournament_id', tournamentId)
          .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
          .eq('status', 'in_progress')
          .single();
        
        if (userMatch && window.location.pathname !== '/game') {
          console.log('🔧 Visibility yönlendirmesi aktif');
          navigate(`/game?match=${userMatch.id}&tournament=${tournamentId}`);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, tournamentId, navigate, globalCountdown]);

  // Şampiyon kartı gösterildiğinde otomatik yönlendirme
  useEffect(() => {
    if (!championVisible) return;
    const t = setTimeout(() => {
      navigate('/tournament');
    }, 3500);
    return () => clearTimeout(t);
  }, [championVisible, navigate]);

// Global countdown - her tur için 10 saniye sayıcı
  useEffect(() => {
    if (!tournamentId || matches.length === 0) return;

    if (isTournamentCompleted) {
      setGlobalCountdown(0);
      return;
    }

    // Beklemedeki maçlar var mı kontrol et
    const hasPendingMatches = matches.some(match => match.status === 'pending');
    
    if (!hasPendingMatches) {
      setGlobalCountdown(0);
      return;
    }
    
    // Her yeni tur için sayıcıyı 10'a reset et
    setGlobalCountdown(10);
    
    const countdownInterval = setInterval(() => {
      setGlobalCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          console.log('⏰ 10 saniye doldu, maçlar başlatılıyor...');
          startAllMatches();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
    };
  }, [tournamentId, matches, isTournamentCompleted]);

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

      if (user) {
        const userIdString = String(user.id);
        
        // Kullanıcının BEKLEMEDEKI maçını bul
        const userPendingMatch = data.find(match => 
          (String(match.player1_id) === userIdString || 
           String(match.player2_id) === userIdString) &&
          match.status === 'pending'
        );
        
        if (userPendingMatch) {
          console.log('✅ Kullanıcı beklemedeki maçı bulundu:', userPendingMatch.id);
          setUserMatchId(userPendingMatch.id);
        } else {
          console.log('❌ Kullanıcı beklemedeki maçı bulunamadı');
          setUserMatchId(null);
        }
      }

      // Aktif turu bul ve kullanıcının o turdaki maçı tamamlanmışsa bot maçlarını bitir
      const activeRounds = data.filter(m => m.status !== 'completed').map(m => m.round);
      const activeRound = activeRounds.length ? Math.min(...activeRounds) : null;

      if (user && activeRound !== null) {
        const uid = String(user.id);
        const userMatchInActive = data.find(m => m.round === activeRound && (String(m.player1_id) === uid || String(m.player2_id) === uid));
        if (userMatchInActive && userMatchInActive.status === 'completed' && handledRound !== activeRound) {
          console.log(`✅ Kullanıcının ${activeRound}. tur maçı bitmiş; kalan maçlar otomatik tamamlanacak.`);
          setHandledRound(activeRound);
          await handleUserMatchCompleted();
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
                .eq('id', match.player1_id)
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
      
      // Final tamamlandıysa şampiyon kartını göster
      const finals = matchesWithPlayerInfo.filter(m => m.round === 3);
      if (finals.length > 0) {
        const finalCompleted = finals.every(m => m.status === 'completed');
        setIsTournamentCompleted(finalCompleted);
        if (finalCompleted && !championShown) {
          const finalMatch = finals[0];
          const winnerId = finalMatch.winner_id;
          if (winnerId && String(winnerId) === String(user?.id)) {
            const name = finalMatch.player1_id === winnerId ? finalMatch.player1?.username : finalMatch.player2?.username;
            setChampionName(name || 'Şampiyon');
            setChampionShown(true);
            setChampionVisible(true);
          }
        }
      }
      
    } catch (error) {
      console.error('fetchMatches error:', error);
    }
  };

  const startAllMatches = async () => {
    if (!tournamentId) return;

    try {
      console.log('🎮 Tüm maçlar başlatılıyor...');
      
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
      
      if (user && userMatchId) {
        console.log('🎯 Anında kullanıcı maçına yönlendiriliyor:', userMatchId);
        navigate(`/game?match=${userMatchId}&tournament=${tournamentId}`);
        return;
      }
      
      // Kullanıcı maçı bulunamazsa tekrar kontrol et
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
            navigate(`/game?match=${userMatch.id}&tournament=${tournamentId}`);
          }
        }, 2000);
      }
      
      await startBotMatches();

    } catch (error) {
      console.error('Maç başlatma hatası:', error);
    }
  };

  // Kullanıcının maçı tamamlandığında çağrılacak
  const handleUserMatchCompleted = async () => {
    try {
      console.log('👤 Kullanıcı maçı tamamlandı, kalan bot maçları bitiriliyor...');

      // Kullanıcıya ait olmayan ve pending/in_progress durumundaki maçları al
      const { data: remaining } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .in('status', ['pending', 'in_progress']);

      if (!remaining || remaining.length === 0) {
        await checkNextRoundCreation(String(tournamentId));
        return;
      }

      for (const match of remaining) {
        const isUserMatch = user && (
          String(match.player1_id) === String(user.id) ||
          String(match.player2_id) === String(user.id)
        );
        if (isUserMatch) continue;

        // Bot kimliklerini normalize et (null ise bot_... ver)
        const p1 = match.player1_id || `bot_${String(match.id).slice(-4)}_1`;
        const p2 = match.player2_id || `bot_${String(match.id).slice(-4)}_2`;

        const player1Score = Math.floor(Math.random() * 30) + 15;
        const player2Score = Math.floor(Math.random() * 30) + 15;
        const winnerId = player1Score >= player2Score ? p1 : p2;

        await supabase
          .from('tournament_matches')
          .update({
            status: 'completed',
            player1_id: p1,
            player2_id: p2,
            player1_score: player1Score,
            player2_score: player2Score,
            winner_id: winnerId,
            updated_at: new Date().toISOString()
          })
          .eq('id', match.id);

        console.log(`✅ Bot maçı tamamlandı (auto): ${String(match.id).slice(-8)}`);
      }

      await checkNextRoundCreation(String(tournamentId));
    } catch (error) {
      console.error('Kullanıcı maçı sonrası otomasyon hatası:', error);
    }
  };

 const startBotMatches = async () => {
  try {
    console.log('🤖 Bot maçları başlatılıyor...');
    
    // Kullanıcıya ait olmayan ve pending/in_progress durumundaki maçları hedefle
    const { data: botMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .in('status', ['pending', 'in_progress']);
    
    if (!botMatches) return;
    
    const userIdString = String(user?.id);
    const targets = botMatches.filter(match => (
      String(match.player1_id) !== userIdString && String(match.player2_id) !== userIdString
    ));
    
    console.log(`🤖 Tamamlanacak bot maçı: ${targets.length}`);
    
    for (const match of targets) {
      // Bot maçlarını hızlıca bitir
      setTimeout(async () => {
        try {
          const p1 = match.player1_id || `bot_${String(match.id).slice(-4)}_1`;
          const p2 = match.player2_id || `bot_${String(match.id).slice(-4)}_2`;
          const player1Score = Math.floor(Math.random() * 30) + 15;
          const player2Score = Math.floor(Math.random() * 30) + 15;
          const winnerId = player1Score >= player2Score ? p1 : p2;
          
          await supabase
            .from('tournament_matches')
            .update({
              status: 'completed',
              player1_id: p1,
              player2_id: p2,
              player1_score: player1Score,
              player2_score: player2Score,
              winner_id: winnerId,
              updated_at: new Date().toISOString()
            })
            .eq('id', match.id);
            
          console.log(`✅ Bot maçı tamamlandı: ${String(match.id).slice(-8)}`);
          
        } catch (error) {
          console.error('Bot maçı tamamlama hatası:', error);
        }
      }, Math.random() * 1500 + 500);
    }
  } catch (error) {
    console.error('Bot maçları başlatma hatası:', error);
  }
};

const checkNextRoundCreation = async (tournamentId: string) => {
  try {
    console.log('🔍 Sonraki tur kontrol ediliyor...');
    
    // Mevcut turdaki tüm maçlar
    const { data: allMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round', { ascending: true });
    
    if (!allMatches || allMatches.length === 0) return;
    
    // Her turun durumunu kontrol et
    const rounds = [1, 2, 3];
    
    for (const round of rounds) {
      const roundMatches = allMatches.filter(m => m.round === round);
      
      if (roundMatches.length === 0) continue;
      
      const completedMatches = roundMatches.filter(m => m.status === 'completed');
      const allRoundComplete = completedMatches.length === roundMatches.length;
      
      console.log(`📊 ${round}. tur: ${completedMatches.length}/${roundMatches.length} tamamlandı`);
      
      if (allRoundComplete && round < 3) {
        // Sonraki tur var mı kontrol et
        const nextRound = round + 1;
        const nextRoundMatches = allMatches.filter(m => m.round === nextRound);
        
        if (nextRoundMatches.length === 0) {
          console.log(`🔄 ${nextRound}. tur oluşturuluyor...`);
          await createNextRound(tournamentId, nextRound);
          return; // Bir tur oluşturduktan sonra çık
        }
      } else if (allRoundComplete && round === 3) {
        console.log('🎉 Turnuva tamamlandı!');
        await supabase
          .from('tournaments')
          .update({
            status: 'completed',
            finished_at: new Date().toISOString()
          })
          .eq('id', tournamentId);
      }
    }
  } catch (error) {
    console.error('Sonraki tur kontrol hatası:', error);
  }
};
const createNextRound = async (tournamentId: string, nextRound: number) => {
  try {
    console.log(`🔄 ${nextRound}. tur maçları oluşturuluyor...`);
    
    // Önceki turun kazananlarını al
    const { data: winners } = await supabase
      .from('tournament_matches')
      .select('winner_id')
      .eq('tournament_id', tournamentId)
      .eq('round', nextRound - 1)
      .eq('status', 'completed')
      .not('winner_id', 'is', null);
    
    if (!winners || winners.length === 0) {
      console.error('Kazanan bulunamadı');
      return;
    }
    
    // Kazananları karıştır
    const winnerIds = winners.map(w => w.winner_id);
    const shuffledWinners = [...winnerIds].sort(() => Math.random() - 0.5);
    
    // Kazanan sayısına göre doğru maç sayısını hesapla
    const actualMatches = Math.floor(shuffledWinners.length / 2);
    
    console.log(`📊 ${nextRound}. tur için: ${shuffledWinners.length} kazanan, ${actualMatches} maç oluşturuluyor`);
    
    // Önce mevcut maçları kontrol et
    const { data: existingMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', nextRound);
    
    if (existingMatches && existingMatches.length > 0) {
      // Mevcut maçları kazananlarla güncelle
      console.log(`🔄 ${nextRound}. tur için mevcut maçlar güncelleniyor...`);
      
      for (let i = 0; i < Math.min(actualMatches, existingMatches.length); i++) {
        const player1Id = shuffledWinners[i * 2];
        const player2Id = shuffledWinners[i * 2 + 1];
        
        await supabase
          .from('tournament_matches')
          .update({
            player1_id: player1Id,
            player2_id: player2Id,
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMatches[i].id);
      }
      
      console.log(`✅ ${nextRound}. tur için ${actualMatches} maç güncellendi`);
    } else {
      // Yeni tur maçlarını oluştur
      const newMatches = [];
      for (let i = 0; i < actualMatches; i++) {
        const player1Id = shuffledWinners[i * 2];
        const player2Id = shuffledWinners[i * 2 + 1];
        
        newMatches.push({
          tournament_id: tournamentId,
          round: nextRound,
          match_number: i + 1,
          player1_id: player1Id,
          player2_id: player2Id,
          status: 'pending',
          created_at: new Date().toISOString()
        });
      }
      
      // Database'e kaydet
      const { error } = await supabase
        .from('tournament_matches')
        .insert(newMatches);
      
      if (error) {
        console.error('Yeni tur maçları kaydedilemedi:', error);
        return;
      }
      
      console.log(`✅ ${nextRound}. tur için ${newMatches.length} maç oluşturuldu`);
    }
    
    // Turnuva bilgisini güncelle
    await supabase
      .from('tournaments')
      .update({ 
        current_round: nextRound,
        updated_at: new Date().toISOString()
      })
      .eq('id', tournamentId);
    
    // Maçları yeniden yükle
    fetchMatches();
    
  } catch (error) {
    console.error('Yeni tur oluşturma hatası:', error);
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
      
        {/* Şampiyonluk Kartı */}
        <Dialog open={championVisible} onOpenChange={(open) => {
          setChampionVisible(open);
          if (!open) navigate('/tournament');
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-center">
                🏆 Şampiyonsun!
              </DialogTitle>
              <DialogDescription className="text-center">
                Tebrikler {championName}! Turnuvanın kazananısın.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center mt-2">
              <Button onClick={() => navigate('/tournament')}>
                Turnuvaya Dön
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default TournamentBracketPage;