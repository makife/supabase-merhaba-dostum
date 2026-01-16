import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/components/ThemeProvider';
import { useUser } from '@/contexts/UserContext';
import { Crown, Star, Sparkles, Diamond, X, Circle, Hexagon, Gem } from 'lucide-react';
import { toast } from 'sonner';

interface FrameOption {
  id: string;
  name: string;
  description: string;
  icon: any;
  isPremium?: boolean;
  frameClass?: string;
}

export const AvatarFrameSelector = () => {
  const { user } = useAuth();
  const { avatarFrame, applyAvatarFrame } = useThemeContext();
  const { isPremium } = useUser();

  // Basit icon/css tabanlı çerçeveler - lovable-uploads yok
  const frames: FrameOption[] = [
    {
      id: 'none',
      name: 'Çerçevesiz',
      description: 'Standart avatar görünümü',
      icon: X,
    },
    {
      id: 'gold',
      name: 'Altın Çerçeve',
      description: 'Klasik altın rengi çerçeve',
      icon: Crown,
      isPremium: true,
      frameClass: 'ring-4 ring-yellow-500 shadow-lg shadow-yellow-500/50',
    },
    {
      id: 'silver',
      name: 'Gümüş Çerçeve',
      description: 'Şık gümüş rengi çerçeve',
      icon: Circle,
      isPremium: true,
      frameClass: 'ring-4 ring-gray-400 shadow-lg shadow-gray-400/50',
    },
    {
      id: 'diamond',
      name: 'Elmas Çerçeve',
      description: 'Parlak elmas çerçeve',
      icon: Diamond,
      isPremium: true,
      frameClass: 'ring-4 ring-cyan-400 shadow-lg shadow-cyan-400/50',
    },
    {
      id: 'emerald',
      name: 'Zümrüt Çerçeve',
      description: 'Yeşil zümrüt çerçeve',
      icon: Hexagon,
      isPremium: true,
      frameClass: 'ring-4 ring-emerald-500 shadow-lg shadow-emerald-500/50',
    },
    {
      id: 'ruby',
      name: 'Yakut Çerçeve',
      description: 'Kırmızı yakut çerçeve',
      icon: Gem,
      isPremium: true,
      frameClass: 'ring-4 ring-red-500 shadow-lg shadow-red-500/50',
    },
    {
      id: 'rainbow',
      name: 'Gökkuşağı Çerçeve',
      description: 'Renkli animasyonlu çerçeve',
      icon: Sparkles,
      isPremium: true,
      frameClass: 'ring-4 ring-purple-500 shadow-lg shadow-purple-500/50 animate-pulse',
    },
    {
      id: 'star',
      name: 'Yıldız Çerçeve',
      description: 'Parlayan yıldız çerçeve',
      icon: Star,
      isPremium: true,
      frameClass: 'ring-4 ring-amber-400 shadow-lg shadow-amber-400/50',
    },
  ];

  const isFrameAvailable = (frameOption: FrameOption) => {
    if (!frameOption.isPremium) return true;
    return isPremium;
  };

  const handleFrameSelect = async (frameId: string) => {
    if (!user) {
      toast.error('Çerçeve seçimi için giriş yapmanız gerekiyor');
      return;
    }

    const frameOption = frames.find(f => f.id === frameId);
    if (frameOption && !isFrameAvailable(frameOption)) {
      toast.error('Bu çerçeveyi kullanmak için premium üyelik gerekiyor');
      return;
    }

    await applyAvatarFrame(frameId);
    toast.success('Avatar çerçevesi başarıyla değiştirildi');
  };

  const username = user?.email?.split('@')[0] || 'Oyuncu';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Crown className="w-5 h-5 mr-2" />
          Avatar Çerçeveleri
        </CardTitle>
        <CardDescription>
          Avatarınıza özel çerçeveler ekleyin
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {frames.map((frame) => {
            const IconComponent = frame.icon;
            const isActive = avatarFrame === frame.id;
            const isAvailable = isFrameAvailable(frame);
            const isLocked = frame.isPremium && !isAvailable;

            return (
              <Card 
                key={frame.id}
                className={`cursor-pointer transition-all hover:scale-105 relative ${
                  isActive 
                    ? 'ring-2 ring-primary bg-accent/50' 
                    : isLocked 
                      ? 'opacity-60 hover:opacity-80'
                      : 'hover:bg-accent/20'
                }`}
                onClick={() => handleFrameSelect(frame.id)}
              >
                <CardContent className="p-3 text-center">
                  {/* Frame Preview */}
                  <div className="flex justify-center mb-2">
                    <Avatar 
                      className={`w-12 h-12 ${frame.frameClass || ''}`}
                    >
                      <AvatarFallback className="text-sm font-bold">
                        {username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex items-center justify-center mb-1">
                    <IconComponent className="w-3 h-3 mr-1" />
                    <h4 className="font-medium text-xs">{frame.name}</h4>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-1 line-clamp-1">
                    {frame.description}
                  </p>

                  {/* Durum rozetleri */}
                  <div className="flex justify-center">
                    {isActive && (
                      <Badge variant="default" className="text-xs">
                        Aktif
                      </Badge>
                    )}
                    {isLocked && (
                      <Badge variant="secondary" className="text-xs">
                        Premium
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {user && !isPremium && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            💎 Premium üyelik ile tüm çerçevelere erişin
          </p>
        )}
      </CardContent>
    </Card>
  );
};