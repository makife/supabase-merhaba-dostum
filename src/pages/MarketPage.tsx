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
import { useNativeSubscriptions } from '@/hooks/useNativeSubscriptions';
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
  image?: string;
}

const MarketPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, isPremium, refreshProfile } = useUser();
  const { isAdLoading, isAdReady, initializeAdMob, loadRewardedAd, showRewardedAd } = useAdMob();
  const { processPurchase, hasPurchased, loading: purchaseLoading } = useUserPurchases();
  const { 
    isLoading: isSubscriptionLoading, 
    subscriptionProducts,
    isSubscribed,
    subscriptionInfo,
    purchaseSubscription,
    restoreSubscriptions,
    openSubscriptionManagement
  } = useNativeSubscriptions();

  const marketItems: MarketItem[] = [
    // Oyun Hakları
    {
      id: 'credits_10',
      title: '10 Oyun Hakkı',
      description: 'Ekstra 10 oyun hakkı kazanın',
      price: 4.99,
      currency: 'premium',
      icon: Zap,
      type: 'credits',
      value: 10
    },
    {
      id: 'credits_25',
      title: '25 Oyun Hakkı',
      description: 'Ekstra 25 oyun hakkı kazanın',
      price: 9.99,
      currency: 'premium',
      icon: Zap,
      type: 'credits',
      value: 25
    },
    {
      id: 'credits_50',
      title: '50 Oyun Hakkı',
      description: 'Büyük oyun hakkı paketi',
      price: 17.99,
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
      price: 7.99,
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
      price: 24.99,
      currency: 'premium',
      icon: Infinity,
      type: 'unlimited_time',
      value: 24,
      duration: '24 saat'
    },

    // Premium
    {
      id: 'premium_month',
      title: 'Premium Üyelik',
      description: 'Sınırsız oyun, tüm temalar, sesler, çerçeveler ve özel özellikler',
      price: 29.99,
      currency: 'premium',
      icon: Crown,
      type: 'premium',
      value: 30
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
      id: 'avatar_floral_roses',
      title: 'Gül Çerçevesi',
      description: 'Romantik gül desenli çerçeve',
      price: 2.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/a717e6dc-c468-4e17-9e40-e2a47817aed6.png'
    },
    {
      id: 'avatar_blue_berries',
      title: 'Mavi Çilek Çerçevesi',
      description: 'Sevimli mavi çilek desenli çerçeve',
      price: 1.99,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/9224e301-b3e4-47ba-9be4-b9a4fd4694a5.png'
    },
    {
      id: 'avatar_gold_simple',
      title: 'Sade Altın Çerçeve',
      description: 'Minimalist altın çerçeve',
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/aa2df12c-9aa3-49c0-a78e-4a946ad9c396.png'
    },
    {
      id: 'avatar_floral_wreath',
      title: 'Çiçek Çelengi',
      description: 'Renkli çiçek çelengi çerçevesi',
      price: 2.99,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/eea94c24-3141-4496-ab48-9911ecfd1400.png'
    },
    {
      id: 'avatar_purple_flowers',
      title: 'Mor Çiçek Çerçevesi',
      description: 'Zarif mor çiçek desenli çerçeve',
      price: 2.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/1b6aaacc-0774-46f0-9aed-58be7383877a.png'
    },
    {
      id: 'avatar_pink_flowers',
      title: 'Pembe Çiçek Çerçevesi',
      description: 'Tatlı pembe çiçek desenli çerçeve',
      price: 2.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/4a19df44-882d-4bf3-b557-2986fd9ea69e.png'
    },
    {
      id: 'avatar_antique_bronze',
      title: 'Antik Bronz Çerçeve',
      description: 'Klasik antik bronz çerçeve',
      price: 3.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/227894f5-629e-46a5-88d7-2d8df2460fa2.png'
    },
    {
      id: 'avatar_green_patrick',
      title: 'Yeşil Şans Çerçevesi',
      description: 'Şanslı yeşil temmalı çerçeve',
      price: 2.99,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/d9551411-6a1a-4199-b99e-a0ff5defbf4e.png'
    },
    {
      id: 'avatar_heart_roses',
      title: 'Kalp Gül Çerçevesi',
      description: 'Sevgi dolu kalp ve gül çerçevesi',
      price: 3.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/ff7b6503-a976-4eb1-87d0-2373423fc6e5.png'
    },
    {
      id: 'avatar_christmas_lights',
      title: 'Noel Işıkları Çerçevesi',
      description: 'Renkli noel ışıkları ile çerçeve',
      price: 2.99,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/2e9f15c2-49f4-461f-997e-84c4682368c6.png'
    },
    {
      id: 'avatar_ornate_gold',
      title: 'Süslü Altın Çerçeve',
      description: 'Detaylı süslemeli lüks altın çerçeve',
      price: 4.99,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/9ed9fbb7-3aa3-4185-96c5-d118e2067712.png'
    },
    {
      id: 'avatar_party_balloons',
      title: 'Parti Balonları Çerçevesi',
      description: 'Renkli parti balonları ile çerçeve',
      price: 2.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/afa305fa-30a5-496f-8af0-029aa71047a3.png'
    },
    {
      id: 'avatar_christmas_tree',
      title: 'Noel Ağacı Çerçevesi',
      description: 'Noel ağacı ve hediyeli özel çerçeve',
      price: 3.99,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/b2d1b581-c29f-43e4-b354-2889ce0621b1.png'
    },
    {
      id: 'avatar_ornate_black',
      title: 'Siyah Süslü Çerçeve',
      description: 'Klasik siyah süslemeli çerçeve',
      price: 3.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/5b932686-4cbb-44bb-8aa0-d9172ae54764.png'
    },
    {
      id: 'avatar_black_floral',
      title: 'Siyah Çiçek Çerçevesi',
      description: 'Zarif siyah çiçek motifli çerçeve',
      price: 3.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/53623185-5b73-4dd2-bc2b-1af5b94f321a.png'
    },
    {
      id: 'avatar_golden_stars',
      title: 'Altın Yıldızlar Çerçevesi',
      description: 'Yeni yıl temalı altın yıldız çerçevesi',
      price: 4.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/ff8a7b50-41b9-461a-bd0b-0e166b281ef3.png'
    },
    {
      id: 'avatar_wavy_black',
      title: 'Dalgalı Siyah Çerçeve',
      description: 'Modern dalgalı siyah çerçeve',
      price: 2.99,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/309c658e-e0d1-423a-80d6-9b012943f30d.png'
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

    // Müzik Paketleri
    {
      id: 'music_pack_nature1',
      title: 'Doğa Müziği 1',
      description: 'Sakin doğa müziği - Orman sesleri',
      price: 1.99,
      currency: 'premium',
      icon: Music,
      type: 'sound',
      value: 1
    },
    {
      id: 'music_pack_nature2',
      title: 'Doğa Müziği 2',
      description: 'Huzurlu doğa müziği - Su sesleri',
      price: 1.99,
      currency: 'premium',
      icon: Music,
      type: 'sound',
      value: 1
    },
    {
      id: 'music_pack_space1',
      title: 'Uzay Müziği 1',
      description: 'Elektronik uzay müziği - Ambient',
      price: 1.99,
      currency: 'premium',
      icon: Music,
      type: 'sound',
      value: 1
    },
    {
      id: 'music_pack_space2',
      title: 'Uzay Müziği 2',
      description: 'Sintetik uzay müziği - Cosmic',
      price: 1.99,
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

    // İpucu Paketleri - Kredi ile
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

    // Check if this is a premium subscription purchase on mobile
    if (typeof window !== 'undefined' && window.Capacitor && item.type === 'premium') {
      // Use native subscription system for premium purchases on mobile
      const success = await purchaseSubscription('premium_monthly');
      return;
    }

    // Use web-based purchase system for web/browser
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
                {item.type === 'avatar' && item.image ? (
                  <div className="w-12 h-12 relative">
                    <img 
                      src={item.image} 
                      alt={item.title}
                      className="w-12 h-12 object-contain rounded-lg border border-border"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center">
                    <item.icon className="w-5 h-5" />
                  </div>
                )}
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
                     `₺${item.price}`
                   )}
                </div>
                 <Button 
                   onClick={() => handlePurchase(item)}
                   size="sm"
                   className="mt-1 text-xs px-2 py-1 h-7"
                   disabled={
                     (item.currency === 'credits' && (profile?.game_credits || 0) < item.price) || 
                     purchaseLoading || 
                     isSubscriptionLoading || 
                     hasPurchased(item.id)
                   }
                 >
                   {hasPurchased(item.id) ? 'Satın Alındı' :
                    (item.currency === 'credits' && (profile?.game_credits || 0) < item.price) ? 'Yetersiz' : 
                    (purchaseLoading || isSubscriptionLoading) ? 'İşleniyor...' : 'Satın Al'
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

        {/* Mobile Purchase Restore */}
        {typeof window !== 'undefined' && window.Capacitor && (
          <Card className="border-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Satın Alımları Geri Yükle</h3>
                  <p className="text-xs text-muted-foreground">Önceki satın alımlarınızı geri yükleyin</p>
                </div>
                <Button 
                  onClick={restoreSubscriptions}
                  size="sm"
                  variant="outline"
                  disabled={isSubscriptionLoading}
                  className="text-xs"
                >
                  {isSubscriptionLoading ? 'Yükleniyor...' : 'Geri Yükle'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
            {!isPremium && renderMarketItems(getItemsByCategory('credits'))}
            {isPremium && (
              <Card className="border-green-500">
                <CardContent className="p-6 text-center">
                  <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">Premium Üyesiniz!</h3>
                  <p className="text-muted-foreground">
                    Zaten sınırsız oyun hakkınız bulunuyor. Ek satın alma yapmanıza gerek yok.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Premium & Abonelik */}
          <TabsContent value="premium" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Crown className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold">Premium Abonelik</h3>
            </div>
            
            {/* Native Mobile Subscription Cards */}
            {typeof window !== 'undefined' && window.Capacitor && !isPremium && (
              <div className="space-y-4 mb-6">
                <h4 className="text-md font-semibold text-yellow-600">🎯 Mobil Abonelik Planları</h4>
                {subscriptionProducts.map((product) => (
                  <Card key={product.id} className="border-yellow-500 hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center">
                            <Crown className="w-8 h-8 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-bold">{product.title}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{product.description}</p>
                            <div className="flex items-center space-x-2">
                              <Badge variant="default" className="bg-yellow-500">
                                {product.period === 'monthly' ? 'Aylık' : 'Yıllık'}
                              </Badge>
                              {product.period === 'yearly' && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  %40 İndirim
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-yellow-600 mb-2">
                            {product.price}
                          </div>
                          <Button 
                            onClick={() => purchaseSubscription(product.id)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white"
                            disabled={isSubscriptionLoading}
                          >
                            {isSubscriptionLoading ? 'İşleniyor...' : 'Abone Ol'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Web Premium or Already Premium */}
            {(typeof window !== 'undefined' && !window.Capacitor && !isPremium) && 
              renderMarketItems(getItemsByCategory('premium'))
            }
            
            {isPremium && (
              <Card className="border-green-500">
                <CardContent className="p-6 text-center">
                  <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">Premium Üyesiniz!</h3>
                  <p className="text-muted-foreground mb-4">
                    Tüm premium özellikler aktif. Harika seçim!
                  </p>
                  {subscriptionInfo && (
                    <div className="text-sm text-muted-foreground">
                      {subscriptionInfo.expiryDate && (
                        <p>Abonelik: {new Date(subscriptionInfo.expiryDate).toLocaleDateString('tr-TR')}'e kadar</p>
                      )}
                    </div>
                  )}
                  {typeof window !== 'undefined' && window.Capacitor && (
                    <Button 
                      onClick={openSubscriptionManagement}
                      variant="outline"
                      className="mt-4"
                    >
                      Aboneliği Yönet
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Temalar */}
          <TabsContent value="themes" className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Palette className="w-5 h-5 text-purple-500" />
              <h3 className="text-lg font-semibold">Temalar & Görünüm</h3>
            </div>
            {!isPremium && renderMarketItems(getItemsByCategory('themes'))}
            {isPremium && (
              <Card className="border-green-500">
                <CardContent className="p-6 text-center">
                  <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-2">Premium Üyesiniz!</h3>
                  <p className="text-muted-foreground">
                    Tüm premium temalar size açık. Ayarlar sayfasından temalarınızı değiştirebilirsiniz.
                  </p>
                </CardContent>
              </Card>
            )}
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
                {!isPremium && renderMarketItems(getItemsByCategory('avatar'))}
                {isPremium && (
                  <Card className="border-green-500">
                    <CardContent className="p-6 text-center">
                      <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold mb-2">Premium Üyesiniz!</h3>
                      <p className="text-muted-foreground">
                        Tüm avatar çerçeveleri size açık. Ayarlar sayfasından çerçevenizi değiştirebilirsiniz.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="effects">
                <div className="flex items-center space-x-2 mb-4">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  <h3 className="text-lg font-semibold">Ses & Efektler</h3>
                </div>
                {!isPremium && renderMarketItems(getItemsByCategory('effects'))}
                {isPremium && (
                  <Card className="border-green-500">
                    <CardContent className="p-6 text-center">
                      <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold mb-2">Premium Üyesiniz!</h3>
                      <p className="text-muted-foreground">
                        Tüm ses paketleri ve efektler size açık. Ayarlar sayfasından ses paketinizi değiştirebilirsiniz.
                      </p>
                    </CardContent>
                  </Card>
                )}
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
                    {!isPremium && renderMarketItems(getItemsByCategory('extras').filter(item => item.currency === 'premium'))}
                    {isPremium && (
                      <Card className="border-green-500">
                        <CardContent className="p-6 text-center">
                          <Crown className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                          <h3 className="text-lg font-semibold mb-2">Premium Üyesiniz!</h3>
                          <p className="text-muted-foreground">
                            Tüm premium rozetler ve özellikler size açık.
                          </p>
                        </CardContent>
                      </Card>
                    )}
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
                <Palette className="w-4 h-4 mr-2 text-yellow-500" />
                Tüm temalara erişim
              </li>
              <li className="flex items-center">
                <Volume2 className="w-4 h-4 mr-2 text-yellow-500" />
                Tüm ses paketlerine erişim
              </li>
              <li className="flex items-center">
                <Frame className="w-4 h-4 mr-2 text-yellow-500" />
                Tüm avatar çerçevelerine erişim
              </li>
              <li className="flex items-center">
                <Star className="w-4 h-4 mr-2 text-yellow-500" />
                Reklamız deneyim
              </li>
              <li className="flex items-center">
                <Gift className="w-4 h-4 mr-2 text-yellow-500" />
                Özel rozetler ve ödüller
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MarketPage;