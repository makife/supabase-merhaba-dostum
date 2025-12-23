import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useUserPurchases } from "@/hooks/useUserPurchases";
import { useSounds } from "@/hooks/useSounds";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, Trophy, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

// GÜNCELLEME: 'ink' tipi eklendi
interface WheelReward {
  type: "credits" | "joker" | "empty" | "ink";
  value: number;
  item?: string;
  text: string;
  color: string;
}

const WHEEL_COLORS = {
  blue: "#3B82F6",
  green: "#10B981",
  yellow: "#F59E0B",
  purple: "#8B5CF6",
  gray: "#6B7280",
  red: "#EF4444",
  indigo: "#6366f1", // Mürekkep rengi eklendi
};

const WheelPage = () => {
  const { user } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { updateInventory } = useUserPurchases();
  const { playSpecialSound } = useSounds();
  const navigate = useNavigate();

  const [isSpinning, setIsSpinning] = useState(false);
  const [canSpin, setCanSpin] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [lastReward, setLastReward] = useState<WheelReward | null>(null);
  const [transitionDuration, setTransitionDuration] = useState(0);

  // Daha doğal bir duruş için bezier eğrisi
  const [timingFunction, setTimingFunction] = useState("cubic-bezier(0.2, 0, 0.1, 1)");

  const wheelSegments: WheelReward[] = useMemo(
    () => [
      { type: "credits", value: 1, text: "1 Oyun", color: WHEEL_COLORS.blue },
      { type: "joker", value: 1, item: "degistir", text: "Değiştir", color: WHEEL_COLORS.green },
      { type: "empty", value: 0, text: "Pas", color: WHEEL_COLORS.gray },
      { type: "credits", value: 2, text: "2 Oyun", color: WHEEL_COLORS.blue },
      { type: "joker", value: 1, item: "fisilida", text: "Fısılda", color: WHEEL_COLORS.yellow },
      { type: "empty", value: 0, text: "Pas", color: WHEEL_COLORS.gray },
      
      // GÜNCELLEME: 3 Oyun -> 1 Oyun yapıldı
      { type: "credits", value: 1, text: "1 Oyun", color: WHEEL_COLORS.blue },
      
      { type: "joker", value: 2, item: "degistir", text: "2x Değiştir", color: WHEEL_COLORS.green },
      { type: "empty", value: 0, text: "Pas", color: WHEEL_COLORS.gray },
      
      // GÜNCELLEME: 5 Oyun -> 5 Mürekkep yapıldı ve rengi indigo oldu
      { type: "ink", value: 5, text: "5 Mürekkep", color: WHEEL_COLORS.indigo },
      
      { type: "joker", value: 1, item: "senyaz", text: "Sen Yaz", color: WHEEL_COLORS.red },
      { type: "empty", value: 0, text: "Pas", color: WHEEL_COLORS.gray },
      { type: "joker", value: 2, item: "fisilida", text: "2x Fısılda", color: WHEEL_COLORS.yellow },
      { type: "joker", value: 2, item: "senyaz", text: "2x SenYaz", color: WHEEL_COLORS.red },
      { type: "empty", value: 0, text: "Pas", color: WHEEL_COLORS.gray },
    ],
    [],
  );

  useEffect(() => {
    if (user) {
      checkDailySpinAvailability();
    }
  }, [user]);

  const checkDailySpinAvailability = async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];

    const { data } = await supabase
      .from("wheel_spins")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    setCanSpin(!data);
  };

  const spinWheel = async () => {
    if (!user || !canSpin || isSpinning) return;

    playSpecialSound("/carkSesi.mp3", 0.8);
    setIsSpinning(true);

    const rewardIndex = Math.floor(Math.random() * wheelSegments.length);
    const reward = wheelSegments[rewardIndex];

    // MATEMATİK DÜZELTMESİ:
    // 1. Dilim açısı
    const segmentAngle = 360 / wheelSegments.length;

    // 2. Hedef dilimin merkez açısı (index * açı + yarım açı)
    // Bu açı, dilimin merkezinin 0 noktasından (saat 12) ne kadar uzakta olduğunu verir.
    const targetCenterAngle = rewardIndex * segmentAngle + segmentAngle / 2;

    // 3. Çarkı kaç derece döndürmeliyiz?
    // Çark saat yönünde dönüyor. Hedef dilimi saat 12'ye (0 dereceye) getirmek için
    // 360 - hedef_açı kadar döndürmeliyiz.
    const requiredRotation = 360 - targetCenterAngle;

    // 4. Mevcut rotasyonun üzerine ekle (Geriye sarma yapmaması için)
    // Önceki rotasyonun 360 modunu alıp, tam tura tamamlıyoruz, sonra hedefi ekliyoruz.
    const currentMod = rotation % 360;
    let distanceToTarget = requiredRotation - currentMod;

    // Eğer hedef açı geride kaldıysa, ileriye doğru bir tam tur ekleyerek git
    if (distanceToTarget < 0) {
      distanceToTarget += 360;
    }

    // 5. Ekstra turlar (8 tam tur)
    const extraSpins = 360 * 8;

    // 6. Sonuç rotasyonu
    const finalRotation = rotation + extraSpins + distanceToTarget;

    setTransitionDuration(8500);
    setTimingFunction("cubic-bezier(0.2, 0, 0.1, 1)");
    setRotation(finalRotation);

    setTimeout(async () => {
      setLastReward(reward);
      await saveWheelSpin(reward);
      await giveReward(reward);
      setIsSpinning(false);
      setCanSpin(false);
      showRewardToast(reward);
      playSpecialSound("/win.mp3", 0.6);
    }, 8500);
  };

  const saveWheelSpin = async (reward: WheelReward) => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];

    await supabase.from("wheel_spins").insert({
      user_id: user.id,
      date: today,
      reward_type: reward.type,
      reward_value: reward.value,
      reward_item: reward.item || null,
    });
  };

  const giveReward = async (reward: WheelReward) => {
    if (!user || reward.type === "empty") return;

    if (reward.type === "credits") {
      const currentCredits = profile?.game_credits || 0;
      const newCredits = currentCredits + reward.value;
      await supabase.from("profiles").update({ game_credits: newCredits }).eq("id", user.id);
      await refreshProfile();
    } else if (reward.type === "joker" && reward.item) {
      await updateInventory(reward.item, reward.value);
    } 
    // GÜNCELLEME: Mürekkep ödül mantığı eklendi
    else if (reward.type === "ink") {
      const currentInk = profile?.ink_count || 0;
      const newInk = currentInk + reward.value;
      await supabase.from("profiles").update({ ink_count: newInk }).eq("id", user.id);
      await refreshProfile();
    }
  };

  const showRewardToast = (reward: WheelReward) => {
    if (reward.type === "empty") {
      toast("😔 Bugün şansın yokmuş! Yarın tekrar dene.", {
        style: { background: "#374151", color: "white" },
      });
    } else {
      toast.success(`🎉 Tebrikler! ${reward.text} kazandın!`, {
        style: { background: "#10B981", color: "white" },
      });
    }
  };

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-6 px-4 relative overflow-hidden">
      {/* Arkaplan Efektleri */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-md z-10 flex flex-col gap-6">
        {/* Header - SADECE GERİ BUTONU */}
        <div className="flex items-center justify-start">
          <Button onClick={() => navigate("/")} variant="ghost" className="text-white hover:bg-white/10">
            <ArrowLeft className="w-6 h-6 mr-2" />
            Ana Menü
          </Button>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent drop-shadow-sm">
            ŞANS ÇARKI
          </h1>
          <p className="text-sm text-gray-400">Her gün 1 ücretsiz çevirme hakkı!</p>
        </div>

        {/* Wheel Container */}
        <div className="relative w-full aspect-square max-w-[360px] mx-auto">
          {/* Dış Çerçeve (Glow Efekti) */}
          <div className="absolute inset-2 bg-gradient-to-tr from-yellow-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse"></div>

          {/* Çark Çerçevesi */}
          <div className="absolute inset-0 rounded-full border-[12px] border-slate-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-slate-900 overflow-hidden relative">
            {/* Dönen Kısım */}
            <div
              className="w-full h-full"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: `transform ${transitionDuration}ms ${timingFunction}`,
                willChange: "transform",
              }}
            >
              <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
                {wheelSegments.map((segment, index) => {
                  const startPercent = index / wheelSegments.length;
                  const endPercent = (index + 1) / wheelSegments.length;
                  const [startX, startY] = getCoordinatesForPercent(startPercent);
                  const [endX, endY] = getCoordinatesForPercent(endPercent);
                  const largeArcFlag = endPercent - startPercent > 0.5 ? 1 : 0;

                  const segmentAngle = 360 / wheelSegments.length;
                  const rotateAngle = index * segmentAngle + segmentAngle / 2;
                  
                  // GÜNCELLEME: Büyük ödül (Mürekkep) kontrolü
                  const isGrandPrize = segment.type === "ink";

                  return (
                    // Grand Prize ise ekstra shadow efekti
                    <g key={index} className={isGrandPrize ? "drop-shadow-[0_0_2px_rgba(255,215,0,0.8)]" : ""}>
                      <path
                        d={`M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`}
                        fill={segment.color}
                        // GÜNCELLEME: Büyük ödül ise Altın rengi çerçeve, değilse standart
                        stroke={isGrandPrize ? "#FFD700" : "#1e293b"}
                        // GÜNCELLEME: Büyük ödül ise kalın çerçeve
                        strokeWidth={isGrandPrize ? "0.04" : "0.01"}
                        // GÜNCELLEME: Çerçeve diğerlerinin üstünde kalsın diye
                        style={{ zIndex: isGrandPrize ? 10 : 1 }}
                      />
                      <text
                        x="0.65"
                        y="0"
                        fill="white"
                        fontSize="0.09"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${rotateAngle} 0 0)`}
                        style={{ 
                          textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                          // GÜNCELLEME: Büyük ödül yazısına ekstra parlama
                          filter: isGrandPrize ? "drop-shadow(0 0 1px black)" : "none" 
                        }}
                      >
                        {segment.text}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Merkez Süsleme */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full shadow-lg border-4 border-slate-900 flex items-center justify-center z-20">
              <Sparkles className="w-8 h-8 text-white drop-shadow-md" />
            </div>
          </div>

          {/* İbre (Pointer) - En üstte sabit */}
          <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-30 filter drop-shadow-lg">
            <div className="w-8 h-10 bg-red-600 clip-path-polygon-[50%_100%,_0%_0%,_100%_0%] rounded-t-sm border-t-2 border-red-400"></div>
          </div>
        </div>

        {/* Action Button & Info */}
        <div className="flex flex-col items-center gap-4 mt-2">
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
                <span className="animate-spin text-2xl">⚙️</span> Şansın Dönüyor...
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

        {/* Son Kazanım Kartı - Animasyonlu */}
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
