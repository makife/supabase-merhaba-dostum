import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Users, Plus, LogIn, Copy, Check, Clock, Trophy, Target, AlertTriangle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useGame } from '@/contexts/GameContext';
import { useSounds } from '@/hooks/useSounds';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { nakamaService } from '@/services/nakamaService';
import { useAuth } from '@/contexts/AuthContext';

interface PrivateRoomModalProps {
  onClose: () => void;
  onStartGame: (nakamaMatchId: string, gameType: 'timed' | 'score') => void;
}

const PrivateRoomModal = ({ onClose, onStartGame }: PrivateRoomModalProps) => {
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [gameType, setGameType] = useState<'timed' | 'score'>('timed');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [joinedMatchId, setJoinedMatchId] = useState<string>('');
  
  const [nakamaRoomId, setNakamaRoomId] = useState('');
  const { createRoom, joinRoom, leaveRoom, currentRoom, participants } = useGame();
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
      
      // 6 haneli temiz kod üret
      const shortCode = generateRoomCode();
      
      setNakamaRoomId(roomId);
      setRoomCode(shortCode);
      
      // Kodu, gerçek room ID'yi ve gameType'ı localStorage'a kaydet
      localStorage.setItem(`room_${shortCode}`, roomId);
      localStorage.setItem(`room_type_${shortCode}`, gameType);

      // Deterministik grid oluştur
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
      
      // Supabase'e game_room kaydı oluştur
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

      // Host olarak participant ekle
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
      
      // Realtime ile participants tablosunu dinle
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
            
            // Toplam katılımcı sayısını kontrol et
            const { data: participants } = await supabase
              .from('game_participants')
              .select('*')
              .eq('room_id', roomId);
            
            if (participants && participants.length >= 2) {
              console.log('✅ 2 oyuncu tamam, oyun başlıyor!');
              channel.unsubscribe();
              onStartGame(roomId, gameType);
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
      
      // 6 haneli kod mu yoksa tam ID mi kontrol et
      let actualRoomId = joinCode.trim();
      
      if (joinCode.length === 6) {
        // Kısa kod ise localStorage'dan gerçek ID'yi al
        const storedRoomId = localStorage.getItem(`room_${joinCode.toUpperCase()}`);
        if (storedRoomId) {
          actualRoomId = storedRoomId;
          console.log('🔑 Short code resolved to:', actualRoomId);
        }
      }
      
      console.log('🚪 Joining Nakama private room:', actualRoomId);
      await nakamaService.authenticate(user.id);
      await nakamaService.createSocket();
      
      // Nakama'ya katıl ve gerçek match ID'yi al
      const realMatchId = await nakamaService.joinPrivateRoom(actualRoomId);
      
      setJoinedMatchId(realMatchId);

      // Supabase'de room'un varlığını kontrol et ve participant ekle
      const { data: room } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', realMatchId)
        .single();

      if (room) {
        // Participant olarak ekle
        await supabase.from('game_participants').insert({
          room_id: realMatchId,
          user_id: user.id,
        });
      }
      
      toast({
        title: "🚪 Nakama Odaya Katıldınız",
        description: `Oda: ${joinCode}`,
      });
      
      // gameType'ı localStorage'dan al
      const savedGameType = (localStorage.getItem(`room_type_${joinCode.toUpperCase()}`) as 'timed' | 'score') || 'timed';
      
      // Direkt oyunu başlat
      onStartGame(realMatchId, savedGameType);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Özel Oda</CardTitle>
              <CardDescription>Arkadaşınla özel oyun oluştur</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Oda Oluştur
              </TabsTrigger>
              <TabsTrigger value="join" className="flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                Odaya Katıl
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-4 mt-4">
              {!roomCode && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-3 text-center">Oyun Türü Seçin</h3>
                    <RadioGroup value={gameType} onValueChange={(value) => {
                      playSound('buttonClick');
                      setGameType(value as 'timed' | 'score');
                    }}>
                      <div className="space-y-3">
                        <Label className={`relative flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                          gameType === 'timed' 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-blue-300'
                        }`}>
                          <RadioGroupItem value="timed" className="sr-only" />
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                            gameType === 'timed' 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <Clock className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Zamana Karşı</span>
                              {gameType === 'timed' && (
                                <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">2 dakika içinde en yüksek puanı hedefle</p>
                          </div>
                        </Label>

                        <Label className={`relative flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                          gameType === 'score' 
                            ? 'border-amber-500 bg-amber-50' 
                            : 'border-gray-200 hover:border-amber-300'
                        }`}>
                          <RadioGroupItem value="score" className="sr-only" />
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${
                            gameType === 'score' 
                              ? 'bg-amber-500 text-white' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <Trophy className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Puanlı</span>
                              {gameType === 'score' && (
                                <div className="w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">500 puana ilk ulaşan kazanır</p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}
              
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Yeni bir özel oda oluşturun ve arkadaşınızla paylaşın
                </p>
                
                {roomCode ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <Label className="text-sm font-medium text-green-800">
                        Oda Kodu
                      </Label>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-2xl font-bold font-mono text-green-900">{roomCode}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyRoomCode}
                          className="ml-2"
                        >
                          {copied ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-green-600 mt-2">
                        6 haneli kod arkadaşınla paylaş
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Bu kodu arkadaşınızla paylaşın. Arkadaşınız katıldığında oyun başlayabilir.
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={handleCreateRoom}
                    disabled={loading}
                    className="w-full"
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
                  <Label htmlFor="joinCode">
                    Oda Kodu
                  </Label>
                  <Input
                    id="joinCode"
                    placeholder="6 haneli kodu girin (örn: A4K7B2)"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="mt-1 text-center font-mono text-lg tracking-wider uppercase"
                  />
                </div>
                
                <Button
                  onClick={handleJoinRoom}
                  disabled={loading || !joinCode.trim()}
                  className="w-full"
                  size="lg"
                >
                  {loading ? 'Odaya Katılıyor...' : 'Odaya Katıl'}
                </Button>
                
                <p className="text-sm text-muted-foreground text-center">
                  Arkadaşınızdan aldığınız 6 haneli kodu girin
                </p>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={() => {
                playSound('buttonClick');
                if (currentRoom && participants.length > 1) {
                  setShowExitDialog(true);
                } else {
                  onClose();
                }
              }}
              className="w-full"
            >
              {currentRoom && participants.length > 1 ? 'Çıkış' : 'İptal'}
            </Button>
          </div>
          
          <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
            <AlertDialogContent className="max-w-sm">
              <AlertDialogHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <AlertDialogTitle className="text-lg font-semibold text-center">
                  Odadan Çıkmak İstiyorsun?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-center text-muted-foreground">
                  Odadan çıkarsan arkadaşın tek başına kalacak.
                  <br />
                  Emin misin?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-col space-y-2 sm:space-y-0 sm:flex-row sm:space-x-2">
                <AlertDialogCancel 
                  onClick={() => setShowExitDialog(false)}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  Vazgeç
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={async () => {
                    playSound('buttonClick');
                    await leaveRoom();
                    setShowExitDialog(false);
                    onClose();
                    toast({
                      title: '✋ Odadan Çıktın',
                      description: 'Arkadaşın devam edebilir.',
                      duration: 2000,
                    });
                  }}
                  className="w-full sm:w-auto bg-red-500 hover:bg-red-600 order-1 sm:order-2"
                >
                  Evet, Çık
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrivateRoomModal;