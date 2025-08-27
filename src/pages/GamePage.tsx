import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Bot,
  Shuffle,
  Lightbulb,
  PenTool
} from 'lucide-react';

interface TournamentMatch {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_score?: number;
  player2_score?: number;
  winner_id: string | null;
  status: string;
  created_at: string;
  updated_at?: string;
  room_id?: string;
}

interface GamePageProps {
  gameMode: 'vs-computer' | 'private-room' | 'random-match' | 'tournament';
  onGameComplete?: (winnerId: string, player1Score: number, player2Score: number) => void;
  tournamentMatch?: TournamentMatch;
  gameType?: 'timed' | 'score';
  participants?: any[];
}

// Joker türleri
interface JokerState {
  degistir: number; // Kalan kullanım sayısı
  fisilida: number;
  senYaz: number;
}

const GamePage = ({ 
  gameMode = 'vs-computer', 
  onGameComplete,
  tournamentMatch,
  gameType: propGameType,
  participants: propsParticipants = []
}: GamePageProps) => {
  const { user } = useAuth();
  const { consumeCredit, isPremium } = useUser();
  const { hasPurchased, settings } = useUserPurchases();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentRoom, updateScore, participants: gameParticipants, endGame, leaveRoom,sendRematchRequest,respondRematchRequest,currentRematchRequest,setCurrentRematchRequest } = useGame();
  const participants = useMemo(() => {
  console.log('🔍 Participants memo - Mode:', gameMode, 'Props:', propsParticipants?.length || 0, 'Game:', gameParticipants?.length || 0);
  
  if (gameMode === 'tournament') {
    console.log('🏆 Tournament mode - Using propsParticipants:', propsParticipants?.length || 0);
    return propsParticipants || [];
  }
  
  console.log('🎮 Other mode - Using gameParticipants:', gameParticipants?.length || 0);
  return gameParticipants || [];
}, [gameMode, propsParticipants, gameParticipants]);
  const { validateWord, isValidating } = useWordValidation();
  const { playSound, playTimeWarningSequence, playCelebrationSound, playGameLoseSound } = useSounds();
  const { fadeOutBackgroundMusic, fadeInBackgroundMusic } = useMusic();
  const [searchParams] = useSearchParams();
  const [lastClickTime, setLastClickTime] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const cleanupRef = useRef<(() => void)[]>([]);
  const syncingRef = useRef(false);
  const submissionLockRef = useRef(false);
  const timerStartedRef = useRef(false);
  const recentSubmissionsRef = useRef<Set<string>>(new Set());
  const [audioYes] = useState(() => {
    const audio = new Audio('/yes.mp3');
    audio.volume = 0.7;
    return audio;
  });
  const [audioWow2] = useState(() => {
    const audio = new Audio('/wow2.mp3');
    audio.volume = 0.7;
    return audio;
  });
  const [audioYahoo] = useState(() => {
    const audio = new Audio('/yahoo.mp3');
    audio.volume = 0.7;
    return audio;
  });
  const [audioDegistir] = useState(() => {
    const audio = new Audio('/degistir.mp3');
    audio.volume = 0.7;
    return audio;
  });
  const [audioFisilda] = useState(() => {
    const audio = new Audio('/fisilda.mp3');
    audio.volume = 0.7;
    return audio;
  });
  const [audioSenyaz] = useState(() => {
    const audio = new Audio('/senyaz.mp3');
    audio.volume = 0.7;
    return audio;
  });
  
  const [globalUsedWords, setGlobalUsedWords] = useState<Set<string>>(new Set());

  const addCleanup = useCallback((cleanupFn: () => void) => {
  cleanupRef.current.push(cleanupFn);
}, []);
  
  // Joker state'leri
  const [jokers, setJokers] = useState<JokerState>({
    degistir: 3,
    fisilida: 3,
    senYaz: 3
  });
  const [selectedJoker, setSelectedJoker] = useState<string | null>(null);
  const [highlightedLetters, setHighlightedLetters] = useState<{row: number, col: number}[]>([]);
  const [isJokerActive, setIsJokerActive] = useState(false);
  
  // Wordlist for local validation
  const [wordlist, setWordlist] = useState<Set<string>>(new Set());
  const [wordlistLoaded, setWordlistLoaded] = useState(false);
  
  // Get game type from room or URL params
