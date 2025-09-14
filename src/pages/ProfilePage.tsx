import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/UserAvatar';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { useJokerInventory } from '@/hooks/useJokerInventory';
import {
  ArrowLeft,
  Trophy,
  Target,
  Zap,
  Crown,
  Edit,
  TrendingUp,
  Calendar,
  Clock,
  Award,
  Users,
  User
} from 'lucide-react';

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { jokers } = useJokerInventory();
  const { id: routeId } = useParams();
  const viewedUserId = routeId || user?.id || null;
  const isOwnProfile = !routeId || routeId === user?.id;
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
    longestWordLength: 0,
    currentStreak: 0,
    level: 1,
    experience: 0,
    nextLevelExp: 1000,
    averageScore: 0,
    premiumUntil: null as string | null,
    // Yeni turnuva istatistikleri
    tournamentsWon: 0,
    tournamentsLost: 0,
    tournamentsPlayed: 0,
    tournamentWinRate: 0,
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
    const expIncreasePerLevel = 100;
    
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

  const fetchBadges = async () => {
    if (!user || !isOwnProfile) return;
  
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

  const fetchTournamentStats = async () => {
    if (!viewedUserId) return { won: 0, lost: 0, played: 0, winRate: 0 };

    try {
      const { data: tournamentMatches, error } = await supabase
        .from('tournament_matches')
        .select('winner_id, player1_id, player2_id, status')
        .or(`player1_id.eq.${viewedUserId},player2_id.eq.${viewedUserId}`)
        .eq('status', 'completed');

      if (error) {
        console.error('Turnuva istatistikleri hatası:', error);
        return { won: 0, lost: 0, played: 0, winRate: 0 };
      }

      if (!tournamentMatches || tournamentMatches.length === 0) {
        return { won: 0, lost: 0, played: 0, winRate: 0 };
      }

      let won = 0;
      let lost = 0;

      tournamentMatches.forEach(match => {
        if (match.winner_id === viewedUserId) {
          won++;
        } else {
          lost++;
        }
      });

      const played = won + lost;
      const winRate = played > 0 ? Math.round((won / played) * 100) : 0;

      return { won, lost, played, winRate };
    } catch (error) {
      console.error('Turnuva istatistikleri fetch hatası:', error);
      return { won: 0, lost: 0, played: 0, winRate: 0 };
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!viewedUserId) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', viewedUserId)
        .maybeSingle();
      
      // Turnuva istatistiklerini al
      const tournamentStats = await fetchTournamentStats();
      
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
          longestWordLength: data.longest_word_length || 0,
          currentStreak: data.win_streak || 0,
          level: levelData.level,
          experience: levelData.experience,
          nextLevelExp: levelData.nextLevelExp,
          premiumUntil: data.premium_until,
          averageScore: data.average_score || 0,
          // Turnuva istatistikleri
          tournamentsWon: tournamentStats.won,
          tournamentsLost: tournamentStats.lost,
          tournamentsPlayed: tournamentStats.played,
          tournamentWinRate: tournamentStats.winRate,
        }));
      }
    };

    fetchProfile();
  }, [viewedUserId]);

  // Listen for real-time updates only for own profile
  useEffect(() => {
    if (!user || !isOwnProfile) return;

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
              if (levelData.level > prev.level) {
                toast.success(`🎉 Seviye ${levelData.level}'e ulaştınız!`, {
                  duration: 5000,
                });
              }

              return {
                ...prev,
                totalScore: newData.total_score,
                totalGames: newData.total_games || prev.totalGames,
                wins: newData.wins || prev.wins,
                losses: newData.losses || prev.losses,
                longestWord: newData.longest_word || prev.longestWord,
                longestWordLength: newData.longest_word_length || prev.longestWordLength,
                currentStreak: newData.win_streak || prev.currentStreak,
                winRate: newData.total_games > 0 ? Math.round(((newData.wins || 0) / newData.total_games) * 100) : 0,
                level: levelData.level,
                experience: levelData.experience,
                nextLevelExp: levelData.nextLevelExp,
                averageScore: newData.average_score || prev.averageScore,
              };
            });
          }

          // Profilde bir güncelleme olduğunda rozetleri de tazele
          fetchBadges();
        }
      )
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
        
          fetchBadges();
        }
      )
      // Turnuva maçları değişikliklerini dinle
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_matches',
          filter: `player1_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🏆 Tournament match updated (as player1):', payload.new);
          if (payload.new.status === 'completed') {
            const tournamentStats = await fetchTournamentStats();
            setProfileData(prev => ({
              ...prev,
              tournamentsWon: tournamentStats.won,
              tournamentsLost: tournamentStats.lost,
              tournamentsPlayed: tournamentStats.played,
              tournamentWinRate: tournamentStats.winRate,
            }));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_matches',
          filter: `player2_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('🏆 Tournament match updated (as player2):', payload.new);
          if (payload.new.status === 'completed') {
            const tournamentStats = await fetchTournamentStats();
            setProfileData(prev => ({
              ...prev,
              tournamentsWon: tournamentStats.won,
              tournamentsLost: tournamentStats.lost,
              tournamentsPlayed: tournamentStats.played,
              tournamentWinRate: tournamentStats.winRate,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isOwnProfile]);

  useEffect(() => {
    if (isOwnProfile) {
      fetchBadges();
    }
  }, [viewedUserId, isOwnProfile]);

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedUsername(profileData.username);
    }
    setIsEditing(!isEditing);
  };

  const handleSaveProfile = async () => {
    if (!user || !isOwnProfile) return;

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
    
    const isYearly = diffDays > 40;
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

  // checkBadges fonksiyonunu ekle
  const checkBadges = async (userId: string) => {
    try {
      console.log('Rozet kontrolu yapiliyor:', userId);

      const { data: badges, error } = await supabase.rpc('check_and_award_badges', {
        p_user_id: userId
      });

      if (error) {
        console.error('Rozet kontrolu hatasi:', error);
      } else if (badges && Array.isArray(badges) && badges.length > 0) {
        badges.forEach((badge: any) => {
          toast.success(`Yeni Rozet: ${badge.new_badge_name} ${badge.new_badge_icon}`, {
            duration: 4000,
          });
        });
      }

      console.log('Rozet kontrolu tamamlandi');
    } catch (error) {
      console.error('Rozet kontrolu hatasi:', error);
    }
  };

  const refreshStats = async () => {
    if (!viewedUserId) return;
  
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', viewedUserId)
        .single();
    
      const tournamentStats = await fetchTournamentStats();
    
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
          longestWordLength: data.longest_word_length || 0,
          currentStreak: data.win_streak || 0,
          level: levelData.level,
          experience: levelData.experience,
          nextLevelExp: levelData.nextLevelExp,
          premiumUntil: data.premium_until,
          averageScore: data.average_score || 0,
          tournamentsWon: tournamentStats.won,
          tournamentsLost: tournamentStats.lost,
          tournamentsPlayed: tournamentStats.played,
          tournamentWinRate: tournamentStats.winRate,
        }));
      }
    
      await fetchBadges();
      toast.success('İstatistikler güncellendi!');
    } catch (error) {
      toast.error('Güncelleme hatası');
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-background to-muted flex flex-col">
      <div className="max-w-2xl mx-auto w-full flex flex-col h-full">
        {/* Fixed Header */}
        <div className="p-4 bg-blue-50/95 backdrop-blur-sm border-b border-blue-200 sticky top-0 z-10">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="sm" onClick={() => {
              const fromPage = location.state?.from;
              if (fromPage === '/chat') {
                navigate('/chat');
              } else {
                navigate('/');
              }
            }} className="text-blue-600 border-blue-500/30 hover:bg-blue-500/20 bg-blue-500/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Geri
            </Button>
            <h1 className="text-2xl font-bold flex items-center text-blue-600">
              <User className="w-5 h-5 mr-2 text-blue-500" />
              {isOwnProfile ? 'Profil' : `${profileData.username} Profili`}
            </h1>
            <div className="w-16 flex justify-end">
              {isOwnProfile && (
                isEditing ? (
                  <Button variant="outline" size="sm" onClick={handleSaveProfile}>
                    Kaydet
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleEditToggle}>
                    <Edit className="w-4 h-4 mr-2" />
                    Düzenle
                  </Button>
                )
              )}
            </div>
          </div>

          {/* Profile Header in Fixed Area */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <UserAvatar
                  src={profileData.avatar_url}
                  alt={profileData.username}
                  fallback={profileData.username.charAt(0).toUpperCase()}
                  size="xl"
                  editable={isOwnProfile}
                  className="ring-2 ring-primary/20"
                />
                <div className="flex-1">
                  {isEditing && isOwnProfile ? (
                    <Input
                      value={editedUsername}
                      onChange={(e) => setEditedUsername(e.target.value)}
                      className="text-2xl font-bold mb-2"
                      placeholder="Kullanıcı adınız"
                    />
                  ) : (
                    <h2 className="text-2xl font-bold">{profileData.username}</h2>
                  )}
                  {!isOwnProfile && (
                    <p className="text-sm text-muted-foreground">Oyuncu Profili</p>
                  )}
                  {isOwnProfile && user?.email && (
                    <p className="text-xs text-muted-foreground truncate max-w-xs">{user.email}</p>
                  )}
                  <div className="flex items-center space-x-2 mt-2 flex-wrap gap-1">
                    <Badge variant="secondary">Seviye {profileData.level}</Badge>
                    <Badge variant="outline">{profileData.winRate}% Kazanma</Badge>
                    {profileData.tournamentWinRate > 0 && (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                        <Trophy className="w-3 h-3 mr-1" />
                        {profileData.tournamentWinRate}% Turnuva
                      </Badge>
                    )}
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
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-6 pb-6">

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
              <Zap className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">{profileData.currentStreak}</p>
              <p className="text-sm text-muted-foreground">Seri</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-cyan-500" />
              <p className="text-2xl font-bold">{Math.round(profileData.averageScore)}</p>
              <p className="text-sm text-muted-foreground">Ort. Puan</p>
            </CardContent>
          </Card>
        </div>

        {/* Tournament Statistics */}
        {profileData.tournamentsPlayed > 0 && (
          <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center text-yellow-700">
                <Trophy className="w-5 h-5 mr-2" />
                Turnuva İstatistikleri
              </CardTitle>
              <CardDescription>
                Turnuva performansınız
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Users className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="text-xl font-bold text-amber-800">{profileData.tournamentsPlayed}</p>
                  <p className="text-sm text-amber-600">Katılım</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Award className="w-6 h-6 text-green-600" />
                  </div>
                  <p className="text-xl font-bold text-green-800">{profileData.tournamentsWon}</p>
                  <p className="text-sm text-green-600">Kazanma</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Target className="w-6 h-6 text-red-500" />
                  </div>
                  <p className="text-xl font-bold text-red-700">{profileData.tournamentsLost}</p>
                  <p className="text-sm text-red-500">Kaybetme</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <p className="text-xl font-bold text-purple-800">{profileData.tournamentWinRate}%</p>
                  <p className="text-sm text-purple-600">Başarı</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Joker Envanteri */}
        {(jokers.degistir > 0 || jokers.fisilida > 0 || jokers.senYaz > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>🃏 Joker Envanteri</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <div className="text-2xl mb-2">🔄</div>
                  <div className="text-sm text-muted-foreground">Değiştir</div>
                  <div className="text-lg font-bold">{jokers.degistir}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                  <div className="text-2xl mb-2">💬</div>
                  <div className="text-sm text-muted-foreground">Fısılda</div>
                  <div className="text-lg font-bold">{jokers.fisilida}</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <div className="text-2xl mb-2">✍️</div>
                  <div className="text-sm text-muted-foreground">Sen Yaz</div>
                  <div className="text-lg font-bold">{jokers.senYaz}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
              <span className="font-bold">
                {profileData.longestWord ? 
                  `${profileData.longestWord} (${profileData.longestWordLength} harf)` : 
                  profileData.longestWordLength > 0 ? 
                    `${profileData.longestWordLength} harfli kelime` : 
                    'Henüz yok'
                }
              </span>
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
              <span>Ortalama Puan:</span>
              <span className="font-bold">{Math.round(profileData.averageScore)}</span>
            </div>
            {profileData.tournamentsPlayed > 0 && (
              <>
                <hr className="my-4" />
                <div className="text-sm font-semibold text-muted-foreground mb-2">Turnuva Performansı</div>
                <div className="flex justify-between">
                  <span>Kazanılan Turnuva:</span>
                  <span className="font-bold text-green-600">{profileData.tournamentsWon}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kaybedilen Turnuva:</span>
                  <span className="font-bold text-red-600">{profileData.tournamentsLost}</span>
                </div>
                <div className="flex justify-between">
                  <span>Toplam Turnuva:</span>
                  <span className="font-bold">{profileData.tournamentsPlayed}</span>
                </div>
                <div className="flex justify-between">
                  <span>Turnuva Başarı Oranı:</span>
                  <span className="font-bold text-yellow-600">{profileData.tournamentWinRate}%</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ProfilePage;