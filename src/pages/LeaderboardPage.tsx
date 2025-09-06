import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  CalendarRange
} from 'lucide-react';

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
    monthly: null
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all-time');

  // Genel sıralama (tüm zamanlar)
  const fetchAllTimeLeaders = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, total_score')
        .order('total_score', { ascending: false })
        .limit(50);

      if (error) throw error;

      const allTimeData = data?.map((entry, index) => ({
        user_id: entry.id,
        username: entry.username || 'Anonim',
        avatar_url: entry.avatar_url,
        score: entry.total_score || 0,
        games_played: 0,
        wins: 0,
        best_word: null,
        best_word_score: 0,
        rank: index + 1
      })) || [];

      setAllTimeLeaders(allTimeData);

      if (user) {
        const userEntry = allTimeData.find(entry => entry.user_id === user.id);
        setUserStats(prev => ({ ...prev, allTime: userEntry || null }));
      }
    } catch (error) {
      console.error('Error fetching all-time leaders:', error);
      toast({
        title: 'Hata',
        description: 'Genel sıralama yüklenirken hata oluştu',
        variant: 'destructive',
      });
    }
  };

  // Haftalık sıralama - gerçek veriler
  const fetchWeeklyLeaders = async () => {
    try {
      // Bu haftanın başlangıcını hesapla (Pazartesi)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Pazar = 0, Pazartesi = 1
      const mondayDate = new Date(today);
      mondayDate.setDate(today.getDate() - daysToMonday);
      mondayDate.setHours(0, 0, 0, 0);
      
      const weekStartStr = mondayDate.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Type-safe RPC çağrısı
      const { data, error } = await supabase.rpc('get_weekly_leaderboard' as any, {
        target_week_start: weekStartStr
      });

      if (error) {
        console.error('Weekly leaderboard RPC error:', error);
        // Fallback: Bu hafta veri yoksa boş array
        setWeeklyLeaders([]);
        if (user) {
          setUserStats(prev => ({ ...prev, weekly: null }));
        }
        return;
      }

      // Type guard ile array kontrolü
      const weeklyData = Array.isArray(data) ? data.map((entry: any, index: number) => ({
        user_id: entry.user_id,
        username: entry.username || 'Anonim',
        avatar_url: entry.avatar_url,
        score: entry.weekly_score || 0,
        games_played: entry.games_played || 0,
        wins: entry.games_won || 0,
        best_word: null,
        best_word_score: 0,
        rank: entry.rank_position || index + 1,
        change: entry.rank_change || 0
      })) : [];

      setWeeklyLeaders(weeklyData);

      if (user) {
        const userEntry = weeklyData.find((entry: LeaderboardEntry) => entry.user_id === user.id);
        setUserStats(prev => ({ ...prev, weekly: userEntry || null }));
      }
    } catch (error) {
      console.error('Error fetching weekly leaders:', error);
      setWeeklyLeaders([]);
    }
  };

  // Aylık sıralama - gerçek veriler
  const fetchMonthlyLeaders = async () => {
    try {
      // Bu ayın başlangıcını hesapla
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = firstDayOfMonth.toISOString().split('T')[0]; // YYYY-MM-DD format

      // Type-safe RPC çağrısı
      const { data, error } = await supabase.rpc('get_monthly_leaderboard' as any, {
        target_month_start: monthStartStr
      });

      if (error) {
        console.error('Monthly leaderboard RPC error:', error);
        // Fallback: Bu ay veri yoksa boş array
        setMonthlyLeaders([]);
        if (user) {
          setUserStats(prev => ({ ...prev, monthly: null }));
        }
        return;
      }

      // Type guard ile array kontrolü
      const monthlyData = Array.isArray(data) ? data.map((entry: any, index: number) => ({
        user_id: entry.user_id,
        username: entry.username || 'Anonim',
        avatar_url: entry.avatar_url,
        score: entry.monthly_score || 0,
        games_played: entry.games_played || 0,
        wins: entry.games_won || 0,
        best_word: null,
        best_word_score: 0,
        rank: entry.rank_position || index + 1,
        change: entry.rank_change || 0
      })) : [];

      setMonthlyLeaders(monthlyData);

      if (user) {
        const userEntry = monthlyData.find((entry: LeaderboardEntry) => entry.user_id === user.id);
        setUserStats(prev => ({ ...prev, monthly: userEntry || null }));
      }
    } catch (error) {
      console.error('Error fetching monthly leaders:', error);
      setMonthlyLeaders([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchAllTimeLeaders(),
        fetchWeeklyLeaders(),
        fetchMonthlyLeaders()
      ]);
      setLoading(false);
    };

    loadData();
  }, [user]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-700" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white';
      case 2:
        return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white';
      case 3:
        return 'bg-gradient-to-r from-amber-700 to-amber-900 text-white';
      default:
        return 'bg-muted';
    }
  };

  const getRankChangeIcon = (change?: number) => {
    if (!change) return null;
    if (change > 0) {
      return <span className="text-green-600 text-xs font-bold">↑{change}</span>;
    } else if (change < 0) {
      return <span className="text-red-600 text-xs font-bold">↓{Math.abs(change)}</span>;
    }
    return <span className="text-gray-500 text-xs font-bold">-</span>;
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
                {/* Rank Icon */}
                <div className="flex-shrink-0">
                  {getRankIcon(leader.rank)}
                </div>
                
                {/* Avatar */}
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={leader.avatar_url || undefined} alt={leader.username} />
                  <AvatarFallback>
                    {leader.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                {/* User Info - Ana alan */}
                <div className="flex-1 min-w-0">
                  {/* İsim ve rozetler satırı */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <h3 className={`font-semibold truncate text-sm ${leader.rank <= 3 ? 'text-white' : 'text-foreground'}`}>
                        {leader.username}
                      </h3>
                      {leader.user_id === user?.id && (
                        <Badge className="text-xs px-1.5 py-0 h-4 bg-white/20 text-white border-white/50 flex-shrink-0">
                          Sen
                        </Badge>
                      )}
                    </div>
                    {/* Değişim göstergesi sağ tarafa */}
                    {showChange && (
                      <div className="flex-shrink-0 ml-2">
                        {getRankChangeIcon(leader.change)}
                      </div>
                    )}
                  </div>
                  
                  {/* İstatistikler satırı */}
                  <div className="flex items-center space-x-3 text-xs">
                    <span className={`flex items-center ${leader.rank <= 3 ? 'text-white/80' : 'text-muted-foreground'}`}>
                      <Target className="w-3 h-3 mr-1" />
                      {leader.score}
                    </span>
                    <span className={`flex items-center ${leader.rank <= 3 ? 'text-white/80' : 'text-muted-foreground'}`}>
                      <Users className="w-3 h-3 mr-1" />
                      {leader.games_played}
                    </span>
                    {leader.wins > 0 && (
                      <span className={`flex items-center ${leader.rank <= 3 ? 'text-white/80' : 'text-muted-foreground'}`}>
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
      case 'weekly':
        return userStats.weekly;
      case 'monthly':
        return userStats.monthly;
      default:
        return userStats.allTime;
    }
  };

  const getTabDescription = (tab: string) => {
    switch (tab) {
      case 'weekly':
        return 'Son 7 günün en iyileri';
      case 'monthly':
        return 'Bu ayın en iyileri';
      default:
        return 'Tüm zamanların en iyileri';
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-3">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/')} className="text-xs">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <h1 className="text-xl font-bold flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
            Liderlik
          </h1>
          <div className="w-12" />
        </div>

        {/* Kullanıcının kendi durumu */}
        {currentStats && (
          <Card className="border-primary">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Senin Performansın
                </div>
                <Badge variant="outline" className="text-xs">
                  {activeTab === 'weekly' ? 'Bu Hafta' : 
                   activeTab === 'monthly' ? 'Bu Ay' : 'Genel'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-xl font-bold text-primary">{currentStats.rank || '—'}</div>
                  <div className="text-xs text-muted-foreground">Sıralama</div>
                  {activeTab !== 'all-time' && currentStats.change && (
                    <div className="mt-1">{getRankChangeIcon(currentStats.change)}</div>
                  )}
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

        {/* Liderlik Tabloları */}
        <Card>
          <CardHeader>
            <CardTitle>Liderlik Sıralaması</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-9">
                <TabsTrigger value="all-time" className="text-xs px-2">
                  <Trophy className="w-3 h-3 mr-1" />
                  <span className="hidden xs:inline">Genel</span>
                  <span className="xs:hidden">Tümü</span>
                </TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs px-2">
                  <Calendar className="w-3 h-3 mr-1" />
                  <span className="hidden xs:inline">Haftalık</span>
                  <span className="xs:hidden">Hafta</span>
                </TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs px-2">
                  <CalendarRange className="w-3 h-3 mr-1" />
                  <span className="hidden xs:inline">Aylık</span>
                  <span className="xs:hidden">Ay</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="all-time" className="space-y-4">
                <CardDescription>{getTabDescription('all-time')}</CardDescription>
                {renderLeaderboard(allTimeLeaders, false)}
              </TabsContent>
              
              <TabsContent value="weekly" className="space-y-4">
                <CardDescription>{getTabDescription('weekly')}</CardDescription>
                {renderLeaderboard(weeklyLeaders, true)}
              </TabsContent>
              
              <TabsContent value="monthly" className="space-y-4">
                <CardDescription>{getTabDescription('monthly')}</CardDescription>
                {renderLeaderboard(monthlyLeaders, true)}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Bilgi Kutusu */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Trophy className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Sıralama Sistemi</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li><strong>Genel:</strong> Tüm zamanların toplam puanı</li>
                  <li><strong>Haftalık:</strong> Son 7 gündeki performans</li>
                  <li><strong>Aylık:</strong> Bu ayki toplam puan</li>
                  <li>Oklar önceki döneme göre sıralama değişimini gösterir</li>
                  <li>Her oyun kazancınız ilgili dönemin puanına eklenir</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LeaderboardPage;