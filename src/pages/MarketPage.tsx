import { useState, useEffect, useRef, useCallback } from "react";
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
import { usePageResync } from "@/hooks/useGlobalResync";
import { supabase } from "@/integrations/supabase/client";
import { useSounds } from "@/hooks/useSounds";
import { Capacitor } from "@capacitor/core";
import { ArrowLeft, Crown, Zap, Infinity, Droplet, PenTool, Video, RotateCcw } from "lucide-react";
import nativeStorage, { STORAGE_KEYS } from "@/utils/nativeStorage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const { isAdLoading, initializeAdMob, loadRewardedAd, showRewardedAd } = useAdMob();
  const { isLoading: isSubscriptionLoading, purchaseSubscription, restoreSubscriptions } = useNativeSubscriptions();
  const { isLoading: isRestoreLoading, purchasePackage } = useNativePurchases();

  // AdMob'u sayfa yüklendiğinde initialize et
  useEffect(() => {
    initializeAdMob();
  }, [initializeAdMob]);

  // 🔄 Global Resync Hook - bağlantı geri geldiğinde profil verilerini otomatik tazele
  usePageResync(refreshProfile, "MarketPage", false);

  const [activeTab, setActiveTab] = useState("ink-store");
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  // Onay Penceresi State'leri
  const [itemToBuy, setItemToBuy] = useState<StationeryItem | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

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
      description: "Senin yerine kelime yazar",
      priceInInk: 20,
      value: 1,
      image: "/senyazIkon.png",
    },
    // Canlar (Sayfa Paketleri)
    {
      id: "h_full",
      type: "heart",
      name: "Müsvedde",
      description: "Stoğunuza 5 sayfa ekler",
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

  const isUnlimitedLivesActive = (profile: any) => {
    if (!profile?.unlimited_lives_until) return false;
    const expiry = new Date(profile.unlimited_lives_until);
    return expiry > new Date();
  };

  // Not: isSystemConnected artık usePageResync hook'u tarafından yönetiliyor (satır 61)

  // --- Aksiyonlar ---

  const handleBuyInkPack = async (pack: InkPack) => {
    if (!user) return;

    if (isNativePlatform) {
      setPurchaseLoading(true);
      try {
        const success = await purchasePackage(pack.id);
        if (!success) {
          setPurchaseLoading(false);
          return;
        }
      } catch (e) {
        console.error(e);
        setPurchaseLoading(false);
        return;
      }
    }

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

  // 1. DÜĞMEYE BASINCA: Kontrol et ve Onay Penceresini Aç
  const handleSpendInk = (item: StationeryItem) => {
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

    // Onay penceresi için veriyi hazırla ve aç
    setItemToBuy(item);
    setShowConfirmation(true);
  };

  // 2. ONAY VERİLİRSE: Asıl satın alma işlemi
  const confirmPurchase = async () => {
    if (!itemToBuy || !user || !profile) return;

    setShowConfirmation(false);
    setPurchaseLoading(true);
    window.dispatchEvent(new CustomEvent("purchaseStarted"));
    try {
      // 🔥 FIX: Önce veritabanından güncel değerleri çek (stale state önleme)
      const { data: freshProfile, error: freshError } = await supabase
        .from("profiles")
        .select("ink_count, game_credits, bonus_credits")
        .eq("id", user.id)
        .single();

      if (freshError || !freshProfile) throw freshError || new Error("Profil bulunamadı");

      // Mürekkep kontrolü (güncel veriyle)
      if ((freshProfile.ink_count || 0) < itemToBuy.priceInInk) {
        toast({ title: "Yetersiz Mürekkep 💧", description: "Yeterli mürekkebiniz yok.", variant: "destructive" });
        setPurchaseLoading(false);
        return;
      }

      // Mürekkebi düş (güncel veriyle)
      const { error: deductError } = await supabase
        .from("profiles")
        .update({ ink_count: (freshProfile.ink_count || 0) - itemToBuy.priceInInk })
        .eq("id", user.id)
        .select()
        .single();

      if (deductError) throw deductError;

      // Sonra ürünü ver
      if (itemToBuy.type === "joker" && itemToBuy.subtype) {
        const { data: inv } = await supabase
          .from("user_inventory")
          .select("quantity")
          .eq("user_id", user.id)
          .eq("item_type", itemToBuy.subtype)
          .maybeSingle();

        const currentQty = inv?.quantity || 0;

        const { error: invError } = await supabase.from("user_inventory").upsert(
          {
            user_id: user.id,
            item_type: itemToBuy.subtype,
            quantity: currentQty + itemToBuy.value,
          },
          { onConflict: "user_id,item_type" },
        );

        if (invError) throw invError;
      } else if (itemToBuy.type === "heart") {
        // 🔥 FIX: game_credits max 5, fazlası bonus_credits'e
        const currentGameCredits = freshProfile.game_credits || 0;
        const currentBonusCredits = freshProfile.bonus_credits || 0;
        const creditsToAdd = itemToBuy.value;

        const spaceInGame = Math.max(0, 5 - currentGameCredits);
        const addToGame = Math.min(creditsToAdd, spaceInGame);
        const addToBonus = creditsToAdd - addToGame;

        const newGameCredits = currentGameCredits + addToGame;
        const newBonusCredits = currentBonusCredits + addToBonus;

        const updateData: any = {
          game_credits: newGameCredits,
          bonus_credits: newBonusCredits,
        };
        if (newGameCredits >= 5) {
          updateData.last_credit_refresh = null;
        }

        await supabase.from("profiles").update(updateData).eq("id", user.id);
      } else if (itemToBuy.type === "time") {
        const now = new Date();
        const currentExpiryVal = (profile as any).unlimited_lives_until;
        const currentExpiry = currentExpiryVal ? new Date(currentExpiryVal) : now;
        const baseTime = currentExpiry > now ? currentExpiry : now;
        const newExpiry = new Date(baseTime.getTime() + itemToBuy.value * 60 * 60 * 1000);

        await supabase
          .from("profiles")
          .update({ unlimited_lives_until: newExpiry.toISOString() } as any)
          .eq("id", user.id);
      }

      await refreshProfile();

      // Başarı sesi çal (Varsa 'success' yoksa 'buttonClick')
      // Eğer useSounds hook'unda 'success' tanımlı değilse hata verebilir,
      // o yüzden şimdilik güvenli olan 'buttonClick' bırakıyorum.
      playSound("buttonClick");

      toast({
        title: "Satın Alma Başarılı! 🖋️",
        description: <span className="text-white">{itemToBuy.name} başarıyla alındı.</span>,
        className: "bg-green-600 text-white border-green-500",
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Hata", description: "İşlem gerçekleştirilemedi.", variant: "destructive" });
    } finally {
      setPurchaseLoading(false);
      setItemToBuy(null);
    }
  };

  const handleWatchAd = async () => {
    const today = new Date().toDateString();
    const storedDate = await nativeStorage.getItem(STORAGE_KEYS.LAST_AD_DATE);
    const storedCountStr = await nativeStorage.getItem(STORAGE_KEYS.AD_COUNT);
    const storedCount = parseInt(storedCountStr || "0");

    if (storedDate === today && storedCount >= 5) {
      toast({
        title: "Günlük Limit Doldu",
        description: "Yarın tekrar gelip mürekkep kazanabilirsin!",
        variant: "default",
      });
      return;
    }

    // Kullanıcıya yükleniyor bildirimi göster
    toast({
      title: "Reklam Yükleniyor...",
      description: "Lütfen bekleyin",
    });

    try {
      console.log("[Market] 📺 Reklam yükleniyor...");

      // 🔧 Önce reklamı yükle - başarısız olursa devam etme
      const adLoaded = await loadRewardedAd();

      if (!adLoaded) {
        console.log("[Market] ❌ Reklam yüklenemedi");
        toast({
          title: "Reklam Yüklenemedi",
          description: "Lütfen internet bağlantınızı kontrol edin ve tekrar deneyin.",
          variant: "destructive",
        });
        return;
      }

      console.log("[Market] ✅ Reklam yüklendi, gösteriliyor...");

      // 🔧 Reklamı göster
      const adShown = await showRewardedAd();

      if (adShown) {
        // Sadece reklam başarıyla gösterildiyse sayacı güncelle
        if (storedDate !== today) {
          await nativeStorage.setItem(STORAGE_KEYS.LAST_AD_DATE, today);
          await nativeStorage.setItem(STORAGE_KEYS.AD_COUNT, "1");
        } else {
          await nativeStorage.setItem(STORAGE_KEYS.AD_COUNT, (storedCount + 1).toString());
        }

        // Profili yenile - giveReward içindeki refreshProfile event'i zaten tetikleniyor
        // Ek olarak burada da kısa bir gecikmeyle yeniliyoruz
        setTimeout(() => refreshProfile(), 500);
        console.log("[Market] ✅ Reklam izlendi, sayaç güncellendi");
      } else {
        toast({
          title: "Reklam Gösterilemedi",
          description: "Bir sorun oluştu, tekrar deneyin.",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("[Market] ❌ Reklam hatası:", e);
      toast({ title: "Reklam Hatası", description: "Bir hata oluştu, tekrar deneyin.", variant: "destructive" });
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
            variant="outline"
            size="icon"
            onClick={() => navigate("/")}
            className="border-2 border-white/70 text-white bg-white/10 hover:bg-white/20 shrink-0 relative z-20 shadow-md h-9 w-9"
          >
            <ArrowLeft className="w-5 h-5" />
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
              variant="ghost"
              className="p-0 h-auto bg-transparent hover:bg-transparent shadow-none border-0"
              onClick={handleWatchAd}
              disabled={isAdLoading}
            >
              <img
                src="/reklamGorsel.jpg"
                alt="Reklam İzle"
                className={`h-12 w-auto object-contain rounded-lg shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 ${isAdLoading ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
              />
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

            {/* 3. VIP ABONELİK */}
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
                      variant="outline"
                      className="w-full mt-4 border-2 border-amber-400/60 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 hover:text-white hover:border-amber-400 font-medium py-3"
                      onClick={restoreSubscriptions}
                      disabled={isSubscriptionLoading}
                    >
                      <RotateCcw className={`w-4 h-4 mr-2 ${isSubscriptionLoading ? "animate-spin" : ""}`} />
                      Satın Alımları Geri Yükle
                    </Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* --- ONAY PENCERESİ (YENİ EKLENEN KISIM) --- */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent className="w-[90%] rounded-xl bg-white border-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-800">
              {itemToBuy?.type === "time" && isUnlimitedLivesActive(profile)
                ? "Sürenizi Uzatmak İster misiniz?"
                : "Satın Almak İstiyor musunuz?"}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-slate-600 text-left pt-2">
              {/* 1. Eğer SÜRE SATIN ALINIYORSA ve ZATEN SÜRE VARSA Özel Mesaj Göster */}
              {itemToBuy?.type === "time" && isUnlimitedLivesActive(profile) ? (
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 mb-2">
                  <p className="text-orange-800 font-medium text-xs mb-1">⚠️ Mevcut Sınırsız Hakkınız Var</p>
                  <p className="text-slate-700 text-sm">
                    Şu anda aktif bir sınırsız süreniz bulunmaktadır. Satın alıma devam ederseniz, yeni süre{" "}
                    <span className="font-bold text-indigo-600">mevcut sürenizin üzerine eklenecektir.</span>
                  </p>
                </div>
              ) : null}

              {/* Standart Bilgilendirme */}
              <span className="block mt-2">
                Bu işlem için mürekkep haznenizden{" "}
                <span className="font-bold text-indigo-600 text-lg">{itemToBuy?.priceInInk} Damla</span> düşülecektir.
                Onaylıyor musunuz?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-row gap-2 justify-end mt-4">
            <AlertDialogCancel
              className="flex-1 mt-0 bg-slate-100 text-slate-700 border-0 hover:bg-slate-200"
              onClick={() => {
                setItemToBuy(null);
                setShowConfirmation(false);
              }}
            >
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={confirmPurchase}
            >
              {itemToBuy?.type === "time" && isUnlimitedLivesActive(profile) ? "Süreyi Uzat" : "Satın Al"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MarketPage;
