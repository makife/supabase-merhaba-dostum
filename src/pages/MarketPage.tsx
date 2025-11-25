import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useUserPurchases } from "@/hooks/useUserPurchases";
import { useAdMob } from "@/hooks/useAdMob";
import { useNativeSubscriptions } from "@/hooks/useNativeSubscriptions";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  ShoppingCart,
  Crown,
  Zap,
  Clock,
  Star,
  Infinity,
  Palette,
  Volume2,
  Music,
  Moon,
  Sun,
  Gamepad2,
  Gift,
} from "lucide-react";

// Capacitor type check
declare global {
  interface Window {
    Capacitor?: any;
  }
}

interface MarketItem {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: "credits" | "premium";
  icon: any;
  type: "credits" | "unlimited_time" | "premium" | "theme" | "joker";
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
    openSubscriptionManagement,
  } = useNativeSubscriptions();

  const marketItems: MarketItem[] = [
    // Oyun Hakları
    {
      id: "credits_10",
      title: "10 Oyun Hakkı",
      description: "Ekstra 10 oyun hakkı kazanın",
      price: 2.99,
      currency: "premium",
      icon: Zap,
      type: "credits",
      value: 10,
    },
    {
      id: "credits_25",
      title: "25 Oyun Hakkı",
      description: "Ekstra 25 oyun hakkı kazanın",
      price: 5.99,
      currency: "premium",
      icon: Zap,
      type: "credits",
      value: 25,
    },
    {
      id: "credits_50",
      title: "50 Oyun Hakkı",
      description: "Büyük oyun hakkı paketi",
      price: 9.99,
      currency: "premium",
      icon: Zap,
      type: "credits",
      value: 50,
    },

    // Sınırsız Zaman (Premium dönem verir)
    {
      id: "unlimited_1h",
      title: "1 Saat Sınırsız",
      description: "1 saat boyunca sınırsız oyun oynayın",
      price: 12.99,
      currency: "premium",
      icon: Clock,
      type: "premium",
      value: 1,
      duration: "1 saat",
    },
    {
      id: "unlimited_24h",
      title: "24 Saat Sınırsız",
      description: "24 saat boyunca sınırsız oyun oynayın",
      price: 23.99,
      currency: "premium",
      icon: Infinity,
      type: "premium",
      value: 24,
      duration: "24 saat",
    },

    // Premium - Aylık ve Yıllık
    {
      id: "premium_month",
      title: "Premium Aylık",
      description: "Sınırsız oyun, tüm temalar ve özel özellikler",
      price: 119.99,
      currency: "premium",
      icon: Crown,
      type: "premium",
      value: 30,
    },
    {
      id: "premium_year",
      title: "Premium Yıllık",
      description: "12 aylık premium üyelik - %40 tasarruf! Tüm özellikler dahil",
      price: 647.99,
      currency: "premium",
      icon: Crown,
      type: "premium",
      value: 365,
    },

    // Jokerler
    {
      id: "joker_degistir",
      title: "Değiştir Jokeri",
      description: "Her satın alım 1 adet joker verir",
      price: 0.99,
      currency: "premium",
      icon: Star,
      type: "joker",
      value: 1,
    },
    {
      id: "joker_fisildi",
      title: "Fısılda Jokeri",
      description: "Her satın alım 1 adet joker verir",
      price: 0.99,
      currency: "premium",
      icon: Star,
      type: "joker",
      value: 1,
    },
    {
      id: "joker_senyaz",
      title: "Sen Yaz Jokeri",
      description: "Her satın alım 1 adet joker verir",
      price: 0.99,
      currency: "premium",
      icon: Star,
      type: "joker",
      value: 1,
    },
  ];

  const watchAdForCredits = async () => {
    try {
      await loadRewardedAd();
      await showRewardedAd();

      toast({
        title: "Tebrikler!",
        description: "+1 oyun kredisi kazandınız!",
        variant: "default",
      });

      refreshProfile();
    } catch (error) {
      console.error("Ad error:", error);
      toast({
        title: "Reklam hatası",
        description: "Reklam gösterilemedi. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    }
  };

  const watchAdForJoker = async () => {
    if (!user) return;

    try {
      await loadRewardedAd();
      await showRewardedAd();

      // Rastgele joker seç
      const jokerTypes = ["degistir", "fisilida", "senyaz"];
      const randomJoker = jokerTypes[Math.floor(Math.random() * jokerTypes.length)];

      // Mevcut joker miktarını kontrol et
      const { data: existingItem } = await supabase
        .from("user_inventory")
        .select("quantity")
        .eq("user_id", user.id)
        .eq("item_type", randomJoker)
        .single();

      // Joker'ı inventory'e ekle veya miktarı artır
      const { error } = await supabase.from("user_inventory").upsert(
        {
          user_id: user.id,
          item_type: randomJoker,
          quantity: (existingItem?.quantity || 0) + 1,
        },
        {
          onConflict: "user_id,item_type",
        },
      );

      if (error) throw error;

      const jokerNames: Record<string, string> = {
        degistir: "Değiştir",
        fisilida: "Fısılda",
        senyaz: "Sen Yaz",
      };

      toast({
        title: "Tebrikler! 🎉",
        description: `+1 ${jokerNames[randomJoker]} jokeri kazandınız!`,
        variant: "default",
      });

      refreshProfile();
    } catch (error) {
      console.error("Ad error:", error);
      toast({
        title: "Reklam hatası",
        description: "Reklam gösterilemedi. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    }
  };

  const handlePurchase = async (item: MarketItem) => {
    if (!user) {
      toast({
        title: "Giriş yapmanız gerekiyor",
        description: "Satın alma yapmak için önce giriş yapın.",
        variant: "destructive",
      });
      return;
    }

    // Oyun hakları ve jokerler için tekrar satın alma kontrolü kaldırıldı
    if (item.type !== "credits" && item.type !== "joker" && hasPurchased(item.id)) {
      toast({
        title: "Zaten sahipsiniz",
        description: "Bu ürün zaten sizde mevcut.",
        variant: "default",
      });
      return;
    }

    try {
      if (item.type === "premium") {
        // Premium üyelik için subscription kullan
        if (subscriptionProducts.length > 0) {
          await purchaseSubscription(subscriptionProducts[0].id);
        }
      } else {
        await processPurchase(item);
      }

      toast({
        title: "Satın alma başarılı!",
        description: `${item.title} başarıyla satın alındı.`,
        variant: "default",
      });

      // Force refresh to bypass cache and show updated credits immediately
      await refreshProfile(true);
    } catch (error) {
      console.error("Purchase error:", error);
      toast({
        title: "Satın alma hatası",
        description: "Satın alma işlemi başarısız oldu.",
        variant: "destructive",
      });
    }
  };

  const getItemsByCategory = (category: string) => {
    switch (category) {
      case "credits":
        return marketItems.filter((item) => item.type === "credits");
      case "premium":
        return marketItems.filter((item) => item.type === "premium");
      case "themes":
        return marketItems.filter((item) => item.type === "theme");
      case "jokers":
        return marketItems.filter((item) => item.type === "joker");
      default:
        return [];
    }
  };

  const renderMarketItems = (items: MarketItem[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => (
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
              <div className="text-right space-y-1">
                {item.type !== "credits" && item.type !== "joker" && hasPurchased(item.id) && (
                  <Badge variant="secondary" className="mb-1 bg-green-500/20 text-green-700 border-green-500/30">
                    Satın Alındı
                  </Badge>
                )}
                {item.type === "joker" && (
                  <Badge variant="outline" className="text-xs">
                    1 adet
                  </Badge>
                )}
                {item.duration && (
                  <Badge variant="outline" className="text-xs">
                    {item.duration}
                  </Badge>
                )}
              </div>
            </div>

            <h3 className="font-semibold text-sm mb-2 text-foreground">{item.title}</h3>
            <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{item.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-lg font-bold text-primary">
                  {item.currency === "premium" ? `₺${item.price}` : `${item.price} Kredi`}
                </span>
                {item.currency === "premium" && item.price > 50 && (
                  <span className="text-xs text-muted-foreground line-through">₺{(item.price * 1.4).toFixed(2)}</span>
                )}
              </div>

              <Button
                onClick={() => handlePurchase(item)}
                disabled={purchaseLoading || isSubscriptionLoading}
                size="sm"
                className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300 group-hover:scale-105"
              >
                <ShoppingCart className="w-3 h-3 mr-1" />
                Satın Al
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-background to-muted/50">
      {/* Tente Image - Fixed at top */}
      <img src="/tente.png" alt="Tente" className="fixed top-0 left-0 w-full h-auto z-50 pointer-events-none" />

      {/* Fixed Header - Positioned below tente */}
      <div className="sticky top-0 z-10 bg-green-50/95 backdrop-blur-sm border-b border-green-200 p-3 pt-6 mt-[60px]">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-4">
            {" "}
            {/* space-y-4'ü buraya taşıdım */}
            {/* Header */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="text-green-600 border-green-500/30 hover:bg-green-500/20 bg-green-500/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Geri
              </Button>

              <div className="relative inline-block">
                {/* Market Text Image */}
                <img
                  src="/marketYazi.png"
                  alt="Market Text"
                  className="relative z-10 px-6 py-3 h-20 w-auto object-contain"
                />
              </div>

              <div className="w-16" />
            </div>
            {/* Hero Section */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary to-accent p-3 text-primary-foreground">
              <div className="relative z-10">
                <h2 className="text-3xl font-bold mb-2">Oyun Deneyimini Geliştir!</h2>
                <p className="text-lg opacity-100">Özel paketler ve premium özelliklerle daha keyifli oyna</p>
              </div>
              <div className="absolute inset-0 bg-black/10" />
              <img src="/marketimaj.png" alt="Market" className="absolute right-0 top-0 h-full w-auto opacity-90" />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-4 space-y-6">
          {/* User Status */}
          {user && (
            <Card
              className={`${
                isPremium
                  ? "bg-gradient-to-br from-yellow-500/25 via-orange-500/25 to-amber-500/25 border-yellow-500/40"
                  : "bg-gradient-to-br from-blue-500/25 via-cyan-500/25 to-teal-500/25 border-blue-500/40"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${isPremium ? "bg-yellow-500/20" : "bg-blue-500/20"}`}>
                      <Crown className={`w-5 h-5 ${isPremium ? "text-yellow-500" : "text-blue-500"}`} />
                    </div>
                    <div>
                      <p className="font-semibold">{isPremium ? "Premium Üye" : "Ücretsiz Üye"}</p>
                      <p className="text-sm text-muted-foreground">
                        Oyun Hakkı: {(profile?.game_credits || 0) + (profile?.bonus_credits || 0)}/5
                      </p>
                    </div>
                  </div>
                  {isPremium && (
                    <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">Premium</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reklam İzle Bölümü */}
          {user && window.Capacitor && (
            <Card className="bg-gradient-to-br from-lime-500/15 via-yellow-500/15 to-orange-500/15 border-lime-500/40">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="p-2 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg mr-2">
                    <Gift className="w-5 h-5 text-green-600" />
                  </div>
                  Ücretsiz Ödül Kazan
                </CardTitle>
                <CardDescription className="text-foreground/70">
                  Reklam izleyerek ücretsiz kredi veya joker kazanabilirsiniz
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={watchAdForCredits}
                    disabled={isAdLoading || !isAdReady}
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white border-0"
                  >
                    <Gamepad2 className="w-4 h-4 mr-2" />
                    Reklam İzle
                    <br />
                    +1 Hak
                  </Button>
                  <Button
                    onClick={watchAdForJoker}
                    disabled={isAdLoading || !isAdReady}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Reklam İzle
                    <br />
                    +1 Joker
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Satın Alımları Geri Yükle */}
          {user && window.Capacitor && (
            <Card className="bg-gradient-to-br from-blue-500/15 via-indigo-500/15 to-violet-500/15 border-blue-500/40">
              <CardContent className="p-4">
                <Button
                  onClick={restoreSubscriptions}
                  variant="outline"
                  className="w-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/50 hover:from-blue-500/20 hover:to-indigo-500/20 hover:border-blue-500/70 transition-all"
                  disabled={isSubscriptionLoading}
                >
                  Satın Alımları Geri Yükle
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Market Kategorileri */}
          <Tabs defaultValue="credits" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger
                value="credits"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white"
              >
                <Zap className="w-4 h-4 mr-2" />
                Oyun
              </TabsTrigger>
              <TabsTrigger
                value="premium"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-orange-500 data-[state=active]:text-white"
              >
                <Crown className="w-4 h-4 mr-2" />
                Premium
              </TabsTrigger>
              <TabsTrigger
                value="jokers"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white"
              >
                <Star className="w-4 h-4 mr-2" />
                Jokerler
              </TabsTrigger>
            </TabsList>

            <TabsContent value="credits" className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Oyun Hakları ve Sınırsız Zaman</h3>
                <p className="text-muted-foreground">Daha fazla oyun oynayın, yeteneklerinizi geliştirin</p>
              </div>

              {renderMarketItems(getItemsByCategory("credits"))}

              {/* Oyun Açıklaması */}
              <Card className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center text-blue-600">
                    <Zap className="w-5 h-5 mr-2" />
                    Oyun Hakkı Nasıl Çalışır?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3" />
                      Her oyun için 1 hak harcanır
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3" />
                      Satın aldığınız haklar mevcut haklarınıza eklenir
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3" />
                      Premium üyeler sınırsız hak sahibidir
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-3" />
                      Her 15 dakikada 1 ücretsiz hak kazanırsınız (max 5)
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="premium" className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Premium Üyelik</h3>
                <p className="text-muted-foreground">Tüm özelliklere sınırsız erişim</p>
              </div>

              {renderMarketItems(getItemsByCategory("premium"))}

              {/* Premium Avantajları */}
              <Card className="mt-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center text-yellow-600">
                    <Crown className="w-5 h-5 mr-2" />
                    Premium Avantajları
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3" />
                      Sınırsız oyun hakkı
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3" />
                      Özel premium rozet
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3" />
                      Reklamsız deneyim
                    </li>
                    <li className="flex items-center">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3" />
                      Yeni özellikler için öncelikli erişim
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jokers" className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">Joker Paketleri</h3>
                <p className="text-muted-foreground">Zor durumlarda kullanabileceğiniz jokerler</p>
              </div>

              {renderMarketItems(getItemsByCategory("jokers"))}

              {/* Joker Açıklaması */}
              <Card className="mb-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center text-green-600">
                    <Star className="w-5 h-5 mr-2" />
                    Joker Türleri ve Kullanımları
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-white/50 p-3 rounded-lg">
                      <h4 className="font-semibold text-green-700 mb-2">🔄 Değiştir Jokeri</h4>
                      <p>Oyun tahtasındaki harfleri yeniden karıştırır. Yeni kombinasyonlar için ideal.</p>
                    </div>
                    <div className="bg-white/50 p-3 rounded-lg">
                      <h4 className="font-semibold text-green-700 mb-2">💡 Fısılda Jokeri</h4>
                      <p>Bulunabilecek kelimelerden birinin ipucunu verir. Takıldığınızda kullanın.</p>
                    </div>
                    <div className="bg-white/50 p-3 rounded-lg">
                      <h4 className="font-semibold text-green-700 mb-2">✏️ Sen Yaz Jokeri</h4>
                      <p>Kendi belirlediğiniz kelimeyi oyuna yazmanızı sağlar. En güçlü joker!</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default MarketPage;
