import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useGame } from '@/contexts/GameContext';
import { useMusic } from '@/contexts/MusicContext';
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
  const { consumeCredit, isPremium } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentRoom, updateScore, participants } = useGame();
  const { validateWord, isValidating } = useWordValidation();
  const { playSound, playTimeWarningSequence, playCelebrationSound, playGameLoseSound } = useSounds();
  const { fadeOutBackgroundMusic, fadeInBackgroundMusic } = useMusic();
  const [searchParams] = useSearchParams();
  
  // Get game type from room or URL params
  const getGameType = (): 'timed' | 'score' => {
    if (currentRoom?.game_mode) {
      console.log('🎮 Game mode from room:', currentRoom.game_mode);
      if (currentRoom.game_mode.includes('score')) return 'score';
      if (currentRoom.game_mode.includes('timed')) return 'timed';
    }
    const urlType = (searchParams.get('type') as 'timed' | 'score') || 'timed';
    console.log('🎮 Game type from URL:', urlType);
    return urlType;
  };
  
  const gameType = getGameType();
  const [timeWarningPlayed, setTimeWarningPlayed] = useState(false);

  // Game state - Generate random letters each time
  const generateRandomGrid = (): string[][] => {
    // Turkish letters with their frequency weights - NO W, Q, X EVER
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
      // STRICTLY Turkish alphabet only - W, Q, X forbidden
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

  const [gameGrid, setGameGrid] = useState<string[][]>(() => {
    // For private rooms, use grid from room if available
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
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(gameType === 'timed' ? 120 : 0);
  const [gameStarted, setGameStarted] = useState(false);
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [winner, setWinner] = useState<'player' | 'opponent' | 'tie' | null>(null);
  const [playerAvatar, setPlayerAvatar] = useState<string>('');
  const [opponentAvatar, setOpponentAvatar] = useState<string>('');
  const [hasShownStartMessage, setHasShownStartMessage] = useState(false);
  const [lastPlayerAction, setLastPlayerAction] = useState<number>(0);

  // Sync grid with room data and fetch avatars
  useEffect(() => {
    // Update grid from room if available
    if (currentRoom?.current_grid) {
      const flatGrid = currentRoom.current_grid;
      const grid: string[][] = [];
      for (let i = 0; i < 4; i++) {
        grid.push(flatGrid.slice(i * 4, (i + 1) * 4));
      }
      setGameGrid(grid);
    }

    const fetchAvatars = async () => {
      if (!user) return;
      
      // Fetch current user avatar
      const { data: playerData } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      
      if (playerData?.avatar_url) {
        setPlayerAvatar(playerData.avatar_url);
      }

      // Fetch opponent avatar for private room
      if (gameMode === 'private-room' && participants.length >= 2) {
        const opponent = participants.find(p => p.user_id !== user.id);
        if (opponent && (opponent as any).profiles) {
          const opponentProfile = (opponent as any).profiles;
          if (opponentProfile.avatar_url) {
            setOpponentAvatar(opponentProfile.avatar_url);
          }
        }
        
        // Update opponent score from participants in private room
        if (opponent && opponent.score !== undefined && gameMode === 'private-room') {
          console.log('🔄 Updating opponent score from participants:', opponent.score);
          setOpponentScore(opponent.score);
        }
      }
    };

    fetchAvatars();
  }, [user, participants, gameMode, currentRoom]);

  // Music control effect and credit consumption
  useEffect(() => {
    const initializeGame = async () => {
      // Fade out background music when entering game
      fadeOutBackgroundMusic(1500); // 1.5 saniyede yavaşça kapan
      
      console.log('GamePage isPremium:', isPremium);
      
      // Consume credit if not premium
      if (!isPremium) {
        console.log('User is not premium, consuming credit...');
        const creditConsumed = await consumeCredit();
        console.log('Credit consumed result:', creditConsumed);
        if (!creditConsumed) {
          toast({
            title: 'Yetersiz Hak',
            description: 'Oyun oynamak için yeterli hakkınız yok. Market\'ten hak satın alabilirsiniz.',
            variant: 'destructive',
          });
          navigate('/market');
          return;
        }
      } else {
        console.log('User is premium, skipping credit consumption');
      }
    };
    
    initializeGame();
    
    // Fade in background music again when leaving game (cleanup)
    return () => {
      fadeInBackgroundMusic(1000); // 1 saniyede yavaşça açıl
    };
  }, []); // Empty dependency array to run only once

  // Private room logic with controlled notifications + reset used words
  useEffect(() => {
    console.log('=== PRIVATE ROOM CHECK ===');
    console.log('Game mode:', gameMode);
    console.log('Participants count:', participants.length);
    console.log('Has shown start message:', hasShownStartMessage);
    
    if (gameMode === 'private-room') {
      if (participants.length >= 2) {
        console.log('✅ 2 players ready - START GAME FOR BOTH');
        setWaitingForPlayer(false);
        setGameStarted(true);
        
        // Reset used words when game starts
        setUsedWords(new Set());
        console.log('Reset used words for new game');
        
        // Show success toast only once
        if (!hasShownStartMessage) {
          setHasShownStartMessage(true);
          toast({
            title: '🎮 Oyun Başladı!',
            description: `${gameType === 'score' ? 'Puanlı' : 'Süreli'} oyun başladı!`,
            duration: 2000,
          });
        }
      } else {
        console.log('⏳ Waiting for second player...');
        setWaitingForPlayer(true);
        setGameStarted(false);
        setHasShownStartMessage(false); // Reset for next time
        
        // Reset used words when waiting
        setUsedWords(new Set());
      }
    } else {
      setGameStarted(true);
      setWaitingForPlayer(false);
      
      // Reset used words for other game modes
      setUsedWords(new Set());
    }
    console.log('Game type:', gameType, 'Game started:', participants.length >= 2);
    console.log('=== END CHECK ===');
  }, [participants, gameMode, hasShownStartMessage, gameType]);

  // Generate AI word from current grid
  const generateAIWordFromGrid = useCallback(() => {
    const possibleWords = [
      'KEDİ', 'MASA', 'ARABA', 'OKUL', 'KİTAP', 'DENİZ', 'AĞAÇ', 'ÇİÇEK', 
      'DOSTLUK', 'GÜNEŞ', 'YILDIZ', 'BULUT', 'RÜZGAR', 'ATEŞ', 'TOPRAK',
      'SEVGİ', 'MUTLULUK', 'UMUT', 'HAYAL', 'RENKLER', 'MÜZİK', 'DANS', 'ŞARKI',
      'OYUN', 'SPOR', 'FUTBOL', 'BASKETBOL', 'TENİS', 'YÜZME', 'KOŞU', 'BISIKLET',
      'YEMEK', 'EKMEK', 'PEYNIR', 'DOMATES', 'SALATA', 'ÇORBA', 'MEYVE',
      'ELMA', 'ARMUT', 'ÇİLEK', 'KIRAZ', 'ÜZÜM', 'PORTAKAL', 'MANGO',
      'SEBZE', 'HAVUÇ', 'PATLICAN', 'BIBER', 'SOĞAN', 'SARMIMSAK', 'PATATES',
      'KALE', 'KEDI', 'KÖPEK', 'KUŞU', 'BALINA', 'ASLAN', 'KAPLAN', 'FİL',
      'SÜT', 'KOLA', 'ÇAY', 'KAHVE', 'ŞEKER', 'TUZ', 'YAĞLI', 'EKŞI'
    ];
    
    // Flatten grid to get available letters
    const availableLetters = gameGrid.flat();
    const letterCount: { [key: string]: number } = {};
    
    // Count available letters
    availableLetters.forEach(letter => {
      letterCount[letter] = (letterCount[letter] || 0) + 1;
    });
    
    // Find words that can be made from available letters and are not used yet
    const validWords = possibleWords.filter(word => {
      // Check minimum length (3 characters)
      if (word.length < 3) return false;
      
      // Check if word is already used (normalize to uppercase for comparison)
      if (usedWords.has(word.toUpperCase())) {
        console.log(`AI skipping already used word: ${word}`);
        return false;
      }
      
      const wordLetterCount: { [key: string]: number } = {};
      
      // Count letters needed for this word
      for (const letter of word) {
        wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
      }
      
      // Check if we have enough letters
      for (const [letter, needed] of Object.entries(wordLetterCount)) {
        if ((letterCount[letter] || 0) < needed) {
          return false;
        }
      }
      
      return true;
    });
    
    if (validWords.length > 0) {
      return validWords[Math.floor(Math.random() * validWords.length)];
    }
    
    // Fallback: try to make simple 3-letter words that aren't used
    const simpleWords = ['SUT', 'ETİ', 'ALI', 'VER', 'GEL', 'GİT', 'YAZ', 'OKU', 'BAK', 'KOŞ', 'YAP', 'İÇ'];
    for (const word of simpleWords) {
      if (word.length < 3 || usedWords.has(word.toUpperCase())) continue;
      
      const wordLetterCount: { [key: string]: number } = {};
      for (const letter of word) {
        wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
      }
      
      let canMake = true;
      for (const [letter, needed] of Object.entries(wordLetterCount)) {
        if ((letterCount[letter] || 0) < needed) {
          canMake = false;
          break;
        }
      }
      
      if (canMake) {
        return word;
      }
    }
    
    return null;
  }, [gameGrid, usedWords]);

  // AI continuous play effect - only for vs-computer mode
  useEffect(() => {
    if (gameMode !== 'vs-computer' || !gameStarted || gameEnded) return;

    const aiPlayInterval = setInterval(() => {
      // Check if player recently took action, if so wait longer
      const timeSincePlayerAction = Date.now() - lastPlayerAction;
      const minDelayAfterPlayerAction = 3000; // 3 saniye minimum bekleme
      
      if (timeSincePlayerAction < minDelayAfterPlayerAction) {
        return; // Bu round'u atla
      }
      
      const aiWord = generateAIWordFromGrid();
      
      if (aiWord) {
        // Add AI word to used words (normalize to uppercase for consistency)
        setUsedWords(prev => new Set([...prev, aiWord.toUpperCase()]));
        console.log(`AI used word: ${aiWord} (added as: ${aiWord.toUpperCase()})`);
        
        const opponentPoints = Math.floor(Math.random() * 25) + 10;
        setOpponentScore(prev => prev + opponentPoints);
        
        playSound('correctWord');
      } else {
        // If no word can be formed, AI gets fewer points
        const opponentPoints = Math.floor(Math.random() * 10) + 5;
        setOpponentScore(prev => prev + opponentPoints);
      }
    }, 4000 + Math.random() * 3000); // 4-7 saniye arasında

    return () => clearInterval(aiPlayInterval);
  }, [gameMode, gameStarted, gameEnded, generateAIWordFromGrid, playSound, lastPlayerAction]);

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

  // Check for winner and apply end game bonuses
  const checkWinner = useCallback(async () => {
    if (gameEnded || winner !== null) return; // Oyun zaten bitmişse veya kazanan belliyse tekrar kontrol etme
    
    let gameResult: 'player' | 'opponent' | 'tie';
    let bonusPoints = 0;
    
    if (playerScore > opponentScore) {
      gameResult = 'player';
      bonusPoints = 50; // Kazanma bonusu
      setWinner('player');
      playSound('gameWin');
      setTimeout(() => playCelebrationSound(), 500);
    } else if (opponentScore > playerScore) {
      gameResult = 'opponent';
      setWinner('opponent');
      playSound('gameLose');
      setTimeout(() => playGameLoseSound(), 500);
    } else {
      gameResult = 'tie';
      bonusPoints = 25; // Beraberlik bonusu
      setWinner('tie');
    }

    // Apply end game bonus for player
    if (user && bonusPoints > 0) {
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('total_score')
        .eq('id', user.id)
        .single();

      const newTotalScore = (currentProfile?.total_score || 0) + bonusPoints;
      
      await supabase
        .from('profiles')
        .update({ total_score: newTotalScore })
        .eq('id', user.id);

      // Show bonus toast
      setTimeout(() => {
        toast({
          title: gameResult === 'player' ? 'Kazanma Bonusu!' : 'Beraberlik Bonusu!',
          description: `+${bonusPoints} bonus EXP kazandınız!`,
          duration: 2000,
        });
      }, 1000);
    }
  }, [playerScore, opponentScore, playSound, playCelebrationSound, gameEnded, winner, user]);

  // Check if score reaches 500 - only for score mode
  useEffect(() => {
    if (gameType === 'score' && (playerScore >= 500 || opponentScore >= 500)) {
      setGameEnded(true);
      checkWinner();
    }
  }, [playerScore, opponentScore, checkWinner, gameType]);

  // Handle letter click
  const handleLetterClick = (letter: string, row: number, col: number) => {
    if (gameEnded || waitingForPlayer) return;

    playSound('letterSelect');
    
    const isSelected = selectedLetters.some(s => s.row === row && s.col === col);
    
    if (isSelected) {
      // Remove only the clicked letter
      const newSelected = selectedLetters.filter(s => !(s.row === row && s.col === col));
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
    if (waitingForPlayer) return;
    
    // Set player action timestamp to delay AI
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

    // Check if word already used
    console.log('🔍 Current word:', currentWord);
    console.log('🔍 Used words:', Array.from(usedWords));
    console.log('🔍 Game mode:', gameMode);
    console.log('🔍 Is word used?', usedWords.has(currentWord.toLowerCase()));
    
    if (usedWords.has(currentWord.toLowerCase())) {
      toast({
        title: 'Kelime Zaten Kullanıldı',
        description: 'Bu kelimeyi daha önce kullandınız.',
        variant: 'destructive',
        duration: 1000,
      });
      playSound('wrongWord');
      clearWord();
      return;
    }

    const result = await validateWord(currentWord);

    if (result.isValid) {
      // Add word to used words
      const newUsedWords = new Set([...usedWords, currentWord.toLowerCase()]);
      setUsedWords(newUsedWords);
      console.log('Added word to used:', currentWord.toLowerCase());
      console.log('New used words:', Array.from(newUsedWords));
      playSound('correctWord');
      const newScore = playerScore + result.points;
      setPlayerScore(newScore);
      
      // Update score in multiplayer context
      if (currentRoom) {
        await updateScore(newScore);
      }

      // Update total score in database for level progression with level multiplier
      if (user) {
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('total_score')
          .eq('id', user.id)
          .single();

        // Calculate current level to determine multiplier
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

          return level;
        };

        const currentLevel = calculateLevel(currentProfile?.total_score || 0);
        const levelMultiplier = 1 + (currentLevel - 1) * 0.1; // Same formula as LevelProgress
        const bonusPoints = Math.floor(result.points * levelMultiplier);
        
        const newTotalScore = (currentProfile?.total_score || 0) + bonusPoints;
        
        await supabase
          .from('profiles')
          .update({ total_score: newTotalScore })
          .eq('id', user.id);

        // Show bonus if multiplier > 1
        if (levelMultiplier > 1) {
          toast({
            title: 'Seviye Bonusu!',
            description: `${result.points} + ${bonusPoints - result.points} bonus = ${bonusPoints} EXP (${levelMultiplier.toFixed(1)}x)`,
            duration: 2000,
          });
        } else {
          toast({
            title: 'Doğru Kelime!',
            description: result.message,
            duration: 1000,
          });
        }
      } else {
        toast({
          title: 'Doğru Kelime!',
          description: result.message,
          duration: 1000,
        });
      }
    } else {
      playSound('wrongWord');
      toast({
        title: 'Geçersiz Kelime',
        description: result.message,
        variant: 'destructive',
        duration: 1000,
      });
    }

    clearWord();

    // Simulate opponent move (for demo)
    if (gameMode === 'vs-computer' && !gameEnded) {
      setTimeout(() => {
        const opponentPoints = Math.floor(Math.random() * 30) + 10;
        setOpponentScore(prev => prev + opponentPoints);
        
        // Show AI is playing message
        toast({
          title: '🤖 AI Oynuyor...',
          description: `AI ${opponentPoints} puan kazandı!`,
          duration: 800,
        });
      }, 1000);
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get opponent info based on game mode with avatar
  const getOpponentInfo = () => {
    switch (gameMode) {
      case 'vs-computer':
        return { name: 'Bilgisayar', icon: Bot, avatar: null };
      case 'private-room':
        // Get opponent from participants
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
        return { name: 'Rakip', icon: User, avatar: null };
      case 'tournament':
        return { name: 'Turnuva Rakibi', icon: Trophy, avatar: null };
      default:
        return { name: 'Rakip', icon: User, avatar: null };
    }
  };

  const opponent = getOpponentInfo();

  if (gameEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 game-grid relative overflow-hidden">
        {/* Konfeti Efekti - sadece kazanıldığında */}
        {winner === 'player' && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(50)].map((_, i) => (
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

        {/* Üzgün Animasyon - sadece kaybedildiğinde */}
        {winner === 'opponent' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="animate-[sadFace_2s_ease-in-out_infinite] text-9xl opacity-20">
              😢
            </div>
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
              {winner === 'player' ? 'Kazandınız! 🎉' :
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
                  // Reset game state instead of reloading page
                  setGameGrid(generateRandomGrid());
                  setSelectedLetters([]);
                  setCurrentWord('');
                  setPlayerScore(0);
                  setOpponentScore(0);
                  setTimeLeft(gameType === 'timed' ? 120 : Infinity);
                  setGameStarted(true);
                  setGameEnded(false);
                  setWinner(null);
                  setTimeWarningPlayed(false);
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

  // Waiting screen for private room
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
              <p className="text-muted-foreground">
                İkinci oyuncuyu bekliyoruz...
              </p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => {
            if (gameMode === 'private-room' && !gameEnded) {
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
              <div className="w-16 h-16 bg-white/60 rounded-full mx-auto mb-2 flex items-center justify-center border-2 border-white/80 overflow-hidden">
                {playerAvatar ? (
                  <img 
                    src={playerAvatar} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-gray-600" />
                )}
              </div>
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
              <div className="w-16 h-16 bg-white/60 rounded-full mx-auto mb-2 flex items-center justify-center border-2 border-white/80 overflow-hidden">
                {opponent.avatar ? (
                  <img 
                    src={opponent.avatar} 
                    alt="Opponent" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <opponent.icon className="w-8 h-8 text-gray-600" />
                )}
              </div>
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
                placeholder="Harflere tıkla"
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
  );
};

export default GamePage;