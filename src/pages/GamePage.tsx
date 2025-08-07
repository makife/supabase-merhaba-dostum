import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useGame } from '@/contexts/GameContext';
import { useWordValidation } from '@/hooks/useWordValidation';
import { useSounds } from '@/hooks/useSounds';
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentRoom, updateScore } = useGame();
  const { validateWord, isValidating } = useWordValidation();
  const { playSound, playTimeWarningSequence } = useSounds();
  const [searchParams] = useSearchParams();
  const gameType = (searchParams.get('type') as 'timed' | 'score') || 'timed';
  const [timeWarningPlayed, setTimeWarningPlayed] = useState(false);

  // Game state - Generate random letters each time
  const generateRandomGrid = (): string[][] => {
    // Turkish letters with their frequency weights
    const letterPool = [
      'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', // A - very common
      'E', 'E', 'E', 'E', 'E', 'E', 'E',       // E - very common
      'İ', 'İ', 'İ', 'İ', 'İ', 'İ',           // İ - common
      'I', 'I', 'I', 'I', 'I',                 // I - common
      'O', 'O', 'O', 'O', 'O',                 // O - common
      'U', 'U', 'U', 'U',                      // U - common
      'Ü', 'Ü', 'Ü',                           // Ü - common
      'Ö', 'Ö', 'Ö',                           // Ö - common
      'L', 'L', 'L', 'L', 'L',                 // L - common
      'N', 'N', 'N', 'N', 'N',                 // N - common
      'R', 'R', 'R', 'R', 'R',                 // R - common
      'K', 'K', 'K', 'K',                      // K - common
      'M', 'M', 'M', 'M',                      // M - common
      'T', 'T', 'T', 'T',                      // T - common
      'S', 'S', 'S', 'S',                      // S - common
      'D', 'D', 'D',                           // D - common
      'Y', 'Y', 'Y',                           // Y - common
      'B', 'B', 'B',                           // B - medium
      'C', 'C',                                // C - medium
      'Ç', 'Ç',                                // Ç - medium
      'F', 'F',                                // F - medium
      'G', 'G',                                // G - medium
      'Ğ', 'Ğ',                                // Ğ - medium
      'H', 'H',                                // H - medium
      'J',                                     // J - rare
      'P', 'P',                                // P - medium
      'Ş', 'Ş',                                // Ş - medium
      'V', 'V',                                // V - medium
      'Z',                                     // Z - rare
      'Q', 'W', 'X'                            // Foreign letters - rare
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
  };

  const [gameGrid] = useState<string[][]>(() => generateRandomGrid());
  
  const [selectedLetters, setSelectedLetters] = useState<{letter: string, row: number, col: number}[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(gameType === 'timed' ? 120 : 0); // Only use timer for timed mode
  const [gameStarted, setGameStarted] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<'player' | 'opponent' | 'tie' | null>(null);
  const [playerAvatar, setPlayerAvatar] = useState<string>('');

  // Fetch player avatar from profiles table
  useEffect(() => {
    const fetchPlayerAvatar = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      
      if (data?.avatar_url) {
        setPlayerAvatar(data.avatar_url);
      }
    };

    fetchPlayerAvatar();
  }, [user]);

  // Timer effect - only for timed mode
  useEffect(() => {
    if (!gameStarted || gameEnded || gameType !== 'timed') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        // Play time warning at 15 seconds
        if (prev === 15 && !timeWarningPlayed) {
          playTimeWarningSequence();
          setTimeWarningPlayed(true);
        }
        
        if (prev <= 1) {
          setGameEnded(true);
          checkWinner();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, gameEnded, gameType]);

  // Check for winner
  const checkWinner = useCallback(() => {
    if (playerScore > opponentScore) {
      setWinner('player');
      playSound('gameWin');
    } else if (opponentScore > playerScore) {
      setWinner('opponent');
      playSound('gameLose');
    } else {
      setWinner('tie');
    }
  }, [playerScore, opponentScore, playSound]);

  // Check if score reaches 100 - only for score mode
  useEffect(() => {
    if (gameType === 'score' && (playerScore >= 100 || opponentScore >= 100)) {
      setGameEnded(true);
      checkWinner();
    }
  }, [playerScore, opponentScore, checkWinner, gameType]);

  // Handle letter click
  const handleLetterClick = (letter: string, row: number, col: number) => {
    if (gameEnded) return;

    playSound('letterSelect');
    
    const isSelected = selectedLetters.some(s => s.row === row && s.col === col);
    
    if (isSelected) {
      // Remove letter and all letters after it
      const index = selectedLetters.findIndex(s => s.row === row && s.col === col);
      const newSelected = selectedLetters.slice(0, index);
      setSelectedLetters(newSelected);
      setCurrentWord(newSelected.map(s => s.letter).join(''));
    } else {
      // Add letter
      const newSelected = [...selectedLetters, { letter, row, col }];
      setSelectedLetters(newSelected);
      setCurrentWord(newSelected.map(s => s.letter).join(''));
    }
  };

  // Clear current word
  const clearWord = () => {
    playSound('buttonClick');
    setSelectedLetters([]);
    setCurrentWord('');
  };

  // Submit word
  const submitWord = async () => {
    if (currentWord.length < 3) {
      toast({
        title: 'Geçersiz Kelime',
        description: 'Kelime en az 3 harf olmalıdır.',
        variant: 'destructive',
      });
      return;
    }

    const result = await validateWord(currentWord);

    if (result.isValid) {
      playSound('correctWord');
      const newScore = playerScore + result.points;
      setPlayerScore(newScore);
      
      // Update score in multiplayer context
      if (currentRoom) {
        await updateScore(newScore);
      }
      
      toast({
        title: 'Doğru Kelime!',
        description: result.message,
      });
    } else {
      playSound('wrongWord');
      toast({
        title: 'Geçersiz Kelime',
        description: result.message,
        variant: 'destructive',
      });
    }

    clearWord();

    // Simulate opponent move (for demo)
    if (gameMode === 'vs-computer' && !gameEnded) {
      setTimeout(() => {
        const opponentPoints = Math.floor(Math.random() * 30) + 10;
        setOpponentScore(prev => prev + opponentPoints);
      }, 1000);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get opponent info based on game mode
  const getOpponentInfo = () => {
    switch (gameMode) {
      case 'vs-computer':
        return { name: 'Bilgisayar', icon: Bot };
      case 'private-room':
        return { name: 'Arkadaş', icon: User };
      case 'random-match':
        return { name: 'Rakip', icon: User };
      case 'tournament':
        return { name: 'Turnuva Rakibi', icon: Trophy };
      default:
        return { name: 'Rakip', icon: User };
    }
  };

  const opponent = getOpponentInfo();

  if (gameEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 game-grid">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-6">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">
              {winner === 'player' ? 'Kazandınız!' :
               winner === 'opponent' ? 'Kaybettiniz!' : 'Beraberlik!'}
            </h2>
            <div className="space-y-2 mb-6">
              <div className="flex justify-between">
                <span>Sizin Puanınız:</span>
                <span className="font-bold">{playerScore}</span>
              </div>
              <div className="flex justify-between">
                <span>{opponent.name}:</span>
                <span className="font-bold">{opponentScore}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Button onClick={() => {
                playSound('buttonClick');
                navigate('/');
              }} className="w-full">
                Ana Menüye Dön
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  playSound('buttonClick');
                  window.location.reload();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
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
              <span className="text-sm font-medium">100 Puana Kadar</span>
            </div>
          )}
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border-emerald-400/50 backdrop-blur-sm">
            <CardContent className="p-4 text-center relative overflow-hidden">
              <div className="w-16 h-16 bg-emerald-500/40 rounded-full mx-auto mb-2 flex items-center justify-center border-2 border-emerald-300/50 overflow-hidden">
                {playerAvatar ? (
                  <img 
                    src={playerAvatar} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-emerald-100" />
                )}
              </div>
              <p className="text-sm text-emerald-100 font-bold"
                 style={{
                   textShadow: '2px 2px 0px rgba(0,0,0,0.8), -1px -1px 0px rgba(0,0,0,0.8), 1px -1px 0px rgba(0,0,0,0.8), -1px 1px 0px rgba(0,0,0,0.8)',
                   WebkitTextStroke: '1px rgba(0,0,0,0.5)'
                 }}>
                Siz
              </p>
              <p className="text-2xl font-bold text-white">{playerScore}</p>
              {gameType === 'score' && (
                <Progress 
                  value={(playerScore / 100) * 100} 
                  className="mt-2 bg-emerald-900/50" 
                />
              )}
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/20 to-purple-600/30 border-purple-400/50 backdrop-blur-sm">
            <CardContent className="p-4 text-center relative overflow-hidden">
              <div className="w-16 h-16 bg-purple-500/40 rounded-full mx-auto mb-2 flex items-center justify-center border-2 border-purple-300/50 overflow-hidden">
                <opponent.icon className="w-8 h-8 text-purple-100" />
              </div>
              <p className="text-sm text-purple-100 font-bold"
                 style={{
                   textShadow: '2px 2px 0px rgba(0,0,0,0.8), -1px -1px 0px rgba(0,0,0,0.8), 1px -1px 0px rgba(0,0,0,0.8), -1px 1px 0px rgba(0,0,0,0.8)',
                   WebkitTextStroke: '1px rgba(0,0,0,0.5)'
                 }}>
                {opponent.name}
              </p>
              <p className="text-2xl font-bold text-white">{opponentScore}</p>
              {gameType === 'score' && (
                <Progress 
                  value={(opponentScore / 100) * 100} 
                  className="mt-2 bg-purple-900/50" 
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
                placeholder="Harflere tıklayarak kelime oluşturun"
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
                  return (
                    <Button
                      key={`${rowIndex}-${colIndex}`}
                      className={`letter-button h-16 text-xl font-bold ${
                        isSelected ? 'selected' : ''
                      }`}
                      onClick={() => handleLetterClick(letter, rowIndex, colIndex)}
                    >
                      {letter}
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
  );
};

export default GamePage;