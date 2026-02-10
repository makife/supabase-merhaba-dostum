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
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

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
          change: 0, // Genel sıralamada değişim göstermiyoruz ama veri tutarlılığı için
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

  // Haftalık sıralama
  const fetchWeeklyLeaders = async () => {
    try {
      // Tarih argümanı göndermeden (sunucu tarafı geçerli haftayı kullanır)
      console.log("Haftalık sorgu tarihi: (server default)");

      const { data, error } = await supabase.rpc("get_weekly_leaderboard", { limit_count: 100 });
      if (error) {
        console.error("Weekly leaderboard RPC error:", error);
        setWeeklyLeaders([]);
        return;
      }

      console.log("Haftalık veri geldi:", data);

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
      // Tarih argümanı göndermeden (sunucu tarafı geçerli ayı kullanır)
      console.log("Aylık sorgu tarihi: (server default)");

      const { data, error } = await supabase.rpc("get_monthly_leaderboard", { limit_count: 100 });
      if (error) {
        console.error("Monthly leaderboard RPC error:", error);
        setMonthlyLeaders([]);
        return;
      }

      console.log("Aylık veri geldi:", data);

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

  // Ana resync fonksiyonu
  const fetchOnlineUsers = async () => {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("user_presence")
        .select("user_id")
        .eq("is_online", true)
        .gte("last_seen", twoMinutesAgo);
      if (data) {
        setOnlineUserIds(new Set(data.map((d) => d.user_id)));
      }
    } catch (e) {
      console.error("Error fetching online users:", e);
    }
  };

  const handleLeaderboardResync = useCallback(async () => {
    await Promise.all([fetchAllTimeLeaders(), fetchWeeklyLeaders(), fetchMonthlyLeaders(), fetchOnlineUsers()]);
  }, []);

  // 🔄 Global Resync Hook - bağlantı kopup geldiğinde otomatik tazele
  usePageResync(handleLeaderboardResync, "LeaderboardPage", false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await handleLeaderboardResync();
      setLoading(false);
    };

    loadData();
  }, [user]);

  // Aktif sekme değiştiğinde ilgili listeyi tazele
  useEffect(() => {
    const refetchActive = async () => {
      if (activeTab === "all-time") await fetchAllTimeLeaders();
      if (activeTab === "weekly") await fetchWeeklyLeaders();
      if (activeTab === "monthly") await fetchMonthlyLeaders();
    };
    refetchActive();
  }, [activeTab]);

  // Sayfa tekrar görünür olduğunda tüm verileri tazele (oyun sonrası geri dönünce güncellensin)
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
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-700" />;
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">
            #{rank}
          </span>
        );
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
      case 3:
        return "bg-gradient-to-r from-amber-700 to-amber-900 text-white";
      default:
        return "bg-muted";
    }
  };

  const getRankChangeIcon = (change?: number) => {
    if (!change || change === 0) return null;
    if (change > 0) {
      return (
        <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold shadow-sm">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+{change}</span>
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold shadow-sm">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>{change}</span>
        </div>
      );
    }
    return null;
  };

  const renderLeaderboard = (leaders: LeaderboardEntry[], showChange: boolean = false) => (
    <div className="space-y-2">
      {leaders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Henüz oyun oynayan yok</p>
          <p className="text-sm">İlk sen ol!</p>
        </div>
      ) : (
        leaders.map((leader) => (
          <Card key={leader.user_id} className={`transition-all hover:shadow-md ${getRankColor(leader.rank)}`}>
            <CardContent className="p-3">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">{getRankIcon(leader.rank)}</div>
                <div className="relative flex-shrink-0">
                  <Avatar
                    className="w-10 h-10 cursor-pointer hover:ring-2 hover:ring-blue-300 transition-all"
                    onClick={() => navigate(`/profile/${leader.user_id}`)}
                  >
                    <AvatarImage src={leader.avatar_url || undefined} alt={leader.username} />
                    <AvatarFallback>{leader.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {onlineUserIds.has(leader.user_id) && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <h3
                        className={`font-semibold truncate text-sm cursor-pointer transition-colors ${
                          leader.rank <= 3 ? "text-white hover:text-blue-200" : "text-foreground hover:text-blue-600"
                        }`}
                        onClick={() => navigate(`/profile/${leader.user_id}`)}
                      >
                        {leader.username}
                      </h3>
                      {leader.user_id === user?.id && (
                        <Badge className="text-xs px-1.5 py-0 h-4 bg-white/20 text-white border-white/50 flex-shrink-0">
                          Sen
                        </Badge>
                      )}
                    </div>
                    {showChange && <div className="flex-shrink-0 ml-2">{getRankChangeIcon(leader.change)}</div>}
                  </div>
                  <div className="flex items-center space-x-3 text-xs">
                    <span
                      className={`flex items-center ${leader.rank <= 3 ? "text-white/80" : "text-muted-foreground"}`}
                    >
                      <Target className="w-3 h-3 mr-1" />
                      {leader.score}
                    </span>
                    {leader.games_played > 0 && (
                      <span
                        className={`flex items-center ${leader.rank <= 3 ? "text-white/80" : "text-muted-foreground"}`}
                      >
                        <Users className="w-3 h-3 mr-1" />
                        {leader.games_played}
                      </span>
                    )}
                    {leader.wins > 0 && (
                      <span
                        className={`flex items-center ${leader.rank <= 3 ? "text-white/80" : "text-muted-foreground"}`}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        {leader.wins}
                      </span>
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
        return "Son 7 günün en iyileri";
      case "monthly":
        return "Bu ayın en iyileri";
      default:
        return "Tüm zamanların en iyileri";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  const currentStats = getCurrentUserStats();

  return (
    <div className="h-screen bg-gradient-to-br from-background to-muted flex flex-col overflow-hidden">
      <div className="max-w-2xl mx-auto w-full flex flex-col h-full">
        {/* Sabit Header */}
        <div className="flex-shrink-0 bg-yellow-50/95 backdrop-blur-sm border-b border-yellow-200 p-3 pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                className="text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/20 bg-yellow-500/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Geri
              </Button>

              <div className="relative inline-block">
                {/* Stroke Background */}
                <img
                  src="/stroke.png"
                  alt="Stroke Background"
                  className="absolute inset-0 w-full h-full object-contain opacity-50"
                />
                {/* Liderlik Title */}
                <h1 className="text-3xl font-bold flex items-center text-yellow-600 relative z-10 px-6 py-3">
                  <Trophy className="w-6 h-6 mr-3 text-yellow-500" />
                  Liderlik
                </h1>
              </div>

              <div className="w-16" />
            </div>
            {currentStats && (
              <Card className="border-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Senin Performansın
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {activeTab === "weekly" ? "Bu Hafta" : activeTab === "monthly" ? "Bu Ay" : "Genel"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-primary">{currentStats.rank || "—"}</div>
                      <div className="text-xs text-muted-foreground">Sıralama</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-primary">{currentStats.score}</div>
                      <div className="text-xs text-muted-foreground">Puan</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-primary">{currentStats.games_played}</div>
                      <div className="text-xs text-muted-foreground">Oyun</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xl font-bold text-primary">{currentStats.wins}</div>
                      <div className="text-xs text-muted-foreground">Galibiyet</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Liderlik Sıralaması Başlık ve Tablar - Sabit */}
            <div className="pt-2">
              <h2 className="text-lg font-semibold mb-3">Liderlik Sıralaması</h2>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-9 bg-gray-100">
                  <TabsTrigger
                    value="all-time"
                    className="text-xs px-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white hover:bg-blue-100"
                  >
                    <Trophy className="w-3 h-3 mr-1" />
                    <span className="hidden xs:inline">Genel</span>
                    <span className="xs:hidden">Tümü</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="weekly"
                    className="text-xs px-2 data-[state=active]:bg-green-500 data-[state=active]:text-white hover:bg-green-100"
                  >
                    <Calendar className="w-3 h-3 mr-1" />
                    <span className="hidden xs:inline">Haftalık</span>
                    <span className="xs:hidden">Hafta</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="monthly"
                    className="text-xs px-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white hover:bg-purple-100"
                  >
                    <CalendarRange className="w-3 h-3 mr-1" />
                    <span className="hidden xs:inline">Aylık</span>
                    <span className="xs:hidden">Ay</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Scroll edilebilir Liste İçeriği */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <CardDescription className="text-center">{getTabDescription(activeTab)}</CardDescription>

          {activeTab === "all-time" && renderLeaderboard(allTimeLeaders, false)}
          {activeTab === "weekly" && renderLeaderboard(weeklyLeaders, true)}
          {activeTab === "monthly" && renderLeaderboard(monthlyLeaders, true)}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
