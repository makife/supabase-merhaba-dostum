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
import { useSounds } from "@/hooks/useSounds";
import { Capacitor } from "@capacitor/core";
import { playSpecialNativeSound } from "@/services/nativeAudioService";
import Lottie from "lottie-react";

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
  indigo: "#6366f1",
};

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

const SPIN_DURATION = 6000;
// 2 fazlı: 0-2s çok hızlı dönüş, 2-6s yavaşlayarak durma

const getTodayLocalDate = () => {
  const dateObj = new Date();
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};


const WheelPage = () => {
  const { user } = useAuth();
  const { profile, refreshProfile } = useUser();
  const { updateInventory } = useUserPurchases();
  const navigate = useNavigate();
  const { playSound } = useSounds();

  const [isSpinning, setIsSpinning] = useState(false);
  const [canSpin, setCanSpin] = useState(false);
  const [totalSpins, setTotalSpins] = useState(0);
  const [lastReward, setLastReward] = useState<WheelReward | null>(null);
  const [showKonfeti, setShowKonfeti] = useState(false);
  const [karKonfettiAnim, setCarkKonfettiAnim] = useState<any>(null);

  useEffect(() => {
    fetch("/carkKonfeti.json")
      .then((r) => r.json())
      .then(setCarkKonfettiAnim)
      .catch(console.error);
  }, []);

  const spinLockRef = useRef(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);
  const spinFinishTimeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const soundsRef = useRef<{ playSpecialSound: (path: string, volume?: number) => void } | null>(null);
  const lastSegmentIndexRef = useRef<number>(-1);
  const tickAudioPoolRef = useRef<HTMLAudioElement[]>([]);
  const tickPoolIndexRef = useRef(0);

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

      return {
        ...segment,
        pathData: `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`,
        rotateAngle,
        isGrandPrize: segment.type === "ink",
      };
    });
  }, []);

  const bonusSpinsRef = useRef(profile?.bonus_spins || 0);
  
  // bonus_spins değiştiğinde ref'i güncelle ama re-render tetikleme
  useEffect(() => {
    bonusSpinsRef.current = profile?.bonus_spins || 0;
  }, [profile?.bonus_spins]);

  const checkDailySpinAvailability = useCallback(async () => {
    if (!user) return;
    if (spinLockRef.current) return; // Spin sırasında kontrol yapma

    const today = getTodayLocalDate();
    const { data: spinData } = await supabase
      .from("wheel_spins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const dailySpinAvailable = !spinData;
    const bonusSpins = bonusSpinsRef.current;
    const total = (dailySpinAvailable ? 1 : 0) + bonusSpins;

    setTotalSpins(total);
    setCanSpin(total > 0 && !spinLockRef.current);
  }, [user]);

  const handleWheelResync = useCallback(async () => {
    await checkDailySpinAvailability();
  }, [checkDailySpinAvailability]);

  usePageResync(handleWheelResync, "WheelPage", false);

  // Web Audio API ile programatik tick sesi oluştur
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // AudioContext'i lazy olarak oluştur (kullanıcı etkileşimi sonrası)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    soundsRef.current = {
      playSpecialSound: (path: string, volume = 0.7) => {
        if (Capacitor.isNativePlatform()) {
          playSpecialNativeSound(path, volume);
        } else {
          const audio = new Audio(path);
          audio.volume = volume;
          audio.play().catch(() => {});
        }
      },
    };
  }, []);

  // Sadece mount'ta ve user değiştiğinde kontrol et
  const initialCheckDone = useRef(false);
  useEffect(() => {
    if (user && profile && !initialCheckDone.current) {
      initialCheckDone.current = true;
      checkDailySpinAvailability();
    }
  }, [user, profile, checkDailySpinAvailability]);

  // İlk mount'ta wheel elementine başlangıç rotation'ı uygula (JSX'ten bağımsız)
  useEffect(() => {
    if (wheelRef.current) {
      wheelRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
      wheelRef.current.style.willChange = "transform";
      wheelRef.current.style.backfaceVisibility = "hidden";
      wheelRef.current.style.transformOrigin = "50% 50%";
    }
  }, []);

  useEffect(() => {
    return () => {
      if (spinFinishTimeoutRef.current) {
        window.clearTimeout(spinFinishTimeoutRef.current);
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const showRewardToast = (reward: WheelReward, isLastSpin: boolean) => {
    if (reward.type === "empty") {
      toast(
        isLastSpin
          ? "😔 Bugün şansın yokmuş! Yarın tekrar dene."
          : "😔 Bu sefer pas! Hâlâ çevirme hakkın var.",
        {
          style: { background: "#374151", color: "white" },
        }
      );
      return;
    }

    toast.success(`🎉 Tebrikler! ${reward.text} kazandın!`, {
      style: { background: "#10B981", color: "white" },
    });
  };

  const consumeSpinAndSave = async (reward: WheelReward) => {
    if (!user) return;

    const today = getTodayLocalDate();
    const { data: spinData } = await supabase
      .from("wheel_spins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const dailySpinAvailable = !spinData;

    if (dailySpinAvailable) {
      await supabase.from("wheel_spins").insert({
        user_id: user.id,
        date: today,
        reward_type: reward.type,
        reward_value: reward.value,
        reward_item: reward.item || null,
      });
      return;
    }

    const currentBonusSpins = profile?.bonus_spins || 0;
    if (currentBonusSpins > 0) {
      await supabase
        .from("profiles")
        .update({ bonus_spins: currentBonusSpins - 1 })
        .eq("id", user.id);
    }
  };

  const giveReward = async (reward: WheelReward) => {
    if (!user || reward.type === "empty") return;

    if (reward.type === "credits") {
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("game_credits, bonus_credits")
        .eq("id", user.id)
        .single();

      if (!freshProfile) return;

      const currentGameCredits = freshProfile.game_credits || 0;
      const currentBonusCredits = freshProfile.bonus_credits || 0;
      const creditsToAdd = reward.value;

      const spaceInGameCredits = Math.max(0, 5 - currentGameCredits);
      const addToGame = Math.min(creditsToAdd, spaceInGameCredits);
      const addToBonus = creditsToAdd - addToGame;

      await supabase
        .from("profiles")
        .update({
          game_credits: currentGameCredits + addToGame,
          bonus_credits: currentBonusCredits + addToBonus,
        })
        .eq("id", user.id);
      return;
    }

    if (reward.type === "joker" && reward.item) {
      await updateInventory(reward.item, reward.value);
      return;
    }

    if (reward.type === "ink") {
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
    }
  };

  const finishSpin = useCallback(
    async (reward: WheelReward) => {
      try {
        setLastReward(reward);
        await consumeSpinAndSave(reward);
        await giveReward(reward);

        let remainingSpins = 0;
        setTotalSpins((prev) => {
          remainingSpins = Math.max(prev - 1, 0);
          return remainingSpins;
        });

        // State updater'dan sonra kalan hakkı kontrol et
        // (React batching nedeniyle remainingSpins closure'dan okunur)
        setTimeout(() => {
          setCanSpin(remainingSpins > 0);
          showRewardToast(reward, remainingSpins <= 0);
        }, 0);

        soundsRef.current?.playSpecialSound(
          reward.type === "empty" ? "/carkBosGeldi.mp3" : "/carkDoluGeldi.mp3",
          0.7
        );
        if (reward.type !== "empty") {
          setShowKonfeti(true);
          setTimeout(() => setShowKonfeti(false), 4000);
        }
        await refreshProfile();
      } catch (error) {
        console.error("[Wheel] Spin finalize error:", error);
        toast.error("Bir hata oluştu, lütfen tekrar dene.");
        await checkDailySpinAvailability();
      } finally {
        setIsSpinning(false);
        spinLockRef.current = false;
      }
    },
    [checkDailySpinAvailability, refreshProfile]
  );

  const spinWheel = () => {
    if (!user || !canSpin || isSpinning || spinLockRef.current) return;

    spinLockRef.current = true;
    setIsSpinning(true);
    setCanSpin(false);

    // Sadece tick sesleri çalacak, carkSesi kaldırıldı

    const rewardIndex = Math.floor(Math.random() * RAW_SEGMENTS.length);
    const reward = RAW_SEGMENTS[rewardIndex];

    const segmentAngle = 360 / RAW_SEGMENTS.length;
    const targetCenterAngle = rewardIndex * segmentAngle + segmentAngle / 2;
    const requiredRotation = 360 - targetCenterAngle;
    const currentMod = rotationRef.current % 360;
    let distanceToTarget = requiredRotation - currentMod;
    if (distanceToTarget < 0) distanceToTarget += 360;

    const totalRotation = 360 * 40 + distanceToTarget;
    const startRotation = rotationRef.current;
    const finalRotation = startRotation + totalRotation;

    if (wheelRef.current) {
      wheelRef.current.style.transition = "none";
    }

    // 2 fazlı easing: 0-2s çok hızlı sabit, 2-6s yavaşlayarak durma
    const easeTwoPhase = (t: number): number => {
      const p = 2000 / SPIN_DURATION;

      if (t <= p) {
        // Faz 1: Çok hızlı sabit dönüş - toplam yolun %70'ini 5 saniyede kat et
        return 0.70 * (t / p);
      }
      // Faz 2: Yavaşlayarak durma (cubic ease-out)
      const f = (t - p) / (1 - p);
      const easeOut = 1 - Math.pow(1 - f, 3);
      return 0.70 + 0.30 * easeOut;
    };

    const segmentAngleSize = 360 / RAW_SEGMENTS.length;
    lastSegmentIndexRef.current = -1;

    // Programatik tick sesi — AudioContext oscillator
    const playGeneratedTick = (volume: number) => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'square';
      osc.frequency.value = 1800;
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.03);
    };

    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / SPIN_DURATION, 1);
      const progress = easeTwoPhase(t);
      const currentDeg = startRotation + totalRotation * progress;

      // Tick sound: detect segment boundary crossings
      const normalizedDeg = ((currentDeg % 360) + 360) % 360;
      const currentSegIdx = Math.floor(normalizedDeg / segmentAngleSize);
      if (lastSegmentIndexRef.current !== -1 && currentSegIdx !== lastSegmentIndexRef.current) {
        const speed = 1 - t;
        const vol = 0.08 + speed * 0.25;
        playGeneratedTick(vol);
      }
      lastSegmentIndexRef.current = currentSegIdx;

      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${currentDeg}deg)`;
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rotationRef.current = finalRotation;
        rafRef.current = null;
        finishSpin(reward);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  };

  return (
    <div
      className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-6 px-4 relative overflow-hidden"
      style={{ touchAction: isSpinning ? "none" : "auto" }}
    >
      {isSpinning && <div className="fixed inset-0 z-50" aria-hidden="true" />}

      {/* Çark konfeti — ödül gelince bir kere oynar */}
      {showKonfeti && karKonfettiAnim && (
        <div className="fixed inset-0 z-40 pointer-events-none overflow-hidden">
          <Lottie
            animationData={karKonfettiAnim}
            loop={false}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}

      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0 opacity-30">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-900/40 to-blue-900/40" />
      </div>

      <div className="w-full max-w-md z-10 flex flex-col gap-6">
        <div className="flex items-center justify-start">
          <Button onClick={() => { playSound("buttonClick"); navigate("/"); }} variant="ghost" className="text-white hover:bg-white/10">
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
          <div className="absolute inset-2 bg-gradient-to-tr from-yellow-500/10 to-purple-500/10 rounded-full animate-pulse" />

          <div className="absolute inset-0 rounded-full border-[12px] border-slate-800 shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-slate-900 overflow-hidden relative">
            <div
              ref={wheelRef}
              className="w-full h-full"
            >
              <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
                {renderedSegments.map((segment, index) => (
                  <g
                    key={index}
                    className={
                      segment.isGrandPrize && !isSpinning
                        ? "drop-shadow-[0_0_2px_rgba(255,215,0,0.8)]"
                        : ""
                    }
                  >
                    <path
                      d={segment.pathData}
                      fill={segment.color}
                      stroke={segment.isGrandPrize ? "#FFD700" : "#1e293b"}
                      strokeWidth={segment.isGrandPrize ? "0.04" : "0.01"}
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
                        textShadow: isSpinning ? "none" : "1px 1px 2px rgba(0,0,0,0.8)",
                        filter: segment.isGrandPrize && !isSpinning ? "drop-shadow(0 0 1px black)" : "none",
                      }}
                    >
                      {segment.text}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full shadow-lg border-4 border-slate-900 flex items-center justify-center z-20">
              <img src="/carkMerak.svg" alt="Çark" className="w-14 h-14 object-contain drop-shadow-md" />
            </div>
          </div>

          <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-30 filter drop-shadow-lg">
            <div className="w-8 h-10 bg-red-600 clip-path-polygon-[50%_100%,_0%_0%,_100%_0%] rounded-t-sm border-t-2 border-red-400" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 mt-2">
          {totalSpins > 0 && !isSpinning && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-4 py-2 rounded-full border border-yellow-500/30">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 font-bold text-lg">x{totalSpins}</span>
              <span className="text-gray-400 text-sm">çevirme hakkı</span>
            </div>
          )}

          <Button
            onClick={spinWheel}
            disabled={!canSpin || isSpinning || spinLockRef.current}
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
