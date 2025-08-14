import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useGame } from '@/contexts/GameContext';
import { useMusic } from '@/contexts/MusicContext';
import { useWordValidation } from '@/hooks/useWordValidation';
import { useSounds } from '@/hooks/useSounds';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  Clock, 
  Target, 
  Trash2, 
  Send, 
  Trophy,
  User,
  Bot
} from 'lucide-react';

interface GamePageProps {
  gameMode: 'vs-computer' | 'private-room' | 'random-match' | 'tournament';
}

const GamePage = ({ gameMode }: GamePageProps) => {
  // ⭐ TÜM HOOKS EN ÜSTTE - HİÇBİR KOŞULLU RETURN'DEN ÖNCE
  const { user } = useAuth();
  const { consumeCredit, isPremium } = useUser();
  const { hasPurchased, settings } = useUserPurchases();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentRoom, updateScore, participants, endGame } = useGame();
  const { validateWord, isValidating } = useWordValidation();
  const { playSound, playTimeWarningSequence, playCelebrationSound, playGameLoseSound } = useSounds();
  const { fadeOutBackgroundMusic, fadeInBackgroundMusic } = useMusic();
  const [searchParams] = useSearchParams();
  
  // Get game type from room or URL params
  const getGameType = useCallback((): 'timed' | 'score' => {
    if (gameMode === 'vs-computer') {
      const urlType = (searchParams.get('type') as 'timed' | 'score') || 'timed';
      return urlType;
    }
    
    if (currentRoom?.game_mode) {
      if (currentRoom.game_mode.includes('score')) return 'score';
      if (currentRoom.game_mode.includes('timed')) return 'timed';
    }
    const urlType = (searchParams.get('type') as 'timed' | 'score') || 'timed';
    return urlType;
  }, [gameMode, currentRoom?.game_mode, searchParams]);
  
  const gameType = getGameType();
  
  // ⭐ TÜM STATE'LER
  const [timeWarningPlayed, setTimeWarningPlayed] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  
  // Generate random grid function
  const generateRandomGrid = useCallback((): string[][] => {
    const letterPool = [
      'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A',
      'E', 'E', 'E', 'E', 'E', 'E', 'E',
      'İ', 'İ', 'İ', 'İ', 'İ', 'İ',
      'I', 'I', 'I', 'I', 'I',
      'O', 'O', 'O', 'O', 'O',
      'U', 'U', 'U', 'U',
      'Ü', 'Ü', 'Ü',
      'Ö', 'Ö', 'Ö',
      'L', 'L', 'L', 'L', 'L',
      'N', 'N', 'N', 'N', 'N',
      'R', 'R', 'R', 'R', 'R',
      'K', 'K', 'K', 'K',
      'M', 'M', 'M', 'M',
      'T', 'T', 'T', 'T',
      'S', 'S', 'S', 'S',
      'D', 'D', 'D',
      'Y', 'Y', 'Y',
      'B', 'B', 'B',
      'C', 'C',
      'Ç', 'Ç',
      'F', 'F',
      'G', 'G',
      'Ğ', 'Ğ',
      'H', 'H',
      'J',
      'P', 'P',
      'Ş', 'Ş',
      'V', 'V',
      'Z',
    ];
    
    const grid: string[][] = [];
    for (let i = 0; i < 4; i++) {
      const row: string[] = [];
      for (let j = 0; j < 4; j++) {
        const randomIndex = Math.floor(Math.random() * letterPool.length);
        row.push(letterPool[randomIndex]);
      }
      grid.push(row);
    }
    return grid;
  }, []);

  const [gameGrid, setGameGrid] = useState<string[][]>(() => {
    if (currentRoom?.current_grid) {
      const flatGrid = currentRoom.current_grid;
      const grid: string[][] = [];
      for (let i = 0; i < 4; i++) {
        grid.push(flatGrid.slice(i * 4, (i + 1) * 4));
      }
      return grid;
    }
    return generateRandomGrid();
  });
  
  const [selectedLetters, setSelectedLetters] = useState<{letter: string, row: number, col: number}[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [playerWords, setPlayerWords] = useState<string[]>([]);
  const [opponentWords, setOpponentWords] = useState<string[]>([]);
  const [playerWordsWithScores, setPlayerWordsWithScores] = useState<Array<{word: string, score: number}>>([]);
  const [opponentWordsWithScores, setOpponentWordsWithScores] = useState<Array<{word: string, score: number}>>([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(gameType === 'timed' ? 120 : 0);
  const [gameStarted, setGameStarted] = useState(false);
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<'player' | 'opponent' | 'tie' | null>(null);
  const [disconnectWin, setDisconnectWin] = useState(false);
  const [playerAvatar, setPlayerAvatar] = useState<string>('');
  const [opponentAvatar, setOpponentAvatar] = useState<string>('');
  const [hasShownStartMessage, setHasShownStartMessage] = useState(false);
  const [lastPlayerAction, setLastPlayerAction] = useState<number>(0);
  const [matchmakingTimeout, setMatchmakingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [timeoutCountdown, setTimeoutCountdown] = useState(30);

  // ⭐ TÜM CALLBACK'LER
  const clearWord = useCallback(() => {
    setSelectedLetters([]);
    setCurrentWord('');
  }, []);

  const submitWord = useCallback(async () => {
    if (waitingForPlayer) return;
    
    setLastPlayerAction(Date.now());
    
    if (currentWord.length < 3) {
      toast({
        title: 'Geçersiz Kelime',
        description: 'Kelime en az 3 harf olmalıdır.',
        variant: 'destructive',
        duration: 1000,
      });
      return;
    }

    // 🎯 ÖNCELİKLE KELİMEYİ VALİDE ET
    console.log('🔍 Validating word:', currentWord);
    const result = await validateWord(currentWord);

    if (!result.isValid) {
      playSound('wrongWord');
      toast({
        title: 'Geçersiz Kelime',
        description: result.message,
        variant: 'destructive',
        duration: 1000,
      });
      clearWord();
      return;
    }

    // 🎯 ESNEKLİK: Case-insensitive used words kontrolü
    const wordToCheck = currentWord.toLowerCase();
    
    console.log('🔍 Checking if word already used:', wordToCheck);
    console.log('🔍 Used words:', Array.from(usedWords));
    
    const isAlreadyUsed = Array.from(usedWords).some(usedWord => 
      usedWord.toLowerCase() === wordToCheck
    );
    
    if (isAlreadyUsed) {
      toast({
        title: 'Kelimeyi Zaten Kullandınız',
        description: 'Bu kelimeyi daha önce SİZ kullandınız.',
        variant: 'destructive',
        duration: 1500,
      });
      playSound('wrongWord');
      clearWord();
      return;
    }

    // 🎯 KELİME GEÇERLİ VE KULLANILMAMIŞ - KABUL ET
    console.log('✅ Word accepted:', currentWord, 'Points:', result.points);
    
    const newUsedWords = new Set([...usedWords, wordToCheck]);
    setUsedWords(newUsedWords);
    console.log('✅ Added word to used (normalized to lowercase):', wordToCheck);
    
    playSound('correctWord');
    const newScore = playerScore + result.points;
    setPlayerScore(newScore);
    
    setPlayerWords(prev => [...prev, currentWord]);
    setPlayerWordsWithScores(prev => [...prev, { word: currentWord, score: result.points }]);
    
    // Trigger effects if purchased
    triggerWordEffects();
    
    if (currentRoom) {
      await updateScore(newScore);
    }

    // Update total score in database
    if (user) {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('total_score')
        .eq('id', user.id)
        .single();

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

        return level;
      };

      const currentLevel = calculateLevel(currentProfile?.total_score || 0);
      const levelMultiplier = 1 + (currentLevel - 1) * 0.1;
      const bonusPoints = Math.floor(result.points * levelMultiplier);
      
      const newTotalScore = (currentProfile?.total_score || 0) + bonusPoints;
      
      await supabase
        .from('profiles')
        .update({ total_score: newTotalScore })
        .eq('id', user.id);
    }

    clearWord();
  }, [waitingForPlayer, currentWord, validateWord, usedWords, playerScore, currentRoom, updateScore, clearWord, toast, playSound, user]);

  // Handle letter click
  const handleLetterClick = useCallback((letter: string, row: number, col: number) => {
    if (gameEnded || waitingForPlayer) return;

    playSound('letterSelect');
    
    const isSelected = selectedLetters.some(s => s.row === row && s.col === col);
    
    if (isSelected) {
      const newSelected = selectedLetters.filter(s => !(s.row === row && s.col === col));
      setSelectedLetters(newSelected);
      setCurrentWord(newSelected.map(s => s.letter).join(''));
    } else {
      const newSelected = [...selectedLetters, { letter, row, col }];
      setSelectedLetters(newSelected);
      setCurrentWord(newSelected.map(s => s.letter).join(''));
    }
  }, [selectedLetters, gameEnded, waitingForPlayer, playSound]);

  // Trigger word effects
  const triggerWordEffects = useCallback(() => {
    if (!(settings?.effects_enabled ?? true)) return;
    
    const hasConfetti = hasPurchased('effect_confetti') && (settings?.confetti_effect_enabled ?? true);
    const hasFireworks = hasPurchased('effect_fireworks') && (settings?.fireworks_effect_enabled ?? true);
    
    if (hasConfetti && hasFireworks) {
      if (Math.random() > 0.5) {
        createConfettiEffect();
      } else {
        createFireworksEffect();
      }
    } else if (hasConfetti) {
      createConfettiEffect();
    } else if (hasFireworks) {
      createFireworksEffect();
    }
  }, [settings, hasPurchased]);

  // Create confetti effect
  const createConfettiEffect = () => {
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'fixed inset-0 pointer-events-none z-50';
    document.body.appendChild(confettiContainer);

    for (let i = 0; i < 25; i++) {
      const confetti = document.createElement('div');
      confetti.className = `absolute w-2 h-2 rounded-full animate-[confetti_2s_ease-out_forwards] ${
        i % 4 === 0 ? 'bg-yellow-400' :
        i % 4 === 1 ? 'bg-red-400' :
        i % 4 === 2 ? 'bg-blue-400' : 'bg-green-400'
      }`;
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.animationDelay = `${Math.random() * 1}s`;
      confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
      confettiContainer.appendChild(confetti);
    }

    setTimeout(() => {
      document.body.removeChild(confettiContainer);
    }, 3000);
  };

  // Create fireworks effect
  const createFireworksEffect = () => {
    const fireworksContainer = document.createElement('div');
    fireworksContainer.className = 'fixed inset-0 pointer-events-none z-50';
    document.body.appendChild(fireworksContainer);

    for (let burst = 0; burst < 3; burst++) {
      setTimeout(() => {
        const centerX = Math.random() * window.innerWidth;
        const centerY = Math.random() * window.innerHeight;

        for (let i = 0; i < 12; i++) {
          const firework = document.createElement('div');
          const colors = ['bg-yellow-400', 'bg-red-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-pink-400'];
          firework.className = `firework ${colors[Math.floor(Math.random() * colors.length)]}`;
          firework.style.left = `${centerX}px`;
          firework.style.top = `${centerY}px`;
          
          const angle = (i / 12) * 2 * Math.PI;
          const distance = 50 + Math.random() * 50;
          firework.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
          
          fireworksContainer.appendChild(firework);
        }
      }, burst * 300);
    }

    setTimeout(() => {
      document.body.removeChild(fireworksContainer);
    }, 2000);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Get opponent info
  const getOpponentInfo = () => {
    switch (gameMode) {
      case 'vs-computer':
        return { name: 'Bilgisayar', icon: Bot, avatar: null };
      case 'private-room':
        if (participants.length >= 2) {
          const opponent = participants.find(p => p.user_id !== user?.id);
          if (opponent && (opponent as any).profiles?.avatar_url) {
            return { 
              name: (opponent as any).profiles.username || 'Arkadaş', 
              icon: User, 
              avatar: (opponent as any).profiles.avatar_url 
            };
          }
        }
        return { name: 'Arkadaş', icon: User, avatar: opponentAvatar };
      case 'random-match':
        if (participants.length >= 2) {
          const opponent = participants.find(p => p.user_id !== user?.id);
          if (opponent && (opponent as any).profiles?.username) {
            return { 
              name: (opponent as any).profiles.username, 
              icon: User, 
              avatar: (opponent as any).profiles?.avatar_url || opponentAvatar 
            };
          }
          if (opponent) {
            return { 
              name: 'Oyuncu', 
              icon: User, 
              avatar: opponentAvatar 
            };
          }
        }
        return { name: 'Rakip Aranıyor...', icon: User, avatar: null };
      case 'tournament':
        return { name: 'Turnuva Rakibi', icon: Trophy, avatar: null };
      default:
        return { name: 'Rakip', icon: User, avatar: null };
    }
  };

  // ⭐ TÜM useEffect'LER

  // Music control and credit consumption
  useEffect(() => {
    const initializeGame = async () => {
      fadeOutBackgroundMusic(1500);
      
      if (!isPremium) {
        const creditConsumed = await consumeCredit();
        if (!creditConsumed) {
          toast({
            title: 'Yetersiz Hak',
            description: 'Oyun oynamak için yeterli hakkınız yok.',
            variant: 'destructive',
          });
          navigate('/market');
          return;
        }
      }
    };
    
    initializeGame();
    
    return () => {
      fadeInBackgroundMusic(1000);
    };
  }, [fadeOutBackgroundMusic, fadeInBackgroundMusic, isPremium, consumeCredit, toast, navigate]);

  // Private room logic
  useEffect(() => {
    if (gameMode === 'private-room') {
      if (participants.length >= 2) {
        setWaitingForPlayer(false);
        setGameStarted(true);
        setUsedWords(new Set());
        
        if (!hasShownStartMessage) {
          setHasShownStartMessage(true);
          toast({
            title: '🎮 Oyun Başladı!',
            description: `${gameType === 'score' ? 'Puanlı' : 'Süreli'} oyun başladı!`,
            duration: 2000,
          });
        }
      } else {
        setWaitingForPlayer(true);
        setGameStarted(false);
        setHasShownStartMessage(false);
        setUsedWords(new Set());
      }
    } else {
      setGameStarted(true);
      setWaitingForPlayer(false);
      setUsedWords(new Set());
    }
  }, [participants, gameMode, hasShownStartMessage, gameType, toast]);

  // ⭐ RENDER LOGİĞİ - HOOKS'LARDAN SONRA

  // Game ended screen
  if (gameEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 game-grid relative overflow-hidden">
        {winner === 'player' && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(disconnectWin ? 75 : 50)].map((_, i) => (
              <div
                key={i}
                className={`absolute w-3 h-3 rounded-full animate-[confetti_3s_ease-out_infinite] ${
                  i % 4 === 0 ? 'bg-yellow-400' :
                  i % 4 === 1 ? 'bg-red-400' :
                  i % 4 === 2 ? 'bg-blue-400' : 'bg-green-400'
                }`}
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  transform: `rotate(${Math.random() * 360}deg)`
                }}
              />
            ))}
          </div>
        )}

        <Card className="w-full max-w-md text-center relative z-10">
          <CardContent className="p-6">
            <Trophy className={`w-16 h-16 mx-auto mb-4 ${
              winner === 'player' ? 'text-yellow-500 animate-bounce' : 'text-gray-400'
            }`} />
            <h2 className={`text-2xl font-bold mb-2 ${
              winner === 'player' ? 'text-yellow-600 animate-pulse' : ''
            }`}>
              {winner === 'player' && disconnectWin ? '🏆 Varsayılan Kazanma!' :
               winner === 'player' ? '🎉 Kazandınız!' :
               winner === 'opponent' ? 'Kaybettiniz!' : 'Beraberlik!'}
            </h2>
            
            <div className="space-y-2 mb-6">
              <div className="flex justify-between">
                <span>Sizin Puanınız:</span>
                <span className="font-bold">{playerScore}</span>
              </div>
              <div className="flex justify-between">
                <span>Rakip:</span>
                <span className="font-bold">{opponentScore}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Button onClick={() => navigate('/')} className="w-full">
                Ana Menüye Dön
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setGameGrid(generateRandomGrid());
                  setSelectedLetters([]);
                  setCurrentWord('');
                  setUsedWords(new Set());
                  setPlayerWords([]);
                  setOpponentWords([]);
                  setPlayerWordsWithScores([]);
                  setOpponentWordsWithScores([]);
                  setPlayerScore(0);
                  setOpponentScore(0);
                  setTimeLeft(gameType === 'timed' ? 120 : 0);
                  setGameStarted(true);
                  setGameEnded(false);
                  setWinner(null);
                  setTimeWarningPlayed(false);
                  setDisconnectWin(false);
                }} 
                className="w-full"
              >
                Tekrar Oyna
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Waiting screens
  if (gameMode === 'random-match' && waitingForPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="animate-pulse space-y-4">
              <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto flex items-center justify-center">
                <User className="w-8 h-8 text-white animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold">Rastgele Eşleşme</h2>
              <p className="text-muted-foreground">Rastgele rakip aranıyor...</p>
              
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm font-medium mb-2">
                  {timeoutCountdown > 0 ? (
                    <>AI rakip ekleme: {timeoutCountdown}s</>
                  ) : (
                    'AI rakip ekleniyor...'
                  )}
                </p>
                <div className="w-full bg-background rounded-full h-2 mt-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${((30 - timeoutCountdown) / 30) * 100}%` }}
                  />
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Katılımcılar: {participants.length}/2
              </p>
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="mt-6 w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Ana Menüye Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (waitingForPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-8">
            <div className="animate-pulse space-y-4">
              <div className="w-16 h-16 bg-green-500 rounded-full mx-auto flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Özel Oda</h2>
              <p className="text-muted-foreground">İkinci oyuncuyu bekliyoruz...</p>
              
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm font-medium">Oda Kodu</p>
                <div className="flex items-center justify-center space-x-2 mt-2">
                  <span className="text-2xl font-mono font-bold">{currentRoom?.room_code}</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={async () => {
                      if (currentRoom?.room_code) {
                        await navigator.clipboard.writeText(currentRoom.room_code);
                        toast({
                          title: 'Kopyalandı!',
                          description: 'Oda kodu panoya kopyalandı',
                        });
                      }
                    }}
                  >
                    Kopyala
                  </Button>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Bu kodu arkadaşınızla paylaşın
              </p>
              <div className="text-xs text-muted-foreground">
                Katılımcılar: {participants.length}/2
              </div>
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="mt-6 w-full"
            >
              Ana Menüye Dön
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main game interface
  const opponent = getOpponentInfo();
  
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
        <div className="max-w-md mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => {
              if (gameMode === 'random-match' && !gameEnded) {
                setShowExitDialog(true);
              } else if (gameMode === 'private-room' && !gameEnded) {
                if (confirm('Oyundan çıkmak istediğinizde arkadaşınız tek kalacak. Emin misiniz?')) {
                  navigate('/');
                }
              } else {
                navigate('/');
              }
            }}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Çıkış
            </Button>
            {gameType === 'timed' ? (
              <div className="flex flex-col items-center space-y-2">
                <div className={`flex items-center space-x-2 transition-all duration-300 ${
                  timeLeft <= 15 ? 'animate-pulse text-red-500' : 'text-foreground'
                }`}>
                  <Clock className={`w-4 h-4 transition-all duration-300 ${
                    timeLeft <= 15 ? 'animate-pulse text-red-500' : ''
                  }`} />
                  <span className={`font-mono text-lg font-bold transition-all duration-300 ${
                    timeLeft <= 15 ? 'text-red-500 scale-110' : ''
                  }`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out ${
                      timeLeft <= 15 ? 'bg-red-500 animate-pulse' : 
                      timeLeft <= 30 ? 'bg-orange-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${(timeLeft / 120) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4" />
                <span className="text-sm font-medium">500 Puana Kadar</span>
              </div>
            )}
          </div>

          {/* Scores */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="light-gradient border-0">
              <CardContent className="p-4 text-center relative overflow-hidden">
                <Avatar className="w-16 h-16 mx-auto mb-2">
                  <AvatarImage 
                    src={playerAvatar || user?.user_metadata?.avatar_url} 
                    alt="Profile"
                  />
                  <AvatarFallback>
                    <User className="w-8 h-8 text-gray-600" />
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm text-gray-700 font-bold font-bungee">
                  Siz
                </p>
                <p className="text-2xl font-bold text-gray-700">{playerScore}</p>
                {gameType === 'score' && (
                  <Progress 
                    value={(playerScore / 500) * 100} 
                    className="mt-2 bg-white/60" 
                  />
                )}
              </CardContent>
            </Card>
            <Card className="light-gradient border-0">
              <CardContent className="p-4 text-center relative overflow-hidden">
                <Avatar className="w-16 h-16 mx-auto mb-2">
                  <AvatarImage 
                    src={opponent.avatar} 
                    alt="Opponent"
                  />
                  <AvatarFallback>
                    <opponent.icon className="w-8 h-8 text-gray-600" />
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm text-gray-700 font-bold font-bungee">
                  {opponent.name}
                </p>
                <p className="text-2xl font-bold text-gray-700">{opponentScore}</p>
                {gameType === 'score' && (
                  <Progress 
                    value={(opponentScore / 500) * 100} 
                    className="mt-2 bg-white/60" 
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Current Word Input */}
          <Card className="game-grid border-0">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Input 
                  value={currentWord} 
                  readOnly 
                  placeholder="~Kelime Üret~"
                  className="text-2xl font-mono text-center bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 font-bold"
                />
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 font-bold text-lg px-3 py-1">
                  {currentWord.length}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Game Grid */}
          <Card className="game-grid border-0">
            <CardContent className="p-6">
              <div className="grid grid-cols-4 gap-3">
                {gameGrid.map((row, rowIndex) =>
                  row.map((letter, colIndex) => {
                    const isSelected = selectedLetters.some(s => s.row === rowIndex && s.col === colIndex);
                    const selectionOrder = selectedLetters.findIndex(s => s.row === rowIndex && s.col === colIndex);
                    return (
                      <Button
                        key={`${rowIndex}-${colIndex}`}
                        className={`letter-button h-16 text-xl font-bold relative ${
                          isSelected ? 'selected' : ''
                        }`}
                        onClick={() => handleLetterClick(letter, rowIndex, colIndex)}
                      >
                        {letter}
                        {isSelected && selectionOrder >= 0 && (
                          <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold border-2 border-white">
                            {selectionOrder + 1}
                          </span>
                        )}
                      </Button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              onClick={clearWord}
              className="h-12"
              disabled={selectedLetters.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Sil
            </Button>
            <Button 
              onClick={() => {
                playSound('buttonClick');
                submitWord();
              }}
              className="h-12"
              disabled={currentWord.length < 3 || isValidating}
            >
              <Send className="w-4 h-4 mr-2" />
              {isValidating ? 'Kontrol Ediliyor...' : 'Gönder'}
            </Button>
          </div>
        </div>
      </div>

      {/* Exit Confirmation Dialog */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent className="max-w-sm mx-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">⚠️ Oyundan Çıkış</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              Oyundan şimdi çıkarsanız <span className="font-bold text-destructive">50-200 puan</span> kaybedeceksiniz! 
              Ayrıca ayrılma sayacınız artacak.
              <br /><br />
              Yine de çıkmak istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col space-y-2 sm:flex-col sm:space-y-2 sm:space-x-0">
            <AlertDialogAction 
              onClick={() => navigate('/')}
              className="w-full bg-destructive hover:bg-destructive/90"
            >
              Evet, Çıkış Yap
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">
              Hayır, Oyuna Devam Et
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GamePage;