import { useState, useEffect, memo, useCallback, useMemo } from "react";
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
// useMemoryGame artık MiniGamesPage'de kullanılıyor
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";
import GameModeSelector from "@/components/GameModeSelector";
import { FloatingMenu } from "@/components/FloatingMenu";
import LeaderboardPrizeDialog from "@/components/LeaderboardPrizeDialog";
import ChallengePrizeDialog from "@/components/ChallengePrizeDialog";
import { useSearchingPlayersCount } from "@/hooks/useSearchingPlayersCount";

import {
  Bot,
  Users,
  Trophy,
  Clock,
  Target,
  Crown,
  Zap,
  Gift,
  Star,
  Flame,
  Gamepad2,
  Sparkles,
  Check,
} from "lucide-react";
import { getDailyChallengeStatus, ChallengeType } from "@/hooks/useDailyChallenge";

// --- YARDIMCI SABİTLER ---

const greetingMessages = [
  "Sahne senin! 🌟",
  "Bugün şanslı günün! 🍀",
  "Enerjin harika! ⚡",
  "Rekor kırmaya hazır mısın? 🚀",
  "Şampiyon geldi! 👑",
  "Mükemmel gözüküyorsun 🧿",
  "Zihinler hazırsa başlıyoruz! 🧠",
  "Bugün skor tabelası yanacak! 🔥",
  "Hızına kimse yetişemez! 💨",
  "Efsane bir oyun seni bekliyor! 🎯",
  "Odak moduna geç! 🎧",
  "Rakipler titreyecek! 😎",
  "Bugün fark atma günü! 💥",
  "Kontrol sende! 🎮",
  "Stratejini konuştur! ♟️",
  "Bu tur senin turun! 🔄",
  "Şimdi göster kendini! 💪",
  "Skorları alt üst et! 📊",
  "Hazırsan zaman başlıyor! ⏳",
  "Bugün zirveye oynuyoruz! 🏆",
  "Seri başlasın! 🔁",
  "Reflekslerine güven! ⚔️",
  "Büyük hamle zamanı! 🎲",
  "Mod: Kazanma 🔓",
  "Bugün MVP sensin! ⭐",
  "Hedef: Rekor! 🎯",
  "Oyun seni bekliyordu! 👀",
  "Başarı senin ikinci adın! 🏅",
  "Bir efsane doğuyor... 🌌",
  "Tam isabet zamanı! 🎯",
  "Bugün kimse seni durduramaz! 🛑",
  "Zirve modu aktif! 🚨",
  "Hadi tarih yazalım! 📖",
];

const getRandomGreeting = () =>
  greetingMessages[Math.floor(Math.random() * greetingMessages.length)].toLocaleUpperCase("tr-TR");