const getGameType = useCallback((): 'timed' | 'score' => {
  let result: 'timed' | 'score';
  
  if (gameMode === 'tournament') {
    // Turnuva modunda propGameType kullan
    result = propGameType || 'timed';
    console.log('🏆 Tournament gameType:', result, 'from propGameType:', propGameType);
    return result;
  }
  
  if (gameMode === 'vs-computer') {
    const urlType = (searchParams.get('type') as 'timed' | 'score') || 'timed';
    result = urlType;
    console.log('🤖 VS-Computer gameType:', result);
    return result;
  }
  
  if (currentRoom?.game_mode) {
    if (currentRoom.game_mode.includes('score')) result = 'score';
    else if (currentRoom.game_mode.includes('timed')) result = 'timed';
    else result = 'timed';
  } else {
    const urlType = (searchParams.get('type') as 'timed' | 'score') || 'timed';
    result = urlType;
  }
  
  console.log('🎮 Other mode gameType:', result);
  return result;
}, [gameMode, currentRoom?.game_mode, searchParams, propGameType]);
  
  const gameType = getGameType();
  const [timeWarningPlayed, setTimeWarningPlayed] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showTournamentExitDialog, setShowTournamentExitDialog] = useState(false);

  // Game state - Generate random letters each time
  const generateRandomGrid = useCallback((): string[][] => {
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


const generateTournamentGrid = useCallback((seed: string): string[][] => {
  // Basit LCG (Linear Congruential Generator) ile seed-based random
  const seedNum = parseInt(seed.slice(-8), 16) || Date.now();
  let currentSeed = seedNum;
  
  const seededRandom = () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    return currentSeed / 4294967296;
  };
  
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
      const randomIndex = Math.floor(seededRandom() * letterPool.length);
      row.push(letterPool[randomIndex]);
    }
    grid.push(row);
  }
  
  console.log('🎯 Tournament grid generated with seed:', seed, 'Grid preview:', grid[0]);
  return grid;
}, []);

  const [gameGrid, setGameGrid] = useState<string[][]>(() => {
  // Turnuva modunda match ID'yi seed olarak kullan
  if (gameMode === 'tournament' && tournamentMatch?.id) {
    console.log('🎯 Turnuva grid - match ID seed kullanılıyor:', tournamentMatch.id);
    return generateTournamentGrid(tournamentMatch.id);
  }
  
  // Normal room grid kontrolü
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeLeftRef = useRef<number>(gameType === 'timed' ? 120 : 0);
  const [displayTime, setDisplayTime] = useState<number>(timeLeftRef.current);
  const [gameStarted, setGameStarted] = useState(true);
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
  const [showResults, setShowResults] = useState(false);
  const [isAIOpponent, setIsAIOpponent] = useState(false);
  const [opponentName, setOpponentName] = useState('');
  const [targetScore, setTargetScore] = useState(gameType === 'score' ? 500 : 0);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  
const handleTournamentGameEnd = async (userScore: number, opponentScore: number) => {
  if (!user || !tournamentMatch) {
    console.log('❌ handleTournamentGameEnd: Eksik parametreler');
    return;
  }

  console.log('🏁 handleTournamentGameEnd çağrıldı:', { userScore, opponentScore });

  try {
    const isUserWinner = userScore > opponentScore;
    
    let winnerId;
    if (tournamentMatch.player2_id === null) {
      winnerId = isUserWinner ? user.id : null;
    } else {
      winnerId = isUserWinner ? user.id : (
        tournamentMatch.player1_id === user.id ? 
        tournamentMatch.player2_id : 
        tournamentMatch.player1_id
      );
    }

    console.log('🏆 Kazanan belirlendi:', winnerId);

    // ✅✅✅ ÖNEMLİ: onGameComplete'i AWAIT ile bekle
    if (onGameComplete) {
      console.log('📞 onGameComplete çağrılıyor...');
      const player1Score = tournamentMatch.player1_id === user.id ? userScore : opponentScore;
      const player2Score = tournamentMatch.player1_id === user.id ? opponentScore : userScore;
      
      await onGameComplete(winnerId, player1Score, player2Score);
      console.log('✅ onGameComplete tamamlandı');
    }

    // ✅✅✅ KESİN YÖNLENDİRME - 3 saniye bekle ve git
    setTimeout(() => {
      console.log('🚀 Yönlendirme yapılıyor...');
      navigate(`/tournament/${tournamentMatch.tournament_id}`);
    }, 3000);

  } catch (error) {
    console.error('❌ Turnuva maç bitiş hatası:', error);
    // HATA olursa bile yönlendir
    setTimeout(() => {
      navigate(`/tournament/${tournamentMatch.tournament_id}`);
    }, 2000);
  }
};


  const updatePlayerStatistics = async (
    userId: string,
    gameScore: number,
    words: Array<{word: string, score: number}>,
    isWinner: boolean
  ) => {
    try {
      console.log('📊 Oyun istatistikleri güncelleniyor:', { userId, gameScore, words: words.length, isWinner });
    
      const gameDuration = gameType === 'timed' ? 120 : Math.floor((Date.now() - gameStartTime) / 1000);
    
      console.log('📞 RPC çağrısı yapılıyor:', {
        p_user_id: userId,
        p_score: gameScore,
        p_words: words,
        p_is_winner: isWinner,
        p_game_duration: gameDuration
      });
  
      // TypeScript hatasını önlemek için (any) cast
      const { data, error } = await (supabase.rpc as any)('update_game_stats', {
        p_user_id: userId,
        p_score: gameScore,
        p_words: words,
        p_is_winner: isWinner,
        p_game_duration: gameDuration
      });
    
      console.log('📊 RPC sonucu:', { data, error });
  
      if (error) {
        console.error('❌ RPC hatası:', error);
      } else {
        console.log('✅ Oyun istatistikleri güncellendi');
      }
    } catch (error) {
      console.error('❌ İstatistik güncelleme hatası:', error);
    }
  };

  const checkBadges = async (userId: string, wordsCount?: number) => {
    try {
      console.log('🏆 Rozet kontrolü yapılıyor:', userId);
  
      // ESKİ fonksiyon adını kullan (TypeScript'te tanımlı)
      const { data: badges, error } = await supabase.rpc('check_and_award_badges', {
        p_user_id: userId
      });
  
      if (error) {
        console.error('❌ Rozet kontrolü hatası:', error);
      } else if (badges && Array.isArray(badges) && badges.length > 0) {
        badges.forEach((badge: any) => {
          toast({
            title: '🏆 Yeni Rozet!',
            description: `"${badge.new_badge_name}" rozetini kazandınız! ${badge.new_badge_icon}`,
            duration: 4000,
          });
        });
      }
  
      console.log('✅ Rozet kontrolü tamamlandı');
    } catch (error) {
      console.error('❌ Rozet kontrolü hatası:', error);
    }
  };


  // Oyun biti fonksiyonunu güncelle
  const handleGameEnd = () => {
    console.log('🏁 handleGameEnd çağrıldı!'); // DEBUG EKLE
    console.log('🎮 gameMode:', gameMode, 'user:', user?.id); // DEBUG EKLE
    console.log('🏆 playerScore:', playerScore, 'opponentScore:', opponentScore); // DEBUG EKLE
  
    const finalUserScore = playerScore;
    const finalOpponentScore = opponentScore;
  
    // İstatistikleri güncelle - sadece vs-computer modunda
    if (gameMode === 'vs-computer' && user) {
      console.log('✅ updatePlayerStatistics çağrılıyor!'); // DEBUG EKLE
    
      updatePlayerStatistics(
        user.id,
        finalUserScore,
        playerWordsWithScores, // words yerine playerWordsWithScores kullan
        finalUserScore > finalOpponentScore
      );
    } else {
      console.log('❌ updatePlayerStatistics ÇAĞRILMADI - gameMode:', gameMode, 'user:', !!user); // DEBUG EKLE
    }
  
    // Turnuva modundaysa özel işlem
    if (gameMode === 'tournament' && tournamentMatch) {
      console.log('🏆 Tournament mode - handleTournamentGameEnd çağrılıyor'); // DEBUG EKLE
      handleTournamentGameEnd(finalUserScore, finalOpponentScore);
      return; // Erken çık, UI değişikliği parent component yapacak
    }
  
    // Normal mod için mevcut kod devam eder...
    console.log('🎯 setGameEnded(true) çağrılıyor'); // DEBUG EKLE
    setGameEnded(true);
    // setShowResults burada kullanılmıyor, sadece state tanımla
  };

// 🔧 5. GamePage.tsx - Turnuva modu rakip belirleme düzeltmesi
useEffect(() => {
  if (gameMode === 'tournament' && tournamentMatch) {
    const opponentId = tournamentMatch.player1_id === user?.id ? 
      tournamentMatch.player2_id : 
      tournamentMatch.player1_id;
  
    console.log('🎯 Turnuva rakip analizi:', {
      matchId: tournamentMatch.id,
      player1: tournamentMatch.player1_id?.slice(-8),
      player2: tournamentMatch.player2_id?.slice(-8),
      currentUser: user?.id?.slice(-8),
      opponentId: opponentId?.slice(-8)
    });

    if (!opponentId) {
      console.log('❌ Rakip ID bulunamadı');
      setIsAIOpponent(true);
      setOpponentName('Bekleniyor...');
    } else if (opponentId.startsWith('bot_')) {
      console.log('🤖 Bot rakip tespit edildi');
      setIsAIOpponent(true);
      setOpponentName('Turnuva Botu');
    } else {
      console.log('👥 Gerçek oyuncu rakip tespit edildi');
      setIsAIOpponent(false);
      
      // Gerçek oyuncu ismini participants'tan bul
      const realOpponent = participants.find(p => p.user_id === opponentId);
      if (realOpponent && (realOpponent as any).profiles?.username) {
        setOpponentName((realOpponent as any).profiles.username);
      } else {
        setOpponentName('Turnuva Oyuncusu');
      }
    }

    // Game type ayarlarını uygula - SADECE ILK SEFER
    if (propGameType && timeLeftRef.current === 0) {
      if (propGameType === 'timed') {
        timeLeftRef.current = 120;
        setDisplayTime(120);
        setTargetScore(0);
      } else {
        setTargetScore(500);
        timeLeftRef.current = 0;
        setDisplayTime(0);
      }
    }
  }
}, [gameMode, tournamentMatch, propGameType, user?.id, participants]);

  // Rakip ismini göster - turnuva için
const getOpponentDisplayName = () => {
  if (gameMode === 'tournament' && tournamentMatch) {
    const opponentId = tournamentMatch.player1_id === user?.id ? 
      tournamentMatch.player2_id : 
      tournamentMatch.player1_id;
  
    // Bot kontrolü önce
    if (!opponentId || opponentId.startsWith('bot_')) {
      return 'Turnuva Botu';
    }
    
    // Gerçek oyuncu kontrolü
    const realOpponent = participants.find(p => 
      p.user_id === opponentId && 
      !p.is_bot && 
      p.user_id !== null
    );
    
    if (realOpponent && realOpponent.profiles?.username) {
      return realOpponent.profiles.username;
    }
    
    return 'Turnuva Oyuncusu';
  }

  // Diğer modlar için fallback
  switch (gameMode) {
    case 'vs-computer':
      return 'Bilgisayar';
    case 'private-room':
      return 'Arkadaş';
    case 'random-match':
      return 'Rakip';
    default:
      return 'AI Rakip';
  }
};


  // Turnuva modunda geri dönüş engelle
const handleBackToMenu = async () => {
  // Turnuva modunda özel çıkış dialog'u göster
  if (gameMode === 'tournament') {
    setShowTournamentExitDialog(true);
    return;
  }
  
  // Diğer modlar için normal akış
  const isRealActiveGame = gameStarted && 
                          !gameEnded && 
                          participants.length >= 2 && 
                          participants.some(p => !p.is_bot && p.user_id !== user?.id);
  
  if (isRealActiveGame) {
    setShowExitDialog(true);
    return;
  }
  
  if (currentRoom) {
    await leaveRoom();
  }
  
  navigate('/');
};

  // JOKER FONKSİYONLARI

  // 1. Değiştir Jokeri - 5 harf değiştir (3 sesli, 2 sessiz)
  const useDegisTirJoker = () => {
  if (jokers.degistir <= 0 || isJokerActive) return;

  audioDegistir.currentTime = 0;
  audioDegistir.play().catch(e => console.log('Joker sesi çalınamadı:', e));
  
  // ✅ Diğer jokerler gibi kendini koru
  setIsJokerActive(true);
  
  const vowels = ['A', 'E', 'İ', 'I', 'O', 'U', 'Ü', 'Ö'];
  const consonants = ['B', 'C', 'Ç', 'D', 'F', 'G', 'Ğ', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'Ş', 'T', 'V', 'Y', 'Z'];
  
  const newGrid = [...gameGrid.map(row => [...row])];
  
  // Rastgele 5 pozisyon seç
  const positions: {row: number, col: number}[] = [];
  while (positions.length < 5) {
    const row = Math.floor(Math.random() * 4);
    const col = Math.floor(Math.random() * 4);
    if (!positions.some(p => p.row === row && p.col === col)) {
      positions.push({ row, col });
    }
  }
  
  // İlk 3 pozisyona sesli harf
  for (let i = 0; i < 3; i++) {
    const randomVowel = vowels[Math.floor(Math.random() * vowels.length)];
    newGrid[positions[i].row][positions[i].col] = randomVowel;
  }
  
  // Son 2 pozisyona sessiz harf
  for (let i = 3; i < 5; i++) {
    const randomConsonant = consonants[Math.floor(Math.random() * consonants.length)];
    newGrid[positions[i].row][positions[i].col] = randomConsonant;
  }

  setHighlightedLetters(positions);
  
  setTimeout(() => {
    setHighlightedLetters([]);
    // ✅ İşlem bitince aktif durumu kapat
    setIsJokerActive(false);
  }, 1000);
  
  setGameGrid(newGrid);
  setJokers(prev => ({ ...prev, degistir: prev.degistir - 1 }));
  setSelectedLetters([]);
  setCurrentWord('');
  
  playSound('correctWord');
};


// 2. Fısılda Jokeri - Sözlükteki orijinal haliyle göster (çevirme yapma!)
const useFisildaJoker = async () => {
  if (jokers.fisilida <= 0 || isJokerActive) return;

  audioFisilda.currentTime = 0;
  audioFisilda.play().catch(e => console.log('Joker sesi çalınamadı:', e));
  
  setIsJokerActive(true);
  
  const possibleWords = [
    'KEDİ', 'MASA', 'ARABA', 'OKUL', 'KİTAP', 'DENİZ', 'AĞAÇ', 'ÇİÇEK',
    'DOSTLUK', 'GÜNEŞ', 'YILDIZ', 'BULUT', 'RÜZGAR', 'ATEŞ', 'TOPRAK',
    'SEVGİ', 'MUTLULUK', 'UMUT', 'HAYAL', 'RENKLER', 'MÜZİK', 'DANS', 'ŞARKI',
    'OYUN', 'SPOR', 'FUTBOL', 'BASKETBOL', 'TENİS', 'YÜZME', 'KOŞU', 'BİSİKLET',
    'YEMEK', 'EKMEK', 'PEYNİR', 'DOMATES', 'SALATA', 'ÇORBA', 'MEYVE',
    'ELMA', 'ARMUT', 'ÇİLEK', 'KIRAZ', 'ÜZÜM', 'PORTAKAL', 'MANGO',
    'SEBZE', 'HAVUÇ', 'PATLICAN', 'BİBER', 'SOĞAN', 'SARIMSAK', 'PATATES'
  ];
  
  const availableLetters = gameGrid.flat();
  const letterCount: { [key: string]: number } = {};
  
  availableLetters.forEach(letter => {
    letterCount[letter] = (letterCount[letter] || 0) + 1;
  });
  
  // Önce wordlist'ten kontrol et (eğer yüklenmişse)
  let validWords = [];
  
  if (wordlistLoaded) {
    // Wordlist'ten kelimeleri ORİJİNAL HALİYLE al (çevirme yapma!)
    const wordArray = Array.from(wordlist).map(word => word.toUpperCase().trim());
    validWords = wordArray.filter(word => {
      if (usedWords.has(word)) return false;
      
      const wordLetterCount: { [key: string]: number } = {};
      for (const letter of word) {
        wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
      }
      
      for (const [letter, needed] of Object.entries(wordLetterCount)) {
        if ((letterCount[letter] || 0) < needed) {
          return false;
        }
      }
      return true;
    });
  } else {
    // Fallback: önceden tanımlı kelimeler
    validWords = possibleWords.filter(word => {
      if (usedWords.has(word.toUpperCase())) return false;
      
      const wordLetterCount: { [key: string]: number } = {};
      for (const letter of word) {
        wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
      }
      
      for (const [letter, needed] of Object.entries(wordLetterCount)) {
        if ((letterCount[letter] || 0) < needed) {
          return false;
        }
      }
      return true;
    });
  }
  
  if (validWords.length > 0) {
    // Kelime bulundu
    const selectedWord = validWords[Math.floor(Math.random() * validWords.length)];
    
    // Kelime sırasına göre harfleri bul - HER HARF İÇİN FARKLI POZİSYON
    const wordPositions: {row: number, col: number}[] = [];
    const usedPositions: {row: number, col: number}[] = [];
    
    // ONDALIK için: O-N-D-A-L-I-K sırasıyla (sözlükteki haliyle)
    for (const letter of selectedWord) {
      let letterFound = false;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if (gameGrid[row][col] === letter && 
              !usedPositions.some(p => p.row === row && p.col === col)) {
            wordPositions.push({ row, col });
            usedPositions.push({ row, col });
            letterFound = true;
            break;
          }
        }
        if (letterFound) break;
      }
    }
    
    console.log(`💡 Fısılda: "${selectedWord}" kelimesi (sözlük hali) için ${wordPositions.length} pozisyon bulundu`);
    
    // Kelime sırasına göre harfleri sırayla yak
    for (let i = 0; i < wordPositions.length; i++) {
      setTimeout(() => {
        setHighlightedLetters([wordPositions[i]]);
        playSound('letterSelect');
        
        setTimeout(() => {
          setHighlightedLetters([]);
        }, 400);
      }, i * 500);
    }
    
    setTimeout(() => {
      setIsJokerActive(false);
    }, wordPositions.length * 500 + 800);
    
    // SADECE BAŞARILI DURUMDA JOKER SAYISINI AZALT
    setJokers(prev => ({ ...prev, fisilida: prev.fisilida - 1 }));
    
  } else {
    // Kelime bulunamadı
    setIsJokerActive(false);
    
    toast({
      title: '💡 Fısılda Jokeri',
      description: 'Şu an kulağına fısıldayacağım bir kelime aklıma gelmedi. Eğer değiştir jokeri ile yeni harfler alırsan belki bir şeyler bulabilirim! 🤔',
      duration: 4000,
    });
  }
};

  // 3. Sen Yaz Jokeri - Otomatik kelime üret ve gönder
