import { useState, useEffect } from "react";
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
import { useMemoryGame } from "@/hooks/useMemoryGame";
import { useMatchmaking } from "@/contexts/NewMatchmakingContext";
import { AvatarViewDialog } from "@/components/AvatarViewDialog";
import { motion, AnimatePresence } from "framer-motion"; // EĞER YOKSA: npm install framer-motion

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
  Brain,
  Grid3X3,
  Infinity,
  Sparkles,
  Gamepad2,
  ChevronRight
} from "lucide-react";

// --- HELPER COMPONENTS FOR UI CONSISTENCY ---

// Modern Glass Card Component
const GlassCard = ({ children, className = "", onClick }: any) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`
      relative overflow-hidden rounded-2xl
      bg-black/40 backdrop-blur-xl border border-white/10
      shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]
      ${className}
    `}
  >
    {/* Parlama Efekti */}
    <div className="absolute -inset-1 bg-gradient-to-tr from-white/5 to-transparent opacity-20 pointer-events-none" />
    {children}
  </motion.div>
);

// Stat Pill (Badge Replacement)
const StatPill = ({ icon: Icon, value, label, colorClass }: any) => (
  <div className="flex flex-col items-center bg-black/30 rounded-xl p-2 border border-white/5 min-w-[70px]">
    <Icon className={`w-4 h-4 mb-1 ${colorClass}`} />
    <span className="text-white font-bold text-sm">{value}</span>
    <span className="text-[10px] text-white/50 uppercase tracking-wider">{label}</span>
  </div>
);

// --- MAIN LOGIC & DATA ---

