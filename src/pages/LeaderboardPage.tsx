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
  Zap,
  Star,
  TrendingUp
} from 'lucide-react';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  daily_score: number;
  games_played: number;
  best_word: string | null;
  best_word_score: number;
  rank: number;
}

const LeaderboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [allTimeLeaders, setAllTimeLeaders] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userStats, setUserStats] = useState<LeaderboardEntry | null>(null);
  const [loading, setLoading] = useState(true);

  // Tüm zamanların liderlerini getir
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
        daily_score: entry.total_score,
        games_played: 0,
        best_word: null,
        best_word_score: 0,
        rank: index + 1
      })) || [];

      setAllTimeLeaders(allTimeData);

      // Kullanıcının kendi durumunu bul
      if (user && allTimeData) {
        const userEntry = allTimeData.find((entry: LeaderboardEntry) => entry.user_id === user.id);
        if (userEntry) {
          setUserRank(userEntry.rank);
          setUserStats(userEntry);
        } else {
          setUserRank(null);
          setUserStats(null);
        }
      }
    } catch (error) {
      console.error('Error fetching all-time leaders:', error);
      toast({
        title: 'Hata',
        description: 'Liderlik tablosu yüklenirken hata oluştu',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchAllTimeLeaders();
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

  const renderLeaderboard = (leaders: LeaderboardEntry[]) => (
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
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {getRankIcon(leader.rank)}
                  </div>
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={leader.avatar_url || undefined} alt={leader.username} />
                    <AvatarFallback>
                      {leader.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className={`font-semibold truncate flex-1 ${leader.rank <= 3 ? 'text-white' : 'text-foreground'}`}>
                        {leader.username}
                      </h3>
                      {leader.user_id === user?.id && (
                        <Badge className="text-xs px-2 py-0 h-5 bg-white/20 text-white border-white/50 flex-shrink-0">
                          Sen
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-3 text-sm">
                      <span className={`flex items-center ${leader.rank <= 3 ? 'text-white/80' : 'text-muted-foreground'}`}>
                        <Target className="w-3 h-3 mr-1" />
                        {leader.daily_score} puan
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <h1 className="text-2xl font-bold flex items-center">
            <Trophy className="w-6 h-6 mr-2 text-yellow-500" />
            Liderlik
          </h1>
          <div className="w-16" />
        </div>

        {/* Kullanıcının kendi durumu */}
        {userStats && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Senin Performansın
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">{userRank || '—'}</div>
                  <div className="text-sm text-muted-foreground">Sıralama</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">{userStats.daily_score}</div>
                  <div className="text-sm text-muted-foreground">Toplam Puan</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">0</div>
                  <div className="text-sm text-muted-foreground">Oyun Sayısı</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-primary">—</div>
                  <div className="text-sm text-muted-foreground">En İyi Kelime</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Liderlik Tabloları */}
        <Card>
          <CardHeader>
            <CardTitle>Tüm Zamanların En İyileri</CardTitle>
            <CardDescription>
              Toplam puan sıralaması
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderLeaderboard(allTimeLeaders)}
          </CardContent>
        </Card>

        {/* Bilgi Kutusu */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <Trophy className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Nasıl Çalışır?</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700">
                  <li>Her oyun sonunda puanın toplam puanına eklenir</li>
                  <li>Liderlik tablosu toplam puanlara göre sıralanır</li>
                  <li>Seviye sistemi toplam puanınıza bağlıdır</li>
                  <li>Daha yüksek seviyelerde daha fazla puan kazanırsınız</li>
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