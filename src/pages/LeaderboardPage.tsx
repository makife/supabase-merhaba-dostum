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
  Zap,
  Award,
} from "lucide-react";

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
}

interface UserStats {
  allTime: LeaderboardEntry | null;
  weekly: LeaderboardEntry | null;
  monthly: LeaderboardEntry | null;
}

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  // ... TÜM MEVCUT FONKSİYONLAR AYNI KALACAK (fetchAllTimeLeaders, fetchWeeklyLeaders, vb.) ...
  // Genel sıralama (tüm zamanlar)
  const fetchAllTimeLeaders = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, total_score, total_games, wins")
        .order("total_score", { ascending: false })
        .limit(50);

      if (error) throw error;

      const allTimeData =
        data?.map((entry, index) => ({
          user_id: entry.id,
          username: entry.username || "Anonim",
          avatar_url: entry.avatar_url,
          score: entry.total_score || 0,
          games_played: entry.total_games || 0,
          wins: entry.wins || 0,
          best_word: null,
          best_word_score: 0,
          rank: index + 1,
          change: 0,
        })) || [];

      setAllTimeLeaders(allTimeData);

      if (user) {
        const userEntry = allTimeData.find((entry) => entry.user_id === user.id);
        setUserStats((prev) => ({ ...prev, allTime: userEntry || null }));
      }
    } catch (error) {
      console.error("Error fetching all-time leaders:", error);
      toast({
        title: "Hata",
        description: "Genel sıralama yüklenirken hata oluştu",
        variant: "destructive",
      });
    }
  };

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

  // 🎨 YENİ GÖRSEL FONKSİYONLAR
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="relative">
            <Crown className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulse" />
            <div className="absolute inset-0 animate-ping">
              <Crown className="w-8 h-8 text-yellow-400 opacity-75" />
            </div>
          </div>
        );
      case 2:
        return <Medal className="w-7 h-7 text-gray-300 drop-shadow-[0_0_6px_rgba(209,213,219,0.6)]" />;
      case 3:
        return <Medal className="w-7 h-7 text-amber-600 drop-shadow-[0_0_6px_rgba(217,119,6,0.6)]" />;
      default:
        return (
          <div className="w-8 h-8 flex items-center justify-center">
            <span className="text-sm font-bold text-gray-600">#{rank}</span>
          </div>
        );
    }
  };

  const getRankCardStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-br from-yellow-400/20 via-amber-300/20 to-yellow-500/20 border-2 border-yellow-400/50 shadow-[0_0_20px_rgba(250,204,21,0.3)] hover:shadow-[0_0_30px_rgba(250,204,21,0.5)] backdrop-blur-sm";
      case 2:
        return "bg-gradient-to-br from-gray-300/20 via-slate-200/20 to-gray-400/20 border-2 border-gray-300/50 shadow-[0_0_15px_rgba(209,213,219,0.3)] hover:shadow-[0_0_25px_rgba(209,213,219,0.5)] backdrop-blur-sm";
      case 3:
        return "bg-gradient-to-br from-amber-600/20 via-orange-500/20 to-amber-700/20 border-2 border-amber-600/50 shadow-[0_0_15px_rgba(217,119,6,0.3)] hover:shadow-[0_0_25px_rgba(217,119,6,0.5)] backdrop-blur-sm";
      default:
        return "bg-white/60 backdrop-blur-md border border-gray-200/50 hover:bg-white/80 hover:shadow-lg";
    }
  };

  const getRankChangeIcon = (change?: number) => {
    if (!change || change === 0) return null;
    if (change > 0) {
      return (
        <div className="flex items-center gap-1 bg-gradient-to-r from-green-400 to-emerald-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg animate-bounce">
          <TrendingUp className="w-4 h-4" />
          <span>+{change}</span>
          <Zap className="w-3 h-3" />
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 bg-gradient-to-r from-red-400 to-rose-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
          <TrendingDown className="w-4 h-4" />
          <span>{change}</span>
        </div>
      );
    }
  };

  const renderLeaderboard = (leaders: LeaderboardEntry[], showChange: boolean = false) => (
    <div className="space-y-3">
      {leaders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="relative inline-block mb-4">
            <Trophy className="w-20 h-20 mx-auto opacity-20" />
            <div className="absolute inset-0 animate-ping">
              <Trophy className="w-20 h-20 mx-auto opacity-10" />
            </div>
          </div>
          <p className="text-lg font-semibold">Henüz oyun oynayan yok</p>
          <p className="text-sm">İlk sen ol ve zirvede yerini al! 🚀</p>
        </div>
      ) : (
        leaders.map((leader, index) => (
          <Card
            key={leader.user_id}
            className={`transition-all duration-300 transform hover:scale-[1.02] ${getRankCardStyle(leader.rank)} ${
              index < 3 ? "animate-fadeIn" : ""
            }`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                {/* Rank Icon */}
                <div className="flex-shrink-0">{getRankIcon(leader.rank)}</div>

                {/* Avatar with Ring Effect */}
                <div className="relative">
                  <Avatar
                    className={`w-14 h-14 cursor-pointer transition-all duration-300 ${
                      leader.rank === 1
                        ? "ring-4 ring-yellow-400/50 ring-offset-2 ring-offset-yellow-100/50 hover:ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]"
                        : leader.rank === 2
                          ? "ring-4 ring-gray-300/50 ring-offset-2 hover:ring-gray-400"
                          : leader.rank === 3
                            ? "ring-4 ring-amber-500/50 ring-offset-2 hover:ring-amber-600"
                            : "ring-2 ring-gray-200 hover:ring-blue-400"
                    }`}
                    onClick={() => navigate(`/profile/${leader.user_id}`)}
                  >
                    <AvatarImage src={leader.avatar_url || undefined} alt={leader.username} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white font-bold">
                      {leader.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Fire effect for top 3 */}
                  {leader.rank <= 3 && (
                    <div className="absolute -top-1 -right-1">
                      <Flame
                        className={`w-5 h-5 ${
                          leader.rank === 1
                            ? "text-yellow-400 animate-pulse"
                            : leader.rank === 2
                              ? "text-gray-400"
                              : "text-amber-600"
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <h3
                        className={`font-bold truncate cursor-pointer transition-colors ${
                          leader.rank === 1
                            ? "text-xl text-yellow-600 hover:text-yellow-700"
                            : leader.rank === 2
                              ? "text-lg text-gray-700 hover:text-gray-800"
                              : leader.rank === 3
                                ? "text-lg text-amber-700 hover:text-amber-800"
                                : "text-base text-gray-700 hover:text-blue-600"
                        }`}
                        onClick={() => navigate(`/profile/${leader.user_id}`)}
                      >
                        {leader.username}
                      </h3>
                      {leader.user_id === user?.id && (
                        <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-none shadow-lg animate-pulse">
                          <Star className="w-3 h-3 mr-1" />
                          Sen
                        </Badge>
                      )}
                    </div>
                    {showChange && <div className="flex-shrink-0 ml-2">{getRankChangeIcon(leader.change)}</div>}
                  </div>

                  {/* Stats with Icons */}
                  <div className="flex items-center space-x-4 text-sm">
                    <div
                      className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
                        leader.rank <= 3 ? "bg-white/50 backdrop-blur-sm" : "bg-gray-100"
                      }`}
                    >
                      <Target className={`w-4 h-4 ${leader.rank === 1 ? "text-yellow-600" : "text-blue-500"}`} />
                      <span className="font-bold text-gray-700">{leader.score.toLocaleString()}</span>
                    </div>

                    {leader.games_played > 0 && (
                      <div
                        className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
                          leader.rank <= 3 ? "bg-white/50 backdrop-blur-sm" : "bg-gray-100"
                        }`}
                      >
                        <Users className="w-3.5 h-3.5 text-purple-500" />
                        <span className="text-gray-600">{leader.games_played}</span>
                      </div>
                    )}

                    {leader.wins > 0 && (
                      <div
                        className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
                          leader.rank <= 3 ? "bg-white/50 backdrop-blur-sm" : "bg-gray-100"
                        }`}
                      >
                        <Award className="w-3.5 h-3.5 text-green-500" />
                        <span className="text-gray-600">{leader.wins}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

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

  const getTabDescription = (tab: string) => {
    switch (tab) {
      case "weekly":
        return "🔥 Son 7 günün şampiyonları";
      case "monthly":
        return "⭐ Bu ayın yıldızları";
      default:
        return "👑 Tüm zamanların efsaneleri";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
            <Trophy className="absolute inset-0 m-auto w-8 h-8 text-blue-500 animate-pulse" />
          </div>
          <p className="mt-4 text-gray-600 font-semibold">Liderler yükleniyor...</p>
        </div>
      </div>
    );
  }

  const currentStats = getCurrentUserStats();

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex flex-col overflow-hidden relative">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-yellow-300/20 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute top-40 right-20 w-40 h-40 bg-purple-300/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute bottom-20 left-1/3 w-36 h-36 bg-blue-300/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      <div className="max-w-2xl mx-auto w-full flex flex-col h-full relative z-10">
        {/* Header with Glassmorphism */}
        <div className="flex-shrink-0 bg-white/40 backdrop-blur-xl border-b border-white/50 shadow-xl p-4 pt-6">
          <div className="space-y-4">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="bg-white/60 backdrop-blur-sm border-white/80 hover:bg-white/80 hover:shadow-lg transition-all duration-300"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Geri
              </Button>

              {/* Animated Title */}
              <div className="relative">
                <h1 className="text-4xl font-black flex items-center bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 bg-clip-text text-transparent animate-gradient">
                  <Trophy className="w-8 h-8 mr-3 text-yellow-500 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)] animate-bounce" />
                  Liderlik
                </h1>
                <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 blur-xl -z-10 animate-pulse"></div>
              </div>

              <div className="w-16" />
            </div>

            {/* User Stats Card */}
            {currentStats && (
              <Card className="border-2 border-white/50 bg-gradient-to-br from-white/70 to-white/50 backdrop-blur-xl shadow-2xl hover:shadow-3xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center text-purple-700">
                      <Zap className="w-5 h-5 mr-2 animate-pulse" />
                      Senin Performansın
                    </div>
                    <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white border-none shadow-lg">
                      {activeTab === "weekly" ? "🔥 Bu Hafta" : activeTab === "monthly" ? "⭐ Bu Ay" : "👑 Genel"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-yellow-100 to-amber-100 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                      <div className="text-2xl font-black text-yellow-600 mb-1">#{currentStats.rank || "—"}</div>
                      <div className="text-xs text-yellow-700 font-semibold">Sıralama</div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                      <div className="text-2xl font-black text-blue-600 mb-1">{currentStats.score}</div>
                      <div className="text-xs text-blue-700 font-semibold">Puan</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                      <div className="text-2xl font-black text-purple-600 mb-1">{currentStats.games_played}</div>
                      <div className="text-xs text-purple-700 font-semibold">Oyun</div>
                    </div>
                    <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                      <div className="text-2xl font-black text-green-600 mb-1">{currentStats.wins}</div>
                      <div className="text-xs text-green-700 font-semibold">Galibiyet</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs with Modern Design */}
            <div className="pt-2">
              <h2 className="text-xl font-bold mb-3 text-gray-800">🏆 Liderlik Sıralaması</h2>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-12 bg-white/60 backdrop-blur-sm rounded-xl p-1 shadow-lg">
                  <TabsTrigger
                    value="all-time"
                    className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    <span className="font-semibold">Genel</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="weekly"
                    className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="font-semibold">Haftalık</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="monthly"
                    className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300"
                  >
                    <CalendarRange className="w-4 h-4 mr-2" />
                    <span className="font-semibold">Aylık</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Scrollable Leaderboard List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-transparent">
          <CardDescription className="text-center text-lg font-semibold text-gray-700 mb-2">
            {getTabDescription(activeTab)}
          </CardDescription>

          {activeTab === "all-time" && renderLeaderboard(allTimeLeaders, false)}
          {activeTab === "weekly" && renderLeaderboard(weeklyLeaders, true)}
          {activeTab === "monthly" && renderLeaderboard(monthlyLeaders, true)}
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }

        @keyframes gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }

        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }

        .scrollbar-thumb-purple-300::-webkit-scrollbar-thumb {
          background-color: rgba(216, 180, 254, 0.5);
          border-radius: 3px;
        }

        .scrollbar-track-transparent::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
};

export default LeaderboardPage;
