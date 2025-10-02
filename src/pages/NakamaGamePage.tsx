import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Users, Clock, Trophy, Loader2 } from 'lucide-react';
import { nakamaService } from '@/services/nakamaService';
import { useAuth } from '@/contexts/AuthContext';

const NakamaGamePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const matchId = searchParams.get('match');
  const gameType = searchParams.get('type') as 'timed' | 'score';
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [playersReady, setPlayersReady] = useState<Set<string>>(new Set());
  const [gameStartSignals, setGameStartSignals] = useState<Set<string>>(new Set());
  const [hasStarted, setHasStarted] = useState(false);
  const [joinedMatchId, setJoinedMatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId || !gameType || !user) {
      setError('Geçersiz oyun parametreleri');
      setLoading(false);
      return;
    }

    initializeNakamaGame();
  }, [matchId, gameType, user]);

  useEffect(() => {
    // Her iki oyuncu "Başlat" sinyali gönderdiğinde oyunu başlat
    if (gameStartSignals.size >= 2 && !hasStarted) {
      console.log('🚀 İki oyuncu da başlat dedi, oyun başlıyor!');
      setHasStarted(true);
      startActualGame();
    }
  }, [gameStartSignals, hasStarted]);

 const initializeNakamaGame = async () => {
  try {
    setLoading(true);
    console.log('🎮 Nakama game starting:', { matchId, gameType });

    let socket = nakamaService.getSocket();
    
    if (!socket) {
      await nakamaService.authenticate(user.id);
      socket = await nakamaService.createSocket();
    }

    // ÖNEMLİ: Match'e katıl
    try {
      const joinResult = await (socket as any).joinMatch(matchId);
      const realMatchId = joinResult.match_id ?? joinResult.matchId;
      setJoinedMatchId(realMatchId);
      console.log('✅ Joined match with id:', realMatchId, 'token:', matchId);

      // Mevcut oyuncu sayısını presences üzerinden başlat
      const others = (joinResult.presences?.length ?? 0);
      setTotalPlayers(1 + others);

      // Hazır sinyali gönder
      const readyMsg = JSON.stringify({ type: 'player_ready', userId: user.id });
      const encoder = new TextEncoder();
      (socket as any).sendMatchState(realMatchId, 1, encoder.encode(readyMsg));
      setPlayersReady(prev => new Set([...prev, user.id]));
      console.log('✅ Ready signal sent (post-join)');
    } catch (joinError) {
      console.error('❌ Join match failed:', joinError);
      setError('Maça katılım başarısız. Lütfen tekrar deneyin.');
      setLoading(false);
      return;
    }

    // Match presence listener - oyuncu sayısını al
    (socket as any).onmatchpresence = (presence: any) => {
      console.log('👥 Match presence event:', presence);
      
      // Joins array'inden toplam oyuncu sayısını hesapla
      if (presence.joins && presence.joins.length > 0) {
        setTotalPlayers(prev => {
          const newTotal = prev + presence.joins.length;
          console.log(`👥 Toplam oyuncu: ${newTotal}`);
          return newTotal;
        });
      }
      
      // Leaves array'inden oyuncu ayrıldığında azalt
      if (presence.leaves && presence.leaves.length > 0) {
        setTotalPlayers(prev => Math.max(0, prev - presence.leaves.length));
      }
    };

    // Match data listener
    (socket as any).onmatchdata = (matchData: any) => {
      try {
        const content = JSON.parse(new TextDecoder().decode(matchData.data));
        console.log('📨 Received:', content);
        
        if (content.type === 'player_ready') {
          console.log('✅ Player ready:', content.userId);
          setPlayersReady(prev => new Set([...prev, content.userId]));
        }
        
        if (content.type === 'game_start_request') {
          console.log('🎮 Player requested start:', content.userId);
          setGameStartSignals(prev => new Set([...prev, content.userId]));
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    };

    setLoading(false);
  } catch (error: any) {
    console.error('❌ Init failed:', error);
    setError(error.message);
    setLoading(false);
  }
};

  const handleStartGame = () => {
    const socket = nakamaService.getSocket();
    const targetMatchId = joinedMatchId ?? matchId;
    
    if (!socket || !targetMatchId) {
      console.error('Socket or matchId not available');
      return;
    }
  
    console.log('🎮 Oyuncu başlat sinyali gönderiyor');
    
    // Başlatma isteği gönder
    const startMessage = JSON.stringify({ 
      type: 'game_start_request',
      userId: user.id,
      timestamp: Date.now()
    });
    const encoder = new TextEncoder();
    (socket as any).sendMatchState(targetMatchId, 1, encoder.encode(startMessage));
    
    // Kendi sinyalini de ekle
    setGameStartSignals(prev => new Set([...prev, user.id]));
  };
  const startActualGame = () => {
    console.log('🚀 Starting actual game - navigating to GamePage');
    // Random match mode olarak başlat, nakama matchId'yi room_id gibi kullan
    const targetRoom = joinedMatchId ?? matchId;
    navigate(`/game?mode=random-match&room=${targetRoom}&type=${gameType}`);
  };
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h2 className="text-xl font-bold mb-2">Nakama Oyunu Hazırlanıyor</h2>
            <p className="text-muted-foreground">
              Match ID: {matchId}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Lütfen bekleyin...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-destructive/10 to-red-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive text-center">Hata</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="flex-1"
              >
                <Home className="w-4 h-4 mr-2" />
                Ana Sayfa
              </Button>
              <Button 
                onClick={initializeNakamaGame}
                className="flex-1"
              >
                Tekrar Dene
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl">🎉 Nakama Eşleşme Hazır!</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6 text-center">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              {gameType === 'timed' ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>Zamana Karşı Oyun</span>
                </>
              ) : (
                <>
                  <Trophy className="w-4 h-4" />
                  <span>Puanlı Oyun</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-blue-800">
              👥 Oyuncular: {totalPlayers}/2
            </h3>
            <div className="text-sm text-blue-700">
              <p>✅ Hazır: {playersReady.size}/2</p>
              <p>🎮 Başlatma: {gameStartSignals.size}/2</p>
            </div>
            {totalPlayers < 2 && (
              <p className="text-sm text-blue-600 animate-pulse">
                Diğer oyuncu bekleniyor...
              </p>
            )}
            {totalPlayers === 2 && gameStartSignals.size < 2 && (
              <p className="text-sm font-medium text-green-700">
                ⚡ Her iki oyuncu "Başlat" butonuna basmalı!
              </p>
            )}
            {gameStartSignals.size === 2 && (
              <p className="text-sm font-bold text-green-700 animate-pulse">
                🚀 Oyun başlıyor...
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleStartGame}
              disabled={totalPlayers < 2 || gameStartSignals.has(user.id) || hasStarted}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50"
              size="lg"
            >
              {hasStarted ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Oyun Başlıyor...
                </>
              ) : gameStartSignals.has(user.id) ? (
                <>
                  ⏳ Diğer Oyuncu Bekleniyor...
                </>
              ) : totalPlayers < 2 ? (
                <>
                  ⏳ Oyuncu Bekleniyor...
                </>
              ) : (
                <>🚀 Hazırım / Başlat</>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Ana Sayfaya Dön
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Her iki oyuncu "Başlat" butonuna basmalı</p>
            <p>• İki oyuncu da bastığında oyun otomatik başlar</p>
            <p>• Oyun tamamen senkronize olacak</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NakamaGamePage;