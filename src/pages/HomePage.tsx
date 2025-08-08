import { useState, useEffect, useRef } from 'react';
import { useMusic } from '@/contexts/MusicContext';

import GameModeSelector from '@/components/GameModeSelector';
import { LevelProgress } from '@/components/LevelProgress';
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
  Camera
} from 'lucide-react';

const HomePage = () => {
  const { user } = useAuth();
  const { profile, isPremium } = useUser();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const { startBackgroundMusic } = useMusic();
  const { uploadProfilePicture, uploading } = useProfilePicture();
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      title: 'Bilgisayara Karşı',
      description: 'AI rakibine karşı oyna',
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
        {/* Header */}
        <div className="bg-card rounded-xl p-4 md:p-6 shadow-lg border relative overflow-hidden">
          <HeaderAnimation />
          
          {/* Mobile Layout */}
          <div className="block md:hidden relative z-10">
            {/* Hidden file input */}
            <Input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div 
                  className="relative cursor-pointer group"
                  onClick={handleAvatarClick}
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage 
                      src={userAvatar || user?.user_metadata?.avatar_url} 
                      alt="Profile"
                    />
                    <AvatarFallback>
                      <User className="w-6 h-6 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                    <Camera className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div className="space-y-1 relative z-10">
                  <h1 className="text-2xl font-bold font-bungee tracking-wider uppercase bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent drop-shadow-2xl"
                      style={{
                        textShadow: '1px 1px 0px hsl(var(--primary)), 2px 2px 0px rgba(0,0,0,0.3), 0 0 15px hsl(var(--primary) / 0.5)',
                        WebkitTextStroke: '0.5px hsl(var(--border))'
                      }}>
                    KELİMECİ
                  </h1>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground">
                      Merhaba, {user?.user_metadata?.username || user?.email?.split('@')[0]}! 👋
                    </p>
                    <p className="text-xs text-muted-foreground">Oyuna hazır mısın?</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground font-medium">
                Kalan hakların
              </div>
              <div className="flex items-center space-x-2">
                {isPremium ? (
                  <div className="flex items-center space-x-2">
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs text-yellow-500 font-semibold">Sınırsız</span>
                  </div>
                ) : (
                  <>
                    <div className="flex space-x-1">
                      {[...Array(5)].map((_, index) => (
                        <div
                          key={index}
                          className={`w-3 h-2 rounded-sm border ${
                            index < (profile?.game_credits || 0) 
                              ? 'bg-yellow-500 border-yellow-600 shadow-sm' 
                              : 'bg-muted border-border'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{profile?.game_credits || 0}/5</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Layout - Hidden file input */}
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div className="hidden md:flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
              <div 
                className="relative cursor-pointer group"
                onClick={handleAvatarClick}
              >
                <Avatar className="w-16 h-16">
                  <AvatarImage 
                    src={userAvatar || user?.user_metadata?.avatar_url} 
                    alt="Profile"
                  />
                  <AvatarFallback>
                    <User className="w-8 h-8 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="space-y-1 relative z-10">
                <h1 className="text-4xl font-bold font-bungee tracking-wider uppercase bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent drop-shadow-2xl"
                    style={{
                      textShadow: '2px 2px 0px hsl(var(--primary)), 4px 4px 0px rgba(0,0,0,0.3), 0 0 20px hsl(var(--primary) / 0.5)',
                      WebkitTextStroke: '1px hsl(var(--border))'
                    }}>
                  KELİMECİ
                </h1>
                <div className="space-y-0.5">
                  <p className="text-lg font-semibold text-foreground">
                    Merhaba, {user?.user_metadata?.username || user?.email?.split('@')[0]}! 👋
                  </p>
                  <p className="text-sm text-muted-foreground">Bugün hangi moda başlamak istersin?</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground text-center">
                  Kalan hakların
                </div>
                {isPremium ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Crown className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm text-yellow-500 font-semibold">Sınırsız</span>
                  </div>
                ) : (
                  <>
                    <div className="flex space-x-1 justify-center">
                      {[...Array(5)].map((_, index) => (
                        <div
                          key={index}
                          className={`w-4 h-3 rounded-sm border ${
                            index < (profile?.game_credits || 0) 
                              ? 'bg-yellow-500 border-yellow-600 shadow-sm' 
                              : 'bg-muted border-border'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-center block text-muted-foreground">{profile?.game_credits || 0}/5</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Level Progress */}
        <LevelProgress />

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

        {/* Floating Menu */}
        <FloatingMenu />
      </div>
    </div>
  );
};

export default HomePage;
