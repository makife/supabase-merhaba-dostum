import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/components/ThemeProvider';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { Crown, Star, Sparkles, Diamond, Rainbow } from 'lucide-react';
import { toast } from 'sonner';

interface FrameOption {
  id: string;
  name: string;
  description: string;
  icon: any;
  requiredPurchase?: string;
  isPremium?: boolean;
}

export const AvatarFrameSelector = () => {
  const { user } = useAuth();
  const { avatarFrame, applyAvatarFrame } = useThemeContext();
  const { hasPurchased } = useUserPurchases();

  const frames: FrameOption[] = [
    {
      id: 'none',
      name: 'Çerçevesiz',
      description: 'Standart avatar görünümü',
      icon: Crown,
    },
    {
      id: 'gold',
      name: 'Altın Çerçeve',
      description: 'Altın parıltısıyla özel bir görünüm',
      icon: Crown,
      requiredPurchase: 'avatar_gold_frame',
      isPremium: true,
    },
    {
      id: 'silver',
      name: 'Gümüş Çerçeve', 
      description: 'Gümüş parlaklığında zarif çerçeve',
      icon: Star,
      requiredPurchase: 'avatar_silver_frame',
      isPremium: true,
    },
    {
      id: 'diamond',
      name: 'Elmas Çerçeve',
      description: 'Kristal berraklığında lüks çerçeve',
      icon: Diamond,
      requiredPurchase: 'avatar_diamond_frame',
      isPremium: true,
    },
    {
      id: 'premium',
      name: 'Premium Çerçeve',
      description: 'Tema renginde özel premium çerçeve',
      icon: Sparkles,
      requiredPurchase: 'avatar_premium_frame',
      isPremium: true,
    },
    {
      id: 'rainbow',
      name: 'Gökkuşağı Çerçeve',
      description: 'Renkli animasyonlu özel çerçeve',
      icon: Rainbow,
      requiredPurchase: 'avatar_rainbow_frame',
      isPremium: true,
    },
  ];

  const isFrameAvailable = (frameOption: FrameOption) => {
    if (!frameOption.requiredPurchase) return true;
    return hasPurchased(frameOption.requiredPurchase);
  };

  const handleFrameSelect = async (frameId: string) => {
    if (!user) {
      toast.error('Çerçeve seçimi için giriş yapmanız gerekiyor');
      return;
    }

    const frameOption = frames.find(f => f.id === frameId);
    if (frameOption && !isFrameAvailable(frameOption)) {
      toast.error('Bu çerçeveyi kullanmak için satın almanız gerekiyor');
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                <CardContent className="p-4 text-center">
                  {/* Örnek Avatar */}
                  <div className="flex justify-center mb-3">
                    <Avatar 
                      className="w-12 h-12" 
                      showFrame={frame.id !== 'none'}
                    >
                      <AvatarFallback>
                        {username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex items-center justify-center mb-2">
                    <IconComponent className="w-4 h-4 mr-1" />
                    <h4 className="font-medium text-sm">{frame.name}</h4>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-2">
                    {frame.description}
                  </p>

                  {/* Durum rozetleri */}
                  <div className="flex justify-center">
                    {isActive && (
                      <Badge variant="default" className="text-xs">
                        Aktif
                      </Badge>
                    )}
                    {frame.isPremium && !isAvailable && (
                      <Badge variant="secondary" className="text-xs">
                        Premium
                      </Badge>
                    )}
                    {frame.isPremium && isAvailable && !isActive && (
                      <Badge variant="outline" className="text-xs">
                        Satın Alındı
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {user && (
          <p className="text-sm text-muted-foreground mt-4 text-center">
            💎 Premium çerçeveleri marketten satın alabilirsiniz
          </p>
        )}
      </CardContent>
    </Card>
  );
};