import { useState, useEffect } from "react";
import { useMusic } from "@/contexts/MusicContext";
import { useGame } from "@/contexts/GameContext";
import GameModeSelector from "@/components/GameModeSelector";
import { FloatingMenu } from "@/components/FloatingMenu";
import { HeaderAnimation } from "@/components/HeaderAnimation";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card"; // Sadeleştirdim
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PrivateRoomModal from "@/components/PrivateRoomModal";
import { SlotMatchmaking } from "@/components/SlotMatchmaking";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useJokerInventory } from "@/hooks/useJokerInventory";
import { Brain, Grid3X3, Zap, Trophy, User, Crown, Gift, Play, Gamepad2, Ghost, Activity } from "lucide-react"; // Yeni ikonlar ekledim
import { useMemoryGame } from "@/hooks/useMemoryGame";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";

// --- SABİT DEĞERLER VE YARDIMCI FONKSİYONLAR ---

const greetingMessages = [
  "Harika görünüyorsun! 🌟", "Bugün şanslı gününüz! 🍀", "Kazanmaya hazır mısın? 🎯",
  "Şampiyon geri döndü! 👑", "Enerjin bulaşıcı! 🎭", "Bugün efsanesin! 🦄",
];

const getRandomGreeting = () => greetingMessages[Math.floor(Math.random() * greetingMessages.length)];

