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
          title: 'Yapay Zekaya Karşı',
          description: 'AI rakibine karşı pratik yap',
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
            <h3 className="font-semibold mb-3 text-center">Oyun Türü Seçin</h3>
            <RadioGroup value={selectedType} onValueChange={(value) => {
              playSound('buttonClick');
              setSelectedType(value as 'timed' | 'score');
            }}>
              <div className="space-y-4">
                {/* Zamana Karşı */}
                <Label className={`relative flex items-center space-x-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                  selectedType === 'timed' 
                    ? 'border-blue-500 bg-gradient-to-r from-blue-50 to-cyan-50 shadow-lg shadow-blue-200/50' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
                }`}>
                  <RadioGroupItem value="timed" className="sr-only" />
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    selectedType === 'timed' 
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg' 
                      : 'bg-gray-100'
                  }`}>
                    <Clock className={`w-6 h-6 ${selectedType === 'timed' ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg">Zamana Karşı</span>
                      {selectedType === 'timed' && (
                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center animate-scale-in">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">2 dakika içinde en yüksek puanı hedefle</p>
                    <div className="flex space-x-2 mt-3">
                      <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                        <Clock className="w-3 h-3 mr-1" />
                        2 Dakika
                      </Badge>
                      <Badge variant="secondary" className="text-xs bg-cyan-100 text-cyan-800 border-cyan-200">
                        <Target className="w-3 h-3 mr-1" />
                        Sınırsız Puan
                      </Badge>
                    </div>
                  </div>
                </Label>

                {/* Puana Karşı */}
                <Label className={`relative flex items-center space-x-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                  selectedType === 'score' 
                    ? 'border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50 shadow-lg shadow-amber-200/50' 
                    : 'border-gray-200 hover:border-amber-300 hover:bg-amber-50/30'
                }`}>
                  <RadioGroupItem value="score" className="sr-only" />
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    selectedType === 'score' 
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg' 
                      : 'bg-gray-100'
                  }`}>
                    <Trophy className={`w-6 h-6 ${selectedType === 'score' ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg">Puanlı</span>
                      {selectedType === 'score' && (
                        <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center animate-scale-in">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">500 puana ilk ulaşan kazanır</p>
                    <div className="flex space-x-2 mt-3">
                      <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                        <Trophy className="w-3 h-3 mr-1" />
                        500 Puan
                      </Badge>
                      <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
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