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
  const [countdowns, setCountdowns] = useState<{[key: string]: number}>({});

  useEffect(() => {
    if (tournamentId) {
      fetchMatches();
      
      // 10 saniye sonra tüm maçları otomatik başlat
      const startTimer = setTimeout(() => {
        startAllMatches();
      }, 10000); // 10 saniye

      return () => {
        clearTimeout(startTimer);
      };
    }
  }, [tournamentId, matches.length]);

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

  const fetchMatches = async () => {
    try {
      console.log('⚔️ Maçlar alınıyor...');
      
      // Önce sadece temel maç bilgilerini al
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
        console.log('Maç bulunamadı');
        setMatches([]);
        return;
      }

      console.log('✅ Maçlar alındı:', data.length);

      // Eğer bot değilse, oyuncu bilgilerini ayrıca al
      const matchesWithPlayerInfo = await Promise.all(
        data.map(async (match) => {
          let player1Info = { username: 'Oyuncu', avatar_url: null, is_bot: false };
          let player2Info = { username: 'Oyuncu', avatar_url: null, is_bot: false };

          // Player 1 bilgilerini al
          if (match.player1_id && match.player1_id.startsWith('bot_')) {
            player1Info = {
              username: `Bot ${match.player1_id.split('_').pop()}`,
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
          if (match.player2_id && match.player2_id.startsWith('bot_')) {
            player2Info = {
              username: `Bot ${match.player2_id.split('_').pop()}`,
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
      console.error('Maçlar alınamadı:', error);
    }
  };

  const startAllMatches = async () => {
    if (!tournamentId) return;

    try {
      console.log('🎮 Tüm maçlar başlatılıyor...');
      
      // Tüm maçları "in_progress" yap
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
      
      // Her maç için gerçek oyun başlat
      startRealMatches();

    } catch (error) {
      console.error('Maç başlatma hatası:', error);
    }
  };

  // Gerçek kelime oyunu maçları
 const startRealMatches = async () => {
  const pendingMatches = matches.filter(m => m.status === 'in_progress');
  
  let userMatchFound = false;

  for (const match of pendingMatches) {
    if (match.player1_id?.startsWith('bot_') && match.player2_id?.startsWith('bot_')) {
      // AI vs AI maçı - hemen başlat
      console.log(`🤖 AI vs AI maçı: ${match.id}`);
      simulateAIMatch(match.id);
    } else if (user && (match.player1_id === user.id || match.player2_id === user.id)) {
      // Kullanıcının maçı - işaretle ve döngüden çık
      console.log(`🎯 Kullanıcı maçı bulundu: ${match.id}`);
      userMatchFound = true;
      startUserMatch(match.id);
      break; // Döngüden çık, sadece bir maça yönlendir
    } else {
      // Diğer AI maçları - hemen başlat
      console.log(`🤖 AI maçı: ${match.id}`);
      simulateAIMatch(match.id);
    }
  }

  // Eğer kullanıcı maçı yoksa ve user varsa, hata ver
  if (!userMatchFound && user) {
    console.log('❌ Kullanıcı maçı bulunamadı!');
    // Belki bir hata mesajı göster
  }
};

  // Kullanıcı maçı başlat
const startUserMatch = (matchId: string) => {
  console.log('🎮 Kullanıcı maçı başlatılıyor:', matchId);
  
  // 1 saniye bekle ve yönlendir (animasyon için)
  setTimeout(() => {
    navigate(`/game/tournament?match=${matchId}`);
  }, 1000);
};

  // AI vs AI maç simülasyonu (KELİME OYUNU MANTIĞIYLA)
  const simulateAIMatch = async (matchId: string) => {
    try {
      const match = matches.find(m => m.id === matchId);
      if (!match) return;

      console.log(`🤖 AI maçı: ${matchId}`);
      
      // GamePage'deki kelime oyunu mantığı
      const player1Score = await simulateAIPlayer(match.player1_id, 'AI Player 1');
      const player2Score = await simulateAIPlayer(match.player2_id, 'AI Player 2');

      // Kazananı belirle
      const winnerId = player1Score > player2Score ? match.player1_id : match.player2_id;

      // Maçı tamamla
      const { error } = await supabase
        .from('tournament_matches')
        .update({
          status: 'completed',
          player1_score: player1Score,
          player2_score: player2Score,
          winner_id: winnerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchId);

      if (error) {
        console.error('Maç sonuçlandırma hatası:', error);
      } else {
        console.log(`✅ AI maçı tamamlandı: ${player1Score}-${player2Score}`);
      }

    } catch (error) {
      console.error('AI maç simülasyonu hatası:', error);
    }
  };

  // AI Oyuncu Simülasyonu (KELİME BULMA MANTIĞI)
  const simulateAIPlayer = async (playerId: string, playerName: string): Promise<number> => {
    console.log(`🧠 ${playerName} kelime buluyor...`);
    
    // GamePage'deki kelime bulma mantığı
    const possibleWords = [
      'KEDİ', 'MASA', 'ARABA', 'OKUL', 'KİTAP', 'DENİZ', 'AĞAÇ', 'ÇİÇEK',
      'DOSTLUK', 'GÜNEŞ', 'YILDIZ', 'BULUT', 'RÜZGAR', 'ATEŞ', 'TOPRAK',
      'SEVGİ', 'MUTLULUK', 'UMUT', 'HAYAL', 'RENKLER', 'MÜZİK', 'DANS', 'ŞARKI',
      'OYUN', 'SPOR', 'FUTBOL', 'BASKETBOL', 'TENİS', 'YÜZME', 'KOŞU', 'BİSİKLET',
      'YEMEK', 'EKMEK', 'PEYNİR', 'DOMATES', 'SALATA', 'ÇORBA', 'MEYVE',
      'ELMA', 'ARMUT', 'ÇİLEK', 'KIRAZ', 'ÜZÜM', 'PORTAKAL', 'MANGO',
      'SEBZE', 'HAVUÇ', 'PATLICAN', 'BİBER', 'SOĞAN', 'SARIMSAK', 'PATATES'
    ];

    // Rastgele kelimeler seç ve puan hesapla
    let totalScore = 0;
    const wordCount = Math.floor(Math.random() * 8) + 5; // 5-12 kelime

    for (let i = 0; i < wordCount; i++) {
      const randomWord = possibleWords[Math.floor(Math.random() * possibleWords.length)];
      const wordLength = randomWord.length;
      
      // GamePage'deki puanlama mantığı
      const basePoints = wordLength * 2;
      const rareLetters = ['J', 'Z', 'Ğ', 'Ü', 'Ö', 'Ç', 'Ş'];
      let rareBonus = 0;

      for (const letter of randomWord) {
        if (rareLetters.includes(letter)) {
          rareBonus += 3;
        }
      }

      const wordScore = Math.max(basePoints + rareBonus, 5);
      totalScore += wordScore;

      console.log(`📝 ${playerName}: "${randomWord}" (+${wordScore} puan)`);
      
      // Kelime başına 1-2 saniye bekle (gerçekçilik için)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
    }

    console.log(`🏁 ${playerName} toplam: ${totalScore} puan`);
    return totalScore;
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
    
    return player.username || player.user_id?.slice(-8) || 'Oyuncu';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Başlık */}
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">Turnuva Kurgusu</h1>
          <p className="text-gray-300 mb-4">Turnuva #{tournamentId?.slice(-8)}</p>
          
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
                  <Card key={match.id} className="bg-white/10 backdrop-blur-md border-white/20">
                    <CardContent className="p-4">
                      <div className="text-center text-sm text-gray-300 mb-2">
                        Maç {match.match_number}
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
                            <span className="text-white text-sm">
                              {getPlayerDisplayName(match.player1)}
                            </span>
                          </div>
                          <span className="font-bold text-white">
                            {match.player1_score || 0}
                          </span>
                        </div>

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
                            <span className="text-white text-sm">
                              {getPlayerDisplayName(match.player2)}
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