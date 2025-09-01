import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Home } from 'lucide-react';
import { TournamentMatch } from '@/types/tournament';

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<TournamentMatch[]>([]);

  useEffect(() => {
    if (tournamentId) {
      fetchMatches();
    }
  }, [tournamentId]);

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: true })
        .order('match_number', { ascending: true });

      if (!error && data) {
        setMatches(data);
        console.log('⚔️ Maçlar alındı:', data);
      }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-4xl mx-auto">
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
                        <div className={`flex items-center justify-between p-2 rounded ${
                          match.winner_id === match.player1_id ? 'bg-green-500/20' : 'bg-white/5'
                        }`}>
                          <span className="text-white text-sm">
                            {match.player1_id?.startsWith('bot_') 
                              ? `Bot ${match.player1_id.split('_').pop()}`
                              : match.player1_id?.slice(-8)}
                          </span>
                          <span className="font-bold text-white">
                            {match.player1_score || 0}
                          </span>
                        </div>

                        <div className={`flex items-center justify-between p-2 rounded ${
                          match.winner_id === match.player2_id ? 'bg-green-500/20' : 'bg-white/5'
                        }`}>
                          <span className="text-white text-sm">
                            {match.player2_id?.startsWith('bot_') 
                              ? `Bot ${match.player2_id.split('_').pop()}`
                              : match.player2_id?.slice(-8)}
                          </span>
                          <span className="font-bold text-white">
                            {match.player2_score || 0}
                          </span>
                        </div>
                      </div>

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