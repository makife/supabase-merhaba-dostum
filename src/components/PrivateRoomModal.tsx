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

interface PrivateRoomModalProps {
  onClose: () => void;
  onRoomCreated: (roomCode: string, gameType: 'timed' | 'score') => void;
  onRoomJoined: () => void;
}

const PrivateRoomModal = ({ onClose, onRoomCreated, onRoomJoined }: PrivateRoomModalProps) => {
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [gameType, setGameType] = useState<'timed' | 'score'>('timed');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const { createRoom, joinRoom, leaveRoom, currentRoom, participants } = useGame();
  const { playSound } = useSounds();
  const { toast } = useToast();

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
      const newRoomCode = generateRoomCode();
      // Include game type in room mode
      const room = await createRoom(`private-room-${gameType}`, newRoomCode);
      
      if (room && room.room_code) {
        setRoomCode(room.room_code);
        onRoomCreated(room.room_code, gameType);
        toast({
          title: 'Oda Oluşturuldu!',
          description: `Oda kodu: ${room.room_code} (${gameType === 'timed' ? 'Zamana Karşı' : 'Puana Karşı'})`,
        });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: 'Hata',
        description: 'Oda oluşturulamadı',
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
      const success = await joinRoom(joinCode.toUpperCase());
      if (success) {
        onRoomJoined();
      }
    } catch (error) {
      console.error('Error joining room:', error);
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
                        {/* Zamana Karşı */}
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

                        {/* Puana Karşı */}
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
                              <span className="font-semibold">Puana Karşı</span>
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
                      <Label className="text-sm font-medium text-green-800">Oda Kodu</Label>
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
                  <Label htmlFor="joinCode">Oda Kodu</Label>
                  <Input
                    id="joinCode"
                    placeholder="6 haneli oda kodunu girin"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="mt-1 text-center font-mono text-lg tracking-wider"
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
                // If in a room with other players, show warning
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
          
          {/* Exit Warning Dialog */}
          <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <AlertDialogTitle>Odadan Çıkmak İstiyorsun?</AlertDialogTitle>
                </div>
                <AlertDialogDescription>
                  Odadan çıkarsan arkadaşın tek başına kalacak. Emin misin?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowExitDialog(false)}>
                  Vazgeç
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={async () => {
                    playSound('buttonClick');
                    await leaveRoom();
                    setShowExitDialog(false);
                    onClose();
                    toast({
                      title: 'Odadan Çıktın',
                      description: 'Arkadaşın devam edebilir.',
                      duration: 2000,
                    });
                  }}
                  className="bg-red-500 hover:bg-red-600"
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