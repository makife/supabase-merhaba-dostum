import { useState, useEffect } from 'react';

import GameModeSelector from '@/components/GameModeSelector';
import { useAuth } from '@/contexts/AuthContext';
import { useSounds } from '@/hooks/useSounds';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Users,
  Trophy,
  Clock,
  Target,
  User,
  Settings,
  ShoppingCart,
  LogOut,
  Gamepad2,
  Crown,
  Zap
} from 'lucide-react';

const HomePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const [userCredits] = useState(5);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [animatedLetters, setAnimatedLetters] = useState<Array<{id: number, letter: string, x: number, y: number, color: string, font: string, dx: number}>>([]);

  const letters = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';
  const colors = ['text-red-400', 'text-blue-400', 'text-green-400', 'text-yellow-400', 'text-purple-400', 'text-pink-400', 'text-indigo-400', 'text-orange-400'];
  const fonts = ['font-fredoka', 'font-comfortaa', 'font-righteous', 'font-bungee', 'font-orbitron'];

  useEffect(() => {
    const interval = setInterval(() => {
      const newLetter = {
        id: Date.now(),
        letter: letters[Math.floor(Math.random() * letters.length)],
        x: -10,
        y: Math.random() * 80,
        color: colors[Math.floor(Math.random() * colors.length)],
        font: fonts[Math.floor(Math.random() * fonts.length)],
        dx: 0.5 + Math.random() * 1
      };
      
      setAnimatedLetters(prev => [...prev.slice(-12), newLetter]);
    }, 400);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const moveInterval = setInterval(() => {
      setAnimatedLetters(prev => 
        prev.map(letter => ({
          ...letter,
          x: letter.x + letter.dx
        })).filter(letter => letter.x < 120)
      );
    }, 50);

    return () => clearInterval(moveInterval);
  }, []);

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

  const menuItems = [
    {
      id: 'profile',
      title: 'Profil',
      description: 'Profilini düzenle ve istatistiklerini gör',
      icon: User,
      route: '/profile',
    },
    {
      id: 'market',
      title: 'Market',
      description: 'Oyun içi satın alımlar',
      icon: ShoppingCart,
      route: '/market',
    },
    {
      id: 'settings',
      title: 'Ayarlar',
      description: 'Oyun ayarlarını düzenle',
      icon: Settings,
      route: '/settings',
    },
  ];

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-card rounded-xl p-4 md:p-6 shadow-lg border relative overflow-hidden">
          {/* Animated Letters Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {animatedLetters.map((letter) => (
              <div
                key={letter.id}
                className={`absolute text-4xl font-bold ${letter.color} ${letter.font} transition-all duration-1000 transform hover:scale-110`}
                style={{
                  left: `${letter.x}%`,
                  top: `${letter.y}%`,
                  textShadow: '0 0 10px currentColor',
                  animation: 'bounce 2s infinite',
                  opacity: letter.x > 80 ? Math.max(0, 1 - (letter.x - 80) / 20) : 0.6
                }}
              >
                {letter.letter}
              </div>
            ))}
          </div>
          
          {/* Mobile Layout */}
          <div className="block md:hidden relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold font-bungee tracking-wider uppercase bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent drop-shadow-2xl"
                      style={{
                        textShadow: '1px 1px 0px hsl(var(--primary)), 2px 2px 0px rgba(0,0,0,0.3), 0 0 15px hsl(var(--primary) / 0.5)',
                        WebkitTextStroke: '0.5px hsl(var(--border))'
                      }}>
                    KELİMECİ
                  </h1>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                playSound('buttonClick');
                handleLogout();
              }}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground font-medium text-sm">Hoş geldin, {user?.email?.split('@')[0]}!</p>
              <div className="flex items-center space-x-3">
                <Crown className="w-4 h-4 text-yellow-500" />
                <div className="flex flex-col items-end">
                  <Progress value={(userCredits / 5) * 100} className="w-16 h-2" />
                  <span className="text-xs text-muted-foreground mt-1">{userCredits}/5</span>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-4xl font-bold font-bungee tracking-wider uppercase bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent drop-shadow-2xl"
                    style={{
                      textShadow: '2px 2px 0px hsl(var(--primary)), 4px 4px 0px rgba(0,0,0,0.3), 0 0 20px hsl(var(--primary) / 0.5)',
                      WebkitTextStroke: '1px hsl(var(--border))'
                    }}>
                  KELİMECİ
                </h1>
                <p className="text-muted-foreground font-medium">Hoş geldin, {user?.email?.split('@')[0]}!</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Crown className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-medium text-muted-foreground">Hak</span>
                </div>
                <Progress value={(userCredits / 5) * 100} className="w-20 h-2" />
                <span className="text-xs text-center block w-20">{userCredits}/5</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => {
                playSound('buttonClick');
                handleLogout();
              }}>
                <LogOut className="w-4 h-4 mr-2" />
                Çıkış
              </Button>
            </div>
          </div>
        </div>

        {/* Game Modes */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Oyun Modları
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gameModesConfig.map((mode) => (
              <Card key={mode.id} className={`hover:shadow-xl transition-all duration-300 cursor-pointer border-0 overflow-hidden ${mode.gradient} hover:scale-105`}>
                <CardHeader className="pb-3 relative">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/30">
                      <mode.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white drop-shadow-lg">{mode.title}</CardTitle>
                      <CardDescription className="text-white/80 font-medium">{mode.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center space-x-2 mb-3">
                    <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30">
                      <Clock className="w-3 h-3 mr-1" />
                      2 Dakika
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-white/20 text-white border-white/30 hover:bg-white/30">
                      <Target className="w-3 h-3 mr-1" />
                      100 Puan
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

        {/* Menu Items */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Menü</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {menuItems.map((item) => (
              <Card 
                key={item.id} 
                className="hover:shadow-lg transition-all duration-200 cursor-pointer"
                onClick={() => {
                  playSound('buttonClick');
                  navigate(item.route);
                }}
              >
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-2">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription className="text-sm">{item.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
      </div>
        </div>


        {/* Game Mode Selector Modal */}
        {selectedMode && (
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
        )}
      </div>
    </div>
  );
};

export default HomePage;