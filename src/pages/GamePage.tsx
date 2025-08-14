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
    // For vs-computer mode, always use URL params
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
  const [timeWarningPlayed, setTimeWarningPlayed] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);

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
  const [timeoutCountdown, setTimeoutCountdown] = useState(30); // 30 saniye

  // Sync grid with room data and fetch avatars
  useEffect(() => {
    // Update grid from room if available (only when room grid is different)
    if (currentRoom?.current_grid) {
      const flatGrid = currentRoom.current_grid;
      const roomGrid: string[][] = [];
      for (let i = 0; i < 4; i++) {
        roomGrid.push(flatGrid.slice(i * 4, (i + 1) * 4));
      }
      
      // Only update if grid is actually different to prevent unnecessary re-renders
      const isGridDifferent = JSON.stringify(gameGrid) !== JSON.stringify(roomGrid);
      if (isGridDifferent) {
        console.log('📐 Updating grid from room data');
        setGameGrid(roomGrid);
      }
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
        
        // Update opponent score from participants in private room (only if game not ended)
        if (opponent && opponent.score !== undefined && !gameEnded) {
          console.log('🔄 Updating opponent score from participants:', opponent.score);
          setOpponentScore(opponent.score);
        }
      }
      
      // For random-match mode, also sync opponent score (only if game not ended)
      if (gameMode === 'random-match' && participants.length >= 2 && !gameEnded) {
        const opponent = participants.find(p => p.user_id !== user.id && !p.is_bot);
        if (opponent && opponent.score !== undefined) {
          console.log('🔄 Updating opponent score in random match:', opponent.score);
          setOpponentScore(opponent.score);
        }
      }
    };

    fetchAvatars();
  }, [user, participants, gameMode, currentRoom]);

  useEffect(() => {
  // Oyuncu ayrılma event'ini dinle
  const handlePlayerDisconnected = (event: CustomEvent) => {
    const { winner, reason } = event.detail;
    
    console.log('🎯 Player disconnect event:', { winner, reason });
    
    if (winner === 'player') {
      setDisconnectWin(true);
      setGameEnded(true);
      setWinner('player');
      
      // Ses efekti
      playSound('gameWin');
      setTimeout(() => playCelebrationSound(), 500);
      
      // Özel mesaj
      const message = reason === 'opponent_left' 
        ? 'Rakip oyundan ayrıldı' 
        : 'Rakibin bağlantısı koptu';
        
      toast({
        title: '🏆 Tebrikler!',
        description: `${message}. Kazandınız!`,
        duration: 5000,
      });
    }
  };

  // Event listener ekle
  window.addEventListener('playerDisconnected', handlePlayerDisconnected as EventListener);
  
  // Cleanup
  return () => {
    window.removeEventListener('playerDisconnected', handlePlayerDisconnected as EventListener);
  };
}, [playSound, playCelebrationSound, toast]);

