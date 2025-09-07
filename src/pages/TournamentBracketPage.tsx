import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Trophy, Home, Clock, Play, Crown } from 'lucide-react';
import { useTournament } from '@/hooks/useTournament';
import { organizeMatchesByRound, getRoundName, getMatchStatus } from '@/utils/tournamentHelpers';

const TournamentBracketPage = () => {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const { currentTournament, matches, loading, fetchTournamentDetails } = useTournament(tournamentId);
  
  const [countdown, setCountdown] = useState(10);
  const [showChampion, setShowChampion] = useState(false);

  useEffect(() => {
    if (tournamentId) {
      fetchTournamentDetails(tournamentId);
    }
  }, [tournamentId]);

  // Real-time match updates
  useEffect(() => {
    if (!tournamentId) return;

    const interval = setInterval(() => {
      fetchTournamentDetails(tournamentId);
    }, 3000);

    return () => clearInterval(interval);
  }, [tournamentId]);

  // Countdown for match start
  useEffect(() => {
    if (matches.length === 0) return;

    const hasPendingMatches = matches.some(m => m.status === 'pending');
    if (!hasPendingMatches) return;

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Start matches here
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [matches]);

  // Check for tournament completion
  useEffect(() => {
    const finalMatches = matches.filter(m => m.round === 3);
    if (finalMatches.length > 0 && finalMatches.every(m => m.status === 'completed')) {
      setShowChampion(true);
      setTimeout(() => {
        navigate('/tournament');
      }, 5000);
    }
  }, [matches, navigate]);

  if (loading || !currentTournament) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Turnuva bracket yükleniyor...</p>
          <p className="text-sm text-gray-300 mt-2">
            Turnuva: {currentTournament?.name || 'Bilinmiyor'} | 
            Durum: {currentTournament?.status || 'Bilinmiyor'} | 
            Maç Sayısı: {matches.length}
          </p>
        </div>
      </div>
    );
  }

  const matchesByRound = organizeMatchesByRound(matches);
  const hasPendingMatches = matches.some(m => m.status === 'pending');

  const MatchCard = ({ match, roundNumber }: { match: any, roundNumber: number }) => {
    const getPlayerInfo = (playerId: string, isPlayer1: boolean) => {
      if (!playerId) return { name: 'TBD', isBot: false };
      
      if (playerId.startsWith('bot_')) {
        return { name: `Bot ${playerId.split('_').pop()}`, isBot: true };
      }
      
      // Get from match player info
      const playerInfo = isPlayer1 ? match.player1 : match.player2;
      return { 
        name: playerInfo?.username || 'Oyuncu', 
        isBot: playerInfo?.is_bot || false 
      };
    };

    const player1 = getPlayerInfo(match.player1_id, true);
    const player2 = getPlayerInfo(match.player2_id, false);
    const isCompleted = match.status === 'completed';
    const winner = match.winner_id;

    return (
      <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-3">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Maç {match.match_number}</span>
              <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                {getMatchStatus(match)}
              </span>
            </div>
            
            {/* Player 1 */}
            <div className={`flex items-center justify-between p-2 rounded ${
              isCompleted && winner === match.player1_id 
                ? 'bg-green-500/20 border border-green-500/40' 
                : 'bg-gray-500/10'
            }`}>
              <span className="text-white font-medium">{player1.name}</span>
              {isCompleted && <span className="text-white font-bold">{match.player1_score}</span>}
            </div>
            
            {/* VS */}
            <div className="text-center text-gray-400 text-sm">VS</div>
            
            {/* Player 2 */}
            <div className={`flex items-center justify-between p-2 rounded ${
              isCompleted && winner === match.player2_id 
                ? 'bg-green-500/20 border border-green-500/40' 
                : 'bg-gray-500/10'
            }`}>
              <span className="text-white font-medium">{player2.name}</span>
              {isCompleted && <span className="text-white font-bold">{match.player2_score}</span>}
            </div>
            
            {match.status === 'in_progress' && (
              <Button 
                onClick={() => navigate(`/game?match=${match.id}&tournament=${tournamentId}`)}
                className="w-full bg-green-500 hover:bg-green-600"
              >
                <Play className="w-4 h-4 mr-2" />
                Maça Katıl
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (showChampion) {
    const finalMatch = matches.find(m => m.round === 3);
    const championId = finalMatch?.winner_id;
    const championName = championId === finalMatch?.player1_id 
      ? finalMatch?.player1?.username 
      : finalMatch?.player2?.username;

    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-600 to-orange-600 p-4 flex items-center justify-center">
        <div className="text-center">
          <Crown className="w-24 h-24 text-yellow-200 mx-auto mb-6 animate-bounce" />
          <h1 className="text-6xl font-bold text-white mb-4">Şampiyon!</h1>
          <h2 className="text-3xl text-yellow-200 mb-8">{championName || 'Bilinmeyen'}</h2>
          <p className="text-white text-lg">5 saniye sonra turnuva listesine döneceksiniz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            onClick={() => navigate('/tournament')}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
          >
            <Home className="w-4 h-4 mr-2" />
            Ana Sayfa
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white">{currentTournament.name}</h1>
            <p className="text-gray-300">Turnuva Bracket</p>
          </div>
          
          <div className="w-24"></div> {/* Spacer */}
        </div>

        {/* Countdown */}
        {hasPendingMatches && countdown > 0 && (
          <Card className="mb-6 bg-white/10 backdrop-blur-md border-white/20">
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-white font-bold">Maçlar başlıyor: {countdown}s</p>
            </CardContent>
          </Card>
        )}

        {/* Bracket */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(round => (
            <div key={round} className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center justify-center">
                  <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                  {getRoundName(round)}
                </h2>
              </div>
              
              {matchesByRound[round]?.map(match => (
                <MatchCard key={match.id} match={match} roundNumber={round} />
              )) || (
                <Card className="bg-white/5 backdrop-blur-md border-white/10">
                  <CardContent className="p-4 text-center text-gray-400">
                    {matches.length === 0 ? 'Maçlar henüz oluşturulmadı' : `Round ${round} maçları mevcut değil`}
                    <div className="text-xs mt-2">
                      Toplam maç: {matches.length} | Bu round: {matchesByRound[round]?.length || 0}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TournamentBracketPage;