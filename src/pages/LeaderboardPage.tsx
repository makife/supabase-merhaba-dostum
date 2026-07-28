import { useState, useEffect, useCallback } from "react";
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
import { IN_GAME_STATUS_POLL_MS, getInGameActivityThreshold } from "@/utils/playerActivityStatus";
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
      const activeSince = getInGameActivityThreshold();

      const [{ data }, { data: activePlayers }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, premium_until, in_game")
          .in("id", userIds),
        supabase
          .from("player_activities")
          .select("player_id")
          .in("player_id", userIds)
          .gte("last_action_time", activeSince),
      ]);

      if (data && activePlayers) {
        const premSet = new Set<string>();
        const gameSet = new Set<string>();
        
        // player_activities'teki aktif oyuncuları bir set'e al
        const activePlayerIds = new Set(activePlayers.map((p: any) => p.player_id));
        
        data.forEach((p: any) => {
          // Premium kullanıcıları ekle
          if (p.premium_until && new Date(p.premium_until) > now) premSet.add(p.id);
          
          // in_game flag'i true VEYA player_activities'te aktif olan oyuncu → neon mavi yap
          if (p.in_game || activePlayerIds.has(p.id)) gameSet.add(p.id);
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

  // Initial data fetch + polling setup
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchAllTimeLeaders(),
        fetchWeeklyLeaders(),
        fetchMonthlyLeaders(),
      ]);
      setLoading(false);
    };

    loadData();

    // Polling interval setup
    const interval = setInterval(() => {
      Promise.all([fetchAllTimeLeaders(), fetchWeeklyLeaders(), fetchMonthlyLeaders()]);
    }, 30000); // Her 30 saniyede bir yenile

    return () => clearInterval(interval);
  }, [user]);

  // Premium ve in_game status güncellemesi
  useEffect(() => {
    const allLeaders = [...allTimeLeaders, ...weeklyLeaders, ...monthlyLeaders];
    const uniqueUserIds = Array.from(new Set(allLeaders.map((l) => l.user_id)));

    if (uniqueUserIds.length > 0) {
      fetchPremiumStatus(uniqueUserIds);

      const statusInterval = setInterval(() => {
        fetchPremiumStatus(uniqueUserIds);
      }, IN_GAME_STATUS_POLL_MS);

      return () => clearInterval(statusInterval);
    }
  }, [allTimeLeaders, weeklyLeaders, monthlyLeaders]);

  const getRankChangeIcon = (change?: number) => {
    if (!change || change === 0) return <span className="text-slate-500">−</span>;
    if (change > 0) {
      return (
        <div className="flex items-center gap-1 text-red-400">
          <TrendingDown className="w-3 h-3" />
          <span className="text-xs font-semibold">{change}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-green-400">
        <TrendingUp className="w-3 h-3" />
        <span className="text-xs font-semibold">{Math.abs(change)}</span>
      </div>
    );
  };

  const renderLeaderboard = (
    leaders: LeaderboardEntry[],
    showChange: boolean,
    type: "season" | "weekly" | "monthly"
  ) => {
    if (leaders.length === 0) {
      return (
        <div className="flex items-center justify-center min-h-96">
          <p className="text-slate-400 text-center">
            {type === "season"
              ? "Henüz sezon sıralaması yok"
              : type === "weekly"
                ? "Henüz haftalık sıralama yok"
                : "Henüz aylık sıralama yok"}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {leaders.map((leader, index) => {
          const isCurrentUser = user && user.id === leader.user_id;
          const isPremium = premiumUsers.has(leader.user_id);

          return (
            <div
              key={`${leader.user_id}-${type}`}
              className={`group relative rounded-2xl border backdrop-blur-sm transition-all ${
                inGameUsers.has(leader.user_id)
                  ? "border-cyan-500/50 bg-[#0f1829]/60 shadow-lg shadow-cyan-500/20 hover:border-cyan-400 hover:shadow-cyan-500/30"
                  : isCurrentUser
                    ? "border-indigo-500/50 bg-[#0f1829]/60 shadow-lg shadow-indigo-500/20 hover:border-indigo-400 hover:shadow-indigo-500/30"
                    : "border-white/5 bg-[#1e2d45]/40 hover:border-white/10 hover:bg-[#1e2d45]/60"
              }`}
            >
              {/* Background Glow Effect (only for in-game users) */}
              {inGameUsers.has(leader.user_id) && (
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
              )}

              <div className="relative z-10 p-4">
                <div className="flex items-center gap-3">
                  {/* Rank Badge */}
                  <div className="flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? "bg-gradient-to-br from-yellow-500 to-amber-600 text-white"
                          : index === 1
                            ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900"
                            : index === 2
                              ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white"
                              : "bg-[#0f1829] text-slate-400 border border-white/10"
                      }`}
                    >
                      {leader.rank > 0 ? `#${leader.rank}` : `#${index + 1}`}
                    </div>
                  </div>

                  {/* Avatar + Username */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-shrink-0 relative">
                        <Avatar className="w-10 h-10 border border-white/10">
                          <AvatarImage src={leader.avatar_url || ""} alt={leader.username} />
                          <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold">
                            {leader.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Premium Badge */}
                        {isPremium && (
                          <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1 shadow-lg">
                            <Star className="w-3 h-3 text-white fill-white" />
                          </div>
                        )}

                        {/* In-Game Indicator */}
                        {inGameUsers.has(leader.user_id) && (
                          <div className="absolute -bottom-1 -right-1 bg-cyan-500 rounded-full p-1 shadow-lg shadow-cyan-500/50">
                            <Flame className="w-3 h-3 text-white fill-white" />
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
                                : isCurrentUser
                                  ? { color: "#ffffff" }
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
                    </div>
                  </div>

                  {/* Flex spacer for layout */}
                  <div className="hidden sm:block flex-1" />

                  {showChange && <div className="flex-shrink-0">{getRankChangeIcon(leader.change)}</div>}
                </div>
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
      <div className="flex-1 overflow-y-auto px-5 py-4 relative z-10">
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
