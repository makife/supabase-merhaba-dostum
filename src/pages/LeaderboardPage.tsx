import { useState, useEffect, useCallback } from "react";
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
  const [premiumUsers, setPremiumUsers] = useState<Set<string>>(new Set());

  // Fetch premium status for a list of user IDs
  const fetchPremiumStatus = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    try {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("profiles")
        .select("id, premium_until")
        .in("id", userIds)
        .gt("premium_until", now);
      if (data) {
        setPremiumUsers(prev => {
          const newSet = new Set(prev);
          data.forEach((p: any) => newSet.add(p.id));
          return newSet;
        });
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

  // Fetch premium status whenever leaders change
  useEffect(() => {
    const allUserIds = [
      ...allTimeLeaders.map(l => l.user_id),
      ...weeklyLeaders.map(l => l.user_id),
      ...monthlyLeaders.map(l => l.user_id),
    ];
    const uniqueIds = [...new Set(allUserIds)];
    if (uniqueIds.length > 0) fetchPremiumStatus(uniqueIds);
  }, [allTimeLeaders, weeklyLeaders, monthlyLeaders]);

  usePageResync(handleLeaderboardResync, "LeaderboardPage", false);

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

  const renderPodiumCard = (leader: LeaderboardEntry, rank: number, size: "lg" | "sm") => {
    const isCurrentUser = leader.user_id === user?.id;
    const avatarSize = size === "lg" ? "w-16 h-16" : "w-12 h-12";
    const wrapperSize = size === "lg" ? "w-[18px] h-[18px]" : "w-[16px] h-[16px]";
    const borderColor = rank === 1
      ? "from-amber-300 to-yellow-500"
      : rank === 2
        ? "from-slate-300 to-slate-400"
        : "from-orange-400 to-orange-600";
    const bgColor = rank === 1
      ? "bg-gradient-to-b from-amber-500/20 to-yellow-600/10 border-amber-400/30"
      : rank === 2
        ? "bg-gradient-to-b from-slate-400/15 to-slate-500/5 border-slate-400/25"
        : "bg-gradient-to-b from-orange-500/15 to-orange-600/5 border-orange-500/25";
    const rankBadge = rank === 1 
      ? <img src="/liderlik1numara.svg" alt="1." className={size === "lg" ? "w-8 h-8" : "w-6 h-6"} />
      : <span className="text-lg">{rank === 2 ? "🥈" : "🥉"}</span>;

    return (
      <div
        className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 border transition-all ${bgColor} ${size === "lg" ? "pt-4 pb-3" : "pt-3 pb-2"}`}
      >
        {rankBadge}
        <div className="relative">
          <div className={`${avatarSize} rounded-full p-[2px] bg-gradient-to-tr ${borderColor}`}>
            <Avatar
              className={`w-full h-full cursor-pointer hover:scale-110 transition-transform ${
                activeTab === "all-time"
                  ? "ring-2 ring-red-500 ring-offset-1 ring-offset-slate-900"
                  : activeTab === "monthly"
                    ? "ring-2 ring-green-500 ring-offset-1 ring-offset-slate-900"
                    : "ring-2 ring-blue-500 ring-offset-1 ring-offset-slate-900"
              }`}
              onClick={() => navigate(`/profile/${leader.user_id}`)}
            >
              <AvatarImage src={leader.avatar_url || undefined} alt={leader.username} />
              <AvatarFallback className="bg-slate-800 text-slate-400 text-xs">
                {leader.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          {isUserOnline(leader.user_id) && (
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#1a1a2e] rounded-full" />
          )}
          {premiumUsers.has(leader.user_id) && (
            <div className="absolute -top-1 -right-1 z-20">
              <VipBadge size="xs" />
            </div>
          )}
        </div>
        <div className="text-center min-w-0 w-full">
          <h3
            className="font-bold text-white text-xs truncate cursor-pointer hover:text-indigo-300 transition-colors"
            onClick={() => navigate(`/profile/${leader.user_id}`)}
          >
            {leader.username}
          </h3>
          {isCurrentUser && (
            <span className="text-[9px] text-indigo-400 font-bold">(Sen)</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <Target className="w-3 h-3" />
          <span className="font-bold text-amber-400">{leader.score.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  const renderLeaderboard = (leaders: LeaderboardEntry[], showChange: boolean = false) => {
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
          <div className="flex flex-col items-center gap-2 mb-4">
            {/* 1st place */}
            {first && (
              <div className="w-[55%]">
                {renderPodiumCard(first, 1, "lg")}
              </div>
            )}
            {/* 2nd & 3rd */}
            {(second || third) && (
              <div className="flex gap-3 w-full">
                <div className="flex-1">
                  {second ? renderPodiumCard(second, 2, "sm") : <div />}
                </div>
                <div className="flex-1">
                  {third ? renderPodiumCard(third, 3, "sm") : <div />}
                </div>
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
                      onClick={() => navigate(`/profile/${leader.user_id}`)}
                    >
                      <AvatarImage src={leader.avatar_url || undefined} alt={leader.username} />
                      <AvatarFallback className="bg-slate-800 text-slate-400 text-xs">
                        {leader.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  {isUserOnline(leader.user_id) && (
                    <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-[#1a1a2e] rounded-full" />
                  )}
                  {premiumUsers.has(leader.user_id) && (
                    <div className="absolute -top-1 -right-1 z-20">
                      <VipBadge size="xs" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className="font-bold text-white truncate text-sm cursor-pointer hover:text-indigo-300 transition-colors"
                      onClick={() => navigate(`/profile/${leader.user_id}`)}
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
          <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
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
                <div className="bg-[#0f1829] rounded-xl p-2 text-center">
                  <div className="text-lg font-bold text-amber-500">#{currentStats.rank || "—"}</div>
                  <div className="text-[10px] text-slate-400">Sıra</div>
                </div>
                <div className="bg-[#0f1829] rounded-xl p-2 text-center">
                  <div className="text-lg font-bold text-indigo-400">{currentStats.score}</div>
                  <div className="text-[10px] text-slate-400">Puan</div>
                </div>
                <div className="bg-[#0f1829] rounded-xl p-2 text-center">
                  <div className="text-lg font-bold text-blue-400">{currentStats.games_played}</div>
                  <div className="text-[10px] text-slate-400">Oyun</div>
                </div>
                <div className="bg-[#0f1829] rounded-xl p-2 text-center">
                  <div className="text-lg font-bold text-green-400">{currentStats.wins}</div>
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
      <div className="flex-1 overflow-y-auto px-5 py-4 relative z-10">
        {activeTab === "all-time" && renderLeaderboard(allTimeLeaders, false)}
        {activeTab === "weekly" && renderLeaderboard(weeklyLeaders, true)}
        {activeTab === "monthly" && renderLeaderboard(monthlyLeaders, true)}

        {/* Bottom Spacer */}
        <div className="h-20" />
      </div>
    </div>
  );
};

export default LeaderboardPage;