// Oyun bittiğinde gösterilecek ekranı güncelle (mevcut gameEnded ekranında):
if (gameEnded) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 game-grid relative overflow-hidden">
      {/* Konfeti Efekti - kazanıldığında */}
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

      {/* Üzgün Animasyon - kaybedildiğinde */}
      {winner === 'opponent' && !disconnectWin && (
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
          
          {/* Kazanma mesajları */}
          <h2 className={`text-2xl font-bold mb-2 ${
            winner === 'player' ? 'text-yellow-600 animate-pulse' : ''
          }`}>
            {winner === 'player' && disconnectWin ? '🏆 Varsayılan Kazanma!' :
             winner === 'player' ? '🎉 Kazandınız!' :
             winner === 'opponent' ? 'Kaybettiniz!' : 'Beraberlik!'}
          </h2>
          
          {/* Açıklama mesajı */}
          {disconnectWin && (
            <p className="text-sm text-muted-foreground mb-3">
              Rakip oyuncu oyundan ayrıldı. Bonus puan kazandınız! 🎁
            </p>
          )}
          
          <div className="space-y-2 mb-6">
            <div className="flex justify-between">
              <span>Sizin Puanınız:</span>
              <span className="font-bold">{playerScore}</span>
            </div>
            <div className="flex justify-between">
              <span>Rakip:</span>
              <span className="font-bold">{opponentScore}</span>
            </div>
            
            {/* Bonus puan gösterimi */}
            {disconnectWin && (
              <div className="flex justify-between text-green-600">
                <span>Kazanma Bonusu:</span>
                <span className="font-bold">+100 EXP</span>
              </div>
            )}
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
                // Reset game state
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
                setTimeLeft(gameType === 'timed' ? 120 : Infinity);
                setGameStarted(true);
                setGameEnded(false);
                setWinner(null);
                setTimeWarningPlayed(false);
                setDisconnectWin(false); // YENI: Reset disconnect win
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

  const updateLeaderboard = async (score: number, bestWord?: string, bestWordScore?: number) => {
  if (!user) return;
  
  try {
    const username = user.user_metadata?.username || user.email?.split('@')[0] || 'Anonim';
    
    const userProfile = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    // Simplified leaderboard update - just increment total score
    await supabase
      .from('profiles')
      .update({ total_score: score })
      .eq('id', user.id);
    
    /* await supabase.rpc('update_daily_leaderboard', {
      p_user_id: user.id,
      p_username: username,
      p_avatar_url: userProfile.data?.avatar_url || null,
      p_game_score: score,
      p_best_word: bestWord || null,
      p_best_word_score: bestWordScore || 0
    }); */
    
    console.log('✅ Liderlik tablosu güncellendi:', { score, bestWord, bestWordScore });
  } catch (error) {
    console.error('❌ Liderlik tablosu güncellenemedi:', error);
  }
};

  // Check if playing with AI (unified logic for all modes)
  const isPlayingWithAI = useCallback(() => {
  const aiStatus = (() => {
    switch (gameMode) {
      case 'vs-computer':
        return true; // Always AI
      case 'private-room':
        return participants.length < 2; // AI if no second player
      case 'random-match':
        // ★★★ RANDOM MATCH: AI varsa AI ile oyna ★★★
        const hasAI = participants.some(p => p.is_bot);
        const hasRealOpponent = participants.filter(p => !p.is_bot).length >= 2;
        return hasAI && !hasRealOpponent;
      case 'tournament':
        return true; // Tournament is always vs AI for now
      default:
        return false;
    }
  })();
  
  console.log(`🤖 AI Status Check - Mode: ${gameMode}, Participants: ${participants.length}, PlayingWithAI: ${aiStatus}`);
  return aiStatus;
}, [gameMode, participants]);

  // AI continuous play effect - unified for all modes when playing with AI
  useEffect(() => {
    const aiPlaying = isPlayingWithAI();
    console.log('🤖 AI Effect Check:', { 
      aiPlaying, 
      gameStarted, 
      gameEnded, 
      gameMode, 
      participantsLength: participants.length 
    });
    
    if (!aiPlaying || !gameStarted || gameEnded) return;

    console.log('🤖 Starting AI play interval for game mode:', gameMode);

    const aiPlayInterval = setInterval(() => {
      // Check if player recently took action, if so wait longer
      const timeSincePlayerAction = Date.now() - lastPlayerAction;
      const minDelayAfterPlayerAction = 3000; // 3 saniye minimum bekleme
      
      if (timeSincePlayerAction < minDelayAfterPlayerAction) {
        return; // Bu round'u atla
      }
      
      // Get current used words from state
      const selectAIWord = async () => {
  try {
    const potentialWords = [
      'KEDİ', 'MASA', 'ARABA', 'OKUL', 'KİTAP', 'DENİZ', 'AĞAÇ', 'ÇİÇEK', 
      'DOSTLUK', 'GÜNEŞ', 'YILDIZ', 'BULUT', 'RÜZGAR', 'ATEŞ', 'TOPRAK',
      'SEVGİ', 'MUTLULUK', 'UMUT', 'HAYAL', 'RENKLER', 'MÜZİK', 'DANS', 'ŞARKI',
      'SPOR', 'FUTBOL', 'BASKETBOL', 'TENİS', 'YÜZME', 'KOŞU', 'BİSİKLET',
      'YEMEK', 'EKMEK', 'PEYNİR', 'DOMATES', 'SALATA', 'ÇORBA', 'MEYVE',
      'ELMA', 'ARMUT', 'ÇİLEK', 'KIRAZ', 'ÜZÜM', 'PORTAKAL', 'MANGO'
    ];
    
    // Shuffle and try words until we find a valid unused one
    const shuffledWords = potentialWords.sort(() => Math.random() - 0.5);
    
    for (const word of shuffledWords) {
      const wordToCheck = word.toLowerCase(); // AI için de lowercase kontrol
      
      // Case-insensitive used word check for AI
      const isAlreadyUsed = Array.from(usedWords).some(usedWord => 
        usedWord.toLowerCase() === wordToCheck
      );
      
      if (!isAlreadyUsed) {
        try {
          const { data, error } = await supabase.functions.invoke('validate-word', {
            body: { word }
          });
          
          if (!error && data && data.isValid) {
            console.log(`🤖 AI used validated word: ${word} in ${gameMode} mode`);
            
            const opponentPoints = data.points || Math.floor(Math.random() * 25) + 10;
            setOpponentScore(prev => prev + opponentPoints);
            
            // Store AI word with score for statistics
            setOpponentWords(prev => [...prev, word]);
            setOpponentWordsWithScores(prev => [...prev, { word, score: opponentPoints }]);
            
            playSound('correctWord');
            
            // Update used words - normalized to lowercase
            setUsedWords(prev => new Set([...prev, wordToCheck]));
            console.log('🤖 AI added word to used (normalized to lowercase):', wordToCheck);
            return;
          }
        } catch (validationError) {
          console.warn(`Word validation failed for ${word}:`, validationError);
          continue;
        }
      } else {
        console.log(`🤖 AI skipping already used word: ${word} (${wordToCheck})`);
      }
    }
    
    // If no valid word found, AI gets fewer points
    const opponentPoints = Math.floor(Math.random() * 10) + 5;
    setOpponentScore(prev => prev + opponentPoints);
    console.log(`🤖 AI couldn't find unused validated word, got ${opponentPoints} points in ${gameMode} mode`);
    
  } catch (error) {
    console.error('AI word selection error:', error);
    const opponentPoints = Math.floor(Math.random() * 10) + 5;
    setOpponentScore(prev => prev + opponentPoints);
    console.log(`🤖 AI error, got ${opponentPoints} points in ${gameMode} mode`);
  }
};

      selectAIWord();
    }, 4000 + Math.random() * 3000); // 4-7 saniye arasında

    return () => {
      console.log('🤖 Stopping AI play interval for game mode:', gameMode);
      clearInterval(aiPlayInterval);
    };
  }, [gameStarted, gameEnded, gameMode, participants.length, usedWords, playSound, setOpponentScore, setOpponentWords, setOpponentWordsWithScores, setUsedWords]); // Dependencies added


  useEffect(() => {
  // Sadece random match + waiting durumunda timeout başlat
  if (gameMode === 'random-match' && waitingForPlayer && participants.length === 1) {
    console.log('⏰ Random match timeout başlatılıyor (30 saniye)');
    
    setTimeoutCountdown(30);
    
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setTimeoutCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Main timeout
    const timeout = setTimeout(async () => {
      console.log('⏰ Random match timeout! AI ekleniyor...');
      
      if (currentRoom && participants.length === 1) {
        try {
          // AI rakip ekle
          await supabase
            .from('game_participants')
            .insert({
              room_id: currentRoom.id,
              user_id: null, // AI için null
              score: 0,
              is_bot: true
            });
          
          toast({
            title: '🤖 AI Rakip Eklendi',
            description: 'Gerçek oyuncu bulunamadı, AI ile oynanacak',
            duration: 3000,
          });
          
          console.log('🤖 AI başarıyla eklendi');
        } catch (error) {
          console.error('❌ AI ekleme hatası:', error);
        }
      }
      
      clearInterval(countdownInterval);
    }, 30000); // 30 saniye
    
    setMatchmakingTimeout(timeout);
    
    // Cleanup
    return () => {
      if (timeout) clearTimeout(timeout);
      clearInterval(countdownInterval);
    };
  } else {
    // Timeout'u temizle
    if (matchmakingTimeout) {
      clearTimeout(matchmakingTimeout);
      setMatchmakingTimeout(null);
    }
  }
}, [gameMode, waitingForPlayer, participants.length, currentRoom]);

  // Timer effect - for both timed and score modes
  useEffect(() => {
    if (!gameStarted || gameEnded) return;

    // For timed mode, use countdown timer
    if (gameType === 'timed') {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          // Play time warning at 15 seconds
          if (prev === 15 && !timeWarningPlayed) {
            playTimeWarningSequence();
            setTimeWarningPlayed(true);
          }
          
          if (prev <= 1) {
            setGameEnded(true);
            // Use setTimeout to ensure we get the latest scores
            setTimeout(() => {
              setPlayerScore(currentPlayerScore => {
                setOpponentScore(currentOpponentScore => {
                  checkWinnerWithScores(currentPlayerScore, currentOpponentScore);
                  return currentOpponentScore;
                });
                return currentPlayerScore;
              });
            }, 100);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [gameStarted, gameEnded, gameType]);

  // Check for winner and apply end game bonuses - parametre ile skorları al
  const checkWinnerWithScores = useCallback(async (currentPlayerScore: number, currentOpponentScore: number) => {
    if (gameEnded || winner !== null) return; // Oyun zaten bitmişse veya kazanan belliyse tekrar kontrol etme
    
    console.log('🏆 Checking winner with scores - Player:', currentPlayerScore, 'Opponent:', currentOpponentScore);
    
    let gameResult: 'player' | 'opponent' | 'tie';
    let bonusPoints = 0;
    
    // Kesin kazanan belirleme mantığı
    if (currentPlayerScore > currentOpponentScore) {
      gameResult = 'player';
      bonusPoints = 50; // Kazanma bonusu
      setWinner('player');
      playSound('gameWin');
      setTimeout(() => playCelebrationSound(), 500);
      console.log('🏆 Player wins! Score:', currentPlayerScore, 'vs', currentOpponentScore);
    } else if (currentPlayerScore < currentOpponentScore) {
      gameResult = 'opponent';
      setWinner('opponent');
      playSound('gameLose');
      setTimeout(() => playGameLoseSound(), 500);
      console.log('🏆 Opponent wins! Score:', currentOpponentScore, 'vs', currentPlayerScore);
    } else {
      // Skorlar eşit ise beraberlik
      gameResult = 'tie';
      bonusPoints = 25; // Beraberlik bonusu
      setWinner('tie');
      console.log('🏆 It\'s a tie! Both scores:', currentPlayerScore);
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
    
    // End the game and cleanup room (for multiplayer modes)
    if (currentRoom && (gameMode === 'random-match' || gameMode === 'private-room')) {
      // Delay cleanup to allow players to see results
      setTimeout(async () => {
        // Gather statistics for both players
        const playerStats = user ? {
          userId: user.id,
          score: currentPlayerScore,
          words: playerWordsWithScores,
          isWinner: gameResult === 'player'
        } : undefined;
        
        // For opponent stats, we need to check if it's a real player or AI
        const opponentParticipant = participants.find(p => p.user_id !== user?.id && !p.is_bot);
        const opponentStats = opponentParticipant?.user_id ? {
          userId: opponentParticipant.user_id,
          score: currentOpponentScore,
          words: opponentWordsWithScores,
          isWinner: gameResult === 'opponent'
        } : undefined;
        
        // Call endGame from context to cleanup room and participants with statistics
        await endGame(playerStats, opponentStats);
      }, 3000); // 3 second delay to see results
    }
    await updateLeaderboard(currentPlayerScore);
  }, [gameEnded, winner, user, currentRoom, gameMode, endGame, playSound, playCelebrationSound, playGameLoseSound, toast]);

  // Check for winner - eski fonksiyon da kalsın puanlı oyunlar için
  const checkWinner = useCallback(async () => {
    checkWinnerWithScores(playerScore, opponentScore);
  }, [playerScore, opponentScore, checkWinnerWithScores]);

  // Check win conditions based on game type
  useEffect(() => {
    if (gameType === 'score') {
      // Score mode: first to reach max_score wins
      const maxScore = currentRoom?.max_score || 500;
      if (playerScore >= maxScore || opponentScore >= maxScore) {
        setGameEnded(true);
        checkWinner();
      }
    } else if (gameType === 'timed') {
      // Timed mode: game ends when timer reaches 0 (handled in timer effect)
      // No additional check needed here
    }
  }, [playerScore, opponentScore, checkWinner, gameType, currentRoom?.max_score]);

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
  const wordToCheck = currentWord.toLowerCase(); // Kontrol için hep lowercase kullan
  
  console.log('🔍 Checking if word already used:', wordToCheck);
  console.log('🔍 Used words:', Array.from(usedWords));
  
  // Used words set'inde bu kelimenin herhangi bir varyantı var mı?
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
  
  // Add word to used words (normalize to lowercase for consistency)
  const newUsedWords = new Set([...usedWords, wordToCheck]);
  setUsedWords(newUsedWords);
  console.log('✅ Added word to used (normalized to lowercase):', wordToCheck);
  
  playSound('correctWord');
  const newScore = playerScore + result.points;
  setPlayerScore(newScore);
  
  // Store word with score for statistics (original case için)
  setPlayerWords(prev => [...prev, currentWord]);
  setPlayerWordsWithScores(prev => [...prev, { word: currentWord, score: result.points }]);
  
  // Trigger effects if purchased
  triggerWordEffects();
  
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
};

  // Trigger word effects (confetti/fireworks) if purchased
  const triggerWordEffects = () => {
    // Check if effects are globally enabled
    if (!(settings?.effects_enabled ?? true)) return;
    
    const hasConfetti = hasPurchased('effect_confetti') && (settings?.confetti_effect_enabled ?? true);
    const hasFireworks = hasPurchased('effect_fireworks') && (settings?.fireworks_effect_enabled ?? true);
    
    // If both purchased and enabled, randomly choose one
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
  };

  // Create confetti effect
  const createConfettiEffect = () => {
    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'fixed inset-0 pointer-events-none z-50';
    document.body.appendChild(confettiContainer);

    // Create 25 confetti pieces
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

    // Remove effect after animation
    setTimeout(() => {
      document.body.removeChild(confettiContainer);
    }, 3000);
  };

  // Create fireworks effect
  const createFireworksEffect = () => {
    const fireworksContainer = document.createElement('div');
    fireworksContainer.className = 'fixed inset-0 pointer-events-none z-50';
    document.body.appendChild(fireworksContainer);

    // Create 3 firework bursts at random positions
    for (let burst = 0; burst < 3; burst++) {
      setTimeout(() => {
        const centerX = Math.random() * window.innerWidth;
        const centerY = Math.random() * window.innerHeight;

        // Create 12 firework particles per burst
        for (let i = 0; i < 12; i++) {
          const firework = document.createElement('div');
          const colors = ['bg-yellow-400', 'bg-red-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-pink-400'];
          firework.className = `firework ${colors[Math.floor(Math.random() * colors.length)]}`;
          firework.style.left = `${centerX}px`;
          firework.style.top = `${centerY}px`;
          
          // Random direction for particle spread
          const angle = (i / 12) * 2 * Math.PI;
          const distance = 50 + Math.random() * 50;
          firework.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
          
          fireworksContainer.appendChild(firework);
        }
      }, burst * 300); // Stagger the bursts
    }

    // Remove effect after animation
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
        // Get opponent from participants (similar to private-room logic)
        if (participants.length >= 2) {
          const opponent = participants.find(p => p.user_id !== user?.id);
          if (opponent && (opponent as any).profiles?.username) {
            console.log('🎮 Random match opponent found:', (opponent as any).profiles.username);
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
        console.log('🔍 Random match: waiting for opponent, participants:', participants.length);
        return { name: 'Rakip Aranıyor...', icon: User, avatar: null };
      case 'tournament':
        return { name: 'Turnuva Rakibi', icon: Trophy, avatar: null };
      default:
        return { name: 'Rakip', icon: User, avatar: null };
    }
  };

  

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
                <span>Rakip:</span>
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
                  setUsedWords(new Set());
                  setPlayerWords([]);
                  setOpponentWords([]);
                  setPlayerWordsWithScores([]);
                  setOpponentWordsWithScores([]);
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
            <p className="text-muted-foreground">
              Rastgele rakip aranıyor...
            </p>
            
            {/* Timeout countdown */}
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
            
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-medium mb-2">Oyun Tipi</p>
              <Badge variant="outline" className="text-lg px-4 py-2">
                {gameType === 'timed' ? '⏱️ Süreli (2 dakika)' : '🎯 Puanlı (500 puana kadar)'}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Katılımcılar: {participants.length}/2
            </p>
            
            <p className="text-xs text-muted-foreground">
              30 saniye içinde gerçek oyuncu bulunamazsa AI rakip eklenecek
            </p>
            
            <div className="flex space-x-2 justify-center">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
          
          <div className="space-y-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Ana Menüye Dön
            </Button>
            
            <Button 
              variant="secondary" 
              onClick={async () => {
                console.log('👤 Manuel AI ekleme');
                if (currentRoom && participants.length === 1) {
                  try {
                    await supabase
                      .from('game_participants')
                      .insert({
                        room_id: currentRoom.id,
                        user_id: null,
                        score: 0,
                        is_bot: true
                      });
                    
                    toast({
                      title: '🤖 AI Rakip Eklendi',
                      description: 'Manuel olarak AI rakip eklendi',
                    });
                  } catch (error) {
                    console.error('❌ Manuel AI ekleme hatası:', error);
                  }
                }
              }}
              className="w-full text-sm"
            >
              🤖 Hemen AI ile Oyna
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