const isGiftPremium = (profile: any) => {
  if (!profile?.premium_until) return false;
  const premiumUntil = new Date(profile.premium_until);
  const createdAt = new Date(profile.created_at);
  // 🔧 FIX: Math.floor kullanarak tutarlı hesaplama
  const daysDiff = Math.floor((premiumUntil.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 6 && daysDiff <= 8 && premiumUntil > new Date();
};

const isUnlimitedLivesActive = (profile: any) => {
  if (!profile?.unlimited_lives_until) return false;
  const expiry = new Date(profile.unlimited_lives_until);
  return expiry > new Date();
};

// 2 saatten fazla kaldıysa "maraton" (24h), değilse "kısa" (1h)
const getUnlimitedType = (profile: any): "maraton" | "short" | null => {
  if (!profile?.unlimited_lives_until) return null;
  const expiry = new Date(profile.unlimited_lives_until);
  const now = new Date();
  if (expiry <= now) return null;
  const hoursLeft = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursLeft > 2 ? "maraton" : "short";
};

const getVipType = (profile: any): "yearly" | "monthly" | "short" | null => {
  if (!profile?.premium_until) return null;
  const now = new Date();
  const premiumUntil = new Date(profile.premium_until);
  if (premiumUntil <= now) return null;
  // 🔧 FIX: Math.floor kullanarak tutarlı hesaplama
  const daysRemaining = Math.floor((premiumUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysRemaining >= 300) return "yearly";
  if (daysRemaining >= 25) return "monthly";
  return "short";
};

// --- BİLEŞENLER ---

const StatWidget = memo(({ icon: Icon, value, label, colorClass }: any) => (
  <div className="flex-1 bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-3 flex flex-col items-center justify-center relative overflow-hidden group">
    <Icon className={`w-5 h-5 mb-1 text-${colorClass}-400`} />
    <span className="text-lg font-bold text-white tracking-tight">{value}</span>
    <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide opacity-80">{label}</span>
  </div>
));
StatWidget.displayName = "StatWidget";

const GameModeCard = memo(({ mode, onClick, searchingCount }: any) => (
  <div
    onClick={onClick}
    className={`relative group cursor-pointer rounded-3xl p-4 h-32 flex flex-col justify-between transition-transform duration-200 active:scale-[0.97] border border-slate-600`}
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
        <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-[10px] px-2 py-0.5">CANLI</Badge>
      )}
    </div>

    <div className="relative z-10">
      <h3 className="text-lg font-bold text-white leading-none mb-1 drop-shadow-md">{mode.title}</h3>
      <p className="text-[11px] text-white/80 font-medium line-clamp-1">{mode.description}</p>
      {mode.id === "random-match" && searchingCount > 0 && (
        <div className="mt-1 inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-white font-medium">{searchingCount} kişi arıyor</span>
        </div>
      )}
    </div>
  </div>
));
GameModeCard.displayName = "GameModeCard";

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

  // useMemoryGame taşındı
  const { startSearch, searchProgress, cancelSearch } = useMatchmaking();
  const [showAvatarView, setShowAvatarView] = useState(false);

  const [challengeStatus, setChallengeStatus] = useState<Record<ChallengeType, boolean>>(() => {
    try {
      const cached = sessionStorage.getItem("challengeStatus");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed._date === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })) {
          return parsed;
        }
      }
    } catch {}
    return {
      word_hunt: false,
      anagram: false,
      word_chain: false,
      puzzle: false,
      reaktor: false,
      neon_blitz: false,
      memory: false,
    };
  });
  const [wheelSpinsLeft, setWheelSpinsLeft] = useState<number | null>(() => {
    try {
      const cached = sessionStorage.getItem("wheelSpinsLeft");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed._date === new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })) {
          return parsed.spins;
        }
      }
    } catch {}
    return null;
  });

  // Fetch daily challenge completion status & wheel spin availability
  useEffect(() => {
    if (!user?.id) return;
    const fetchChallengeStatus = () => {
      sessionStorage.removeItem("challengeStatus");
      getDailyChallengeStatus(user.id).then((status) => {
        const withDate = { ...status, _date: new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) };
        sessionStorage.setItem("challengeStatus", JSON.stringify(withDate));
        setChallengeStatus(status);
      });
    };
    fetchChallengeStatus();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchChallengeStatus();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Check wheel spins
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    supabase
      .from("wheel_spins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle()
      .then(({ data: spinData }) => {
        const dailyAvailable = !spinData ? 1 : 0;
        const bonus = profile?.bonus_spins || 0;
        const total = dailyAvailable + bonus;
        setWheelSpinsLeft(total);
        sessionStorage.setItem("wheelSpinsLeft", JSON.stringify({ spins: total, _date: today }));
      });

    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user?.id, profile?.bonus_spins]);

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
    let level = 1;
    let totalExpNeeded = 0;
    let currentLevelExp = 1000;

    while (totalScore >= totalExpNeeded + currentLevelExp) {
      totalExpNeeded += currentLevelExp;
      level++;
      currentLevelExp = level * 1000;
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
    // 🔧 FIX: Tutarlı hesaplama - kalan tam günleri göster
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const remainingHours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    // Eğer 1+ gün kaldıysa, gün ve saat olarak göster
    if (days > 0) {
      if (remainingHours > 0) {
        setPremiumTimeLeft(`${days} Gün ${remainingHours}s`);
      } else {
        setPremiumTimeLeft(`${days} Gün`);
      }
    } else {
      // Son gün - saat ve dakika göster
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      setPremiumTimeLeft(`${remainingHours}s ${minutes}d`);
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
    // loadJokers() kaldırıldı - useJokerInventory hook'u zaten mount'ta çağırıyor
  }, []);

  const handleGameModeClick = useCallback(
    (modeId: string) => {
      playSound("buttonClick");
      if (
        !isPremium &&
        (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0 &&
        !isUnlimitedLivesActive(profile)
      ) {
        toast.error("Oyun için yeterli sayfan yok!", { description: "Oyun oynamak için sayfa satın alın." });
        navigate("/market");
        return;
      }
      if (modeId === "tournament") navigate("/tournament");
      else setSelectedMode(modeId);
    },
    [playSound, isPremium, profile?.game_credits, profile?.bonus_credits, profile?.unlimited_lives_until, navigate],
  );

  const handleMatchFound = (roomId: string) => {
    setShowMatchmaking(false);
    if (roomId === "ai-game") navigate(`/game/vs-computer?type=${matchmakingGameType}`);
    else navigate(`/game/random-match?room=${roomId}&type=${matchmakingGameType}`);
  };

  // --- CONFIG ---
  const gameModesConfig = useMemo(
    () => [
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
    ],
    [],
  );

  // miniGamesConfig artık MiniGamesPage'e taşındı

  const totalCredits = getTotalCredits();

  // Seviyeye göre arka plan rengi (çift tonlu gradient)
  const getLevelBackgroundColor = () => {
    return {
      bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", // index.html renkleri
      gradient: "from-[#ff6b6b]/40", // Şeffaflığı %20'den %40'a çıkardık
      headerBg: "#1a1a2e",
    };

    /*
    const level = levelData.level;

    if (level >= 70) 
      return { bg: "linear-gradient(135deg, #CFD8DC 0%, #B0BEC5 100%)", gradient: "from-slate-300/60", headerBg: "#C0CCD3" }; 
    if (level >= 40) 
      return { bg: "linear-gradient(135deg, #BFDBFE 0%, #93C5FD 100%)", gradient: "from-blue-300/60", headerBg: "#A9D0FE" }; 
    if (level >= 25) 
      return { bg: "linear-gradient(135deg, #BBF7D0 0%, #86EFAC 100%)", gradient: "from-emerald-300/60", headerBg: "#A0F3BE" }; 
    if (level >= 10) 
      return { bg: "linear-gradient(135deg, #E9D5FF 0%, #D8B4FE 100%)", gradient: "from-purple-300/60", headerBg: "#E0C5FE" }; 
    return { bg: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)", gradient: "from-orange-200/50", headerBg: "#FEEDA6" };
    */
  };

  const levelBgColors = getLevelBackgroundColor();

  return (
    <>
      <LeaderboardPrizeDialog />
      <ChallengePrizeDialog />
      <div
        className="fixed inset-0 flex flex-col text-slate-100 font-sans selection:bg-indigo-500/30 overflow-hidden transition-colors duration-500"
        style={{ background: levelBgColors.bg || "#1a1a2e" }}
      >
        {/* Light Effects */}
        <div
          className={`absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] ${levelBgColors.gradient} via-transparent to-transparent pointer-events-none transition-all duration-500 opacity-30`}
        />

        {/* --------------------------------------------------------
        SABİT ÜST ALAN (FIXED HEADER AREA) 
      -------------------------------------------------------- */}
        <div
          className="flex-none z-30 pb-4 relative border-b border-white/5"
          style={{ backgroundColor: levelBgColors.headerBg || "transparent" }}
        >
          {/* HEADER (Profil & Mürekkep) */}
          <div className="px-5 pt-6 pb-2 flex items-center justify-between">
            {/* Profil */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowAvatarView(true)}>
              <div className="relative">
                <div
                  className={`w-12 h-12 rounded-full p-[2px] ${vipType ? "bg-gradient-to-tr from-amber-300 to-orange-500" : "bg-gradient-to-tr from-indigo-400 to-purple-500"}`}
                >
                  <Avatar className="w-full h-full border-2 border-[#1a1a2e]">
                    <AvatarImage
                      src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-slate-800 text-slate-400 text-xs">U</AvatarFallback>
                  </Avatar>
                </div>
                {isPremium && (
                  <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-[#1a1a2e]">
                    <Crown className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight text-white drop-shadow-md">
                  {profile?.username || "Misafir"}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{greeting}</p>
              </div>
            </div>

            {/* Mürekkep */}
            <div
              onClick={() => {
                playSound("buttonClick");
                navigate("/market");
              }}
              className="flex items-center gap-2 bg-[#1e2d45] border border-indigo-500/20 rounded-full pl-1 pr-4 py-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center">
                <img src="/murekkepikon.png" alt="ink" className="w-7 h-7 object-contain brightness-110" />
              </div>
              <span className="text-base font-bold text-white">{profile?.ink_count || 0}</span>
              <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center ml-1">
                <span className="text-xs leading-none text-white font-bold">+</span>
              </div>
            </div>
          </div>

          {/* --- LEVEL VE XP KARTI --- */}
          <div className="px-5 mt-2">
            {(() => {
              const level = levelData.level;
              let starGradient = "from-amber-400 to-orange-500";
              let shadowColor = "shadow-orange-500/20";

              if (level >= 70) {
                starGradient = "from-slate-400 to-slate-600";
                shadowColor = "shadow-slate-500/20";
              } else if (level >= 40) {
                starGradient = "from-blue-400 to-blue-600";
                shadowColor = "shadow-blue-500/20";
              } else if (level >= 25) {
                starGradient = "from-emerald-400 to-green-600";
                shadowColor = "shadow-green-500/20";
              } else if (level >= 10) {
                starGradient = "from-purple-500 to-indigo-600";
                shadowColor = "shadow-purple-500/20";
              }

              return (
                <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${starGradient} flex items-center justify-center`}
                    >
                      <Star className="w-6 h-6 text-white fill-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Seviye {level}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {levelData.experience}/{levelData.nextLevelExp} XP
                        </span>
                      </div>
                      <div className="h-2 w-32 bg-slate-800 rounded-full mt-2 overflow-hidden border border-white/5">
                        <div
                          className={`h-full bg-gradient-to-r ${starGradient} transition-all duration-1000`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block uppercase tracking-[0.1em] mb-1">Puan</span>
                    <span className="text-sm font-mono font-bold text-red-500">
                      {(profile?.total_score || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* --- JOKERLER --- */}
          <div className="px-5 mt-3">
            <div className="bg-[#1e2d45] rounded-2xl p-3 border border-indigo-500/20 flex justify-around">
              {[
                { img: "/degistirIkon.png", count: jokers.degistir, name: "Değiştir" },
                { img: "/fisildaIkon.png", count: jokers.fisilida, name: "Fısılda" },
                { img: "/senyazIkon.png", count: jokers.senYaz, name: "Sen Yaz" },
              ].map((j, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 flex-1 active:scale-90 transition-transform cursor-pointer group"
                  onClick={() => navigate("/market")}
                >
                  <img
                    src={j.img}
                    className="w-9 h-9 object-contain drop-shadow-lg group-hover:brightness-125 transition-all"
                    alt={j.name}
                  />
                  <span className="text-[10px] font-bold text-slate-400">x{j.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* INFO PANELS (SÜRE & HAK) */}
          <div className="px-5 mt-2 space-y-2">
            {isPremium && premiumTimeLeft && (
              <div
                className={`flex items-center justify-between rounded-xl p-3 px-4 border-2 ${
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
              <div
                className={`flex items-center justify-between backdrop-blur-md border rounded-xl p-2 px-3 ${
                  isUnlimitedLivesActive(profile)
                    ? getUnlimitedType(profile) === "maraton"
                      ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30"
                      : "bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/30"
                    : "bg-[#1e2d45] border-indigo-500/20"
                }`}
              >
                <span
                  className={`text-xs font-medium ${
                    isUnlimitedLivesActive(profile)
                      ? getUnlimitedType(profile) === "maraton"
                        ? "text-amber-400"
                        : "text-blue-400"
                      : "text-slate-500"
                  }`}
                >
                  {isUnlimitedLivesActive(profile)
                    ? getUnlimitedType(profile) === "maraton"
                      ? "🔥 Maraton Modu"
                      : "⚡ Sınırsız Akış"
                    : "Kalan Sayfalarım"}
                </span>

                {isUnlimitedLivesActive(profile) ? (
                  <div className="flex items-center gap-2">
                    {unlimitedTimeLeft ? (
                      <div
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border ${
                          getUnlimitedType(profile) === "maraton"
                            ? "bg-amber-500/20 border-amber-500/30"
                            : "bg-blue-500/20 border-blue-500/30"
                        }`}
                      >
                        <Clock
                          className={`w-3 h-3 animate-pulse ${
                            getUnlimitedType(profile) === "maraton" ? "text-amber-400" : "text-blue-400"
                          }`}
                        />
                        <span
                          className={`text-xs font-mono font-bold tabular-nums ${
                            getUnlimitedType(profile) === "maraton" ? "text-amber-300" : "text-blue-300"
                          }`}
                        >
                          {unlimitedTimeLeft}
                        </span>
                      </div>
                    ) : (
                      <div className="w-16 h-5 bg-slate-700 rounded animate-pulse" />
                    )}
                    <Badge
                      className={`text-[10px] px-2 py-0.5 border ${
                        getUnlimitedType(profile) === "maraton"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      }`}
                    >
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
              <div className="bg-gradient-to-r from-pink-500 to-rose-500 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
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
      -------------------------------------------------------- */}
        <div className="flex-1 flex flex-col overflow-y-auto relative z-10 pb-28">
          {/* OYUN MODLARI */}
          <div className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-indigo-500 rounded-full" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Oyun Modları</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {gameModesConfig.map((mode) => (
                <GameModeCard key={mode.id} mode={mode} onClick={() => handleGameModeClick(mode.id)} />
              ))}
            </div>
          </div>

          {/* GÜNLÜK CHALLENGE'LAR */}
          <div className="mt-6 pl-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-amber-500 rounded-full" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Düello & Görev</h3>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 pr-5 scrollbar-hide">
              {/* Kelime Puzzle */}
              <div
                onClick={() => {
                  playSound("buttonClick");
                  navigate("/challenge/puzzle");
                }}
                className={`flex-shrink-0 w-56 rounded-3xl p-4 h-36 flex flex-col justify-between border relative overflow-hidden cursor-pointer group active:scale-[0.97] transition-transform ${challengeStatus.puzzle ? "border-amber-400/40 " : "border-white/10"}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-yellow-600/70 via-amber-500/60 to-yellow-700/70 ${challengeStatus.puzzle ? "opacity-50 grayscale-[30%]" : "opacity-90 group-hover:opacity-100"} rounded-3xl`}
                />
                <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-7xl font-bungee text-white/10 select-none pointer-events-none z-[1] drop-shadow-lg">
                  1
                </span>
                <div className="relative z-10 flex justify-between items-start">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner">
                    {challengeStatus.puzzle ? <Check className="w-6 h-6 text-amber-300" /> : "🧩"}
                  </div>
                  <Badge
                    className={`text-[9px] px-2 py-0.5 ${challengeStatus.puzzle ? "bg-amber-400/30 text-amber-200 border-amber-400/40" : "bg-amber-400/20 text-amber-200 border-amber-400/30"}`}
                  >
                    {challengeStatus.puzzle ? "✓ Tamamlandı" : "Oyna"}
                  </Badge>
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-bold text-white leading-none mb-1 drop-shadow-md">Kelime Puzzle</h3>
                  <p className="text-[10px] text-white/70 font-medium">
                    {challengeStatus.puzzle ? "Yarın tekrar gel!" : "Harfleri sıraya diz"}
                  </p>
                </div>
              </div>

              {/* Reaktör */}
              <div
                onClick={() => {
                  playSound("buttonClick");
                  navigate("/challenge/reaktor");
                }}
                className={`flex-shrink-0 w-56 rounded-3xl p-4 h-36 flex flex-col justify-between border relative overflow-hidden cursor-pointer group active:scale-[0.97] transition-transform ${challengeStatus.reaktor ? "border-amber-400/40 " : "border-white/10"}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-yellow-600/70 via-amber-500/60 to-yellow-700/70 ${challengeStatus.reaktor ? "opacity-50 grayscale-[30%]" : "opacity-90 group-hover:opacity-100"} rounded-3xl`}
                />
                <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-7xl font-bungee text-white/10 select-none pointer-events-none z-[1] drop-shadow-lg">
                  2
                </span>
                <div className="relative z-10 flex justify-between items-start">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner">
                    {challengeStatus.reaktor ? <Check className="w-6 h-6 text-amber-300" /> : "☢️"}
                  </div>
                  <Badge
                    className={`text-[9px] px-2 py-0.5 ${challengeStatus.reaktor ? "bg-amber-400/30 text-amber-200 border-amber-400/40" : "bg-amber-400/20 text-amber-200 border-amber-400/30"}`}
                  >
                    {challengeStatus.reaktor ? "✓ Tamamlandı" : "Oyna"}
                  </Badge>
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-bold text-white leading-none mb-1 drop-shadow-md">Reaktör Koşusu</h3>
                  <p className="text-[10px] text-white/70 font-medium">
                    {challengeStatus.reaktor ? "Yarın tekrar gel!" : "Koş ve harfleri topla"}
                  </p>
                </div>
              </div>

              {/* Refleks (Neon Blitz) */}
              <div
                onClick={() => {
                  playSound("buttonClick");
                  navigate("/challenge/neon-blitz");
                }}
                className={`flex-shrink-0 w-56 rounded-3xl p-4 h-36 flex flex-col justify-between border relative overflow-hidden cursor-pointer group active:scale-[0.97] transition-transform ${challengeStatus.neon_blitz ? "border-amber-400/40 " : "border-white/10"}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-yellow-600/70 via-amber-500/60 to-yellow-700/70 ${challengeStatus.neon_blitz ? "opacity-50 grayscale-[30%]" : "opacity-90 group-hover:opacity-100"} rounded-3xl`}
                />
                <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-7xl font-bungee text-white/10 select-none pointer-events-none z-[1] drop-shadow-lg">
                  3
                </span>
                <div className="relative z-10 flex justify-between items-start">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner">
                    {challengeStatus.neon_blitz ? <Check className="w-6 h-6 text-amber-300" /> : "⚡"}
                  </div>
                  <Badge
                    className={`text-[9px] px-2 py-0.5 ${challengeStatus.neon_blitz ? "bg-amber-400/30 text-amber-200 border-amber-400/40" : "bg-amber-400/20 text-amber-200 border-amber-400/30"}`}
                  >
                    {challengeStatus.neon_blitz ? "✓ Tamamlandı" : "Oyna"}
                  </Badge>
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-bold text-white leading-none mb-1 drop-shadow-md">Refleks</h3>
                  <p className="text-[10px] text-white/70 font-medium">
                    {challengeStatus.neon_blitz ? "Yarın tekrar gel!" : "Hızını test et"}
                  </p>
                </div>
              </div>

              {/* Hafıza Oyunu */}
              <div
                onClick={() => {
                  playSound("buttonClick");
                  navigate("/challenge/memory");
                }}
                className={`flex-shrink-0 w-56 rounded-3xl p-4 h-36 flex flex-col justify-between border relative overflow-hidden cursor-pointer group active:scale-[0.97] transition-transform ${challengeStatus.memory ? "border-amber-400/40 " : "border-white/10"}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br from-yellow-600/70 via-amber-500/60 to-yellow-700/70 ${challengeStatus.memory ? "opacity-50 grayscale-[30%]" : "opacity-90 group-hover:opacity-100"} rounded-3xl`}
                />
                <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-7xl font-bungee text-white/10 select-none pointer-events-none z-[1] drop-shadow-lg">
                  4
                </span>
                <div className="relative z-10 flex justify-between items-start">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner">
                    {challengeStatus.memory ? <Check className="w-6 h-6 text-amber-300" /> : "🧠"}
                  </div>
                  <Badge
                    className={`text-[9px] px-2 py-0.5 ${challengeStatus.memory ? "bg-amber-400/30 text-amber-200 border-amber-400/40" : "bg-amber-400/20 text-amber-200 border-amber-400/30"}`}
                  >
                    {challengeStatus.memory ? "✓ Tamamlandı" : "Oyna"}
                  </Badge>
                </div>
                <div className="relative z-10">
                  <h3 className="text-sm font-bold text-white leading-none mb-1 drop-shadow-md">Kelime Hafıza</h3>
                  <p className="text-[10px] text-white/70 font-medium">
                    {challengeStatus.memory ? "Yarın tekrar gel!" : "Kelimeleri eşleştir"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* GÜNLÜK ÇARK */}
          <div className="px-5 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-red-500 rounded-full" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Şans Çarkı</h3>
            </div>
            <div
              onClick={() => {
                playSound("buttonClick");
                navigate("/wheel");
              }}
              className={`w-full rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden cursor-pointer group active:scale-[0.97] transition-transform border ${
                wheelSpinsLeft === 0 ? "border-red-400/40 opacity-70" : "border-red-500/30"
              }`}
            >
              <div
                className={`absolute inset-0 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 ${
                  wheelSpinsLeft === 0 ? "opacity-50 grayscale-[30%]" : "opacity-90 group-hover:opacity-100"
                } transition-opacity rounded-2xl`}
              />
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl shadow-inner">
                {wheelSpinsLeft === 0 ? <Check className="w-6 h-6 text-red-300" /> : "🎡"}
              </div>
              <div className="relative z-10 flex-1">
                <h3 className="text-base font-bold text-white leading-none mb-1 drop-shadow-md">
                  {wheelSpinsLeft === 0 ? "Çark Çevrildi" : "Şansını Dene!"}
                </h3>
                <p className="text-[10px] text-white/70 font-medium">
                  {wheelSpinsLeft === 0 ? "Yarın tekrar gel!" : "Çarkı çevir, ödüller kazan!"}
                </p>
              </div>
              {wheelSpinsLeft !== null && wheelSpinsLeft > 0 && (
                <Badge className="relative z-10 text-[9px] px-2 py-0.5 bg-white/20 text-white border-white/30">
                  x{wheelSpinsLeft} hak
                </Badge>
              )}
            </div>
          </div>

          {/* İSTATİSTİKLER */}
          <div className="px-5 mt-6 pb-12">
            {" "}
            {/* Alt boşluğu biraz artırdım, menüye girmesin */}
            <div className="grid grid-cols-3 gap-3">
              <StatWidget
                icon={Target}
                value={profile?.daily_games || 0}
                label="Oyun"
                colorClass="rose"
                // !bg-[#16213e] kullanarak içindeki beyazı zorla eziyoruz
                className="!bg-[#16213e] !border-white/10 !text-white"
              />
              <StatWidget
                icon={Flame}
                value={profile?.win_streak || 0}
                label="Seri"
                colorClass="orange"
                className="!bg-[#16213e] !border-white/10 !text-white"
              />
              <StatWidget
                icon={Trophy}
                value={profile?.wins || 0}
                label="Zafer"
                colorClass="amber"
                className="!bg-[#16213e] !border-white/10 !text-white"
              />
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
          <div className="fixed inset-0 z-[9999] bg-[#1a1a2e]">
            {" "}
            {/* Flashbang etkisini önlemek için koyu arka plan */}
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
          <FloatingMenu />
        </div>

        <AvatarViewDialog
          open={showAvatarView}
          onOpenChange={setShowAvatarView}
          avatarUrl={profile?.avatar_url || user?.user_metadata?.avatar_url || ""}
          username={profile?.username || "Oyuncu"}
        />
      </div>
    </>
  );
};

export default HomePage;
