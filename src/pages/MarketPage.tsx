import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft,
  ShoppingCart,
  Crown,
  Zap,
  Clock,
  Gift,
  Star,
  Infinity
} from 'lucide-react';

interface MarketItem {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: 'credits' | 'premium';
  icon: any;
  type: 'credits' | 'unlimited_time' | 'premium' | 'theme';
  value: number;
  duration?: string;
}

const MarketPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [userCredits, setUserCredits] = useState(5);
  const [isPremium, setIsPremium] = useState(false);

  const marketItems: MarketItem[] = [
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
    }
  ];

  // Load user profile
  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('game_credits, premium_until')
        .eq('id', user.id)
        .single();

      if (!error && profile) {
        setUserCredits(profile.game_credits || 0);
        setIsPremium(profile.premium_until ? new Date(profile.premium_until) > new Date() : false);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handlePurchase = async (item: MarketItem) => {
    if (!user) {
      toast({
        title: 'Hata',
        description: 'Satın almak için giriş yapmalısınız.',
        variant: 'destructive',
      });
      return;
    }

    // Simulate purchase process
    toast({
      title: 'Satın Alma İşlemi',
      description: 'Ödeme işlemi başlatılıyor...',
    });

    // Simulate payment delay
    setTimeout(async () => {
      try {
        // Update user profile based on purchase
        const updates: any = {};

        if (item.type === 'credits') {
          updates.game_credits = userCredits + item.value;
        } else if (item.type === 'unlimited_time') {
          // For demo, just add credits
          updates.game_credits = userCredits + 50;
        } else if (item.type === 'premium') {
          const premiumUntil = new Date();
          premiumUntil.setDate(premiumUntil.getDate() + item.value);
          updates.premium_until = premiumUntil.toISOString();
        }

        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

          if (error) throw error;

          await loadUserProfile();

          toast({
            title: 'Satın Alma Başarılı!',
            description: `${item.title} başarıyla satın alındı.`,
          });
        }
      } catch (error) {
        console.error('Purchase error:', error);
        toast({
          title: 'Satın Alma Hatası',
          description: 'Bir hata oluştu, lütfen tekrar deneyin.',
          variant: 'destructive',
        });
      }
    }, 2000);
  };

  const watchAdForCredits = () => {
    toast({
      title: 'Reklam İzleniyor',
      description: 'Reklam tamamlandıktan sonra 1 hak kazanacaksınız.',
    });

    // Simulate ad watching
    setTimeout(async () => {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ game_credits: userCredits + 1 })
          .eq('id', user.id);

        if (error) throw error;

        setUserCredits(prev => prev + 1);
        
        toast({
          title: 'Tebrikler!',
          description: '+1 oyun hakkı kazandınız!',
        });
      } catch (error) {
        console.error('Ad reward error:', error);
        toast({
          title: 'Hata',
          description: 'Ödül verilemedi, tekrar deneyin.',
          variant: 'destructive',
        });
      }
    }, 3000);
  };

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
                      <Zap className="w-4 h-4 inline mr-1" />
                      {userCredits} Hak
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
            <Button 
              onClick={watchAdForCredits}
              className="w-full bg-green-500 hover:bg-green-600"
            >
              <Gift className="w-4 h-4 mr-2" />
              Reklam İzle (+1 Hak)
            </Button>
          </CardContent>
        </Card>

        {/* Market Items */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Satın Alınabilir Öğeler</h2>
          
          {marketItems.map((item) => (
            <Card key={item.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      {item.duration && (
                        <Badge variant="outline" className="mt-1">
                          {item.duration}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      ${item.price}
                    </div>
                    <Button 
                      onClick={() => handlePurchase(item)}
                      size="sm"
                      className="mt-2"
                    >
                      Satın Al
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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