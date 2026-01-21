import { useState, useEffect } from "react";
import { useMusic } from "@/contexts/MusicContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PrivateRoomModal from "@/components/PrivateRoomModal";
import { SlotMatchmaking } from "@/components/SlotMatchmaking";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useJokerInventory } from "@/hooks/useJokerInventory";
import { usePremiumDailyRewards } from "@/hooks/usePremiumDailyRewards";
import { useMemoryGame } from "@/hooks/useMemoryGame";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";
import GameModeSelector from "@/components/GameModeSelector";
import { FloatingMenu } from "@/components/FloatingMenu";

import { Bot, Users, Trophy, Clock, Target, Crown, Zap, Gift, Star, Flame, Gamepad2, Sparkles } from "lucide-react";

// --- YARDIMCI SABİTLER ---

const greetingMessages = [
  "Sahne senin! 🌟",
  "Bugün şanslı günün! 🍀",
  "Enerjin harika! ⚡",
  "Rekor kırmaya hazır mısın? 🚀",
  "Şampiyon geldi! 👑",
];

const getRandomGreeting = () => greetingMessages[Math.floor(Math.random() * greetingMessages.length)];

const isGiftPremium = (profile: any) => {
  if (!profile?.premium_until) return false;
  const premiumUntil = new Date(profile.premium_until);
  const createdAt = new Date(profile.created_at);
  const daysDiff = Math.ceil((premiumUntil.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 6 && daysDiff <= 8 && premiumUntil > new Date();
};

const isUnlimitedLivesActive = (profile: any) => {
  if (!profile?.unlimited_lives_until) return false;
  const expiry = new Date(profile.unlimited_lives_until);
  return expiry > new Date();
};

const getVipType = (profile: any): "yearly" | "monthly" | "short" | null => {
  if (!profile?.premium_until) return null;
  const now = new Date();
  const premiumUntil = new Date(profile.premium_until);
  if (premiumUntil <= now) return null;
  const daysRemaining = Math.ceil((premiumUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysRemaining >= 300) return "yearly";
  if (daysRemaining >= 25) return "monthly";
  return "short";
};

// --- BİLEŞENLER ---

const StatWidget = ({ icon: Icon, value, label, colorClass }: any) => (
  <div className="flex-1 bg-white border border-slate-600 rounded-2xl p-3 flex flex-col items-center justify-center relative overflow-hidden group shadow-sm">
    <Icon className={`w-5 h-5 mb-1 text-${colorClass}-500`} />
    <span className="text-lg font-bold text-slate-800 tracking-tight">{value}</span>
    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wide opacity-80">{label}</span>
  </div>
);

const GameModeCard = ({ mode, onClick }: any) => (
  <div
    onClick={onClick}
    className={`relative group cursor-pointer rounded-3xl p-4 h-32 flex flex-col justify-between transition-transform duration-200 active:scale-[0.97] border border-slate-600 shadow-lg hover:shadow-${mode.glowColor}-500/20`}
    style={{ transform: "translateZ(0)" }}
  >
    <div
      className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-90 group-hover:opacity-100 transition-opacity rounded-3xl`}
    />
    <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />

    <div className="relative z-10 flex justify-between items-start">
      <div className="p-2 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
        <mode.icon className="w-6 h-6 text-white" />
      </div>
      {mode.isLive && (
        <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px] px-2 py-0.5 animate-pulse">
          CANLI
        </Badge>
      )}
    </div>

    <div className="relative z-10">
      <h3 className="text-lg font-bold text-white leading-none mb-1 drop-shadow-md">{mode.title}</h3>
      <p className="text-[11px] text-white/80 font-medium line-clamp-1">{mode.description}</p>
    </div>
  </div>
);

// --- ANA SAYFA ---

const HomePage = () => {
  const { user } = useAuth();
  const { profile, isPremium, refreshProfile, getTotalCredits } = useUser();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  // 🔥 DÜZELTME: startBackgroundMusic ARTIK YOK. Native otomatik hallediyor.
  // const { startBackgroundMusic } = useMusic(); <-- SİLİNDİ
  const { jokers, loadJokers } = useJokerInventory();

  usePremiumDailyRewards();

  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [matchmakingGameType, setMatchmakingGameType] = useState<"timed" | "score">("timed");
  const [matchmakingKey, setMatchmakingKey] = useState<number>(0);

  const [timeUntilNextCredit, setTimeUntilNextCredit] = useState<string>("");
  const [unlimitedTimeLeft, setUnlimitedTimeLeft] = useState<string>("");
  const [premiumTimeLeft, setPremiumTimeLeft] = useState<string>("");

  const { canPlay: canPlayMemory, timeUntilNextPlay } = useMemoryGame();
  const { startSearch, searchProgress, cancelSearch } = useMatchmaking();
  const [showAvatarView, setShowAvatarView] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [greeting] = useState(() => {
    const sessionGreeting = sessionStorage.getItem("sessionGreeting");
    if (sessionGreeting) return sessionGreeting;
    const newGreeting = getRandomGreeting();
    sessionStorage.setItem("sessionGreeting", newGreeting);
    return newGreeting;
  });

  const vipType = getVipType(profile);

  // --- HESAPLAMALAR ---
  const calculateLevel = (totalScore: number) => {
    const baseExp = 1000;
    const expIncreasePerLevel = 100;
    let level = 1;
    let totalExpNeeded = 0;
    let currentLevelExp = baseExp;

    while (totalScore >= totalExpNeeded + currentLevelExp) {
      totalExpNeeded += currentLevelExp;
      level++;
      currentLevelExp = baseExp + (level - 1) * expIncreasePerLevel;
    }
    return { level, experience: totalScore - totalExpNeeded, nextLevelExp: currentLevelExp };
  };

  const levelData = calculateLevel(profile?.total_score || 0);
  const progressPercent = (levelData.experience / levelData.nextLevelExp) * 100;

  const calculateUnlimitedTimeLeft = () => {
    if (!profile || !isUnlimitedLivesActive(profile)) {
      setUnlimitedTimeLeft("");
      return;
    }
    const now = new Date();
    const expiryDateString = (profile as any).unlimited_lives_until;
    if (!expiryDateString) return;

    const expiry = new Date(expiryDateString);
    if (now >= expiry) {
      setUnlimitedTimeLeft("");
      refreshProfile();
      return;
    }

    const timeDiff = expiry.getTime() - now.getTime();
    const totalSeconds = Math.floor(timeDiff / 1000);
    const days = Math.floor(totalSeconds / (3600 * 24));
    const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) setUnlimitedTimeLeft(`${days} Gün ${hours} Sa`);
    else {
      const h = hours.toString().padStart(2, "0");
      const m = minutes.toString().padStart(2, "0");
      const s = seconds.toString().padStart(2, "0");
      setUnlimitedTimeLeft(`${h}:${m}:${s}`);
    }
  };

  const calculatePremiumTimeLeft = () => {
    if (!profile?.premium_until) return setPremiumTimeLeft("");
    const now = new Date();
    const expiry = new Date(profile.premium_until);
    if (now >= expiry) return setPremiumTimeLeft("");

    const timeDiff = expiry.getTime() - now.getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    if (days > 0) setPremiumTimeLeft(`${days} Gün`);
    else {
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      setPremiumTimeLeft(`${hours}s ${minutes}d`);
    }
  };

  const calculateTimeUntilNextCredit = () => {
    if (!profile?.last_credit_refresh || isPremium || profile?.game_credits >= 5) {
      setTimeUntilNextCredit("");
      return;
    }
    const now = new Date();
    const lastRefresh = new Date(profile.last_credit_refresh);
    const nextRefresh = new Date(lastRefresh.getTime() + 72 * 60 * 1000);
    if (now >= nextRefresh) return setTimeUntilNextCredit("");
    const timeDiff = nextRefresh.getTime() - now.getTime();
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    setTimeUntilNextCredit(`${minutes}:${seconds.toString().padStart(2, "0")}`);
  };

  const refreshCredits = async () => {
    if (!user || isPremium) return;
    const currentCredits = profile?.game_credits || 0;
    if (currentCredits >= 5) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          game_credits: Math.min(currentCredits + 1, 5),
          last_credit_refresh: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (!error) {
        await refreshProfile();
        toast.success(`🎮 +1 Kredi eklendi!`);
        playSound("buttonClick");
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (profile && isUnlimitedLivesActive(profile)) {
      calculateUnlimitedTimeLeft();
      const interval = setInterval(calculateUnlimitedTimeLeft, 1000);
      return () => clearInterval(interval);
    } else setUnlimitedTimeLeft("");
  }, [profile]);

  useEffect(() => {
    if (profile?.premium_until) {
      calculatePremiumTimeLeft();
      const interval = setInterval(calculatePremiumTimeLeft, 60000);
      return () => clearInterval(interval);
    }
  }, [profile]);

  useEffect(() => {
    if (!isPremium && profile) {
      calculateTimeUntilNextCredit();
      const interval = setInterval(() => {
        calculateTimeUntilNextCredit();
        if (profile?.last_credit_refresh && !isPremium && profile.game_credits < 5) {
          const now = new Date();
          const nextRefresh = new Date(new Date(profile.last_credit_refresh).getTime() + 72 * 60 * 1000);
          if (now >= nextRefresh) {
            refreshCredits();
            setTimeout(() => refreshProfile(), 500);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [profile, isPremium]);

  // 🔥 DÜZELTME: Bu useEffect ARTIK GEREKSİZ. SİLİNDİ.
  /*
  useEffect(() => {
    startBackgroundMusic();
  }, [startBackgroundMusic]);
  */

  useEffect(() => {
    const checkDailyReset = async () => {
      if (!user || !profile) return;
      const today = new Date().toISOString().split("T")[0];
      const lastReset = profile.last_daily_reset
        ? new Date(profile.last_daily_reset).toISOString().split("T")[0]
        : null;
      if (lastReset !== today) await refreshProfile();
    };
    checkDailyReset();
  }, [user, profile?.last_daily_reset]);

  useEffect(() => {
    console.log("🏠 [HomePage] Mount - ilk veri yüklemesi...");
    refreshProfile(true);
    loadJokers();
  }, []);

  const handleGameModeClick = (modeId: string) => {
    playSound("buttonClick");
    if (
      !isPremium &&
      (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0 &&
      !isUnlimitedLivesActive(profile)
    ) {
      toast.error("Yetersiz oyun hakkı!", { description: "Oyun oynamak için hak satın alın." });
      navigate("/market");
      return;
    }
    if (modeId === "tournament") navigate("/tournament");
    else setSelectedMode(modeId);
  };

  const handleMatchFound = (roomId: string) => {
    setShowMatchmaking(false);
    if (roomId === "ai-game") navigate(`/game/vs-computer?type=${matchmakingGameType}`);
    else navigate(`/game/random-match?room=${roomId}&type=${matchmakingGameType}`);
  };

  // --- CONFIG ---
  const gameModesConfig = [
    {
      id: "random-match",
      title: "Rastgele Rakip",
      description: "Hızlı eşleşme",
      icon: Zap,
      gradient: "from-violet-500 via-purple-500 to-indigo-500",
      glowColor: "violet",
      isLive: true,
    },
    {
      id: "tournament",
      title: "Turnuva",
      description: "Büyük ödüller",
      icon: Trophy,
      gradient: "from-amber-400 via-orange-500 to-red-500",
      glowColor: "amber",
      isLive: false,
    },
    {
      id: "vs-computer",
      title: "Yapay Zeka",
      description: "Pratik yap",
      icon: Bot,
      gradient: "from-cyan-400 via-sky-500 to-blue-500",
      glowColor: "cyan",
      isLive: false,
    },
    {
      id: "private-room",
      title: "Özel Oda",
      description: "Arkadaşınla oyna",
      icon: Users,
      gradient: "from-emerald-400 via-green-500 to-teal-500",
      glowColor: "emerald",
      isLive: false,
    },
  ];

  const miniGamesConfig = [
    { id: "wheel", title: "Çark", icon: "🎡", color: "amber", route: "/wheel" },
    { id: "snake", title: "Yılan", icon: "🐍", color: "green", route: "/snake-game" },
    { id: "reactor", title: "Reaktör", icon: "☢️", color: "red", route: "/reactor-runner" },
    { id: "simon", title: "Takip", icon: "🎯", color: "indigo", route: "/grid-simon-says" },
    {
      id: "memory",
      title: "Hafıza",
      icon: "🧠",
      color: "purple",
      route: "/memory-game",
      disabled: !canPlayMemory,
      cooldown: timeUntilNextPlay,
    },
    { id: "neon", title: "Refleks", icon: "⚡", color: "cyan", route: "/neon-blitz" },
    { id: "morles", title: "Kule", icon: "🏗️", color: "teal", route: "/morles-game" },
    { id: "puzzle", title: "Puzzle", icon: "🧩", color: "blue", route: "/puzzle-game" },
  ];

  const totalCredits = getTotalCredits();

  // Seviyeye göre arka plan rengi
  const getLevelBackgroundColor = () => {
    const level = levelData.level;

    // Level 70+ (Siyah/Gri Tema)
    if (level >= 70)
      return {
        bg: "#E2E8F0",
        gradient: "from-slate-300/50",
      };

    // Level 40+ (Mavi Tema)
    if (level >= 40)
      return {
        bg: "#DBEAFE",
        gradient: "from-blue-200/50",
      };

    // Level 25+ (Yeşil Tema)
    if (level >= 25)
      return {
        bg: "#DCFCE7",
        gradient: "from-emerald-200/50",
      };

    // Level 10+ (Mor Tema)
    if (level >= 10)
      return {
        bg: "#F3E8FF",
        gradient: "from-purple-200/50",
      };

    // Varsayılan (Turuncu/Krem Tema)
    return {
      bg: "#FEF3C7",
      gradient: "from-orange-200/40",
    };
  };

  const levelBgColors = getLevelBackgroundColor();

  return (
    <div
      className="fixed inset-0 flex flex-col text-slate-800 font-sans selection:bg-amber-200 overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: levelBgColors.bg }}
    >
      {/* Light Effects */}
      <div
        className={`absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] ${levelBgColors.gradient} via-transparent to-transparent pointer-events-none transition-all duration-500`}
      />

      {/* --------------------------------------------------------
        SABİT ÜST ALAN (FIXED HEADER AREA) 
        flex-none ve z-30 kullanarak bu alanı yukarı sabitledik.
        --------------------------------------------------------
      */}
      <div
        className="flex-none z-30 pb-2 relative shadow-sm border-b border-slate-200 transition-colors duration-500"
        style={{ backgroundColor: levelBgColors.bg }}
      >
        {/* HEADER (Profil & Mürekkep) */}
        <div className="px-5 pt-6 pb-2 flex items-center justify-between">
          {/* Profil */}
          <div className="flex items-center gap-3" onClick={() => setShowAvatarView(true)}>
            <div className="relative">
              <div
                className={`w-12 h-12 rounded-full p-[2px] ${vipType ? "bg-gradient-to-tr from-amber-300 to-orange-500" : "bg-gradient-to-tr from-indigo-400 to-purple-500"}`}
              >
                {/* PROFIL FOTOSU: Border füme (slate-600) */}
                <Avatar className="w-full h-full border-2 border-slate-600">
                  <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} className="object-cover" />
                  <AvatarFallback className="bg-slate-200 text-slate-600 text-xs">U</AvatarFallback>
                </Avatar>
              </div>
              {isPremium && (
                <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-[#FFFDF5]">
                  <Crown className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight drop-shadow-sm text-slate-900">
                {profile?.username || "Misafir"}
              </h2>
              <p className="text-[10px] text-slate-500 font-medium">{greeting}</p>
            </div>
          </div>

          {/* Mürekkep */}
          <div
            onClick={() => {
              playSound("buttonClick");
              navigate("/market");
            }}
            className="flex items-center gap-2 bg-white border border-slate-600 rounded-full pl-1 pr-4 py-1.5 active:scale-95 transition-transform shadow-md cursor-pointer"
          >
            <div className="w-10 h-10 bg-indigo-50/50 rounded-full flex items-center justify-center">
              <img src="/murekkepikon.png" alt="ink" className="w-8 h-8 object-contain drop-shadow-sm" />
            </div>
            <span className="text-base font-bold text-slate-800">{profile?.ink_count || 0}</span>
            <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
              <span className="text-xs leading-none text-white font-bold">+</span>
            </div>
          </div>
        </div>

        {/* --- LEVEL VE XP KARTI --- */}
        <div className="px-5 mt-2">
          {(() => {
            const level = levelData.level;
            let starGradient = "from-amber-400 to-orange-500";
            let shadowColor = "shadow-orange-200";

            if (level >= 70) {
              starGradient = "from-slate-700 to-black";
              shadowColor = "shadow-slate-300";
            } else if (level >= 40) {
              starGradient = "from-blue-400 to-blue-600";
              shadowColor = "shadow-blue-200";
            } else if (level >= 25) {
              starGradient = "from-emerald-400 to-green-600";
              shadowColor = "shadow-green-200";
            } else if (level >= 10) {
              starGradient = "from-purple-500 to-indigo-600";
              shadowColor = "shadow-purple-200";
            }

            return (
              <div className="bg-white border border-slate-600 rounded-xl p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${starGradient} flex items-center justify-center shadow-md ${shadowColor}`}
                  >
                    <Star className="w-5 h-5 text-white fill-white" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">Seviye {level}</span>
                      <span className="text-[10px] text-slate-400">
                        ({levelData.experience} / {levelData.nextLevelExp} XP)
                      </span>
                    </div>

                    <div className="h-2.5 w-32 bg-slate-100 rounded-full mt-1 overflow-hidden border border-black">
                      <div
                        className={`h-full bg-gradient-to-r ${starGradient}`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Toplam Puan</span>
                  <span className="text-sm font-mono font-bold text-amber-600">
                    {(profile?.total_score || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* --- JOKERLER --- */}
        <div className="px-5 mt-3">
          <div className="bg-white rounded-xl p-3 border border-slate-600 flex justify-around shadow-sm">
            {[
              { img: "/degistirIkon.png", count: jokers.degistir, name: "Değiştir" },
              { img: "/fisildaIkon.png", count: jokers.fisilida, name: "Fısılda" },
              { img: "/senyazIkon.png", count: jokers.senYaz, name: "Sen Yaz" },
            ].map((j, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1 flex-1 active:scale-95 transition-transform cursor-pointer"
                onClick={() => navigate("/market")}
              >
                <img src={j.img} className="w-10 h-10 object-contain drop-shadow-sm" alt={j.name} />
                <span className="text-xs font-bold text-slate-500">x{j.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* INFO PANELS (SÜRE & HAK) */}
        <div className="px-5 mt-2 space-y-2">
          {isPremium && premiumTimeLeft && (
            <div
              className={`flex items-center justify-between rounded-xl p-3 px-4 shadow-lg border-2 ${
                vipType === "yearly"
                  ? "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 border-amber-600"
                  : vipType === "monthly"
                    ? "bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 border-blue-600"
                    : "bg-gradient-to-r from-amber-50 to-orange-50 border-slate-600"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`p-1.5 rounded-full ${
                    vipType === "yearly" || vipType === "monthly" ? "bg-white/30" : "bg-amber-100"
                  }`}
                >
                  <Crown
                    className={`w-5 h-5 ${
                      vipType === "yearly" || vipType === "monthly" ? "text-white" : "text-amber-500"
                    }`}
                  />
                </div>
                <div className="flex flex-col">
                  <span
                    className={`text-sm font-bold ${
                      vipType === "yearly" || vipType === "monthly" ? "text-white" : "text-amber-800"
                    }`}
                  >
                    {vipType === "yearly"
                      ? "⭐ VIP Yazar (Yıllık)"
                      : vipType === "monthly"
                        ? "💎 VIP Yazar (Aylık)"
                        : "VIP Yazar"}
                  </span>
                  <span
                    className={`text-[10px] ${
                      vipType === "yearly" || vipType === "monthly" ? "text-white/80" : "text-amber-600"
                    }`}
                  >
                    Sınırsız hak • Günlük joker • 2x XP
                  </span>
                </div>
              </div>
              <div
                className={`px-2 py-1 rounded-lg ${
                  vipType === "yearly" || vipType === "monthly" ? "bg-white/20" : "bg-amber-100"
                }`}
              >
                <span
                  className={`text-xs font-mono font-bold ${
                    vipType === "yearly" || vipType === "monthly" ? "text-white" : "text-amber-600"
                  }`}
                >
                  {premiumTimeLeft}
                </span>
              </div>
            </div>
          )}

          {(!isPremium || isUnlimitedLivesActive(profile)) && (
            <div className="flex items-center justify-between bg-white border border-slate-600 rounded-xl p-2 px-3 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">
                {isUnlimitedLivesActive(profile) ? "Sınırsız Akış" : "Kalan Sayfalarım"}
              </span>

              {isUnlimitedLivesActive(profile) ? (
                <div className="flex items-center gap-2">
                  {unlimitedTimeLeft ? (
                    <div className="flex items-center gap-1.5 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                      <Clock className="w-3 h-3 text-indigo-500 animate-pulse" />
                      <span className="text-xs font-mono font-bold text-indigo-600 tabular-nums">
                        {unlimitedTimeLeft}
                      </span>
                    </div>
                  ) : (
                    <div className="w-16 h-5 bg-slate-100 rounded animate-pulse" />
                  )}
                  <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-2 py-0.5">
                    Sınırsız
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {totalCredits > 5 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 opacity-50">
                        {Array.from({ length: 5 }, (_, i) => (
                          <div key={i} className="w-6 h-2 rounded-sm bg-green-500 skew-x-[-10deg]" />
                        ))}
                      </div>
                      <Badge className="bg-green-500 hover:bg-green-600 text-white border-0 text-xs px-2 py-0.5 shadow-sm">
                        + {totalCredits - 5} Sayfa
                      </Badge>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div
                          key={i}
                          className={`w-6 h-2 rounded-sm skew-x-[-10deg] transition-all duration-300 ${i < totalCredits ? "bg-green-500" : "bg-slate-200"}`}
                        />
                      ))}
                    </div>
                  )}

                  {timeUntilNextCredit && totalCredits < 5 && (
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-1 rounded">
                      {timeUntilNextCredit}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* HEDİYE BANNER */}
        {isPremium && isGiftPremium(profile) && (
          <div className="px-5 mt-4">
            <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden shadow-lg shadow-pink-200">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md z-10">
                <Gift className="w-5 h-5 text-white animate-bounce" />
              </div>
              <div className="flex-1 z-10">
                <h3 className="text-sm font-bold text-white">Hediye Premium!</h3>
                <p className="text-[10px] text-white/90">
                  Kalan: {new Date(profile.premium_until).toLocaleDateString("tr-TR")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --------------------------------------------------------
        KAYDIRILABİLİR ALAN (SCROLLABLE CONTENT) 
        --------------------------------------------------------
      */}
      <div
        className={`flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative z-10 pb-24 transition-all duration-300 ${isMenuOpen ? "blur-sm scale-[0.98]" : ""}`}
      >
        {/* OYUN MODLARI */}
        <div className="px-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-indigo-500" />
              Oyun Modları
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {gameModesConfig.map((mode) => (
              <GameModeCard key={mode.id} mode={mode} onClick={() => handleGameModeClick(mode.id)} />
            ))}
          </div>
        </div>

        {/* MINI OYUNLAR */}
        <div className="mt-6 pl-5">
          <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Mini Oyunlar
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-4 pr-5 scrollbar-hide">
            {miniGamesConfig.map((game) => (
              <div
                key={game.id}
                onClick={() => {
                  playSound("buttonClick");
                  navigate(game.route);
                }}
                className={`flex-shrink-0 w-20 flex flex-col items-center gap-2 cursor-pointer group ${game.disabled ? "opacity-50 grayscale" : ""}`}
              >
                <div
                  className={`w-16 h-16 rounded-2xl bg-white border border-slate-600 flex items-center justify-center text-2xl shadow-sm relative overflow-hidden group-active:scale-95 transition-transform`}
                >
                  <div
                    className={`absolute inset-0 bg-${game.color}-500/5 opacity-0 group-hover:opacity-100 transition-opacity`}
                  />
                  {game.icon}
                </div>
                <span className="text-[10px] font-medium text-slate-600 text-center leading-tight">
                  {game.title}
                  {game.disabled && game.cooldown && (
                    <span className="block text-[9px] text-red-400 mt-0.5">{game.cooldown}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* İSTATİSTİKLER */}
        <div className="px-5 mt-2 pb-6">
          <div className="flex gap-3">
            <StatWidget icon={Target} value={profile?.daily_games || 0} label="Oyun" colorClass="indigo" />
            <StatWidget icon={Flame} value={profile?.win_streak || 0} label="Seri" colorClass="orange" />
            <StatWidget icon={Trophy} value={profile?.wins || 0} label="Zafer" colorClass="amber" />
          </div>
        </div>
      </div>

      {/* --- MODALLAR --- */}
      {selectedMode && selectedMode === "private-room" ? (
        <PrivateRoomModal
          onClose={() => setSelectedMode(null)}
          onStartGame={(matchId, type) => {
            setSelectedMode(null);
            navigate(`/game/random-match?room=${matchId}&type=${type}`);
          }}
        />
      ) : selectedMode ? (
        <GameModeSelector
          mode={selectedMode}
          onStart={(type) => {
            if (selectedMode === "tournament") navigate("/tournament", { state: { gameType: type } });
            else if (selectedMode === "random-match") {
              setMatchmakingGameType(type);
              setMatchmakingKey(Date.now());
              setShowMatchmaking(true);
              setTimeout(() => startSearch(type), 100);
            } else navigate(`/game/${selectedMode}?type=${type}`);
            setSelectedMode(null);
          }}
          onClose={() => setSelectedMode(null)}
        />
      ) : null}

      {showMatchmaking && (
        <div className="fixed inset-0 z-[9999] bg-[#FFFDF5]">
          <SlotMatchmaking
            key={`matchmaking-${matchmakingKey}`}
            onCancel={() => {
              cancelSearch();
              setShowMatchmaking(false);
            }}
            searchProgress={searchProgress}
          />
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50">
        <FloatingMenu onOpenChange={setIsMenuOpen} />
      </div>

      <AvatarViewDialog
        open={showAvatarView}
        onOpenChange={setShowAvatarView}
        avatarUrl={profile?.avatar_url || user?.user_metadata?.avatar_url || ""}
        username={profile?.username || "Oyuncu"}
      />
    </div>
  );
};

export default HomePage;
