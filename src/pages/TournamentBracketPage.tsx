import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Home, User, Bot } from 'lucide-react';
import { TournamentMatch } from '@/types/tournament';

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<TournamentMatch[]>([]);

  useEffect(() => {
    if (tournamentId) {
      fetchMatches();
      
      // Real-time maç takibi
      const channel = supabase
        .channel(`tournament-matches-${tournamentId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_matches',
          filter: `tournament_id=eq.${tournamentId}`
        }, (payload) => {
          console.log('🔄 Maç güncellendi:', payload.new);
          fetchMatches(); // Maçları yenile
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [tournamentId]);

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
          <p className="text-gray-300">Turnuva #{tournamentId?.slice(-8)}</p>
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