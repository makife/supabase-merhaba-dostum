import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
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
  gameMode: 'vs-computer' | 'private-room' | 'random-match';
}

const GamePage = ({ gameMode }: GamePageProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Game state
  const [gameGrid] = useState<string[][]>([
    ['K', 'E', 'L', 'İ'],
    ['M', 'A', 'S', 'A'],
    ['T', 'O', 'P', 'U'],
    ['R', 'N', 'D', 'Y']
  ]);
  
  const [selectedLetters, setSelectedLetters] = useState<{letter: string, row: number, col: number}[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120); // 2 minutes
  const [gameStarted, setGameStarted] = useState(true);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<'player' | 'opponent' | 'tie' | null>(null);

  // Timer effect
  useEffect(() => {
    if (!gameStarted || gameEnded) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameEnded(true);
          checkWinner();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, gameEnded]);

  // Check for winner
  const checkWinner = useCallback(() => {
    if (playerScore > opponentScore) {
      setWinner('player');
    } else if (opponentScore > playerScore) {
      setWinner('opponent');
    } else {
      setWinner('tie');
    }
  }, [playerScore, opponentScore]);

  // Check if score reaches 100
  useEffect(() => {
    if (playerScore >= 100 || opponentScore >= 100) {
      setGameEnded(true);
      checkWinner();
    }
  }, [playerScore, opponentScore, checkWinner]);

  // Handle letter click
  const handleLetterClick = (letter: string, row: number, col: number) => {
    if (gameEnded) return;

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

    // Check if word is valid (simplified for demo)
    const validWords = ['KEL', 'KALE', 'MASA', 'TOP', 'TOR', 'MAT', 'AS', 'SA'];
    const isValid = validWords.includes(currentWord);

    if (isValid) {
      const points = currentWord.length * 10;
      setPlayerScore(prev => prev + points);
      toast({
        title: 'Doğru Kelime!',
        description: `+${points} puan kazandınız!`,
      });
    } else {
      toast({
        title: 'Geçersiz Kelime',
        description: 'Bu kelime sözlükte bulunmuyor.',
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
              <Button onClick={() => navigate('/')} className="w-full">
                Ana Menüye Dön
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()} 
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
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span className="font-mono text-lg">{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <User className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Siz</p>
              <p className="text-2xl font-bold">{playerScore}</p>
              <Progress value={(playerScore / 100) * 100} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <opponent.icon className="w-6 h-6 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{opponent.name}</p>
              <p className="text-2xl font-bold">{opponentScore}</p>
              <Progress value={(opponentScore / 100) * 100} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Current Word Input */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Input 
                value={currentWord} 
                readOnly 
                placeholder="Harflere tıklayarak kelime oluşturun"
                className="text-lg font-mono text-center"
              />
              <Badge variant="secondary">{currentWord.length}</Badge>
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
            onClick={submitWord}
            className="h-12"
            disabled={currentWord.length < 3}
          >
            <Send className="w-4 h-4 mr-2" />
            Gönder
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GamePage;