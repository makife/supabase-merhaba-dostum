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
      name: 'Klasik Aydınlık',
      description: '🌟 Temiz ve profesyonel tasarım',
      icon: Sun,
      preview: 'Modern minimalist arayüz • Yüksek kontrast • Göz dostu'
    },
    {
      id: 'dark',
      name: 'Gece Modu',
      description: '🌙 Premium karanlık deneyim',
      icon: Moon,
      preview: 'Zarif koyu tonlar • Göz yorgunluğu önleyici • Şık tasarım'
    },
    {
      id: 'dark_ocean',
      name: 'Mistik Okyanus',
      description: '🌊 Büyülü deniz teması - Premium',
      requiredPurchase: 'theme_dark_ocean',
      icon: Waves,
      preview: '✨ Turkuaz ışıltı • Dalga efektleri • Okyanusun derinliği',
      isPremium: true
    },
    {
      id: 'sunset',
      name: 'Altın Günbatımı',
      description: '🌅 Lüks sıcaklık koleksiyonu - Premium',
      requiredPurchase: 'theme_sunset',
      icon: Sunset,
      preview: '🔥 Işıltılı gradyanlar • Romantik tonlar • Altın efektler',
      isPremium: true
    },
    {
      id: 'forest',
      name: 'Zümrüt Orman',
      description: '🌲 Doğanın premium sığınağı',
      requiredPurchase: 'theme_forest',
      icon: TreePine,
      preview: '🍃 Mistik yeşillikler • Doğal armoni • Huzur verici tonlar',
      isPremium: true
    },
  ];

  // Kullanılabilir temaları kontrol et
  const isThemeAvailable = (themeOption: ThemeOption) => {
    if (!themeOption.requiredPurchase) return true; // Varsayılan temalar her zaman mevcut
    // Premium üyeler tüm temalara erişebilir
    if (isPremium) return true;
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
              className={`transition-all duration-300 cursor-pointer overflow-hidden group relative ${
                isActive 
                  ? 'ring-2 ring-primary shadow-lg scale-[1.02] bg-gradient-to-br from-primary/5 to-accent/5' 
                  : isAvailable 
                    ? 'hover:shadow-md hover:scale-[1.02] hover:bg-gradient-to-br hover:from-muted/30 hover:to-muted/10' 
                    : 'opacity-60 grayscale'
              } ${themeOption.isPremium 
                ? 'border-2 bg-gradient-to-r from-amber-400/20 via-purple-500/20 to-pink-500/20 border-amber-400/50' 
                : 'border border-border'
              }`}
              onClick={() => isAvailable && handleThemeSelect(themeOption.id)}
            >
              {/* Active theme indicator */}
              {isActive && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-primary rounded-full shadow-lg" />
              )}
              
              <CardContent className="p-5 relative">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                      isActive 
                        ? 'bg-gradient-to-br from-primary to-accent text-white shadow-lg' 
                        : themeOption.isPremium
                          ? 'bg-gradient-to-br from-amber-400/20 to-purple-500/20 text-primary'
                          : 'bg-secondary hover:bg-secondary/80'
                    }`}>
                      <themeOption.icon className="w-6 h-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h4 className="font-bold text-lg leading-tight">{themeOption.name}</h4>
                        {isActive && (
                          <Badge variant="default" className="text-xs bg-gradient-to-r from-primary to-accent">
                            ✨ Aktif
                          </Badge>
                        )}
                        {themeOption.isPremium && !isActive && (
                          <Badge className="text-xs bg-gradient-to-r from-amber-400 to-purple-500 text-white border-0">
                            👑 Premium
                          </Badge>
                        )}
                        {!isAvailable && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Kilitli
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm font-medium text-foreground mb-2 leading-relaxed">
                        {themeOption.description}
                      </p>
                      
                      <div className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-lg p-2 border-l-2 border-primary/30">
                        {themeOption.preview}
                      </div>
                    </div>
                  </div>
                  
                  {isAvailable && (
                    <Button
                      variant={isActive ? "default" : "outline"}
                      size="default"
                      disabled={isActive}
                      className={`w-full transition-all duration-300 font-semibold ${
                        isActive 
                          ? 'bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-lg' 
                          : themeOption.isPremium
                            ? 'border-2 hover:bg-gradient-to-r hover:from-amber-400/10 hover:to-purple-500/10 hover:border-primary'
                            : 'hover:bg-primary hover:text-primary-foreground'
                      }`}
                    >
                      {isActive ? '✨ Aktif Tema' : themeOption.isPremium ? '👑 Premium Seç' : '🎨 Temayı Seç'}
                    </Button>
                  )}
                  
                  {!isAvailable && (
                    <Button
                      variant="secondary"
                      size="default"
                      disabled
                      className="w-full opacity-60"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      Marketten Satın Al
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {user && (
        <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
              <Gamepad2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-sm">Premium Tema Koleksiyonu</p>
              <p className="text-xs text-muted-foreground">
                🎨 Özel tasarım temaları • ✨ Benzersiz efektler • 👑 VIP deneyim
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};