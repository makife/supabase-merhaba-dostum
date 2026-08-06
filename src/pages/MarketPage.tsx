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
import { ArrowLeft, Crown, Zap, Infinity, Droplet, PenTool, Video, RotateCcw, ChevronDown } from "lucide-react";
import nativeStorage, { STORAGE_KEYS } from "@/utils/nativeStorage";
import Lottie from "lottie-react";
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
  const { containerRef: swipeRef, swipeHandlers } = usePageSwipeNav({ route: "/market" });
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
  const [marketAnim, setMarketAnim] = useState<any>(null);

  // Onay Penceresi State'leri
  const [itemToBuy, setItemToBuy] = useState<StationeryItem | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [quantityToBuy, setQuantityToBuy] = useState(1);

  // Joker adet seçici state'leri
  const [jokerQuantities, setJokerQuantities] = useState<Record<string, number>>({});
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const QUANTITY_OPTIONS = [1, 3, 5, 10];

  useEffect(() => {
    fetch("/marketGorsel.json")
      .then((r) => r.json())
      .then(setMarketAnim)
      .catch(console.error);
  }, []);

  const isNativePlatform = Capacitor.isNativePlatform();

  // --- Yapılandırma ---

  const inkPacks: InkPack[] = [
    {
      id: "ink_drop",
      name: "Bir Damla Mürekkep",
      amount: 100,
      price: 49.99,
      image: "/damlaMurekkep.png",
    },
    {
      id: "ink_bottle",
      name: "Mürekkep Şişesi",
      amount: 300,
      price: 149.99,
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
      price: 899.99,
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
      image: "/icons/degistir.svg",
    },
    {
      id: "j_whisper",
      type: "joker",
      subtype: "joker_fisildi",
      name: "Fısılda",
      description: "Bir kelime ipucu verir",
      priceInInk: 10,
      value: 1,
      image: "/icons/fisilda.svg",
    },
    {
      id: "j_custom",
      type: "joker",
      subtype: "joker_senyaz",
      name: "Sen Yaz",
      description: "Senin yerine kelime yazar",
      priceInInk: 20,
      value: 1,
      image: "/icons/senyaz.svg",
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
      name: "24 Saat Sınırsız Akış",
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
      // 🔥 FIX: Stale state önleme - güncel veriyi DB'den çek
      const { data: freshProfile, error: freshError } = await supabase
        .from("profiles")
        .select("ink_count")
        .eq("id", user.id)
        .single();

      if (freshError || !freshProfile) throw freshError || new Error("Profil bulunamadı");

      const newBalance = (freshProfile.ink_count || 0) + pack.amount;
      const { error } = await supabase.from("profiles").update({ ink_count: newBalance }).eq("id", user.id);

      if (error) throw error;

      await refreshProfile(true);
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
  const handleSpendInk = (item: StationeryItem, quantity = 1) => {
    if (!user || !profile) return;
    playSound("buttonClick");

    const totalPrice = item.priceInInk * quantity;

    if ((profile.ink_count || 0) < totalPrice) {
      toast({
        title: "Yetersiz Mürekkep 💧",
        description: "Yeterli mürekkebiniz yok. Mürekkep Dükkanına göz atın!",
        variant: "destructive",
      });
      setActiveTab("ink-store");
      return;
    }

    // Çoklu alım için item'ı kopyala ve fiyat/değeri çarp
    const adjustedItem: StationeryItem = {
      ...item,
      priceInInk: totalPrice,
      value: item.value * quantity,
    };

    setQuantityToBuy(quantity);
    setItemToBuy(adjustedItem);
    setShowConfirmation(true);
    setOpenDropdown(null);
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

      await refreshProfile(true);

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

      // 🔧 Önce reklamı yükle - başarısız olursa 1 kez retry yap
      let adLoaded: any = await loadRewardedAd();

      // Eğer hata objesi döndüyse veya false ise, 1 kez daha dene
      if (!adLoaded || (typeof adLoaded === "object" && adLoaded !== null && !adLoaded.success)) {
        console.log("[Market] ⚠️ İlk deneme başarısız, 2 saniye sonra tekrar deneniyor...");
        await new Promise((r) => setTimeout(r, 2000));
        adLoaded = await loadRewardedAd();
      }

      // Hala başarısız
      if (!adLoaded || (typeof adLoaded === "object" && adLoaded !== null && !adLoaded.success)) {
        const errorDetail =
          typeof adLoaded === "object" && adLoaded !== null && adLoaded.error
            ? String(adLoaded.error)
            : "Reklam sunucusuna ulaşılamadı";
        console.log("[Market] ❌ Reklam yüklenemedi:", errorDetail);
        toast({
          title: "Reklam Yüklenemedi",
          description: `Hata: ${errorDetail}`,
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
    <div ref={swipeRef} {...swipeHandlers} className="flex flex-col h-screen bg-slate-50">
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
            onClick={() => {
              playSound("buttonClick");
              navigate("/");
            }}
            className="border-2 border-red-400 text-white bg-red-600 hover:bg-red-700 shrink-0 relative z-20 shadow-md h-9 px-3 gap-1 -mt-[110px]"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-semibold">Geri</span>
          </Button>

          {/* ORTA - BAŞLIK GÖRSELİ */}
          <div className="absolute left-1/2 -top-[200px] transform -translate-x-1/2 z-10 pointer-events-none">
            {marketAnim ? (
              <Lottie
                animationData={marketAnim}
                loop={true}
                className="h-[400px] w-[400px] max-w-none origin-center"
                rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
              />
            ) : (
              <div className="h-[400px] w-[400px]" />
            )}
          </div>

          {/* Sağ Boşluk */}
          <div className="w-16 shrink-0"></div>
        </div>
        {/* Bakiye Kartı */}
        <Card className="mt-[45px] bg-white/10 backdrop-blur-md border-white/20 shadow-xl overflow-hidden">
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
                className={`h-12 w-auto object-contain rounded-lg shadow-lg ring-2 ring-white ring-offset-2 ring-offset-transparent hover:scale-105 active:scale-95 transition-all duration-200 ${isAdLoading ? "opacity-50 grayscale cursor-not-allowed" : ""}`}
              />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Ana İçerik */}
      <div className="flex-1 relative z-10 px-4 mt-2 overflow-hidden flex flex-col">
        <Tabs
          defaultValue="ink-store"
          value={activeTab}
          onValueChange={(val) => {
            playSound("buttonClick");
            setActiveTab(val);
          }}
          className="h-full flex flex-col"
        >
          <TabsList className="grid grid-cols-3 mb-4 bg-white/50 backdrop-blur p-1 rounded-xl border border-indigo-100 shadow-sm gap-1">
            <TabsTrigger
              value="ink-store"
              className="bg-indigo-100 text-indigo-400 transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-indigo-500/30"
            >
              <Droplet className="w-4 h-4 mr-1" /> Mürekkep
            </TabsTrigger>
            <TabsTrigger
              value="stationery"
              className="bg-purple-100 text-purple-400 transition-all data-[state=active]:bg-purple-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-purple-500/30"
            >
              <PenTool className="w-4 h-4 mr-1" /> Kırtasiye
            </TabsTrigger>
            <TabsTrigger
              value="vip"
              className="bg-amber-100 text-amber-500 transition-all data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-amber-500/30"
            >
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
                    .map((item) => {
                      const selectedQty = jokerQuantities[item.id] || 1;
                      const totalPrice = item.priceInInk * selectedQty;
                      const isDropdownOpen = openDropdown === item.id;

                      return (
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

                          <div className="flex items-center gap-2">
                            {/* Adet Seçici */}
                            <div className="relative">
                              <button
                                className="flex items-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold text-slate-700 transition-colors min-w-[52px] justify-center"
                                onClick={() => setOpenDropdown(isDropdownOpen ? null : item.id)}
                              >
                                {selectedQty}x
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                                />
                              </button>
                              {isDropdownOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setOpenDropdown(null)} />
                                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50 overflow-hidden min-w-[52px]">
                                    {QUANTITY_OPTIONS.map((qty) => (
                                      <button
                                        key={qty}
                                        className={`w-full px-3 py-2 text-sm font-medium text-left hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${
                                          selectedQty === qty ? "bg-indigo-100 text-indigo-700" : "text-slate-700"
                                        }`}
                                        onClick={() => {
                                          setJokerQuantities((prev) => ({ ...prev, [item.id]: qty }));
                                          setOpenDropdown(null);
                                        }}
                                      >
                                        {qty}x
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Satın Al Düğmesi */}
                            <Button
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[80px]"
                              onClick={() => handleSpendInk(item, selectedQty)}
                              disabled={purchaseLoading}
                            >
                              <Droplet className="w-3 h-3 mr-1" /> {totalPrice}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
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
                      <span className="font-medium text-sm">Sınırsız Sayfa (Hiç bitmeyen sayfa)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-amber-100" />
                      <span className="font-medium text-sm">Reklamsız Deneyim</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 flex items-center justify-center font-black text-amber-100 text-base">×2</span>
                      <span className="font-medium text-sm">Maç sonu puanların 2 katı!</span>
                    </div>
                    <div className="flex items-center gap-3 border-t border-white/10 pt-2">
                      <div className="bg-amber-400 p-1 rounded-full">
                        <img src="/icons/degistir.svg" className="w-4 h-4" alt="joker" />
                      </div>
                      <div className="bg-amber-400 p-1 rounded-full -ml-2">
                        <img src="/icons/fisilda.svg" className="w-4 h-4" alt="joker" />
                      </div>
                      <div className="bg-amber-400 p-1 rounded-full -ml-2">
                        <img src="/icons/senyaz.svg" className="w-4 h-4" alt="joker" />
                      </div>
                      <span className="font-bold text-sm ml-1 text-white">Her Gün Bedava Joker!</span>
                    </div>
                    <div className="text-xs text-amber-50/90 pl-1 space-y-1">
                      <div>• <span className="font-semibold">Aylık:</span> Günlük 5'er Değiştir, Fısılda ve Sen Yaz jokeri</div>
                      <div>• <span className="font-semibold">Yıllık:</span> Günlük 7'şer Değiştir, Fısılda ve Sen Yaz jokeri</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                      className="bg-white text-orange-600 hover:bg-orange-50 font-bold h-auto py-3 flex-col gap-1 shadow-md"
                      onClick={() => purchaseSubscription("premium_monthly")}
                      disabled={isSubscriptionLoading}
                    >
                      <span className="text-lg">Aylık</span>
                      <span className="text-[10px] opacity-80">5 joker / gün</span>
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
                      <span className="text-[10px] opacity-80">7 joker / gün</span>
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
        <AlertDialogContent className="w-[90%] rounded-2xl bg-[#1e2d45] border border-indigo-500/20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] p-0 overflow-hidden">
          {/* Üst banner: ürün görseli */}
          <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-indigo-600/20 via-[#1e2d45] to-[#1e2d45] border-b border-white/5">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex items-center gap-3">
              {itemToBuy?.image && (
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  <img
                    src={itemToBuy.image}
                    className="w-10 h-10 object-contain drop-shadow-lg"
                    alt={itemToBuy?.name}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.15em] text-indigo-300/70 font-bold mb-0.5">
                  {itemToBuy?.type === "time" && isUnlimitedLivesActive(profile) ? "Süre Uzat" : "Satın Alma Onayı"}
                </p>
                <AlertDialogTitle className="text-base font-black text-white leading-tight truncate">
                  {itemToBuy?.type === "time" && isUnlimitedLivesActive(profile)
                    ? "Sürenizi Uzatmak İster misiniz?"
                    : "Satın Almak İstiyor musunuz?"}
                </AlertDialogTitle>
              </div>
            </div>
          </div>

          {/* İçerik */}
          <div className="px-5 py-4">
            <AlertDialogDescription asChild>
              <div className="text-slate-300 text-left space-y-3">
                {itemToBuy?.type === "time" && isUnlimitedLivesActive(profile) && (
                  <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                    <p className="text-amber-300 font-semibold text-xs mb-1">⚠️ Mevcut Sınırsız Hakkınız Var</p>
                    <p className="text-slate-300 text-xs leading-relaxed">
                      Şu anda aktif bir sınırsız süreniz bulunmaktadır. Yeni süre{" "}
                      <span className="font-bold text-amber-300">mevcut sürenizin üzerine eklenecektir.</span>
                    </p>
                  </div>
                )}

                {quantityToBuy > 1 && itemToBuy?.type === "joker" && (
                  <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                    <span className="text-xs text-slate-400">Adet</span>
                    <span className="text-sm font-bold text-white">
                      {quantityToBuy} × {itemToBuy?.name}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between bg-gradient-to-r from-indigo-600/15 to-indigo-500/5 rounded-xl px-3 py-3 border border-indigo-500/20">
                  <span className="text-xs text-slate-300 font-medium">Toplam Tutar</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-lg font-black text-white">{itemToBuy?.priceInInk}</span>
                    <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Damla</span>
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 text-center pt-1">Tutar mürekkep haznenizden düşülecektir.</p>
              </div>
            </AlertDialogDescription>
          </div>

          <AlertDialogFooter className="flex-row gap-2 px-5 pb-5 pt-0">
            <AlertDialogCancel
              className="flex-1 mt-0 bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10 hover:text-white rounded-xl h-11 font-semibold"
              onClick={() => {
                setItemToBuy(null);
                setShowConfirmation(false);
              }}
            >
              Vazgeç
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white border-0 rounded-xl h-11 font-bold shadow-lg shadow-indigo-900/40"
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
