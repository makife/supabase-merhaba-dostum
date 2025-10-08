import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Users, Plus, LogIn, Copy, Check, Clock, Trophy, Home } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useSounds } from '@/hooks/useSounds';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { nakamaService } from '@/services/nakamaService';
import { useAuth } from '@/contexts/AuthContext';

const PrivateRoomPage = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [gameType, setGameType] = useState<'timed' | 'score'>('timed');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nakamaRoomId, setNakamaRoomId] = useState('');
  
  const { playSound } = useSounds();
  const { toast } = useToast();
  const { user } = useAuth();

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    playSound('buttonClick');
    
    try {
      if (!user) return;
      
      console.log('🏠 Creating Nakama private room:', gameType);
      await nakamaService.authenticate(user.id);
      await nakamaService.createSocket();
      const roomId = await nakamaService.createPrivateRoom(gameType);
      
      const shortCode = generateRoomCode();
      setNakamaRoomId(roomId);
      setRoomCode(shortCode);
      
      localStorage.setItem(`room_${shortCode}`, roomId);
      localStorage.setItem(`room_type_${shortCode}`, gameType);

      const generateGridFromSeed = (seed: string): string[] => {
        const seedNum = parseInt(seed.replace(/[^0-9]/g, "").slice(0, 10)) || Date.now();
        let currentSeed = seedNum;

        const seededRandom = () => {
          currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
          return currentSeed / 4294967296;
        };

        const letterPool = [
          "A","A","A","A","A","A","A","A","E","E","E","E","E","E","E",
          "İ","İ","İ","İ","İ","İ","I","I","I","I","I","O","O","O","O","O",
          "U","U","U","U","Ü","Ü","Ü","Ö","Ö","Ö","L","L","L","L","L",
          "N","N","N","N","N","R","R","R","R","R","K","K","K","K",
          "M","M","M","M","T","T","T","T","S","S","S","S","D","D","D",
          "Y","Y","Y","B","B","B","C","C","Ç","Ç","F","F","G","G","Ğ","Ğ",
          "H","H","J","P","P","Ş","Ş","V","V","Z"
        ];

        const grid: string[] = [];
        for (let i = 0; i < 16; i++) {
          const randomIndex = Math.floor(seededRandom() * letterPool.length);
          grid.push(letterPool[randomIndex]);
        }
        return grid;
      };

      const gridArray = generateGridFromSeed(roomId);
      
      const { error: roomError } = await supabase.from("game_rooms").insert({
        id: roomId,
        room_code: shortCode,
        host_id: user.id,
        game_mode: gameType,
        status: "waiting",
        max_players: 2,
        time_limit: gameType === "timed" ? 120 : 0,
        max_score: gameType === "score" ? 500 : 0,
        current_grid: gridArray,
      });

      if (roomError && !roomError.message?.includes("duplicate")) {
        console.error("Room insert failed:", roomError);
      }

      const { error: participantError } = await supabase.from("game_participants").insert({
        room_id: roomId,
        user_id: user.id,
      });

      if (participantError && !participantError.message?.includes("duplicate")) {
        console.error("Participant insert failed:", participantError);
      }
      
      toast({
        title: "🏠 Oda Oluşturuldu",
        description: `Kod: ${shortCode} - Diğer oyuncu bekleniyor...`,
      });
      
      const channel = supabase
        .channel(`room_${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'game_participants',
            filter: `room_id=eq.${roomId}`
          },
          async (payload) => {
            console.log('👥 Yeni katılımcı:', payload);
            
            const { data: participants } = await supabase
              .from('game_participants')
              .select('*')
              .eq('room_id', roomId);
            
            if (participants && participants.length >= 2) {
              console.log('✅ 2 oyuncu tamam, oyun başlıyor!');
              channel.unsubscribe();
              navigate(`/game/random-match?room=${roomId}&type=${gameType}`);
            }
          }
        )
        .subscribe();
      
    } catch (error: any) {
      console.error('Error creating room:', error);
      toast({
        title: 'Hata',
        description: error.message || 'Oda oluşturulamadı',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      toast({
        title: 'Hata',
        description: 'Oda kodu girin',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    playSound('buttonClick');
    
    try {
      if (!user) return;
      
      let actualRoomId = joinCode.trim();
      
      if (joinCode.length === 6) {
        const storedRoomId = localStorage.getItem(`room_${joinCode.toUpperCase()}`);
        if (storedRoomId) {
          actualRoomId = storedRoomId;
          console.log('🔑 Short code resolved to:', actualRoomId);
        }
      }
      
      console.log('🚪 Joining Nakama private room:', actualRoomId);
      await nakamaService.authenticate(user.id);
      await nakamaService.createSocket();
      
      const realMatchId = await nakamaService.joinPrivateRoom(actualRoomId);

      const { data: room } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', realMatchId)
        .single();

      if (room) {
        await supabase.from('game_participants').insert({
          room_id: realMatchId,
          user_id: user.id,
        });
      }
      
      toast({
        title: "🚪 Odaya Katıldınız",
        description: `Oda: ${joinCode}`,
      });
      
      const savedGameType = (localStorage.getItem(`room_type_${joinCode.toUpperCase()}`) as 'timed' | 'score') || 'timed';
      navigate(`/game/random-match?room=${realMatchId}&type=${savedGameType}`);
    } catch (error: any) {
      console.error('Error joining room:', error);
      toast({
        title: 'Hata',
        description: error.message || 'Odaya katılamadı',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyRoomCode = async () => {
    if (roomCode) {
      try {
        await navigator.clipboard.writeText(roomCode);
        setCopied(true);
        playSound('buttonClick');
        toast({
          title: 'Kopyalandı!',
          description: 'Oda kodu panoya kopyalandı',
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      {/* Ana Sayfa butonu */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          onClick={() => navigate("/")}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
        >
          <Home className="w-4 h-4 mr-2" />
          Ana Sayfa
        </Button>
      </div>

      <div className="max-w-md mx-auto pt-16">
        {/* Başlık */}
        <div className="text-center mb-8">
          <div className="h-16 w-16 mx-auto bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Özel Oda</h1>
          <p className="text-gray-300 text-lg">Arkadaşınla özel oyun oluştur</p>
        </div>

        {/* Ana Kart */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20">
          <CardContent className="p-6">
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/5">
                <TabsTrigger value="create" className="flex items-center gap-2 data-[state=active]:bg-white/20">
                  <Plus className="w-4 h-4" />
                  Oda Oluştur
                </TabsTrigger>
                <TabsTrigger value="join" className="flex items-center gap-2 data-[state=active]:bg-white/20">
                  <LogIn className="w-4 h-4" />
                  Odaya Katıl
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="create" className="space-y-4 mt-4">
                {!roomCode && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-3 text-center text-white">Oyun Türü Seçin</h3>
                      <RadioGroup value={gameType} onValueChange={(value) => {
                        playSound('buttonClick');
                        setGameType(value as 'timed' | 'score');
                      }}>
                        <div className="space-y-3">
                          <Label className={`relative flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                            gameType === 'timed' 
                              ? 'border-blue-400 bg-blue-500/20' 
                              : 'border-white/20 hover:border-blue-400/50'
                          }`}>
                            <RadioGroupItem value="timed" className="sr-only" />
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                              gameType === 'timed' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-white/10 text-gray-300'
                            }`}>
                              <Clock className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-white">Zamana Karşı</span>
                                {gameType === 'timed' && (
                                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-300">2 dakika içinde en yüksek puanı hedefle</p>
                            </div>
                          </Label>

                          <Label className={`relative flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                            gameType === 'score' 
                              ? 'border-yellow-400 bg-yellow-500/20' 
                              : 'border-white/20 hover:border-yellow-400/50'
                          }`}>
                            <RadioGroupItem value="score" className="sr-only" />
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                              gameType === 'score' 
                                ? 'bg-yellow-500 text-white' 
                                : 'bg-white/10 text-gray-300'
                            }`}>
                              <Trophy className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-white">Puanlı</span>
                                {gameType === 'score' && (
                                  <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-gray-300">500 puana ilk ulaşan kazanır</p>
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                )}
                
                <div className="text-center space-y-4">
                  <p className="text-sm text-gray-300">
                    Yeni bir özel oda oluşturun ve arkadaşınızla paylaşın
                  </p>
                  
                  {roomCode ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-white/10 rounded-lg border border-white/20">
                        <Label className="text-sm font-medium text-white">
                          Oda Kodu
                        </Label>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-2xl font-bold font-mono text-white">{roomCode}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyRoomCode}
                            className="ml-2 bg-white/10 hover:bg-white/20 border-white/20"
                          >
                            {copied ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-white" />
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-300 mt-2">
                          6 haneli kod arkadaşınla paylaş
                        </p>
                      </div>
                      <p className="text-sm text-gray-300 text-center">
                        Bu kodu arkadaşınızla paylaşın. Arkadaşınız katıldığında oyun başlayabilir.
                      </p>
                    </div>
                  ) : (
                    <Button
                      onClick={handleCreateRoom}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold"
                      size="lg"
                    >
                      {loading ? 'Oda Oluşturuluyor...' : 'Oda Oluştur'}
                    </Button>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="join" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="joinCode" className="text-white">
                      Oda Kodu
                    </Label>
                    <Input
                      id="joinCode"
                      placeholder="6 haneli kodu girin (örn: A4K7B2)"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      className="mt-1 text-center font-mono text-lg tracking-wider uppercase bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                    />
                  </div>
                  
                  <Button
                    onClick={handleJoinRoom}
                    disabled={loading || !joinCode.trim()}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold"
                    size="lg"
                  >
                    {loading ? 'Odaya Katılıyor...' : 'Odaya Katıl'}
                  </Button>
                  
                  <p className="text-sm text-gray-300 text-center">
                    Arkadaşınızdan aldığınız 6 haneli kodu girin
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Bilgi */}
        <Card className="mt-8 bg-white/5 backdrop-blur-md border-white/10">
          <CardContent className="p-4">
            <h3 className="text-lg font-bold text-white mb-2">Özel Oda Kuralları</h3>
            <ul className="text-gray-300 text-sm space-y-1">
              <li>• Oda kodu arkadaşınla paylaşman yeterli</li>
              <li>• İki oyuncu katıldığında oyun otomatik başlar</li>
              <li>• Zamana karşı veya puanlı mod seçebilirsin</li>
              <li>• Her oda maksimum 2 oyuncu için geçerlidir</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivateRoomPage;
