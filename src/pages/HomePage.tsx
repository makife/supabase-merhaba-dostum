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
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PrivateRoomModal from "@/components/PrivateRoomModal";
import { SlotMatchmaking } from "@/components/SlotMatchmaking";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useJokerInventory } from "@/hooks/useJokerInventory";
// İkon setini genişlettik
import { 
  Brain, Grid3X3, Zap, Trophy, User, Crown, Gift, Play, 
  Gamepad2, Ghost, Activity, Target, Flame, Ticket 
} from "lucide-react";
import { useMemoryGame } from "@/hooks/useMemoryGame";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";

// --- SABİT DEĞERLER ---
const greetingMessages = [
  "Harika görünüyorsun! 🌟", "Bugün şanslı gününüz! 🍀", "Kazanmaya hazır mısın? 🎯",
  "Şampiyon geri döndü! 👑", "Enerjin bulaşıcı! 🎭", "Bugün efsanesin! 🦄",
];

const getRandomGreeting = () => greetingMessages[Math.floor(Math.random() * greetingMessages.length)];

const HomePage = () => {
  // --- HOOKS ---
  const { user } = useAuth();
  const { profile, isPremium, refreshProfile } = useUser();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { startBackgroundMusic } = useMusic();
  const { jokers } = useJokerInventory();
  
  // State Yönetimi
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [matchmakingGameType, setMatchmakingGameType] = useState<"timed" | "score">("timed");
  const [matchmakingKey, setMatchmakingKey] = useState<number>(0);
  const [timeUntilNextCredit, setTimeUntilNextCredit] = useState<string>("");
  const { canPlay: canPlayMemory, timeUntilNextPlay } = useMemoryGame();
  const { startSearch, isSearching, searchProgress, cancelSearch } = useMatchmaking();
  const [showAvatarView, setShowAvatarView] = useState(false);

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

  const calculateTimeUntilNextCredit = () => {
    if (!profile?.last_credit_refresh || isPremium || profile?.game_credits >= 5) {
      setTimeUntilNextCredit("");
      return;
    }
    const now = new Date();
    const nextRefresh = new Date(new Date(profile.last_credit_refresh).getTime() + 15 * 60 * 1000);
    if (now >= nextRefresh) {
      setTimeUntilNextCredit("");
      return;
    }
    const timeDiff = nextRefresh.getTime() - now.getTime();
    setTimeUntilNextCredit(`${Math.floor(timeDiff / 60000)}:${Math.floor((timeDiff % 60000) / 1000).toString().padStart(2, "0")}`);
  };

  // --- KREDİ YENİLEME ---
  const refreshCredits = async () => {
    if (!user || isPremium || (profile?.game_credits || 0) >= 5) return;
    try {
      const { error } = await supabase.from("profiles").update({
          game_credits: Math.min((profile?.game_credits || 0) + 1, 5),
          last_credit_refresh: new Date().toISOString(),
        }).eq("id", user.id);
      if (!error) {
        await refreshProfile();
        toast.success(`🎮 +1 Kredi eklendi!`);
        playSound("buttonClick");
      }
    } catch (e) { console.error(e); }
  };

  // --- EFFECTS ---
  useEffect(() => {
    if (!isPremium && profile) {
      calculateTimeUntilNextCredit();
      const interval = setInterval(() => {
        calculateTimeUntilNextCredit();
        if (profile?.last_credit_refresh && !isPremium && profile.game_credits < 5) {
           if (new Date() >= new Date(new Date(profile.last_credit_refresh).getTime() + 15 * 60 * 1000)) {
             refreshCredits();
             setTimeout(refreshProfile, 500);
           }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [profile, isPremium]);

  useEffect(() => { startBackgroundMusic(); }, [startBackgroundMusic]);

  // --- VERİ HAZIRLIĞI ---
  const levelInfo = calculateLevel(profile?.total_score || 0);

  // Ana Oyunlar
  const mainGameModes = [
    {
      id: "vs-computer",
      title: "YZ'ye Karşı",
      desc: "Zekanı test et",
      image: "/bilgisayarKart.png",
      route: "/game/vs-computer",
    },
    {
      id: "random-match",
      title: "Rastgele Rakip",
      desc: "Online düello",
      image: "/rastgeleKart.png",
      route: "/game/random-match",
    },
    {
      id: "private-room",
      title: "Özel Oda",
      desc: "Arkadaşlarınla oyna",
      image: "/ozelKart.png",
      route: "/game/private-room",
    },
    {
      id: "tournament",
      title: "Turnuva",
      desc: "Büyük ödüller",
      image: "/turnuvaKart.png",
      route: "/tournament",
    },
  ];

  // Mini Oyunlar (Hafıza buraya taşındı)
  const arcadeGames = [
    { id: "memory", title: "Hafıza", route: "/memory-game", icon: <Brain className="w-5 h-5"/>, color: "text-pink-400", special: !canPlayMemory },
    { id: "morles", title: "Morles", route: "/morles-game", icon: <Grid3X3 className="w-5 h-5"/>, color: "text-cyan-400" },
    { id: "reactor", title: "Reaktör", route: "/reactor-runner", icon: <Activity className="w-5 h-5"/>, color: "text-green-400" },
    { id: "snake", title: "Yılan", route: "/snake-game", icon: <Gamepad2 className="w-5 h-5"/>, color: "text-yellow-400" },
    { id: "ghost", title: "Adım", route: "/grid-simon-says", icon: <Ghost className="w-5 h-5"/>, color: "text-indigo-400" },
  ];

  return (
    <>
      <OnboardingTutorial />

      <div className="min-h-screen bg-[#0a0a0f] text-slate-100 pb-24 native-safe-container">
        
        {/* --- FIXED HEADER (SABİT ÜST PANEL) --- */}
        <div className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/5 shadow-2xl transition-all">
          <div className="px-4 py-3 max-w-md mx-auto">
            
            {/* Üst Satır: Avatar ve Temel Bilgiler */}
            <div className="flex items-center gap-3 mb-3">
              <div 
                className="relative cursor-pointer flex-shrink-0" 
                onClick={() => setShowAvatarView(true)}
              >
                <Avatar className="w-12 h-12 border border-white/10 ring-2 ring-purple-500/20">
                  <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} className="object-cover" />
                  <AvatarFallback className="bg-slate-800"><User className="w-5 h-5" /></AvatarFallback>
                </Avatar>
                {isPremium && (
                   <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-0.5 border border-black"><Crown className="w-2.5 h-2.5 text-white" /></div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                   <h1 className="text-lg font-black text-white font-bungee tracking-wide truncate">
                     {profile?.username || "Misafir"}
                   </h1>
                   <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded text-[10px] font-mono border border-white/5">
                      <Trophy className="w-3 h-3 text-yellow-500" />
                      <span>{profile?.total_score?.toLocaleString() || 0}</span>
                   </div>
                </div>

                {/* Level Progress */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-purple-400 w-8">Lv.{levelInfo.level}</span>
                  <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-600 to-pink-500" 
                      style={{ width: `${(levelInfo.experience / levelInfo.nextLevelExp) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Alt Satır: İstatistikler ve Enerji (GRID YAPISI) */}
            <div className="grid grid-cols-12 gap-2">
              
              {/* Sol: Enerji Paneli (Geniş) */}
              <div className="col-span-7 bg-[#15151e] rounded-lg p-1.5 flex flex-col justify-center border border-white/5">
                 <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                       <Zap className="w-3 h-3 text-amber-400" /> Enerji
                    </span>
                    <span className="text-[10px] font-mono text-white">
                      {Math.min((profile?.game_credits || 0), 5)}/5
                    </span>
                 </div>
                 <div className="flex gap-0.5">
                    {[0,1,2,3,4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${
                        i < (profile?.game_credits || 0) ? 'bg-amber-400' : 'bg-slate-800'
                      }`} />
                    ))}
                 </div>
                 {timeUntilNextCredit && (
                   <div className="text-[9px] text-amber-500/80 text-right mt-0.5 font-mono">{timeUntilNextCredit}</div>
                 )}
              </div>

              {/* Sağ: İstatistikler (Günlük & Seri) */}
              <div className="col-span-5 flex gap-2">
                 <div className="flex-1 bg-[#15151e] rounded-lg flex flex-col items-center justify-center border border-white/5">
                    <div className="flex items-center gap-1">
                       <Target className="w-3 h-3 text-blue-400" />
                       <span className="text-xs font-bold text-white">{profile?.daily_games || 0}</span>
                    </div>
                    <span className="text-[8px] text-slate-500">Günlük</span>
                 </div>
                 <div className="flex-1 bg-[#15151e] rounded-lg flex flex-col items-center justify-center border border-white/5">
                    <div className="flex items-center gap-1">
                       <Flame className="w-3 h-3 text-orange-500" />
                       <span className="text-xs font-bold text-white">{profile?.win_streak || 0}</span>
                    </div>
                    <span className="text-[8px] text-slate-500">Seri</span>
                 </div>
              </div>

            </div>
          </div>
        </div>

        {/* --- SCROLLABLE CONTENT --- */}
        <div className="max-w-md mx-auto px-4 pt-4 space-y-6">

          {/* 1. GÜNLÜK ÇARK BANNER (Geniş ve Dikkat Çekici) */}
          <div 
            onClick={() => navigate("/wheel")}
            className="w-full relative h-20 bg-gradient-to-r from-orange-600 to-amber-600 rounded-xl overflow-hidden cursor-pointer shadow-lg shadow-orange-900/20 group border border-orange-400/20"
          >
             {/* Arka Plan Deseni */}
             <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent scale-150" />
             
             <div className="absolute inset-0 flex items-center justify-between px-6">
                <div className="flex flex-col z-10">
                   <h3 className="text-lg font-black italic text-white tracking-wider drop-shadow-md">GÜNLÜK ÇARK</h3>
                   <span className="text-xs font-medium text-orange-100 bg-black/20 px-2 py-0.5 rounded w-fit">
                     Ödülünü Topla!
                   </span>
                </div>
                {/* Dönen Çark İkonu Animasyonu */}
                <div className="relative w-14 h-14 group-hover:scale-110 transition-transform duration-500">
                   <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
                   <Ticket className="w-full h-full text-white drop-shadow-lg rotate-12 group-hover:rotate-45 transition-transform duration-700" />
                </div>
             </div>
          </div>

          {/* 2. JOKER ENVANTERİ (İnce Şerit) */}
          <div className="bg-[#15151e] rounded-lg py-2 px-4 border border-white/5 flex justify-between items-center">
             <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Jokerlerin</div>
             <div className="flex gap-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                   <span>🔄</span> <span className="font-bold text-white">{jokers.degistir}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                   <span>🗣️</span> <span className="font-bold text-white">{jokers.fisilida}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                   <span>✍️</span> <span className="font-bold text-white">{jokers.senYaz}</span>
                </div>
             </div>
          </div>

          {/* 3. ANA OYUN MODLARI (Izgara) */}
          <div>
            <div className="flex items-center gap-2 mb-3">
               <Gamepad2 className="w-4 h-4 text-purple-500" />
               <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Arenalar</h2>
            </div>
            <div className="grid grid-cols-1 gap-3">
               {/* İlk iki oyun yan yana değil, alt alta daha büyük ve sinematik olsun dedin */}
               {mainGameModes.map((mode) => (
                  <div 
                    key={mode.id}
                    onClick={() => {
                      playSound("buttonClick");
                      if(mode.id === "tournament") navigate("/tournament");
                      else setSelectedMode(mode.id);
                    }}
                    className="relative h-24 w-full rounded-xl overflow-hidden cursor-pointer group border border-white/5 hover:border-purple-500/40 transition-all"
                  >
                     <img src={mode.image} alt={mode.title} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" />
                     <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
                     <div className="absolute inset-0 p-4 flex flex-col justify-center">
                        <h3 className="text-lg font-bold text-white">{mode.title}</h3>
                        <p className="text-xs text-slate-400">{mode.desc}</p>
                     </div>
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 p-2 rounded-full backdrop-blur-sm group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Play className="w-4 h-4 fill-current" />
                     </div>
                  </div>
               ))}
            </div>
          </div>

          {/* 4. MİNİ OYUNLAR (Yatay Kaydırma - Hafıza burada) */}
          <div className="pb-6">
             <div className="flex items-center gap-2 mb-3">
               <Ghost className="w-4 h-4 text-pink-500" />
               <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Mini Oyunlar</h2>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
               {arcadeGames.map((game) => (
                  <div 
                    key={game.id}
                    onClick={() => navigate(game.route)}
                    className={`aspect-square rounded-xl bg-[#15151e] border border-white/5 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#1e1e2a] hover:border-white/10 transition-all relative overflow-hidden group`}
                  >
                     {/* Hafıza oyunu cooldown kontrolü */}
                     {game.id === "memory" && !canPlayMemory && (
                        <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center backdrop-blur-[1px]">
                           <span className="text-[10px] font-bold text-white">{timeUntilNextPlay}</span>
                        </div>
                     )}
                     
                     <div className={`${game.color} p-2 rounded-full bg-white/5 group-hover:scale-110 transition-transform`}>
                        {game.icon}
                     </div>
                     <span className="text-[10px] font-bold text-slate-400">{game.title}</span>
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
