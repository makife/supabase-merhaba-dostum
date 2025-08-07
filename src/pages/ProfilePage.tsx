import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Trophy,
  Target,
  Clock,
  Zap,
  Crown,
  Camera,
  Edit
} from 'lucide-react';

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Mock data - gerçek uygulamada API'den gelecek
  const profileData = {
    username: user?.email?.split('@')[0] || 'Oyuncu',
    totalGames: 45,
    wins: 28,
    losses: 17,
    totalScore: 12450,
    winRate: 62,
    fastestWord: '2.3s',
    longestWord: 'BİLGİSAYAR',
    currentStreak: 5,
    level: 12,
    experience: 2450,
    nextLevelExp: 3000,
  };

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
          <Button variant="outline" size="sm">
            <Edit className="w-4 h-4 mr-2" />
            Düzenle
          </Button>
        </div>

        {/* Profile Header */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="w-20 h-20">
                  <AvatarImage src="" alt={profileData.username} />
                  <AvatarFallback className="text-2xl">
                    {profileData.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <Button 
                  size="sm" 
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full p-0"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{profileData.username}</h2>
                <p className="text-muted-foreground">{user?.email}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge variant="secondary">Seviye {profileData.level}</Badge>
                  <Badge variant="outline">{profileData.winRate}% Kazanma</Badge>
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