const useSenYazJoker = async () => {
  if (jokers.senYaz <= 0 || isJokerActive) return;

  audioSenyaz.currentTime = 0;
  audioSenyaz.play().catch(e => console.log('Joker sesi çalınamadı:', e));
  
  setIsJokerActive(true);
  
  const possibleWords = [
    'KEDİ', 'MASA', 'ARABA', 'OKUL', 'KİTAP', 'DENİZ', 'AĞAÇ', 'ÇİÇEK',
    'DOSTLUK', 'GÜNEŞ', 'YILDIZ', 'BULUT', 'RÜZGAR', 'ATEŞ', 'TOPRAK',
    'SEVGİ', 'MUTLULUK', 'UMUT', 'HAYAL', 'RENKLER', 'MÜZİK', 'DANS', 'ŞARKI',
    'OYUN', 'SPOR', 'FUTBOL', 'BASKETBOL', 'TENİS', 'YÜZME', 'KOŞU', 'BİSİKLET'
  ];
  
  const availableLetters = gameGrid.flat();
  const letterCount: { [key: string]: number } = {};
  
  availableLetters.forEach(letter => {
    letterCount[letter] = (letterCount[letter] || 0) + 1;
  });
  
  // Önce wordlist'ten kontrol et (eğer yüklenmişse)
  let validWords = [];
  
  if (wordlistLoaded) {
    // Wordlist'ten mevcut harflerle yapılabilecek kelimeleri bul
    const wordArray = Array.from(wordlist);
    validWords = wordArray.filter(word => {
      if (usedWords.has(word)) return false;
      
      const wordLetterCount: { [key: string]: number } = {};
      for (const letter of word) {
        wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
      }
      
      for (const [letter, needed] of Object.entries(wordLetterCount)) {
        if ((letterCount[letter] || 0) < needed) {
          return false;
        }
      }
      return true;
    });
  } else {
    // Fallback: önceden tanımlı kelimeler
    validWords = possibleWords.filter(word => {
      if (usedWords.has(word.toUpperCase())) return false;
      
      const wordLetterCount: { [key: string]: number } = {};
      for (const letter of word) {
        wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
      }
      
      for (const [letter, needed] of Object.entries(wordLetterCount)) {
        if ((letterCount[letter] || 0) < needed) {
          return false;
        }
      }
      return true;
    });
  }
  
  // ÖNCE KELİME VAR MI DİYE KONTROL ET
  if (validWords.length === 0) {
    // Kelime bulunamadı - joker sayısını AZALTMA!
    setIsJokerActive(false);
    
    toast({
      title: '✍️ Sen Yaz Jokeri',
      description: 'Düşünüyorum ama henüz bulamadım. İstersen harfleri değiştir öyle deneyelim! 🤯',
      duration: 4000,
    });
    
    return; // Fonksiyondan çık, joker azaltma
  }
  
  // Kelime var, şimdi işlemi dene
  const selectedWord = validWords[Math.floor(Math.random() * validWords.length)];
  const normalizedSelectedWord = selectedWord.toUpperCase();
  
  // ÇİFTE KONTROL: Bu kelime gerçekten kullanılmamış mı?
  if (usedWords.has(normalizedSelectedWord)) {
    console.log('⚠️ Sen Yaz Jokeri: Seçilen kelime zaten kullanılmış:', selectedWord);
    setIsJokerActive(false);
    
    toast({
      title: '✍️ Sen Yaz Jokeri',
      description: 'Düşünüyorum ama henüz bulamadım. İstersen harfleri değiştir öyle deneyelim! 🤯',
      duration: 4000,
    });
    
    return; // Fonksiyondan çık, joker azaltma
  }
  
  // Harflerin pozisyonlarını bul
  const wordPositions: {letter: string, row: number, col: number}[] = [];
  const usedPositions: {row: number, col: number}[] = [];
  let canFormWord = true;
  
  for (const letter of selectedWord) {
    let letterFound = false;
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (gameGrid[row][col] === letter && 
            !usedPositions.some(p => p.row === row && p.col === col)) {
          wordPositions.push({ letter, row, col });
          usedPositions.push({ row, col });
          letterFound = true;
          break;
        }
      }
      if (letterFound) break;
    }
    
    if (!letterFound) {
      canFormWord = false;
      break;
    }
  }
  
  // Eğer kelimeyi oluşturamıyorsak
  if (!canFormWord || wordPositions.length !== selectedWord.length) {
    console.log('⚠️ Sen Yaz Jokeri: Kelime ızgarada oluşturulamıyor:', selectedWord);
    setIsJokerActive(false);
    
    toast({
      title: '✍️ Sen Yaz Jokeri',
      description: 'Düşünüyorum ama henüz bulamadım. İstersen harfleri değiştir öyle deneyelim! 🤯',
      duration: 4000,
    });
    
    return; // Fonksiyondan çık, joker azaltma
  }
  
  // Her şey tamam, şimdi kelimeyi yaz
  setCurrentWord(selectedWord);
  setSelectedLetters(wordPositions);
  
  setTimeout(async () => {
    let jokerSuccess = false;
    
    try {
      const normalizedWord = selectedWord.toUpperCase();
      
      // Son kontrol: Kelime hala kullanılmamış mı?
      if (!usedWords.has(normalizedWord)) {
        const result = validateWordLocal(selectedWord);
        
        if (result.isValid) {
          const newUsedWords = new Set([...usedWords, normalizedWord]);
          setUsedWords(newUsedWords);
          
          playSound('correctWord');
          const newScore = playerScore + result.points;
          setPlayerScore(newScore);
          
          setPlayerWords(prev => [...prev, selectedWord]);
          setPlayerWordsWithScores(prev => [...prev, { word: selectedWord, score: result.points }]);
          
          triggerWordEffects();
          
          if (currentRoom) {
            await updateScore(newScore);
          }
          
          jokerSuccess = true; // İşlem başarılı
          console.log('✅ Sen Yaz Jokeri başarılı:', selectedWord, 'Puan:', result.points);
        } else {
          console.log('❌ Sen Yaz Jokeri: Kelime geçersiz:', selectedWord);
        }
      } else {
        console.log('❌ Sen Yaz Jokeri: Kelime zaten kullanılmış:', selectedWord);
      }
    } catch (error) {
      console.error('❌ Sen Yaz Jokeri hatası:', error);
    }
    
    setCurrentWord('');
    setSelectedLetters([]);
    setIsJokerActive(false);
    
    // SADECE GERÇEKTEN BAŞARILI OLDUĞUNDA JOKER SAYISINI AZALT
    if (jokerSuccess) {
      setJokers(prev => ({ ...prev, senYaz: prev.senYaz - 1 }));
      console.log('🎯 Sen Yaz Jokeri harcanı!');
    } else {
      console.log('💾 Sen Yaz Jokeri korundu (işlem başarısız)!');
    }
  }, 1500);
};
  // Sync grid with room data and fetch avatars
  useEffect(() => {
    if (currentRoom?.current_grid) {
      const flatGrid = currentRoom.current_grid;
      const roomGrid: string[][] = [];
      for (let i = 0; i < 4; i++) {
        roomGrid.push(flatGrid.slice(i * 4, (i + 1) * 4));
      }
    
      const isGridDifferent = JSON.stringify(gameGrid) !== JSON.stringify(roomGrid);
      if (isGridDifferent) {
        console.log('📐 Updating grid from room data');
        setGameGrid(roomGrid);
      }
    }

    const fetchAvatars = async () => {
      if (!user) return;
    
      // Kendi avatar'ını al
      const { data: playerData } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
    
      if (playerData?.avatar_url) {
        setPlayerAvatar(playerData.avatar_url);
      }

      // Private room modunda rakip bilgilerini al
      if (gameMode === 'private-room') {
        console.log('👥 Private room - participants kontrol ediliyor:', participants.length);
      
        if (participants.length >= 2) {
          const opponent = participants.find(p => p.user_id !== user.id && !p.is_bot);
        
          if (opponent) {
            console.log('👤 Gerçek rakip bulundu:', {
              userId: opponent.user_id?.slice(-8),
              username: (opponent as any).profiles?.username,
              avatar: (opponent as any).profiles?.avatar_url
            });
          
            // Avatar ve isim güncelle
            if ((opponent as any).profiles?.avatar_url) {
              setOpponentAvatar((opponent as any).profiles.avatar_url);
            }
          
            if ((opponent as any).profiles?.username) {
              setOpponentName((opponent as any).profiles.username);
            }
          
            // Opponent score güncellemesi
            if (opponent.score !== undefined && !gameEnded) {
              console.log('🔄 Updating opponent score from participants:', opponent.score);
              setOpponentScore(opponent.score);
            }
          } else {
            console.log('🤖 Bot opponent detected in private room');
          }
        } else {
          console.log('⏳ Private room - waiting for opponent (participants: ' + participants.length + ')');
        }
      }
    
      // Random match modunda da rakip bilgilerini güncelle
      if (gameMode === 'random-match' && participants.length >= 2 && !gameEnded) {
        const opponent = participants.find(p => p.user_id !== user.id && !p.is_bot);
        if (opponent && opponent.score !== undefined) {
          console.log('🔄 Updating opponent score in random match:', opponent.score);
          setOpponentScore(opponent.score);
        }
      }
    };

    fetchAvatars();
  }, [user, participants, gameMode, currentRoom, gameEnded]);

  // Load wordlist from public/wordlist.txt
  useEffect(() => {
    const loadWordlist = async () => {
      try {
        console.log('📖 Loading wordlist from public/wordlist.txt...');
        const response = await fetch('/wordlist.txt');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const words = text.split('\n')
          .map(word => word.trim().toUpperCase())
          .filter(word => word.length >= 3); // Minimum 3 harf
        
        const wordSet = new Set(words);
        setWordlist(wordSet);
        setWordlistLoaded(true);
        console.log(`✅ Wordlist loaded: ${wordSet.size} words`);
      } catch (error) {
        console.error('❌ Failed to load wordlist:', error);
        setWordlistLoaded(false);
      }
    };

    loadWordlist();
  }, []);

  // Local word validation - Sözlükteki kelimeleri Türkçe'ye çevir
const validateWordLocal = useCallback((word: string): { isValid: boolean; points: number; message: string } => {
  const normalizedWord = word.toUpperCase().trim();
  
  console.log('🔍 Word validation:', {
    originalWord: word,
    normalizedWord,
    globalUsedCount: globalUsedWords.size,
    isUsed: globalUsedWords.has(normalizedWord)
  });
  
  // Basic checks
  if (normalizedWord.length < 3) {
    return {
      isValid: false,
      points: 0,
      message: 'Kelime en az 3 harf olmalıdır'
    };
  }

  // Turkish letter pattern check
  const turkishPattern = /^[A-ZÇĞIİÖŞÜ]+$/;
  if (!turkishPattern.test(normalizedWord)) {
    return {
      isValid: false,
      points: 0,
      message: 'Sadece Türkçe harfler kullanabilirsiniz'
    };
  }


  

  // Wordlist check - sadece orijinal
  if (wordlistLoaded) {
    const wordExists = Array.from(wordlist).some(dictWord => 
      dictWord.toUpperCase() === normalizedWord
    );
    
    if (!wordExists) {
      return {
        isValid: false,
        points: 0,
        message: 'Bu kelime sözlükte bulunamadı'
      };
    }
  }

  // Calculate points
  const calculatePoints = (word: string): number => {
    const basePoints = word.length * 2;
    let rareLetterBonus = 0;
    
    const rareLetters = ['J', 'Z', 'Ğ', 'Ü', 'Ö', 'Ç', 'Ş'];
    for (const letter of word) {
      if (rareLetters.includes(letter)) {
        rareLetterBonus += 3;
      }
    }
    
    return Math.max(basePoints + rareLetterBonus, 5);
  };

  const points = calculatePoints(normalizedWord);
  
  return {
    isValid: true,
    points,
    message: 'Geçerli kelime'
  };
}, [wordlist, wordlistLoaded, globalUsedWords]);
  
  useEffect(() => {
    const initializeGame = async () => {
      fadeOutBackgroundMusic(1500);
      
      console.log('GamePage isPremium:', isPremium);
      
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
    
    return () => {
      fadeInBackgroundMusic(1000);
    };
  }, []);

  // Check for winner and apply end game bonuses
const checkWinnerWithScores = useCallback(async (currentPlayerScore: number, currentOpponentScore: number) => {
  if (gameEnded || winner !== null) return;

  console.log('🏆 Checking winner with scores - Player:', currentPlayerScore, 'Opponent:', currentOpponentScore);

  let gameResult: 'player' | 'opponent' | 'tie';
  let bonusPoints = 0;

  // ✅ TURNUVA MODUNDA BERABERLIK ENGELLEMESİ
  if (gameMode === 'tournament') {
    if (currentPlayerScore === currentOpponentScore) {
      console.log('⚖️ Turnuva beraberlik durumu - tiebreaker uygulanıyor');
      
      // Tiebreaker kuralları:
      // 1. En çok kelime yazan
      // 2. En uzun kelime yazan  
      // 3. En yüksek puanlı kelime yazan
      
      const playerWordCount = playerWordsWithScores.length;
      const opponentWordCount = opponentWordsWithScores.length;
      
      if (playerWordCount > opponentWordCount) {
        console.log('🎯 Tiebreaker: Player kazandı (daha çok kelime)');
        currentPlayerScore += 1; // Minimal advantage
      } else if (opponentWordCount > playerWordCount) {
        console.log('🎯 Tiebreaker: Opponent kazandı (daha çok kelime)');  
        currentOpponentScore += 1;
      } else {
        // Kelime sayısı eşit, en uzun kelime kontrolü
        const playerLongestWord = Math.max(...playerWordsWithScores.map(w => w.word.length), 0);
        const opponentLongestWord = Math.max(...opponentWordsWithScores.map(w => w.word.length), 0);
        
        if (playerLongestWord > opponentLongestWord) {
          console.log('🎯 Tiebreaker: Player kazandı (daha uzun kelime)');
          currentPlayerScore += 1;
        } else if (opponentLongestWord > playerLongestWord) {
          console.log('🎯 Tiebreaker: Opponent kazandı (daha uzun kelime)');
          currentOpponentScore += 1;
        } else {
          // En yüksek puanlı kelime kontrolü
          const playerHighestScore = Math.max(...playerWordsWithScores.map(w => w.score), 0);
          const opponentHighestScore = Math.max(...opponentWordsWithScores.map(w => w.score), 0);
          
          if (playerHighestScore > opponentHighestScore) {
            console.log('🎯 Tiebreaker: Player kazandı (daha yüksek puanlı kelime)');
            currentPlayerScore += 1;
          } else {
            console.log('🎯 Tiebreaker: Opponent kazandı (varsayılan)');
            currentOpponentScore += 1;
          }
        }
      }
    }
  }

  // Final winner determination
  if (currentPlayerScore > currentOpponentScore) {
    gameResult = 'player';
    bonusPoints = 50;
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
    // Normal modlarda beraberlik olabilir
    gameResult = 'tie';
    bonusPoints = 25;
    setWinner('tie');
    console.log('🏆 It\'s a tie! Both scores:', currentPlayerScore);
  }

  // İstatistik güncelleme (vs-computer için)
  if (user && gameMode === 'vs-computer') {
    console.log('📊 checkWinnerWithScores - İstatistik güncelleniyor...');
  
    try {
      const gameDuration = gameType === 'timed' ? 120 : Math.floor((Date.now() - gameStartTime) / 1000);
    
      const { data, error } = await (supabase.rpc as any)('update_game_stats', {
        p_user_id: user.id,
        p_score: currentPlayerScore,
        p_words: playerWordsWithScores,
        p_is_winner: gameResult === 'player',
        p_game_duration: gameDuration
      });
    
      if (error) {
        console.error('❌ İstatistik güncelleme hatası:', error);
      } else {
        console.log('✅ İstatistikler başarıyla güncellendi!');
      
        // Rozet kontrolü
        setTimeout(() => {
          checkBadges(user.id, playerWordsWithScores.length);
        }, 500);
      }
    } catch (error) {
      console.error('❌ İstatistik güncelleme hatası:', error);
    }
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
    setTimeout(async () => {
      const playerStats = user ? {
        userId: user.id,
        score: currentPlayerScore,
        words: playerWordsWithScores,
        isWinner: gameResult === 'player'
      } : undefined;
    
      const opponentParticipant = participants.find(p => p.user_id !== user?.id && !p.is_bot);
      const opponentStats = opponentParticipant?.user_id ? {
        userId: opponentParticipant.user_id,
        score: currentOpponentScore,
        words: opponentWordsWithScores,
        isWinner: gameResult === 'opponent'
      } : undefined;
    
      await endGame(playerStats, opponentStats);
    }, 3000);
  }
}, [gameEnded, winner, user, currentRoom, gameMode, endGame, playSound, playCelebrationSound, playGameLoseSound, toast, participants, playerWordsWithScores, opponentWordsWithScores, gameStartTime, gameType]);

  // 🏆 TURNUVA MAÇLARI İÇİN REAL-TIME SCORE SYNC
  useEffect(() => {
    if (gameMode !== 'tournament' || !tournamentMatch || !user) return;

    console.log('🔄 Turnuva maçı real-time subscription başlatılıyor:', tournamentMatch.id);
    
    const channel = supabase
      .channel(`tournament-match-${tournamentMatch.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tournament_matches',
          filter: `id=eq.${tournamentMatch.id}`
        },
        (payload) => {
          console.log('🏆 Turnuva maçı güncellendi:', payload);
          const newData = payload.new as any;
          
          // Karşı oyuncunun skorunu güncelle
          const isPlayer1 = tournamentMatch.player1_id === user.id;
          const opponentScore = isPlayer1 ? newData.player2_score : newData.player1_score;
          
          if (opponentScore !== undefined && !gameEnded) {
            console.log('🔄 Rakip skoru real-time güncellemesi:', opponentScore);
            setOpponentScore(opponentScore);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Turnuva maçı subscription temizleniyor');
      supabase.removeChannel(channel);
    };
  }, [gameMode, tournamentMatch, user, gameEnded]);

const handleTournamentExit = async () => {
  if (!user || !tournamentMatch) return;

  console.log('Turnuva maçından ayrılıyor:', user.id);

  try {
    // İstatistikleri güncelle (kaybeden olarak)
    await updatePlayerStatistics(
      user.id,
      playerScore,
      playerWordsWithScores,
      false // Kaybeden
    );

    // Rakibi kazanan olarak ayarla
    const winnerId = tournamentMatch.player1_id === user.id ? 
      tournamentMatch.player2_id : 
      tournamentMatch.player1_id;

    // Eğer winnerId null ise bot kazanır
    const finalWinnerId = winnerId || `bot_${Date.now()}`;

    // Skorları ayarla (çıkan kişi 0 puan)
    const isUserPlayer1 = tournamentMatch.player1_id === user.id;
    const player1Score = isUserPlayer1 ? 0 : 500;
    const player2Score = isUserPlayer1 ? 500 : 0;

    // onGameComplete varsa çağır ve navigate işlemini buraya taşı
    if (onGameComplete) {
      await onGameComplete(finalWinnerId, player1Score, player2Score);
    }
    
    // ✅ FIX: Çıkış işleminden sonra manuel navigation
    setShowTournamentExitDialog(false);
    navigate('/tournaments');

  } catch (error) {
    console.error('Çıkış hatası:', error);
    // Hata durumunda da tournuva listesine git
    navigate('/tournaments');
  }
};
  
  // Timer effect - TEK SEFER başlatılır ve sürekli çalışır
useEffect(() => {
  if (gameType === 'timed' && gameStarted && !gameEnded && !timerRef.current) {
    console.log('⏱️ Timer BAŞLATILIYOR - Tek sefer, time:', timeLeftRef.current);
    
    timerRef.current = setInterval(() => {
      timeLeftRef.current -= 1;
      setDisplayTime(timeLeftRef.current);
      
      if (timeLeftRef.current <= 0) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        
        console.log('⏰ Süre bitti! Final skorlar - Player:', playerScore, 'Opponent:', opponentScore);
        
        // ✅ FIX: Timer bittiğinde mevcut skorlarla kazanan belirle
        setGameEnded(true);
        setTimeout(() => {
          checkWinnerWithScores(playerScore, opponentScore);
        }, 100);
      }
    }, 1000);
  }
  
  return () => {
    // Sadece component unmount olduğunda temizle
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
}, [gameStarted, playerScore, opponentScore]);
  
  // Focus/blur event handler
  useEffect(() => {
    if (gameType !== 'timed' || !gameStarted || gameEnded) return;

    // Focus/blur olaylarında hiçbir şey yapma - sadece timer devam etsin
    const handleFocus = () => {
      console.log('📱 Sayfa focus aldı - timer devam ediyor');
    };
    
    const handleBlur = () => {
      console.log('📱 Sayfa focus kaybetti - timer devam ediyor'); 
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [gameType, gameStarted, gameEnded]);
  
  // Timer useEffect'inden SONRA ekleyin
  useEffect(() => {
    if (gameStarted && !gameEnded) {
      setGameStartTime(Date.now());
    }
  }, [gameStarted, gameEnded]);

  

  // Check win conditions based on game type
  useEffect(() => {
    if (gameType === 'score') {
      // Score mode: first to reach max_score wins
      const maxScore = currentRoom?.max_score || 500;
      if (playerScore >= maxScore || opponentScore >= maxScore) {
        setGameEnded(true);
        checkWinnerWithScores(playerScore, opponentScore);
      }
    }
  }, [playerScore, opponentScore, checkWinnerWithScores, gameType, currentRoom?.max_score]);

  // Check if playing with AI (unified logic for all modes)
const isPlayingWithAI = useCallback(() => {
  const aiStatus = (() => {
    switch (gameMode) {
      case 'vs-computer':
        return true;
      case 'tournament': {
        if (tournamentMatch) {
          // ✅✅✅ CRITICAL FIX: Sadece NULL kontrolü
          return tournamentMatch.player2_id === null;
        }
        return false;
      }
      case 'private-room':
        return participants.length < 2;
      case 'random-match':
        const hasAI = participants.some(p => p.is_bot);
        const hasRealOpponent = participants.filter(p => !p.is_bot).length >= 2;
        return hasAI && !hasRealOpponent;
      default:
        return false;
    }
  })();
  
  console.log('AI Status Check - Mode:', gameMode, 'PlayingWithAI:', aiStatus);
  return aiStatus;
}, [gameMode, participants, tournamentMatch]);

  // Real-time kelime senkronizasyonu
useEffect(() => {
  if (!currentRoom) return;

  console.log('🔄 === WORD SYNC BAŞLADI ===');
  console.log('🔄 Room ID:', currentRoom.id.slice(-8));

  // Room'daki tüm kelimeleri al ve sync et
  const syncUsedWords = async () => {
    if (syncingRef.current) {
      console.log('📱 Sync already in progress, skipping');
      return;
    }
    
    syncingRef.current = true;
    
    try {
      // 🔥 VS-COMPUTER FIX: Tek oyuncu modunda önceki kelimeleri yükleme
      if (gameMode === 'vs-computer') {
        console.log('🤖 vs-computer mode: Not loading previous words, starting fresh');
        setGlobalUsedWords(new Set());
        setUsedWords(new Set());
        return;
      }

      const { data: roomWords } = await supabase
        .from('game_words')
        .select('word, player_id')
        .eq('room_id', currentRoom.id);

      if (roomWords) {
        // AYRI AYRI LİSTELER: Her oyuncunun kendi kelimeleri ayrı tutulmalı
        const allWordsSet = new Set(roomWords.map(w => w.word.toUpperCase()));
        const myWordsSet = new Set(
          roomWords
            .filter(w => w.player_id === user?.id)
            .map(w => w.word.toUpperCase())
        );
        
        console.log('🔄 Syncing - All words:', allWordsSet.size, 'My words:', myWordsSet.size);
        setGlobalUsedWords(allWordsSet); // Tüm kelimeler (info için)
        setUsedWords(myWordsSet); // Sadece kendi kelimelerim!
      }
    } catch (error) {
      console.error('❌ Word sync error:', error);
    } finally {
      syncingRef.current = false;
    }
  };

  // Turnuva real-time senkronizasyonu
useEffect(() => {
  if (gameMode !== 'tournament' || !tournamentMatch) return;

  console.log('🏆 Turnuva real-time senkronizasyon başlatıldı');

  // Tournament match değişikliklerini dinle
  const tournamentChannel = supabase
    .channel(`tournament-match-${tournamentMatch.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'tournament_matches',
      filter: `id=eq.${tournamentMatch.id}`
    }, (payload) => {
      console.log('🔄 Tournament match güncellendi:', payload.new);
      
      // Rakip skorunu real-time güncelle
      const newMatch = payload.new as any;
      if (user) {
        const isPlayer1 = newMatch.player1_id === user.id;
        const newOpponentScore = isPlayer1 ? newMatch.player2_score : newMatch.player1_score;
        
        if (newOpponentScore !== undefined && newOpponentScore !== opponentScore) {
          console.log('🔄 Rakip skoru güncellendi:', newOpponentScore);
          setOpponentScore(newOpponentScore);
        }
      }
    })
    .subscribe();

  return () => {
    console.log('🏆 Turnuva real-time temizliği');
    supabase.removeChannel(tournamentChannel);
  };
}, [gameMode, tournamentMatch?.id, user?.id, opponentScore]);

  // İlk sync
  const initialSyncTimer = setTimeout(syncUsedWords, 500);

  // Real-time word changes dinle
  const wordChannel = supabase
    .channel(`mobile-words-${currentRoom.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'game_words',
      filter: `room_id=eq.${currentRoom.id}`
    }, (payload) => {
      console.log('📱 Mobile real-time word:', payload.new?.word, 'from player:', payload.new?.player_id);
      
      // Don't process words from the current user to prevent duplicate validation
      if (payload.new?.word && !syncingRef.current && payload.new?.player_id !== user?.id) {
        const newWord = payload.new.word.toUpperCase();
        
        // Debounced update - only for other players' words
        setTimeout(() => {
          setGlobalUsedWords(prev => new Set([...prev, newWord]));
          // Do NOT add to setUsedWords here; keep my words separate
        }, 100);
      }
    })
    .subscribe();

  return () => {
    clearTimeout(initialSyncTimer);
    console.log('📱 Mobile word sync cleanup');
    supabase.removeChannel(wordChannel);
  };
}, [currentRoom?.id]);

  // AI continuous play effect - unified for all modes when playing with AI
useEffect(() => {
  const aiPlaying = isPlayingWithAI();
  
  if (!aiPlaying || !gameStarted || gameEnded) {
    return;
  }

  console.log('🤖 Starting AI play interval for game mode:', gameMode);

  const aiPlayInterval = setInterval(() => {
    // Check if player recently took action, if so wait longer
    const timeSincePlayerAction = Date.now() - lastPlayerAction;
    const minDelayAfterPlayerAction = 3000; // 3 saniye minimum bekleme
    
    if (timeSincePlayerAction < minDelayAfterPlayerAction) {
      return; // Bu round'u atla
    }
    
    // AI word selection with validation
    const selectAIWord = async () => {
      try {
        const potentialWords = [
          'KEDİ', 'MASA', 'ARABA', 'OKUL', 'KİTAP', 'DENİZ', 'AĞAÇ', 'ÇİÇEK', 
          'DOSTLUK', 'GÜNEŞ', 'YILDIZ', 'BULUT', 'RÜZGAR', 'ATEŞ', 'TOPRAK',
          'SEVGİ', 'MUTLULUK', 'UMUT', 'HAYAL', 'RENKLER', 'MÜZİK', 'DANS', 'ŞARKI',
          'OYUN', 'SPOR', 'FUTBOL', 'BASKETBOL', 'TENİS', 'YÜZME', 'KOŞU', 'BİSİKLET',
          'YEMEK', 'EKMEK', 'PEYNİR', 'DOMATES', 'SALATA', 'ÇORBA', 'MEYVE',
          'ELMA', 'ARMUT', 'ÇİLEK', 'KIRAZ', 'ÜZÜM', 'PORTAKAL', 'MANGO',
          'SEBZE', 'HAVUÇ', 'PATLICAN', 'BİBER', 'SOĞAN', 'SARIMSAK', 'PATATES',
          'KALE', 'KEDİ', 'KÖPEK', 'KUŞU', 'BALINA', 'ASLAN', 'KAPLAN', 'FİL',
          'SÜT', 'KOLA', 'ÇAY', 'KAHVE', 'ŞEKER', 'TUZ', 'YAĞLI', 'EKŞİ',
          'EV', 'KAPI', 'PENCERE', 'ODA', 'SALON', 'MUTFAK', 'BANYO', 'YATAK',
          'ANNE', 'BABA', 'KARDEŞ', 'DEDE', 'NINE', 'AMCA', 'TEYZE', 'HALA',
          'ARKADAŞ', 'AİLE', 'İNSAN', 'ÇOCUK', 'BEBEK', 'YAŞ', 'GÜN', 'GECE',
          'SABAH', 'ÖĞLE', 'AKŞAM', 'HAFTA', 'AY', 'YIL', 'ZAMAN', 'SAAT'
        ];
        
        // Shuffle and try words until we find a valid unused one
        const shuffledWords = potentialWords.sort(() => Math.random() - 0.5);
        
        for (const word of shuffledWords) {
          const normalizedWord = word.toUpperCase();
          
          // Kullanılmış kelime kontrolü - GLOBAL ve LOCAL ayrı kontrol
          if (!usedWords.has(normalizedWord) && !globalUsedWords.has(normalizedWord)) {
            // LOCAL WORDLIST CHECK FOR AI
            if (wordlistLoaded && wordlist.has(normalizedWord)) {
              const points = Math.floor(Math.random() * 25) + 10;
              console.log(`🤖 AI used validated word (local): ${word} in ${gameMode} mode with ${points} points`);
              
              // ✅ FIX: setOpponentScore yerine prev => prev + points kullan
              setOpponentScore(prevScore => {
                const newScore = prevScore + points;
                console.log(`🤖 Bot score update: ${prevScore} + ${points} = ${newScore}`);
                return newScore;
              });
              
              // Store AI word with score for statistics
              setOpponentWords(prev => [...prev, word]);
              setOpponentWordsWithScores(prev => [...prev, { word, score: points }]);
              
              playSound('correctWord');
              
              // Update used words - GLOBAL'e de ekle
              setUsedWords(prev => new Set([...prev, normalizedWord]));
              setGlobalUsedWords(prev => new Set([...prev, normalizedWord]));
              console.log('🤖 AI added word to used:', normalizedWord);
              return;
            } else if (!wordlistLoaded) {
              // Fallback if wordlist not loaded
              const points = Math.floor(Math.random() * 15) + 8;
              console.log(`🤖 AI used word (no wordlist): ${word} with ${points} points`);
              
              setOpponentScore(prevScore => prevScore + points);
              setOpponentWords(prev => [...prev, word]);
              setOpponentWordsWithScores(prev => [...prev, { word, score: points }]);
              playSound('correctWord');
              setUsedWords(prev => new Set([...prev, normalizedWord]));
              setGlobalUsedWords(prev => new Set([...prev, normalizedWord]));
              return;
            }
          }
        }
        
        // If no valid word found, AI gets fewer points
        const opponentPoints = Math.floor(Math.random() * 10) + 5;
        setOpponentScore(prevScore => prevScore + opponentPoints);
        console.log(`🤖 AI couldn't find unused word, got ${opponentPoints} points in ${gameMode} mode`);
        
      } catch (error) {
        console.error('AI word selection error:', error);
        const opponentPoints = Math.floor(Math.random() * 10) + 5;
        setOpponentScore(prevScore => prevScore + opponentPoints);
        console.log(`🤖 AI error, got ${opponentPoints} points in ${gameMode} mode`);
      }
    };

    selectAIWord();
  }, 4000 + Math.random() * 3000); // 4-7 saniye arasında

  return () => {
    console.log('🤖 Stopping AI play interval for game mode:', gameMode);
    clearInterval(aiPlayInterval);
  };
}, [gameStarted, gameEnded, gameMode, usedWords, globalUsedWords]); 

  // Private room logic
  useEffect(() => {
  if (gameMode === 'private-room') {
    const realPlayers = participants.filter(p => !p.is_bot && p.user_id !== null);
  
    if (realPlayers.length >= 2) {
      console.log('✅ 2 gerçek oyuncu hazır - OYUN BAŞLIYOR!');
      setWaitingForPlayer(false);
      setGameStarted(true);
      
      if (!hasShownStartMessage) {
        setHasShownStartMessage(true);
        toast({
          title: '🎮 Özel Oda Oyunu Başladı!',
          description: `${gameType === 'score' ? 'Puanlı' : 'Süreli'} özel oda oyunu başladı!`,
          duration: 2000,
        });
      }
    } else {
      setWaitingForPlayer(true);
      setGameStarted(false);
      setHasShownStartMessage(false);
    }
  }
}, [participants, gameMode, hasShownStartMessage, gameType, toast]);

  // Touch olayları için optimize edilmiş handler
  const handleLetterTouch = (letter: string, row: number, col: number, event: React.TouchEvent) => {
    event.preventDefault(); // Default touch davranışını engelle
    event.stopPropagation();
    handleLetterClick(letter, row, col);
  };

  // Mouse olayları için optimize edilmiş handler  
  const handleLetterMouse = (letter: string, row: number, col: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handleLetterClick(letter, row, col);
  };

  // Handle letter click
  const handleLetterClick = useCallback((letter: string, row: number, col: number) => {
  if (gameEnded || waitingForPlayer || isJokerActive) return;

  const now = Date.now();
    // 150ms debounce (mobil için daha uzun)
    if (now - lastClickTime < 150) return;
    setLastClickTime(now);

    // Haptic feedback (mobil cihazlarda titreşim)
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }

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
  }, [gameEnded, waitingForPlayer, isJokerActive, lastClickTime, selectedLetters, playSound]);

  // Clear current word
  const clearWord = () => {
    setSelectedLetters([]);
    setCurrentWord('');
  };

  // Custom toast fonksiyonu
  const showCustomToast = (title: string, description: string) => {
  const toastDiv = document.createElement('div');
  toastDiv.className = 'fixed bg-red-500 text-white p-3 rounded-lg shadow-lg z-50 transition-transform duration-300 left-1/2';
  toastDiv.style.bottom = '0px'; // Alttan başla
  toastDiv.style.transform = 'translateX(-50%) translateY(100%)'; // Ortala ve aşağıda gizle
  toastDiv.innerHTML = '<div class="font-bold">' + title + '</div><div class="text-sm">' + description + '</div>';
  
  document.body.appendChild(toastDiv);
  
  // Kartın yüksekliğini al
  const cardHeight = toastDiv.offsetHeight;
  
  // Yukarı çık (kart yüksekliği kadar)
  setTimeout(() => {
    toastDiv.style.transform = 'translateX(-50%) translateY(-' + cardHeight + 'px)';
  }, 50);
  
  // 2 saniye sonra aşağı in
  setTimeout(() => {
    toastDiv.style.transform = 'translateX(-50%) translateY(100%)';
    setTimeout(() => {
      if (document.body.contains(toastDiv)) {
        document.body.removeChild(toastDiv);
      }
    }, 300);
  }, 1000);
};

