import { useState, useEffect, useRef } from "react";
import { useMusic } from "@/contexts/MusicContext";
import { useGame } from "@/contexts/GameContext";
import GameModeSelector from "@/components/GameModeSelector";
import { FloatingMenu } from "@/components/FloatingMenu";
// HeaderAnimation kaldırıldı - import { HeaderAnimation } from "@/components/HeaderAnimation";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PrivateRoomModal from "@/components/PrivateRoomModal";
import { SlotMatchmaking } from "@/components/SlotMatchmaking";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useJokerInventory } from "@/hooks/useJokerInventory";
import { Brain, Grid3X3, Lock, Shield } from "lucide-react";
import { useMemoryGame } from "@/hooks/useMemoryGame";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { nakamaService } from "@/services/nakamaService";
import { useUserRole } from "@/hooks/useUserRole";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";

// DÜZELTME 1: Infinity ikonu importlara eklendi
import {
  Bot,
  Users,
  Trophy,
  Clock,
  Target,
  User,
  Crown,
  Zap,
  Camera,
  Gift,
  Sparkles,
  RotateCcw,
  Infinity,
} from "lucide-react";

// Pozitif selamlama mesajları
const greetingMessages = [
  "Harika görünüyorsun! 🌟",
  "Bugün şanslı gününüz! 🍀",
  "Mükemmel bir gün! ✨",
  "Enerjiniz çok yüksek! ⚡",
  "Harika bir başlangıç! 🚀",
  "Bugün kazanma günün! 🏆",
  "Muhteşem görünüyorsun! 💫",
  "İnanılmaz bir enerji! 🔥",
  "Kazanmaya hazır mısın? 🎯",
  "Yıldız gibi parlıyorsun! ⭐",
  "Bugün her şey harika! 🌈",
  "Şampiyon geri döndü! 👑",
  "Harika bir ruh hali! 🎨",
  "Bugün farklısın! 💎",
  "Enerjin bulaşıcı! 🎭",
  "Mükemmel bir giriş! 🎪",
  "Harika bir oyuncu! 🎮",
  "Bugün çok iyisin! 🌺",
  "Parlak bir gün! ☀️",
  "Muhteşem bir başlangıç! 🎉",
  "Efsane geri döndü! 🦁",
  "Bugün imkansız yok! 💪",
  "Harika bir his! 🎵",
  "Mükemmel zamanlar! ⏰",
  "Bugün seninle gurur duyuyoruz! 🏅",
  "Muhteşem bir yolculuk! 🛸",
  "Harika bir görünüm! 👀",
  "Bugün çok keyiflisin! 😊",
  "Parlak bir gelecek! 🌅",
  "Harika bir macera! 🗺️",
  "Mükemmel bir savaşçı! ⚔️",
  "Bugün efsanesin! 🦄",
  "Harika bir zeka! 🧠",
  "Muhteşem bir yetenek! 🎯",
  "Bugün her şey mükemmel! 🌸",
  "Harika bir strateji! 📊",
  "Mükemmel bir zamanlama! ⚡",
  "Bugün şanslı yıldızın parlıyor! 🌟",
  "Harika bir konsantrasyon! 🎓",
  "Muhteşem bir performans! 🎬",
];

// Rastgele selamlama mesajı seç
const getRandomGreeting = () => {
  return greetingMessages[Math.floor(Math.random() * greetingMessages.length)];
};

// Check if user is in their first week (gift premium period)
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

