import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Clock, Target, Trophy, Bot, Users, Zap } from 'lucide-react';
import { useSounds } from '@/hooks/useSounds';

interface GameModeSelectorProps {
  mode: string;
  onStart: (gameType: 'timed' | 'score') => void;
  onClose: () => void;
}

const GameModeSelector = ({ mode, onStart, onClose }: GameModeSelectorProps) => {
  const [selectedType, setSelectedType] = useState<'timed' | 'score'>('timed');
  const { playSound } = useSounds();

  const getModeInfo = () => {
    switch (mode) {
      case 'vs-computer':
        return {
          title: 'Bilgisayara Karşı',
          description: 'AI rakibine karşı oyna',
          icon: Bot,
          color: 'bg-blue-500'
        };
      case 'private-room':
        return {
          title: 'Özel Oda',
          description: 'Arkadaşınla özel oda oluştur',
          icon: Users,
          color: 'bg-green-500'
        };
      case 'random-match':
        return {
          title: 'Rastgele Rakip',
          description: 'Rastgele oyuncu ile eşleş',
          icon: Zap,
          color: 'bg-purple-500'
        };
      default:
        return {
          title: 'Oyun Modu',
          description: 'Oyun modunu seç',
          icon: Target,
          color: 'bg-gray-500'
        };
    }
  };

  const modeInfo = getModeInfo();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 ${modeInfo.color} rounded-lg flex items-center justify-center`}>
              <modeInfo.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>{modeInfo.title}</CardTitle>
              <CardDescription>{modeInfo.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3">Oyun Türü Seçin</h3>
            <RadioGroup value={selectedType} onValueChange={(value) => {
              playSound('buttonClick');
              setSelectedType(value as 'timed' | 'score');
            }}>
              <div className="space-y-3">
                <Label className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted">
                  <RadioGroupItem value="timed" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">Zamana Karşı</span>
                    </div>
                    <p className="text-sm text-muted-foreground">2 dakika içinde en yüksek puan</p>
                    <div className="flex space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        2 Dakika
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Target className="w-3 h-3 mr-1" />
                        Sınırsız Puan
                      </Badge>
                    </div>
                  </div>
                </Label>

                <Label className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted">
                  <RadioGroupItem value="score" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Trophy className="w-4 h-4" />
                      <span className="font-medium">Puana Karşı</span>
                    </div>
                    <p className="text-sm text-muted-foreground">500 puana ilk ulaşan kazanır</p>
                    <div className="flex space-x-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        <Trophy className="w-3 h-3 mr-1" />
                        500 Puan
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        Sınırsız Süre
                      </Badge>
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => {
              playSound('buttonClick');
              onClose();
            }} className="flex-1">
              İptal
            </Button>
            <Button onClick={() => {
              playSound('buttonClick');
              onStart(selectedType);
            }} className="flex-1">
              Oyunu Başlat
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GameModeSelector;