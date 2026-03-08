import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useUserPurchases } from "@/hooks/useUserPurchases";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Trophy, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePageResync } from "@/hooks/useGlobalResync";
import { Capacitor } from "@capacitor/core";

interface WheelReward {
  type: "credits" | "joker" | "empty" | "ink";
  value: number;
  item?: string;
  text: string;
  color: string;
}

// Renkleri dışarıda tanımla ki her renderda oluşmasın
const WHEEL_COLORS = {
  blue: "#3B82F6",
  green: "#10B981",
  yellow: "#F59E0B",
  purple: "#8B5CF6",
  gray: "#6B7280",
  red: "#EF4444",
  indigo: "#6366f1",
};

// Statik segment verisi (useMemo içinde işlenecek)
const RAW_SEGMENTS: WheelReward[] = [
  { type: "credits", value: 1, text: "1 Oyun", color: WHEEL_COLORS.blue },
  { type: "joker", value: 1, item: "degistir", text: "Değiştir", color: WHEEL_COLORS.green },
  { type: "empty", value: 0, text: "Pas", color: WHEEL_COLORS.gray },
  { type: "credits", value: 2, text: "2 Oyun", color: WHEEL_COLORS.blue },
  { type: "joker", value: 1, item: "fisilida", text: "Fısılda", color: WHEEL_COLORS.yellow },
  { type: "empty", value: 0, text: "Pas", color: WHEEL_COLORS.gray },
  { type: "credits", value: 1, text: "1 Oyun", color: WHEEL_COLORS.blue },
  { type: "joker", value: 2, item: "degistir", text: "2x Değiştir", color: WHEEL_COLORS.green },
  { type: "empty", value: 0, text: "Pas", color: WHEEL_COLORS.gray },
  { type: "ink", value: 5, text: "5 Mürekkep", color: WHEEL_COLORS.indigo },
  { type: "joker", value: 1, item: "senyaz", text: "Sen Yaz", color: WHEEL_COLORS.red },
  { type: "empty", value: 0, text: "Pas", color: WHEEL_COLORS.gray },
  { type: "joker", value: 2, item: "fisilida", text: "2x Fısılda", color: WHEEL_COLORS.yellow },
  { type: "joker", value: 2, item: "senyaz", text: "2x SenYaz", color: WHEEL_COLORS.red },
  { type: "empty", value: 0, text: "Pas", color: WHEEL_COLORS.gray },
];

