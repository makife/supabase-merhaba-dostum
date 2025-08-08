import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useThemeContext } from '@/components/ThemeProvider';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { useUser } from '@/contexts/UserContext';
import { Palette, Moon, Sun, Waves, Sunset, TreePine, Gamepad2, Lock } from 'lucide-react';

interface ThemeOption {
  id: string;
  name: string;
  description: string;
  requiredPurchase?: string; // Market item ID'si
  icon: any;
  preview: string;
  isPremium?: boolean;
}

export const ThemeSelector = () => {
  const { user } = useAuth();
  const { theme, applyTheme } = useThemeContext();
  const { hasPurchased } = useUserPurchases();
  const { isPremium } = useUser();
  
  const themes: ThemeOption[] = [
    {
      id: 'default',
      name: 'Varsayılan',
      description: 'Klasik aydınlık tema',
      icon: Sun,
      preview: 'Temiz ve modern arayüz'
    },
    {
      id: 'dark',
      name: 'Koyu',
      description: 'Gece modu için ideal',
      icon: Moon,
      preview: 'Göz dostu koyu renkler'
    },
    {
      id: 'dark_ocean',
      name: 'Koyu Okyanus',
      description: 'Sakin mavi tonlarında koyu tema',
      requiredPurchase: 'theme_dark_ocean',
      icon: Waves,
      preview: 'Derin mavi ve turkuaz tonları',
      isPremium: true
    },
    {
      id: 'sunset',
      name: 'Gün Batımı',
      description: 'Sıcak turuncu ve pembe tonları',
      requiredPurchase: 'theme_sunset',
      icon: Sunset,
      preview: 'Romantik günbatımı renkleri',
      isPremium: true
    },
    {
      id: 'forest',
      name: 'Orman',
      description: 'Doğal yeşil tonları',
      requiredPurchase: 'theme_forest',
      icon: TreePine,
      preview: 'Doğanın huzur verici yeşillikleri',
      isPremium: true
    },
    {
      id: 'classic',
      name: 'Klasik',
      description: 'Nostaljik retro tema',
      requiredPurchase: 'credits_theme_basic',
      icon: Gamepad2,
      preview: 'Eski okul oyun hissi'
    }
  ];

  // Kullanılabilir temaları kontrol et
  const isThemeAvailable = (themeOption: ThemeOption) => {
    if (!themeOption.requiredPurchase) return true; // Varsayılan temalar her zaman mevcut
    return user && hasPurchased(themeOption.requiredPurchase);
  };

  const handleThemeSelect = async (themeId: string) => {
    const themeOption = themes.find(t => t.id === themeId);
    if (!themeOption) return;

    if (!isThemeAvailable(themeOption)) {
      return; // Tema mevcut değilse hiçbir şey yapma
    }

    applyTheme(themeId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Palette className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Tema Seçimi</h3>
      </div>
      
      <div className="grid gap-3">
        {themes.map((themeOption) => {
          const isAvailable = isThemeAvailable(themeOption);
          const isActive = theme === themeOption.id;
          
          return (
            <Card 
              key={themeOption.id} 
              className={`transition-all cursor-pointer ${
                isActive ? 'ring-2 ring-primary bg-primary/5' : 
                isAvailable ? 'hover:bg-muted/50' : 'opacity-60'
              }`}
              onClick={() => isAvailable && handleThemeSelect(themeOption.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                    }`}>
                      <themeOption.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold">{themeOption.name}</h4>
                        {isActive && (
                          <Badge variant="default" className="text-xs">
                            Aktif
                          </Badge>
                        )}
                        {themeOption.isPremium && (
                          <Badge variant="secondary" className="text-xs">
                            Premium
                          </Badge>
                        )}
                        {!isAvailable && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Kilitli
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{themeOption.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{themeOption.preview}</p>
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
          💡 Yeni temaları marketten satın alabilirsiniz
        </div>
      )}
    </div>
  );
};