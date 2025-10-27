import { useState, useEffect, useRef } from "react";
import { useMusic } from "@/contexts/MusicContext";
import { useGame } from "@/contexts/GameContext";
import GameModeSelector from "@/components/GameModeSelector";
import { FloatingMenu } from "@/components/FloatingMenu";
import { HeaderAnimation } from "@/components/HeaderAnimation";
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
import { Brain, Grid3X3, Shield } from "lucide-react";
import { useMemoryGame } from "@/hooks/useMemoryGame";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { nakamaService } from "@/services/nakamaService";
import { useUserRole } from "@/hooks/useUserRole";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";

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
  Volume2,
  VolumeX,
  Gift,
  Sparkles,
  RotateCcw,
} from "lucide-react";

// Check if user is in their first week (gift premium period)
const isGiftPremium = (profile: any) => {
  if (!profile?.premium_until) return false;

  const premiumUntil = new Date(profile.premium_until);
  const createdAt = new Date(profile.created_at);
  const daysDiff = Math.ceil((premiumUntil.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

  return daysDiff >= 6 && daysDiff <= 8 && premiumUntil > new Date();
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
  const [userAvatar, setUserAvatar] = useState<string>("");
  const [timeUntilNextCredit, setTimeUntilNextCredit] = useState<string>("");
  const { canPlay: canPlayMemory, timeUntilNextPlay } = useMemoryGame();
  const { startSearch, useNakama, isSearching, searchProgress, cancelSearch, nakamaMatch } = useMatchmaking();

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

  // Kalan süreyi hesaplama fonksiyonu
  const calculateTimeUntilNextCredit = () => {
    if (!profile?.last_credit_refresh || isPremium || profile?.game_credits >= 5) {
      setTimeUntilNextCredit("");
      return;
    }

    const now = new Date();
    const lastRefresh = new Date(profile.last_credit_refresh);
    const nextRefresh = new Date(lastRefresh.getTime() + 15 * 60 * 1000);

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
          const nextRefresh = new Date(lastRefresh.getTime() + 15 * 60 * 1000);

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

  // Fetch user profile data including avatar
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;

      const { data } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();

      if (data?.avatar_url) {
        setUserAvatar(data.avatar_url);
      }
    };

    fetchUserProfile();
  }, [user]);

  // Yeni bildirimleri kontrol et ve göster
  useEffect(() => {
    const checkNotifications = async () => {
      if (!user) return;

      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Bildirim kontrolü hatası:', error);
        return;
      }

      // Her okunmamış bildirimi göster
      notifications?.forEach((notification: any) => {
        if (notification.type === 'ban') {
          toast.error(notification.message, {
            duration: 10000,
          });
        } else if (notification.type === 'ban_lifted') {
          toast.success(notification.message, {
            duration: 7000,
          });
        } else {
          toast.info(notification.message, {
            duration: 5000,
          });
        }

        // Bildirimi okundu olarak işaretle
        supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id)
          .then(() => {});
      });
    };

    checkNotifications();
  }, [user]);

  const [showAvatarView, setShowAvatarView] = useState(false);

  const handleAvatarClick = () => {
    setShowAvatarView(true);
  };

  // Nakama match bulunduğunda otomatik yönlendir
  useEffect(() => {
    if (nakamaMatch?.matchId && showMatchmaking) {
      handleMatchFound(nakamaMatch.matchId);
    }
  }, [nakamaMatch?.matchId, showMatchmaking]);

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
      color: "bg-blue-500",
      gradient: "bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700",
      route: "/game/vs-computer",
    },
    {
      id: "private-room",
      title: "Özel Oda",
      description: "Arkadaşınla özel oda oluştur",
      icon: Users,
      color: "bg-green-500",
      gradient: "bg-gradient-to-br from-green-500 via-emerald-600 to-green-700",
      route: "/game/private-room",
    },
    {
      id: "random-match",
      title: "Rastgele Rakip",
      description: "Rastgele oyuncu ile eşleş",
      icon: Zap,
      color: "bg-purple-500",
      gradient: "bg-gradient-to-br from-purple-500 via-violet-600 to-purple-700",
      route: "/game/random-match",
    },
    {
      id: "tournament",
      title: "Turnuva",
      description: "8 kişilik turnuvaya katıl",
      icon: Trophy,
      color: "bg-yellow-500",
      gradient: "bg-gradient-to-br from-yellow-500 via-orange-500 to-yellow-600",
      route: "/tournament",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted px-4 pt-4 pb-2">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Birleştirilmiş Header ve Level Progress */}
        <Card className="border-0 relative overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.12)] bg-gradient-to-br from-primary/10 via-accent/8 to-primary/5 backdrop-blur-xl">
          <HeaderAnimation />
          
          {/* Dekoratif arka plan efektleri */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 animate-mystical-float pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl opacity-50 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-3xl opacity-40 pointer-events-none" />

          {/* Müzik Toggle */}
          <Button
            variant="outline"
            size="sm"
            className={`absolute top-3 right-3 z-20 w-11 h-11 rounded-full backdrop-blur-xl border-2 transition-all duration-500 hover:scale-110 active:scale-95 ${
              musicEnabled
                ? "bg-gradient-to-br from-primary/20 to-accent/15 hover:from-primary/30 hover:to-accent/25 border-primary/40 hover:border-primary/60 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 animate-premium-glow"
                : "bg-gradient-to-br from-muted/30 to-muted/20 hover:from-muted/40 hover:to-muted/30 border-muted-foreground/30 hover:border-muted-foreground/40 shadow-md"
            }`}
            onClick={() => {
              setMusicEnabled(!musicEnabled);
              playSound("buttonClick");
            }}
          >
            {musicEnabled ? (
              <Volume2 className="w-5 h-5 text-primary drop-shadow-lg" />
            ) : (
              <VolumeX className="w-5 h-5 text-muted-foreground" />
            )}
          </Button>

          <CardContent className="p-5 relative z-10">
            {/* Mobil optimized layout */}
            <div className="space-y-4">
              {/* Üst satır - Avatar ve Kelimeci başlığı */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative cursor-pointer group flex-shrink-0" onClick={handleAvatarClick}>
                    {/* Animasyonlu halka efekti */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-accent to-primary opacity-75 blur-md group-hover:blur-lg transition-all duration-500 animate-royal-pulse" />
                    <Avatar className="w-16 h-16 ring-[3px] ring-primary/30 ring-offset-2 ring-offset-background shadow-xl relative z-10 transition-all duration-500 group-hover:scale-110 group-hover:ring-primary/60 group-hover:shadow-2xl group-hover:shadow-primary/30">
                      <AvatarImage
                        src={userAvatar || user?.user_metadata?.avatar_url}
                        alt="Profile"
                        className="transition-all duration-500"
                        loading="eager"
                      />
                      <AvatarFallback className="bg-gradient-to-br from-primary via-accent to-primary text-white text-base font-bold">
                        <User className="w-7 h-7" />
                      </AvatarFallback>
                    </Avatar>
                    {/* Online indicator */}
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full border-2 border-background shadow-lg z-20 animate-pulse-slow" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h1
                      className="text-2xl md:text-3xl font-extrabold font-bungee tracking-wider uppercase bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent drop-shadow-2xl animate-luxury-shimmer bg-[length:200%_auto]"
                      style={{
                        textShadow: "2px 2px 4px rgba(0,0,0,0.2), 0 0 20px hsl(var(--primary) / 0.6)",
                      }}
                    >
                      KELİMECİ
                    </h1>
                    <p className="text-xs font-medium text-muted-foreground mt-1 flex items-center gap-1.5">
                      <span className="text-base">👋</span>
                      <span>Merhaba,</span>
                    </p>
                    <p className="text-base font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent truncate">
                      {profile?.username || user?.user_metadata?.username || user?.email?.split("@")[0]}
                    </p>
                  </div>
                </div>

                {/* Sağ taraf - Premium badge */}
                <div className="flex-shrink-0">
                  {isPremium && (
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 px-3 py-1.5 rounded-full shadow-lg shadow-yellow-400/30 animate-premium-glow">
                      <Crown className="w-4 h-4 text-yellow-900 drop-shadow" />
                      <span className="text-xs font-bold text-yellow-900 tracking-wide">PREMIUM</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Seviye progress - Real-time güncellemeler için profile state'ini direkt kullan */}
            <div className="relative bg-gradient-to-br from-primary/10 via-accent/5 to-primary/8 backdrop-blur-md rounded-2xl p-4 border-2 border-primary/20 shadow-xl overflow-hidden group hover:border-primary/40 transition-all duration-500">
              {/* Dekoratif arka plan */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-luxury-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 rounded-xl blur-sm opacity-75 animate-premium-glow" />
                      <div className="relative w-11 h-11 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-xl">
                        <Trophy className="w-6 h-6 text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                        <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                          Seviye {calculateLevel(profile?.total_score || 0).level}
                        </span>
                        <Sparkles className="w-4 h-4 text-primary animate-pulse-slow" />
                      </h3>
                      <p className="text-xs font-medium text-muted-foreground">
                        <span className="font-bold text-foreground">{calculateLevel(profile?.total_score || 0).experience}</span>
                        {" / "}
                        <span className="font-semibold">{calculateLevel(profile?.total_score || 0).nextLevelExp}</span>
                        {" EXP"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-lg md:text-xl font-black bg-gradient-to-br from-primary via-accent to-primary bg-clip-text text-transparent">
                      {(profile?.total_score || 0) > 9999
                        ? `${Math.floor((profile?.total_score || 0) / 1000)}k`
                        : (profile?.total_score || 0).toLocaleString()}
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground">Toplam Puan</div>
                  </div>
                </div>

                {/* Progress bar - Real-time güncellemeler */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">Seviye İlerlemesi</span>
                    <span className="text-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                      %{Math.round(
                        (calculateLevel(profile?.total_score || 0).experience /
                          calculateLevel(profile?.total_score || 0).nextLevelExp) *
                          100,
                      )}
                    </span>
                  </div>
                  <div className="relative w-full h-3 bg-gradient-to-r from-muted/30 to-muted/20 rounded-full overflow-hidden shadow-inner border border-primary/10">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-luxury-shimmer" />
                    {/* Progress */}
                    <div
                      className="relative h-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 rounded-full transition-all duration-1000 ease-out shadow-lg shadow-primary/30"
                      style={{
                        width: `${(calculateLevel(profile?.total_score || 0).experience / calculateLevel(profile?.total_score || 0).nextLevelExp) * 100}%`,
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-white/30 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Alt kısım - Hak barı ve istatistikler */}
            <div className="space-y-3 mt-4 pt-4 border-t-2 border-gradient-to-r from-transparent via-primary/20 to-transparent">
              {/* Hak barı - Real-time güncellemeler */}
              {!isPremium && (
                <div className="space-y-2 bg-gradient-to-br from-background/50 to-background/30 backdrop-blur-sm rounded-xl p-3 border border-primary/10 shadow-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary animate-pulse-slow" />
                      Oyun Hakları
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        {(profile?.game_credits || 0) + (profile?.bonus_credits || 0)}/5
                      </span>
                      {timeUntilNextCredit && profile?.game_credits < 5 && (
                        <span className="text-xs font-bold text-orange-600 bg-gradient-to-r from-orange-100 to-amber-100 px-2.5 py-1 rounded-full shadow-sm border border-orange-200 animate-pulse-slow">
                          +1 {timeUntilNextCredit}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 h-3 w-full">
                    {Array.from({ length: 5 }, (_, i) => {
                      const isActive = i < (profile?.game_credits || 0);
                      let segmentColor = "bg-muted/30";
                      let shadowClass = "";

                      if (isActive) {
                        switch (i + 1) {
                          case 1:
                            segmentColor = "bg-gradient-to-r from-red-500 to-red-600";
                            shadowClass = "shadow-md shadow-red-500/30";
                            break;
                          case 2:
                            segmentColor = "bg-gradient-to-r from-orange-400 to-orange-500";
                            shadowClass = "shadow-md shadow-orange-400/30";
                            break;
                          case 3:
                            segmentColor = "bg-gradient-to-r from-amber-400 to-yellow-500";
                            shadowClass = "shadow-md shadow-amber-400/30";
                            break;
                          case 4:
                            segmentColor = "bg-gradient-to-r from-lime-400 to-green-500";
                            shadowClass = "shadow-md shadow-lime-400/30";
                            break;
                          case 5:
                            segmentColor = "bg-gradient-to-r from-emerald-400 to-green-600";
                            shadowClass = "shadow-md shadow-emerald-400/30 animate-premium-glow";
                            break;
                          default:
                            segmentColor = "bg-muted/30";
                        }
                      }

                      return (
                        <div
                          key={i}
                          className={`flex-1 rounded-full transition-all duration-500 ease-out border border-white/10 ${segmentColor} ${shadowClass}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* İstatistik badge'leri - Real-time güncellemeler */}
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-foreground border-2 border-blue-400/30 text-xs font-bold px-3 py-1.5 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105">
                  <Target className="w-4 h-4 mr-1.5 text-blue-500 drop-shadow" />
                  <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    Günlük: {profile?.daily_games || 0}
                  </span>
                </Badge>
                <Badge className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-foreground border-2 border-amber-400/30 text-xs font-bold px-3 py-1.5 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all duration-300 hover:scale-105 animate-premium-glow">
                  <Zap className="w-4 h-4 mr-1.5 text-amber-500 drop-shadow animate-pulse-slow" />
                  <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    Seri: {profile?.win_streak || 0}
                  </span>
                </Badge>
              </div>

              {/* Joker Envanteri */}
              <div className="relative bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-purple-500/10 backdrop-blur-md rounded-2xl p-4 border-2 border-purple-400/20 shadow-xl overflow-hidden group hover:border-purple-400/40 transition-all duration-500">
                {/* Dekoratif arka plan */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent animate-luxury-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-purple-500 animate-pulse-slow drop-shadow" />
                    <h4 className="text-base font-extrabold bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                      Jokerlerim
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="relative bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-2.5 border-2 border-blue-400/30 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 hover:scale-105 transition-all duration-300">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg flex items-center justify-center shadow-md text-lg">
                          5️⃣
                        </div>
                        <span className="font-bold text-[10px] text-foreground text-center leading-tight">Değiştir</span>
                        <span className="font-black text-sm bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                          ×{jokers.degistir}
                        </span>
                      </div>
                    </div>
                    <div className="relative bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-2.5 border-2 border-purple-400/30 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 hover:scale-105 transition-all duration-300">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center shadow-md text-lg">
                          🗣️
                        </div>
                        <span className="font-bold text-[10px] text-foreground text-center leading-tight">Fısılda</span>
                        <span className="font-black text-sm bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                          ×{jokers.fisilida}
                        </span>
                      </div>
                    </div>
                    <div className="relative bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl p-2.5 border-2 border-emerald-400/30 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 hover:scale-105 transition-all duration-300">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center shadow-md text-lg">
                          ✍️
                        </div>
                        <span className="font-bold text-[10px] text-foreground text-center leading-tight">Sen Yaz</span>
                        <span className="font-black text-sm bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                          ×{jokers.senYaz}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gift Premium Banner */}
        {isPremium && isGiftPremium(profile) && (
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
        )}

        {/* Game Modes */}
        <div className="flex-1 min-h-0">
          {/* Üst Oyunlar - Scroll edilebilir */}
          <div className="mb-3">
            <div className="w-full overflow-x-auto scrollbar-hide">
              <div className="flex gap-3 pb-2" style={{ minWidth: "max-content" }}>
                {/* Günlük Çark */}
                <div
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

                {/* Tetris Game */}
                <div
                  className="bg-gradient-to-r from-cyan-500 to-teal-500 rounded-lg px-4 py-2 flex items-center shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 min-w-[200px]"
                  onClick={() => navigate("/tetris-game")}
                >
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-white font-painter">Morles Oyunu</h2>
                  </div>
                  {/* Mini Tetris İkonları - Dikdörtgen + L blok */}
                  <div className="relative w-12 h-12 flex items-center justify-center gap-1">
                    {/* 6 birimli dikdörtgen blok (3x2) */}
                    <div className="flex flex-col gap-0.5 animate-pulse" style={{ animationDelay: "0s" }}>
                      <div className="flex gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#bf00ff' }}></div>
                        <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#bf00ff' }}></div>
                      </div>
                      <div className="flex gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#bf00ff' }}></div>
                        <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#bf00ff' }}></div>
                      </div>
                      <div className="flex gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#bf00ff' }}></div>
                        <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#bf00ff' }}></div>
                      </div>
                    </div>
                    
                    {/* L blok (azaltılmış - 2 satır) */}
                    <div className="flex flex-col gap-0.5 animate-pulse" style={{ animationDelay: "0.3s" }}>
                      <div className="flex gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#b100ff' }}></div>
                        <div className="w-1.5 h-1.5 bg-transparent"></div>
                      </div>
                      <div className="flex gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#b100ff' }}></div>
                        <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: '#b100ff' }}></div>
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
                    <h2 className="text-xl font-semibold text-white font-painter">Reaktör Oyunu</h2>
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
                    <h2 className="text-xl font-semibold text-white font-painter">Yılan Oyunu</h2>
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
                    <h2 className="text-xl font-semibold text-white font-painter">Adım Oyunu</h2>
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
                    <h2 className="text-xl font-semibold text-white font-painter">Puzzle Oyunu</h2>
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

          <div className="h-80 overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
              {gameModesConfig.map((mode) => (
                <Card
                  key={mode.id}
                  className={`cursor-pointer border-0 overflow-hidden ${mode.gradient}`}
                  onClick={() => {
                    playSound("buttonClick");
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
                        <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/30">
                          <mode.icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-base text-white drop-shadow-lg">{mode.title}</CardTitle>
                          <CardDescription className="text-white/80 font-medium text-sm">
                            {mode.description}
                          </CardDescription>
                        </div>
                      </div>
                      {mode.id === "vs-computer" && (
                        <img
                          src="/lovable-uploads/8008dff7-7ead-48e2-b47e-fde31770af08.png"
                          alt="Computer player"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-60"
                        />
                      )}
                      {mode.id === "private-room" && (
                        <img
                          src="/lovable-uploads/e5d22948-34db-460d-adff-dc6284efcf50.png"
                          alt="Private room"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-60"
                        />
                      )}
                      {mode.id === "random-match" && (
                        <img
                          src="/lovable-uploads/a91ec87e-aaac-47fa-93fa-22e1f0270999.png"
                          alt="Random match"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-60"
                        />
                      )}
                      {mode.id === "tournament" && (
                        <img
                          src="/lovable-uploads/70bff2fc-4ab0-4705-b1f1-d3cf41bbc7b5.png"
                          alt="Tournament"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-60"
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge
                        variant="secondary"
                        className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30"
                      >
                        <Clock className="w-3 h-3 mr-1" />2 Dakika
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30"
                      >
                        <Target className="w-3 h-3 mr-1" />
                        500 Puan
                      </Badge>
                    </div>
                    <Button
                      className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 hover:border-white/50 backdrop-blur-sm font-semibold"
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
        <FloatingMenu />

        {/* Avatar View Dialog */}
        <AvatarViewDialog
          open={showAvatarView}
          onOpenChange={setShowAvatarView}
          avatarUrl={userAvatar || user?.user_metadata?.avatar_url || ''}
          username={profile?.username || user?.user_metadata?.username || user?.email?.split("@")[0] || 'Oyuncu'}
        />
      </div>
    </div>
  );
};

export default HomePage;
