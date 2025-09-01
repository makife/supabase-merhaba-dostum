import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Users, Clock } from 'lucide-react';

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const [matches, setMatches] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [globalCountdown, setGlobalCountdown] = useState(10);

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

  const fetchTournamentData = async () => {
    try {
      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      setTournament(tournamentData);
      fetchMatches();
    } catch (error) {
      console.error('Turnuva verisi alınamadı:', error);
    }
  };

  const fetchMatches = async () => {
    try {
      const { data } = await supabase
        .from('tournament_matches')
        .select(`
          *,
          player1:player1_id (username, avatar_url, is_bot),
          player2:player2_id (username, avatar_url, is_bot)
        `)
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true });

      setMatches(data || []);
    } catch (error) {
      console.error('Maçlar alınamadı:', error);
    }
  };

  const subscribeToMatches = () => {
    const channel = supabase
      .channel(`tournament-matches-${tournamentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${tournamentId}`
      }, (payload) => {
        fetchMatches(); // Maç güncellemelerini dinle
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const getRoundName = (round) => {
    switch (round) {
      case 1: return 'Çeyrek Final';
      case 2: return 'Yarı Final';
      case 3: return 'Final';
      default: return `${round}. Tur`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">Turnuva Kurgusu</h1>
          <p className="text-gray-300">Turnuva #{tournamentId?.slice(-6)}</p>
        </div>

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

        {/* Tur bazında maçlar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        {/* Oyuncu 1 */}
                        <div className={`flex items-center justify-between p-2 rounded ${
                          match.winner_id === match.player1_id ? 'bg-green-500/20' : 'bg-white/5'
                        }`}>
                          <span className="text-white">
                            {match.player1?.username || 'Bot'}
                            {match.player1?.is_bot && ' 🤖'}
                          </span>
                          <span className="font-bold text-white">
                            {match.player1_score || 0}
                          </span>
                        </div>

                        {/* Oyuncu 2 */}
                        <div className={`flex items-center justify-between p-2 rounded ${
                          match.winner_id === match.player2_id ? 'bg-green-500/20' : 'bg-white/5'
                        }`}>
                          <span className="text-white">
                            {match.player2?.username || 'Bot'}
                            {match.player2?.is_bot && ' 🤖'}
                          </span>
                          <span className="font-bold text-white">
                            {match.player2_score || 0}
                          </span>
                        </div>
                      </div>

                      {/* Maç durumu */}
                      <div className="text-center mt-2 text-sm">
                        {match.status === 'completed' ? (
                          <span className="text-green-400">Tamamlandı</span>
                        ) : match.status === 'in_progress' ? (
                          <span className="text-yellow-400">Devam Ediyor</span>
                        ) : (
                          <span className="text-gray-400">Bekleniyor</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TournamentBracketPage;