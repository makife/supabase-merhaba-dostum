import { useState, useEffect, useRef } from 'react';
import { useMusic } from '@/contexts/MusicContext';

import GameModeSelector from '@/components/GameModeSelector';
import { FloatingMenu } from '@/components/FloatingMenu';
import { HeaderAnimation } from '@/components/HeaderAnimation';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { useSounds } from '@/hooks/useSounds';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PrivateRoomModal from '@/components/PrivateRoomModal';
import MatchmakingModal from '@/components/MatchmakingModal';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Bot,
  Users,
  Trophy,
  Clock,
  Target,
  User,
  Crown,
  Zap,
  Camera,
  Volume2,
  VolumeX,
  Gift
} from 'lucide-react';

// Check if user is in their first week (gift premium period)
const isGiftPremium = (profile: any) => {
  if (!profile?.premium_until) return false;
  
  const premiumUntil = new Date(profile.premium_until);
  const createdAt = new Date(profile.created_at);
  const daysDiff = Math.ceil((premiumUntil.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  
  // If premium duration is around 7 days from creation, it's likely gift premium
  return daysDiff >= 6 && daysDiff <= 8 && premiumUntil > new Date();
};

const HomePage = () => {
  const { user } = useAuth();
  const { profile, isPremium } = useUser();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { startBackgroundMusic, musicEnabled, setMusicEnabled } = useMusic();
  const { uploadProfilePicture, uploading } = useProfilePicture();
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [matchmakingGameType, setMatchmakingGameType] = useState<'timed' | 'score'>('timed');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Level hesaplama fonksiyonu
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

  // Start background music when component mounts
  useEffect(() => {
    startBackgroundMusic();
  }, [startBackgroundMusic]);

  // Fetch user profile data including avatar
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      
      if (data?.avatar_url) {
        setUserAvatar(data.avatar_url);
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const avatarUrl = await uploadProfilePicture(file);
    if (avatarUrl) {
      setUserAvatar(avatarUrl);
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const gameModesConfig = [
    {
      id: 'vs-computer',
      title: 'Yapay Zekaya Karşı',
      description: 'AI rakibine karşı pratik yap',
      icon: Bot,
      color: 'bg-blue-500',
      gradient: 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700',
      route: '/game/vs-computer',
    },
    {
      id: 'private-room',
      title: 'Özel Oda',
      description: 'Arkadaşınla özel oda oluştur',
      icon: Users,
      color: 'bg-green-500',
      gradient: 'bg-gradient-to-br from-green-500 via-emerald-600 to-green-700',
      route: '/game/private-room',
    },
    {
      id: 'random-match',
      title: 'Rastgele Rakip',
      description: 'Rastgele oyuncu ile eşleş',
      icon: Zap,
      color: 'bg-purple-500',
      gradient: 'bg-gradient-to-br from-purple-500 via-violet-600 to-purple-700',
      route: '/game/random-match',
    },
    {
      id: 'tournament',
      title: 'Turnuva',
      description: '8 kişilik turnuvaya katıl',
      icon: Trophy,
      color: 'bg-yellow-500',
      gradient: 'bg-gradient-to-br from-yellow-500 via-orange-500 to-yellow-600',
      route: '/tournament',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Birleştirilmiş Header ve Level Progress */}
        <Card className="border-0 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 shadow-2xl relative overflow-hidden">
          <HeaderAnimation />
          
          {/* Müzik Toggle - Mobil optimized */}
          <Button
            variant="outline"
            size="sm"
            className={`absolute top-3 right-3 z-20 w-10 h-10 rounded-full backdrop-blur-md border-2 transition-all duration-300 hover:scale-105 shadow-lg ${
              musicEnabled 
                ? 'bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 border-primary/30 hover:border-primary/50' 
                : 'bg-gradient-to-r from-muted/20 to-muted/30 hover:from-muted/30 hover:to-muted/40 border-muted-foreground/20 hover:border-muted-foreground/30'
            }`}
            onClick={() => {
              setMusicEnabled(!musicEnabled);
              playSound('buttonClick');
            }}
          >
            {musicEnabled ? (
              <Volume2 className="w-5 h-5 text-primary font-bold" />
            ) : (
              <VolumeX className="w-5 h-5 text-destructive font-bold" />
            )}
          </Button>

          <CardContent className="p-4 relative z-10">
            {/* Mobil optimized layout */}
            <div className="space-y-4">
              {/* Üst satır - Avatar ve Kelimeci başlığı */}
              <div className="flex items-center space-x-3">
                {/* Hidden file input */}
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <div 
                  className="relative cursor-pointer group flex-shrink-0"
                  onClick={handleAvatarClick}
                >
                  <Avatar className="w-16 h-16 ring-3 ring-white/50 shadow-lg">
                    <AvatarImage 
                      src={userAvatar || user?.user_metadata?.avatar_url} 
                      alt="Profile"
                    />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-lg font-bold">
                      <User className="w-8 h-8" />
                    </AvatarFallback>
                  </Avatar>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold font-bungee tracking-wider uppercase bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent drop-shadow-lg"
                      style={{
                        textShadow: '1px 1px 0px hsl(var(--primary)), 2px 2px 0px rgba(0,0,0,0.3), 0 0 15px hsl(var(--primary) / 0.5)',
                        WebkitTextStroke: '0.5px hsl(var(--border))'
                      }}>
                    KELİMECİ
                  </h1>
                  <p className="text-sm font-semibold text-foreground truncate">
                    Merhaba, {user?.user_metadata?.username || user?.email?.split('@')[0]}! 👋
                  </p>
                </div>
              </div>

              {/* Alt satır - Oyun hakları */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground font-medium">
                  Bugün hangi moda başlamak istersin?
                </div>
                <div className="flex items-center space-x-2">
                  {isPremium ? (
                    <div className="flex items-center space-x-1">
                      <Crown className="w-4 h-4 text-yellow-500" />
                      <span className="text-xs text-yellow-500 font-semibold">Sınırsız</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        {[...Array(5)].map((_, index) => (
                          <div
                            key={index}
                            className={`w-3 h-2 rounded-sm border transition-all duration-300 ${
                              index < (profile?.game_credits || 0) 
                                ? 'bg-yellow-500 border-yellow-600 shadow-sm' 
                                : 'bg-muted border-border'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{profile?.game_credits || 0}/5</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobil optimized seviye progress */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                    <Trophy className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-foreground">Seviye {calculateLevel(profile?.total_score || 0).level}</h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {calculateLevel(profile?.total_score || 0).experience} / {calculateLevel(profile?.total_score || 0).nextLevelExp} EXP
                    </p>
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-primary">
                    {(profile?.total_score || 0) > 9999 
                      ? `${Math.floor((profile?.total_score || 0) / 1000)}k` 
                      : (profile?.total_score || 0).toLocaleString()
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">Puan</div>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>İlerleme</span>
                  <span>%{Math.round((calculateLevel(profile?.total_score || 0).experience / calculateLevel(profile?.total_score || 0).nextLevelExp) * 100)}</span>
                </div>
                <div className="w-full bg-black/20 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full transition-all duration-1000 ease-out shadow-lg"
                    style={{ 
                      width: `${(calculateLevel(profile?.total_score || 0).experience / calculateLevel(profile?.total_score || 0).nextLevelExp) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Mobil optimized alt kısım */}
            <div className="flex flex-col space-y-2 mt-3 pt-3 border-t border-white/20">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-white/20 text-foreground border-white/30 text-xs">
                  <Target className="w-3 h-3 mr-1" />
                  Günlük: {Math.min(5, profile?.daily_games || 0)}/5
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-foreground border-white/30 text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  Seri: {profile?.win_streak || 0}
                </Badge>
              </div>
              
              <div className="text-xs text-muted-foreground text-center">
                {profile?.last_game_at ? `Son oyun: ${new Date(profile.last_game_at).toLocaleDateString('tr-TR')}` : 'İlk oyununuzu oynayın!'}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gift Premium Banner */}
        {isPremium && isGiftPremium(profile) && (
          <Card className="border-2 border-gradient-to-r from-yellow-400 to-orange-500 bg-gradient-to-r from-yellow-50 to-orange-50 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                  <Gift className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">🎉 Hoş Geldin Hediyesi!</h3>
                  <p className="text-sm text-gray-600">
                    1 haftalık ücretsiz premium paketini kullanıyorsun! Tüm özelliklerden faydalanabilirsin.
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Son tarih: {profile?.premium_until ? new Date(profile.premium_until).toLocaleDateString('tr-TR') : ''}
                  </p>
                </div>
                <Crown className="w-6 h-6 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Game Modes */}
        <div>
          <div className="bg-gradient-to-r from-yellow-400 to-white rounded-lg px-4 py-2 mb-4 inline-flex items-center shadow-md">
            <Target className="w-5 h-5 mr-2 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-700 font-painter">Oyun Modları</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {gameModesConfig.map((mode) => (
              <Card key={mode.id} className={`hover:shadow-xl transition-all duration-300 cursor-pointer border-0 overflow-hidden ${mode.gradient} hover:scale-105`}>
                <CardHeader className="pb-2 pt-3 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/30">
                        <mode.icon className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-base text-white drop-shadow-lg">{mode.title}</CardTitle>
                        <CardDescription className="text-white/80 font-medium text-sm">{mode.description}</CardDescription>
                      </div>
                    </div>
                    {mode.id === 'vs-computer' && (
                      <img 
                        src="/lovable-uploads/8008dff7-7ead-48e2-b47e-fde31770af08.png" 
                        alt="Computer player"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-60"
                      />
                    )}
                    {mode.id === 'private-room' && (
                      <img 
                        src="/lovable-uploads/e5d22948-34db-460d-adff-dc6284efcf50.png" 
                        alt="Private room"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-60"
                      />
                    )}
                    {mode.id === 'random-match' && (
                      <img 
                        src="/lovable-uploads/a91ec87e-aaac-47fa-93fa-22e1f0270999.png" 
                        alt="Random match"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-60"
                      />
                    )}
                    {mode.id === 'tournament' && (
                      <img 
                        src="/lovable-uploads/70bff2fc-4ab0-4705-b1f1-d3cf41bbc7b5.png" 
                        alt="Tournament"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-48 h-36 object-contain opacity-60"
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30">
                      <Clock className="w-3 h-3 mr-1" />
                      2 Dakika
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30">
                      <Target className="w-3 h-3 mr-1" />
                      500 Puan
                    </Badge>
                  </div>
                  <Button 
                    className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 hover:border-white/50 backdrop-blur-sm font-semibold" 
                    variant="outline"
                    onClick={() => {
                      playSound('buttonClick');
                      setSelectedMode(mode.id);
                    }}
                  >
                    Oyuna Başla
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Game Mode Selector Modal */}
        {selectedMode && selectedMode === 'private-room' ? (
          <PrivateRoomModal
            onClose={() => setSelectedMode(null)}
            onRoomCreated={(roomCode, gameType) => {
              setSelectedMode(null);
              navigate('/game/private-room', { 
                state: { 
                  gameType: gameType,
                  roomCode: roomCode
                } 
              });
            }}
            onRoomJoined={() => {
              setSelectedMode(null);
              navigate('/game/private-room', { 
                state: { 
                  gameType: 'timed'
                } 
              });
            }}
          />
        ) : selectedMode === 'random-match' ? (
          <GameModeSelector
            mode={selectedMode}
            onStart={(gameType) => {
              playSound('buttonClick');
              setSelectedMode(null);
              setMatchmakingGameType(gameType);
              setShowMatchmaking(true);
            }}
            onClose={() => {
              playSound('buttonClick');
              setSelectedMode(null);
            }}
          />
        ) : selectedMode === 'tournament' ? (
          <GameModeSelector
            mode={selectedMode}
            onStart={(gameType) => {
              playSound('buttonClick');
              navigate('/tournament', { state: { gameType } });
              setSelectedMode(null);
            }}
            onClose={() => {
              playSound('buttonClick');
              setSelectedMode(null);
            }}
          />
        ) : selectedMode ? (
          <GameModeSelector
            mode={selectedMode}
            onStart={(gameType) => {
              playSound('buttonClick');
              const mode = gameModesConfig.find(m => m.id === selectedMode);
              if (mode) {
                navigate(`${mode.route}?type=${gameType}`);
              }
              setSelectedMode(null);
            }}
            onClose={() => {
              playSound('buttonClick');
              setSelectedMode(null);
            }}
          />
        ) : null}

        {/* Matchmaking Modal for Random Match */}
        {showMatchmaking && (
          <MatchmakingModal
            onClose={() => setShowMatchmaking(false)}
            onMatchFound={(isAI) => {
              setShowMatchmaking(false);
              if (isAI) {
                navigate(`/game/vs-computer?type=${matchmakingGameType}`);
              } else {
                navigate(`/game/random-match?type=${matchmakingGameType}`);
              }
            }}
            gameType={matchmakingGameType}
          />
        )}

        {/* Floating Menu */}
        <FloatingMenu />
      </div>
    </div>
  );
};

export default HomePage;