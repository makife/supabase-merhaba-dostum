
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useMusic } from '@/contexts/MusicContext';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { useUser } from '@/contexts/UserContext';
import { Music, Volume2, Zap, Lock } from 'lucide-react';

interface MusicPackOption {
  id: string;
  name: string;
  description: string;
  requiredPurchase?: string; // Market item ID'si
  icon: any;
  preview: string;
}

export const MusicPackSelector = () => {
  const { user } = useAuth();
  const { musicPack, setMusicPack } = useMusic();
  const { hasPurchased } = useUserPurchases();
  const { isPremium } = useUser();
  
  const musicPacks: MusicPackOption[] = [
    {
      id: 'default',
      name: 'Varsayılan',
      description: 'Klasik arkaplan müziği',
      icon: Volume2,
      preview: 'Standart oyun müziği'
    },
    {
      id: 'space1',
      name: 'Uzay Müziği 1',
      description: 'Elektronik uzay müziği - Ambient',
      requiredPurchase: 'music_pack_space1',
      icon: Zap,
      preview: 'Futuristik ambient müzik'
    },
      name: 'Uzay Müziği 1',
      description: 'Elektronik uzay müziği - Ambient',
      requiredPurchase: 'music_pack_space1',
      icon: Zap,
      preview: 'Futuristik ambient müzik'
    },
    {
      id: 'space2',
      name: 'Uzay Müziği 2',
      description: 'Sintetik uzay müziği - Cosmic',
      requiredPurchase: 'music_pack_space2',
      icon: Zap,
      preview: 'Kozmik elektronik sesler'
    }
  ];

  // Kullanılabilir müzik paketlerini kontrol et
  const isPackAvailable = (pack: MusicPackOption) => {
    if (!pack.requiredPurchase) return true; // Varsayılan paket her zaman mevcut
    // Premium üyeler tüm müzik paketlerine erişebilir
    if (isPremium) return true;
    return user && hasPurchased(pack.requiredPurchase);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Music className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Arkaplan Müziği</h3>
      </div>
      
      <div className="grid gap-3">
        {musicPacks.map((pack) => {
          const isAvailable = isPackAvailable(pack);
          const isActive = musicPack === pack.id;
          
          return (
            <Card 
              key={pack.id} 
              className={`transition-all cursor-pointer ${
                isActive ? 'ring-2 ring-primary bg-primary/5' : 
                isAvailable ? 'hover:bg-muted/50' : 'opacity-60'
              }`}
              onClick={() => isAvailable && setMusicPack(pack.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                    }`}>
                      <pack.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold">{pack.name}</h4>
                        {isActive && (
                          <Badge variant="default" className="text-xs">
                            Aktif
                          </Badge>
                        )}
                        {!isAvailable && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Kilitli
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{pack.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{pack.preview}</p>
                    </div>
                  </div>
                  
                  {isAvailable && (
                    <Button
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      disabled={isActive}
                    >
                      {isActive ? 'Seçili' : 'Seç'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {user && (
        <div className="text-sm text-muted-foreground">
          💡 Yeni müzik paketlerini marketten satın alabilirsiniz
        </div>
      )}
    </div>
  );
};