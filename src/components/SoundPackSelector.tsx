import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/components/ThemeProvider';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { useUser } from '@/contexts/UserContext';
import { Volume2, Music, Zap, Lock } from 'lucide-react';

interface SoundPackOption {
  id: string;
  name: string;
  description: string;
  requiredPurchase?: string; // Market item ID'si
  icon: any;
  preview: string;
}

export const SoundPackSelector = () => {
  const { user } = useAuth();
  const { soundPack, applySoundPack } = useThemeContext();
  const { hasPurchased } = useUserPurchases();
  const { isPremium } = useUser();
  
  const soundPacks: SoundPackOption[] = [
    {
      id: 'default',
      name: 'Varsayılan',
      description: 'Klasik ses efektleri',
      icon: Volume2,
      preview: 'Standart beep sesleri'
    },
    {
      id: 'space',
      name: 'Uzay',
      description: 'Bilim kurgu ses efektleri',
      requiredPurchase: 'sound_pack_space',
      icon: Zap,
      preview: 'Futuristik elektronik sesler'
    },
    {
      id: 'nature',
      name: 'Doğa',
      description: 'Rahatlatıcı doğa sesleri',
      requiredPurchase: 'sound_pack_nature',
      icon: Music,
      preview: 'Yumuşak, organik tonlar'
    }
  ];

  // Kullanılabilir ses paketlerini kontrol et
  const isPackAvailable = (pack: SoundPackOption) => {
    if (!pack.requiredPurchase) return true; // Varsayılan paket her zaman mevcut
    // Premium üyeler tüm ses paketlerine erişebilir
    if (isPremium) return true;
    return user && hasPurchased(pack.requiredPurchase);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Volume2 className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Ses Paketi</h3>
      </div>
      
      <div className="grid gap-3">
        {soundPacks.map((pack) => {
          const isAvailable = isPackAvailable(pack);
          const isActive = soundPack === pack.id;
          
          return (
            <Card 
              key={pack.id} 
              className={`transition-all cursor-pointer ${
                isActive ? 'ring-2 ring-primary bg-primary/5' : 
                isAvailable ? 'hover:bg-muted/50' : 'opacity-60'
              }`}
              onClick={() => isAvailable && applySoundPack(pack.id)}
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
          💡 Yeni ses paketlerini marketten satın alabilirsiniz
        </div>
      )}
    </div>
  );
};