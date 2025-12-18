import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Users, Clock, Trophy, Loader2 } from 'lucide-react';
import { nakamaService } from '@/services/nakamaService';
import { useAuth } from '@/contexts/AuthContext';
import { matchBanlist } from '@/utils/matchBanlist';
import { useAppState } from '@/hooks/useAppState';
import { useToast } from '@/hooks/use-toast';

const NakamaGamePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const matchId = searchParams.get('matchId') || searchParams.get('match');
  const gameType = (searchParams.get('gameType') || searchParams.get('type')) as 'timed' | 'score';
  const joinToken = searchParams.get('token');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [playersReady, setPlayersReady] = useState<Set<string>>(new Set());
  const [gameStartSignals, setGameStartSignals] = useState<Set<string>>(new Set());
  const [hasStarted, setHasStarted] = useState(false);
  const [joinedMatchId, setJoinedMatchId] = useState<string | null>(null);

  // Arka plan yönetimi - bekleme ekranında arka plana giderse uyar
  useAppState({
    onBackground: () => {
      console.log('📱 Nakama oyun arka plana gitti');
      if (!hasStarted) {
        toast({
          title: "Arka Planda",
          description: "Eşleşme bekleniyor, lütfen uygulamaya dönün"
        });
      }
    },
    onForeground: () => {
      console.log('📱 Nakama oyun ön plana geldi');
    },
  });

  useEffect(() => {
    if (!matchId || !gameType || !user) {
      setError('Geçersiz oyun parametreleri');
      setLoading(false);
      return;
    }

    initializeNakamaGame();
  }, [matchId, gameType, user]);

  // Çıkarken bu maçı ban listesine ekleyip yeniden bağlanmayı engelle
  useEffect(() => {
    return () => {
      try { if (joinedMatchId) { matchBanlist.add(joinedMatchId); } } catch {}
      try { (nakamaService as any).setLastMatch?.({ id: '', token: null }); } catch {}
    };
  }, [joinedMatchId]);

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
    console.log('🎮 Nakama game starting:', { matchId, gameType, joinToken });

    let socket = nakamaService.getSocket();
    if (!socket) {
      await nakamaService.authenticate(user.id);
      socket = await nakamaService.createSocket();
    }

    // Determine match identifiers from URL only
    const rawUrlId = matchId || '';
    const cleanUrlId = rawUrlId.endsWith('.') ? rawUrlId.slice(0, -1) : rawUrlId;

    // Attach listeners once
    (socket as any).onmatchpresence = (presence: any) => {
      console.log('👥 Match presence event:', presence);
      if (presence.joins && presence.joins.length > 0) {
        console.log(`➕ ${presence.joins.length} oyuncu katıldı`);
        setTotalPlayers(prev => {
          const newCount = prev + presence.joins.length;
          console.log(`📊 Oyuncu sayısı: ${prev} -> ${newCount}`);
          return newCount;
        });
      }
      if (presence.leaves && presence.leaves.length > 0) {
        console.log(`➖ ${presence.leaves.length} oyuncu ayrıldı`);
        setTotalPlayers(prev => Math.max(1, prev - presence.leaves.length));
      }
    };
    (socket as any).onmatchdata = (matchData: any) => {
      try {
        const content = JSON.parse(new TextDecoder().decode(matchData.data));
        console.log('📨 Received:', content);
        if (content.type === 'player_ready') {
          setPlayersReady(prev => new Set([...prev, content.userId]));
        }
        if (content.type === 'game_start_request') {
          setGameStartSignals(prev => new Set([...prev, content.userId]));
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    };

    // If we just created this private room as host, skip re-joining
    const lastMatchId = (nakamaService as any).getLastMatchId?.();
    if (lastMatchId && lastMatchId === cleanUrlId) {
      console.log('ℹ️ Already joined as host, skipping joinMatch for', cleanUrlId);
      const realMatchId = cleanUrlId;
      setJoinedMatchId(realMatchId);
      // Host olarak başlangıçta 1 oyuncu var (kendimiz)
      setTotalPlayers(1);
      const readyMsg = JSON.stringify({ type: 'player_ready', userId: user.id });
      const encoder = new TextEncoder();
      (socket as any).sendMatchState(realMatchId, 1, encoder.encode(readyMsg));
      setPlayersReady(prev => new Set([...prev, user.id]));
      console.log('✅ Ready signal sent (host already in match):', realMatchId);
      setLoading(false);
      return;
    }

    let joinResult: any = null;
    const tryJoinWithToken = async (tokenStr: string) => (socket as any).joinMatch(undefined, tokenStr);
    const tryJoinWithId = async (id: string) => (socket as any).joinMatch(id);

    try {
      if (joinToken) {
        joinResult = await tryJoinWithToken(joinToken);
      } else if (cleanUrlId) {
        joinResult = await tryJoinWithId(cleanUrlId);
      } else {
        throw new Error('Missing join token or match id');
      }
    } catch (e: any) {
      throw e;
    }

    if (!joinResult) throw new Error('Failed to join match');

    const realMatchId = (joinResult.match_id ?? joinResult.matchId ?? '').replace(/\.$/, '');
    if (!realMatchId) throw new Error('No match id available after join');
    setJoinedMatchId(realMatchId);
    // Do not persist last match to avoid rejoining ended rooms

    const presences = joinResult.presences || [];
    const playerCount = presences.length;
    console.log(`👥 Initial presence count after join: ${playerCount}`);
    setTotalPlayers(Math.max(1, playerCount));

    const readyMsg = JSON.stringify({ type: 'player_ready', userId: user.id });
    const encoder = new TextEncoder();
    (socket as any).sendMatchState(realMatchId, 1, encoder.encode(readyMsg));
    setPlayersReady(prev => new Set([...prev, user.id]));
    console.log('✅ Ready signal sent to match:', realMatchId);

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
    navigate(`/game/random-match?room=${targetRoom}&type=${gameType}`);
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
  disabled={playersReady.size < 2 || gameStartSignals.has(user.id) || hasStarted}
  // totalPlayers kontrolünü kaldırın
>
  {hasStarted ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Oyun Başlıyor...
    </>
  ) : gameStartSignals.has(user.id) ? (
    <>⏳ Diğer Oyuncu Bekleniyor...</>
  ) : playersReady.size < 2 ? (
    <>⏳ Hazır Sinyali Bekleniyor...</>
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