import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { UserAvatar } from '@/components/UserAvatar';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Trophy,
  Target,
  Clock,
  Zap,
  Crown,
  Edit,
  Calendar,
  Star,
  TrendingUp,
  FileText
} from 'lucide-react';

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [profileData, setProfileData] = useState({
    username: user?.email?.split('@')[0] || 'Oyuncu',
    avatar_url: '',
    totalGames: 0,
    wins: 0,
    losses: 0,
    totalScore: 0,
    winRate: 0,
    longestWord: '',
    currentStreak: 0,
    level: 1,
    experience: 0,
    nextLevelExp: 1000,
    averageScore: 0,        // Ortalama puan
    totalWords: 0,          // Toplam kelime
    premiumUntil: null as string | null,
  });

  const [badges, setBadges] = useState<Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    earned: boolean;
    earned_at?: string;
  }>>([]);

  // Calculate level from total score (same as LevelProgress component)
  const calculateLevel = (totalScore: number) => {
    const baseExp = 1000;
    const expIncreasePerLevel = 100; // Her seviyede +100 EXP daha fazla gerekecek
    
    let level = 1;
    let totalExpNeeded = 0;
    let currentLevelExp = baseExp;

    while (totalScore >= totalExpNeeded + currentLevelExp) {
      totalExpNeeded += currentLevelExp;
      level++;
      currentLevelExp = baseExp + (level - 1) * expIncreasePerLevel;
    }

    const experience = totalScore - totalExpNeeded;
    const nextLevelExp = currentLevelExp;

    return { level, experience, nextLevelExp };
  };

  // Fetch badges from database
  const fetchBadges = async () => {
    if (!user) return;
  
    try {
      // Get all badges with user's earned status
      const { data: allBadges, error: badgesError } = await supabase
        .from('badges')
        .select('*')
        .order('name');
        
      if (badgesError) {
        console.error('Rozet fetch hatası:', badgesError);
        return;
      }
    
      // Get user's earned badges
      const { data: userBadges, error: userBadgesError } = await supabase
        .from('user_badges')
        .select('badge_id, earned_at')
        .eq('user_id', user.id);
        
      if (userBadgesError) {
        console.error('Kullanıcı rozet fetch hatası:', userBadgesError);
        return;
      }
    
      // Combine badges with earned status
      const earnedBadgeIds = new Set(userBadges?.map(ub => ub.badge_id) || []);
      const badgesWithStatus = allBadges?.map(badge => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        earned: earnedBadgeIds.has(badge.id),
        earned_at: userBadges?.find(ub => ub.badge_id === badge.id)?.earned_at
      })) || [];
    
      setBadges(badgesWithStatus);
    } catch (error) {
      console.error('Rozet yükleme hatası:', error);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('*')  // Sadece yıldız, başka bir şey belirtme
        .eq('id', user.id)
        .maybeSingle();
      
      if (data) {
        const levelData = calculateLevel(data.total_score || 0);
        const username = data.username || (user?.email?.split('@')[0] || 'Oyuncu');
            
        setProfileData(prev => ({
          ...prev,
          username: username,
          avatar_url: data.avatar_url || '',
          totalGames: data.total_games || 0,
          wins: data.wins || 0,
          losses: data.losses || 0,
          totalScore: data.total_score || 0,
          winRate: data.total_games > 0 ? Math.round(((data.wins || 0) / data.total_games) * 100) : 0,
          longestWord: data.longest_word || '',
          currentStreak: data.win_streak || 0,
          fastestWord: data.fastest_word_time ? `${data.fastest_word_time}s` : '0s',
          level: levelData.level,
          experience: levelData.experience,
          nextLevelExp: levelData.nextLevelExp,
          premiumUntil: data.premium_until,
          dailyGames: data.daily_games || 0,
          dailyWins: data.daily_wins || 0,
          bestStreak: data.best_streak || data.win_streak || 0,
          averageScore: data.average_score || 0,
          totalWords: data.total_words || data.total_words_created || 0,
          favoriteLetter: data.favorite_letter || '',
          playTime: data.total_play_time || 0
        }));
      }
    };

    fetchProfile();
  }, [user]);

  // Listen for real-time updates to total_score
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('📊 Profile updated:', payload.new);
          const newData = payload.new;
        
          if (newData.total_score !== undefined) {
            const levelData = calculateLevel(newData.total_score);
            setProfileData(prev => {
              // Level kontrolünü ekle
              if (levelData.level > prev.level) {
                toast.success(`🎉 Seviye ${levelData.level}'e ulaştınız!`, {
                  duration: 5000,
                });
              }

              // Return ekle
              return {
                ...prev,
                totalScore: newData.total_score,
                totalGames: newData.total_games || prev.totalGames,
                wins: newData.wins || prev.wins,
                losses: newData.losses || prev.losses,
                longestWord: newData.longest_word || prev.longestWord,
                currentStreak: newData.win_streak || prev.currentStreak,
                winRate: newData.total_games > 0 ? Math.round(((newData.wins || 0) / newData.total_games) * 100) : 0,
                level: levelData.level,
                experience: levelData.experience,
                nextLevelExp: levelData.nextLevelExp,
                dailyGames: newData.daily_games || prev.dailyGames,
                dailyWins: newData.daily_wins || prev.dailyWins,
                bestStreak: newData.best_streak || newData.win_streak || prev.bestStreak,
                averageScore: newData.average_score || prev.averageScore,
                totalWords: newData.total_words || newData.total_words_created || prev.totalWords,
                favoriteLetter: newData.favorite_letter || prev.favoriteLetter,
                playTime: newData.total_play_time || prev.playTime,
              };
            });
          }
        }
      )
      // 🏆 YENİ: Rozet güncellemeleri için listener ekle
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_badges',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🏆 New badge earned:', payload.new);
        
          // Yeni rozet bilgisini al
          const { data: badgeData } = await supabase
            .from('badges')
            .select('name, icon')
            .eq('id', payload.new.badge_id)
            .single();
        
          if (badgeData) {
            toast.success(`🏆 Yeni Rozet: ${badgeData.name} ${badgeData.icon}`, {
              duration: 5000,
            });
          }
        
          // Rozet listesini yeniden yükle
          fetchBadges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Rozet useEffect'ini güncelle:
  useEffect(() => {
    fetchBadges();
  }, [user]);

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedUsername(profileData.username);
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: editedUsername })
        .eq('id', user.id);

      if (error) throw error;

      setProfileData(prev => ({ ...prev, username: editedUsername }));
      setIsEditing(false);
      toast.success('Profil başarıyla güncellendi');
    } catch (error: any) {
      console.error('Profile update error:', error);
      toast.error('Profil güncellenirken hata oluştu');
    }
  };

  // Helper function to get subscription info
  const getSubscriptionInfo = () => {
    if (!profileData.premiumUntil) return null;
    
    const premiumDate = new Date(profileData.premiumUntil);
    const now = new Date();
    
    if (premiumDate <= now) return null;
    
    const diffTime = premiumDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Determine subscription type based on remaining days
    const isYearly = diffDays > 40; // If more than 40 days, likely yearly
    const subscriptionType = isYearly ? 'Yıllık' : 'Aylık';
    
    let timeLeft = '';
    if (diffDays > 365) {
      const years = Math.floor(diffDays / 365);
      const remainingDays = diffDays % 365;
      timeLeft = `${years} yıl ${remainingDays} gün`;
    } else if (diffDays > 30) {
      const months = Math.floor(diffDays / 30);
      const remainingDays = diffDays % 30;
      timeLeft = `${months} ay ${remainingDays} gün`;
    } else {
      timeLeft = `${diffDays} gün`;
    }
    
    return { subscriptionType, timeLeft, diffDays };
  };

  const subscriptionInfo = getSubscriptionInfo();

  // 🎯 Manuel refresh butonu ekle (test için):
  const refreshStats = async () => {
    if (!user) return;
  
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    
      if (data) {
        const levelData = calculateLevel(data.total_score || 0);
        const username = data.username || (user?.email?.split('@')[0] || 'Oyuncu');
      
        setProfileData(prev => ({
          ...prev,
          username: username,
          avatar_url: data.avatar_url || '',
          totalGames: data.total_games || 0,
          wins: data.wins || 0,
          losses: data.losses || 0,
          totalScore: data.total_score || 0,
          winRate: data.total_games > 0 ? Math.round(((data.wins || 0) / data.total_games) * 100) : 0,
          longestWord: data.longest_word || '',
          currentStreak: data.win_streak || 0,
          fastestWord: data.fastest_word_time ? `${data.fastest_word_time}s` : '0s',
          level: levelData.level,
          experience: levelData.experience,
          nextLevelExp: levelData.nextLevelExp,
          premiumUntil: data.premium_until,
          dailyGames: data.daily_games || 0,
          dailyWins: data.daily_wins || 0,
          bestStreak: data.best_streak || data.win_streak || 0,
          averageScore: data.average_score || 0,
          totalWords: data.total_words || data.total_words_created || 0,
          favoriteLetter: data.favorite_letter || '',
          playTime: data.total_play_time || 0,
        }));
      }
    
      await fetchBadges();
      toast.success('İstatistikler güncellendi!');
    } catch (error) {
      toast.error('Güncelleme hatası');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Geri
          </Button>
          <h1 className="text-2xl font-bold">Profil</h1>
          <div className="flex space-x-2">
            {/* 🔄 YENİ: Refresh butonu */}
            <Button variant="outline" size="sm" onClick={refreshStats}>
              <TrendingUp className="w-4 h-4 mr-2" />
              Yenile
            </Button>
            {isEditing ? (
              <Button variant="outline" size="sm" onClick={handleSaveProfile}>
                Kaydet
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleEditToggle}>
                <Edit className="w-4 h-4 mr-2" />
                Düzenle
              </Button>
            )}
          </div>
        </div>

        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <UserAvatar
                src={profileData.avatar_url}
                alt={profileData.username}
                fallback={profileData.username.charAt(0).toUpperCase()}
                size="xl"
                editable={true}
                onAvatarChange={(newUrl) => setProfileData(prev => ({ ...prev, avatar_url: newUrl || '' }))}
              />
              <div className="flex-1">
                {isEditing ? (
                  <Input
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value)}
                    className="text-2xl font-bold mb-2"
                    placeholder="Kullanıcı adınız"
                  />
                ) : (
                  <h2 className="text-2xl font-bold">{profileData.username}</h2>
                )}
                <p className="text-xs text-muted-foreground truncate max-w-xs">{user?.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant="secondary">Seviye {profileData.level}</Badge>
                  <Badge variant="outline">{profileData.winRate}% Kazanma</Badge>
                  {subscriptionInfo && (
                    <Badge variant="default" className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                      <Crown className="w-3 h-3 mr-1" />
                      Premium
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Level Progress */}
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Seviye İlerlemesi</span>
                <span>{profileData.experience}/{profileData.nextLevelExp} EXP</span>
              </div>
              <Progress value={(profileData.experience / profileData.nextLevelExp) * 100} />
            </div>
          </CardContent>
        </Card>

        {/* Premium Subscription Info */}
        {subscriptionInfo && (
          <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center text-yellow-700">
                <Crown className="w-5 h-5 mr-2" />
                Premium Abonelik
              </CardTitle>
              <CardDescription>
                Aktif premium üyeliğinizin detayları
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="bg-yellow-100 p-2 rounded-lg">
                    <Calendar className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-yellow-800">Abonelik Türü</p>
                    <p className="text-sm text-yellow-600">{subscriptionInfo.subscriptionType} Premium</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-orange-800">Kalan Süre</p>
                    <p className="text-sm text-orange-600">{subscriptionInfo.timeLeft}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-yellow-700">Yenilenme süresine kalan gün</span>
                  <span className="font-medium text-yellow-800">{subscriptionInfo.diffDays} gün</span>
                </div>
                <Progress 
                  value={Math.max(0, Math.min(100, (30 - subscriptionInfo.diffDays) / 30 * 100))} 
                  className="bg-yellow-100"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">{profileData.totalGames}</p>
              <p className="text-sm text-muted-foreground">Toplam Oyun</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{profileData.wins}</p>
              <p className="text-sm text-muted-foreground">Kazanma</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <p className="text-2xl font-bold">{profileData.fastestWord}</p>
              <p className="text-sm text-muted-foreground">En Hızlı</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Zap className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">{profileData.currentStreak}</p>
              <p className="text-sm text-muted-foreground">Seri</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-indigo-500" />
              <p className="text-2xl font-bold">{profileData.dailyGames}</p>
              <p className="text-sm text-muted-foreground">Günlük</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Star className="w-8 h-8 mx-auto mb-2 text-pink-500" />
              <p className="text-2xl font-bold">{profileData.bestStreak}</p>
              <p className="text-sm text-muted-foreground">En İyi Seri</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-cyan-500" />
              <p className="text-2xl font-bold">{Math.round(profileData.averageScore)}</p>
              <p className="text-sm text-muted-foreground">Ort. Puan</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
              <p className="text-2xl font-bold">{profileData.totalWords}</p>
              <p className="text-sm text-muted-foreground">Toplam Kelime</p>
            </CardContent>
          </Card>
        </div>

        {/* Achievements / Badges */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Crown className="w-5 h-5 mr-2" />
              Rozetler
            </CardTitle>
            <CardDescription>
              Oyun içi başarılarınız ve rozetleriniz
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {badges.map((badge) => (
                <div 
                  key={badge.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border ${
                    badge.earned 
                      ? 'bg-accent/50 border-accent' 
                      : 'bg-muted/30 border-muted opacity-50'
                  }`}
                >
                  <div className="text-2xl">{badge.icon}</div>
                  <div className="flex-1">
                    <p className="font-medium">{badge.name}</p>
                    <p className="text-sm text-muted-foreground">{badge.description}</p>
                    {badge.earned && badge.earned_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(badge.earned_at).toLocaleDateString('tr-TR')} tarihinde kazanıldı
                      </p>
                    )}
                  </div>
                  {badge.earned && (
                    <Badge variant="secondary" className="text-xs">
                      Kazanıldı
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Detaylı İstatistikler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Toplam Puan:</span>
              <span className="font-bold">{profileData.totalScore.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>En Uzun Kelime:</span>
              <span className="font-bold">{profileData.longestWord}</span>
            </div>
            <div className="flex justify-between">
              <span>Kaybetme:</span>
              <span className="font-bold">{profileData.losses}</span>
            </div>
            <div className="flex justify-between">
              <span>Kazanma Oranı:</span>
              <span className="font-bold">{profileData.winRate}%</span>
            </div>
            <div className="flex justify-between">
              <span>Günlük Kazanma:</span>
              <span className="font-bold">{profileData.dailyWins}</span>
            </div>
            <div className="flex justify-between">
              <span>En İyi Seri:</span>
              <span className="font-bold">{profileData.bestStreak}</span>
            </div>
            <div className="flex justify-between">
              <span>Ortalama Puan:</span>
              <span className="font-bold">{Math.round(profileData.averageScore)}</span>
            </div>
            <div className="flex justify-between">
              <span>Toplam Kelime:</span>
              <span className="font-bold">{profileData.totalWords}</span>
            </div>
            <div className="flex justify-between">
              <span>Favori Harf:</span>
              <span className="font-bold">{profileData.favoriteLetter || 'Henüz yok'}</span>
            </div>
            <div className="flex justify-between">
              <span>Oyun Süresi:</span>
              <span className="font-bold">{Math.round(profileData.playTime / 60)} dakika</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;