const WheelPage = () => {
  const { user } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { updateInventory } = useUserPurchases();
  const navigate = useNavigate();

  const [isSpinning, setIsSpinning] = useState(false);
  const spinLockRef = useRef(false);
  const [canSpin, setCanSpin] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastReward, setLastReward] = useState<WheelReward | null>(null);
  const [transitionDuration, setTransitionDuration] = useState(0);
  const [totalSpins, setTotalSpins] = useState(0); // Toplam çevirme hakkı (günlük + bonus)
  const [isLoading, setIsLoading] = useState(true); // UI'ı hemen göster, veriyi arka planda çek
  
  // useSounds lazy load - sadece spin sırasında yükle
  const soundsRef = useRef<{ playSpecialSound: (path: string, volume?: number) => void } | null>(null);

  // Bezier eğrisini state'te tutmaya gerek yok, sabit bir string
  const timingFunction = "cubic-bezier(0.2, 0, 0.1, 1)";

  // ⚡️ OPTİMİZASYON: Koordinat hesaplamalarını useMemo içine aldık.
  // Bu sayede her render'da (spin sırasında) tekrar tekrar matematik işlemi yapılmaz.
  const renderedSegments = useMemo(() => {
    const getCoordinatesForPercent = (percent: number) => {
      const x = Math.cos(2 * Math.PI * percent);
      const y = Math.sin(2 * Math.PI * percent);
      return [x, y];
    };

    return RAW_SEGMENTS.map((segment, index) => {
      const startPercent = index / RAW_SEGMENTS.length;
      const endPercent = (index + 1) / RAW_SEGMENTS.length;
      const [startX, startY] = getCoordinatesForPercent(startPercent);
      const [endX, endY] = getCoordinatesForPercent(endPercent);
      const largeArcFlag = endPercent - startPercent > 0.5 ? 1 : 0;
      const segmentAngle = 360 / RAW_SEGMENTS.length;
      const rotateAngle = index * segmentAngle + segmentAngle / 2;

      // SVG Path string'ini burada oluşturuyoruz
      const pathData = `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

      return {
        ...segment,
        pathData,
        rotateAngle,
        isGrandPrize: segment.type === "ink",
      };
    });
  }, []); // Bağımlılık dizisi boş, sadece 1 kere hesaplanır.

  const handleWheelResync = useCallback(async () => {
    await checkDailySpinAvailability();
  }, [user]);

  usePageResync(handleWheelResync, "WheelPage", false);

  // 🔥 OPTİMİZASYON: useSounds'ı lazy load et - sayfa açılışını yavaşlatmasın
  useEffect(() => {
    // Ses modülünü arka planda yükle
    const loadSounds = async () => {
      try {
        const { useSounds } = await import("@/hooks/useSounds");
        // Hook'u component dışında çağıramayız, bu yüzden doğrudan fonksiyon kullan
        soundsRef.current = {
          playSpecialSound: (path: string, volume = 0.7) => {
            // Native platformda NativeAudio kullan
            if (Capacitor.isNativePlatform()) {
              import("@/services/nativeAudioService").then(({ playSpecialNativeSound }) => {
                playSpecialNativeSound(path, volume);
              });
            } else {
              // Web'de basit Audio kullan
              const audio = new Audio(path);
              audio.volume = volume;
              audio.play().catch(() => {});
            }
          }
        };
      } catch (e) {
        console.warn("Ses modülü yüklenemedi:", e);
      }
    };
    loadSounds();
  }, []);

  // Spin availability kontrolünü arka planda yap
  useEffect(() => {
    if (user && profile) {
      // Önce UI'ı göster, sonra veriyi kontrol et
      setIsLoading(false);
      checkDailySpinAvailability();
    }
  }, [user, profile?.bonus_spins]);

  const checkDailySpinAvailability = async () => {
    if (!user) return;
    
    // Yerel tarih kullan (UTC problemi çözümü)
    const dateObj = new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    // Bugünkü çevirme yapılmış mı kontrol et
    const { data: spinData } = await supabase
      .from("wheel_spins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const dailySpinAvailable = !spinData; // Bugün çevirilmediyse 1 hak var
    const bonusSpins = profile?.bonus_spins || 0;
    
    // Toplam hak = günlük (eğer kullanılmadıysa 1) + bonus
    const total = (dailySpinAvailable ? 1 : 0) + bonusSpins;
    setTotalSpins(total);
    setCanSpin(total > 0);
  };

  const spinWheel = async () => {
    if (!user || !canSpin || isSpinning || spinLockRef.current) return;
    spinLockRef.current = true;
    setCanSpin(false); // İlk frame'de tekrar tıklamayı fiziksel olarak da kapat

    // Sesi asenkron başlatmayı dene, UI'ı bloklamasın
    setTimeout(() => {
      if (soundsRef.current) {
        soundsRef.current.playSpecialSound("/carkSesi.mp3", 0.8);
      }
    }, 0);

    setIsSpinning(true);

    const rewardIndex = Math.floor(Math.random() * RAW_SEGMENTS.length);
    const reward = RAW_SEGMENTS[rewardIndex];

    const segmentAngle = 360 / RAW_SEGMENTS.length;
    const targetCenterAngle = rewardIndex * segmentAngle + segmentAngle / 2;
    const requiredRotation = 360 - targetCenterAngle;
    const currentMod = rotation % 360;
    let distanceToTarget = requiredRotation - currentMod;

    if (distanceToTarget < 0) {
      distanceToTarget += 360;
    }

    const extraSpins = 360 * 8;
    const finalRotation = rotation + extraSpins + distanceToTarget;

    setTransitionDuration(8500);
    setRotation(finalRotation);

    setTimeout(async () => {
      setLastReward(reward);
      
      // Hangi hak kullanıldığını belirle ve kaydet
      await consumeSpinAndSave(reward);
      
      giveReward(reward);

      setIsSpinning(false);
      spinLockRef.current = false;
      
      const remaining = totalSpins - 1;
      setTotalSpins(remaining);
      setCanSpin(remaining > 0);
      
      // Toast'u kalan hakka göre göster
      if (remaining <= 0) {
        showRewardToast(reward, true);
      } else {
        showRewardToast(reward, false);
      }
      
      // Kazanma sesini çal
      if (soundsRef.current) {
        soundsRef.current.playSpecialSound("/win.mp3", 0.6);
      }
      refreshProfile();
    }, 8500);
  };

  // Çevirme hakkını tüket ve kaydı yap
  const consumeSpinAndSave = async (reward: WheelReward) => {
    if (!user) return;
    
    // Yerel tarih kullan
    const dateObj = new Date();
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;
    
    // Bugün çevirme yapılmış mı kontrol et
    const { data: spinData } = await supabase
      .from("wheel_spins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const dailySpinAvailable = !spinData;

    if (dailySpinAvailable) {
      // Günlük hakkı kullan - wheel_spins'e kaydet
      await supabase.from("wheel_spins").insert({
        user_id: user.id,
        date: today,
        reward_type: reward.type,
        reward_value: reward.value,
        reward_item: reward.item || null,
      });
    } else {
      // Bonus hakkı kullan - bonus_spins'i azalt
      const currentBonusSpins = profile?.bonus_spins || 0;
      if (currentBonusSpins > 0) {
        await supabase
          .from("profiles")
          .update({ bonus_spins: currentBonusSpins - 1 })
          .eq("id", user.id);
      }
    }
  };

  const giveReward = async (reward: WheelReward) => {
    if (!user || reward.type === "empty") return;

    if (reward.type === "credits") {
      // 🔥 KRİTİK FİX: Önce güncel değeri veritabanından çek!
      // Bu sayede eski cache değeri üzerine yazmayı önlüyoruz
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("game_credits, bonus_credits")
        .eq("id", user.id)
        .single();
      
      if (freshProfile) {
        // Kredi ekleme mantığı: önce game_credits 5'e tamamla, kalan bonus'a
        const currentGameCredits = freshProfile.game_credits || 0;
        const currentBonusCredits = freshProfile.bonus_credits || 0;
        const creditsToAdd = reward.value;
        
        // game_credits 5'e kadar doldur
        const spaceInGameCredits = Math.max(0, 5 - currentGameCredits);
        const addToGame = Math.min(creditsToAdd, spaceInGameCredits);
        const addToBonus = creditsToAdd - addToGame;
        
        await supabase
          .from("profiles")
          .update({ 
            game_credits: currentGameCredits + addToGame,
            bonus_credits: currentBonusCredits + addToBonus
          })
          .eq("id", user.id);
        
        console.log(`[Wheel] Credits added: game +${addToGame}, bonus +${addToBonus}`);
      }
      refreshProfile();
    } else if (reward.type === "joker" && reward.item) {
      await updateInventory(reward.item, reward.value);
    } else if (reward.type === "ink") {
      // 🔥 FIX: Güncel ink değerini veritabanından çek
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("ink_count")
        .eq("id", user.id)
        .single();
      
      const currentInk = freshProfile?.ink_count || 0;
      await supabase
        .from("profiles")
        .update({ ink_count: currentInk + reward.value })
        .eq("id", user.id);
      refreshProfile();
    }
  };

  const showRewardToast = (reward: WheelReward, isLastSpin: boolean) => {
    if (reward.type === "empty") {
      if (isLastSpin) {
        toast("😔 Bugün şansın yokmuş! Yarın tekrar dene.", {
          style: { background: "#374151", color: "white" },
        });
      } else {
        toast("😔 Bu sefer pas! Hâlâ çevirme hakkın var.", {
          style: { background: "#374151", color: "white" },
        });
      }
    } else {
      toast.success(`🎉 Tebrikler! ${reward.text} kazandın!`, {
        style: { background: "#10B981", color: "white" },
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-6 px-4 relative overflow-hidden">
      {/* ⚡️ OPTİMİZASYON: Arkaplan efektlerini basitleştirdik. 
        blur-[100px] mobil cihazlarda GPU'yu çok yorar. 
        Bunun yerine daha basit bir gradient veya daha düşük blur kullanmalısın.
      */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-900/40 to-blue-900/40" />
      </div>

      <div className="w-full max-w-md z-10 flex flex-col gap-6">
        <div className="flex items-center justify-start">
          <Button onClick={() => navigate("/")} variant="ghost" className="text-white hover:bg-white/10">
            <ArrowLeft className="w-6 h-6 mr-2" />
            Ana Menü
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent drop-shadow-sm">
            ŞANS ÇARKI
          </h1>
          <p className="text-sm text-gray-400">Her gün 1 ücretsiz çevirme hakkı!</p>
        </div>

        <div className="relative w-full aspect-square max-w-[360px] mx-auto">
          {/* Efekt optimize edildi: blur-xl yerine daha hafif gölge */}
          <div className="absolute inset-2 bg-gradient-to-tr from-yellow-500/10 to-purple-500/10 rounded-full animate-pulse"></div>

          <div className="absolute inset-0 rounded-full border-[12px] border-slate-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-slate-900 overflow-hidden relative">
            <div
              className={`w-full h-full ${isSpinning ? "pointer-events-none" : ""}`}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: isSpinning ? `transform ${transitionDuration}ms ${timingFunction}` : "none",
                willChange: isSpinning ? "transform" : "auto",
              }}
            >
              <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
                {renderedSegments.map((segment, index) => (
                  <g key={index} className={segment.isGrandPrize ? "drop-shadow-[0_0_2px_rgba(255,215,0,0.8)]" : ""}>
                    <path
                      d={segment.pathData}
                      fill={segment.color}
                      stroke={segment.isGrandPrize ? "#FFD700" : "#1e293b"}
                      strokeWidth={segment.isGrandPrize ? "0.04" : "0.01"}
                      style={{ zIndex: segment.isGrandPrize ? 10 : 1 }}
                    />
                    <text
                      x="0.65"
                      y="0"
                      fill="white"
                      fontSize="0.09"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${segment.rotateAngle} 0 0)`}
                      style={{
                        textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                        filter: segment.isGrandPrize ? "drop-shadow(0 0 1px black)" : "none",
                      }}
                    >
                      {segment.text}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full shadow-lg border-4 border-slate-900 flex items-center justify-center z-20">
              <Sparkles className="w-8 h-8 text-white drop-shadow-md" />
            </div>
          </div>

          <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-30 filter drop-shadow-lg">
            <div className="w-8 h-10 bg-red-600 clip-path-polygon-[50%_100%,_0%_0%,_100%_0%] rounded-t-sm border-t-2 border-red-400"></div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 mt-2">
          {/* Çevirme Hakkı Sayacı */}
          {totalSpins > 0 && !isSpinning && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-4 py-2 rounded-full border border-yellow-500/30">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 font-bold text-lg">x{totalSpins}</span>
              <span className="text-gray-400 text-sm">çevirme hakkı</span>
            </div>
          )}
          
          <Button
            onClick={spinWheel}
            disabled={!canSpin || isSpinning}
            size="lg"
            className={`
              w-full max-w-xs h-14 text-xl font-bold rounded-2xl shadow-xl transition-all duration-300
              ${
                !canSpin
                  ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-yellow-400 to-orange-500 hover:scale-105 hover:shadow-orange-500/30 text-slate-900 border-b-4 border-orange-700 active:border-b-0 active:translate-y-1"
              }
            `}
          >
            {isSpinning ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin text-2xl">⚙️</span> Dönüyor...
              </span>
            ) : canSpin ? (
              <span className="flex items-center gap-2">
                ÇARKI ÇEVİR <Trophy className="w-5 h-5" />
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4" /> YARIN BEKLENİYOR
              </span>
            )}
          </Button>

          {!canSpin && !isSpinning && (
            <p className="text-xs text-gray-500 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800">
              Bir sonraki çevirme hakkı için yarını bekle.
            </p>
          )}
        </div>

        {lastReward && (
          <Card className="bg-slate-900/60 border-slate-800 backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in duration-700">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-inner"
                  style={{ backgroundColor: lastReward.color }}
                >
                  🎁
                </div>
                <div>
                  <p className="text-xs text-gray-400">Son Kazancın</p>
                  <p className="font-bold text-white text-lg">{lastReward.text}</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-white/10 hover:bg-white/20">
                Eklendi
              </Badge>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WheelPage;
