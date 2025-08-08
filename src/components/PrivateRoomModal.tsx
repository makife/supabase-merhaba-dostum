import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Plus, LogIn, Copy, Check } from 'lucide-react';
import { useGame } from '@/contexts/GameContext';
import { useSounds } from '@/hooks/useSounds';
import { useToast } from '@/hooks/use-toast';

interface PrivateRoomModalProps {
  onClose: () => void;
  onRoomCreated: (roomCode: string) => void;
  onRoomJoined: () => void;
}

const PrivateRoomModal = ({ onClose, onRoomCreated, onRoomJoined }: PrivateRoomModalProps) => {
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { createRoom, joinRoom } = useGame();
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
      const room = await createRoom('private-room', newRoomCode);
      
      if (room && room.room_code) {
        setRoomCode(room.room_code);
        onRoomCreated(room.room_code);
        toast({
          title: 'Oda Oluşturuldu!',
          description: `Oda kodu: ${room.room_code}`,
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
                onClose();
              }}
              className="w-full"
            >
              İptal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrivateRoomModal;