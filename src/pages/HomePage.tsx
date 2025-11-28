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
import { OnboardingTutorial } from "@/components/OnboardingTutorial";

import { Bot, Users, Trophy, Clock, Target, User, Crown, Zap, Camera, Gift, Sparkles, RotateCcw } from "lucide-react";

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
      icon: Bot, // İkon geri geldi
      route: "/game/vs-computer",
    },
    {
      id: "private-room",
      title: "Özel Oda",
      icon: Users, // İkon geri geldi
      route: "/game/private-room",
    },
    {
      id: "random-match",
      title: "Rastgele Rakip",
      icon: Zap, // İkon geri geldi
      route: "/game/random-match",
    },
    {
      id: "tournament",
      title: "Turnuva",
      icon: Trophy, // İkon geri geldi
      route: "/tournament",
    },
  ];

  return (
    <>
      {/* Onboarding Tutorial */}
      <OnboardingTutorial />

      <div className="min-h-screen bg-gradient-to-br from-background to-muted px-4 pt-4 pb-2 native-safe-container">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Birleştirilmiş Header ve Level Progress */}
          {/* Birleştirilmiş Header ve Level Progress - YENİ TASARIM */}
          <Card className="border-0 shadow-2xl relative overflow-hidden group">
            {/* 1. KATMAN: Arka Plan Görseli */}
            {/* Buraya 'headerBack.png' adında hafif koyu, soyut bir görsel koyarsan efsane durur. */}
            <div className="absolute inset-0 z-0">
              <img
                src="/headerBack.png" // Bunu public klasörüne eklemelisin, yoksa gradient görünür.
                alt="Background"
                className="w-full h-full object-cover opacity-100"
                onError={(e) => {
                  // Eğer resim yoksa şık bir gradient gösterir
                  e.currentTarget.style.display = "none";
                }}
              />
              {/* Görselin üzerine gelen karartma perdesi (Yazılar okunsun diye) */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/80 backdrop-blur-[2px]" />
            </div>

            {/* Header Animasyonu (Varsa görselin üstünde kalsın) */}
            <div className="relative z-0 opacity-50 mix-blend-overlay">
              <HeaderAnimation />
            </div>

            <CardContent className="p-4 relative z-10">
              {/* Mobil optimized layout */}
              <div className="space-y-3">
                {/* Üst satır - Avatar ve Kelimeci başlığı */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative cursor-pointer group/avatar flex-shrink-0" onClick={handleAvatarClick}>
                      {/* Avatar etrafına parlak halka efekti */}
                      <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur opacity-75 group-hover/avatar:opacity-100 transition duration-500"></div>
                      <Avatar className="w-14 h-14 ring-2 ring-white/90 shadow-2xl relative">
                        <AvatarImage
                          src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                          alt="Profile"
                          className="object-cover"
                          loading="eager"
                        />
                        <AvatarFallback className="bg-zinc-900 text-white font-bold border-2 border-white/20">
                          <User className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Başlık artık daha parlak ve beyaz ağırlıklı */}
                      <h1
                        className="text-xl font-bold font-bungee tracking-wider uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                        style={{
                          textShadow: "0 0 20px rgba(168, 85, 247, 0.5)",
                        }}
                      >
                        KELİMELE
                      </h1>
                      <p className="text-xs text-white/90 font-medium tracking-wide">{greeting}</p>
                      <p className="text-sm font-bold text-white truncate drop-shadow-md">
                        {profile?.username || user?.user_metadata?.username || user?.email?.split("@")[0]}
                      </p>
                    </div>
                  </div>

                  {/* Sağ taraf - Mürekkep ve Premium */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="relative group cursor-pointer transform hover:scale-110 transition-transform duration-200"
                        onClick={() => {
                          playSound("buttonClick");
                          navigate("/market");
                        }}
                      >
                        {/* Mürekkep ikonu arkasına glow */}
                        <div className="absolute inset-0 bg-purple-500 rounded-full blur-md opacity-50" />
                        <img
                          src="/murekkepikon.png"
                          alt="Mürekkep"
                          className="w-10 h-10 object-contain relative z-10 drop-shadow-xl"
                        />
                      </div>

                      <div className="bg-black/60 backdrop-blur-md px-3 py-0.5 rounded-full border border-white/10 shadow-xl min-w-[60px] flex items-center justify-center">
                        <span className="text-sm font-bold text-white">{profile?.ink_count || 0}</span>
                      </div>
                    </div>

                    {isPremium && (
                      <div className="bg-yellow-500/20 backdrop-blur-sm px-2 py-0.5 rounded flex items-center gap-1 border border-yellow-500/30">
                        <Crown className="w-3 h-3 text-yellow-400" />
                        <span className="text-[10px] text-yellow-100 font-bold uppercase tracking-wider">Premıum</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Seviye Paneli - Glassmorphism Tasarımı */}
              <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 border border-white/10 shadow-lg mt-3 group-hover:border-white/20 transition-colors duration-300">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0 border border-white/20">
                      <Trophy className="w-4 h-4 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white">
                        Seviye {calculateLevel(profile?.total_score || 0).level}
                      </h3>
                      <p className="text-xs text-white/60 truncate font-mono">
                        {calculateLevel(profile?.total_score || 0).experience} /{" "}
                        {calculateLevel(profile?.total_score || 0).nextLevelExp} EXP
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-base font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
                      {(profile?.total_score || 0) > 9999
                        ? `${Math.floor((profile?.total_score || 0) / 1000)}k`
                        : (profile?.total_score || 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-white/50 uppercase tracking-widest">Puan</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="w-full bg-black/50 rounded-full h-2 overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                      style={{
                        width: `${(calculateLevel(profile?.total_score || 0).experience / calculateLevel(profile?.total_score || 0).nextLevelExp) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Alt Kısım - Haklar ve Jokerler */}
              <div className="space-y-2 mt-3 pt-2 border-t border-white/10">
                {!isPremium && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/70 font-medium">Oyun Enerjisi</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {(profile?.game_credits || 0) + (profile?.bonus_credits || 0)}/5
                        </span>
                        {timeUntilNextCredit && profile?.game_credits < 5 && (
                          <span className="text-[10px] font-mono text-orange-300 bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-500/30">
                            {timeUntilNextCredit}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Enerji Barları - Daha parlak */}
                    <div className="flex gap-1 h-1.5 w-full">
                      {Array.from({ length: 5 }, (_, i) => {
                        const isActive = i < (profile?.game_credits || 0);
                        return (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-all duration-500 ${
                              isActive
                                ? "bg-gradient-to-r from-green-400 to-emerald-600 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                                : "bg-white/10"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* İstatistikler */}
                <div className="flex flex-wrap gap-2 justify-center py-1">
                  <div className="bg-black/30 text-white/90 border border-white/10 px-2 py-1 rounded text-[10px] flex items-center backdrop-blur-sm">
                    <Target className="w-3 h-3 mr-1 text-blue-400" />
                    Günlük: {profile?.daily_games || 0}
                  </div>
                  <div className="bg-black/30 text-white/90 border border-white/10 px-2 py-1 rounded text-[10px] flex items-center backdrop-blur-sm">
                    <Zap className="w-3 h-3 mr-1 text-yellow-400" />
                    Seri: {profile?.win_streak || 0}
                  </div>
                </div>

                {/* Joker Envanteri - Yarı saydam panel */}
                <div className="bg-white/5 backdrop-blur-sm rounded-lg p-2 border border-white/5 flex justify-between items-center">
                  {/* Jokerler buraya aynı mantıkla eklenebilir, ikonları biraz parlatabiliriz */}
                  <div className="flex gap-3 text-xs w-full justify-around">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-lg grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        5️⃣
                      </span>
                      <span className="font-bold text-white text-[10px]">x{jokers.degistir}</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-lg grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        🗣️
                      </span>
                      <span className="font-bold text-white text-[10px]">x{jokers.fisilida}</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-lg grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        ✍️
                      </span>
                      <span className="font-bold text-white text-[10px]">x{jokers.senYaz}</span>
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

                  {/* Morles Game */}
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-teal-500 rounded-lg px-4 py-2 flex items-center shadow-md cursor-pointer hover:shadow-lg transition-all duration-300 min-w-[200px]"
                    onClick={() => navigate("/morles-game")}
                  >
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-white font-painter">Morles Oyunu</h2>
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
                      <div className="absolute top-0 left-0 text-[8px] text-yellow-300 font-bold animate-pulse">
                        +10
                      </div>
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

            {/* --- YENİ OYUN MODU KARTLARI (CSS & SVG ONLY) --- */}
            <div className="h-auto pb-4" data-onboarding="game-modes">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {gameModesConfig.map((mode) => {
                  // Her moda özel renk teması tanımlıyoruz
                  const getModeStyles = (id: string) => {
                    switch (id) {
                      case "vs-computer":
                        return {
                          gradient: "from-cyan-500 to-blue-600",
                          bg: "bg-blue-950/40",
                          border: "border-blue-500/30 group-hover:border-blue-400",
                          text: "text-blue-400",
                          glow: "group-hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.5)]",
                          iconBg: "bg-blue-500/20",
                        };
                      case "private-room":
                        return {
                          gradient: "from-emerald-400 to-green-600",
                          bg: "bg-emerald-950/40",
                          border: "border-emerald-500/30 group-hover:border-emerald-400",
                          text: "text-emerald-400",
                          glow: "group-hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)]",
                          iconBg: "bg-emerald-500/20",
                        };
                      case "random-match":
                        return {
                          gradient: "from-purple-400 to-pink-600",
                          bg: "bg-purple-950/40",
                          border: "border-purple-500/30 group-hover:border-purple-400",
                          text: "text-purple-400",
                          glow: "group-hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)]",
                          iconBg: "bg-purple-500/20",
                        };
                      case "tournament":
                        return {
                          gradient: "from-amber-300 to-orange-500",
                          bg: "bg-orange-950/40",
                          border: "border-amber-500/30 group-hover:border-amber-400",
                          text: "text-amber-400",
                          glow: "group-hover:shadow-[0_0_30px_-5px_rgba(245,158,11,0.5)]",
                          iconBg: "bg-amber-500/20",
                        };
                      default:
                        return {
                          gradient: "from-gray-500 to-zinc-600",
                          bg: "bg-zinc-900",
                          border: "border-white/10",
                          text: "text-gray-400",
                          glow: "",
                          iconBg: "bg-white/10",
                        };
                    }
                  };

                  const styles = getModeStyles(mode.id);

                  return (
                    <Card
                      key={mode.id}
                      className={`group relative h-36 overflow-hidden cursor-pointer transition-all duration-500 
                        ${styles.bg} ${styles.border} ${styles.glow} border backdrop-blur-md hover:-translate-y-1`}
                      onClick={() => {
                        playSound("buttonClick");

                        // Kredi Kontrolü
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
                      {/* 1. KATMAN: Arka Plan Dokusu (Noktalı Pattern) */}
                      <div
                        className="absolute inset-0 opacity-[0.07]"
                        style={{
                          backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
                          backgroundSize: "16px 16px",
                        }}
                      />

                      {/* 2. KATMAN: Dekoratif Dev İkon (Sağ Arka) */}
                      {/* İkonun kartın dışına taşmasını ve dönmesini sağlayan efekt */}
                      <div
                        className={`absolute -right-8 -bottom-8 opacity-[0.15] transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-12 group-hover:opacity-30`}
                      >
                        <mode.icon className={`w-40 h-40 ${styles.text}`} />
                      </div>

                      {/* 3. KATMAN: İçerik */}
                      <div className="relative z-10 h-full flex flex-col justify-between p-5">
                        {/* Üst Kısım: İkon ve Başlık */}
                        <div className="flex items-start gap-4">
                          {/* İkon Kutusu */}
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border border-white/5 ${styles.iconBg} backdrop-blur-sm group-hover:scale-110 transition-transform duration-300`}
                          >
                            <mode.icon className="w-6 h-6 text-white drop-shadow-md" />
                          </div>

                          <div>
                            <h3 className="text-lg font-black text-white uppercase tracking-wide drop-shadow-md font-exo">
                              {mode.title}
                            </h3>
                            <p className="text-xs text-white/60 font-medium mt-0.5 line-clamp-1">
                              {mode.id === "vs-computer"
                                ? "Çevrimdışı pratik yap"
                                : mode.id === "private-room"
                                  ? "Arkadaşını davet et"
                                  : mode.id === "random-match"
                                    ? "Gerçek rakiplerle yarış"
                                    : "Büyük ödülü kazan"}
                            </p>
                          </div>
                        </div>

                        {/* Alt Kısım: Etiket ve Buton Görünümlü Action */}
                        <div className="flex items-center justify-between mt-auto pl-1">
                          {/* Sol Etiket */}
                          <div>
                            {mode.id === "tournament" ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-bold bg-amber-500/10 text-amber-200 border-amber-500/20 px-2 h-5"
                              >
                                ÖDÜLLÜ
                              </Badge>
                            ) : (
                              <div
                                className={`text-[10px] font-bold uppercase tracking-widest opacity-50 ${styles.text}`}
                              >
                                {mode.id === "vs-computer" ? "EĞİTİM MODU" : "ONLINE"}
                              </div>
                            )}
                          </div>

                          {/* Sağ Aksiyon (Play Butonu Görünümlü) */}
                          <div
                            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider group-hover:translate-x-1 transition-transform duration-300 ${styles.text}`}
                          >
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                              BAŞLA
                            </span>
                            <div
                              className={`w-8 h-8 rounded-full border border-current flex items-center justify-center ${styles.iconBg} group-hover:bg-white/10`}
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. KATMAN: Alt Parlak Çizgi (Progress bar gibi) */}
                      <div
                        className={`absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r ${styles.gradient} opacity-40 group-hover:opacity-100 group-hover:h-[4px] transition-all duration-300`}
                      />
                    </Card>
                  );
                })}
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
          <div data-onboarding="floating-menu">
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
      </div>
    </>
  );
};

export default HomePage;
