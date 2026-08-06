import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import Lottie from "lottie-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePageResync } from "@/hooks/useGlobalResync";
import { useSounds } from "@/hooks/useSounds";
import { IN_GAME_STATUS_POLL_MS } from "@/utils/playerActivityStatus";
import {
  ArrowLeft,
  Trophy,
  Crown,
  Medal,
  Target,
  Calendar,
  Users,
  Star,
  TrendingUp,
  CalendarRange,
  TrendingDown,
  Flame,
} from "lucide-react";
import LeaderboardPrizeBanner from "@/components/LeaderboardPrizeBanner";
import { VipBadge, isUserPremium } from "@/components/VipBadge";
import liderArmaLoadingAnim from "@/assets/liderArmaLoading.json";
import { UserActionMenu, type AnchorRect } from "@/components/UserActionMenu";

const formatCompactNumber = (value: number | null | undefined) => {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}Mr`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 100_000) return `${(n / 1_000).toFixed(0)}B`;
  return n.toLocaleString("tr-TR");
};

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  score: number;
  games_played: number;
  wins: number;
  best_word: string | null;
  best_word_score: number;
  rank: number;
  change?: number;
  isPremium?: boolean;
}

interface UserStats {
  allTime: LeaderboardEntry | null;
  weekly: LeaderboardEntry | null;
  monthly: LeaderboardEntry | null;
}

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { user } = useAuth();
  const { isUserOnline } = useUser();
  const { toast } = useToast();
  const [allTimeLeaders, setAllTimeLeaders] = useState<LeaderboardEntry[]>([]);
  const [weeklyLeaders, setWeeklyLeaders] = useState<LeaderboardEntry[]>([]);
  const [monthlyLeaders, setMonthlyLeaders] = useState<LeaderboardEntry[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    allTime: null,
    weekly: null,
    monthly: null,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all-time");
  const swipeRef = useRef<{ x: number; y: number; dx: number; axis: "none" | "x" | "y" } | null>(null);
  const dragLayerRef = useRef<HTMLDivElement | null>(null);
  const TAB_ORDER = ["all-time", "monthly", "weekly"];

  const [premiumUsers, setPremiumUsers] = useState<Set<string>>(new Set());
  const [inGameUsers, setInGameUsers] = useState<Set<string>>(new Set());
  const [liderLoadingAnim, setLiderLoadingAnim] = useState<any>(null);
  const [menuTarget, setMenuTarget] = useState<LeaderboardEntry | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<AnchorRect | null>(null);

  const openUserMenu = (leader: LeaderboardEntry, e: React.MouseEvent<HTMLElement>) => {
    playSound("buttonClick");
    setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
    setMenuTarget(leader);
  };

  // Fetch premium status + in_game status for a list of user IDs
  const fetchPremiumStatus = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    try {
      const now = new Date();

      // useActivityTracker maçtayken heartbeat'i profiles.last_seen'e yazıyor
      // (player_activities'e DEĞİL — o tablo bu akışla ilgisiz, bu yüzden eski
      // kontrol gerçek maçtaki oyuncuları da "stale" sayıyordu).
      // Heartbeat aralığı maçta 15sn, bu yüzden eşik onun biraz üstünde olmalı
      // (tam 12sn gibi dar bir eşik, iki heartbeat arası her an stale görünmesine yol açıyordu).
      const IN_GAME_LAST_SEEN_STALE_MS = 25_000;
      const staleThreshold = now.getTime() - IN_GAME_LAST_SEEN_STALE_MS;

      const { data } = await supabase
        .from("profiles")
        .select("id, premium_until, in_game, last_seen")
        .in("id", userIds);

      if (data) {
        const premSet = new Set<string>();
        const gameSet = new Set<string>();

        data.forEach((p: any) => {
          // Premium kullanıcıları ekle
          if (p.premium_until && new Date(p.premium_until) > now) premSet.add(p.id);

          // in_game flag'i true VE last_seen yakın zamanda güncellenmişse neon mavi yap.
          // Sadece in_game'e bakmak, takılı kalmış (stale) flag'leri de maçtaymış gibi gösterir.
          const lastSeenMs = p.last_seen ? new Date(p.last_seen).getTime() : 0;
          if (p.in_game && lastSeenMs > staleThreshold) gameSet.add(p.id);
        });

        setPremiumUsers(premSet);
        setInGameUsers(gameSet);
      }
    } catch (e) {
      console.error("Error fetching premium status:", e);
    }
  };

  // 4-aylık sezon başlangıç tarihi hesapla (Ocak-Nisan, Mayıs-Ağustos, Eylül-Aralık)
  const getSeasonStart = (): string => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const seasonStartMonth = month < 4 ? 0 : month < 8 ? 4 : 8;
    return new Date(year, seasonStartMonth, 1).toISOString();
  };

  // Genel sıralama (4 aylık sezon) - RPC ile
  const fetchAllTimeLeaders = async () => {
    try {
      const { data, error } = await supabase.rpc("get_season_leaderboard", { limit_count: 50 });
      if (error) {
        console.error("Season leaderboard RPC error:", error);
        setAllTimeLeaders([]);
        return;
      }

      const allTimeData = Array.isArray(data)
        ? data.map((entry: any) => ({
            user_id: entry.user_id,
            username: entry.username || "Anonim",
            avatar_url: entry.avatar_url,
            score: entry.season_score || 0,
            games_played: entry.games_played || 0,
            wins: entry.games_won || 0,
            best_word: null,
            best_word_score: 0,
            rank: entry.rank_position || 0,
            change: 0,
          }))
        : [];

      setAllTimeLeaders(allTimeData);

      if (user) {
        const userEntry = allTimeData.find((entry: LeaderboardEntry) => entry.user_id === user.id);
        setUserStats((prev) => ({ ...prev, allTime: userEntry || null }));
      }
    } catch (error) {
      console.error("Error fetching season leaders:", error);
      setAllTimeLeaders([]);
    }
  };

  // Haftalık sıralama
  const fetchWeeklyLeaders = async () => {
    try {
      const { data, error } = await supabase.rpc("get_weekly_leaderboard", { limit_count: 100 });
      if (error) {
        console.error("Weekly leaderboard RPC error:", error);
        setWeeklyLeaders([]);
        return;
      }

      const weeklyData = Array.isArray(data)
        ? data.map((entry: any, index: number) => ({
            user_id: entry.user_id,
            username: entry.username || "Anonim",
            avatar_url: entry.avatar_url,
            score: entry.weekly_score || 0,
            games_played: entry.games_played || 0,
            wins: entry.games_won || 0,
            best_word: null,
            best_word_score: 0,
            rank: entry.rank_position || index + 1,
            change: entry.rank_change || 0,
          }))
        : [];

      setWeeklyLeaders(weeklyData);

      if (user) {
        const userEntry = weeklyData.find((entry: LeaderboardEntry) => entry.user_id === user.id);
        setUserStats((prev) => ({ ...prev, weekly: userEntry || null }));
      }
    } catch (error) {
      console.error("Error fetching weekly leaders:", error);
      setWeeklyLeaders([]);
    }
  };

  // Aylık sıralama
  const fetchMonthlyLeaders = async () => {
    try {
      const { data, error } = await supabase.rpc("get_monthly_leaderboard", { limit_count: 100 });
      if (error) {
        console.error("Monthly leaderboard RPC error:", error);
        setMonthlyLeaders([]);
        return;
      }

      const monthlyData = Array.isArray(data)
        ? data.map((entry: any, index: number) => ({
            user_id: entry.user_id,
            username: entry.username || "Anonim",
            avatar_url: entry.avatar_url,
            score: entry.monthly_score || 0,
            games_played: entry.games_played || 0,
            wins: entry.games_won || 0,
            best_word: null,
            best_word_score: 0,
            rank: entry.rank_position || index + 1,
            change: entry.rank_change || 0,
          }))
        : [];

      setMonthlyLeaders(monthlyData);

      if (user) {
        const userEntry = monthlyData.find((entry: LeaderboardEntry) => entry.user_id === user.id);
        setUserStats((prev) => ({ ...prev, monthly: userEntry || null }));
      }
    } catch (error) {
      console.error("Error fetching monthly leaders:", error);
      setMonthlyLeaders([]);
    }
  };


  const handleLeaderboardResync = useCallback(async () => {
    await Promise.all([fetchAllTimeLeaders(), fetchWeeklyLeaders(), fetchMonthlyLeaders()]);
  }, []);

  // Fetch premium status whenever leaders change + poll every 15s for in_game updates
  useEffect(() => {
    const allUserIds = [
      ...allTimeLeaders.map(l => l.user_id),
      ...weeklyLeaders.map(l => l.user_id),
      ...monthlyLeaders.map(l => l.user_id),
    ];
    const uniqueIds = [...new Set(allUserIds)];
    if (uniqueIds.length === 0) return;
    fetchPremiumStatus(uniqueIds);
    const interval = setInterval(() => fetchPremiumStatus(uniqueIds), IN_GAME_STATUS_POLL_MS);
    return () => clearInterval(interval);
  }, [allTimeLeaders, weeklyLeaders, monthlyLeaders]);

  usePageResync(handleLeaderboardResync, "LeaderboardPage", false);

  useEffect(() => {
    fetch("/liderArmaLoading.json")
      .then((r) => r.json())
      .then(setLiderLoadingAnim)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await handleLeaderboardResync();
      setLoading(false);
    };
    loadData();
  }, [user]);

  useEffect(() => {
    const refetchActive = async () => {
      if (activeTab === "all-time") await fetchAllTimeLeaders();
      if (activeTab === "weekly") await fetchWeeklyLeaders();
      if (activeTab === "monthly") await fetchMonthlyLeaders();
    };
    refetchActive();
  }, [activeTab]);

  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === "visible") {
        await handleLeaderboardResync();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [handleLeaderboardResync]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-amber-400 fill-amber-400 drop-shadow-lg" />;
      case 2:
        return <Medal className="w-6 h-6 text-slate-300 fill-slate-300 drop-shadow-lg" />;
      case 3:
        return <Medal className="w-6 h-6 text-orange-600 fill-orange-600 drop-shadow-lg" />;
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-slate-400">#{rank}</span>
        );
    }
  };

  const getRankChangeIcon = (change?: number) => {
    if (!change || change === 0) return null;
    if (change > 0) {
      return (
        <div className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full text-xs font-bold border border-green-500/30">
          <TrendingUp className="w-3 h-3" />
          <span>+{change}</span>
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs font-bold border border-red-500/30">
          <TrendingDown className="w-3 h-3" />
          <span>{change}</span>
        </div>
      );
    }
    return null;
  };

  type LeaderboardTab = "season" | "monthly" | "weekly";

  // sezon* ve aylik* çerçeve JSON'larının hepsi 1000x591 (KARE DEĞİL, ~1.69:1 en-boy oranında).
  // Bu yüzden kutuyu kare değil, bu orana göre dikdörtgen render ediyoruz - yoksa çerçeve görseli düşey eksende sıkışıp bozulur.
  const FRAME_ASPECT = 1000 / 591;

  // avatarPx: her çerçevenin GERÇEK iç boşluğuna göre ölçüldü (görselleri açıp piksel piksel kontrol ettim).
  //  - season (sezonBirinci/Ikinci/Ucuncu): temiz, dairesel "delik" olan altın/gümüş/bronz halka - delik canvas yüksekliğinin ~%52'si
  //  - monthly (aylikBirinci/Ikinci/Ucuncu): defne yaprağı (çelenk) tasarımı, keskin bir delik yok - iç boşluk canvas yüksekliğinin ~%38'i (tahmini, yapraklar organik olduğu için kesin sınır yok)
  // weekly: mevcut haftalık çerçeve - dokunmadım, eskisi gibi kare kutu.
  // Kanka: 3 sekmede de podyumdaki 1./2./3. avatar boyutları ve aralarındaki mesafe birebir aynı olsun.
  // Bu yüzden avatarPx tüm sekmelerde eşit; lottieH ise çerçeve tasarımına göre değişiyor (görsel çerçeve boyutu).
  const FRAME_CONFIG: Record<LeaderboardTab, { lg: { avatarPx: number; lottieH: number }; sm: { avatarPx: number; lottieH: number } }> = {
    season: {
      lg: { avatarPx: 68, lottieH: 120 },
      sm: { avatarPx: 50, lottieH: 90 },
    },
    monthly: {
      lg: { avatarPx: 68, lottieH: 120 },
      sm: { avatarPx: 50, lottieH: 90 },
    },
    weekly: {
      lg: { avatarPx: 68, lottieH: 120 },
      sm: { avatarPx: 50, lottieH: 90 },
    },
  };

  // Haftalık sekmede 2. ve 3.'nün arasındaki boşluk Tailwind "gap-20" (80px) ile ayarlanıyordu.
  // Sezon/aylık çerçeveler artık kare değil (daha geniş kutu), bu yüzden aynı 80px flex-gap kullanılırsa
  // aradaki GÖRSEL boşluk haftalıktan çok daha büyük görünür. Burada, kutu genişliği ne olursa olsun
  // avatarlar arasındaki gerçek görsel mesafe haftalıktakiyle birebir aynı olacak şekilde gap'i hesaplıyoruz.
  const WEEKLY_FLEX_GAP_PX = 80; // Tailwind gap-20
  const getPodiumGapPx = (tab: LeaderboardTab): number => {
    const weeklyBox = FRAME_CONFIG.weekly.sm.lottieH; // haftalık kare kutu
    const weeklyAvatar = FRAME_CONFIG.weekly.sm.avatarPx;
    const targetAvatarDistance = WEEKLY_FLEX_GAP_PX + (weeklyBox - weeklyAvatar);

    const box = tab === "weekly" ? FRAME_CONFIG.weekly.sm.lottieH : Math.round(FRAME_CONFIG[tab].sm.lottieH * FRAME_ASPECT);
    const avatar = FRAME_CONFIG[tab].sm.avatarPx;
    return Math.max(0, Math.round(targetAvatarDistance - (box - avatar)));
  };

  const [frameData, setFrameData] = useState<Record<LeaderboardTab, { first: any; second: any; third: any }>>({
    season: { first: null, second: null, third: null },
    monthly: { first: null, second: null, third: null },
    weekly: { first: null, second: null, third: null },
  });

  useEffect(() => {
    Promise.all([
      fetch("/sezonBirinci.json").then(r => r.json()),
      fetch("/sezonIkinci.json").then(r => r.json()),
      fetch("/sezonUcuncu.json").then(r => r.json()),
      fetch("/aylikBirinci.json").then(r => r.json()),
      fetch("/aylikIkinci.json").then(r => r.json()),
      fetch("/aylikUcuncu.json").then(r => r.json()),
      fetch("/birincijson.json").then(r => r.json()),
      fetch("/ikincijson.json").then(r => r.json()),
      fetch("/ucuncujson.json").then(r => r.json()),
    ])
      .then(([sezonB, sezonI, sezonU, aylikB, aylikI, aylikU, haftaB, haftaI, haftaU]) => {
        setFrameData({
          season: { first: sezonB, second: sezonI, third: sezonU },
          monthly: { first: aylikB, second: aylikI, third: aylikU },
          weekly: { first: haftaB, second: haftaI, third: haftaU },
        });
      })
      .catch(console.error);
  }, []);

  const renderPodiumItem = (leader: LeaderboardEntry, rank: number, size: "lg" | "sm", tab: LeaderboardTab) => {
    const isCurrentUser = leader.user_id === user?.id;
    const { avatarPx, lottieH } = FRAME_CONFIG[tab][size];
    // weekly kare kutuda kalıyor (mevcut davranış); season & monthly gerçek 1000x591 oranında render ediliyor
    const lottieW = tab === "weekly" ? lottieH : Math.round(lottieH * FRAME_ASPECT);
    const tabFrames = frameData[tab];
    const animData = rank === 1 ? tabFrames.first : rank === 2 ? tabFrames.second : tabFrames.third;
    const frameColor = rank === 1 ? "#d4af37" : rank === 2 ? "#c0c0c0" : "#cd7f32";
    return (
      <div className="flex flex-col items-center gap-0">
        <div className="relative" style={{ width: lottieW, height: lottieH }}>
          {/* Lottie animation frame */}
          {animData && (
            <Lottie
              animationData={animData}
              loop
              autoplay
              style={{ position: 'absolute', inset: 0, width: lottieW, height: lottieH, pointerEvents: 'none' }}
            />
          )}
                    {/* Avatar centered inside lottie */}
          {/* Kapsayıcıya z-10 vererek lottie animasyonunun (z belirtilmemişse 0 sayılır) üzerine çıkartıyoruz */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="relative">
              <Avatar
                className={`cursor-pointer hover:scale-110 transition-transform`}
                style={{ width: avatarPx, height: avatarPx }}
                onClick={(e) => openUserMenu(leader, e)}
              >
                <AvatarImage src={leader.avatar_url || undefined} alt={leader.username} />
                <AvatarFallback className="bg-slate-800 text-slate-400 text-xs">
                  {leader.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              {premiumUsers.has(leader.user_id) && (
                // z-30 vererek hem avatarın hem de Lottie'nin en tepesinde kalmasını garanti ediyoruz
                <div className="absolute -top-1 -right-1 z-30">
                  <VipBadge size="xs" />
                </div>
              )}
            </div>
          </div>
        </div>
        <div
          className="flex flex-col items-center rounded-lg border-2 px-2 py-1 mt-[-8px] bg-transparent"
          style={{ borderColor: frameColor }}
        >
          <div className="text-center min-w-0 w-full flex flex-col items-center justify-center">
            <h3
              className="font-bold text-xs truncate cursor-pointer hover:text-indigo-300 transition-colors w-full"
              style={
                inGameUsers.has(leader.user_id)
                  ? { color: "#00E5FF", textShadow: "0 0 6px rgba(0,229,255,0.9), 0 0 12px rgba(0,229,255,0.6)" }
                  : isUserOnline(leader.user_id)
                    ? { color: "#39FF14", textShadow: "0 0 6px rgba(57,255,20,0.9), 0 0 12px rgba(57,255,20,0.6)" }
                    : { color: "#ffffff" }
              }
              onClick={(e) => openUserMenu(leader, e)}
            >
              {leader.username}
              {isCurrentUser && <span className="text-[9px] text-indigo-400 font-bold ml-1">(Sen)</span>}
            </h3>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Target className="w-3 h-3" />
            <span className="font-bold text-amber-400">{leader.score.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
            {leader.games_played > 0 && (
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                {leader.games_played}
              </span>
            )}
            {leader.wins > 0 && (
              <span className="flex items-center gap-0.5">
                <Trophy className="w-3 h-3" />
                {leader.wins}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLeaderboard = (leaders: LeaderboardEntry[], showChange: boolean, tab: LeaderboardTab) => {
    if (leaders.length === 0) {
      return (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-[#1e2d45] rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-slate-500" />
          </div>
          <p className="text-slate-400 font-medium">Henüz oyun oynayan yok</p>
          <p className="text-sm text-slate-500 mt-1">İlk sen ol!</p>
        </div>
      );
    }

    const top3 = leaders.slice(0, 3);
    const rest = leaders.slice(3);
    const first = top3[0];
    const second = top3[1];
    const third = top3[2];

    return (
      <div className="space-y-3">
        {/* Podium - Top 3 */}
        {top3.length > 0 && (
          <div className="mb-4">
            {/* 1st place centered */}
            {first && (
              <div className="flex justify-center mb-1">
                {renderPodiumItem(first, 1, "lg", tab)}
              </div>
            )}
            {/* 2nd & 3rd side by side */}
            {(second || third) && (
              <div className="flex justify-center" style={{ gap: getPodiumGapPx(tab) }}>
                {second && renderPodiumItem(second, 2, "sm", tab)}
                {third && renderPodiumItem(third, 3, "sm", tab)}
              </div>
            )}
          </div>
        )}

        {/* Rest of leaderboard */}
        {rest.map((leader) => {
          const isCurrentUser = leader.user_id === user?.id;

          return (
            <div
              key={leader.user_id}
              className={`relative group rounded-2xl p-4 transition-all duration-300 border ${
                isCurrentUser
                  ? "bg-[#1e2d45] border-indigo-400/30 shadow-lg shadow-indigo-500/10"
                  : "bg-[#1e2d45] border-indigo-500/20"
              }`}
            >
              <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

              <div className="flex items-center gap-4 relative z-10">
                <div className="flex-shrink-0">{getRankIcon(leader.rank)}</div>

                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-indigo-400 to-purple-500">
                    <Avatar
                      className={`w-full h-full cursor-pointer hover:scale-110 transition-transform ${
                        activeTab === "all-time"
                          ? "ring-2 ring-red-500 ring-offset-1 ring-offset-slate-900"
                          : activeTab === "monthly"
                            ? "ring-2 ring-green-500 ring-offset-1 ring-offset-slate-900"
                            : "ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900"
                      }`}
                      onClick={(e) => openUserMenu(leader, e)}
                    >
                      <AvatarImage src={leader.avatar_url || undefined} alt={leader.username} />
                      <AvatarFallback className="bg-slate-800 text-slate-400 text-xs">
                        {leader.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {premiumUsers.has(leader.user_id) && (
                    <div className="absolute -top-1 -right-1 z-20">
                      <VipBadge size="xs" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className="font-bold truncate text-sm cursor-pointer hover:text-indigo-300 transition-colors"
                      style={
                        inGameUsers.has(leader.user_id)
                          ? { color: "#00E5FF", textShadow: "0 0 6px rgba(0,229,255,0.9), 0 0 12px rgba(0,229,255,0.6)" }
                          : isUserOnline(leader.user_id)
                            ? { color: "#39FF14", textShadow: "0 0 6px rgba(57,255,20,0.9), 0 0 12px rgba(57,255,20,0.6)" }
                            : { color: "#ffffff" }
                      }
                      onClick={(e) => openUserMenu(leader, e)}
                    >
                      {leader.username}
                    </h3>
                    {isCurrentUser && (
                      <Badge className="text-xs px-2 py-0 h-5 bg-indigo-500 text-white border-0">Sen</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Target className="w-3 h-3" />
                      {leader.score.toLocaleString()}
                    </span>
                    {leader.games_played > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {leader.games_played}
                      </span>
                    )}
                    {leader.wins > 0 && (
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {leader.wins}
                      </span>
                    )}
                  </div>
                </div>

                {showChange && <div className="flex-shrink-0">{getRankChangeIcon(leader.change)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getCurrentUserStats = () => {
    switch (activeTab) {
      case "weekly":
        return userStats.weekly;
      case "monthly":
        return userStats.monthly;
      default:
        return userStats.allTime;
    }
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        <div className="flex flex-col items-center gap-4">
          <Lottie animationData={liderArmaLoadingAnim} loop autoplay style={{ width: 160, height: 160 }} />
          <p className="text-slate-400 font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const currentStats = getCurrentUserStats();

  return (
    <div
      className="fixed inset-0 flex flex-col text-slate-100 overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
    >
      {/* Light Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent pointer-events-none opacity-30" />

      {/* Header */}
      <div className="flex-none z-30 bg-[#1a1a2e] border-b border-white/5 shadow-2xl">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              onClick={() => { playSound("buttonClick"); navigate("/"); }}
              className="bg-[#1e2d45] border border-indigo-500/20 text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Geri
            </Button>

            <div className="flex items-center gap-2">
  <img src="/icons/liderlik-gorsel.svg" alt="" className="w-9 h-9 object-contain drop-shadow-md" />
  <img src="/icons/liderlik-text.svg" alt="Liderlik" className="h-7 object-contain" />
</div>

            <div className="w-20" />
          </div>

          {/* User Stats Card */}
          {currentStats && (
            <div className="bg-[#1e2d45] border border-indigo-500/20 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-bold text-white">Senin Performansın</span>
                </div>
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-400/30 text-xs">
                  {activeTab === "weekly" ? "Bu Hafta" : activeTab === "monthly" ? "Bu Ay" : "Sezon"}
                </Badge>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="bg-[#0f1829] rounded-xl p-2 text-center min-w-0">
                  <div className="text-lg font-bold text-amber-500 truncate">#{currentStats.rank || "—"}</div>
                  <div className="text-[10px] text-slate-400">Sıra</div>
                </div>
                <div className="bg-[#0f1829] rounded-xl p-2 text-center min-w-0">
                  <div className="text-lg font-bold text-indigo-400 truncate">{formatCompactNumber(currentStats.score)}</div>
                  <div className="text-[10px] text-slate-400">Puan</div>
                </div>
                <div className="bg-[#0f1829] rounded-xl p-2 text-center min-w-0">
                  <div className="text-lg font-bold text-blue-400 truncate">{formatCompactNumber(currentStats.games_played)}</div>
                  <div className="text-[10px] text-slate-400">Oyun</div>
                </div>
                <div className="bg-[#0f1829] rounded-xl p-2 text-center min-w-0">
                  <div className="text-lg font-bold text-green-400 truncate">{formatCompactNumber(currentStats.wins)}</div>
                  <div className="text-[10px] text-slate-400">Zafer</div>
                </div>
              </div>

            </div>
          )}

          {/* Prize Banner */}
          <div className="mt-3">
            <LeaderboardPrizeBanner tab={activeTab as "all-time" | "weekly" | "monthly"} />
          </div>

          {/* Tabs */}
          <div className="mt-3">
            <Tabs value={activeTab} onValueChange={(val) => { playSound("buttonClick"); setActiveTab(val); }} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-[#1e2d45] border border-indigo-500/20 rounded-xl p-1 h-auto">
                <TabsTrigger
                  value="all-time"
                  className="text-xs font-medium py-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-orange-500 data-[state=active]:text-white text-slate-400 transition-all"
                >
                  <Trophy className="w-3 h-3 mr-1.5" />
                  Genel
                </TabsTrigger>
                <TabsTrigger
                  value="monthly"
                  className="text-xs font-medium py-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white text-slate-400 transition-all"
                >
                  <CalendarRange className="w-3 h-3 mr-1.5" />
                  Aylık
                </TabsTrigger>
                <TabsTrigger
                  value="weekly"
                  className="text-xs font-medium py-2 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white text-slate-400 transition-all"
                >
                  <Calendar className="w-3 h-3 mr-1.5" />
                  Haftalık
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        className="flex-1 overflow-y-auto px-5 py-4 relative z-10"
        onTouchStart={(e) => {
          swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const start = swipeRef.current;
          swipeRef.current = null;
          if (!start) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          const order = ["all-time", "monthly", "weekly"];
          const idx = order.indexOf(activeTab);
          const next = dx < 0 ? idx + 1 : idx - 1;
          if (next < 0 || next >= order.length) return;
          playSound("buttonClick");
          startTransition(() => setActiveTab(order[next]));
        }}
      >

        {activeTab === "all-time" && renderLeaderboard(allTimeLeaders, false, "season")}
        {activeTab === "weekly" && renderLeaderboard(weeklyLeaders, true, "weekly")}
        {activeTab === "monthly" && renderLeaderboard(monthlyLeaders, true, "monthly")}

        {/* Bottom Spacer */}
        <div className="h-20" />
      </div>

      <UserActionMenu
        open={!!menuTarget}
        onOpenChange={(o) => {
          if (!o) {
            setMenuTarget(null);
            setMenuAnchorRect(null);
          }
        }}
        userId={menuTarget?.user_id ?? null}
        username={menuTarget?.username}
        avatarUrl={menuTarget?.avatar_url ?? null}
        anchorRect={menuAnchorRect}
        fromRoute="/leaderboard"
      />
    </div>
  );
};

export default LeaderboardPage;
