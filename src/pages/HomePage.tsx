import { useState, useEffect, useRef } from "react";
import { useMusic } from "@/contexts/MusicContext";
import { useGame } from "@/contexts/GameContext";
import GameModeSelector from "@/components/GameModeSelector";
import { FloatingMenu } from "@/components/FloatingMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PrivateRoomModal from "@/components/PrivateRoomModal";
import { SlotMatchmaking } from "@/components/SlotMatchmaking";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useJokerInventory } from "@/hooks/useJokerInventory";
import { Brain, Grid3X3, ChevronRight, Gamepad2 } from "lucide-react";
import { useMemoryGame } from "@/hooks/useMemoryGame";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { useUserRole } from "@/hooks/useUserRole";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";
import { motion, AnimatePresence } from "framer-motion";

import {
  Bot,
  Users,
  Trophy,
  Clock,
  Target,
  User,
  Crown,
  Zap,
  Gift,
  Sparkles,
  Infinity,
  Star,
  Flame,
  Play,
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
  "Kazanmaya hazır mısın? 🎯",
  "Şampiyon geri döndü! 👑",
];

const getRandomGreeting = () => {
  return greetingMessages[Math.floor(Math.random() * greetingMessages.length)];
};

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
  const { profile, isPremium, refreshProfile, getTotalCredits, getDisplayCredits } = useUser();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { startBackgroundMusic } = useMusic();
  const { jokers } = useJokerInventory();
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [matchmakingGameType, setMatchmakingGameType] = useState<"timed" | "score">("timed");
  const [matchmakingKey, setMatchmakingKey] = useState<number>(0);
  const [timeUntilNextCredit, setTimeUntilNextCredit] = useState<string>("");
  const [unlimitedTimeLeft, setUnlimitedTimeLeft] = useState<string>("");
  const { canPlay: canPlayMemory, timeUntilNextPlay } = useMemoryGame();
  const { startSearch, searchProgress, cancelSearch } = useMatchmaking();
  const [greeting] = useState(() => {
    const sessionGreeting = sessionStorage.getItem("sessionGreeting");
    if (sessionGreeting) return sessionGreeting;
    const newGreeting = getRandomGreeting();
    sessionStorage.setItem("sessionGreeting", newGreeting);
    return newGreeting;
  });
  const [showAvatarView, setShowAvatarView] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Level hesaplama
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

  const levelData = calculateLevel(profile?.total_score || 0);
  const progressPercent = (levelData.experience / levelData.nextLevelExp) * 100;

  // Sınırsız can süre hesaplama
  const calculateUnlimitedTimeLeft = () => {
    if (!profile || !isUnlimitedLivesActive(profile)) {
      setUnlimitedTimeLeft("");
      return;
    }
    const now = new Date();
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
    if (days > 0) result = `${days}g ${hours}s`;
    else if (hours > 0) result = `${hours}s ${minutes}d`;
    else result = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    setUnlimitedTimeLeft(result);
  };

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
        toast.success(`🎮 +1 Kredi eklendi! (${Math.min(currentCredits + 1, 5)}/5)`);
        playSound("buttonClick");
      }
    } catch (error) {
      console.error("Kredi yenileme hatası:", error);
    }
  };

  useEffect(() => {
    if (profile && isUnlimitedLivesActive(profile)) {
      calculateUnlimitedTimeLeft();
      const interval = setInterval(calculateUnlimitedTimeLeft, 1000);
      return () => clearInterval(interval);
    } else {
      setUnlimitedTimeLeft("");
    }
  }, [profile]);

  useEffect(() => {
    if (!isPremium && profile) {
      calculateTimeUntilNextCredit();
      const interval = setInterval(() => {
        calculateTimeUntilNextCredit();
        if (profile?.last_credit_refresh && !isPremium && profile.game_credits < 5) {
          const now = new Date();
          const lastRefresh = new Date(profile.last_credit_refresh);
          const nextRefresh = new Date(lastRefresh.getTime() + 72 * 60 * 1000);
          if (now >= nextRefresh) {
            refreshCredits();
            setTimeout(() => refreshProfile(), 500);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [profile, isPremium]);

  useEffect(() => {
    startBackgroundMusic();
  }, [startBackgroundMusic]);

  useEffect(() => {
    const checkDailyReset = async () => {
      if (!user || !profile) return;
      const now = new Date();
      const lastReset = profile.last_daily_reset ? new Date(profile.last_daily_reset) : null;
      const today = now.toISOString().split("T")[0];
      if (!lastReset || lastReset.toISOString().split("T")[0] !== today) {
        await refreshProfile();
      }
    };
    checkDailyReset();
  }, [user, profile?.last_daily_reset]);

  useEffect(() => {
    const handleStartDemoGame = () => {
      navigate("/game/vs-computer?type=timed&demo=true");
    };
    window.addEventListener("startDemoGame", handleStartDemoGame);
    return () => window.removeEventListener("startDemoGame", handleStartDemoGame);
  }, [navigate]);

  const handleMatchFound = (roomId: string) => {
    setShowMatchmaking(false);
    if (roomId === "ai-game") {
      navigate(`/game/vs-computer?type=${matchmakingGameType}`);
      return;
    }
    navigate(`/game/random-match?room=${roomId}&type=${matchmakingGameType}`);
  };

  const gameModesConfig = [
    {
      id: "vs-computer",
      title: "Yapay Zeka",
      description: "AI ile pratik yap",
      icon: Bot,
      gradient: "from-cyan-500 via-blue-600 to-indigo-700",
      glowColor: "cyan",
    },
    {
      id: "private-room",
      title: "Özel Oda",
      description: "Arkadaşınla oyna",
      icon: Users,
      gradient: "from-emerald-500 via-green-600 to-teal-700",
      glowColor: "emerald",
    },
    {
      id: "random-match",
      title: "Rastgele Rakip",
      description: "Rastgele oyuncu ile eşleş",
      icon: Zap,
      gradient: "from-violet-500 via-purple-600 to-fuchsia-700",
      glowColor: "violet",
    },
    {
      id: "tournament",
      title: "Turnuva",
      description: "8 kişilik turnuvaya katıl",
      icon: Trophy,
      gradient: "from-amber-500 via-orange-600 to-red-700",
      glowColor: "amber",
    },
  ];

  const miniGamesConfig = [
    { id: "wheel", title: "Günlük Çark", icon: "🎡", gradient: "from-yellow-500 to-orange-600", route: "/wheel" },
    {
      id: "memory",
      title: "Hafıza",
      icon: "🧠",
      gradient: "from-purple-500 to-pink-600",
      route: "/memory-game",
      disabled: !canPlayMemory,
      cooldown: timeUntilNextPlay,
    },
    { id: "neon", title: "Dokunsana", icon: "⚡", gradient: "from-cyan-500 to-blue-600", route: "/neon-blitz" },
    { id: "morles", title: "Harf Kulesi", icon: "🏗️", gradient: "from-teal-500 to-cyan-600", route: "/morles-game" },
    {
      id: "simon",
      title: "Sıkı Takip",
      icon: "🎯",
      gradient: "from-indigo-500 to-purple-600",
      route: "/grid-simon-says",
    },
    { id: "puzzle", title: "Puzzle", icon: "🧩", gradient: "from-blue-500 to-indigo-600", route: "/puzzle-game" },
  ];

  const handleGameModeClick = (modeId: string) => {
    playSound("buttonClick");
    if (!isPremium && (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0) {
      toast.error("Yetersiz oyun hakkı!", { description: "Oyun oynamak için hak satın alın." });
      return;
    }
    if (modeId === "tournament") {
      navigate("/tournament");
    } else {
      setSelectedMode(modeId);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background game-bg-animated game-hex-pattern overflow-hidden">
      {/* Main Content - blur when menu is open */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isMenuOpen ? 'blur-md pointer-events-none' : ''}`}>

      {/* Header Section */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex-shrink-0 p-3 safe-area-top"
      >
        <div className="game-glass-card rounded-2xl p-4 relative overflow-hidden">
          {/* User Info Row */}
          <div className="flex items-center justify-between mb-4">
            {/* Avatar & Name */}
            <div className="flex items-center gap-3">
              <motion.div
                whileTap={{ scale: 0.95 }}
                className="relative cursor-pointer game-avatar-ring"
                onClick={() => setShowAvatarView(true)}
              >
                <Avatar className="w-14 h-14 border-2 border-primary/50 shadow-lg">
                  <AvatarImage
                    src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                    alt="Profile"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground font-bold">
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                {isPremium && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-lg">
                    <Crown className="w-3 h-3 text-white" />
                  </div>
                )}
              </motion.div>

              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold game-gradient-text font-bungee tracking-wide">KELİMELE</h1>
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.username || user?.email?.split("@")[0]}
                </p>
                <p className="text-xs text-muted-foreground">{greeting}</p>
              </div>
            </div>

            {/* Ink Counter */}
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center cursor-pointer"
              onClick={() => {
                playSound("buttonClick");
                navigate("/market");
              }}
            >
              <div className="relative">
                <img src="/murekkepikon.png" alt="Mürekkep" className="w-10 h-10 object-contain drop-shadow-lg" />
              </div>
              <div className="game-ink-counter bg-gradient-to-r from-primary to-accent px-3 py-0.5 rounded-full mt-1 shadow-lg">
                <span className="text-sm font-bold text-primary-foreground">{profile?.ink_count || 0}</span>
              </div>
            </motion.div>
          </div>

          {/* Level Progress */}
          <div className="bg-background/30 backdrop-blur-sm rounded-xl p-3 border border-border/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
                  <Star className="w-4 h-4 text-white fill-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Seviye {levelData.level}</p>
                  <p className="text-xs text-muted-foreground">
                    {levelData.experience} / {levelData.nextLevelExp} XP
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">{(profile?.total_score || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Toplam Puan</p>
              </div>
            </div>

            <div className="relative h-2 bg-background/50 rounded-full overflow-hidden game-progress-bar">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-full"
              />
            </div>
          </div>

          {/* Credits Bar */}
          {!isPremium && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Kalan Haklar</span>
              {isUnlimitedLivesActive(profile) ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
                    <Infinity className="w-3 h-3 mr-1" /> Sınırsız
                  </Badge>
                  {unlimitedTimeLeft && (
                    <span className="text-xs text-orange-400 font-medium">{unlimitedTimeLeft}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {(() => {
                    const totalCredits = getTotalCredits();
                    const displayCredits = getDisplayCredits();
                    
                    // If total credits > 5, show as number badge
                    if (totalCredits > 5) {
                      return (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }, (_, i) => (
                              <motion.div
                                key={i}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="w-5 h-2 rounded-full bg-green-500"
                              />
                            ))}
                          </div>
                          <Badge className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 text-xs px-2 py-0.5">
                            +{totalCredits - 5}
                          </Badge>
                        </div>
                      );
                    }
                    
                    // Normal display for 5 or less
                    return (
                      <div className="flex gap-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <motion.div
                            key={i}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                            className={`w-5 h-2 rounded-full transition-all ${
                              i < totalCredits
                                ? i < 2
                                  ? "bg-red-500"
                                  : i < 4
                                    ? "bg-amber-500"
                                    : "bg-green-500"
                                : "bg-muted/50"
                            }`}
                          />
                        ))}
                      </div>
                    );
                  })()}
                  {timeUntilNextCredit && getTotalCredits() < 5 && (
                    <span className="text-xs text-orange-400 font-medium">+1 {timeUntilNextCredit}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Jokers */}
          <div className="mt-3 flex gap-2">
            {[
              { img: "/degistirIkon.png", name: "Değiştir", count: jokers.degistir },
              { img: "/fisildaIkon.png", name: "Fısılda", count: jokers.fisilida },
              { img: "/senyazIkon.png", name: "Sen Yaz", count: jokers.senYaz },
            ].map((joker, i) => (
              <motion.div
                key={joker.name}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex-1 game-joker-card bg-background/30 backdrop-blur-sm rounded-lg p-2 flex items-center gap-2 border border-border/30"
              >
                <img src={joker.img} alt={joker.name} className="w-6 h-6 object-contain" />
                <span className="text-xs font-medium text-foreground">×{joker.count}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Gift Premium Banner */}
      {isPremium && isGiftPremium(profile) && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex-shrink-0 px-3 pb-2"
        >
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm rounded-xl p-3 border border-amber-500/30 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">🎉 1 Hafta Premium Hediye!</p>
              <p className="text-xs text-muted-foreground">
                Bitiş: {profile?.premium_until ? new Date(profile.premium_until).toLocaleDateString("tr-TR") : ""}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Mini Games Horizontal Scroll */}
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex-shrink-0 px-3 py-2"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-primary" />
            Mini Oyunlar
          </h3>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" style={{ scrollSnapType: "x mandatory" }}>
          {miniGamesConfig.map((game, index) => (
            <motion.div
              key={game.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                playSound("buttonClick");
                navigate(game.route);
              }}
              className={`game-mini-pill flex-shrink-0 bg-gradient-to-br ${game.gradient} rounded-xl p-3 min-w-[100px] cursor-pointer relative overflow-hidden`}
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="relative z-10">
                <span className="text-2xl block mb-1">{game.icon}</span>
                <p className="text-xs font-bold text-white truncate">{game.title}</p>
                {game.disabled && game.cooldown && <p className="text-[10px] text-white/70 mt-0.5">{game.cooldown}</p>}
              </div>
              {game.disabled && <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] z-20" />}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Game Modes */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-24 scrollbar-hide" data-onboarding="game-modes">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            Oyun Modları
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {gameModesConfig.map((mode, index) => (
            <motion.div
              key={mode.id}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleGameModeClick(mode.id)}
              className={`game-mode-card bg-gradient-to-br ${mode.gradient} rounded-2xl overflow-hidden cursor-pointer aspect-[4/3]`}
            >
              <div className="relative h-full p-4 flex flex-col justify-between z-10">
                {/* Icon */}
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/30">
                  <mode.icon className="w-6 h-6 text-white" />
                </div>

                {/* Title & Description */}
                <div>
                  <h4 className="text-base font-bold text-white drop-shadow-lg">{mode.title}</h4>
                  <p className="text-xs text-white/80 mt-0.5">{mode.description}</p>
                </div>

                {/* Play Button */}
                <Button
                  size="sm"
                  className="game-btn-premium w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm font-semibold"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGameModeClick(mode.id);
                  }}
                >
                  <Play className="w-4 h-4 mr-1 fill-white" />
                  Oyna
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-4 flex gap-2"
        >
          <div className="game-stat-badge flex-1 rounded-xl p-3 text-center">
            <Target className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{profile?.daily_games || 0}</p>
            <p className="text-xs text-muted-foreground">Günlük Oyun</p>
          </div>
          <div className="game-stat-badge flex-1 rounded-xl p-3 text-center">
            <Flame className="w-4 h-4 text-orange-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{profile?.win_streak || 0}</p>
            <p className="text-xs text-muted-foreground">Seri</p>
          </div>
          <div className="game-stat-badge flex-1 rounded-xl p-3 text-center">
            <Trophy className="w-4 h-4 text-amber-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{profile?.wins || 0}</p>
            <p className="text-xs text-muted-foreground">Zafer</p>
          </div>
        </motion.div>
      </div>

      {/* Game Mode Selector Modals */}
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
              navigate(`/game/${selectedMode}?type=${gameType}`);
            }
            setSelectedMode(null);
          }}
          onClose={() => {
            playSound("buttonClick");
            setSelectedMode(null);
          }}
        />
      ) : null}

      {/* Slot Matchmaking Modal */}
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
      </div>

      {/* Floating Menu - outside blur wrapper */}
      <div data-onboarding="floating-menu" className="fixed bottom-0 left-0 right-0 z-50 game-floating-menu">
        <FloatingMenu onOpenChange={setIsMenuOpen} />
      </div>

      {/* Avatar View Dialog */}
      <AvatarViewDialog
        open={showAvatarView}
        onOpenChange={setShowAvatarView}
        avatarUrl={profile?.avatar_url || user?.user_metadata?.avatar_url || ""}
        username={profile?.username || user?.user_metadata?.username || user?.email?.split("@")[0] || "Oyuncu"}
      />
    </div>
  );
};

export default HomePage;
