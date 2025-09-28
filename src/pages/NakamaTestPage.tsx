import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { NakamaMatchmakingProvider, useNakamaMatchmaking } from '@/contexts/NakamaMatchmakingContext';
import { ArrowLeft, Search, Home, Trophy, Users } from 'lucide-react';

const NakamaTestContent: React.FC = () => {
  const navigate = useNavigate();
  const {
    isSearching,
    currentMatch,
    searchProgress,
    matchFound,
    startRandomMatch,
    createPrivateRoom,
    joinPrivateRoom,
    createTournament,
    joinTournament,
    cancelSearch
  } = useNakamaMatchmaking();

  const [gameType, setGameType] = useState<'timed' | 'score'>('timed');
  const [roomCode, setRoomCode] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentId, setTournamentId] = useState('');

  const handleMatchFound = (matchId: string, gameType: 'timed' | 'score') => {
    console.log('🎮 Match found, navigating to game:', { matchId, gameType });
    // Navigate to actual game page with Nakama match
    navigate(`/game?nakama=${matchId}&type=${gameType}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ana Sayfa
          </Button>
          <h1 className="text-3xl font-bold">Nakama Test Arena</h1>
          <Badge variant="secondary">Beta</Badge>
        </div>

        {/* Status Card */}
        {(isSearching || matchFound) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                {isSearching ? 'Oyuncu Aranıyor...' : 'Eşleşme Bulundu!'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isSearching && (
                <>
                  <Progress value={searchProgress} className="w-full" />
                  <p className="text-center text-muted-foreground">
                    {Math.floor(searchProgress)}% - Nakama ile eşleşme aranıyor...
                  </p>
                  <div className="flex justify-center">
                    <Button onClick={cancelSearch} variant="destructive">
                      Aramayı İptal Et
                    </Button>
                  </div>
                </>
              )}
              
              {matchFound && currentMatch && (
                <div className="text-center space-y-2">
                  <p className="text-lg font-semibold text-green-600">
                    🎉 Eşleşme bulundu!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Match ID: {currentMatch.matchId}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Oyuncular: {currentMatch.players.length}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Random Matchmaking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Rastgele Eşleşme
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  variant={gameType === 'timed' ? 'default' : 'outline'}
                  onClick={() => setGameType('timed')}
                  className="flex-1"
                >
                  Zamana Karşı
                </Button>
                <Button 
                  variant={gameType === 'score' ? 'default' : 'outline'}
                  onClick={() => setGameType('score')}
                  className="flex-1"
                >
                  Puanlı
                </Button>
              </div>
              
              <Button 
                onClick={() => startRandomMatch(gameType)}
                disabled={isSearching}
                className="w-full"
              >
                {isSearching ? 'Aranıyor...' : 'Nakama ile Eşleş'}
              </Button>
            </CardContent>
          </Card>

          {/* Private Rooms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5" />
                Özel Odalar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => createPrivateRoom(gameType)}
                className="w-full"
              >
                Oda Oluştur ({gameType === 'timed' ? 'Zamana Karşı' : 'Puanlı'})
              </Button>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Oda kodu girin"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                />
                <Button 
                  onClick={() => joinPrivateRoom(roomCode)}
                  disabled={!roomCode}
                >
                  Katıl
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tournaments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Turnuvalar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Turnuva adı"
                  value={tournamentName}
                  onChange={(e) => setTournamentName(e.target.value)}
                />
                <Button 
                  onClick={() => createTournament(tournamentName)}
                  disabled={!tournamentName}
                >
                  Oluştur
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Turnuva ID"
                  value={tournamentId}
                  onChange={(e) => setTournamentId(e.target.value)}
                />
                <Button 
                  onClick={() => joinTournament(tournamentId)}
                  disabled={!tournamentId}
                >
                  Katıl
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Nakama Avantajları
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Authoritative server
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Global matchmaking pool
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Built-in tournament sistem
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Real-time sync
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Otomatik cleanup
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Info */}
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              🚀 Bu sayfa Nakama entegrasyonunu test etmek için oluşturulmuştur. 
              Nakama server bilgilerini doğru girdiğinizden emin olun.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const NakamaTestPage: React.FC = () => {
  const handleMatchFound = (matchId: string, gameType: 'timed' | 'score') => {
    console.log('🎮 Nakama match found:', { matchId, gameType });
  };

  return (
    <NakamaMatchmakingProvider onMatchFound={handleMatchFound}>
      <NakamaTestContent />
    </NakamaMatchmakingProvider>
  );
};

export default NakamaTestPage;