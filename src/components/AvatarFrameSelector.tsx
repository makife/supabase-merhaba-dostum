import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/components/ThemeProvider';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { useUser } from '@/contexts/UserContext';
import { Crown, Star, Sparkles, Diamond, Rainbow, Heart, X } from 'lucide-react';
import { toast } from 'sonner';

interface FrameOption {
  id: string;
  name: string;
  description: string;
  icon: any;
  requiredPurchase?: string;
  isPremium?: boolean;
  image?: string;
}

export const AvatarFrameSelector = () => {
  const { user } = useAuth();
  const { avatarFrame, applyAvatarFrame } = useThemeContext();
  const { hasPurchased } = useUserPurchases();
  const { isPremium } = useUser();

  const frames: FrameOption[] = [
    {
      id: 'none',
      name: 'Çerçevesiz',
      description: 'Standart avatar görünümü',
      icon: X,
    },
    // Marketten satın alınabilir çerçeveler
    {
      id: 'avatar_floral_roses',
      name: 'Gül Çerçevesi',
      description: 'Romantik gül desenli çerçeve',
      icon: Heart,
      requiredPurchase: 'avatar_floral_roses',
      isPremium: true,
      image: '/lovable-uploads/a717e6dc-c468-4e17-9e40-e2a47817aed6.png'
    },
    {
      id: 'avatar_blue_berries',
      name: 'Mavi Çilek Çerçevesi',
      description: 'Sevimli mavi çilek desenli çerçeve',
      icon: Heart,
      requiredPurchase: 'avatar_blue_berries',
      isPremium: true,
      image: '/lovable-uploads/9224e301-b3e4-47ba-9be4-b9a4fd4694a5.png'
    },
    {
      id: 'avatar_gold_simple',
      name: 'Sade Altın Çerçeve',
      description: 'Minimalist altın çerçeve',
      icon: Crown,
      requiredPurchase: 'avatar_gold_simple',
      isPremium: true,
      image: '/lovable-uploads/aa2df12c-9aa3-49c0-a78e-4a946ad9c396.png'
    },
    {
      id: 'avatar_floral_wreath',
      name: 'Çiçek Çelengi',
      description: 'Renkli çiçek çelengi çerçevesi',
      icon: Heart,
      requiredPurchase: 'avatar_floral_wreath',
      isPremium: true,
      image: '/lovable-uploads/eea94c24-3141-4496-ab48-9911ecfd1400.png'
    },
    {
      id: 'avatar_purple_flowers',
      name: 'Mor Çiçek Çerçevesi',
      description: 'Zarif mor çiçek desenli çerçeve',
      icon: Heart,
      requiredPurchase: 'avatar_purple_flowers',
      isPremium: true,
      image: '/lovable-uploads/1b6aaacc-0774-46f0-9aed-58be7383877a.png'
    },
    {
      id: 'avatar_pink_flowers',
      name: 'Pembe Çiçek Çerçevesi',
      description: 'Tatlı pembe çiçek desenli çerçeve',
      icon: Heart,
      requiredPurchase: 'avatar_pink_flowers',
      isPremium: true,
      image: '/lovable-uploads/4a19df44-882d-4bf3-b557-2986fd9ea69e.png'
    },
    {
      id: 'avatar_antique_bronze',
      name: 'Antik Bronz Çerçeve',
      description: 'Klasik antik bronz çerçeve',
      icon: Crown,
      requiredPurchase: 'avatar_antique_bronze',
      isPremium: true,
      image: '/lovable-uploads/227894f5-629e-46a5-88d7-2d8df2460fa2.png'
    },
    {
      id: 'avatar_green_patrick',
      name: 'Yeşil Şans Çerçevesi',
      description: 'Şanslı yeşil temalı çerçeve',
      icon: Sparkles,
      requiredPurchase: 'avatar_green_patrick',
      isPremium: true,
      image: '/lovable-uploads/d9551411-6a1a-4199-b99e-a0ff5defbf4e.png'
    },
    {
      id: 'avatar_heart_roses',
      name: 'Kalp Gül Çerçevesi',
      description: 'Sevgi dolu kalp ve gül çerçevesi',
      icon: Heart,
      requiredPurchase: 'avatar_heart_roses',
      isPremium: true,
      image: '/lovable-uploads/ff7b6503-a976-4eb1-87d0-2373423fc6e5.png'
    },
    {
      id: 'avatar_christmas_lights',
      name: 'Noel Işıkları Çerçevesi',
      description: 'Renkli noel ışıkları ile çerçeve',
      icon: Sparkles,
      requiredPurchase: 'avatar_christmas_lights',
      isPremium: true,
      image: '/lovable-uploads/2e9f15c2-49f4-461f-997e-84c4682368c6.png'
    },
    {
      id: 'avatar_ornate_gold',
      name: 'Süslü Altın Çerçeve',
      description: 'Detaylı süslemeli lüks altın çerçeve',
      icon: Crown,
      requiredPurchase: 'avatar_ornate_gold',
      isPremium: true,
      image: '/lovable-uploads/9ed9fbb7-3aa3-4185-96c5-d118e2067712.png'
    },
    {
      id: 'avatar_party_balloons',
      name: 'Parti Balonları Çerçevesi',
      description: 'Renkli parti balonları ile çerçeve',
      icon: Sparkles,
      requiredPurchase: 'avatar_party_balloons',
      isPremium: true,
      image: '/lovable-uploads/afa305fa-30a5-496f-8af0-029aa71047a3.png'
    },
    {
      id: 'avatar_christmas_tree',
      name: 'Noel Ağacı Çerçevesi',
      description: 'Noel ağacı ve hediyeli özel çerçeve',
      icon: Sparkles,
      requiredPurchase: 'avatar_christmas_tree',
      isPremium: true,
      image: '/lovable-uploads/b2d1b581-c29f-43e4-b354-2889ce0621b1.png'
    },
    {
      id: 'avatar_ornate_black',
      name: 'Siyah Süslü Çerçeve',
      description: 'Klasik siyah süslemeli çerçeve',
      icon: Crown,
      requiredPurchase: 'avatar_ornate_black',
      isPremium: true,
      image: '/lovable-uploads/5b932686-4cbb-44bb-8aa0-d9172ae54764.png'
    },
    {
      id: 'avatar_black_floral',
      name: 'Siyah Çiçek Çerçevesi',
      description: 'Zarif siyah çiçek motifli çerçeve',
      icon: Heart,
      requiredPurchase: 'avatar_black_floral',
      isPremium: true,
      image: '/lovable-uploads/53623185-5b73-4dd2-bc2b-1af5b94f321a.png'
    },
    {
      id: 'avatar_golden_stars',
      name: 'Altın Yıldızlar Çerçevesi',
      description: 'Yeni yıl temalı altın yıldız çerçevesi',
      icon: Star,
      requiredPurchase: 'avatar_golden_stars',
      isPremium: true,
      image: '/lovable-uploads/ff8a7b50-41b9-461a-bd0b-0e166b281ef3.png'
    },
    {
      id: 'avatar_wavy_black',
      name: 'Dalgalı Siyah Çerçeve',
      description: 'Modern dalgalı siyah çerçeve',
      icon: Crown,
      requiredPurchase: 'avatar_wavy_black',
      isPremium: true,
      image: '/lovable-uploads/309c658e-e0d1-423a-80d6-9b012943f30d.png'
    }
  ];

  const isFrameAvailable = (frameOption: FrameOption) => {
    if (!frameOption.requiredPurchase) return true;
    // Premium üyeler tüm çerçevelere erişebilir
    if (isPremium) return true;
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
                  {/* Frame Preview */}
                  <div className="flex justify-center mb-3 relative">
                    {frame.image ? (
                      <div className="w-12 h-12 relative">
                        <img 
                          src={frame.image} 
                          alt={frame.name}
                          className="w-12 h-12 object-contain"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-xs font-bold">
                            {username.charAt(0).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Avatar 
                        className="w-12 h-12" 
                        showFrame={frame.id !== 'none'}
                      >
                        <AvatarFallback>
                          {username.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
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