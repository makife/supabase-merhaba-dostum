import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  Gamepad2,
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

  // --- Veri Çekme Fonksiyonları (Aynı) ---
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
    }
  };

  const fetchWeeklyLeaders = async () => {
    try {
      const { data, error } = await supabase.rpc("get_weekly_leaderboard", { limit_count: 100 });
      if (error) {
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

  // --- Görsel Yardımcılar ---
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

  const renderLeaderboard = (leaders: LeaderboardEntry[], showChange: boolean = false) => (
    <div className="space-y-2 pb-20">
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
              <div className="flex-shrink-0 w-8 flex justify-center mr-3">{style.icon}</div>

              <div className="relative mr-3">
                <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                  <AvatarImage src={leader.avatar_url || undefined} />
                  <AvatarFallback className="bg-slate-200 text-slate-600 font-bold">
                    {leader.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {leader.rank <= 3 && (
                  <div
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${style.badge}`}
                  >
                    {leader.rank}
                  </div>
                )}
              </div>

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
                    <span className="font-medium text-slate-700">{leader.score} P</span>
                  </div>
                  {leader.wins > 0 && (
                    <div className="flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-yellow-500" />
                      <span>{leader.wins} W</span>
                    </div>
                  )}
                </div>
              </div>

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
    // Ana Konteyner: Ekran boyutuna sabitlendi ve taşmalar gizlendi
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* TABS WRAPPER: 
        Hem sabit üst kısmı hem de kayan alt kısmı kapsıyor.
        Böylece TabsList (üstte) ve TabsContent (altta) iletişim kurabiliyor.
      */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        {/* --- SABİT ÜST KISIM (HEADER + KART + TABLAR) --- */}
        <div className="z-20 bg-slate-50 border-b border-slate-200 shadow-sm flex-shrink-0">
          <div className="max-w-md mx-auto px-4 py-3 pb-0 space-y-4">
            {/* Header: Geri Butonu ve Başlık */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="-ml-2 hover:bg-slate-100 rounded-full"
              >
                <ArrowLeft className="w-6 h-6 text-slate-700" />
              </Button>
              <h1 className="text-lg font-bold text-slate-800">Liderlik Tablosu</h1>
              <div className="w-10" />
            </div>

            {/* Sabit İstatistik Kartı */}
            {currentStats && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/20 transform transition-all active:scale-[0.99]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 bg-white/20 px-2 py-1 rounded-lg backdrop-blur-sm">
                    <TrendingUp className="w-4 h-4 text-blue-100" />
                    <span className="text-xs font-bold">Senin Performansın</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-white/30 text-blue-50">
                    {activeTab === "weekly" ? "Haftalık" : activeTab === "monthly" ? "Aylık" : "Genel"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4">
                  <div className="bg-white/20 w-16 h-16 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/10 flex-shrink-0">
                    <span className="text-2xl font-black">{currentStats.rank > 0 ? `#${currentStats.rank}` : "-"}</span>
                  </div>

                  {/* İstatistik Grid - 3 Kolonlu */}
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div className="bg-black/10 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-blue-100 uppercase font-bold opacity-70 mb-0.5">Puan</p>
                      <p className="text-base font-bold">{currentStats.score}</p>
                    </div>
                    <div className="bg-black/10 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-blue-100 uppercase font-bold opacity-70 mb-0.5">Galibiyet</p>
                      <p className="text-base font-bold">{currentStats.wins}</p>
                    </div>
                    <div className="bg-black/10 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-blue-100 uppercase font-bold opacity-70 mb-0.5">Oyun</p>
                      <p className="text-base font-bold">{currentStats.games_played}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sabit Tab Listesi */}
            <div className="pb-3">
              <TabsList className="w-full h-14 bg-slate-200/50 p-1.5 rounded-2xl grid grid-cols-3 gap-2">
                <TabsTrigger
                  value="all-time"
                  className="h-full rounded-xl text-xs font-bold text-slate-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-400 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  <Trophy className="w-4 h-4 mb-0.5 block mx-auto xs:inline xs:mr-1 xs:mb-0" />
                  Genel
                </TabsTrigger>
                <TabsTrigger
                  value="weekly"
                  className="h-full rounded-xl text-xs font-bold text-slate-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-400 data-[state=active]:to-teal-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  <Calendar className="w-4 h-4 mb-0.5 block mx-auto xs:inline xs:mr-1 xs:mb-0" />
                  Haftalık
                </TabsTrigger>
                <TabsTrigger
                  value="monthly"
                  className="h-full rounded-xl text-xs font-bold text-slate-500 data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-400 data-[state=active]:to-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
                >
                  <CalendarRange className="w-4 h-4 mb-0.5 block mx-auto xs:inline xs:mr-1 xs:mb-0" />
                  Aylık
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
        </div>

        {/* --- KAYDIRILABİLİR ALT KISIM (LİSTE) --- */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto w-full p-4 pt-2">
            <TabsContent value="all-time" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {renderLeaderboard(allTimeLeaders, false)}
            </TabsContent>
            <TabsContent value="weekly" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {renderLeaderboard(weeklyLeaders, true)}
            </TabsContent>
            <TabsContent value="monthly" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {renderLeaderboard(monthlyLeaders, true)}
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
};

export default LeaderboardPage;