// Submit word - Using local wordlist validation
const submitWord = async () => {
  if (waitingForPlayer || isJokerActive) return;
  
  // Prevent accidental double-taps/duplicate submissions (mobile)
  if (submissionLockRef.current) {
    console.log('⏳ Submission locked - ignoring duplicate tap');
    return;
  }
  submissionLockRef.current = true;
  
  setLastPlayerAction(Date.now());
  
  try {
    if (currentWord.length < 3) {
      showCustomToast('Geçersiz Kelime','');
      return;
    }
  
    const normalizedWord = currentWord.toUpperCase();
  
    // Ignore rapid duplicate submission of the same word (e.g., double tap)
    if (recentSubmissionsRef.current.has(normalizedWord)) {
      console.log('⏳ Ignoring rapid duplicate submission for:', normalizedWord);
      return;
    }
    recentSubmissionsRef.current.add(normalizedWord);
    setTimeout(() => {
      recentSubmissionsRef.current.delete(normalizedWord);
    }, 800);
  
    // Mobile word check
    console.log('📱 Mobile word check:', {
      word: normalizedWord,
      localUsedSize: usedWords.size,
      globalUsedSize: globalUsedWords.size,
      isInLocal: usedWords.has(normalizedWord),
      isInGlobal: globalUsedWords.has(normalizedWord),
      currentUsedWords: Array.from(usedWords),
      currentGlobalWords: Array.from(globalUsedWords)
    });
  
    // SADECE KENDİ KELİMELERİMİ KONTROL ET - rakibin kelimelerini değil!
    if (usedWords.has(normalizedWord)) {
      console.log('❌ Mobile: Word already used by me!', {
        foundInMyList: usedWords.has(normalizedWord),
        myWords: Array.from(usedWords),
        allGlobalWords: Array.from(globalUsedWords)
      });
      showCustomToast('Kelime Zaten Kullanıldı','');
      playSound('wrongWord');
      clearWord();
      return;
    }

    // LOCAL WORDLIST VALIDATION
    const result = validateWordLocal(currentWord);
    
    if (!result.isValid) {
      playSound('wrongWord');
      showCustomToast('Geçersiz Kelime','');
      clearWord();
      return;
    }

    console.log('✅ Mobile: Word accepted:', currentWord, 'Points:', result.points);
    
    // Database'e kelimeyi kaydet (sadece multiplayer modlarda)
    if (currentRoom && user && (gameMode === 'private-room' || gameMode === 'random-match')) {
      try {
        await supabase
          .from('game_words')
          .insert({
            room_id: currentRoom.id,
            player_id: user.id,
            word: normalizedWord,
            points: result.points
          });
        
        console.log('✅ Mobile: Word saved to database:', normalizedWord);
      } catch (error) {
        console.error('❌ Mobile: Database word save error:', error);
        showCustomToast('Kelime kaydedilemedi','');
        clearWord();
        return;
      }
    }

    // SADECE KENDİ LİSTEME EKLE - global'a ekleme, o real-time olarak gelecek
    setUsedWords(prev => new Set([...prev, normalizedWord]));
    console.log('✅ Mobile: Word added to local sets after validation:', normalizedWord);

    // Ses efektleri ve puan hesaplama
    playSound('correctWord');
    const newScore = playerScore + result.points;
    setPlayerScore(newScore);
    
    setPlayerWords(prev => [...prev, currentWord]);
    setPlayerWordsWithScores(prev => [...prev, { word: currentWord, score: result.points }]);

    const wordLength = currentWord.length;

    // Ses efektlerini direkt çal
    if (wordLength === 4) {
      audioYes.currentTime = 0;
      audioYes.play().catch(e => console.log('Audio failed:', e));
    } else if (wordLength === 5) {
      audioWow2.currentTime = 0;
      audioWow2.play().catch(e => console.log('Audio failed:', e));
    } else if (wordLength >= 6) {
      audioYahoo.currentTime = 0;
      audioYahoo.play().catch(e => console.log('Audio failed:', e));
    }
    
    triggerWordEffects();
    
    if (currentRoom) {
      await updateScore(newScore);
    }

    // 🔥 YENİ: Turnuva modunda gerçek rakip puanını güncelle
    if (gameMode === 'tournament' && tournamentMatch && user) {
      try {
        const isPlayer1 = tournamentMatch.player1_id === user.id;
        
        await supabase
          .from('tournament_matches')
          .update({
            [isPlayer1 ? 'player1_score' : 'player2_score']: newScore,
            updated_at: new Date().toISOString()
          })
          .eq('id', tournamentMatch.id);
        
        console.log('🏆 Turnuva skoru güncellendi:', newScore);
      } catch (error) {
        console.error('❌ Turnuva skor güncellenme hatası:', error);
      }
    }

    // Total score güncelleme (vs-computer modunda)
    if (user && gameMode === 'vs-computer') {
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
  } finally {
    submissionLockRef.current = false;
  }
};

  // Trigger word effects (confetti/fireworks) if purchased
const triggerWordEffects = () => {
  console.log('🎵 WORD EFFECTS TRIGGERED:', currentWord.length);
  if (!(settings?.effects_enabled ?? true)) return;
  
  const hasConfetti = hasPurchased('effect_confetti') && (settings?.confetti_effect_enabled ?? true);
  const hasFireworks = hasPurchased('effect_fireworks') && (settings?.fireworks_effect_enabled ?? true);
  
  // Kelime uzunluğuna göre ses çal
  if (currentWord.length === 4) {
    audioYes.currentTime = 0; // Baştan başlat
    audioYes.play().catch(e => console.log('Audio play failed:', e));
  } else if (currentWord.length === 5) {
    audioWow2.currentTime = 0; // Baştan başlat
    audioWow2.play().catch(e => console.log('Audio play failed:', e));
  } else if (currentWord.length >= 6) {
    audioYahoo.currentTime = 0; // Baştan başlat
    audioYahoo.play().catch(e => console.log('Audio play failed:', e));
  }
  
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

  // Create confetti effect - Enhanced version
const createConfettiEffect = () => {
  const confettiContainer = document.createElement('div');
  confettiContainer.className = 'fixed inset-0 pointer-events-none z-50';
  document.body.appendChild(confettiContainer);

  // Daha çok konfeti, farklı boyutlar ve şekiller
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    
    // Rastgele şekil seç
    const shapes = ['circle', 'square', 'triangle'];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    
    // Rastgele boyut
    const size = Math.random() * 8 + 4; // 4-12px
    
    confetti.className = `absolute animate-[confetti_${2 + Math.random() * 2}s_ease-out_forwards] confetti-${shape}`;
    confetti.style.width = `${size}px`;
    confetti.style.height = `${size}px`;
    confetti.style.left = `${Math.random() * 100}%`;
    confetti.style.top = `-10px`;
    
    // Rastgele renk
    const colors = [
      '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', 
      '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471'
    ];
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Rastgele animasyon gecikmesi
    confetti.style.animationDelay = `${Math.random() * 0.5}s`;
    
    // Rastgele rotasyon
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    
    confettiContainer.appendChild(confetti);
  }

  // Parlama efekti ekle
  const sparkle = document.createElement('div');
  sparkle.className = 'fixed inset-0 pointer-events-none z-40';
  sparkle.style.background = 'radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)';
  sparkle.style.animation = 'sparkle-burst 1s ease-out forwards';
  document.body.appendChild(sparkle);

  setTimeout(() => {
    document.body.removeChild(confettiContainer);
    if (document.body.contains(sparkle)) {
      document.body.removeChild(sparkle);
    }
  }, 4000);
};

// Create fireworks effect - Enhanced version  
const createFireworksEffect = () => {
  const fireworksContainer = document.createElement('div');
  fireworksContainer.className = 'fixed inset-0 pointer-events-none z-50';
  document.body.appendChild(fireworksContainer);

  // Çoklu patlamalar - DAHA FAZLA VE DAHA BÜYÜK
  for (let burst = 0; burst < 8; burst++) { // 5 → 8
    setTimeout(() => {
      // Rastgele pozisyon - DAHA MERKEZDE
      const centerX = Math.random() * (window.innerWidth - 400) + 200; // Daha merkezi
      const centerY = Math.random() * (window.innerHeight - 400) + 200; // Daha merkezi

      // Ana patlama - DAHA ÇOK PARÇACIK
      for (let i = 0; i < 30; i++) { // 20 → 30
        const firework = document.createElement('div');
        const colors = [
          '#FFD700', '#FF1493', '#00CED1', '#32CD32', 
          '#FF69B4', '#1E90FF', '#FFA500', '#DA70D6',
          '#FF6347', '#40E0D0', '#ADFF2F', '#FF4500'
        ];
        
        firework.className = 'firework-particle';
        firework.style.position = 'absolute';
        firework.style.width = `${Math.random() * 10 + 6}px`; // 3-9px → 6-16px
        firework.style.height = `${Math.random() * 10 + 6}px`; // DAHA BÜYÜK
        firework.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        firework.style.borderRadius = '50%';
        firework.style.left = `${centerX}px`;
        firework.style.top = `${centerY}px`;
        firework.style.boxShadow = `0 0 20px ${colors[Math.floor(Math.random() * colors.length)]}`; // 10px → 20px DAHA PARLI
        
        const angle = (i / 30) * 2 * Math.PI; // 20 → 30
        const distance = 120 + Math.random() * 200; // 80-200 → 120-320 DAHA UZAK
        const duration = 1.5 + Math.random() * 1; // 1-1.5s → 1.5-2.5s DAHA YAVAS
        
        firework.style.animation = `firework-burst ${duration}s ease-out forwards`;
        firework.style.setProperty('--end-x', `${Math.cos(angle) * distance}px`);
        firework.style.setProperty('--end-y', `${Math.sin(angle) * distance}px`);
        
        fireworksContainer.appendChild(firework);
      }

      // İkincil parçacıklar - DAHA ÇOK
      for (let j = 0; j < 25; j++) { // 15 → 25
        setTimeout(() => {
          const secondaryParticle = document.createElement('div');
          secondaryParticle.className = 'firework-secondary';
          secondaryParticle.style.position = 'absolute';
          secondaryParticle.style.width = '4px'; // 2px → 4px
          secondaryParticle.style.height = '4px'; // 2px → 4px
          secondaryParticle.style.backgroundColor = '#FFF';
          secondaryParticle.style.borderRadius = '50%';
          secondaryParticle.style.boxShadow = '0 0 10px #FFF'; // PARLAMA EKLE
          secondaryParticle.style.left = `${centerX + (Math.random() - 0.5) * 80}px`; // 40 → 80
          secondaryParticle.style.top = `${centerY + (Math.random() - 0.5) * 80}px`; // 40 → 80
          secondaryParticle.style.animation = 'secondary-sparkle 1.2s ease-out forwards'; // 0.8s → 1.2s
          
          fireworksContainer.appendChild(secondaryParticle);
        }, j * 30); // 50ms → 30ms DAHA HIZLI
      }
      
    }, burst * 300); // 400ms → 300ms DAHA SIKIŞIK
  }

  setTimeout(() => {
    document.body.removeChild(fireworksContainer);
  }, 4000); // 3000ms → 4000ms DAHA UZUN
};

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Get opponent info based on game mode with avatar
  const getOpponentInfo = () => {

    const realOpponent = participants.find(p => 
    !p.is_bot && 
    p.user_id !== user?.id && 
    p.user_id !== null
  );

  // Gerçek rakip varsa onun bilgilerini kullan
  if (realOpponent && (realOpponent as any).profiles) {
    return { 
      name: (realOpponent as any).profiles.username || 'Oyuncu', 
      icon: User, 
      avatar: (realOpponent as any).profiles.avatar_url 
    };
  }
    
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

  // GamePage.tsx'teki oyun sonu ekranını şu şekilde düzelt:

if (gameEnded) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 game-grid relative overflow-hidden">
      {/* Victory animations */}
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
      {winner === 'opponent' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="animate-[sadFace_2s_ease-in-out_infinite] text-9xl opacity-20">
            😢
          </div>
        </div>
      )}
      
      <Card className="w-full max-w-md text-center relative z-10">
        <CardContent className="p-6">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            {winner === 'player' && (
              <img 
                src="/sevinc.gif" 
                alt="Sevinç" 
                className="w-16 h-16 object-contain animate-bounce"
              />
            )}
            {winner === 'opponent' && (
              <img 
                src="/uzgun.gif" 
                alt="Üzgün" 
                className="w-16 h-16 object-contain"
              />
            )}
            {winner === 'tie' && (
              <img 
                src="/sabit.gif" 
                alt="Beraberlik" 
                className="w-16 h-16 object-contain"
              />
            )}
          </div>

          {/* Başlık */}
          <h2 className={`text-2xl font-bold mb-2 ${
            winner === 'player' ? 'text-yellow-600 animate-pulse' : 'text-gray-600'
          }`}>
            {gameMode === 'tournament' ? (
              winner === 'player' ? 'Maçı Kazandınız!' : 
              winner === 'opponent' ? 'Maçı Kaybettiniz!' : 'Beraberlik!'
            ) : (
              winner === 'player' ? 'Kazandınız!' :
              winner === 'opponent' ? 'Kaybettiniz!' : 'Beraberlik!'
            )}
          </h2>
          
          {/* Skorlar */}
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
          
          {/* Turnuva için otomatik yönlendirme mesajı */}
          {gameMode === 'tournament' && winner === 'player' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 text-sm font-medium">
                🏆 Turnuva eşleşme sayfasına yönlendiriliyorsunuz...
              </p>
              <div className="mt-2">
                <div className="animate-pulse text-yellow-600">
                  5 saniye içinde otomatik yönlendirme
                </div>
              </div>
            </div>
          )}
          
          {/* Butonlar - Sadece manuel durumlar için */}
          <div className="space-y-2">
            {gameMode === 'tournament' ? (
              <>
                {winner === 'opponent' && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      playSound('buttonClick');
                      navigate('/tournaments');
                    }} 
                    className="w-full"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Turnuva Listesi
                  </Button>
                )}
                {winner === 'player' && (
                  <Button 
  variant="outline"
  onClick={() => {
    console.log('🚀 Manuel yönlendirme yapılıyor...');
    // Önce tournamentMatch kontrol et
    if (tournamentMatch && tournamentMatch.tournament_id) {
      navigate(`/tournament/${tournamentMatch.tournament_id}`);
    } else {
      console.error('❌ Tournament ID bulunamadı');
      navigate('/tournaments'); // Fallback
    }
  }} 
  className="w-full"
>
  <Trophy className="w-4 h-4 mr-2" />
  Turnuva Sayfasına Git
</Button>
                )}
              </>
            ) : (
              // Normal mod butonları
              <>
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
                    // Oyunu resetle
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
                    timeLeftRef.current = gameType === 'timed' ? 120 : 0;
                    setDisplayTime(timeLeftRef.current);
                    setGameStarted(true);
                    setGameEnded(false);
                    setWinner(null);
                    setTimeWarningPlayed(false);
                    setJokers({ degistir: 3, fisilida: 3, senYaz: 3 });
                    setSelectedJoker(null);
                    setHighlightedLetters([]);
                    setIsJokerActive(false);
                  }} 
                  className="w-full"
                >
                  Tekrar Oyna
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tekrar oyun isteği dialog'u */}
      <AlertDialog open={!!currentRematchRequest} onOpenChange={() => setCurrentRematchRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🔄 Tekrar Oyun İsteği</AlertDialogTitle>
            <AlertDialogDescription>
              Rakibiniz tekrar oynamak istiyor. Kabul ediyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={async () => {
              if (currentRematchRequest) {
                await respondRematchRequest(currentRematchRequest.id, false);
              }
            }}>
              Hayır
            </AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (currentRematchRequest) {
                await respondRematchRequest(currentRematchRequest.id, true);
              }
            }}>
              Evet, Tekrar Oyna
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
            <p className="text-muted-foreground">
              İkinci oyuncuyu bekliyoruz...
            </p>
          
            {/* Mevcut katılımcıları göster - SADECE GERÇEK OYUNCULAR */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">
                Katılımcılar ({participants.filter(p => !p.is_bot && p.user_id !== null).length}/2)
              </p>
              {participants
                .filter(p => !p.is_bot && p.user_id !== null)
                .map((participant, index) => (
                <div key={participant.user_id} className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">
                    {participant.user_id === user?.id ? 'Siz' : 
                     (participant as any).profiles?.username || 'Oyuncu'}
                  </span>
                </div>
              ))}
            </div>
          
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
          
            {/* Debug bilgisi (development modunda) */}
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                <p>🏠 Oda: {currentRoom?.id?.slice(-8)}</p>
                <p>📊 Total: {participants.length} | Real: {participants.filter(p => !p.is_bot && p.user_id !== null).length}</p>
                {participants.map((p, i) => (
                  <p key={i}>
                    {i+1}. {p.is_bot ? '🤖 Bot' : '👤 Real'} {p.user_id?.slice(-8) || 'null'} 
                    {p.user_id === user?.id ? ' (SİZ)' : ''}
                  </p>
                ))}
              </div>
            )}
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted relative overflow-hidden"
         style={{ 
           paddingTop: 'env(safe-area-inset-top, 8px)', 
           paddingBottom: 'env(safe-area-inset-bottom, 8px)',
           paddingLeft: 'env(safe-area-inset-left, 4px)',
           paddingRight: 'env(safe-area-inset-right, 4px)'
         }}>
      <div className="h-full flex flex-col px-2">
        
        {/* Header - GÜNCELLENMIŞ */}
        <div className="flex items-center justify-between py-2 shrink-0">
          {/* Sol taraf - Geri butonu */}
          <Button 
             variant="outline" 
             size="sm" 
             className="text-xs px-2 py-1 h-8" 
             onClick={(e) => {
               console.log('🚪 Çıkış butonuna tıklandı - gameMode:', gameMode);
               e.preventDefault();
               e.stopPropagation();
              handleBackToMenu();
           }}
       >
            <ArrowLeft className="w-4 h-4 mr-2" />
          Çıkış
        </Button>

          {/* Orta kısım - Timer veya hedef + Turnuva bilgisi */}
          {gameType === 'timed' ? (
            <div className="flex flex-col items-center space-y-2">
              {/* 🏆 TURNUVA BİLGİSİ EKLENDİ */}
              {gameMode === 'tournament' && tournamentMatch && (
                <div className="text-xs text-yellow-600 font-medium mb-1">
                  {tournamentMatch.round === 1 ? 'Çeyrek Final' :
                   tournamentMatch.round === 2 ? 'Yarı Final' : 'Final'} - 
                  Maç {tournamentMatch.match_number}
                </div>
              )}
              
              <div className={`flex items-center space-x-2 transition-all duration-300 ${
                displayTime <= 15 ? 'animate-pulse text-red-500' : 'text-foreground'
              }`}>
                <span className={`text-lg transition-all duration-300 inline-block ${
                  displayTime <= 15 ? 'animate-pulse text-red-500' : ''
                }`} style={{
                  animation: displayTime <= 15 ? 'pulse 1s infinite, hourglassFlip 2s ease-in-out infinite' : 'hourglassFlip 4s ease-in-out infinite'
                }}>⏳</span>
                <span className={`font-mono text-lg font-bold transition-all duration-300 ${
                  displayTime <= 15 ? 'text-red-500 scale-110' : ''
                }`}>
                  {formatTime(displayTime)}
                </span>
              </div>
              <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-out ${
                    displayTime <= 15 ? 'bg-red-500 animate-pulse' :
                    displayTime <= 30 ? 'bg-orange-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${(displayTime / 120) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-1">
              {/* 🏆 TURNUVA BİLGİSİ EKLENDİ */}
              {gameMode === 'tournament' && tournamentMatch && (
                <div className="text-xs text-yellow-600 font-medium">
                  {tournamentMatch.round === 1 ? 'Çeyrek Final' :
                   tournamentMatch.round === 2 ? 'Yarı Final' : 'Final'} - 
                  Maç {tournamentMatch.match_number}
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4" />
                <span className="text-sm font-medium">500 Puana Kadar</span>
              </div>
            </div>
          )}

          {/* Sağ taraf - Rakip bilgisi */}
          <div className="w-16 text-right">
            {gameMode === 'tournament' && (
              <div className="text-xs text-muted-foreground">
                vs {getOpponentDisplayName()}
              </div>
            )}
          </div>
        </div>
        {/* Header bitiş */}

        {/* 🏆 TURNUVA UYARI KARTI EKLENDİ */}
        {gameMode === 'tournament' && (
          <div className="mb-4">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="p-3">
                <div className="flex items-center space-x-2">
                  <Trophy className="w-4 h-4 text-yellow-600" />
                  <span className="text-xs font-medium text-yellow-800">
                    Turnuva maçı! Kazanırsan sonraki tura geçeceksin.
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}


        {/* Scores */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="silver-gradient border border-gray-300 shadow-lg">
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
          <Card className="silver-gradient border border-gray-300 shadow-lg">
            <CardContent className="p-4 text-center relative overflow-hidden">
              <Avatar className="w-16 h-16 mx-auto mb-2 bg-transparent">
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

        {/* Joker Panel - EN ÖNEMLİ KISIM! */}
        <Card className="bg-gradient-to-r from-amber-50 to-orange-100 border-amber-200 shadow-md">
          <CardContent className="p-2">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-purple-800 mb-2">🎭 Jokerler</h3>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <Button
                variant={selectedJoker === 'degistir' ? 'default' : 'outline'}
                size="sm"
                className="joker-button flex flex-col items-center p-1 h-auto relative text-xs bg-gradient-to-br from-green-100 to-emerald-200 hover:from-green-200 hover:to-emerald-300 border-green-300"
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  useDegisTirJoker();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  useDegisTirJoker();
                }}
                disabled={jokers.degistir <= 0 || isJokerActive}
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <Shuffle className="w-3 h-3 mb-0.5" />
                <span className="text-xs">Değiştir</span>
                <Badge variant="secondary" className="joker-badge absolute -top-1 -right-1 text-xs min-w-5 h-5 flex items-center justify-center">
                  {jokers.degistir}
                </Badge>
              </Button>

              <Button
                variant={selectedJoker === 'fisilida' ? 'default' : 'outline'}
                size="sm"
                className="joker-button flex flex-col items-center p-1 h-auto relative text-xs bg-gradient-to-br from-blue-100 to-cyan-200 hover:from-blue-200 hover:to-cyan-300 border-blue-300"
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  useFisildaJoker();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  useFisildaJoker();
                }}
                disabled={jokers.fisilida <= 0 || isJokerActive}
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <Lightbulb className="w-4 h-4 mb-1" />
                <span className="text-xs">Fısılda</span>
                <Badge variant="secondary" className="joker-badge absolute -top-1 -right-1 text-xs min-w-5 h-5 flex items-center justify-center">
                  {jokers.fisilida}
                </Badge>
              </Button>

              <Button
                variant={selectedJoker === 'senYaz' ? 'default' : 'outline'}
                size="sm"
                className="joker-button flex flex-col items-center p-1 h-auto relative text-xs bg-gradient-to-br from-purple-100 to-violet-200 hover:from-purple-200 hover:to-violet-300 border-purple-300"
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  useSenYazJoker();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  useSenYazJoker();
                }}
                disabled={jokers.senYaz <= 0 || isJokerActive}
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <PenTool className="w-4 h-4 mb-1" />
                <span className="text-xs">Sen Yaz</span>
                <Badge variant="secondary" className="joker-badge absolute -top-1 -right-1 text-xs min-w-5 h-5 flex items-center justify-center">
                  {jokers.senYaz}
                </Badge>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Current Word Input */}
        <Card className="game-grid border-0">
          <CardContent className="p-2">
            <div className="flex items-center space-x-2">
              <Input 
                value={currentWord} 
                readOnly 
                placeholder="~Kelime Üret~"
                className={`text-lg font-mono text-center bg-white/20 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70 font-bold h-8 ${
                  isJokerActive ? 'typing-animation' : ''
                }`}
              />
              <Badge variant="secondary" className="bg-white/20 text-white text-sm px-2 py-0.5 min-w-8 h-8 flex items-center justify-center">
                {currentWord.length}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Game Grid */}
        <Card className="game-grid border-0 mb-2 flex-1">
          <CardContent className="p-3 h-full flex items-center justify-center">
            <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
              {gameGrid.map((row, rowIndex) =>
                row.map((letter, colIndex) => {
                  const isSelected = selectedLetters.some(s => s.row === rowIndex && s.col === colIndex);
                  const isHighlighted = highlightedLetters.some(h => h.row === rowIndex && h.col === colIndex);
                  const selectionOrder = selectedLetters.findIndex(s => s.row === rowIndex && s.col === colIndex);
                  return (
                    <Button
                      key={`${rowIndex}-${colIndex}`}
                      className={`letter-button h-12 text-lg font-bold relative transition-all duration-300 ${
                        isSelected ? 'selected' : ''
                      } ${
                        isHighlighted ? 'letter-glow-highlight' : ''
                      }`}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLetterClick(letter, rowIndex, colIndex);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLetterClick(letter, rowIndex, colIndex);
                      }}
                      style={{
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        WebkitTouchCallout: 'none',
                        WebkitUserSelect: 'none',
                        userSelect: 'none'
                      }}
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
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <Button 
            variant="outline" 
            onTouchStart={(e) => {
              e.preventDefault();
              clearWord();
            }}
            onClick={(e) => {
              e.preventDefault();
              clearWord();
            }}
            className="h-12"
            disabled={selectedLetters.length === 0 || isJokerActive}
            style={{ touchAction: 'manipulation' }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Sil
          </Button>
          
          <Button 
            onTouchStart={(e) => {
              e.preventDefault();
              playSound('buttonClick');
              submitWord();
            }}
            onClick={(e) => {
              e.preventDefault();
              playSound('buttonClick');
              submitWord();
            }}
            className="h-12"
            disabled={currentWord.length < 3 || isValidating || isJokerActive}
            style={{ touchAction: 'manipulation' }}
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
          <AlertDialogTitle className="text-center">⚠️ Aktif Oyun Uyarısı</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Şu an aktif bir oyun oynuyorsun! 
            <br /><br />
            Oyundan çıkarsan <span className="font-bold text-destructive">ceza alacaksın</span> ve rakibin kazanacak.
            <br /><br />
            <span className="text-muted-foreground text-sm">Emin misin?</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col space-y-2 sm:flex-col sm:space-y-2 sm:space-x-0">
          <AlertDialogAction 
            onClick={async () => {
              setShowExitDialog(false);
              if (currentRoom) {
                await leaveRoom();
              }
              navigate('/');
            }}
            className="w-full bg-destructive hover:bg-destructive/90"
          >
            🚪 Evet, Çıkış Yap
          </AlertDialogAction>
          <AlertDialogCancel className="w-full">
            🎮 Hayır, Oyuna Devam Et
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Tournament Exit Dialog */}
    <AlertDialog open={showTournamentExitDialog} onOpenChange={setShowTournamentExitDialog}>
      <AlertDialogContent className="max-w-sm mx-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-center">⚠️ Turnuva Maçı Uyarısı</AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Turnuva maçından ayrılırsan:
            <br /><br />
            • <span className="font-bold text-destructive">Maçı kaybedersin</span>
            <br />
            • <span className="font-bold text-yellow-600">Rakip kazanır</span>
            <br />
            • <span className="font-bold text-blue-600">Turnuvadan elenirsin</span>
            <br /><br />
            <span className="text-muted-foreground text-sm">Emin misin?</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col space-y-2 sm:flex-col sm:space-y-2 sm:space-x-0">
          <AlertDialogAction 
            onClick={async () => {
              setShowTournamentExitDialog(false);
              await handleTournamentExit();
    // navigate('/'); satırını kaldır - handleTournamentExit içinde zaten parent'e bildirim yapılıyor
           }}
            className="w-full bg-destructive hover:bg-destructive/90"
           >
         Evet, Ayrıl
       </AlertDialogAction>
          <AlertDialogCancel className="w-full">
            🏆 Hayır, Maça Devam Et
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Tekrar oyun isteği dialog'u - BURAYA DA EKLE */}
    <AlertDialog open={!!currentRematchRequest} onOpenChange={() => setCurrentRematchRequest(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>🔄 Tekrar Oyun İsteği</AlertDialogTitle>
          <AlertDialogDescription>
            Rakibiniz tekrar oynamak istiyor. Kabul ediyor musunuz?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={async () => {
            if (currentRematchRequest) {
              await respondRematchRequest(currentRematchRequest.id, false);
            }
          }}>
            Hayır
          </AlertDialogCancel>
          <AlertDialogAction onClick={async () => {
            if (currentRematchRequest) {
              await respondRematchRequest(currentRematchRequest.id, true);
            }
          }}>
            Evet, Tekrar Oyna
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);
}
export default GamePage;