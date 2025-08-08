import { useState, useEffect } from 'react';

// Capacitor type check
declare global {
  interface Window {
    Capacitor?: any;
  }
}
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { useAdMob } from '@/hooks/useAdMob';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft,
  ShoppingCart,
  Crown,
  Zap,
  Clock,
  Gift,
  Star,
  Infinity,
  Palette,
  Frame,
  Volume2,
  Sparkles,
  Trophy,
  Music,
  Image,
  Lightbulb,
  Heart,
  Moon,
  Sun,
  Gamepad2
} from 'lucide-react';

interface MarketItem {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: 'credits' | 'premium';
  icon: any;
  type: 'credits' | 'unlimited_time' | 'premium' | 'theme' | 'avatar' | 'sound' | 'effect' | 'badge' | 'hint';
  value: number;
  duration?: string;
}

const MarketPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, isPremium, refreshProfile } = useUser();
  const { isAdLoading, isAdReady, initializeAdMob, loadRewardedAd, showRewardedAd } = useAdMob();
  const { processPurchase, hasPurchased, loading: purchaseLoading } = useUserPurchases();

  const marketItems: MarketItem[] = [
    // Oyun Hakları
    {
      id: 'credits_10',
      title: '10 Oyun Hakkı',
      description: 'Ekstra 10 oyun hakkı kazanın',
      price: 0.99,
      currency: 'premium',
      icon: Zap,
      type: 'credits',
      value: 10
    },
    {
      id: 'credits_25',
      title: '25 Oyun Hakkı',
      description: 'Ekstra 25 oyun hakkı kazanın',
      price: 1.99,
      currency: 'premium',
      icon: Zap,
      type: 'credits',
      value: 25
    },
    {
      id: 'credits_50',
      title: '50 Oyun Hakkı',
      description: 'Büyük oyun hakkı paketi',
      price: 3.49,
      currency: 'premium',
      icon: Zap,
      type: 'credits',
      value: 50
    },

    // Sınırsız Zaman
    {
      id: 'unlimited_1h',
      title: '1 Saat Sınırsız',
      description: '1 saat boyunca sınırsız oyun oynayın',
      price: 1.49,
      currency: 'premium',
      icon: Clock,
      type: 'unlimited_time',
      value: 1,
      duration: '1 saat'
    },
    {
      id: 'unlimited_24h',
      title: '24 Saat Sınırsız',
      description: '24 saat boyunca sınırsız oyun oynayın',
      price: 4.99,
      currency: 'premium',
      icon: Infinity,
      type: 'unlimited_time',
      value: 24,
      duration: '24 saat'
    },

    // Premium & Reklamlar
    {
      id: 'premium_month',
      title: 'Premium Üyelik',
      description: 'Sınırsız oyun, özel temalar ve daha fazlası',
      price: 9.99,
      currency: 'premium',
      icon: Crown,
      type: 'premium',
      value: 30,
      duration: '1 ay'
    },
    {
      id: 'remove_ads',
      title: 'Reklamları Kaldır',
      description: 'Tüm reklamları kalıcı olarak kaldırın',
      price: 2.99,
      currency: 'premium',
      icon: Star,
      type: 'premium',
      value: 0
    },

    // Temalar
    {
      id: 'theme_dark_ocean',
      title: 'Koyu Okyanus Teması',
      description: 'Sakin mavi tonlarında koyu tema',
      price: 1.99,
      currency: 'premium',
      icon: Moon,
      type: 'theme',
      value: 1
    },
    {
      id: 'theme_sunset',
      title: 'Gün Batımı Teması',
      description: 'Sıcak turuncu ve pembe tonları',
      price: 1.99,
      currency: 'premium',
      icon: Sun,
      type: 'theme',
      value: 1
    },
    {
      id: 'theme_forest',
      title: 'Orman Teması',
      description: 'Doğal yeşil tonları',
      price: 1.99,
      currency: 'premium',
      icon: Palette,
      type: 'theme',
      value: 1
    },

    // Avatar Çerçeveleri
    {
      id: 'avatar_gold_frame',
      title: 'Altın Çerçeve',
      description: 'Profilinize özel altın çerçeve',
      price: 1.49,
      currency: 'premium',
      icon: Frame,
      type: 'avatar',
      value: 1
    },
    {
      id: 'avatar_rainbow_frame',
      title: 'Gökkuşağı Çerçeve',
      description: 'Renkli gökkuşağı efekti',
      price: 1.99,
      currency: 'premium',
      icon: Heart,
      type: 'avatar',
      value: 1
    },
    {
      id: 'avatar_floral_roses',
      title: 'Gül Çerçevesi',
      description: 'Romantik gül desenli çerçeve',
      price: 2.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1
    },
    {
      id: 'avatar_blue_berries',
      title: 'Mavi Çilek Çerçevesi',
      description: 'Sevimli mavi çilek desenli çerçeve',
      price: 1.99,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1
    },
    {
      id: 'avatar_gold_simple',
      title: 'Sade Altın Çerçeve',
      description: 'Minimalist altın çerçeve',
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1
    },
    {
      id: 'avatar_floral_wreath',
      title: 'Çiçek Çelengi',
      description: 'Renkli çiçek çelengi çerçevesi',
      price: 2.99,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1
    },
    {
      id: 'avatar_purple_flowers',
      title: 'Mor Çiçek Çerçevesi',
      description: 'Zarif mor çiçek desenli çerçeve',
      price: 2.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1
    },
    {
      id: 'avatar_pink_flowers',
      title: 'Pembe Çiçek Çerçevesi',
      description: 'Tatlı pembe çiçek desenli çerçeve',
      price: 2.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1
    },
    {
      id: 'avatar_antique_bronze',
      title: 'Antik Bronz Çerçeve',
      description: 'Klasik antik bronz çerçeve',
      price: 3.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1
    },
    {
      id: 'avatar_green_patrick',
      title: 'Yeşil Şans Çerçevesi',
      description: 'Şanslı yeşil temmalı çerçeve',
      price: 2.99,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1
    },
    {
      id: 'avatar_heart_roses',
      title: 'Kalp Gül Çerçevesi',
      description: 'Sevgi dolu kalp ve gül çerçevesi',
      price: 3.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1
    },

    // Ses Efektleri
    {
      id: 'sound_pack_space',
      title: 'Uzay Ses Paketi',
      description: 'Bilim kurgu ses efektleri',
      price: 1.29,
      currency: 'premium',
      icon: Volume2,
      type: 'sound',
      value: 1
    },
    {
      id: 'sound_pack_nature',
      title: 'Doğa Ses Paketi',
      description: 'Rahatlatıcı doğa sesleri',
      price: 1.29,
      currency: 'premium',
      icon: Music,
      type: 'sound',
      value: 1
    },

    // Özel Efektler
    {
      id: 'effect_fireworks',
      title: 'Havai Fişek Efekti',
      description: 'Kelime bulduğunuzda havai fişek gösterisi',
      price: 0.99,
      currency: 'premium',
      icon: Sparkles,
      type: 'effect',
      value: 1
    },
    {
      id: 'effect_confetti',
      title: 'Konfeti Efekti',
      description: 'Başarılı hamlelerinizde konfeti yağmuru',
      price: 0.99,
      currency: 'premium',
      icon: Gift,
      type: 'effect',
      value: 1
    },

    // Özel Rozetler
    {
      id: 'badge_wordmaster',
      title: 'Kelime Ustası Rozeti',
      description: 'Özel kelime ustası rozeti',
      price: 2.49,
      currency: 'premium',
      icon: Trophy,
      type: 'badge',
      value: 1
    },

    // İpucu Paketleri
    {
      id: 'hint_pack_basic',
      title: 'Temel İpucu Paketi',
      description: '10 kelime ipucu hakkı',
      price: 0.99,
      currency: 'premium',
      icon: Lightbulb,
      type: 'hint',
      value: 10
    },
    {
      id: 'hint_pack_premium',
      title: 'Premium İpucu Paketi',
      description: '25 kelime ipucu hakkı',
      price: 1.99,
      currency: 'premium',
      icon: Lightbulb,
      type: 'hint',
      value: 25
    },

    // Kredi ile Alınabilenler
    {
      id: 'credits_theme_basic',
      title: 'Klasik Tema',
      description: 'Nostaljik retro tema',
      price: 50,
      currency: 'credits',
      icon: Gamepad2,
      type: 'theme',
      value: 1
    },
    {
      id: 'credits_hint_5',
      title: '5 İpucu Hakkı',
      description: 'Kredi ile ipucu satın alın',
      price: 20,
      currency: 'credits',
      icon: Lightbulb,
      type: 'hint',
      value: 5
    }
  ];

  // Initialize AdMob
  useEffect(() => {
    initializeAdMob();
    loadRewardedAd();
  }, [initializeAdMob, loadRewardedAd]);

  const handlePurchase = async (item: MarketItem) => {
    if (!user) {
      toast({
        title: 'Hata',
        description: 'Satın almak için giriş yapmalısınız.',
        variant: 'destructive',
      });
      return;
    }

    // Yeni satın alma sistemi kullan
    const success = await processPurchase(item);
    if (success) {
      await refreshProfile(); // Profili yenile
    }
  };

  const watchAdForCredits = async () => {
    if (!user) {
      toast({
        title: 'Hata',
        description: 'Reklam izlemek için giriş yapmalısınız.',
        variant: 'destructive',
      });
      return;
    }

    // Show rewarded ad
    await showRewardedAd();
  };

  // Kategori öğelerini filtreleme fonksiyonu
  const getItemsByCategory = (category: string) => {
    switch (category) {
      case 'credits':
        return marketItems.filter(item => item.type === 'credits' || item.type === 'unlimited_time');
      case 'premium':
        return marketItems.filter(item => item.type === 'premium');
      case 'themes':
        return marketItems.filter(item => item.type === 'theme');
      case 'avatar':
        return marketItems.filter(item => item.type === 'avatar');
      case 'effects':
        return marketItems.filter(item => item.type === 'sound' || item.type === 'effect');
      case 'extras':
        return marketItems.filter(item => item.type === 'badge' || item.type === 'hint');
      case 'credits-store':
        return marketItems.filter(item => item.currency === 'credits');
      default:
        return [];
    }
  };

  // Market kartları render fonksiyonu
  const renderMarketItems = (items: MarketItem[]) => (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  {item.duration && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {item.duration}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">
                  {item.currency === 'credits' ? (
                    <span className="flex items-center justify-end text-orange-500">
                      <Zap className="w-3 h-3 mr-1" />
                      {item.price}
                    </span>
                  ) : (
                    `$${item.price}`
                  )}
                </div>
                <Button 
                  onClick={() => handlePurchase(item)}
                  size="sm"
                  className="mt-1 text-xs px-2 py-1 h-7"
                  disabled={(item.currency === 'credits' && (profile?.game_credits || 0) < item.price) || purchaseLoading || hasPurchased(item.id)}
                >
                  {hasPurchased(item.id) ? 'Satın Alındı' :
                   (item.currency === 'credits' && (profile?.game_credits || 0) < item.price) ? 'Yetersiz' : 
                   purchaseLoading ? 'İşleniyor...' : 'Satın Al'
                  }
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <h1 className="text-2xl font-bold flex items-center">
            <ShoppingCart className="w-6 h-6 mr-2" />
            Market
          </h1>
          <div className="w-16" />
        </div>

        {/* User Status */}
        <Card className="border-primary">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                  <Crown className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold">Mevcut Durumunuz</p>
                  <div className="flex items-center space-x-4 mt-1">
                    <Badge variant={isPremium ? "default" : "secondary"}>
                      {isPremium ? "Premium Üye" : "Ücretsiz Üye"}
                    </Badge>
                    <span className="text-sm">
                      {isPremium ? (
                        <>
                          <Crown className="w-4 h-4 inline mr-1" />
                          Sınırsız Hak
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 inline mr-1" />
                          {profile?.game_credits || 0} Hak
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Free Credits */}
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center text-green-600">
              <Gift className="w-5 h-5 mr-2" />
              Ücretsiz Hak Kazan
            </CardTitle>
            <CardDescription>
              Reklam izleyerek ücretsiz oyun hakkı kazanın
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {/* Web'de AdMob çalışmaz - sadece mobil */}
                {typeof window !== 'undefined' && !window.Capacitor ? 
                  "⚠️ Reklamlar sadece mobil uygulamada çalışır. Web'de test edilemez." :
                  (isAdReady ? "Reklam hazır! İzlemek için tıklayın." : "Reklam yükleniyor...")
                }
              </p>
              <Button 
                onClick={watchAdForCredits}
                disabled={!isAdReady || isAdLoading || (typeof window !== 'undefined' && !window.Capacitor)}
                className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50"
              >
                <Gift className="w-4 h-4 mr-2" />
                {typeof window !== 'undefined' && !window.Capacitor ? 
                  'Sadece Mobil Uygulamada Çalışır' :
                  (isAdLoading ? 'Yükleniyor...' : isAdReady ? 'Ödüllü Reklam İzle (+1 Kredi)' : 'Reklam Hazırlanıyor...')
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Market Kategorileri */}
        <Tabs defaultValue="credits" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="credits" className="text-xs">Oyun</TabsTrigger>
            <TabsTrigger value="premium" className="text-xs">Premium</TabsTrigger>
            <TabsTrigger value="themes" className="text-xs">Temalar</TabsTrigger>
            <TabsTrigger value="extras" className="text-xs">Diğer</TabsTrigger>
          </TabsList>
          
          {/* Oyun Hakları & Sınırsız */}
          <TabsContent value="credits" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Oyun Hakları & Sınırsız Zaman</h3>
            </div>
            {renderMarketItems(getItemsByCategory('credits'))}
          </TabsContent>
          
          {/* Premium & Reklamlar */}
          <TabsContent value="premium" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Crown className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold">Premium & Reklamlar</h3>
            </div>
            {renderMarketItems(getItemsByCategory('premium'))}
          </TabsContent>
          
          {/* Temalar */}
          <TabsContent value="themes" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Palette className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold">Temalar & Görünüm</h3>
            </div>
            <Tabs defaultValue="theme-premium" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="theme-premium">Premium Temalar</TabsTrigger>
                <TabsTrigger value="theme-credits">Kredi Temalar</TabsTrigger>
              </TabsList>
              <TabsContent value="theme-premium">
                {renderMarketItems(getItemsByCategory('themes').filter(item => item.currency === 'premium'))}
              </TabsContent>
              <TabsContent value="theme-credits">
                {renderMarketItems(getItemsByCategory('themes').filter(item => item.currency === 'credits'))}
              </TabsContent>
            </Tabs>
          </TabsContent>
          
          {/* Diğer Öğeler */}
          <TabsContent value="extras" className="space-y-4">
            <Tabs defaultValue="avatar" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="avatar" className="text-xs">Avatar</TabsTrigger>
                <TabsTrigger value="effects" className="text-xs">Efektler</TabsTrigger>
                <TabsTrigger value="extras-items" className="text-xs">Rozetler</TabsTrigger>
              </TabsList>
              
              <TabsContent value="avatar">
                <div className="flex items-center space-x-2 mb-4">
                  <Frame className="w-5 h-5 text-pink-500" />
                  <h3 className="text-lg font-semibold">Avatar Çerçeveleri</h3>
                </div>
                {renderMarketItems(getItemsByCategory('avatar'))}
              </TabsContent>
              
              <TabsContent value="effects">
                <div className="flex items-center space-x-2 mb-4">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">Ses & Efektler</h3>
                </div>
                {renderMarketItems(getItemsByCategory('effects'))}
              </TabsContent>
              
              <TabsContent value="extras-items">
                <div className="flex items-center space-x-2 mb-4">
                  <Trophy className="w-5 h-5 text-orange-500" />
                  <h3 className="text-lg font-semibold">Rozetler & İpuçları</h3>
                </div>
                <Tabs defaultValue="extras-premium" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="extras-premium">Premium</TabsTrigger>
                    <TabsTrigger value="extras-credits">Kredi</TabsTrigger>
                  </TabsList>
                  <TabsContent value="extras-premium">
                    {renderMarketItems(getItemsByCategory('extras').filter(item => item.currency === 'premium'))}
                  </TabsContent>
                  <TabsContent value="extras-credits">
                    {renderMarketItems(getItemsByCategory('extras').filter(item => item.currency === 'credits'))}
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Premium Benefits */}
        <Card className="border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-600">
              <Crown className="w-5 h-5 mr-2" />
              Premium Avantajları
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <Infinity className="w-4 h-4 mr-2 text-yellow-500" />
                Sınırsız oyun hakkı
              </li>
              <li className="flex items-center">
                <Star className="w-4 h-4 mr-2 text-yellow-500" />
                Reklamız deneyim
              </li>
              <li className="flex items-center">
                <Gift className="w-4 h-4 mr-2 text-yellow-500" />
                Özel rozetler ve ödüller
              </li>
              <li className="flex items-center">
                <Zap className="w-4 h-4 mr-2 text-yellow-500" />
                Öncelikli maç eşleşmesi
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketPage;