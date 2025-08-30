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

    // Premium - Aylık ve Yıllık
    {
      id: 'premium_month',
      title: 'Premium Aylık',
      description: 'Sınırsız oyun, tüm temalar, sesler, çerçeveler ve özel özellikler',
      price: 29.99,
      currency: 'premium',
      icon: Crown,
      type: 'premium',
      value: 30
    },
    {
      id: 'premium_year',
      title: 'Premium Yıllık',
      description: '12 aylık premium üyelik - %40 tasarruf! Tüm özellikler dahil',
      price: 199.99,
      currency: 'premium',
      icon: Crown,
      type: 'premium',
      value: 365
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

    // Avatar Çerçeveleri - TÜM ORİJİNAL ÇERÇEVELER
    {
      id: 'avatar_floral_roses',
      title: 'Gül Çerçevesi',
      description: 'Romantik gül desenli çerçeve',
      price: 1.49,
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
      price: 1.49,
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
      price: 1.49,
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
      price: 1.49,
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
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/b2d1b581-c29f-43e4-b354-2889ce0621b1.png'
    },
    {
      id: 'avatar_antique_bronze',
      title: 'Antik Bronz Çerçeve',
      description: 'Nostaljik antik bronz çerçeve',
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/da0c0d9e-ba9a-49b1-aec9-b5b5d8e0e7f2.png'
    },
    {
      id: 'avatar_green_patrick',
      title: 'Yeşil Patrick Çerçevesi',
      description: 'Şanslı yonca desenli çerçeve',
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/832fc6fe-e9b4-451a-bc8c-3a1ae8c2bfaa.png'
    },
    {
      id: 'avatar_heart_roses',
      title: 'Kalp Güller Çerçevesi',
      description: 'Romantik kalp ve gül motifli çerçeve',
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/dc6bd5c7-38e1-4ce8-ae6b-8b2b0d7d7c5e.png'
    },
    {
      id: 'avatar_christmas_lights',
      title: 'Noel Işıkları Çerçevesi',
      description: 'Renkli noel ışıkları çerçevesi',
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/f8f8f8f8-f8f8-f8f8-f8f8-f8f8f8f8f8f8.png'
    },
    {
      id: 'avatar_ornate_gold',
      title: 'Süslü Altın Çerçeve',
      description: 'Lüks süslemeli altın çerçeve',
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/b2d1b581-c29f-43e4-b354-2889ce0621b1.png'
    },
    {
      id: 'avatar_party_balloons',
      title: 'Parti Balonları Çerçevesi',
      description: 'Renkli parti balonları çerçevesi',
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/da0c0d9e-ba9a-49b1-aec9-b5b5d8e0e7f2.png'
    },
    {
      id: 'avatar_christmas_tree',
      title: 'Noel Ağacı Çerçevesi',
      description: 'Noel ağacı temalı çerçeve',
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/832fc6fe-e9b4-451a-bc8c-3a1ae8c2bfaa.png'
    },
    {
      id: 'avatar_ornate_black',
      title: 'Siyah Süslü Çerçeve',
      description: 'Klasik siyah süslemeli çerçeve',
      price: 1.49,
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
      price: 1.49,
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
      price: 1.49,
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
      price: 1.49,
      currency: 'premium',
      icon: Image,
      type: 'avatar',
      value: 1,
      image: '/lovable-uploads/309c658e-e0d1-423a-80d6-9b012943f30d.png'
    },

    // Ses Efekti Paketleri
    {
      id: 'sound_pack_space',
      title: 'Uzay Ses Paketi',
      description: 'Futuristik elektronik ses efektleri',
      price: 1.99,
      currency: 'premium',
      icon: Zap,
      type: 'sound',
      value: 1
    },
    {
      id: 'sound_pack_nature',
      title: 'Doğa Ses Paketi',
      description: 'Rahatlatıcı doğa ses efektleri',
      price: 1.99,
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

  const watchAdForCredits = async () => {
    try {
      await loadRewardedAd();
      await showRewardedAd();
      
      toast({
        title: 'Tebrikler!',
        description: '+1 oyun kredisi kazandınız!',
        variant: 'default',
      });
      
      refreshProfile();
    } catch (error) {
      console.error('Ad error:', error);
      toast({
        title: 'Reklam hatası',
        description: 'Reklam gösterilemedi. Lütfen tekrar deneyin.',
        variant: 'destructive',
      });
    }
  };

  const handlePurchase = async (item: MarketItem) => {
    if (!user) {
      toast({
        title: 'Giriş yapmanız gerekiyor',
        description: 'Satın alma yapmak için önce giriş yapın.',
        variant: 'destructive',
      });
      return;
    }

    if (hasPurchased(item.id)) {
      toast({
        title: 'Zaten sahipsiniz',
        description: 'Bu ürün zaten sizde mevcut.',
        variant: 'default',
      });
      return;
    }

    try {
      if (item.type === 'premium') {
        // Premium üyelik için subscription kullan
        if (subscriptionProducts.length > 0) {
          await purchaseSubscription(subscriptionProducts[0].id);
        }
      } else {
        await processPurchase(item);
      }

      toast({
        title: 'Satın alma başarılı!',
        description: `${item.title} başarıyla satın alındı.`,
        variant: 'default',
      });

      refreshProfile();
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        title: 'Satın alma hatası',
        description: 'Satın alma işlemi başarısız oldu.',
        variant: 'destructive',
      });
    }
  };

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
      case 'sounds':
        return marketItems.filter(item => item.type === 'sound');
      case 'effects':
        return marketItems.filter(item => item.type === 'effect');
      case 'extras':
        return marketItems.filter(item => item.type === 'badge' || item.type === 'hint');
      default:
        return [];
    }
  };

  const renderMarketItems = (items: MarketItem[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(item => (
        <Card 
          key={item.id} 
          className="group relative overflow-hidden border transition-all duration-300 hover:scale-105 hover:shadow-xl hover:border-primary/50 bg-gradient-to-br from-card to-muted/50 backdrop-blur-sm"
        >
          {/* Light background overlay for better text readability */}
          <div className="absolute inset-0 bg-background/5" />
          
          {/* Animated sparkles */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500">
            <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse" />
            <div className="absolute top-6 right-6 w-1 h-1 bg-accent rounded-full animate-pulse delay-100" />
            <div className="absolute bottom-4 left-4 w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse delay-200" />
          </div>

          <CardContent className="relative z-10 p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-foreground">
                  {item.price}{item.currency === 'credits' ? ' kredi' : '₺'}
                </p>
                {item.duration && (
                  <p className="text-xs text-muted-foreground">{item.duration}</p>
                )}
              </div>
            </div>

            {item.image && (
              <div className="w-12 h-12 mx-auto mb-3 rounded-full overflow-hidden border-2 border-border">
                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors duration-200">
                {item.title}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {item.description}
              </p>
              
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-1">
                  {hasPurchased(item.id) && (
                    <Badge className="bg-primary text-primary-foreground border-primary/50 text-xs px-2 py-1">
                      ✓ Satın Alındı
                    </Badge>
                  )}
                  {isPremium && (item.type === 'credits' || item.type === 'unlimited_time') && (
                    <Badge className="bg-accent text-accent-foreground border-accent/50 text-xs px-2 py-1">
                      Premium
                    </Badge>
                  )}
                </div>
                <Button 
                  onClick={() => handlePurchase(item)}
                  disabled={
                    hasPurchased(item.id) ||
                    (isPremium && (item.type === 'credits' || item.type === 'unlimited_time')) ||
                    (item.currency === 'credits' && (profile?.game_credits || 0) < item.price) ||
                    purchaseLoading || 
                    isSubscriptionLoading
                  }
                  className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-105 text-xs px-3 py-1"
                  size="sm"
                >
                  {hasPurchased(item.id) ? 'Alındı' :
                   (item.currency === 'credits' && (profile?.game_credits || 0) < item.price) ? 'Yetersiz' : 
                   (purchaseLoading || isSubscriptionLoading) ? 'İşleniyor...' : 'Satın Al'}
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/')}
            className="bg-card/50 border-border text-foreground hover:bg-card/80 backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <div className="w-16" />
        </div>

        {/* Market Hero Section with Image */}
        <div className="text-center mb-8 p-6 bg-gradient-to-br from-card/50 to-muted/50 rounded-2xl backdrop-blur-sm border border-border/20">
          <div className="relative mx-auto w-64 h-40 mb-4">
            <img 
              src="/marketimaj.png" 
              alt="Market" 
              className="w-full h-full object-contain drop-shadow-2xl"
            />
          </div>
          <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            ✨ Premium Market ✨
          </h1>
          <p className="text-muted-foreground">Oyun deneyiminizi bir üst seviyeye taşıyın</p>
        </div>

        {/* User Status */}
        <Card className="border-0 bg-gradient-to-r from-primary/10 to-accent/10 backdrop-blur-md border border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-xl">
                  <Crown className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-lg text-foreground">Mevcut Durumunuz</p>
                  <div className="flex items-center space-x-3 mt-1">
                    <Badge 
                      variant={isPremium ? "default" : "secondary"}
                      className={isPremium ? "bg-primary text-primary-foreground border-primary/50" : "bg-muted text-muted-foreground border-muted/50"}
                    >
                      {isPremium ? "Premium Üye" : "Ücretsiz Üye"}
                    </Badge>
                    <span className="text-base font-medium text-foreground">
                      {isPremium ? "Sınırsız oyun hakkı" : `${profile?.game_credits || 0} oyun hakkı`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reward Section */}
        <Card className="border-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/10 backdrop-blur-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Gift className="w-10 h-10 text-primary" />
                <div>
                  <h3 className="font-semibold text-lg text-foreground">Ücretsiz Kredi Kazan!</h3>
                  <p className="text-muted-foreground">
                    {isAdReady ? "Reklam izleyerek +1 kredi kazanın" : 
                     isAdLoading ? "Reklam yükleniyor..." : 
                     "Reklam hazırlanıyor..."}
                  </p>
                </div>
              </div>
              <Button 
                onClick={watchAdForCredits}
                disabled={!isAdReady || isAdLoading || (typeof window !== 'undefined' && !window.Capacitor)}
                className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Gift className="w-4 h-4 mr-2" />
                {typeof window !== 'undefined' && !window.Capacitor ? 
                  'Sadece Mobil' :
                  (isAdLoading ? 'Yükleniyor...' : isAdReady ? 'Reklam İzle' : 'Hazırlanıyor...')
                }
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Mobile Purchase Restore */}
        {typeof window !== 'undefined' && window.Capacitor && (
          <Card className="border-0 bg-muted/40 backdrop-blur-md">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">Satın Alımları Geri Yükle</h3>
                  <p className="text-sm text-muted-foreground">Önceki satın alımlarınızı geri yükleyin</p>
                </div>
                <Button 
                  onClick={restoreSubscriptions}
                  size="sm"
                  variant="outline"
                  disabled={isSubscriptionLoading}
                  className="bg-card/50 border-border text-foreground hover:bg-card/80"
                >
                  {isSubscriptionLoading ? 'Yükleniyor...' : 'Geri Yükle'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Market Kategorileri */}
        <Tabs defaultValue="credits" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-card/80 backdrop-blur-md rounded-2xl p-2 border border-border/20">
            <TabsTrigger 
              value="credits" 
              className="flex items-center space-x-2 text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-xl transition-all duration-300"
            >
              <Gamepad2 className="w-4 h-4" />
              <span className="font-medium">Oyun</span>
            </TabsTrigger>
            <TabsTrigger 
              value="premium" 
              className="flex items-center space-x-2 text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-xl transition-all duration-300"
            >
              <Crown className="w-4 h-4" />
              <span className="font-medium">Premium</span>
            </TabsTrigger>
            <TabsTrigger 
              value="themes" 
              className="flex items-center space-x-2 text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-xl transition-all duration-300"
            >
              <Palette className="w-4 h-4" />
              <span className="font-medium">Temalar</span>
            </TabsTrigger>
            <TabsTrigger 
              value="extras" 
              className="flex items-center space-x-2 text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-foreground rounded-xl transition-all duration-300"
            >
              <Gift className="w-4 h-4" />
              <span className="font-medium">Diğer</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Oyun Hakları & Sınırsız */}
          <TabsContent value="credits" className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <Zap className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-bold text-foreground">Oyun Hakları & Sınırsız Zaman</h3>
            </div>
            {!isPremium && renderMarketItems(getItemsByCategory('credits'))}
            {isPremium && (
              <Card className="border-0 bg-gradient-to-r from-primary/15 to-accent/15 backdrop-blur-md">
                <CardContent className="p-4 text-center">
                  <Crown className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h3 className="text-xl font-bold mb-2 text-foreground">Premium Üyesiniz!</h3>
                  <p className="text-muted-foreground">
                    Zaten sınırsız oyun hakkınız bulunuyor.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Premium Üyelik */}
          <TabsContent value="premium" className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <Crown className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-bold text-foreground">Premium Üyelik</h3>
            </div>
            {!isPremium && renderMarketItems(getItemsByCategory('premium'))}
            {isPremium && (
              <Card className="border-0 bg-gradient-to-r from-primary/15 to-accent/15 backdrop-blur-md">
                <CardContent className="p-4 text-center">
                  <Crown className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h3 className="text-xl font-bold mb-2 text-foreground">Zaten Premium Üyesiniz!</h3>
                  <p className="text-muted-foreground">
                    Tüm premium özelliklere erişiminiz bulunuyor.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Temalar */}
          <TabsContent value="themes" className="space-y-4">
            <div className="flex items-center space-x-3 mb-4">
              <Palette className="w-6 h-6 text-primary" />
              <h3 className="text-2xl font-bold text-foreground">Temalar</h3>
            </div>
            {!isPremium && renderMarketItems(getItemsByCategory('themes'))}
            {isPremium && (
              <Card className="border-0 bg-gradient-to-r from-primary/15 to-accent/15 backdrop-blur-md">
                <CardContent className="p-4 text-center">
                  <Crown className="w-12 h-12 text-primary mx-auto mb-3" />
                  <h3 className="text-xl font-bold mb-2 text-foreground">Premium Üyesiniz!</h3>
                  <p className="text-muted-foreground">
                    Tüm temalar size açık. Ayarlar sayfasından temalarınızı değiştirebilirsiniz.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          {/* Diğer Öğeler */}
          <TabsContent value="extras" className="space-y-4">
            <Tabs defaultValue="avatar" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4 bg-card/80 backdrop-blur-md rounded-xl border border-border/20">
                <TabsTrigger value="avatar" className="text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-foreground">Avatar</TabsTrigger>
                <TabsTrigger value="effects" className="text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-foreground">Efektler</TabsTrigger>
                <TabsTrigger value="extras-items" className="text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-foreground">Rozetler</TabsTrigger>
              </TabsList>
              
              <TabsContent value="avatar">
                <div className="flex items-center space-x-3 mb-4">
                  <Frame className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold text-foreground">Avatar Çerçeveleri</h3>
                </div>
                {!isPremium && renderMarketItems(getItemsByCategory('avatar'))}
                {isPremium && (
                  <Card className="border-0 bg-gradient-to-r from-primary/15 to-accent/15 backdrop-blur-md">
                    <CardContent className="p-4 text-center">
                      <Crown className="w-12 h-12 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold mb-2 text-foreground">Premium Üyesiniz!</h3>
                      <p className="text-muted-foreground">
                        Tüm avatar çerçeveleri size açık. Ayarlar sayfasından çerçevenizi değiştirebilirsiniz.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="effects">
                <div className="flex items-center space-x-3 mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold text-foreground">Ses & Efektler</h3>
                </div>
                {!isPremium && renderMarketItems([...getItemsByCategory('sounds'), ...getItemsByCategory('effects')])}
                {isPremium && (
                  <Card className="border-0 bg-gradient-to-r from-primary/15 to-accent/15 backdrop-blur-md">
                    <CardContent className="p-4 text-center">
                      <Crown className="w-12 h-12 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold mb-2 text-foreground">Premium Üyesiniz!</h3>
                      <p className="text-muted-foreground">
                        Tüm ses paketleri ve efektler size açık. Ayarlar sayfasından ses paketinizi değiştirebilirsiniz.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              <TabsContent value="extras-items">
                <div className="flex items-center space-x-3 mb-4">
                  <Trophy className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-bold text-foreground">Rozetler & İpuçları</h3>
                </div>
                <Tabs defaultValue="extras-premium" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4 bg-card/80 backdrop-blur-md rounded-xl border border-border/20">
                    <TabsTrigger value="extras-premium" className="text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-foreground">Premium</TabsTrigger>
                    <TabsTrigger value="extras-credits" className="text-muted-foreground data-[state=active]:bg-primary/20 data-[state=active]:text-foreground">Kredi</TabsTrigger>
                  </TabsList>
                  <TabsContent value="extras-premium">
                    {!isPremium && renderMarketItems(getItemsByCategory('extras').filter(item => item.currency === 'premium'))}
                    {isPremium && (
                      <Card className="border-0 bg-gradient-to-r from-primary/15 to-accent/15 backdrop-blur-md">
                        <CardContent className="p-4 text-center">
                          <Crown className="w-12 h-12 text-primary mx-auto mb-3" />
                          <h3 className="text-xl font-bold mb-2 text-foreground">Premium Üyesiniz!</h3>
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
        <Card className="border-0 bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground text-xl">
              <Crown className="w-5 h-5 mr-3" />
              Premium Avantajları
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center text-foreground p-2 bg-card/60 rounded-lg backdrop-blur-sm border border-border/20">
                <Infinity className="w-4 h-4 mr-2 text-primary" />
                <span className="text-xs font-medium">Sınırsız oyun hakkı</span>
              </div>
              <div className="flex items-center text-foreground p-2 bg-card/60 rounded-lg backdrop-blur-sm border border-border/20">
                <Palette className="w-4 h-4 mr-2 text-primary" />
                <span className="text-xs font-medium">Tüm temalara erişim</span>
              </div>
              <div className="flex items-center text-foreground p-2 bg-card/60 rounded-lg backdrop-blur-sm border border-border/20">
                <Volume2 className="w-4 h-4 mr-2 text-primary" />
                <span className="text-xs font-medium">Tüm ses paketleri</span>
              </div>
              <div className="flex items-center text-foreground p-2 bg-card/60 rounded-lg backdrop-blur-sm border border-border/20">
                <Frame className="w-4 h-4 mr-2 text-primary" />
                <span className="text-xs font-medium">Tüm çerçeveler</span>
              </div>
              <div className="flex items-center text-foreground p-2 bg-card/60 rounded-lg backdrop-blur-sm border border-border/20">
                <Star className="w-4 h-4 mr-2 text-primary" />
                <span className="text-xs font-medium">Reklamsız deneyim</span>
              </div>
              <div className="flex items-center text-foreground p-2 bg-card/60 rounded-lg backdrop-blur-sm border border-border/20">
                <Gift className="w-4 h-4 mr-2 text-primary" />
                <span className="text-xs font-medium">Özel rozetler</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
export default MarketPage;