const greetingMessages = [
  "Sahne senin! 🌟", "Rekor kırma zamanı! 🏆", "Zeka küpü iş başında! 🧠", 
  "Bugün şanslı günün! 🍀", "Efsane geri döndü! 🦁"
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
  const [unlimitedTimeLeft, setUnlimitedTimeLeft] = useState<string>("");
  const { canPlay: canPlayMemory, timeUntilNextPlay } = useMemoryGame();
  const { startSearch, searchProgress, cancelSearch } = useMatchmaking();
  const [showAvatarView, setShowAvatarView] = useState(false);
  
  const [greeting] = useState(() => {
    const sessionGreeting = sessionStorage.getItem("sessionGreeting");
    if (sessionGreeting) return sessionGreeting;
    const newGreeting = getRandomGreeting();
    sessionStorage.setItem("sessionGreeting", newGreeting);
    return newGreeting;
  });

  // --- CALCULATIONS ---
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

  const levelInfo = calculateLevel(profile?.total_score || 0);
  const progressPercent = Math.min(100, Math.max(0, (levelInfo.experience / levelInfo.nextLevelExp) * 100));

  // --- EFFECTS (Timers, Music, Reset) ---
  
  // Unlimited Time Calculation
  useEffect(() => {
    if (!profile || !isUnlimitedLivesActive(profile)) {
      setUnlimitedTimeLeft("");
      return;
    }
    const updateTime = () => {
      const now = new Date();
      const expiry = new Date((profile as any).unlimited_lives_until);
      if (now >= expiry) { setUnlimitedTimeLeft(""); return; }
      
      const diff = expiry.getTime() - now.getTime();
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setUnlimitedTimeLeft(h > 0 ? `${h}s ${m}dk` : `${m}dk`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000); // Her dakika güncelle yeterli
    return () => clearInterval(interval);
  }, [profile]);

  // Credit Timer
  useEffect(() => {
    if (!isPremium && profile) {
       const updateCreditTimer = async () => {
         if (profile.game_credits >= 5) { setTimeUntilNextCredit(""); return; }
         if (!profile.last_credit_refresh) return;
         
         const now = new Date();
         const last = new Date(profile.last_credit_refresh);
         const next = new Date(last.getTime() + 72 * 60 * 1000); // 72 dk kuralı
         
         if (now >= next) {
             // Refresh logic here or let backend handle
             await refreshProfile();
         } else {
             const diff = next.getTime() - now.getTime();
             const m = Math.floor(diff / 60000);
             const s = Math.floor((diff % 60000) / 1000);
             setTimeUntilNextCredit(`${m}:${s.toString().padStart(2, '0')}`);
         }
       };
       const interval = setInterval(updateCreditTimer, 1000);
       return () => clearInterval(interval);
    }
  }, [profile, isPremium]);

  useEffect(() => startBackgroundMusic(), [startBackgroundMusic]);

  // --- CONFIGURATION ---
  const gameModesConfig = [
    {
      id: "vs-computer",
      title: "Yapay Zeka",
      subtitle: "Bot'a karşı antrenman",
      icon: Bot,
      color: "from-blue-600 to-blue-400",
      shadow: "shadow-blue-500/20",
      route: "/game/vs-computer",
    },
    {
      id: "private-room",
      title: "Özel Oda",
      subtitle: "Arkadaşınla oyna",
      icon: Users,
      color: "from-emerald-600 to-emerald-400",
      shadow: "shadow-emerald-500/20",
      route: "/game/private-room",
    },
    {
      id: "random-match",
      title: "Rastgele Rakip",
      subtitle: "Online PvP mücadele",
      icon: Zap,
      color: "from-violet-600 to-violet-400",
      shadow: "shadow-violet-500/20",
      route: "/game/random-match",
    },
    {
      id: "tournament",
      title: "Turnuva",
      subtitle: "8 Kişilik Lig",
      icon: Trophy,
      color: "from-amber-500 to-orange-500",
      shadow: "shadow-amber-500/20",
      route: "/tournament",
    },
  ];

  // --- RENDER HELPERS ---
  const handleModeClick = (mode: any) => {
    playSound("buttonClick");
    // Kredi Kontrolü
    if (!isPremium && !isUnlimitedLivesActive(profile) && (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0) {
      toast.error("Yetersiz Hak!", { description: "Oynamak için haklarınızın yenilenmesini bekleyin veya marketi ziyaret edin." });
      return;
    }

    if (mode.id === "tournament") navigate("/tournament");
    else setSelectedMode(mode.id);
  };

  return (
    <div className="min-h-screen bg-[#0a0a16] text-white font-sans selection:bg-purple-500/30">
      
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
         <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[100px]" />
         <div className="absolute bottom-[-10%] right-[-20%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col h-full max-w-md mx-auto pb-24">
        
        {/* --- HEADER SECTION --- */}
        <div className="px-5 pt-6 pb-2">
            <div className="flex justify-between items-start mb-6">
                {/* User Info */}
                <div className="flex items-center gap-3" onClick={() => setShowAvatarView(true)}>
                    <div className="relative group cursor-pointer">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                        <Avatar className="w-14 h-14 border-2 border-black relative">
                            <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} className="object-cover" />
                            <AvatarFallback className="bg-zinc-800"><User/></AvatarFallback>
                        </Avatar>
                        {isPremium && (
                           <div className="absolute -top-2 -right-1 bg-yellow-500 text-black p-0.5 rounded-full border-2 border-black">
                               <Crown className="w-3 h-3" />
                           </div>
                        )}
                    </div>
                    <div>
                        <h2 className="text-lg font-bold leading-none">{profile?.username || "Misafir"}</h2>
                        <p className="text-xs text-zinc-400 mt-1">{greeting}</p>
                    </div>
                </div>

                {/* Currency / Stats */}
                <div className="flex flex-col items-end gap-2">
                    {/* Mürekkep */}
                    <button onClick={() => navigate("/market")} className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/30 hover:border-purple-500/60 transition-colors">
                        <img src="/murekkepikon.png" alt="Ink" className="w-5 h-5 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                        <span className="font-bold text-sm">{profile?.ink_count || 0}</span>
                    </button>
                    
                    {/* Can / Kredi */}
                    <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-700">
                        {isUnlimitedLivesActive(profile) ? (
                            <>
                                <Infinity className="w-4 h-4 text-green-400 animate-pulse" />
                                <span className="text-xs font-bold text-green-400">{unlimitedTimeLeft || "∞"}</span>
                            </>
                        ) : (
                            <>
                                <div className="flex gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className={`w-1.5 h-3 rounded-sm ${i < (profile?.game_credits || 0) ? 'bg-gradient-to-t from-red-600 to-red-400 shadow-[0_0_5px_rgba(248,113,113,0.6)]' : 'bg-zinc-700'}`} />
                                    ))}
                                </div>
                                {(profile?.game_credits || 0) < 5 && timeUntilNextCredit && (
                                   <span className="text-[10px] text-zinc-500 ml-1 font-mono">{timeUntilNextCredit}</span>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Level Bar HUD */}
            <div className="bg-zinc-900/50 rounded-xl p-3 border border-white/5 relative overflow-hidden">
                <div className="flex justify-between items-end mb-2 relative z-10">
                    <div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold mb-0.5">Mevcut Seviye</div>
                        <div className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
                            LVL {levelInfo.level}
                        </div>
                    </div>
                    <div className="text-right">
                         <div className="text-sm font-bold text-white">{levelInfo.experience} / <span className="text-zinc-500">{levelInfo.nextLevelExp} XP</span></div>
                    </div>
                </div>
                {/* Progress Bar Container */}
                <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden relative z-10">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 relative"
                    >
                         <div className="absolute top-0 right-0 bottom-0 w-[2px] bg-white/50 blur-[2px]" />
                    </motion.div>
                </div>
                {/* Decorative background lines */}
                <div className="absolute top-0 right-0 opacity-10">
                    <Trophy className="w-24 h-24 -rotate-12 -translate-y-4 translate-x-4" />
                </div>
            </div>
        </div>

        {/* --- STATS & INVENTORY --- */}
        <div className="px-5 mb-6">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                <GlassCard className="flex-1 min-w-[100px] p-3 flex flex-col items-center justify-center gap-1">
                    <Target className="w-5 h-5 text-blue-400" />
                    <span className="text-lg font-bold">{profile?.daily_games || 0}</span>
                    <span className="text-[10px] text-zinc-500">GÜNLÜK OYUN</span>
                </GlassCard>
                <GlassCard className="flex-1 min-w-[100px] p-3 flex flex-col items-center justify-center gap-1">
                    <Zap className="w-5 h-5 text-yellow-400" />
                    <span className="text-lg font-bold">{profile?.win_streak || 0}</span>
                    <span className="text-[10px] text-zinc-500">SERİ</span>
                </GlassCard>
                
                {/* Jokerler Compact */}
                <GlassCard className="flex-[2] min-w-[180px] p-3 flex items-center justify-between gap-2 bg-gradient-to-br from-purple-900/20 to-zinc-900/40">
                    <div className="flex flex-col items-center gap-1">
                         <img src="/degistirIkon.png" className="w-6 h-6 object-contain opacity-90" />
                         <span className="text-xs font-bold text-purple-200">x{jokers.degistir}</span>
                    </div>
                    <div className="w-[1px] h-8 bg-white/10" />
                    <div className="flex flex-col items-center gap-1">
                         <img src="/fisildaIkon.png" className="w-6 h-6 object-contain opacity-90" />
                         <span className="text-xs font-bold text-blue-200">x{jokers.fisilida}</span>
                    </div>
                    <div className="w-[1px] h-8 bg-white/10" />
                    <div className="flex flex-col items-center gap-1">
                         <img src="/senyazIkon.png" className="w-6 h-6 object-contain opacity-90" />
                         <span className="text-xs font-bold text-pink-200">x{jokers.senYaz}</span>
                    </div>
                </GlassCard>
            </div>
        </div>

        {/* --- HERO: GAME MODES --- */}
        <div className="px-5 flex-1">
            <h3 className="text-sm font-bold text-zinc-500 mb-3 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4" />
                OYUN MODLARI
            </h3>
            <div className="grid grid-cols-1 gap-4">
                {gameModesConfig.map((mode) => (
                    <motion.div
                        key={mode.id}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleModeClick(mode)}
                        className="group relative h-24 rounded-2xl overflow-hidden cursor-pointer"
                    >
                         {/* Background Gradient & Image */}
                        <div className={`absolute inset-0 bg-gradient-to-r ${mode.color} opacity-90`} />
                        <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay" />
                        
                        {/* Content */}
                        <div className="absolute inset-0 flex items-center justify-between px-6">
                            <div className="flex items-center gap-4 z-10">
                                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg border border-white/20">
                                    <mode.icon className="w-6 h-6 text-white drop-shadow-md" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black tracking-wide text-white drop-shadow-md uppercase italic">{mode.title}</h3>
                                    <p className="text-xs text-white/80 font-medium">{mode.subtitle}</p>
                                </div>
                            </div>
                            <div className="z-10 bg-white/20 p-2 rounded-full backdrop-blur-sm group-hover:bg-white/30 transition-colors">
                                <ChevronRight className="w-5 h-5 text-white" />
                            </div>
                        </div>

                        {/* Decorative Asset (Right Side) */}
                        <div className="absolute -right-6 -bottom-6 opacity-20 transform rotate-12 group-hover:scale-110 transition-transform duration-500">
                             <mode.icon className="w-32 h-32 text-black" />
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>

        {/* --- MINI GAMES (Horizontal Scroll) --- */}
        <div className="mt-8 px-5">
             <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-zinc-500 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    EKSTRALAR
                </h3>
             </div>
             
             <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x">
                {/* Günlük Çark */}
                <GlassCard 
                    className="min-w-[160px] h-[160px] flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-800/50 to-zinc-900/50 snap-center"
                    onClick={() => navigate("/wheel")}
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-yellow-500/30 blur-xl rounded-full animate-pulse" />
                        {/* Basitleştirilmiş SVG Çark */}
                        <svg viewBox="0 0 100 100" className="w-16 h-16 animate-[spin_10s_linear_infinite]">
                             <circle cx="50" cy="50" r="45" fill="none" stroke="url(#grad)" strokeWidth="10" />
                             <defs>
                                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#eab308" />
                                    <stop offset="100%" stopColor="#f97316" />
                                </linearGradient>
                             </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-xl">🎁</div>
                    </div>
                    <div className="text-center">
                        <div className="font-bold text-white">Şans Çarkı</div>
                        <div className="text-[10px] text-zinc-400">Günlük Ödüller</div>
                    </div>
                </GlassCard>

                {/* Hafıza Oyunu */}
                 <GlassCard 
                    className={`min-w-[160px] h-[160px] flex flex-col items-center justify-center gap-3 snap-center ${canPlayMemory ? 'border-purple-500/50' : 'opacity-70 grayscale'}`}
                    onClick={() => navigate("/memory-game")}
                >
                    <div className="relative">
                         <Brain className={`w-14 h-14 ${canPlayMemory ? 'text-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.5)]' : 'text-zinc-600'}`} />
                         {!canPlayMemory && <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full backdrop-blur-sm text-xs font-bold">{timeUntilNextPlay}</div>}
                    </div>
                    <div className="text-center">
                        <div className="font-bold text-white">Hafıza</div>
                        <div className="text-[10px] text-zinc-400">Kartları Eşleştir</div>
                    </div>
                </GlassCard>

                {/* Puzzle */}
                <GlassCard 
                    className="min-w-[160px] h-[160px] flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-zinc-800/50 to-zinc-900/50 snap-center"
                    onClick={() => navigate("/puzzle-game")}
                >
                    <Grid3X3 className="w-14 h-14 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                    <div className="text-center">
                        <div className="font-bold text-white">Puzzle</div>
                        <div className="text-[10px] text-zinc-400">Kelime Yerleştir</div>
                    </div>
                </GlassCard>
             </div>
        </div>

      </div>

      {/* --- MODALS & FLOATING MENU --- */}
      
      <div className="fixed bottom-0 left-0 right-0 z-50">
          <FloatingMenu />
      </div>

      {/* Logic Components (Hidden or Overlay) */}
      <AnimatePresence>
        {selectedMode && (
          selectedMode === "private-room" ? (
             <PrivateRoomModal
                onClose={() => setSelectedMode(null)}
                onStartGame={(id, type) => { setSelectedMode(null); navigate(`/game/random-match?room=${id}&type=${type}`); }}
             />
          ) : (
            <GameModeSelector
                mode={selectedMode}
                onClose={() => setSelectedMode(null)}
                onStart={(gameType) => {
                    setSelectedMode(null);
                    if (selectedMode === "tournament") navigate("/tournament", { state: { gameType } });
                    else if (selectedMode === "random-match") {
                        setMatchmakingGameType(gameType);
                        setMatchmakingKey(Date.now());
                        setShowMatchmaking(true);
                        setTimeout(() => startSearch(gameType), 100);
                    } else {
                        const route = gameModesConfig.find(m => m.id === selectedMode)?.route;
                        if(route) navigate(`${route}?type=${gameType}`);
                    }
                }}
            />
          )
        )}
      </AnimatePresence>
      
      {showMatchmaking && (
         <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center">
            <SlotMatchmaking
              key={`matchmaking-${matchmakingKey}`}
              onCancel={() => { cancelSearch(); setShowMatchmaking(false); }}
              searchProgress={searchProgress}
            />
         </div>
      )}

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