const isGiftPremium = (profile: any) => {
  if (!profile?.premium_until) return false;
  const premiumUntil = new Date(profile.premium_until);
  const createdAt = new Date(profile.created_at);
  const daysDiff = Math.ceil((premiumUntil.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  return daysDiff >= 6 && daysDiff <= 8 && premiumUntil > new Date();
};

const HomePage = () => {
  // --- HOOKS & STATE ---
  const { user } = useAuth();
  const { profile, isPremium, refreshProfile } = useUser();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { startBackgroundMusic } = useMusic();
  const { jokers } = useJokerInventory();
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [matchmakingGameType, setMatchmakingGameType] = useState<"timed" | "score">("timed");
  const [matchmakingKey, setMatchmakingKey] = useState<number>(0);
  const [timeUntilNextCredit, setTimeUntilNextCredit] = useState<string>("");
  const { canPlay: canPlayMemory, timeUntilNextPlay } = useMemoryGame();
  const { startSearch, isSearching, searchProgress, cancelSearch } = useMatchmaking();
  const [showAvatarView, setShowAvatarView] = useState(false);
  
  const [greeting] = useState(() => {
    const sessionGreeting = sessionStorage.getItem("sessionGreeting");
    if (sessionGreeting) return sessionGreeting;
    const newGreeting = getRandomGreeting();
    sessionStorage.setItem("sessionGreeting", newGreeting);
    return newGreeting;
  });

  // --- HESAPLAMA FONKSİYONLARI ---
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
      const { error } = await supabase.from("profiles").update({
          game_credits: Math.min(currentCredits + 1, 5),
          last_credit_refresh: new Date().toISOString(),
        }).eq("id", user.id);
      if (!error) {
        await refreshProfile();
        toast.success(`🎮 +1 Kredi eklendi!`);
        playSound("buttonClick");
      }
    } catch (error) { console.error(error); }
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (!isPremium && profile) {
      calculateTimeUntilNextCredit();
      const interval = setInterval(() => {
        calculateTimeUntilNextCredit();
        if (profile?.last_credit_refresh && !isPremium && profile.game_credits < 5) {
          const now = new Date();
          const lastRefresh = new Date(profile.last_credit_refresh);
          const nextRefresh = new Date(lastRefresh.getTime() + 15 * 60 * 1000);
          if (now >= nextRefresh) {
            refreshCredits();
            setTimeout(() => refreshProfile(), 500);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [profile, isPremium]);

  useEffect(() => { startBackgroundMusic(); }, [startBackgroundMusic]);

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
    const handleStartDemoGame = () => navigate("/game/vs-computer?type=timed&demo=true");
    window.addEventListener("startDemoGame", handleStartDemoGame);
    return () => window.removeEventListener("startDemoGame", handleStartDemoGame);
  }, [navigate]);

  // --- KONFIGÜRASYONLAR ---
  
  // Ana Oyun Modları (Büyük Kartlar)
  const mainGameModes = [
    {
      id: "vs-computer",
      title: "YZ'ye Karşı",
      desc: "Yapay zekayı yenebilir misin?",
      image: "/bilgisayarKart.png", // Veya soyut bir AI görseli
      route: "/game/vs-computer",
      color: "from-blue-600 to-indigo-900"
    },
    {
      id: "private-room",
      title: "Özel Oda",
      desc: "Arkadaşlarınla kapış.",
      image: "/ozelKart.png",
      route: "/game/private-room",
      color: "from-purple-600 to-fuchsia-900"
    },
    {
      id: "random-match",
      title: "Rastgele Rakip",
      desc: "Dünyadan biriyle eşleş.",
      image: "/rastgeleKart.png",
      route: "/game/random-match",
      color: "from-orange-600 to-red-900"
    },
    {
      id: "tournament",
      title: "Turnuva",
      desc: "Büyük ödül için yarış.",
      image: "/turnuvaKart.png",
      route: "/tournament",
      color: "from-emerald-600 to-teal-900"
    },
  ];

  // Diğer Mini Oyunlar (Alt Liste - Clean)
  const arcadeGames = [
    { id: "morles", title: "Morles", route: "/morles-game", icon: <Grid3X3 className="w-5 h-5"/>, color: "bg-cyan-500" },
    { id: "reactor", title: "Reaktör", route: "/reactor-runner", icon: <Activity className="w-5 h-5"/>, color: "bg-green-500" },
    { id: "snake", title: "Yılan", route: "/snake-game", icon: <Gamepad2 className="w-5 h-5"/>, color: "bg-pink-500" },
    { id: "ghost", title: "Adım", route: "/grid-simon-says", icon: <Ghost className="w-5 h-5"/>, color: "bg-indigo-500" },
  ];

  const levelInfo = calculateLevel(profile?.total_score || 0);

  // --- RENDER ---
  return (
    <>
      <OnboardingTutorial />

      {/* BACKGROUND: Koyu, modern, premium zemin */}
      <div className="min-h-screen bg-[#0a0a0f] text-slate-100 pb-24 native-safe-container selection:bg-purple-500/30">
        
        {/* HEADER SECTION */}
        <div className="relative pt-6 px-4 pb-8 bg-gradient-to-b from-[#1a1a24] to-[#0a0a0f] rounded-b-[2.5rem] shadow-2xl border-b border-white/5">
          <div className="max-w-md mx-auto space-y-5">
            
            {/* Üst Bar: Avatar & İsim & Puan */}
            <div className="flex items-center gap-4">
              <div 
                className="relative group cursor-pointer" 
                onClick={() => setShowAvatarView(true)}
              >
                {/* Avatar Glow */}
                <div className="absolute -inset-0.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full blur opacity-60 group-hover:opacity-100 transition duration-500"></div>
                <Avatar className="w-16 h-16 border-2 border-[#1a1a24] relative">
                  <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} className="object-cover" />
                  <AvatarFallback className="bg-slate-800 text-white font-bold">
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                {/* Premium Rozeti */}
                {isPremium && (
                  <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1 border border-[#1a1a24]">
                    <Crown className="w-3 h-3 text-white fill-current" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-black tracking-tight text-white font-bungee">KELİMELE</h1>
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-xs font-bold text-yellow-100/90">
                      {(profile?.total_score || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-400 font-medium truncate">
                  {profile?.username || user?.email?.split("@")[0]}
                </p>
                {/* Level Progress Bar - İnce ve Şık */}
                <div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-pink-500"
                    style={{ width: `${(levelInfo.experience / levelInfo.nextLevelExp) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                  <span>Lvl {levelInfo.level}</span>
                  <span>{levelInfo.nextLevelExp - levelInfo.experience} XP Kaldı</span>
                </div>
              </div>
            </div>

            {/* Stats Bar: Enerji & Jokerler */}
            <div className="grid grid-cols-2 gap-3">
               {/* Enerji */}
               <div className="bg-[#13131a] rounded-xl p-3 border border-white/5 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                      <Zap className="w-3 h-3 text-purple-400" /> Enerji
                    </span>
                    <span className="text-xs font-bold text-white">
                      {Math.min((profile?.game_credits || 0), 5)}/5
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[0,1,2,3,4].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
                        i < (profile?.game_credits || 0) 
                        ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]' 
                        : 'bg-slate-800'
                      }`} />
                    ))}
                  </div>
                  {timeUntilNextCredit && (
                     <p className="text-[10px] text-slate-500 mt-1 text-right">{timeUntilNextCredit}</p>
                  )}
               </div>

               {/* Jokerler (Basitleştirilmiş Görünüm) */}
               <div className="bg-[#13131a] rounded-xl p-2 border border-white/5 flex items-center justify-between px-4">
                  <div className="text-center">
                    <div className="text-lg">🔄</div>
                    <div className="text-[10px] font-bold text-slate-300">x{jokers.degistir}</div>
                  </div>
                  <div className="w-px h-8 bg-white/5"></div>
                  <div className="text-center">
                    <div className="text-lg">🗣️</div>
                    <div className="text-[10px] font-bold text-slate-300">x{jokers.fisilida}</div>
                  </div>
                  <div className="w-px h-8 bg-white/5"></div>
                  <div className="text-center">
                    <div className="text-lg">✍️</div>
                    <div className="text-[10px] font-bold text-slate-300">x{jokers.senYaz}</div>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="max-w-md mx-auto px-4 -mt-4 relative z-10 space-y-6">

          {/* MAIN ACTIONS (Yan Yana İki Büyük Buton) */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/wheel")}
              className="group relative overflow-hidden rounded-2xl bg-[#1E1E2E] border border-purple-500/20 p-4 h-24 flex flex-col items-center justify-center gap-2 hover:border-purple-500/50 transition-all active:scale-95 shadow-lg shadow-black/20"
            >
               <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-transparent group-hover:from-purple-600/20 transition-all" />
               <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors text-purple-400">
                  <Gift className="w-4 h-4" />
               </div>
               <span className="text-sm font-bold text-white relative z-10">Günlük Çark</span>
            </button>

            <button
              onClick={() => navigate("/memory-game")}
              className={`group relative overflow-hidden rounded-2xl bg-[#1E1E2E] border p-4 h-24 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-black/20
                ${canPlayMemory ? 'border-purple-500/20 hover:border-purple-500/50' : 'border-slate-800 opacity-70'}
              `}
            >
               <div className="absolute inset-0 bg-gradient-to-br from-pink-600/10 to-transparent group-hover:from-pink-600/20 transition-all" />
               <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
                  ${canPlayMemory ? 'bg-pink-500/20 text-pink-400 group-hover:bg-pink-500 group-hover:text-white' : 'bg-slate-800 text-slate-500'}
               `}>
                  <Brain className="w-4 h-4" />
               </div>
               <span className="text-sm font-bold text-white relative z-10">Hafıza</span>
               {!canPlayMemory && (
                 <span className="text-[10px] text-slate-500 absolute bottom-1">{timeUntilNextPlay}</span>
               )}
            </button>
          </div>

          {/* GAME MODES (Overlay Style Cards) */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2 px-1">
                <Gamepad2 className="w-4 h-4 text-purple-500" />
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Oyun Modları</h2>
             </div>
             
             <div className="grid gap-4">
                {mainGameModes.map((mode) => (
                   <div 
                      key={mode.id}
                      onClick={() => {
                        playSound("buttonClick");
                        if(mode.id === "tournament") navigate("/tournament");
                        else setSelectedMode(mode.id);
                      }}
                      className="relative h-32 w-full rounded-2xl overflow-hidden cursor-pointer group shadow-lg"
                    >
                      {/* Arkaplan Resmi */}
                      <img 
                        src={mode.image} 
                        alt={mode.title}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      {/* Karanlık Perde */}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
                      
                      {/* İçerik */}
                      <div className="absolute inset-0 p-5 flex flex-col justify-center items-start">
                        <h3 className="text-xl font-black text-white font-bungee tracking-wide drop-shadow-lg">
                           {mode.title}
                        </h3>
                        <p className="text-xs text-slate-300 font-medium mb-3 max-w-[150px]">
                           {mode.desc}
                        </p>
                        <Button 
                          size="sm" 
                          className="bg-orange-500 hover:bg-orange-600 text-white border-none rounded-full px-4 h-8 text-xs font-bold shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform"
                        >
                          <Play className="w-3 h-3 mr-1 fill-current" /> OYNA
                        </Button>
                      </div>
                   </div>
                ))}
             </div>
          </div>

          {/* ARCADE (Mini Games Horizontal Scroll) */}
          <div className="pb-4">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1">Atari Salonu</h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {arcadeGames.map((game) => (
                <div 
                  key={game.id}
                  onClick={() => navigate(game.route)}
                  className="flex-shrink-0 w-20 flex flex-col items-center gap-2 cursor-pointer group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#1E1E2E] border border-white/5 flex items-center justify-center group-hover:border-purple-500/50 transition-colors shadow-lg">
                    <div className={`text-slate-400 group-hover:text-white transition-colors`}>
                      {game.icon}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 group-hover:text-purple-400 text-center">
                    {game.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* --- MODALS --- */}
        {selectedMode === "private-room" ? (
          <PrivateRoomModal
            onClose={() => setSelectedMode(null)}
            onStartGame={(roomId, type) => {
              setSelectedMode(null);
              navigate(`/game/random-match?room=${roomId}&type=${type}`);
            }}
          />
        ) : selectedMode === "random-match" ? (
          <GameModeSelector
            mode={selectedMode}
            onStart={(type) => {
              setSelectedMode(null);
              setMatchmakingGameType(type);
              setMatchmakingKey(Date.now());
              setShowMatchmaking(true);
              setTimeout(() => startSearch(type), 100);
            }}
            onClose={() => setSelectedMode(null)}
          />
        ) : selectedMode && (
          <GameModeSelector
            mode={selectedMode}
            onStart={(type) => {
              const mode = mainGameModes.find((m) => m.id === selectedMode);
              if (mode) navigate(`${mode.route}?type=${type}`);
              setSelectedMode(null);
            }}
            onClose={() => setSelectedMode(null)}
          />
        )}

        {showMatchmaking && (
          <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm">
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

        <div data-onboarding="floating-menu">
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
