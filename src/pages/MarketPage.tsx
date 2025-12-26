import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useAdMob } from "@/hooks/useAdMob";
import { useNativeSubscriptions } from "@/hooks/useNativeSubscriptions";
import { useNativePurchases } from "@/hooks/useNativePurchases";
import { supabase } from "@/integrations/supabase/client";
import { useSounds } from "@/hooks/useSounds";
import { Capacitor } from "@capacitor/core";
import { ArrowLeft, Crown, Zap, Infinity, Droplet, PenTool, Video, RotateCcw } from "lucide-react";

// Veri Tipleri
interface InkPack {
  id: string;
  name: string;
  amount: number;
  price: number;
  label?: string;
  image: string;
}

interface StationeryItem {
  id: string;
  type: "joker" | "heart" | "time";
  subtype?: string; // joker tipi için
  name: string;
  description: string;
  priceInInk: number;
  value: number; // miktar veya saat
  icon?: any;
  image?: string;
}

const MarketPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { playSound } = useSounds();
  const { isAdLoading, loadRewardedAd, showRewardedAd } = useAdMob();
  const { isLoading: isSubscriptionLoading, purchaseSubscription } = useNativeSubscriptions();
  const { isLoading: isRestoreLoading, restorePurchases, purchasePackage } = useNativePurchases();

  const [activeTab, setActiveTab] = useState("ink-store");
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const isNativePlatform = Capacitor.isNativePlatform();

  // --- Yapılandırma ---

  const inkPacks: InkPack[] = [
    {
      id: "ink_drop",
      name: "Bir Damla Mürekkep",
      amount: 100,
      price: 47.99,
      image: "/damlaMurekkep.png",
    },
    {
      id: "ink_bottle",
      name: "Mürekkep Şişesi",
      amount: 300,
      price: 119.99,
      label: "Popüler",
      image: "/murekkepSisesi.png",
    },
    {
      id: "ink_pot",
      name: "Hokka",
      amount: 850,
      price: 299.99,
      image: "/murekkepHokka.png",
    },
    {
      id: "ink_barrel",
      name: "Mürekkep Varili",
      amount: 2500,
      price: 839.99,
      label: "En İyi Fiyat",
      image: "/murekkepVaril.png",
    },
  ];

  const stationeryItems: StationeryItem[] = [
    // Jokerler
    {
      id: "j_swap",
      type: "joker",
      subtype: "joker_degistir",
      name: "Değiştir",
      description: "Harfleri karıştırır",
      priceInInk: 15,
      value: 1,
      image: "/degistirIkon.png",
    },
    {
      id: "j_whisper",
      type: "joker",
      subtype: "joker_fisildi",
      name: "Fısılda",
      description: "Bir kelime ipucu verir",
      priceInInk: 10,
      value: 1,
      image: "/fisildaIkon.png",
    },
    {
      id: "j_custom",
      type: "joker",
      subtype: "joker_senyaz",
      name: "Sen Yaz",
      description: "Kendi kelimeni yaz",
      priceInInk: 20,
      value: 1,
      image: "/senyazIkon.png",
    },
    // Canlar (Sayfa Paketleri)
    {
      id: "h_full",
      type: "heart",
      name: "Müsvedde",
      description: "5 sayfa verir",
      priceInInk: 25,
      value: 5,
      image: "/bescanPaketi.png",
    },
    {
      id: "h_25",
      type: "heart",
      name: "Not defteri",
      description: "Stoğunuza 25 sayfa ekler",
      priceInInk: 90,
      value: 25,
      image: "/yirmibescanPaketi.png",
    },
    {
      id: "h_50",
      type: "heart",
      name: "Ajanda",
      description: "Stoğunuza 50 sayfa ekler",
      priceInInk: 200,
      value: 50,
      image: "/ellicanPaketi.png",
    },
    {
      id: "h_85",
      type: "heart",
      name: "Ansiklopedi",
      description: "Stoğunuza 85 sayfa ekler",
      priceInInk: 220,
      value: 85,
      image: "/Ansiklopedi.png",
    },
    // Sınırsız Zaman
    {
      id: "t_1h",
      type: "time",
      name: "1 Saat Sınırsız Akış",
      description: "1 Saat boyunca sınırsız sayfa",
      priceInInk: 40,
      value: 1,
      image: "/birsaatUyelik.png",
    },
    {
      id: "t_24h",
      type: "time",
      name: "24 Saat Maraton",
      description: "24 Saat boyunca sınırsız sayfa",
      priceInInk: 100,
      value: 24,
      image: "/yirmidortsaatUyelik.png",
    },
  ];

  // --- Aksiyonlar ---

  const handleBuyInkPack = async (pack: InkPack) => {
    if (!user) return;

    // Sadece mobilde çalışır kontrolü (Test ederken web'deysen bunu yorum satırına alabilirsin)
    if (isNativePlatform) {
      setPurchaseLoading(true);
      try {
        // 1. REVENUECAT İLE SATIN AL
        // pack.id değerinin ("ink_drop" vb.) RevenueCat'teki paket ID ile AYNI olması şart!
        const success = await purchasePackage(pack.id);

        if (!success) {
          setPurchaseLoading(false);
          return; // Başarısızsa veya iptal edildiyse dur.
        }

        // 2. ÖDEME BAŞARILIYSA MÜREKKEBİ VER
        // Buradan aşağısı senin eski kodunla aynı, sadece başarılı olunca çalışıyor.
      } catch (e) {
        console.error(e);
        setPurchaseLoading(false);
        return;
      }
    }

    // --- MÜREKKEP EKLEME KISMI ---
    try {
      const newBalance = (profile?.ink_count || 0) + pack.amount;
      const { error } = await supabase.from("profiles").update({ ink_count: newBalance }).eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      playSound("buttonClick");
      toast({
        title: "Satın Alma Başarılı! 💧",
        description: `${pack.amount} damla mürekkep eklendi.`,
        className: "bg-indigo-900 text-white border-indigo-700",
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Hata", description: "Mürekkep eklenirken sorun oluştu.", variant: "destructive" });
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleSpendInk = async (item: StationeryItem) => {
    if (!user || !profile) return;
    playSound("buttonClick");

    if ((profile.ink_count || 0) < item.priceInInk) {
      toast({
        title: "Yetersiz Mürekkep 💧",
        description: "Yeterli mürekkebiniz yok. Mürekkep Dükkanına göz atın!",
        variant: "destructive",
      });
      setActiveTab("ink-store");
      return;
    }

    setPurchaseLoading(true);
    try {
      const { error: deductError } = await supabase
        .from("profiles")
        .update({ ink_count: (profile.ink_count || 0) - item.priceInInk })
        .eq("id", user.id)
        .select()
        .single();

      if (deductError) throw deductError;

      if (item.type === "joker" && item.subtype) {
        const { data: inv } = await supabase
          .from("user_inventory")
          .select("quantity")
          .eq("user_id", user.id)
          .eq("item_type", item.subtype)
          .maybeSingle();

        const currentQty = inv?.quantity || 0;

        const { error: invError } = await supabase.from("user_inventory").upsert(
          {
            user_id: user.id,
            item_type: item.subtype,
            quantity: currentQty + item.value,
          },
          { onConflict: "user_id,item_type" },
        );

        if (invError) throw invError;
      } else if (item.type === "heart") {
        const currentCredits = profile.game_credits || 0;
        const newCredits = currentCredits + item.value;

        // Eğer yeni krediler >= 5 ise, timer'ı sıfırla (last_credit_refresh = null)
        const updateData: any = { game_credits: newCredits };
        if (newCredits >= 5) {
          updateData.last_credit_refresh = null;
        }

        await supabase.from("profiles").update(updateData).eq("id", user.id);
      } else if (item.type === "time") {
        const now = new Date();
        const currentExpiryVal = (profile as any).unlimited_lives_until;
        const currentExpiry = currentExpiryVal ? new Date(currentExpiryVal) : now;
        const baseTime = currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(baseTime.getTime() + item.value * 60 * 60 * 1000);

        await supabase
          .from("profiles")
          .update({ unlimited_lives_until: newExpiry.toISOString() } as any)
          .eq("id", user.id);
      }

      // CRITICAL: Profile'ı yenile ki UI güncellensin
      await refreshProfile();

      playSound("buttonClick");
      toast({
        title: "İşlem Başarılı! 🖋️",
        description: `${item.name} envanterinize eklendi.`,
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Hata", description: "İşlem gerçekleştirilemedi.", variant: "destructive" });
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleWatchAd = async () => {
    // Tarih kontrolü (Simülasyon değil, günlük limit için gerekli)
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem("lastAdDate");
    const storedCount = parseInt(localStorage.getItem("adCount") || "0");

    if (storedDate === today && storedCount >= 5) {
      toast({
        title: "Günlük Limit Doldu",
        description: "Yarın tekrar gelip mürekkep kazanabilirsin!",
        variant: "default",
      });
      return;
    }

    try {
      // Sadece reklamı yükle ve göster
      await loadRewardedAd();
      await showRewardedAd(); 
      
      // NOT: Ödül verme işlemi ve "Tebrikler" mesajı artık useAdMob.tsx içinde otomatik yapılıyor.
      // Burada elle bir şey yapmana gerek yok.
      
      // Sadece sayacı arttırıyoruz (Reklam açıldı sayıyoruz)
      if (storedDate !== today) {
        localStorage.setItem("lastAdDate", today);
        localStorage.setItem("adCount", "1");
      } else {
        localStorage.setItem("adCount", (storedCount + 1).toString());
      }
      
    } catch (e) {
      console.error(e);
      toast({ title: "Reklam Hatası", description: "Reklam yüklenemedi.", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Dekoratif Üst Arkaplan */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-indigo-900 via-indigo-800 to-slate-50 rounded-b-[40px] z-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-20 h-20 bg-indigo-600 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute top-10 right-10 w-20 h-20 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 px-4 pt-4 pb-2 mt-[60px]">
        <div className="relative flex items-center justify-between mb-4 h-12">
          {/* SOL BUTON */}
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="text-white hover:bg-white/10 shrink-0 relative z-20"
          >
            <ArrowLeft className="w-5 h-5 mr-1" /> Geri
          </Button>

          {/* ORTA - BAŞLIK GÖRSELİ */}
          <div className="absolute left-1/2 -top-[144px] transform -translate-x-1/2 z-10 pointer-events-none">
            <img
              src="/kirtasiyeBaslik.png"
              alt="Kırtasiye"
              className="h-64 w-auto max-w-none object-contain drop-shadow-2xl filter brightness-110"
            />
          </div>

          {/* Sağ Boşluk */}
          <div className="w-16 shrink-0"></div>
        </div>
        {/* Bakiye Kartı */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20 shadow-xl overflow-hidden">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-full shadow-inner">
                <Droplet className="w-6 h-6 text-indigo-600 fill-indigo-600" />
              </div>
              <div>
                <p className="text-indigo-100 text-xs font-medium uppercase tracking-wider">Mürekkep Haznen</p>
                <p className="text-2xl font-bold text-white drop-shadow-sm">{profile?.ink_count || 0}</p>
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleWatchAd}
              className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white border-0 shadow-lg text-xs"
              disabled={isAdLoading}
            >
              <Video className="w-3 h-3 mr-1" />
              +5 Kazan
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Ana İçerik */}
      <div className="flex-1 relative z-10 px-4 mt-2 overflow-hidden flex flex-col">
        <Tabs defaultValue="ink-store" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid grid-cols-3 mb-4 bg-white/50 backdrop-blur p-1 rounded-xl border border-indigo-100 shadow-sm">
            <TabsTrigger value="ink-store" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Droplet className="w-4 h-4 mr-1" /> Mürekkep
            </TabsTrigger>
            <TabsTrigger
              value="stationery"
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <PenTool className="w-4 h-4 mr-1" /> Kırtasiye
            </TabsTrigger>
            <TabsTrigger value="vip" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white">
              <Crown className="w-4 h-4 mr-1" /> VIP Yazar
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pb-8 scrollbar-hide">
            {/* 1. MÜREKKEP DÜKKANI */}
            <TabsContent value="ink-store" className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center mb-2">
                <p className="text-sm text-slate-500">Mürekkep ile oyun içi her şeye sahip olabilirsin.</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {inkPacks.map((pack) => (
                  <div
                    key={pack.id}
                    onClick={() => handleBuyInkPack(pack)}
                    className="relative bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group"
                  >
                    {pack.label && (
                      <span className="absolute -top-2 left-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm z-10">
                        {pack.label}
                      </span>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 group-hover:scale-105 transition-transform">
                        <img src={pack.image} alt={pack.name} className="w-20 h-20 object-contain drop-shadow-sm" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{pack.name}</h3>
                        <p className="text-indigo-600 font-semibold">{pack.amount} Damla</p>
                      </div>
                    </div>
                    <Button variant="ghost" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold">
                      ₺{pack.price}
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* 2. KIRTASİYE */}
            <TabsContent value="stationery" className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Jokerler</h3>
                <div className="grid grid-cols-1 gap-3">
                  {stationeryItems
                    .filter((i) => i.type === "joker")
                    .map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between shadow-sm"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-16 h-16 object-contain drop-shadow-sm"
                              />
                            ) : (
                              item.icon && <item.icon className="w-12 h-12 text-purple-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-base text-slate-800">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.description}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[80px]"
                          onClick={() => handleSpendInk(item)}
                          disabled={purchaseLoading}
                        >
                          <Droplet className="w-3 h-3 mr-1" /> {item.priceInInk}
                        </Button>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Sayfa Paketleri</h3>
                <div className="grid grid-cols-2 gap-3">
                  {stationeryItems
                    .filter((i) => i.type === "heart")
                    .map((item) => (
                      <Card
                        key={item.id}
                        className="border-slate-100 shadow-sm overflow-hidden group hover:border-red-200 transition-colors"
                      >
                        <CardContent className="p-3 text-center flex flex-col items-center gap-2">
                          <div className="w-16 h-16 flex items-center justify-center group-hover:scale-105 transition-transform mb-1">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                            ) : (
                              item.icon && <item.icon className="w-8 h-8 text-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-800">{item.name}</p>
                            <p className="text-[10px] text-slate-500 leading-tight">{item.description}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 text-xs"
                            onClick={() => handleSpendInk(item)}
                          >
                            {item.priceInInk} Damla
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Sınırsız Süre</h3>
                <div className="space-y-2">
                  {stationeryItems
                    .filter((i) => i.type === "time")
                    .map((item) => (
                      <div
                        key={item.id}
                        className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 text-white flex items-center justify-between shadow-lg relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="flex items-center gap-3 relative z-10">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-12 h-12 object-contain" />
                          ) : (
                            item.icon && <item.icon className="w-6 h-6 text-amber-400" />
                          )}
                          <div>
                            <p className="font-bold">{item.name}</p>
                            <p className="text-xs text-slate-300">{item.description}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm z-10"
                          onClick={() => handleSpendInk(item)}
                        >
                          {item.priceInInk} Damla
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            </TabsContent>

            {/* 3. VIP ABONELİK - Fiyatlar ve Avantajlar Güncellendi */}
            <TabsContent value="vip" className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <Card className="bg-gradient-to-br from-amber-400 to-orange-500 border-none shadow-xl text-white overflow-hidden">
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto flex items-center justify-center -mb-16 -mt-20">
                    <img src="/vipIkon.png" alt="VIP" className="w-64 h-64 object-contain drop-shadow-xl" />
                  </div>
                  <CardTitle className="text-2xl font-serif relative z-10">VIP Yazar Ol</CardTitle>
                  <CardDescription className="text-amber-100 italic">
                    Kısıtlamaları kaldır, kalemini konuştur!
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3 bg-black/10 p-4 rounded-xl backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <Infinity className="w-5 h-5 text-amber-100" />
                      <span className="font-medium text-sm">Sınırsız Sayfa (Hiç bitmeyen hak)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-amber-100" />
                      <span className="font-medium text-sm">Reklamsız Deneyim</span>
                    </div>
                    <div className="flex items-center gap-3 border-t border-white/10 pt-2">
                      <div className="bg-amber-400 p-1 rounded-full">
                        <img src="/degistirIkon.png" className="w-4 h-4" alt="joker" />
                      </div>
                      <div className="bg-amber-400 p-1 rounded-full -ml-2">
                        <img src="/fisildaIkon.png" className="w-4 h-4" alt="joker" />
                      </div>
                      <div className="bg-amber-400 p-1 rounded-full -ml-2">
                        <img src="/senyazIkon.png" className="w-4 h-4" alt="joker" />
                      </div>
                      <span className="font-bold text-sm ml-1 text-white">Her Gün 3'er Bedava Joker!</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                      className="bg-white text-orange-600 hover:bg-orange-50 font-bold h-auto py-3 flex-col gap-1 shadow-md"
                      onClick={() => purchaseSubscription("premium_monthly")}
                      disabled={isSubscriptionLoading}
                    >
                      <span className="text-lg">Aylık</span>
                      <span className="text-xs opacity-70">₺249.99</span>
                    </Button>
                    <Button
                      className="bg-indigo-900 text-white hover:bg-indigo-800 font-bold h-auto py-3 flex-col gap-1 border border-white/20 shadow-md relative"
                      onClick={() => purchaseSubscription("premium_yearly")}
                      disabled={isSubscriptionLoading}
                    >
                      <span className="absolute -top-2 right-0 bg-red-500 text-[9px] px-2 py-0.5 rounded-full animate-bounce">
                        %50 İNDİRİM
                      </span>
                      <span className="text-lg">Yıllık</span>
                      <span className="text-xs opacity-70">₺1499.99</span>
                    </Button>
                  </div>

                  <p className="text-[10px] text-center text-amber-100/80 italic">
                    * Günlük jokerler her gece 00:00'da yenilenir.
                  </p>

                  {/* Satın Alımları Geri Yükle */}
                  {isNativePlatform && (
                    <Button
                      variant="ghost"
                      className="w-full mt-2 text-amber-100 hover:text-white hover:bg-white/10 text-xs"
                      onClick={restorePurchases}
                      disabled={isRestoreLoading}
                    >
                      <RotateCcw className={`w-3 h-3 mr-2 ${isRestoreLoading ? "animate-spin" : ""}`} />
                      Satın Alımları Geri Yükle
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default MarketPage;