const HomePage = () => {
  const { user } = useAuth();
  const { profile, isPremium, refreshProfile } = useUser();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { startBackgroundMusic, musicEnabled, setMusicEnabled } = useMusic();
  const { jokers } = useJokerInventory();
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [matchmakingGameType, setMatchmakingGameType] = useState<"timed" | "score">("timed");
  const [matchmakingKey, setMatchmakingKey] = useState<number>(0);
  //
  const [timeUntilNextCredit, setTimeUntilNextCredit] = useState<string>("");
  const [unlimitedTimeLeft, setUnlimitedTimeLeft] = useState<string>("");
  const { canPlay: canPlayMemory, timeUntilNextPlay } = useMemoryGame();
  const { startSearch, isSearching, searchProgress, cancelSearch } = useMatchmaking();
  const [greeting, setGreeting] = useState(() => {
    const sessionGreeting = sessionStorage.getItem("sessionGreeting");
    if (sessionGreeting) return sessionGreeting;
    const newGreeting = getRandomGreeting();
    sessionStorage.setItem("sessionGreeting", newGreeting);
    return newGreeting;
  });

  // Level hesaplama fonksiyonu
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

    const experience = totalScore - totalExpNeeded;
    const nextLevelExp = currentLevelExp;

    return { level, experience, nextLevelExp };
  };

  // Kalan süreyi hesaplama (Sınırsız Can için)
  const calculateUnlimitedTimeLeft = () => {
    if (!profile || !isUnlimitedLivesActive(profile)) {
      setUnlimitedTimeLeft("");
      return;
    }

    const now = new Date();
    // Burada zaten (profile as any) kullanmışsın, bu doğru.
    const expiry = new Date((profile as any).unlimited_lives_until);

    if (now >= expiry) {
      setUnlimitedTimeLeft("");
      return;
    }

    const timeDiff = expiry.getTime() - now.getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    let result = "";
    if (days > 0) {
      result = `${days}g ${hours}s`;
    } else if (hours > 0) {
      result = `${hours}s ${minutes}d`;
    } else {
      result = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    setUnlimitedTimeLeft(result);
  };

  // Kalan süreyi hesaplama fonksiyonu
  const calculateTimeUntilNextCredit = () => {
    if (!profile?.last_credit_refresh || isPremium || profile?.game_credits >= 5) {
      setTimeUntilNextCredit("");
      return;
    }

    const now = new Date();
    const lastRefresh = new Date(profile.last_credit_refresh);
    const nextRefresh = new Date(lastRefresh.getTime() + 72 * 60 * 1000);

    if (now >= nextRefresh) {
      setTimeUntilNextCredit("");
      return;
    }

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

        toast.success(`🎮 +1 Kredi eklendi! (${Math.min(currentCredits + 1, 5)}/5)`, {
          description: `${5 - (currentCredits + 1)} kredi daha kazanabilirsin`,
          duration: 3000,
        });
        playSound("buttonClick");
      }
    } catch (error) {
      console.error("Kredi yenileme hatası:", error);
    }
  };

  // Sınırsız Can geri sayım efekti
  useEffect(() => {
    if (profile && isUnlimitedLivesActive(profile)) {
      calculateUnlimitedTimeLeft();
      const interval = setInterval(calculateUnlimitedTimeLeft, 1000);
      return () => clearInterval(interval);
    } else {
      setUnlimitedTimeLeft("");
    }
  }, [profile]);

  // Timer effect for credit countdown
  useEffect(() => {
    if (!isPremium && profile) {
      calculateTimeUntilNextCredit();
      const interval = setInterval(() => {
        calculateTimeUntilNextCredit();

        // Kredi yenileme kontrolü
        if (profile?.last_credit_refresh && !isPremium && profile.game_credits < 5) {
          const now = new Date();
          const lastRefresh = new Date(profile.last_credit_refresh);
          const nextRefresh = new Date(lastRefresh.getTime() + 72 * 60 * 1000);

          if (now >= nextRefresh) {
            refreshCredits();
            // Profili de yenile
            setTimeout(() => refreshProfile(), 500);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [profile, isPremium, refreshCredits]);

  // Start background music when component mounts
  useEffect(() => {
    startBackgroundMusic();
  }, [startBackgroundMusic]);

  // Check for daily reset on component mount
  useEffect(() => {
    const checkDailyReset = async () => {
      if (!user || !profile) return;

      const now = new Date();
      const lastReset = profile.last_daily_reset ? new Date(profile.last_daily_reset) : null;
      const today = now.toISOString().split("T")[0];

      // If no reset recorded or last reset was before today
      if (!lastReset || lastReset.toISOString().split("T")[0] !== today) {
        console.log("🔄 Daily reset needed for user:", user.id);
        await refreshProfile();
      }
    };

    checkDailyReset();
  }, [user, profile?.last_daily_reset]);

  const [showAvatarView, setShowAvatarView] = useState(false);

  const handleAvatarClick = () => {
    setShowAvatarView(true);
  };

  // Demo oyun başlatma event listener
  useEffect(() => {
    const handleStartDemoGame = () => {
      console.log("🎮 Starting demo game...");
      navigate("/game/vs-computer?type=timed&demo=true");
    };

    window.addEventListener("startDemoGame", handleStartDemoGame);
    return () => window.removeEventListener("startDemoGame", handleStartDemoGame);
  }, [navigate]);

  const handleMatchFound = (roomId: string) => {
    console.log("🎯 Match found! Room ID:", roomId);
    setShowMatchmaking(false);

    // AI ile oyun için özel yönlendirme
    if (roomId === "ai-game") {
      navigate(`/game/vs-computer?type=${matchmakingGameType}`);
      return;
    }

    // Tüm eşleşmeler (Nakama dahil) artık doğrudan oyun sayfasına gidiyor
    navigate(`/game/random-match?room=${roomId}&type=${matchmakingGameType}`);
  };

  const gameModesConfig = [
    {
      id: "vs-computer",
      title: "Yapay Zekaya Karşı",
      description: "AI rakibine karşı pratik yap",
      icon: Bot,
      color: "bg-slate-600",
      gradient: "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800",
      route: "/game/vs-computer",
    },
    {
      id: "private-room",
      title: "Özel Oda",
      description: "Arkadaşınla özel oda oluştur",
      icon: Users,
      color: "bg-zinc-600",
      gradient: "bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-800",
      route: "/game/private-room",
    },
    {
      id: "random-match",
      title: "Rastgele Rakip",
      description: "Rastgele oyuncu ile eşleş",
      icon: Zap,
      color: "bg-neutral-600",
      gradient: "bg-gradient-to-br from-neutral-600 via-neutral-700 to-neutral-800",
      route: "/game/random-match",
    },
    {
      id: "tournament",
      title: "Turnuva",
      description: "8 kişilik turnuvaya katıl",
      icon: Trophy,
      color: "bg-stone-600",
      gradient: "bg-gradient-to-br from-stone-600 via-stone-700 to-amber-900/80",
      route: "/tournament",
    },
  ];

  return (
    <>
      <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-background to-muted">
        {/* Sabit Header - Füme Tema */}
        <div className="flex-shrink-0">
          <Card className="border-0 bg-gradient-to-br from-slate-800 via-slate-900 to-zinc-900 shadow-2xl relative overflow-hidden rounded-none">
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.1)_1px,_transparent_1px)] bg-[length:20px_20px]" />
            
            <CardContent className="px-3 pb-2 pt-4 relative z-10">
              {/* Mobil optimized layout - Kompakt */}
              <div className="space-y-2">
                {/* Üst satır - Avatar, Kelimeci başlığı, Mürekkep ve Level */}
                <div className="flex items-center gap-2">
                  {/* Avatar */}
                  <div className="relative cursor-pointer group flex-shrink-0" onClick={handleAvatarClick}>
                    <Avatar className="w-10 h-10 ring-2 ring-slate-500/50 shadow-lg">
                      <AvatarImage
                        src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                        alt="Profile"
                        loading="eager"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-700 text-white text-xs font-bold">
                        <User className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  {/* Kullanıcı bilgisi */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base font-bold font-bungee tracking-wider uppercase bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 bg-clip-text text-transparent">
                      KELİMELE
                    </h1>
                    <p className="text-[10px] text-slate-400 truncate">{greeting}</p>
                  </div>

                  {/* Level Badge - Kompakt */}
                  <div className="flex items-center gap-1.5 bg-slate-700/50 rounded-lg px-2 py-1 border border-slate-600/30">
                    <div className="w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-md flex items-center justify-center">
                      <Crown className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-white leading-none">{calculateLevel(profile?.total_score || 0).level}</div>
                      <div className="text-[8px] text-slate-400">SEVİYE</div>
                    </div>
                  </div>

                  {/* Mürekkep */}
                  <div
                    className="flex items-center gap-1 bg-slate-700/50 rounded-lg px-2 py-1 border border-slate-600/30 cursor-pointer"
                    onClick={() => {
                      playSound("buttonClick");
                      navigate("/market");
                    }}
                  >
                    <img src="/murekkepikon.png" alt="Mürekkep" className="w-5 h-5 object-contain" />
                    <span className="text-xs font-bold text-amber-400">{profile?.ink_count || 0}</span>
                  </div>

                  {/* Premium Badge */}
                  {isPremium && (
                    <div className="flex items-center gap-0.5 bg-amber-500/20 px-1.5 py-0.5 rounded-full">
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span className="text-[9px] text-amber-400 font-semibold">
                        {isUnlimitedLivesActive(profile) ? "∞" : "VIP"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress bar - Kompakt inline */}
                <div className="flex items-center gap-2 bg-slate-700/40 rounded-lg px-2 py-1.5 border border-slate-600/20">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-slate-400">
                        {calculateLevel(profile?.total_score || 0).experience}/{calculateLevel(profile?.total_score || 0).nextLevelExp} XP
                      </span>
                      <span className="text-amber-400 font-medium">
                        %{Math.round((calculateLevel(profile?.total_score || 0).experience / calculateLevel(profile?.total_score || 0).nextLevelExp) * 100)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-900/60 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 rounded-full transition-all duration-500"
                        style={{
                          width: `${(calculateLevel(profile?.total_score || 0).experience / calculateLevel(profile?.total_score || 0).nextLevelExp) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-amber-400">{(profile?.total_score || 0).toLocaleString()}</div>
                    <div className="text-[8px] text-slate-500">PUAN</div>
                  </div>
                </div>

                {/* Hak barı ve Jokerler - Yan yana kompakt */}
                <div className="flex gap-2">
                  {/* Sol - Hak barı */}
                  <div className="flex-1 bg-slate-700/40 rounded-lg p-2 border border-slate-600/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-slate-400">Haklar</span>
                      {isUnlimitedLivesActive(profile) ? (
                        <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                          <Infinity className="w-3 h-3" /> {unlimitedTimeLeft}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-white">
                          {(profile?.game_credits || 0) + (profile?.bonus_credits || 0)}/5
                          {timeUntilNextCredit && profile?.game_credits < 5 && (
                            <span className="text-amber-400 ml-1">+1 {timeUntilNextCredit}</span>
                          )}
                        </span>
                      )}
                    </div>
                    {!isUnlimitedLivesActive(profile) && (
                      <div className="flex gap-1 h-2">
                        {Array.from({ length: 5 }, (_, i) => {
                          const credits = (profile?.game_credits || 0) + (profile?.bonus_credits || 0);
                          const isActive = i < credits;
                          const gradients = [
                            "from-red-500 to-red-400",
                            "from-orange-500 to-orange-400",
                            "from-amber-500 to-amber-400",
                            "from-emerald-500 to-emerald-400",
                            "from-green-500 to-green-400",
                          ];
                          return (
                            <div
                              key={i}
                              className={`flex-1 rounded-sm ${isActive ? `bg-gradient-to-r ${gradients[i]}` : "bg-slate-800/60"}`}
                            />
                          );
                        })}
                      </div>
                    )}
                    {/* İstatistikler - Alt satır */}
                    <div className="flex gap-2 mt-1.5 pt-1.5 border-t border-slate-600/20">
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] text-slate-400">Günlük:</span>
                        <span className="text-[10px] font-bold text-white">{profile?.daily_games || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] text-slate-400">Seri:</span>
                        <span className="text-[10px] font-bold text-white">{profile?.win_streak || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sağ - Jokerler kompakt */}
                  <div className="bg-slate-700/40 rounded-lg p-2 border border-slate-600/20">
                    <div className="text-[10px] font-medium text-slate-400 mb-1 text-center">Jokerler</div>
                    <div className="flex gap-2">
                      <div className="flex flex-col items-center">
                        <img src="/degistirIkon.png" alt="Değiştir" className="w-5 h-5 object-contain" />
                        <span className="text-[10px] font-bold text-amber-400">×{jokers.degistir}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <img src="/fisildaIkon.png" alt="Fısılda" className="w-5 h-5 object-contain" />
                        <span className="text-[10px] font-bold text-amber-400">×{jokers.fisilida}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <img src="/senyazIkon.png" alt="Sen Yaz" className="w-5 h-5 object-contain" />
                        <span className="text-[10px] font-bold text-amber-400">×{jokers.senYaz}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gift Premium Banner - Sabit */}
        {isPremium && isGiftPremium(profile) && (
          <div className="flex-shrink-0 p-2">
            <Card className="border-2 border-gradient-to-r from-yellow-400 to-orange-500 bg-gradient-to-r from-yellow-50 to-orange-50 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <Gift className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800">🎉 Hoş Geldin Hediyesi!</h3>
                    <p className="text-sm text-gray-600">
                      1 haftalık ücretsiz premium paketini kullanıyorsun! Tüm özelliklerden faydalanabilirsin.
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Son tarih:{" "}
                      {profile?.premium_until ? new Date(profile.premium_until).toLocaleDateString("tr-TR") : ""}
                    </p>
                  </div>
                  <Crown className="w-6 h-6 text-yellow-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mini Oyunlar - Yatay Scroll (Sabit) */}
        <div className="flex-shrink-0 px-2 py-2">
          <div className="w-full overflow-x-auto scrollbar-hide">
            <div className="flex gap-3 pb-2" style={{ minWidth: "max-content" }}>
              {/* Günlük Çark */}
              <div
                data-onboarding="daily-wheel"
                className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg px-4 py-2 flex items-center shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 min-w-[200px]"
                onClick={() => navigate("/wheel")}
              >
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white font-painter">Günlük Çark</h2>
                </div>
                {/* Mini Çark SVG */}
                <div className="relative w-12 h-12">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 48 48"
                    className="animate-spin"
                    style={{ animationDuration: "3s" }}
                  >
                    <g transform="translate(24,24)">
                      {/* 8 segment çark */}
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
                        const angle = (360 / 8) * index;
                        const nextAngle = (360 / 8) * (index + 1);
                        const startAngle = (angle - 90) * (Math.PI / 180);
                        const endAngle = (nextAngle - 90) * (Math.PI / 180);

                        const radius = 20;
                        const x1 = radius * Math.cos(startAngle);
                        const y1 = radius * Math.sin(startAngle);
                        const x2 = radius * Math.cos(endAngle);
                        const y2 = radius * Math.sin(endAngle);

                        const largeArcFlag = nextAngle - angle > 180 ? 1 : 0;

                        const colors = [
                          "#ef4444",
                          "#f97316",
                          "#eab308",
                          "#22c55e",
                          "#3b82f6",
                          "#8b5cf6",
                          "#ec4899",
                          "#6b7280",
                        ];

                        return (
                          <path
                            key={index}
                            d={`M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                            fill={colors[index]}
                            stroke="white"
                            strokeWidth="1"
                          />
                        );
                      })}
                    </g>
                    {/* Merkez daire */}
                    <circle cx="24" cy="24" r="4" fill="white" stroke="#333" strokeWidth="1" />
                  </svg>
                  {/* Ok */}
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
                    <div className="w-0 h-0 border-l-2 border-r-2 border-b-4 border-l-transparent border-r-transparent border-b-white"></div>
                  </div>
                </div>
              </div>

              {/* Hafıza Oyunu */}
              <div
                data-onboarding="mini-games"
                className={`rounded-lg px-4 py-2 flex items-center shadow-md cursor-pointer hover:shadow-lg transition-all duration-500 ease-in-out min-w-[200px] ${
                  canPlayMemory
                    ? "bg-gradient-to-r from-purple-500 to-pink-500"
                    : "bg-gradient-to-r from-gray-400 to-gray-500"
                }`}
                onClick={() => navigate("/memory-game")}
              >
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white font-painter">Hafıza Oyunu</h2>
                  {!canPlayMemory && timeUntilNextPlay && (
                    <p className="text-xs text-white/80">Sonraki: {timeUntilNextPlay}</p>
                  )}
                </div>
                {/* Mini Kart İkonu */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="grid grid-cols-2 gap-1">
                    <div className={`w-4 h-4 bg-white/40 rounded-sm ${canPlayMemory ? "animate-pulse" : ""}`}></div>
                    <div
                      className={`w-4 h-4 bg-white/80 rounded-sm ${canPlayMemory ? "animate-pulse" : ""}`}
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                    <div
                      className={`w-4 h-4 bg-white/80 rounded-sm ${canPlayMemory ? "animate-pulse" : ""}`}
                      style={{ animationDelay: "0.9s" }}
                    ></div>
                    <div
                      className={`w-4 h-4 bg-white/40 rounded-sm ${canPlayMemory ? "animate-pulse" : ""}`}
                      style={{ animationDelay: "1.4s" }}
                    ></div>
                  </div>
                  <Brain className={`absolute w-6 h-6 ${canPlayMemory ? "text-white/80" : "text-white/50"}`} />
                </div>
              </div>

              {/* Neon Blitz (Refleks Oyunu) */}
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg px-4 py-2 flex items-center shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 min-w-[200px] relative overflow-hidden"
                onClick={() => navigate("/neon-blitz")}
              >
                {/* Arka plan için hafif yanıp sönen grid efekti (Opsiyonel süsleme) */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent animate-pulse"></div>

                <div className="flex-1 z-10">
                  <h2 className="text-xl font-semibold text-white font-painter tracking-wide drop-shadow-md">
                    Dokunsana
                  </h2>
                </div>

                {/* Mini Neon İkonu */}
                <div className="relative w-12 h-12 flex items-center justify-center z-10">
                  {/* Arkadaki hızlı dönen halka */}
                  <div
                    className="absolute w-10 h-10 border-2 border-cyan-300/30 rounded-full animate-spin"
                    style={{ animationDuration: "3s" }} // Daha hızlı dönüyor
                  ></div>

                  {/* Ortadaki Şimşek (Hız/Refleks temsili) */}
                  {/* Not: Zap ikonunu lucide-react'ten import etmen gerekebilir */}
                  <Zap className="w-6 h-6 text-yellow-300 fill-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.8)] animate-pulse" />

                  {/* Yüzen Kare Parçacıkları (Oyunun Grid yapısına atıf) */}
                  <div
                    className="absolute top-1 right-2 w-2 h-2 bg-cyan-300 rounded-sm animate-ping shadow-[0_0_8px_rgba(103,232,249,0.8)]"
                    style={{ animationDuration: "1.5s" }}
                  ></div>
                </div>
              </div>

              {/* Morles Game */}
              <div
                className="bg-gradient-to-r from-cyan-500 to-teal-500 rounded-lg px-4 py-2 flex items-center shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 min-w-[200px]"
                onClick={() => navigate("/morles-game")}
              >
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white font-painter">Harf Kulesi</h2>
                </div>
                {/* Mini Morles İkonları - Dikdörtgen + L blok */}
                <div className="relative w-12 h-12 flex items-center justify-center gap-1">
                  {/* 6 birimli dikdörtgen blok (3x2) */}
                  <div className="flex flex-col gap-0.5 animate-pulse" style={{ animationDelay: "0s" }}>
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: "#bf00ff" }}></div>
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: "#bf00ff" }}></div>
                    </div>
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: "#bf00ff" }}></div>
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: "#bf00ff" }}></div>
                    </div>
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: "#bf00ff" }}></div>
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: "#bf00ff" }}></div>
                    </div>
                  </div>

                  {/* L blok (azaltılmış - 2 satır) */}
                  <div className="flex flex-col gap-0.5 animate-pulse" style={{ animationDelay: "0.3s" }}>
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: "#b100ff" }}></div>
                      <div className="w-1.5 h-1.5 bg-transparent"></div>
                    </div>
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: "#b100ff" }}></div>
                      <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: "#b100ff" }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reactor Runner */}
              <div
                className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg px-4 py-2 flex items-center shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 min-w-[200px]"
                onClick={() => navigate("/reactor-runner")}
              >
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white font-painter">Kelime Avcısı</h2>
                </div>
                {/* Mini Reaktör İkonu */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div
                    className="w-8 h-8 bg-yellow-300 rounded-full animate-spin flex items-center justify-center"
                    style={{ animationDuration: "1s" }}
                  >
                    ☢️
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 border-2 border-white/30 rounded-full animate-ping" />
                  </div>
                  {/* Kaktüs engeller */}
                  <div className="absolute right-0 bottom-1">
                    <span className="text-lg">🌵</span>
                  </div>
                </div>
              </div>

              {/* Snake Game */}
              <div
                className="bg-gradient-to-r from-pink-600 to-rose-500 rounded-lg px-4 py-2 flex items-center shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 min-w-[200px]"
                onClick={() => navigate("/snake-game")}
              >
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white font-painter">Harf Yeme</h2>
                </div>
                {/* Mini Snake İkonu */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  {/* Yılan başı */}
                  <div className="w-4 h-4 bg-pink-300 rounded-full animate-pulse flex items-center justify-center">
                    🐍
                  </div>
                  {/* Yılan vücudu */}
                  <div className="absolute left-2 top-6 w-3 h-3 bg-pink-400 rounded-full opacity-80"></div>
                  <div className="absolute left-3 top-7 w-2 h-2 bg-pink-500 rounded-full opacity-60"></div>
                  <div className="absolute left-4 top-8 w-2 h-2 bg-pink-600 rounded-full opacity-40"></div>

                  {/* Yiyecek (elma) */}
                  <div
                    className="absolute top-1 right-1 w-3 h-3 bg-red-400 rounded-full animate-bounce flex items-center justify-center text-[8px]"
                    style={{ animationDelay: "0.5s" }}
                  >
                    🍎
                  </div>

                  {/* Hareket çizgileri */}
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-0.5 h-3 bg-white/40 animate-pulse"></div>
                  <div
                    className="absolute bottom-1 left-1/2 transform -translate-x-1/2 translate-x-1 w-0.5 h-2 bg-white/30 animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  ></div>

                  {/* Skor efekti */}
                  <div className="absolute top-0 left-0 text-[8px] text-yellow-300 font-bold animate-pulse">+10</div>
                </div>
              </div>

              {/* Grid Simon Says */}
              <div
                className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg px-4 py-2 flex items-center shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 min-w-[200px]"
                onClick={() => navigate("/grid-simon-says")}
              >
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white font-painter">Sıkı Takip</h2>
                </div>
                {/* Mini Grid İkonu */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="grid grid-cols-4 gap-0.5">
                    {Array.from({ length: 16 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 bg-white/40 rounded-sm ${i === 5 || i === 9 || i === 10 ? "bg-yellow-300 animate-pulse" : ""}`}
                        style={{ animationDelay: `${i * 0.1}s` }}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-white/30 rounded-full animate-ping" />
                  </div>
                </div>
              </div>

              {/* Puzzle Oyunu */}
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg px-4 py-2 flex items-center shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 min-w-[200px]"
                onClick={() => navigate("/puzzle-game")}
              >
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white font-painter">Kelime Puzzle</h2>
                </div>
                {/* Mini Puzzle İkonu */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="grid grid-cols-3 gap-0.5">
                    <div
                      className={`w-3 h-3 bg-white/90 rounded-sm flex items-center justify-center text-[10px] font-bold text-cyan-600 ${canPlayMemory ? "sequential-pulse" : ""}`}
                      style={{ animationDelay: "0s" }}
                    >
                      1
                    </div>
                    <div
                      className={`w-3 h-3 bg-white/90 rounded-sm flex items-center justify-center text-[10px] font-bold text-cyan-600 ${canPlayMemory ? "sequential-pulse" : ""}`}
                      style={{ animationDelay: "0.3s" }}
                    >
                      2
                    </div>
                    <div
                      className={`w-3 h-3 bg-white/90 rounded-sm flex items-center justify-center text-[10px] font-bold text-cyan-600 ${canPlayMemory ? "sequential-pulse" : ""}`}
                      style={{ animationDelay: "0.6s" }}
                    >
                      3
                    </div>
                    <div
                      className={`w-3 h-3 bg-white/90 rounded-sm flex items-center justify-center text-[10px] font-bold text-cyan-600 ${canPlayMemory ? "sequential-pulse" : ""}`}
                      style={{ animationDelay: "0.9s" }}
                    >
                      4
                    </div>
                    <div
                      className={`w-3 h-3 bg-white/90 rounded-sm flex items-center justify-center text-[10px] font-bold text-cyan-600 ${canPlayMemory ? "sequential-pulse" : ""}`}
                      style={{ animationDelay: "1.2s" }}
                    >
                      5
                    </div>
                    <div
                      className={`w-3 h-3 bg-white/90 rounded-sm flex items-center justify-center text-[10px] font-bold text-cyan-600 ${canPlayMemory ? "sequential-pulse" : ""}`}
                      style={{ animationDelay: "1.5s" }}
                    >
                      6
                    </div>
                    <div
                      className={`w-3 h-3 bg-white/90 rounded-sm flex items-center justify-center text-[10px] font-bold text-cyan-600 ${canPlayMemory ? "sequential-pulse" : ""}`}
                      style={{ animationDelay: "1.8s" }}
                    >
                      7
                    </div>
                    <div
                      className={`w-3 h-3 bg-white/90 rounded-sm flex items-center justify-center text-[10px] font-bold text-cyan-600 ${canPlayMemory ? "sequential-pulse" : ""}`}
                      style={{ animationDelay: "2.1s" }}
                    >
                      8
                    </div>
                    <div
                      className={`w-3 h-3 bg-white/20 rounded-sm ${canPlayMemory ? "sequential-pulse" : ""}`}
                      style={{ animationDelay: "2.4s" }}
                    ></div>
                  </div>
                  <Grid3X3 className="absolute w-6 h-6 text-white/20" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Temel Oyun Modları - Dikey Scroll */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-20" data-onboarding="game-modes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
            {gameModesConfig.map((mode) => (
              <Card
                key={mode.id}
                className={`cursor-pointer border-0 overflow-hidden ${mode.gradient}`}
                onClick={() => {
                  playSound("buttonClick");

                  // Kredi kontrolü - premium değilse ve kredi yoksa
                  if (!isPremium && (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0) {
                    toast.error("Yetersiz oyun hakkı!", {
                      description: "Oyun oynamak için hak satın alın veya dolmasını bekleyin.",
                      duration: 4000,
                    });
                    return;
                  }

                  if (mode.id === "tournament") {
                    navigate("/tournament");
                  } else {
                    setSelectedMode(mode.id);
                  }
                }}
              >
                <CardHeader className="pb-2 pt-3 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-slate-500/30 backdrop-blur-sm rounded-lg flex items-center justify-center border border-slate-400/30">
                        <mode.icon className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-slate-100 drop-shadow-lg">{mode.title}</CardTitle>
                        <CardDescription className="text-slate-300 font-medium text-sm">
                          {mode.description}
                        </CardDescription>
                      </div>
                    </div>
                    {mode.id === "vs-computer" && (
                      <img
                        src="/lovable-uploads/8008dff7-7ead-48e2-b47e-fde31770af08.png"
                        alt="Computer player"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-40"
                      />
                    )}
                    {mode.id === "private-room" && (
                      <img
                        src="/lovable-uploads/e5d22948-34db-460d-adff-dc6284efcf50.png"
                        alt="Private room"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-40"
                      />
                    )}
                    {mode.id === "random-match" && (
                      <img
                        src="/lovable-uploads/a91ec87e-aaac-47fa-93fa-22e1f0270999.png"
                        alt="Random match"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-40"
                      />
                    )}
                    {mode.id === "tournament" && (
                      <img
                        src="/lovable-uploads/70bff2fc-4ab0-4705-b1f1-d3cf41bbc7b5.png"
                        alt="Tournament"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-40"
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge
                      variant="secondary"
                      className="text-xs bg-slate-600/50 text-slate-200 border-slate-500/50 hover:bg-slate-600/70"
                    >
                      <Clock className="w-3 h-3 mr-1 text-amber-400" />2 Dakika
                    </Badge>
                  </div>
                  <Button
                    className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30 hover:border-amber-500/50 backdrop-blur-sm font-semibold"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      playSound("buttonClick");
                      if (mode.id === "tournament") {
                        navigate("/tournament");
                      } else {
                        setSelectedMode(mode.id);
                      }
                    }}
                  >
                    {mode.id === "tournament" ? "Giriş Yap" : "Oyuna Başla"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Game Mode Selector Modal */}
        {selectedMode && selectedMode === "private-room" ? (
          <PrivateRoomModal
            onClose={() => setSelectedMode(null)}
            onStartGame={(nakamaMatchId, gameType) => {
              setSelectedMode(null);
              navigate(`/game/random-match?room=${nakamaMatchId}&type=${gameType}`);
            }}
          />
        ) : selectedMode === "random-match" ? (
          <GameModeSelector
            mode={selectedMode}
            onStart={(gameType) => {
              setSelectedMode(null);
              setMatchmakingGameType(gameType);
              setMatchmakingKey(Date.now());
              setShowMatchmaking(true);
              // Küçük gecikme ile arama başlat (modal mount olduktan sonra)
              setTimeout(() => startSearch(gameType), 100);
            }}
            onClose={() => {
              playSound("buttonClick");
              setSelectedMode(null);
            }}
          />
        ) : selectedMode === "tournament" ? (
          <GameModeSelector
            mode={selectedMode}
            onStart={(gameType) => {
              navigate("/tournament", { state: { gameType } });
              setSelectedMode(null);
            }}
            onClose={() => {
              playSound("buttonClick");
              setSelectedMode(null);
            }}
          />
        ) : selectedMode ? (
          <GameModeSelector
            mode={selectedMode}
            onStart={(gameType) => {
              const mode = gameModesConfig.find((m) => m.id === selectedMode);
              if (mode) {
                navigate(`${mode.route}?type=${gameType}`);
              }
              setSelectedMode(null);
            }}
            onClose={() => {
              playSound("buttonClick");
              setSelectedMode(null);
            }}
          />
        ) : null}

        {/* Slot Matchmaking Modal for Random Match */}
        {showMatchmaking && (
          <div className="fixed inset-0 z-[9999] bg-background">
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

        {/* Floating Menu */}
        <div data-onboarding="floating-menu" className="fixed bottom-0 left-0 right-0 z-50">
          <FloatingMenu />
        </div>

        {/* Avatar View Dialog */}
        <AvatarViewDialog
          open={showAvatarView}
          onOpenChange={setShowAvatarView}
          avatarUrl={profile?.avatar_url || user?.user_metadata?.avatar_url || ""}
          username={profile?.username || user?.user_metadata?.username || user?.email?.split("@")[0] || "Oyuncu"}
        />
      </div>
    </>
  );
};

export default HomePage;
