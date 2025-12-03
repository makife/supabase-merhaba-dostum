import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

// Renk Sabitleri
const RANK_COLORS = {
  first: "bg-yellow-400",
  second: "bg-gray-300",
  third: "bg-amber-600",
  default: "bg-slate-100",
  textFirst: "text-yellow-700",
  textSecond: "text-gray-700",
  textThird: "text-amber-800",
  textDefault: "text-slate-600",
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

  // --- Veri Çekme Fonksiyonları (DEĞİŞTİRİLMEDİ) ---
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
  // --------------------------------------------------

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAllTimeLeaders(), fetchWeeklyLeaders(), fetchMonthlyLeaders()]);
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
        await Promise.all([fetchAllTimeLeaders(), fetchWeeklyLeaders(), fetchMonthlyLeaders()]);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // --- Görsel Yardımcı Fonksiyonlar ---
  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return {
          bg: "bg-yellow-50 border-yellow-200",
          badge: RANK_COLORS.first,
          icon: <Crown className="w-5 h-5 text-yellow-600 fill-yellow-600" />,
          text: RANK_COLORS.textFirst,
        };
      case 2:
        return {
          bg: "bg-gray-50 border-gray-200",
          badge: RANK_COLORS.second,
          icon: <Medal className="w-5 h-5 text-gray-500 fill-gray-500" />,
          text: RANK_COLORS.textSecond,
        };
      case 3:
        return {
          bg: "bg-orange-50 border-orange-200",
          badge: RANK_COLORS.third,
          icon: <Medal className="w-5 h-5 text-amber-700 fill-amber-700" />,
          text: RANK_COLORS.textThird,
        };
      default:
        return {
          bg: "bg-white border-slate-100 hover:bg-slate-50",
          badge: RANK_COLORS.default,
          icon: <span className="text-sm font-bold text-slate-500 w-5 text-center">{rank}</span>,
          text: RANK_COLORS.textDefault,
        };
    }
  };

  const getRankChangeIcon = (change?: number) => {
    if (!change || change === 0) return null;
    return (
      <div
        className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          change > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}
      >
        {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>{Math.abs(change)}</span>
      </div>
    );
  };

  // --- Liste Render Fonksiyonu ---
  const renderLeaderboard = (leaders: LeaderboardEntry[], showChange: boolean = false) => (
    <div className="space-y-2 pb-20">
      {" "}
      {/* Alt boşluk eklendi */}
      {leaders.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-slate-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">Liste Boş</h3>
          <p className="text-sm text-slate-500">Henüz kimse bu listeye giremedi. İlk sen ol!</p>
        </div>
      ) : (
        leaders.map((leader) => {
          const style = getRankStyle(leader.rank);
          const isCurrentUser = leader.user_id === user?.id;

          return (
            <div
              key={leader.user_id}
              onClick={() => navigate(`/profile/${leader.user_id}`)}
              className={`
                relative flex items-center p-3 rounded-xl border transition-all active:scale-[0.98] cursor-pointer
                ${style.bg}
                ${isCurrentUser ? "ring-2 ring-blue-500 ring-offset-2" : ""}
              `}
            >
              {/* Sıralama Rozeti */}
              <div className="flex-shrink-0 w-8 flex justify-center mr-3">{style.icon}</div>

              {/* Avatar */}
              <div className="relative mr-3">
                <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                  <AvatarImage src={leader.avatar_url || undefined} />
                  <AvatarFallback className="bg-slate-200 text-slate-600 font-bold">
                    {leader.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {/* İlk 3 için küçük rozet */}
                {leader.rank <= 3 && (
                  <div
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${style.badge}`}
                  >
                    {leader.rank}
                  </div>
                )}
              </div>

              {/* İsim ve Puan */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className={`font-bold text-sm truncate ${isCurrentUser ? "text-blue-700" : "text-slate-800"}`}>
                    {leader.username}
                  </h3>
                  {isCurrentUser && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-4 px-1 bg-blue-100 text-blue-700 hover:bg-blue-100"
                    >
                      Sen
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3 text-blue-500" />
                    <span className="font-medium text-slate-700">{leader.score} Puan</span>
                  </div>
                  {leader.wins > 0 && (
                    <div className="flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-yellow-500" />
                      <span>{leader.wins} Win</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Değişim Göstergesi (Sağ Taraf) */}
              <div className="flex flex-col items-end gap-1 ml-2">{showChange && getRankChangeIcon(leader.change)}</div>
            </div>
          );
        })
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
        return "Bu hafta en yüksek puanı toplayanlar";
      case "monthly":
        return "Bu ayın şampiyonları";
      default:
        return "Tüm zamanların efsaneleri";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-sm text-slate-500 font-medium">Sıralama Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const currentStats = getCurrentUserStats();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Sabit Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 safe-area-pt">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="-ml-2 hover:bg-slate-100 rounded-full"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </Button>
          <h1 className="text-lg font-bold text-slate-800">Liderlik Tablosu</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto w-full p-4 space-y-6">
          {/* Kendi İstatistik Kartın */}
          {currentStats && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/20 transform transition-all active:scale-[0.99]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                  <TrendingUp className="w-4 h-4 text-blue-100" />
                  <span className="text-xs font-bold">Senin Sıralaman</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-white/30 text-blue-50">
                  {activeTab === "weekly" ? "Haftalık" : activeTab === "monthly" ? "Aylık" : "Genel"}
                </Badge>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-white/20 w-16 h-16 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                  <span className="text-2xl font-black">{currentStats.rank > 0 ? `#${currentStats.rank}` : "-"}</span>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="bg-black/10 rounded-lg p-2">
                    <p className="text-[10px] text-blue-100 uppercase font-bold opacity-70">Puan</p>
                    <p className="text-lg font-bold">{currentStats.score}</p>
                  </div>
                  <div className="bg-black/10 rounded-lg p-2">
                    <p className="text-[10px] text-blue-100 uppercase font-bold opacity-70">Galibiyet</p>
                    <p className="text-lg font-bold">{currentStats.wins}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tablar ve Liste */}
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full h-11 bg-white p-1 rounded-xl shadow-sm border border-slate-200 grid grid-cols-3 mb-4">
                <TabsTrigger
                  value="all-time"
                  className="rounded-lg text-xs font-medium data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  Genel
                </TabsTrigger>
                <TabsTrigger
                  value="weekly"
                  className="rounded-lg text-xs font-medium data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  Haftalık
                </TabsTrigger>
                <TabsTrigger
                  value="monthly"
                  className="rounded-lg text-xs font-medium data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"
                >
                  Aylık
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                <p className="text-xs text-slate-500 font-medium">{getTabDescription(activeTab)}</p>
              </div>

              <TabsContent value="all-time" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {renderLeaderboard(allTimeLeaders, false)}
              </TabsContent>
              <TabsContent value="weekly" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {renderLeaderboard(weeklyLeaders, true)}
              </TabsContent>
              <TabsContent value="monthly" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {renderLeaderboard(monthlyLeaders, true)}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;
