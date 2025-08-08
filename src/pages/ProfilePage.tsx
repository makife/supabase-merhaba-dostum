import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import { useEffect, useState, useRef } from 'react';
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
  Camera,
  Edit,
  Calendar
} from 'lucide-react';

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { uploadProfilePicture, uploading } = useProfilePicture();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    fastestWord: '0s',
    longestWord: '',
    currentStreak: 0,
    level: 1,
    experience: 0,
    nextLevelExp: 1000,
    premiumUntil: null as string | null,
  });

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

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (data) {
        // Calculate level data from total_score
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
          level: levelData.level,
          experience: levelData.experience,
          nextLevelExp: levelData.nextLevelExp,
          premiumUntil: data.premium_until,
        }));
        setEditedUsername(username);
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
          if (payload.new.total_score !== undefined) {
            const levelData = calculateLevel(payload.new.total_score);
            setProfileData(prev => ({
              ...prev,
              totalScore: payload.new.total_score,
              level: levelData.level,
              experience: levelData.experience,
              nextLevelExp: levelData.nextLevelExp,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const avatarUrl = await uploadProfilePicture(file);
    if (avatarUrl) {
      setProfileData(prev => ({ ...prev, avatar_url: avatarUrl }));
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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

  const badges = [
    { name: 'İlk Adım', description: 'İlk oyununuzu tamamladınız', icon: '🎯', earned: true },
    { name: 'Hızlı Parmaklar', description: '10 saniyede kelime yazdınız', icon: '⚡', earned: true },
    { name: 'Kelime Ustası', description: '100 oyun tamamladınız', icon: '🏆', earned: false },
    { name: 'Turnuva Şampiyonu', description: 'İlk turnuvanızı kazandınız', icon: '👑', earned: false },
    { name: 'Kelime Avcısı', description: '1000 puan topladınız', icon: '🎪', earned: true },
  ];

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

        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={profileData.avatar_url} alt={profileData.username} />
                  <AvatarFallback className="text-2xl">
                    {profileData.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Button 
                  size="sm" 
                  onClick={handleAvatarClick}
                  disabled={uploading}
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0"
                >
                  <Camera className="w-4 h-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
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
                <p className="text-muted-foreground">{user?.email}</p>
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
              {badges.map((badge, index) => (
                <div 
                  key={index}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfilePage;