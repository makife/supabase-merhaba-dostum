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
  const [playersReady, setPlayersReady] = useState<Set<string>>(new Set());
  const [canStart, setCanStart] = useState(false);
  const [waitingForOthers, setWaitingForOthers] = useState(false);

  useEffect(() => {
    if (!matchId || !gameType || !user) {
      setError('Geçersiz oyun parametreleri');
      setLoading(false);
      return;
    }

    initializeNakamaGame();
  }, [matchId, gameType, user]);

  useEffect(() => {
    // 2 oyuncu hazır olunca başlatma butonunu aktif et
    if (playersReady.size >= 2) {
      setCanStart(true);
    }
  }, [playersReady]);

  const initializeNakamaGame = async () => {
    try {
      setLoading(true);
      console.log('🎮 Nakama game starting:', { matchId, gameType });

      let socket = nakamaService.getSocket();
      
      if (!socket) {
        await nakamaService.authenticate(user.id);
        socket = await nakamaService.createSocket();
      }

      // Oyuncu hazır sinyali gönder
      socket.onopen = () => {
        console.log('✅ Socket connected, sending ready signal');
        socket.send(1, JSON.stringify({ 
          type: 'player_ready', 
          userId: user.id 
        }), true);
        
        // Kendi hazır durumunu ekle
        setPlayersReady(prev => new Set([...prev, user.id]));
      };

      // Diğer oyuncuların mesajlarını dinle
      socket.onmatchdata = (matchData: any) => {
        try {
          const data = JSON.parse(new TextDecoder().decode(matchData.data));
          console.log('📨 Received match data:', data);
          
          if (data.type === 'player_ready') {
            console.log('✅ Player ready:', data.userId);
            setPlayersReady(prev => new Set([...prev, data.userId]));
          }
          
          if (data.type === 'game_start') {
            console.log('🚀 Game starting signal received');
            startActualGame();
          }
        } catch (e) {
          console.error('Failed to parse match data:', e);
        }
      };

      console.log('✅ Socket ready, waiting for players');
      setLoading(false);

    } catch (error: any) {
      console.error('❌ Game init failed:', error);
      setError(error.message || 'Oyun başlatılamadı');
      setLoading(false);
    }
  };

  const handleStartGame = () => {
    const socket = nakamaService.getSocket();
    
    if (!socket) {
      console.error('Socket not available');
      return;
    }

    console.log('🚀 Sending game start signal');
    setWaitingForOthers(true);
    
    // Tüm oyunculara başlama sinyali gönder
    socket.send(1, JSON.stringify({ type: 'game_start' }), true);
    
    // Kendi oyununu başlat
    setTimeout(() => startActualGame(), 500);
  };

  const startActualGame = () => {
    console.log('🚀 Starting actual game with Nakama');
    navigate(`/game?mode=nakama&match=${matchId}&type=${gameType}`);
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

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">
              👥 Oyuncular: {playersReady.size}/2
            </h3>
            <p className="text-sm text-blue-700">
              {canStart 
                ? 'Tüm oyuncular hazır! Oyunu başlatabilirsiniz.' 
                : 'Diğer oyuncular bekleniyor...'}
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleStartGame}
              disabled={!canStart || waitingForOthers}
              className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:opacity-50"
              size="lg"
            >
              {waitingForOthers ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Başlatılıyor...
                </>
              ) : (
                <>🚀 Oyunu Başlat</>
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
            <p>• Her iki oyuncu hazır olduğunda buton aktif olacak</p>
            <p>• Oyun senkronize başlayacak</p>
            <p>• Bağlantı kesilirse otomatik yeniden bağlanır</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NakamaGamePage;