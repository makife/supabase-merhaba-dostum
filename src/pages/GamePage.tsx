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
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useGame } from '@/contexts/GameContext';
import { useMusic } from '@/contexts/MusicContext';
import { useWordValidation } from '@/hooks/useWordValidation';
import { useSounds } from '@/hooks/useSounds';
import { useJokerInventory } from '@/hooks/useJokerInventory';
import { useUserPurchases } from '@/hooks/useUserPurchases';
import { useNativeGameplay } from '@/hooks/useNativeGameplay';
import { supabase } from '@/integrations/supabase/client';
import GameCountdown from '@/components/GameCountdown';
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
  PenTool,
  Loader2
} from 'lucide-react';
import { generateBotName } from '@/utils/tournamentHelpers';

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
  tournamentMatch: propTournamentMatch,
  gameType: propGameType,
  participants: propsParticipants = []
}: GamePageProps) => {

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  
  const { user } = useAuth();
  const { consumeCredit, isPremium, addBonusCredits, forceRefreshProfile, profile } = useUser();
  const { hasPurchased, settings } = useUserPurchases();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentRoom, updateScore, participants: gameParticipants, endGame, leaveRoom, sendRematchRequest, respondRematchRequest, currentRematchRequest, setCurrentRematchRequest, joinRoom, createRoom, addAIOpponent } = useGame();
  const { triggerHapticFeedback, optimizeTouchEvent, isNative } = useNativeGameplay();
  
  // Tournament match bilgisini URL'den al
  const [tournamentMatch, setTournamentMatch] = useState(propTournamentMatch || null);
  
  // Tournament participant state
  const [tournamentParticipants, setTournamentParticipants] = useState<any[]>([]);
  
  const participants = useMemo(() => {
    if (gameMode === 'tournament') {
      const tournamentParts = propsParticipants?.length > 0 ? propsParticipants : tournamentParticipants;
      return tournamentParts || [];
    }
    
    return gameParticipants || [];
  }, [gameMode, propsParticipants, gameParticipants, tournamentParticipants]);
  
  const { validateWord, isValidating } = useWordValidation();
  const { playSound, playTimeWarningSequence, playCelebrationSound, playGameLoseSound, playSpecialSound } = useSounds();
  const { jokers: jokerInventory, useJoker, loadJokers } = useJokerInventory();
  const { fadeOutBackgroundMusic, fadeInBackgroundMusic } = useMusic();
  const [searchParams] = useSearchParams();
  const [lastClickTime, setLastClickTime] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const cleanupRef = useRef<(() => void)[]>([]);
  const syncingRef = useRef(false);
  const submissionLockRef = useRef(false);
  const timerStartedRef = useRef(false);
  const recentSubmissionsRef = useRef<Set<string>>(new Set());
  const randomMatchInitRef = useRef(false);
  const privateRoomInitRef = useRef(false);
  const serverMatchStartRef = useRef<number | null>(null);
  const syncSuppressUntilRef = useRef<number>(0);
  const countdownCompletedAtRef = useRef<number | null>(null);
  // Touch/click double-fire koruması: Gönder butonu için son touch zaman damgası
  const submitTouchTsRef = useRef(0);
  
  const [globalUsedWords, setGlobalUsedWords] = useState<Set<string>>(new Set());

  const addCleanup = useCallback((cleanupFn: () => void) => {
  cleanupRef.current.push(cleanupFn);
}, []);
  
  // Joker state'leri artık envanter hook'undan geliyor
  const jokers = jokerInventory;
  const [selectedJoker, setSelectedJoker] = useState<string | null>(null);
  const [highlightedLetters, setHighlightedLetters] = useState<{row: number, col: number}[]>([]);
  const [isJokerActive, setIsJokerActive] = useState(false);
  
  // Wordlist for local validation
  const [wordlist, setWordlist] = useState<Set<string>>(new Set());
  const [wordlistLoaded, setWordlistLoaded] = useState(false);
  
  // Get game type from room or URL params - DÜZELTME
const getGameType = useCallback((): 'timed' | 'score' => {
  // TURNUVA MODU HER ZAMAN SÜRELİ!
  if (gameMode === 'tournament') {
    console.log('🏆 Tournament mode: FORCED to timed');
    return 'timed';
  }
  
  if (gameMode === 'vs-computer') {
    const urlType = (searchParams.get('type') as 'timed' | 'score') || 'timed';
    console.log('🤖 vs-computer mode type:', urlType);
    return urlType;
  }
  
  // RANDOM MATCH için öncelikle matchmaking room datasını kontrol et
  if (gameMode === 'random-match') {
    // URL'den gelen type parametresini kontrol et (matchmaking'den gelir)
    const urlType = searchParams.get('type') as 'timed' | 'score';
    if (urlType) {
      console.log('🎯 Random match URL type:', urlType);
      return urlType;
    }
    
    // Fallback: Room datasından çıkar
    if (currentRoom?.time_limit && currentRoom.time_limit > 0) {
      console.log('⏱️ Room timed mode detected');
      return 'timed';
    }
    if (currentRoom?.max_score && currentRoom.max_score > 0) {
      console.log('🎯 Room score mode detected');
      return 'score';
    }
  }
  
  // Diğer modlar için mevcut mantık
  if (currentRoom?.game_mode) {
    if (currentRoom.game_mode.includes('score')) return 'score';
    else return 'timed';
  }
  
  const urlType = (searchParams.get('type') as 'timed' | 'score') || 'timed';
  console.log('🔧 Fallback type:', urlType);
  return urlType;
}, [gameMode, currentRoom?.game_mode, currentRoom?.time_limit, currentRoom?.max_score, searchParams]);
  
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
  // Turnuva modunda grid sadece ortak seed ile oluşturulur
  if (gameMode === 'tournament') {
    if (tournamentMatch?.id) {
      console.log('🎯 Turnuva grid - match ID seed kullanılıyor:', tournamentMatch.id);
      return generateTournamentGrid(tournamentMatch.id);
    }
    // Match bilgisi gelene kadar placeholder grid (farklı grid oluşmasını engeller)
    return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ''));
  }
  
  // ÖZEL ODA VE RANDOM MATCH: HEMEN PLACEHOLDER GRID KULLAN
  // Supabase'den senkronize edilecek
  if (gameMode === 'random-match' || gameMode === 'private-room') {
    console.log('🎲 Private/Random room: Waiting for server grid...');
    return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ''));
  }
  
  // Sadece vs-computer modunda random grid
  console.log('🤖 vs-computer: Generating random grid');
  return generateRandomGrid();
});

// Turnuva maçı yüklendiğinde grid'i senkronize et
useEffect(() => {
  if (gameMode === 'tournament' && tournamentMatch?.id) {
    setGameGrid(generateTournamentGrid(tournamentMatch.id));
  }
}, [gameMode, tournamentMatch?.id, generateTournamentGrid]);

// Random/private odalarda sunucu grid'ini senkronize et (SADECE BAŞLANGICTA)
const initialGridSyncRef = useRef(false);
useEffect(() => {
  if (gameMode === 'tournament') return;
  if (gameMode !== 'random-match' && gameMode !== 'private-room') return;
  if (!currentRoom?.current_grid) {
    console.log('⏳ Waiting for room grid data...');
    return;
  }
  
  // Sadece ilk kez grid senkronize et - joker kullanımından sonra tekrar senkronize etme
  if (initialGridSyncRef.current) return;
  
  const flat = currentRoom.current_grid as string[];
  const grid: string[][] = [];
  for (let i = 0; i < 4; i++) {
    grid.push(flat.slice(i * 4, (i + 1) * 4));
  }
  
  console.log('🎲 Grid senkronize edildi:', {
    mode: gameMode,
    roomId: currentRoom.id,
    gridPreview: grid[0]
  });
  
  setGameGrid(grid);
  initialGridSyncRef.current = true;
}, [gameMode, currentRoom?.id, currentRoom?.current_grid]);
  
  const [selectedLetters, setSelectedLetters] = useState<{letter: string, row: number, col: number}[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [playerWords, setPlayerWords] = useState<string[]>([]);
  const [opponentWords, setOpponentWords] = useState<string[]>([]);
  const [playerWordsWithScores, setPlayerWordsWithScores] = useState<Array<{word: string, score: number}>>([]);
  const [opponentWordsWithScores, setOpponentWordsWithScores] = useState<Array<{word: string, score: number}>>([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const playerScoreRef = useRef(0);
  const opponentScoreRef = useRef(0);
  useEffect(() => { playerScoreRef.current = playerScore; }, [playerScore]);
  useEffect(() => { opponentScoreRef.current = opponentScore; }, [opponentScore]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeLeftRef = useRef<number>(gameType === 'timed' ? 120 : 0);
  const [displayTime, setDisplayTime] = useState<number>(timeLeftRef.current);
  const [showCountdown, setShowCountdown] = useState(true);
  const [countdownServerTime, setCountdownServerTime] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [waitingForPlayer, setWaitingForPlayer] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const statsUpdatedRef = useRef(false);

  // Reset duplicate stats guard when game resets
  useEffect(() => {
    if (!gameEnded) {
      statsUpdatedRef.current = false;
    }
  }, [gameEnded]);
  const [winner, setWinner] = useState<'player' | 'opponent' | 'tie' | null>(null);
  const [disconnectWin, setDisconnectWin] = useState(false);
  const [playerAvatar, setPlayerAvatar] = useState<string>('');
  const [opponentAvatar, setOpponentAvatar] = useState<string>('');
  const [hasShownStartMessage, setHasShownStartMessage] = useState(false);
  const [lastPlayerAction, setLastPlayerAction] = useState<number>(0);
  const [matchmakingTimeout, setMatchmakingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [timeoutCountdown, setTimeoutCountdown] = useState(30);
  const [showResults, setShowResults] = useState(false);
  
  // Rakip ayrıldığında sonuç kartını göster (turnuvada devre dışı)
  useEffect(() => {
    if (gameMode === 'tournament') return; // Turnuva modunda disconnect ile kazanım gösterme!

    const handler = async (e: any) => {
      const evtRoomId = e?.detail?.roomId;
      if (!evtRoomId || evtRoomId !== currentRoom?.id) {
        console.log('🚫 Farklı odaya ait disconnect eventi yok sayıldı', { evtRoomId, current: currentRoom?.id });
        return;
      }
      console.log('🚪 Rakip oyundan ayrıldı eventi alındı');
      setDisconnectWin(true);
      setWinner('player');
      setGameEnded(true);
      setShowResults(true);
      
      // Oyunu durduran işlemleri
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      toast({
        title: 'Rakip oyundan ayrıldı',
        description: 'Maçı kazandınız! 🎉',
        duration: 3000,
      });
      
      // Çok erken kopan eşleşmelerde hak iadesi (premium değilse)
      try {
        if (!isPremium) {
          const earlyDc = Date.now() - gameStartTime < 15000; // 15s altında
          const noPlay = playerWordsWithScores.length === 0 && opponentWordsWithScores.length === 0;
          if (earlyDc || noPlay) {
            await addBonusCredits(1);
            toast({
              title: '🎟 Hak iade edildi',
              description: 'Eşleşme hemen koptuğu için oyun hakkınız iade edildi.',
              duration: 2500,
            });
          }
        }
      } catch (err) {
        console.log('Credit refund skipped/failed:', err);
      }
      
      // Ses efekti çal
      playSound('gameWin');
      setTimeout(() => playCelebrationSound(), 500);
    };

    window.addEventListener('playerDisconnected', handler as EventListener);
    return () => window.removeEventListener('playerDisconnected', handler as EventListener);
  }, [gameMode, playSound, playCelebrationSound, toast, currentRoom?.id, isPremium, playerWordsWithScores.length, opponentWordsWithScores.length, addBonusCredits]);

  // Fallback: Katılımcı azalınca disconnect'i yakala ve oyunu bitir
  const disconnectHandledRef = useRef(false);
  const gameHasStartedRef = useRef(false);
  
  useEffect(() => {
    // Oyun gerçekten başladıktan sonra disconnect kontrolü yap
    // REMATCH SIRASINDA DISCONNECT KONTROL ETMEYİN!
    if (disconnectHandledRef.current || waitingForRematchResponse || rematchRequested) {
      return;
    }
    
    if ((gameMode === 'private-room' || gameMode === 'random-match') && 
        gameStarted && !gameEnded && 
        gameHasStartedRef.current && // Oyun gerçekten başlamış olmalı
        participants.length > 0) { // En az bir kez participants yüklenmiş olmalı
      
      const realPlayers = participants.filter(p => !p.is_bot);
      const amIStillParticipant = participants.some(p => p.user_id === user?.id);
      if (realPlayers.length < 2 && amIStillParticipant && !disconnectHandledRef.current) {
        console.log('🚪 Fallback disconnect detected - ending game (current user still in room)');
        disconnectHandledRef.current = true;
        window.dispatchEvent(new CustomEvent('playerDisconnected', {
          detail: { winner: 'player', reason: 'opponent_left_fallback', roomId: currentRoom?.id }
        }));
      }
    }
  }, [participants.length, gameMode, gameStarted, gameEnded, user?.id]);

  // Oyunun gerçekten başladığını işaretle (participants yüklendikten sonra)
  useEffect(() => {
    if ((gameMode === 'private-room' || gameMode === 'random-match') && 
        participants.length >= 2 && gameStarted && !gameEnded) {
      console.log('🎮 Game truly started with participants:', participants.length);
      gameHasStartedRef.current = true;
    }
  }, [participants.length, gameMode, gameStarted, gameEnded]);

  useEffect(() => {
    // Oda değiştiğinde fallback bayrağını sıfırla
    disconnectHandledRef.current = false;
    gameHasStartedRef.current = false;
  }, [currentRoom?.id]);
  
  const [isAIOpponent, setIsAIOpponent] = useState(false);
  const [opponentName, setOpponentName] = useState('');
  const [targetScore, setTargetScore] = useState(gameType === 'score' ? 500 : 0);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const [rematchRequested, setRematchRequested] = useState(false);
  const [waitingForRematchResponse, setWaitingForRematchResponse] = useState(false);
  const [finalPlayerScore, setFinalPlayerScore] = useState(0);
  const [finalOpponentScore, setFinalOpponentScore] = useState(0);

  
const handleTournamentGameEnd = async (userScore: number, opponentScore: number) => {
  if (!user || !tournamentMatch) return;

  try {
    // Kullanıcının hangi oyuncu olduğunu belirle
    const isPlayer1 = String(tournamentMatch.player1_id) === String(user.id);
    const opponentId = isPlayer1 ? tournamentMatch.player2_id : tournamentMatch.player1_id;
    
    // BERABERLİK DURUMUNDA: Rastgele kazanan belirle ve ona 1 puan ekle
    let finalUserScore = userScore;
    let finalOpponentScore = opponentScore;
    let winnerId: string;
    
    if (userScore === opponentScore) {
      console.log('⚖️ BERABERLIK! Rastgele kazanan belirleniyor...');
      const userWinsOnTie = Math.random() < 0.5;
      if (userWinsOnTie) {
        finalUserScore += 1;
        winnerId = user.id;
        console.log('✅ Kullanıcı beraberliği kazandı (+1 puan)');
      } else {
        finalOpponentScore += 1;
        winnerId = opponentId as string;
        console.log('❌ Rakip beraberliği kazandı (+1 puan)');
      }
    } else {
      winnerId = userScore > opponentScore ? user.id : opponentId as string;
    }
    
    // Skorları doğru oyunculara ata
    const player1Score = isPlayer1 ? finalUserScore : finalOpponentScore;
    const player2Score = isPlayer1 ? finalOpponentScore : finalUserScore;
    
    console.log('🏆 Tournament match completion:', {
      matchId: tournamentMatch.id,
      user: user.id,
      isPlayer1,
      player1Score,
      player2Score,
      winnerId,
      originalUserScore: userScore,
      originalOpponentScore: opponentScore,
      finalUserScore,
      finalOpponentScore,
      wasTie: userScore === opponentScore
    });
    
    // ✅ Bu maçı tamamlanmış olarak işaretle (tekrar oynamayı engelle)
    const completedMatchKey = `tournament_match_completed_${tournamentMatch.id}`;
    localStorage.setItem(completedMatchKey, JSON.stringify({
      matchId: tournamentMatch.id,
      tournamentId: tournamentMatch.tournament_id,
      completedAt: new Date().toISOString(),
      winner: winnerId
    }));
    
    // ✅ Frontend state'ini GÜNCEL skorlarla güncelle
    setPlayerScore(finalUserScore);
    setOpponentScore(finalOpponentScore);
    setGameEnded(true);
    setShowResults(true);
    
    // ✅ Frontend kazanan belirleme - DOĞRU MANTIK
    console.log('🎯 Tournament winner determination:', {
      finalUserScore,
      finalOpponentScore,
      winnerId,
      userIsWinner: winnerId === user.id
    });
    
    if (winnerId === user.id) {
      setWinner('player');
      playSound('gameWin');
      setTimeout(() => playCelebrationSound(), 500);
      console.log('✅ User WINS - Setting winner to player');
    } else {
      setWinner('opponent');  
      playSound('gameLose');
      setTimeout(() => playGameLoseSound(), 500);
      console.log('❌ User LOSES - Setting winner to opponent');
    }
    
    // Mevcut maçı tamamla
    await supabase
      .from('tournament_matches')
      .update({
        status: 'completed',
        player1_score: player1Score,
        player2_score: player2Score,
        winner_id: winnerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', tournamentMatch.id);

    console.log('✅ Turnuva maçı tamamlandı');

    // Aynı turdaki TÜM maçları kontrol et
    const { data: allRoundMatches } = await supabase
      .from('tournament_matches')
      .select('id, status')
      .eq('tournament_id', tournamentMatch.tournament_id)
      .eq('round', tournamentMatch.round);

    console.log(`🔍 ${tournamentMatch.round}. turdaki toplam maç sayısı:`, allRoundMatches?.length);

    const allMatchesCompleted = allRoundMatches?.every(match => 
      match.status === 'completed'
    );

    if (allMatchesCompleted) {
      console.log(`🏆 Tüm ${tournamentMatch.round}. tur maçları tamamlandı!`);
      
      // Sonraki turu oluştur YALNIZCA final değilse
      if (tournamentMatch.round < 3) {
        await createNextRoundMatches(
          tournamentMatch.tournament_id, 
          tournamentMatch.round + 1
        );
      } else {
        // Final tamamlandı -> turnuvayı bitir
        await supabase
          .from('tournaments')
          .update({ status: 'completed', finished_at: new Date().toISOString() })
          .eq('id', tournamentMatch.tournament_id);
      }
      
      // Turnuva sayfasına yönlendir
      setTimeout(() => {
        navigate(`/tournament-bracket/${tournamentMatch.tournament_id}`);
      }, 3000);
    } else {
      console.log(`⏳ Diğer maçlar devam ediyor. Tamamlanan: ${allRoundMatches?.filter(m => m.status === 'completed').length}/${allRoundMatches?.length}`);
      
      // Kaybeden oyuncu ana turnuva sayfasına, kazanan bracket sayfasına yönlendir
      const redirectDelay = userScore > opponentScore ? 3000 : 2000;
      const redirectPath = userScore > opponentScore 
        ? `/tournament-bracket/${tournamentMatch.tournament_id}`
        : '/tournament';
      
      setTimeout(() => {
        navigate(redirectPath);
      }, redirectDelay);
    }

  } catch (error) {
    console.error('Turnuva maç bitiş hatası:', error);
  }
};

const requestRematch = async () => {
  if (!user) return;
  
  try {
    // Disconnect logic'i geçici olarak devre dışı bırak
    disconnectHandledRef.current = true;
    
    setRematchRequested(true);
    setWaitingForRematchResponse(true);
    
    // Rematch request gönder
    await sendRematchRequest(currentRoom?.room_code || generateRoomCode(), gameType);
    
    // 30 saniye timeout
    setTimeout(() => {
      if (waitingForRematchResponse) {
        setWaitingForRematchResponse(false);
        setRematchRequested(false);
        disconnectHandledRef.current = false; // Timeout'ta tekrar aktif et
        toast({
          title: 'Süre Doldu',
          description: 'Rakibiniz yanıt vermedi.',
          variant: 'destructive',
        });
      }
    }, 30000);
    
  } catch (error) {
    console.error('Rematch request error:', error);
    setRematchRequested(false);
    setWaitingForRematchResponse(false);
    disconnectHandledRef.current = false; // Hata durumunda da tekrar aktif et
    toast({
      title: 'Hata',
      description: 'Tekrar oyun isteği gönderilemedi.',
      variant: 'destructive',
    });
  }
};

// 4. resetGameForRematch fonksiyonunu ekleyin:
const resetGameForRematch = () => {
  // Grid sync'i yeniden aktifleştir yeni oyun için
  initialGridSyncRef.current = false;
  disconnectHandledRef.current = false; // Disconnect kontrolü de yeniden aktif et
  
  // Oyunu sıfırla
  setGameGrid(generateRandomGrid());
  setSelectedLetters([]);
  setCurrentWord('');
  setUsedWords(new Set());
  setGlobalUsedWords(new Set());
  setPlayerWords([]);
  setOpponentWords([]);
  setPlayerWordsWithScores([]);
  setOpponentWordsWithScores([]);
  setPlayerScore(0);
  setOpponentScore(0);
  timeLeftRef.current = gameType === 'timed' ? 120 : 0;
  setDisplayTime(timeLeftRef.current);
  setShowCountdown(true);
  setGameStarted(false);
  setGameEnded(false);
  setWinner(null);
  setTimeWarningPlayed(false);
  setRematchRequested(false);
  setWaitingForRematchResponse(false);
  setFinalPlayerScore(0);
  setFinalOpponentScore(0);
  // Joker state'leri artık hook'tan geldiği için sıfırlama yok
  setSelectedJoker(null);
  setHighlightedLetters([]);
  setIsJokerActive(false);
  
  // Room'daki used words'ü temizle
  if (currentRoom) {
    supabase
      .from('game_words')
      .delete()
      .eq('room_id', currentRoom.id);
  }
};
  
const createNextRoundMatches = async (tournamentId: string, nextRound: number) => {
  try {
    console.log(`🏆 ${nextRound}. tur maçları oluşturuluyor...`);

    // Eğer bu tur için maçlar zaten oluşturulduysa tekrar oluşturma
    const { data: existing } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('round', nextRound);

    if (existing && existing.length > 0) {
      console.log(`⏭️ ${nextRound}. tur için ${existing.length} maç zaten var, oluşturma atlandı.`);
      return;
    }
    
    // Önceki turun kazananlarını al
    const { data: winners } = await supabase
      .from('tournament_matches')
      .select('winner_id')
      .eq('tournament_id', tournamentId)
      .eq('round', nextRound - 1)
      .eq('status', 'completed')
      .not('winner_id', 'is', null);

    if (!winners || winners.length === 0) {
      console.error('Kazanan bulunamadı');
      return;
    }

    // Kazananları karıştır
    const winnerIds = winners.map(w => w.winner_id);
    const shuffledWinners = [...winnerIds].sort(() => Math.random() - 0.5);
    
    // Yeni tur maçlarını oluştur
    const newMatches = [];
    for (let i = 0; i < shuffledWinners.length / 2; i++) {
      const player1Id = shuffledWinners[i * 2];
      const player2Id = shuffledWinners[i * 2 + 1];

      newMatches.push({
        tournament_id: tournamentId,
        round: nextRound,
        match_number: i + 1,
        player1_id: player1Id,
        player2_id: player2Id,
        status: 'pending',
        created_at: new Date().toISOString()
      });
    }

    // Database'e kaydet
    const { error } = await supabase
      .from('tournament_matches')
      .insert(newMatches);

    if (error) {
      console.error('Yeni tur maçları kaydedilemedi:', error);
      return;
    }

    console.log(`✅ ${nextRound}. tur için ${newMatches.length} maç oluşturuldu`);
    
    // Turnuva bilgisini güncelle
    await supabase
      .from('tournaments')
      .update({ 
        current_round: nextRound,
        updated_at: new Date().toISOString()
      })
      .eq('id', tournamentId);
    
  } catch (error) {
    console.error('createNextRoundMatches hatası:', error);
  }
};

const checkNextRoundCreation = async (tournamentId: string) => {
  try {
    // Bu turdaki tüm maçlar bitti mi kontrol et
    const { data: remainingMatches } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('status', 'pending')
      .limit(1);

    if (remainingMatches && remainingMatches.length === 0) {
      console.log('🏆 Turdaki tüm maçlar bitti, sonraki tur oluşturuluyor...');
      
      // Kazananları al
      const { data: winners } = await supabase
        .from('tournament_matches')
        .select('winner_id, round')
        .eq('tournament_id', tournamentId)
        .eq('status', 'completed')
        .order('round', { ascending: false });

      if (winners && winners.length > 1) {
        const currentRound = Math.max(...winners.map(w => w.round));
        const nextRound = currentRound + 1;
        
        if (nextRound <= 3) { // Final'e kadar
          await createNextRoundMatches(tournamentId, nextRound);
        }
      }
    }
  } catch (error) {
    console.error('Sonraki tur kontrol hatası:', error);
  }
};

const checkAndCreateNextRound = async (tournamentId: string) => {
  try {
    // Mevcut turdaki tüm maçlar tamamlandı mı?
    const { data: incompleteMatches } = await supabase
      .from('tournament_matches')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('status', 'pending')
      .limit(1);

    if (incompleteMatches.length === 0) {
      // Bir sonraki turu başlat
      const { data: currentRound } = await supabase
        .from('tournament_matches')
        .select('round')
        .eq('tournament_id', tournamentId)
        .order('round', { ascending: false })
        .limit(1);

      const nextRound = currentRound[0].round + 1;
      
      if (nextRound <= 3) { // Finale kadar
        await createTournamentMatches(tournamentId, nextRound);
      } else {
        // Turnuvayı tamamla
        await supabase
          .from('tournaments')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', tournamentId);
      }
    }
  } catch (error) {
    console.error('Sonraki tur kontrol hatası:', error);
  }
};



const createTournamentMatches = async (tournamentId: string, round: number) => {
  try {
    // Katılımcıları al
    const { data: participants } = await supabase
      .from('tournament_participants')
      .select('user_id')
      .eq('tournament_id', tournamentId);

    if (!participants) return;

    // Rastgele sırala
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const matchCount = shuffled.length / 2;

    // Maçları oluştur
    for (let i = 0; i < matchCount; i++) {
      await supabase
        .from('tournament_matches')
        .insert({
          tournament_id: tournamentId,
          round: round,
          match_number: i + 1,
          player1_id: shuffled[i * 2].user_id,
          player2_id: shuffled[i * 2 + 1].user_id,
          status: 'pending'
        } as any);
    }
  } catch (error) {
    console.error('Maç oluşturma hatası:', error);
  }
};

const completeBotMatches = async (tournamentId: string, round: number) => {
  try {
    console.log(`Bot maçları tamamlanıyor - Round ${round}`);
    
    const { data: botMatches } = await supabase
      .from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('round', round)
      .eq('status', 'pending');

    for (const match of botMatches || []) {
      const isUserMatch = match.player1_id === user?.id || match.player2_id === user?.id;
      
      if (!isUserMatch) {
        const winner = Math.random() > 0.5 ? match.player1_id : match.player2_id;
        const winnerScore = Math.floor(Math.random() * 20) + 25; // 25-45
        const loserScore = Math.floor(Math.random() * 15) + 10;  // 10-25
        
        await supabase
          .from('tournament_matches')
          .update({
            status: 'completed',
            winner_id: winner,
            player1_score: winner === match.player1_id ? winnerScore : loserScore,
            player2_score: winner === match.player2_id ? winnerScore : loserScore,
            updated_at: new Date().toISOString()
          })
          .eq('id', match.id);
        
        console.log(`Bot maçı tamamlandı: ${match.id}`);
      }
    }
    
    console.log(`Round ${round} bot maçları tamamlandı`);
  } catch (error) {
    console.error('Bot maçları tamamlama hatası:', error);
  }
};
  
// YENİ FONKSİYON: Turnuva bitiş kartını göster
const showTournamentEndCard = async (isWinner: boolean, userScore: number, opponentScore: number, tournamentId: string) => {
  try {
    // Mevcut turu ve durumu kontrol et
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('current_round, status')
      .eq('id', tournamentId)
      .single();

    if (!tournament) {
      navigate('/tournament');
      return;
    }

    let message = '';
    let buttonText = 'Turnuva Sayfasına Dön';

    if (isWinner) {
      if (tournament.current_round === 1) {
        message = '🎉 Tebrikler! Yarı finale çıkmaya hak kazandınız.';
      } else if (tournament.current_round === 2) {
        message = '🔥 Muhteşem! Finale hak kazandınız.';
      } else if (tournament.current_round === 3) {
        message = '👑 Tebrikler! TURNUVA ŞAMPİYONU OLDUNUZ!';
        buttonText = 'Ana Sayfaya Dön';
      }
    } else {
      message = '😢 Maalesef elendiniz.';
    }

    // Custom modal/toast göster
    const modalDiv = document.createElement('div');
    modalDiv.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4';
    modalDiv.innerHTML = `
      <div class="bg-white rounded-lg p-6 max-w-md w-full text-center shadow-2xl">
        <div class="text-2xl mb-4">${isWinner ? '🏆' : '😢'}</div>
        <h3 class="text-lg font-bold mb-4">${message}</h3>
        <div class="text-sm text-gray-600 mb-6">
          Skor: ${userScore} - ${opponentScore}
        </div>
        <button id="tournament-btn" class="w-full bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded font-medium">
          ${buttonText}
        </button>
      </div>
    `;
    
    document.body.appendChild(modalDiv);

    // Button event listener
    const tournamentBtn = modalDiv.querySelector('#tournament-btn');
    
    if (tournamentBtn) {
      tournamentBtn.addEventListener('click', () => {
        document.body.removeChild(modalDiv);
        // Her durumda bracket sayfasına yönlendir - şampiyonluk kartı burada gösterilecek
        navigate(`/tournament-bracket/${tournamentId}`);
      });
    }

    // Otomatik yönlendirme (3 saniye sonra)
    setTimeout(() => {
      if (document.body.contains(modalDiv)) {
        document.body.removeChild(modalDiv);
      }
      // Her durumda bracket sayfasına yönlendir - şampiyonluk kartı burada gösterilecek
      navigate(`/tournament-bracket/${tournamentId}`);
    }, 3000);

  } catch (error) {
    console.error('❌ Turnuva bitiş kartı hatası:', error);
    navigate('/tournament');
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
const handleGameEnd = async () => {
  console.log('🏁 handleGameEnd çağrıldı!');
  console.log('🎮 gameMode:', gameMode, 'tournamentMatch:', !!tournamentMatch);
  
  const finalUserScore = playerScoreRef.current;
  const finalOpponentScore = opponentScoreRef.current;

  // ✅ TURNUVA KONTROLÜ - tournamentMatch var mı?
  if (gameMode === 'tournament' && tournamentMatch && user) {
    console.log('🏆 Tournament handleTournamentGameEnd çağrılacak!');
    
    // Hemen çağır
    handleTournamentGameEnd(finalUserScore, finalOpponentScore);
    return; // Erken çık
  }

  // vs-computer modunda istatistik güncelle
  if (user) {
    if (statsUpdatedRef.current) {
      console.log('⏭️ Skipping duplicate stats update (handleGameEnd)');
    } else {
      statsUpdatedRef.current = true;
      const gameDuration = gameType === 'timed' ? 120 : Math.floor((Date.now() - gameStartTime) / 1000);
      
      const { data, error } = await (supabase.rpc as any)('update_game_stats', {
        p_user_id: user.id,
        p_score: finalUserScore,
        p_words: playerWordsWithScores,
        p_is_winner: finalUserScore > finalOpponentScore,
        p_game_duration: gameDuration
      });
      
      if (error) {
        console.error('İstatistik güncelleme hatası:', error);
      } else {
        console.log('İstatistikler güncellendi - gameMode:', gameMode);
        await forceRefreshProfile?.();
      }
    }
  }

  // Normal oyun sonu
  setGameEnded(true);
  setShowResults(true);
};

// 🔧 5. GamePage.tsx - Turnuva modu rakip belirleme düzeltmesi
useEffect(() => {
  if (gameMode === 'tournament' && tournamentMatch) {
    const userIdString = String(user?.id);
    const opponentId = String(tournamentMatch.player1_id) === userIdString ? 
      tournamentMatch.player2_id : 
      tournamentMatch.player1_id;
  
    console.log('🎯 Turnuva rakip analizi:', {
      matchId: tournamentMatch.id,
      player1: String(tournamentMatch.player1_id).slice(-8),
      player2: String(tournamentMatch.player2_id).slice(-8),
      currentUser: userIdString.slice(-8),
      opponentId: String(opponentId).slice(-8)
    });

    if (!opponentId) {
      setIsAIOpponent(true);
      setOpponentName('Bekleniyor...');
    } else if (String(opponentId).startsWith('bot_')) {
      setIsAIOpponent(true);
      const seed = Array.from(String(opponentId)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      setOpponentName(generateBotName(seed));
    } else {
      setIsAIOpponent(false);
      const realOpponent = participants.find(p => String(p.user_id) === String(opponentId));
      if (realOpponent && (realOpponent as any).profiles?.username) {
        setOpponentName((realOpponent as any).profiles.username);
      } else {
        setOpponentName('Turnuva Oyuncusu');
      }
    }
  }
}, [gameMode, tournamentMatch, user?.id, participants]);


  
  // Rakip ismini göster - turnuva için
const getOpponentDisplayName = () => {
  if (gameMode === 'tournament' && tournamentMatch) {
    const opponentId = tournamentMatch.player1_id === user?.id ? 
      tournamentMatch.player2_id : 
      tournamentMatch.player1_id;
  
    if (!opponentId || String(opponentId).startsWith('bot_')) {
      const seed = Array.from(String(opponentId || 'bot')).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      return generateBotName(seed);
    }
    
    // Eğer state'te belirlenmiş bir rakip adı varsa onu kullan
    if (opponentName && opponentName.trim().length > 0) {
      return opponentName;
    }
    
    const realOpponent = participants.find(p => 
      String(p.user_id) === String(opponentId) && 
      !p.is_bot && 
      p.user_id !== null
    );
    
    if (realOpponent && (realOpponent as any).profiles?.username) {
      return (realOpponent as any).profiles.username;
    }
    
    return 'Turnuva Rakibi';
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

// Random match için grid'i URL'den al ve game room oluştur
useEffect(() => {
  const initializeRandomMatch = async () => {
    if (gameMode !== 'random-match') return;
    if (!user?.id) return;
    if (randomMatchInitRef.current) return;
    randomMatchInitRef.current = true;
    
    console.log('🎲 Random match initialization başlıyor');
    
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    const type = urlParams.get('type') as 'timed' | 'score';
    
    if (!roomId || !type) {
      console.error('❌ Random match için room ID veya type eksik');
      navigate('/');
      return;
    }
    
    try {
      // 🎮 Nakama match ID formatı kontrol et (UUID)
      const isNakamaMatch = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId);
      
      if (isNakamaMatch) {
        console.log('🎮 Nakama match detected:', roomId);
        console.log('✅ Skipping Supabase matchmaking_rooms lookup');
        
        // Nakama match için direkt grid oluştur
        const gridToUse = generateRandomGrid();
        setGameGrid(gridToUse);
        
        // 🔥 ÖNEMLİ: joinRoom çağır ki participants yüklensin
        console.log('🔗 Joining Nakama game room:', roomId);
        const success = await joinRoom(roomId);
        
        if (!success) {
          console.error('❌ Nakama room\'a katılamadı');
          toast({
            title: "Bağlantı Hatası",
            description: "Oyun odasına bağlanılamadı",
            variant: "destructive",
          });
          navigate('/');
          return;
        }
        
        console.log('✅ Nakama room\'a katıldı, participants yüklenecek');
        return; // Supabase matchmaking_rooms işlemlerini atla
      }
      
      // Eski Supabase sistemi için devam et
      console.log('📊 Supabase matchmaking room aranıyor:', roomId);
      
      const { data: matchmakingRoom, error: matchError } = await supabase
        .from('matchmaking_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (matchError || !matchmakingRoom) {
        console.error('❌ Matchmaking room bulunamadı:', matchError);
        toast({
          title: "Oda Hatası",
          description: "Eşleşme odasına ulaşılamadı",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      console.log('✅ Matchmaking room bulundu:', matchmakingRoom.id);
      
      // Grid'i al
      let gridToUse: string[][] = generateRandomGrid();
      
      if (matchmakingRoom.room_data && typeof matchmakingRoom.room_data === 'object') {
        const roomDataObj = matchmakingRoom.room_data as any;
        if (roomDataObj.game_grid && Array.isArray(roomDataObj.game_grid)) {
          console.log('📊 Matchmaking room grid alındı');
          
          const grid = [];
          for (let i = 0; i < 4; i++) {
            const row = [];
            for (let j = 0; j < 4; j++) {
              row.push(roomDataObj.game_grid[i * 4 + j] || 'A');
            }
            grid.push(row);
          }
          gridToUse = grid;
        }
      }
      
      setGameGrid(gridToUse);
      
      // Game room oluştur veya bul
      const { data: existingRoom } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', roomId)
        .eq('status', 'waiting')
        .single();

      let gameRoomId = roomId;
      
      if (!existingRoom) {
        const flatGrid = gridToUse.flat();
        
        const { data: newRoom, error: createError } = await supabase
          .from('game_rooms')
          .insert({
            id: roomId,
            host_id: user.id,
            game_mode: type,
            status: 'waiting',
            max_players: 2,
            time_limit: type === 'timed' ? 120 : 0,
            max_score: type === 'score' ? 100 : 0,
            current_grid: flatGrid
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Game room oluşturulamadı:', createError);
          toast({
            title: "Oda Hatası", 
            description: "Oyun odası oluşturulamadı",
            variant: "destructive",
          });
          navigate('/');
          return;
        }
        
        console.log('✅ Game room oluşturuldu:', newRoom.id);
      }
      
      const success = await joinRoom(gameRoomId);
      if (success) {
        console.log('✅ Random match room\'a katıldı');
      } else {
        console.error('❌ Random match room\'a katılamadı');
        toast({
          title: "Bağlantı Hatası", 
          description: "Oyun odasına bağlanılamadı",
          variant: "destructive",
        });
        navigate('/');
      }
    } catch (error) {
      console.error('❌ Random match initialization hatası:', error);
      navigate('/');
    }
  };

  initializeRandomMatch();
}, [gameMode, user?.id, joinRoom, navigate, toast, setGameGrid, generateRandomGrid]);

// Initialize private room from URL params
useEffect(() => {
  const init = async () => {
    if (gameMode !== 'private-room') return;
    if (!user?.id) return;
    if (privateRoomInitRef.current) return;
    privateRoomInitRef.current = true;

    const roomId = searchParams.get('room');
    const type = searchParams.get('type') as 'timed' | 'score';

    if (!roomId || !type) {
      console.error('❌ Private room için room veya type eksik');
      navigate('/');
      return;
    }

    console.log('🎯 Loading private room data:', roomId);
    
    // Grid'i yükle
    const { data: roomData } = await supabase
      .from('game_rooms')
      .select('current_grid')
      .eq('id', roomId)
      .single();
    
    if (roomData?.current_grid) {
      console.log('📊 Private room grid yüklendi');
      const grid = [];
      for (let i = 0; i < 4; i++) {
        const row = [];
        for (let j = 0; j < 4; j++) {
          row.push(roomData.current_grid[i * 4 + j] || 'A');
        }
        grid.push(row);
      }
      setGameGrid(grid);
    }
    
    const joined = await joinRoom(roomId);
    if (!joined) {
      toast({ title: 'Bağlantı Hatası', description: 'Oyun odasına bağlanılamadı', variant: 'destructive' });
      navigate('/');
      return;
    }
  };
  init();
}, [gameMode, user?.id, joinRoom, navigate, searchParams, toast, setGameGrid]);

// Tournament match bilgisini al - SADECE gameMode 'tournament' ise
useEffect(() => {
  const initializeTournamentMatch = async () => {
    // SADECE tournament modunda çalışsın
    if (gameMode !== 'tournament') return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const matchId = urlParams.get('match');
    const tournamentId = urlParams.get('tournament');
    
    console.log('🎯 URL parametreleri:', { matchId, tournamentId });
    
    if (matchId) {
      // 🛡️ TURNUVA MAÇI KORUMASI: Bu maç daha önce tamamlandıysa tekrar oynama
      const completedKey = `tournament_match_completed_${matchId}`;
      const completed = localStorage.getItem(completedKey);
      if (completed) {
        const data = JSON.parse(completed);
        console.warn('⚠️ Bu turnuva maçı zaten tamamlanmış:', data);
        toast({
          title: "⚠️ Maç Zaten Bitti",
          description: "Bu maç daha önce tamamlandı. Lütfen bir sonraki tura geçin.",
          variant: "destructive"
        });
        setTimeout(() => navigate('/tournament'), 2000);
        return;
      }
      
      try {
        // Maç bilgilerini al
        const { data: matchData, error } = await supabase
          .from('tournament_matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (error) {
          console.error('Maç bilgisi alınamadı:', error);
          return;
        }

        if (matchData) {
          // Maç zaten completed ise tekrar oynama
          if (matchData.status === 'completed') {
            console.warn('⚠️ Bu maç zaten tamamlanmış (DB):', matchData);
            toast({
              title: "⚠️ Maç Zaten Bitti",
              description: "Bu maç daha önce tamamlandı.",
              variant: "destructive"
            });
            setTimeout(() => navigate('/tournament'), 2000);
            return;
          }
          
          console.log('✅ Turnuva maçı yüklendi:', matchData.id);
          setTournamentMatch(matchData);
          
          // 🎯 SERVER-SIDE COUNTDOWN: Turnuva maçı için countdown başlat
          const { data: countdownTime, error: countdownError } = await supabase.rpc('start_tournament_countdown', {
            p_match_id: matchId
          });
          
          if (!countdownError && countdownTime) {
            console.log('🎯 Tournament countdown başlatıldı:', countdownTime);
            setCountdownServerTime(countdownTime);
          }
          
          // Maç durumunu güncelle
          await supabase
            .from('tournament_matches')
            .update({
              status: 'pending', // pending olsun ki auto_start_countdown_finished_games fonksiyonu başlatsın
              updated_at: new Date().toISOString()
            })
            .eq('id', matchId);
        }
      } catch (error) {
        console.error('Turnuva maçı başlatma hatası:', error);
      }
    } else if (tournamentId && user) {
      // Match ID yoksa, kullanıcının maçını bul
      console.log('🔍 Kullanıcı maçı aranıyor tournament için...');
      
      const { data: userMatch } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
        .eq('status', 'in_progress')
        .single();
        
      if (userMatch) {
        console.log('✅ Kullanıcı maçı bulundu:', userMatch.id);
        setTournamentMatch(userMatch);
        
        // URL'yi güncelle
        window.history.replaceState(
          null, 
          '', 
          `/game?match=${userMatch.id}&tournament=${tournamentId}`
        );
      }
    }
  };

  initializeTournamentMatch();
}, [gameMode, user?.id]);
  
  // JOKER FONKSİYONLARI

  // 1. Değiştir Jokeri - 5 harf değiştir (3 sesli, 2 sessiz)
  const useDegisTirJoker = async () => {
  if (jokers.degistir <= 0 || isJokerActive) return;

  playSpecialSound('/degistir.mp3');
  
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
  const jokerUsed = await useJoker('degistir');
  if (!jokerUsed) {
    console.error('❌ Değiştir joker kullanılamadı!');
    setIsJokerActive(false);
    return;
  }
  setSelectedLetters([]);
  setCurrentWord('');
  
  playSound('correctWord');
};


// 2. Fısılda Jokeri - Sözlükteki orijinal haliyle göster (çevirme yapma!)
const useFisildaJoker = async () => {
  if (jokers.fisilida <= 0 || isJokerActive) return;

  playSpecialSound('/fisilda.mp3');
  
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
    const wordArray = Array.from(wordlist).map(word => word.toLocaleUpperCase('tr-TR').trim());
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
      if (usedWords.has(word.toLocaleUpperCase('tr-TR'))) return false;
      
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
    const jokerUsed = await useJoker('fisilida');
    if (!jokerUsed) {
      console.error('❌ Fısılda joker kullanılamadı!');
      setIsJokerActive(false);
      return;
    }
    
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

  playSpecialSound('/senyaz.mp3');
  
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
      if (usedWords.has(word.toLocaleUpperCase('tr-TR'))) return false;
      
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
  const normalizedSelectedWord = selectedWord.toLocaleUpperCase('tr-TR');
  
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
      const normalizedWord = selectedWord.toLocaleUpperCase('tr-TR');
      
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
      const jokerUsed = await useJoker('senYaz');
      if (jokerUsed) {
        console.log('🎯 Sen Yaz Jokeri harcanı!');
      } else {
        console.error('❌ Sen Yaz joker kullanılamadı!');
      }
      console.log('🎯 Sen Yaz Jokeri harcanı!');
    } else {
      console.log('💾 Sen Yaz Jokeri korundu (işlem başarısız)!');
    }
  }, 1500);
};
  // Sync grid with room data and fetch avatars
 useEffect(() => {
  const fetchAvatars = async () => {
    if (!user) return;
  
    const { data: playerData } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle();
  
    if (playerData?.avatar_url) {
      setPlayerAvatar(playerData.avatar_url);
    }

    // Private room ve tournament modlarında rakip bilgilerini al
    if ((gameMode === 'private-room' || gameMode === 'tournament') && participants.length >= 2) {
      console.log('👥 Multi-player mode - participants kontrol ediliyor:', participants.length);
      
      const opponent = participants.find(p => {
        // Tournament modunda string ID'ler kullanılıyor
        if (gameMode === 'tournament') {
          return p.user_id !== user.id && !p.is_bot;
        }
        // Private room modunda UUID'ler kullanılıyor
        return p.user_id !== user.id && !p.is_bot;
      });
      
      if (opponent) {
        console.log('👤 Gerçek rakip bulundu:', {
          userId: typeof opponent.user_id === 'string' ? opponent.user_id.slice(-8) : opponent.user_id,
          username: (opponent as any).profiles?.username,
          avatar: (opponent as any).profiles?.avatar_url
        });
        
        // Tournament modunda profil bilgilerini fetch et
        if (gameMode === 'tournament' && opponent.user_id) {
          const { data: opponentProfile } = await supabase
            .from('profiles')
            .select('avatar_url, username')
            .eq('id', opponent.user_id)
            .maybeSingle();
          
          if (opponentProfile) {
            if (opponentProfile.avatar_url) {
              setOpponentAvatar(opponentProfile.avatar_url);
            }
            if (opponentProfile.username) {
              setOpponentName(opponentProfile.username);
            }
          }
        } else {
          // Private room modunda mevcut mantığı kullan
          if ((opponent as any).profiles?.avatar_url) {
            setOpponentAvatar((opponent as any).profiles.avatar_url);
          }
          
          if ((opponent as any).profiles?.username) {
            setOpponentName((opponent as any).profiles.username);
          }
        }
        
        if (opponent.score !== undefined && !gameEnded) {
          console.log('🔄 Updating opponent score from participants:', opponent.score);
          setOpponentScore(opponent.score);
        }
      }
    }
    
    if (gameMode === 'random-match' && participants.length >= 2 && !gameEnded) {
      const opponent = participants.find(p => p.user_id !== user.id && !p.is_bot);
      if (opponent && opponent.score !== undefined) {
        console.log('🔄 Updating opponent score in random match:', opponent.score);
        setOpponentScore(opponent.score);
      }
    }
  };

  fetchAvatars();
}, [user?.id, participants, gameMode, gameEnded]);

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
          .map(word => word.trim().toLocaleUpperCase('tr-TR'))
          .filter(word => word.length >= 3); // Minimum 3 harf
        
        const wordSet = new Set(words);
        setWordlist(wordSet);
        setWordlistLoaded(true);
        console.log(`✅ Wordlist loaded (TR): ${wordSet.size} words`);
      } catch (error) {
        console.error('❌ Failed to load wordlist:', error);
        setWordlistLoaded(false);
      }
    };

    loadWordlist();
  }, []);

  // Turkish locale uppercase helper
  const toTRUpper = (s: string): string => s.toLocaleUpperCase('tr-TR').trim();

  // Local word validation - Sözlükteki kelimeleri Türkçe'ye çevir
const validateWordLocal = useCallback((word: string): { isValid: boolean; points: number; message: string } => {
  const upperWord = toTRUpper(word);
  
  console.log('🔍 Word validation (exact TR match):', {
    originalWord: word,
    upperWord,
    globalUsedCount: globalUsedWords.size,
    isUsed: globalUsedWords.has(upperWord)
  });
  
  if (upperWord.length < 3) {
    return { isValid: false, points: 0, message: 'Kelime en az 3 harf olmalıdır' };
  }

  const turkishPattern = /^[A-ZÇĞIİÖŞÜ]+$/;
  if (!turkishPattern.test(upperWord)) {
    return { isValid: false, points: 0, message: 'Sadece Türkçe harfler kullanabilirsiniz' };
  }

  if (wordlistLoaded) {
    const wordExists = wordlist.has(upperWord);
    if (!wordExists) {
      return { isValid: false, points: 0, message: 'Bu kelime sözlükte bulunamadı' };
    }
  } else {
    return { isValid: false, points: 0, message: 'Sözlük yüklenemedi.' };
  }

  const calculatePoints = (w: string): number => {
    const basePoints = w.length * 2;
    let rareLetterBonus = 0;
    const rareLetters = ['J', 'Z', 'Ğ', 'Ü', 'Ö', 'Ç', 'Ş'];
    for (const letter of w) {
      if (rareLetters.includes(letter)) rareLetterBonus += 3;
    }
    return Math.max(basePoints + rareLetterBonus, 5);
  };

  const points = calculatePoints(upperWord);
  
  return { isValid: true, points, message: 'Geçerli kelime' };
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

  // Load tournament match data from URL parameters
useEffect(() => {
  const loadTournamentData = async () => {
    const tournamentId = searchParams.get('tournament');
    const matchId = searchParams.get('match');
    
    if (!tournamentId || !matchId || !user || gameMode !== 'tournament') return;
    
    console.log('🏆 Loading tournament match data:', { tournamentId, matchId });
    
    try {
      // Load match data
      const { data: matchData } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('id', matchId)
        .single();
      
      if (matchData) {
        console.log('🏆 Tournament match loaded:', matchData.id);
        setTournamentMatch(matchData);
      }
      
      // Load tournament participants (profiles ayrı sorgu ile eklenecek)
      const { data: participantsData } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', tournamentId);
        
      if (participantsData) {
        console.log('👥 Tournament participants loaded:', participantsData.length);

        // Profil bilgilerini ayrı çek (user_id text olduğu için FK yok)
        const userIds = participantsData
          .filter(p => !p.is_bot && p.user_id && /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{4}-[0-9a-fA-F-]{12}$/.test(String(p.user_id)))
          .map(p => String(p.user_id));

        let profileMap: Record<string, { username: string | null; avatar_url: string | null }> = {};
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', userIds);

          if (profilesData) {
            profilesData.forEach(pr => {
              profileMap[pr.id as string] = { username: pr.username, avatar_url: pr.avatar_url };
            });
          }
        }
        
        if (matchData) {
          // Filter participants for this match ve profilleri ekle
          const matchParticipants = participantsData
            .filter(p => p.user_id === matchData.player1_id || p.user_id === matchData.player2_id)
            .map(p => ({
              id: p.id,
              room_id: searchParams.get('room'),
              user_id: p.user_id,
              score: 0,
              joined_at: p.joined_at,
              is_bot: p.is_bot,
              profiles: p.user_id ? profileMap[String(p.user_id)] : undefined
            }));
          
          console.log('🔄 Setting tournament participants:', matchParticipants.length);
          setTournamentParticipants(matchParticipants);
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading tournament data:', error);
    }
  };
  
  loadTournamentData();
}, [gameMode, searchParams, user]);

// Load random match room data from URL parameters
useEffect(() => {
  if (randomMatchInitRef.current) return;
  randomMatchInitRef.current = true;
  const loadRandomMatchData = async () => {
    const roomId = searchParams.get('room');
    
    if (!roomId || !user || gameMode !== 'random-match') return;
    
    console.log('🎯 Loading random match room data:', roomId);
    
    try {
      // Önce game_rooms tablosunu kontrol et (özel odalar için)
      const { data: existingGameRoom } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', roomId)
        .in('status', ['waiting', 'active'])
        .maybeSingle();
      
      if (existingGameRoom) {
        console.log('🏠 Private/Game room found:', existingGameRoom.id);
        
        // Join existing room using GameContext function
        const joined = await joinRoom(roomId);
        if (!joined) {
          console.error('❌ Failed to join existing room');
          toast({
            title: 'Bağlantı Hatası',
            description: 'Oyun odasına bağlanılamadı',
            variant: 'destructive',
          });
          navigate('/');
          return;
        }
        
        console.log('✅ Joined existing game room');
        return;
      }
      
      // Eğer game_rooms'da yoksa matchmaking_rooms'a bak
      const { data: matchmakingRoom } = await supabase
        .from('matchmaking_rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();
      
      if (!matchmakingRoom) {
        console.error('❌ Room not found in either table:', roomId);
        toast({
          title: 'Hata',
          description: 'Oyun odası bulunamadı',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }
      
      console.log('🏠 Matchmaking room found:', matchmakingRoom);
      
      // Check if game room already exists for this matchmaking room
      const { data: existingRoom } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', roomId)
        .in('status', ['waiting','active'])
        .maybeSingle();
      
      if (existingRoom) {
        console.log('🏠 Existing game room found, joining:', existingRoom.id);
        
        // Join existing room using GameContext function
        const joined = await joinRoom(roomId);
        if (!joined) {
          console.error('❌ Failed to join existing room');
          navigate('/');
          return;
        }
      } else {
        console.log('🏗️ Creating new game room...');
        const gameRoom = await createRoom(`random-match-${gameType}`, roomId);
        
        if (!gameRoom) {
          console.error('❌ Failed to create game room');
          navigate('/');
          return;
        }
        
        console.log('✅ Game room created successfully');
        
        // Participants'ın yüklenmesini bekle
        let retries = 0;
        const maxRetries = 10;
        const checkParticipants = () => {
          if (participants.length >= 2) {
            console.log('✅ Participants loaded, game ready to start');
            return;
          }
          
          retries++;
          if (retries < maxRetries) {
            console.log(`⏳ Waiting for participants... (${retries}/${maxRetries})`);
            setTimeout(checkParticipants, 500);
          } else {
            console.log('⚠️ Timeout waiting for participants');
          }
        };
        
        checkParticipants();
        
        console.log('✅ Game room created:', gameRoom.id);
      }
      
      // Add AI opponent if needed (context will handle participant checking)
      setTimeout(async () => {
        // Resolve game room id reliably using room_code -> game_rooms lookup
        const { data: gameRoomRow } = await supabase
          .from('game_rooms')
          .select('id')
          .eq('room_code', roomId)
          .in('status', ['waiting','active'])
          .maybeSingle();
        const resolvedRoomId = gameRoomRow?.id || currentRoom?.id || null;
        if (!resolvedRoomId) {
          console.warn('⚠️ Could not resolve game room id for participants check');
          return;
        }
        const { data: participants } = await supabase
          .from('game_participants')
          .select('*')
          .eq('room_id', resolvedRoomId);
        
        console.log('👥 Current participants after room setup:', participants?.length || 0);
        
        // Random-match'te bot ekleme - KALDIRILDI! Sadece gerçek oyuncular
        // if (participants && participants.length === 1) {
        //   console.log('🤖 Adding AI opponent...');
        //   await addAIOpponent();
        // }
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error loading random match data:', error);
      navigate('/');
    }
  };
  
  loadRandomMatchData();
}, [gameMode, searchParams, user, createRoom, addAIOpponent, navigate, gameType]);

  // Check for winner and apply end game bonuses


const checkWinnerWithScores = useCallback(async (currentPlayerScore: number, currentOpponentScore: number) => {
  if (gameEnded || winner !== null) return;

  console.log('🏆 Checking winner with scores - Player:', currentPlayerScore, 'Opponent:', currentOpponentScore);

  let gameResult: 'player' | 'opponent' | 'tie';
  let bonusPoints = 0;

  // TURNUVA MODUNDA BERABERLIK ENGELLEMESİ - GÜÇLENDİRİLMİŞ
  if (gameMode === 'tournament') {
    console.log('🏆 Tournament mode - strict winner determination:', { currentPlayerScore, currentOpponentScore });
    if (currentPlayerScore === currentOpponentScore) {
      console.log('⚖️ Turnuva beraberlik durumu - güçlü tiebreaker uygulanıyor');
      
      // ÖNCE: Bot hiç oynamadıysa oyuncu kazansın
      if (currentPlayerScore === 0 && currentOpponentScore === 0) {
        console.log('🤖 Bot hiç oynamadı, oyuncu otomatik kazandı');
        currentPlayerScore = 10; // Oyuncuya minimum puan ver
      } else {
        // SONRA: Normal tiebreaker kuralları
        const playerWordCount = playerWordsWithScores.length;
        const opponentWordCount = opponentWordsWithScores.length;
        
        if (playerWordCount > opponentWordCount) {
          console.log('🎯 Tiebreaker: Player kazandı (daha çok kelime)');
          currentPlayerScore += 5;
        } else if (opponentWordCount > playerWordCount) {
          console.log('🎯 Tiebreaker: Opponent kazandı (daha çok kelime)');  
          currentOpponentScore += 5;
        } else {
          // Kelime sayısı eşit, en uzun kelime kontrolü
          const playerLongestWord = Math.max(...playerWordsWithScores.map(w => w.word.length), 0);
          const opponentLongestWord = Math.max(...opponentWordsWithScores.map(w => w.word.length), 0);
          
          if (playerLongestWord > opponentLongestWord) {
            console.log('🎯 Tiebreaker: Player kazandı (daha uzun kelime)');
            currentPlayerScore += 3;
          } else if (opponentLongestWord > playerLongestWord) {
            console.log('🎯 Tiebreaker: Opponent kazandı (daha uzun kelime)');
            currentOpponentScore += 3;
          } else {
            // En yüksek puanlı kelime kontrolü
            const playerHighestScore = Math.max(...playerWordsWithScores.map(w => w.score), 0);
            const opponentHighestScore = Math.max(...opponentWordsWithScores.map(w => w.score), 0);
            
            if (playerHighestScore > opponentHighestScore) {
              console.log('🎯 Tiebreaker: Player kazandı (daha yüksek puanlı kelime)');
              currentPlayerScore += 2;
            } else {
              // SON ÇARE: Oyuncuya avantaj ver (turnuvada beraberlik olmasın)
              console.log('🎯 Tiebreaker: Player kazandı (son çare kuralı)');
              currentPlayerScore += 1;
            }
          }
        }
      }
      
      console.log('🎯 Tiebreaker sonrası skorlar - Player:', currentPlayerScore, 'Opponent:', currentOpponentScore);
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
    // Normal modlarda beraberlik olabilir, ama turnuvada buraya gelmemeli
    gameResult = 'tie';
    bonusPoints = 25;
    setWinner('tie');
    console.log('🏆 It\'s a tie! Both scores:', currentPlayerScore);
  }

  // İstatistik güncelleme (vs-computer için)
  if (user && gameMode === 'vs-computer') {
    if (statsUpdatedRef.current) {
      console.log('⏭️ Skipping duplicate stats update (effect)');
    } else {
      statsUpdatedRef.current = true;
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
          await forceRefreshProfile?.();
        }

        // ➕ En uzun kelime ve en yüksek puanlı kelime istatistiklerini (vs-computer) güncelle - RPC sonucu ne olursa olsun çalıştır
        try {
          const longest = playerWordsWithScores.reduce<{ word: string; score: number } | null>((acc, w) => {
            return !acc || w.word.length > acc.word.length ? w : acc;
          }, null);
          const bestScore = playerWordsWithScores.reduce<{ word: string; score: number } | null>((acc, w) => {
            return !acc || w.score > acc.score ? w : acc;
          }, null);

          if (user && (longest || bestScore)) {
            const { data: cur } = await supabase
              .from('profiles')
              .select('longest_word_length, highest_word_score')
              .eq('id', user.id)
              .maybeSingle();

            const updates: Record<string, any> = {};
            if (longest) {
              const len = longest.word.length;
              if (!cur || (cur.longest_word_length ?? 0) < len) {
                updates.longest_word = longest.word;
                updates.longest_word_length = len;
              }
            }
            if (bestScore) {
              if (!cur || (cur.highest_word_score ?? 0) < bestScore.score) {
                updates.highest_word = bestScore.word;
                updates.highest_word_score = bestScore.score;
              }
            }

            if (Object.keys(updates).length > 0) {
              await supabase.from('profiles').update(updates).eq('id', user.id);
            }
          }
        } catch (e) {
          console.warn('⚠️ Profil kelime istatistikleri güncellenemedi:', e);
        }

        // Rozet kontrolü
        setTimeout(() => {
          checkBadges(user.id, playerWordsWithScores.length);
        }, 500);
      } catch (error) {
        console.error('❌ İstatistik güncelleme hatası:', error);
      }
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

  // Final skorları kaydet (reset'ten etkilenmemesi için)
  setFinalPlayerScore(currentPlayerScore);
  setFinalOpponentScore(currentOpponentScore);

  // Sonuç ekranını göster
  console.log('🎯 Setting showResults to true - rematch UI should appear');
  setShowResults(true);
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
    // Rakibi kazanan yap
    const winnerId = tournamentMatch.player1_id === user.id ? 
      tournamentMatch.player2_id : 
      tournamentMatch.player1_id;

    // Maçı tamamla (çıkan kişi 0 puan alır)
    const isUserPlayer1 = tournamentMatch.player1_id === user.id;
    await supabase
      .from('tournament_matches')
      .update({
        status: 'completed',
        winner_id: winnerId || 'forfeit',
        player1_score: isUserPlayer1 ? 0 : 500,
        player2_score: isUserPlayer1 ? 500 : 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', tournamentMatch.id);

    setShowTournamentExitDialog(false);
    navigate('/tournament');

  } catch (error) {
    console.error('Çıkış hatası:', error);
    navigate('/tournament');
  }
};
  
  // Timer effect - start only when match truly starts and guard early-finish
useEffect(() => {
  const isMp = gameMode === 'random-match' || gameMode === 'private-room';
  const haveTwoRealPlayers = participants.filter(p => !p.is_bot).length >= 2;
  const roomActive = currentRoom?.status === 'active';
  const canStart = (
    gameType === 'timed' &&
    gameStarted &&
    !gameEnded &&
    !timerRef.current &&
    (!isMp || (roomActive && haveTwoRealPlayers))
  );

  if (!canStart) return;

  console.log('⏱️ Timer BAŞLATILIYOR - Tek sefer, time:', timeLeftRef.current);
  
  let syncInterval: NodeJS.Timeout | null = null;
  
  // For tournament matches, sync timer with database
  if (gameMode === 'tournament' && tournamentMatch) {
    const syncTimer = async () => {
      try {
        // Maç statüsünü kontrol et
        const { data: matchData } = await supabase
          .from('tournament_matches')
          .select('updated_at, created_at, status')
          .eq('id', tournamentMatch.id)
          .single();
          
        if (matchData && matchData.status === 'in_progress') {
          // ✅ updated_at kullan - maç başlatıldığı anı temsil eder
          if (!serverMatchStartRef.current) {
            // Maç başlatma zamanını ayarla (küçük bir tampon ekle)
            const startSource = matchData.updated_at || matchData.created_at;
            serverMatchStartRef.current = new Date(startSource).getTime() + 2000;
            console.log('📌 Tournament match start time fixed (updated_at):', new Date(serverMatchStartRef.current).toISOString());
          }
          
          const matchStartTime = serverMatchStartRef.current!;
          const currentTime = Date.now();
          const elapsedSeconds = Math.floor((currentTime - matchStartTime) / 1000);
          const remainingTime = Math.max(0, 120 - elapsedSeconds);
          
          // Sadece 3+ saniye fark varsa senkronize et
          if (Math.abs(timeLeftRef.current - remainingTime) > 3) {
            timeLeftRef.current = remainingTime;
            setDisplayTime(remainingTime);
            console.log('🔄 Timer synced to:', remainingTime, 'seconds - Both players now synced!');
          }
        }
      } catch (error) {
        console.error('Timer sync error:', error);
      }
    };
    
    // Initial sync
    syncTimer();
    
    // Sync every 5 seconds for tournament matches
    syncInterval = setInterval(syncTimer, 5000);
  }
  
  timerRef.current = setInterval(() => {
    timeLeftRef.current -= 1;
    setDisplayTime(timeLeftRef.current);
    
    if (timeLeftRef.current <= 0) {
      // 🛡️ Early-finish guard for fresh matches
      const startedAtTs = currentRoom?.started_at ? new Date(currentRoom.started_at).getTime() : null;
      if (isMp && startedAtTs && Date.now() - startedAtTs < 3000) {
        const bump = 5;
        timeLeftRef.current = bump;
        setDisplayTime(bump);
        console.log('🛡️ Early-finish guard: bumped time to', bump);
        return;
      }

      clearInterval(timerRef.current!);
      if (syncInterval) clearInterval(syncInterval);
      timerRef.current = null;
      
      console.log('⏰ Süre bitti! Final skorlar');
      handleGameEnd();
      setTimeout(() => {
        setGameEnded(true);
        checkWinnerWithScores(playerScoreRef.current, opponentScoreRef.current);
      }, 50);
    }
  }, 1000);
  
  return () => {
    // Cleanup intervals
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (syncInterval) {
      clearInterval(syncInterval);
    }
  };
}, [gameStarted, gameEnded, gameType, gameMode, tournamentMatch, participants.length, currentRoom?.status, currentRoom?.started_at]);
  
  // Real-time score sync for private-room/random-match via game_rooms
  useEffect(() => {
    if (!currentRoom || !user) return;
    if (gameMode !== 'private-room' && gameMode !== 'random-match') return;

    const isP1 = currentRoom.player1_id === user.id;
    const myScore = isP1 ? currentRoom.player1_score : currentRoom.player2_score;
    const oppScore = isP1 ? currentRoom.player2_score : currentRoom.player1_score;

    if (typeof myScore === 'number' && myScore !== playerScore) {
      setPlayerScore(myScore);
    }
    if (typeof oppScore === 'number' && oppScore !== opponentScore) {
      setOpponentScore(oppScore);
    }
  }, [
    currentRoom?.player1_score,
    currentRoom?.player2_score,
    currentRoom?.player1_id,
    currentRoom?.player2_id,
    gameMode,
    user?.id
  ]);

  // Realtime participant score sync fallback (ensures opponent score updates instantly)
  useEffect(() => {
    if (!currentRoom || !user) return;
    if (gameMode !== 'private-room' && gameMode !== 'random-match') return;

    const channel = supabase
      .channel(`room-scores-${currentRoom.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_participants',
        filter: `room_id=eq.${currentRoom.id}`
      }, (payload) => {
        // Realtime UPDATE'lerde bazı kolonlar gelmeyebilir -> güvenli fetch
        (async () => {
          try {
            const { data } = await supabase
              .from('game_participants')
              .select('user_id, is_bot, score')
              .eq('room_id', currentRoom.id);
            if (!data) return;

            const me = data.find((p: any) => p.user_id === user.id && !p.is_bot);
            const opp = data.find((p: any) => p.user_id !== user.id && !p.is_bot);

            if (me && typeof me.score === 'number') setPlayerScore(me.score);
            if (opp && typeof opp.score === 'number') setOpponentScore(opp.score);
          } catch (e) {
            console.error('Participant fetch error on UPDATE:', e);
          }
        })();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom?.id, gameMode, user?.id]);

  // Timer sync for private-room and random-match games using server started_at
  useEffect(() => {
    if (gameType !== 'timed' || !gameStarted || gameEnded) return;
    if (gameMode !== 'private-room' && gameMode !== 'random-match') return;
    if (!currentRoom?.started_at) return;

    let syncInterval: NodeJS.Timeout | null = null;
    const syncTimer = () => {
      // Başlangıçta (geri sayımdan hemen sonra) 2:00'dan başlamayı koru
      if (Date.now() < syncSuppressUntilRef.current) {
        return;
      }
      const startTs = new Date(currentRoom.started_at!).getTime();
      const elapsed = Math.floor((Date.now() - startTs) / 1000);
      let remaining = Math.max(0, (currentRoom.time_limit || 120) - elapsed);

      // 🛡️ Early-finish guard: first 3s after start should never be <= 0
      if (Date.now() - startTs < 200000 && remaining <= 0) {
        remaining = 5;
      }
      
      // 1 saniye toleransla senkronize et (daha hassas)
      if (Math.abs(timeLeftRef.current - remaining) > 1) {
        timeLeftRef.current = remaining;
        setDisplayTime(remaining);
        console.log(`🔄 ${gameMode} timer synced:`, remaining, 'seconds');
      }
    };

    console.log('⏱️ Timer sync başlatılıyor - mode:', gameMode, 'started_at:', currentRoom.started_at);
    
    syncTimer();
    syncInterval = setInterval(syncTimer, 1000); // Her saniye sync

    return () => {
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [gameType, gameMode, gameStarted, gameEnded, currentRoom?.started_at, currentRoom?.time_limit]);

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
          const opponentId = tournamentMatch.player1_id === user?.id ? 
            tournamentMatch.player2_id : 
            tournamentMatch.player1_id;
          
          // Bot kontrolü - daha kapsamlı
          const isBot = !opponentId || 
                       opponentId === null || 
                       opponentId === undefined ||
                       opponentId.startsWith('bot_') ||
                       opponentId === 'bot';
                       
          console.log('🤖 Tournament AI Check:', {
            matchId: tournamentMatch.id.slice(-8),
            opponentId: opponentId?.slice(-8) || 'NULL',
            isBot,
            player1: tournamentMatch.player1_id?.slice(-8),
            player2: tournamentMatch.player2_id?.slice(-8),
            currentUser: user?.id?.slice(-8)
          });
          
          return isBot;
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
  
  console.log('🤖 AI Status Final - Mode:', gameMode, 'PlayingWithAI:', aiStatus);
  return aiStatus;
}, [gameMode, participants, tournamentMatch, user?.id]);


  // Real-time kelime senkronizasyonu
useEffect(() => {
  if (!currentRoom || !user) return;

  console.log('🔄 === WORD SYNC BAŞLADI ===');
  console.log('🔄 Room ID:', currentRoom.id.slice(-8));

  const syncUsedWords = async () => {
    if (syncingRef.current) {
      console.log('🔄 Sync already in progress, skipping');
      return;
    }
    
    syncingRef.current = true;
    
    try {
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
        const allWordsSet = new Set(roomWords.map(w => w.word.toLocaleUpperCase('tr-TR')));
        const myWordsSet = new Set(
          roomWords
            .filter(w => w.player_id === user.id)
            .map(w => w.word.toLocaleUpperCase('tr-TR'))
        );
        
        console.log('🔄 Syncing - All words:', allWordsSet.size, 'My words:', myWordsSet.size);
        setGlobalUsedWords(allWordsSet);
        setUsedWords(myWordsSet);
      }
    } catch (error) {
      console.error('❌ Word sync error:', error);
    } finally {
      syncingRef.current = false;
    }
  };

  const initialSyncTimer = setTimeout(syncUsedWords, 500);

  const wordChannel = supabase
    .channel(`mobile-words-${currentRoom.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'game_words',
      filter: `room_id=eq.${currentRoom.id}`
    }, (payload) => {
      console.log('📱 Mobile real-time word:', payload.new?.word, 'from player:', payload.new?.player_id);
      
      if (payload.new?.word && !syncingRef.current && payload.new?.player_id !== user.id) {
        const newWord = payload.new.word.toLocaleUpperCase('tr-TR');
        
        setTimeout(() => {
          setGlobalUsedWords(prev => new Set([...prev, newWord]));
        }, 100);
      }
    })
    .subscribe();

  return () => {
    clearTimeout(initialSyncTimer);
    console.log('📱 Mobile word sync cleanup');
    supabase.removeChannel(wordChannel);
  };
}, [currentRoom?.id, user?.id, gameMode]);
  
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
      
      // Rakip skorunu real-time güncelle - DÜZELTME
      const newMatch = payload.new as any;
      if (user) {
        const isPlayer1 = String(newMatch.player1_id) === String(user.id);
        const newOpponentScore = isPlayer1 ? newMatch.player2_score : newMatch.player1_score;
        const newPlayerScore = isPlayer1 ? newMatch.player1_score : newMatch.player2_score;
        
        console.log('🔄 Real-time tournament sync:', {
          isPlayer1,
          newPlayerScore,
          newOpponentScore,
          currentPlayerScore: playerScore,
          currentOpponentScore: opponentScore
        });
        
        if (newOpponentScore !== undefined && newOpponentScore !== opponentScore) {
          console.log('🔄 Rakip skoru güncellendi:', opponentScore, '->', newOpponentScore);
          setOpponentScore(newOpponentScore);
        }
        
        // Kendi skorumuzu da güncelle (eğer başka yerden geliyorsa)
        if (newPlayerScore !== undefined && newPlayerScore !== playerScore) {
          console.log('🔄 Kendi skorumuz güncellendi:', playerScore, '->', newPlayerScore);
          setPlayerScore(newPlayerScore);
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
 useEffect(() => {
  if (!currentRoom) return;

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
        const newWord = payload.new.word.toLocaleUpperCase('tr-TR');
        
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
}, [currentRoom?.id, user?.id]);

const syncUsedWords = async () => {
  if (syncingRef.current) return;
  
  syncingRef.current = true;
  
  try {
    if (gameMode === 'vs-computer') {
      setGlobalUsedWords(new Set());
      setUsedWords(new Set());
      return;
    }

    const { data: roomWords } = await supabase
      .from('game_words')
      .select('word, player_id')
      .eq('room_id', currentRoom.id);

    if (roomWords) {
      const allWordsSet = new Set(roomWords.map(w => w.word.toLocaleUpperCase('tr-TR')));
      const myWordsSet = new Set(
        roomWords
          .filter(w => w.player_id === user?.id)
          .map(w => w.word.toLocaleUpperCase('tr-TR'))
      );
      
      setGlobalUsedWords(allWordsSet);
      setUsedWords(myWordsSet);
    }
  } catch (error) {
    console.error('❌ Word sync error:', error);
  } finally {
    syncingRef.current = false;
  }
};

// Tournament activity tracking (removed - not needed for core functionality)

  // AI continuous play effect - unified for all modes when playing with AI
useEffect(() => {
  const aiPlaying = isPlayingWithAI();
  
  if (!aiPlaying || !gameStarted || gameEnded || !user) {
    console.log('🤖 AI not playing:', { aiPlaying, gameStarted, gameEnded, gameMode });
    return;
  }

  console.log('🤖 Starting AI play interval for game mode:', gameMode);

  const aiPlayInterval = setInterval(() => {
    const timeSincePlayerAction = Date.now() - lastPlayerAction;
    const minDelayAfterPlayerAction = 1500;
    
    if (timeSincePlayerAction < minDelayAfterPlayerAction) {
      console.log('🤖 Waiting for player action cooldown');
      return;
    }
    
    // AI kelime seçimi
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
          'KALE', 'KÖPEK', 'KUŞU', 'BALINA', 'ASLAN', 'KAPLAN', 'FİL',
          'SÜT', 'KOLA', 'ÇAY', 'KAHVE', 'ŞEKER', 'TUZ', 'YAĞLI', 'EKŞİ',
          'EV', 'KAPI', 'PENCERE', 'ODA', 'SALON', 'MUTFAK', 'BANYO', 'YATAK'
        ];
        
        const shuffledWords = potentialWords.sort(() => Math.random() - 0.5);
        let wordUsed = false;
        
        for (const word of shuffledWords) {
          const normalizedWord = word.toLocaleUpperCase('tr-TR');
          
          // Global kullanılmış kelimeler kontrolü - tüm oyuncuların kelimelerini kontrol et
          if (!globalUsedWords.has(normalizedWord)) {
            // Rastgele puan (daha dengeli)
            const points = Math.floor(Math.random() * 15) + 8; // 8-22 puan
            
            console.log(`🤖 AI used word in ${gameMode}: ${word} with ${points} points (Total opponents: ${opponentScore + points})`);
            
            // Score güncelleme
            const newOpponentScore = opponentScore + points;
            setOpponentScore(newOpponentScore);
            setOpponentWords(prev => [...prev, word]);
            setOpponentWordsWithScores(prev => [...prev, { word, score: points }]);
            
            // Ses efekti
            playSound('correctWord');
            
            // Global kullanılmış kelimeler listesine ekle
            setGlobalUsedWords(prev => new Set([...prev, normalizedWord]));
            
            // Turnuva modunda Supabase'i de güncelle
            if (gameMode === 'tournament' && tournamentMatch && user) {
              const isPlayer1 = tournamentMatch.player1_id === user.id;
              const updateField = isPlayer1 ? 'player2_score' : 'player1_score';
              
              try {
                await supabase
                  .from('tournament_matches')
                  .update({
                    [updateField]: newOpponentScore,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', tournamentMatch.id);
                
                console.log('🏆 Tournament bot score updated in DB:', newOpponentScore);
              } catch (error) {
                console.error('❌ Bot tournament score update error:', error);
              }
            }
            
            wordUsed = true;
            break;
          }
        }
        
        // Kelime bulunamazsa küçük puan ver
        if (!wordUsed) {
          const fallbackPoints = Math.floor(Math.random() * 6) + 3; // 3-8 puan
          const newScore = opponentScore + fallbackPoints;
          setOpponentScore(newScore);
          console.log(`🤖 AI couldn't find unused word, got fallback ${fallbackPoints} points (Total: ${newScore})`);
          
          // Turnuva modunda fallback için de DB güncelle
          if (gameMode === 'tournament' && tournamentMatch && user) {
            const isPlayer1 = tournamentMatch.player1_id === user.id;
            const updateField = isPlayer1 ? 'player2_score' : 'player1_score';
            
            try {
              await supabase
                .from('tournament_matches')
                .update({
                  [updateField]: newScore,
                  updated_at: new Date().toISOString()
                })
                .eq('id', tournamentMatch.id);
            } catch (error) {
              console.error('❌ Bot fallback score update error:', error);
            }
          }
        }
        
      } catch (error) {
        console.error('🤖 AI word selection error:', error);
        // Hata durumunda da küçük puan ver
        const errorPoints = Math.floor(Math.random() * 5) + 2;
        setOpponentScore(prev => prev + errorPoints);
        console.log(`🤖 AI error, got ${errorPoints} points`);
      }
    };

    selectAIWord();
  }, 2500 + Math.random() * 3000);

  return () => {
    console.log('🤖 Stopping AI play interval for game mode:', gameMode);
    clearInterval(aiPlayInterval);
  };
}, [gameStarted, gameEnded, gameMode, user?.id, isPlayingWithAI, globalUsedWords, tournamentMatch?.id, opponentScore, lastPlayerAction, playSound]);

// lastPlayerAction'ı başlat
useEffect(() => {
  if (gameStarted && !gameEnded) {
    setLastPlayerAction(Date.now());
  }
}, [gameStarted, gameEnded]);

// Multiplayer (private-room & random-match) waiting/start logic
useEffect(() => {
  if (gameMode === 'private-room' || gameMode === 'random-match') {
    const realPlayers = participants.filter(p => !p.is_bot && p.user_id !== null);
    const roomActive = currentRoom?.status === 'active';
  
    if (roomActive && realPlayers.length >= 2) {
      console.log('✅ 2 gerçek oyuncu hazır - OYUN BAŞLIYOR!');
      setWaitingForPlayer(false);

      // 🎯 SERVER-SIDE COUNTDOWN: Oyun başlamadıysa server'dan countdown başlat
      if (!gameStarted && !showCountdown && !gameHasStartedRef.current && currentRoom?.id) {
        (async () => {
          try {
            const { data, error } = await supabase.rpc('start_game_countdown', {
              p_room_id: currentRoom.id
            });
            
            if (!error && data) {
              console.log('🎯 Server countdown başlatıldı:', data);
              setCountdownServerTime(data);
              setShowCountdown(true);
              setGameStarted(false);
            }
          } catch (err) {
            console.error('Countdown başlatma hatası:', err);
            // Fallback: client-side countdown
            setShowCountdown(true);
            setGameStarted(false);
          }
        })();
      }
      
      if (!hasShownStartMessage) {
        setHasShownStartMessage(true);
        const modeLabel = gameMode === 'private-room' ? 'Özel Oda' : 'Rastgele Eşleşme';
        toast({
          title: `🎮 ${modeLabel} Başladı!`,
          description: `${gameType === 'score' ? 'Puanlı' : 'Süreli'} oyun başladı!`,
          duration: 2000,
        });
      }
    } else {
      setWaitingForPlayer(true);
      // Oyun başlamadan önce beklemeye dönerse tekrar geri sayım hakkı tanı
      if (!gameStarted) {
        gameHasStartedRef.current = false;
      }
      setHasShownStartMessage(false);
    }
  }
}, [participants, gameMode, hasShownStartMessage, gameType, toast, currentRoom?.status, gameStarted, showCountdown]);

// Real-time rematch response listener (istek gönderen taraf için)
useEffect(() => {
  if (!currentRoom || (gameMode !== 'private-room' && gameMode !== 'random-match') || !user || !waitingForRematchResponse) return;
  
  console.log('🔄 Rematch response listener aktif:', { user: user.id, waiting: waitingForRematchResponse });
  
  const rematchResponseChannel = supabase
    .channel(`rematch-response-${user.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rematch_requests',
      filter: `from_user_id=eq.${user.id}`
    }, (payload) => {
      console.log('🔄 Rematch response alındı:', payload.new);
      const request = payload.new as any;
      
      if (request.status === 'accepted') {
        console.log('✅ Rematch kabul edildi!');
        setWaitingForRematchResponse(false);
        setRematchRequested(false);
        disconnectHandledRef.current = false;
        
        toast({
          title: 'Tekrar Oyun Kabul Edildi!',
          description: 'Yeni odaya katılıyorsunuz...',
          duration: 2000,
        });
        
        // Odaya katıl ve oyunu başlat
        if (request.room_code) {
          setTimeout(async () => {
            const success = await joinRoom(request.room_code);
            if (success) {
              console.log('✅ Rematch request sender: odaya katıldı, yeni oyun başlatılıyor');
              // Oyun durumunu tamamen sıfırla ve geri sayımı başlat
              resetGameForRematch();
              setTimeout(async () => {
                // 🎯 SERVER-SIDE COUNTDOWN for rematch
                if (currentRoom?.id) {
                  try {
                    const { data, error } = await supabase.rpc('start_game_countdown', {
                      p_room_id: currentRoom.id
                    });
                    if (!error && data) {
                      setCountdownServerTime(data);
                    }
                  } catch (err) {
                    console.error('Rematch countdown error:', err);
                  }
                }
                setShowCountdown(true);
              }, 500);
              // Aynı route ise no-op; yine de güvenli olması için replace ile yönlendir
              const targetRoute = gameMode === 'random-match' ? `/game/random-match?type=${gameType}` : `/game/private-room?type=${gameType}`;
              navigate(targetRoute, { replace: true });
            }
          }, 1000);
        }
      } else if (request.status === 'rejected') {
        console.log('❌ Rematch reddedildi');
        setWaitingForRematchResponse(false);
        setRematchRequested(false);
        disconnectHandledRef.current = false;
        
        toast({
          title: 'Tekrar Oyun Reddedildi',
          description: 'Rakibiniz tekrar oynamak istemiyor.',
          variant: 'destructive',
        });
      }
    })
    .subscribe();
  
  return () => {
    console.log('🔄 Rematch response listener temizleniyor');
    supabase.removeChannel(rematchResponseChannel);
  };
}, [currentRoom, gameMode, waitingForRematchResponse, user, toast, joinRoom]);

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

    // Tournament activity tracking removed for simplicity
    
    if (currentWord.length < 3) {
      showCustomToast('Geçersiz Kelime','');
      return;
    }
  
    const normalizedWord = currentWord.toLocaleUpperCase('tr-TR');
  
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
        await forceRefreshProfile?.();
      } catch (error) {
        console.error('❌ Mobile: Database word save error:', error);
        showCustomToast('Kelime kaydedilemedi','');
        clearWord();
        return;
      }
    }

    // Profilde en uzun kelimeyi anında güncelle (tüm modlar)
    if (user) {
      try {
        const newLen = normalizedWord.length;
        const currentLen = (profile?.longest_word_length ?? 0);
        if (newLen > currentLen) {
          await supabase
            .from('profiles')
            .update({ longest_word: normalizedWord, longest_word_length: newLen })
            .eq('id', user.id);
          await forceRefreshProfile?.();
        }
      } catch (e) {
        console.warn('⚠️ Profil en uzun kelime güncellemesi başarısız:', e);
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

    // Ses efektleri triggerWordEffects içinde çalınacak - dublicate removed
    
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
    playSpecialSound('/yes.mp3');
  } else if (currentWord.length === 5) {
    playSpecialSound('/wow2.mp3');
  } else if (currentWord.length >= 6) {
    playSpecialSound('/yahoo.mp3');
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
    
    // Tournament mode için özel opponent isim mantığı
    if (gameMode === 'tournament' && tournamentMatch) {
      const opponentId = tournamentMatch.player1_id === user?.id 
        ? tournamentMatch.player2_id 
        : tournamentMatch.player1_id;
      
      if (!opponentId || String(opponentId).startsWith('bot_')) {
        const seed = Array.from(String(opponentId || 'bot')).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        return { name: generateBotName(seed), icon: Trophy, avatar: null };
      }
      
      const realOpponent = participants.find(p => 
        p.user_id === opponentId && 
        !p.is_bot && 
        p.user_id !== null
      );
      
      if (realOpponent && realOpponent.profiles?.username) {
        return { 
          name: realOpponent.profiles.username, 
          icon: Trophy, 
          avatar: realOpponent.profiles.avatar_url || null 
        };
      }
      
      return { name: 'Turnuva Rakibi', icon: Trophy, avatar: null };
    }

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
                className="w-16 h-16 object-contain"
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
              winner === 'opponent' ? 'Elendiniz!' : 'Beraberlik!'
            ) : (
              winner === 'player' ? 'Kazandınız!' :
              winner === 'opponent' ? 'Kaybettiniz!' : 'Beraberlik!'
            )}
          </h2>
          
          {/* Skorlar */}
          <div className="space-y-2 mb-6">
            <div className="flex justify-between">
              <span>Sizin Puanınız:</span>
              <span className="font-bold">{finalPlayerScore || playerScore}</span>
            </div>
            <div className="flex justify-between">
              <span>Rakip:</span>
              <span className="font-bold">{finalOpponentScore || opponentScore}</span>
            </div>
          </div>
          
          {/* Turnuva için otomatik yönlendirme mesajı */}
          {gameMode === 'tournament' && winner === 'player' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 text-sm font-medium">
                🏆 Turnuva sayfasına yönlendirildiniz!
                 </p>
                 <div className="mt-2">
                <div className="text-yellow-600">
               Sonraki tur için bekleyiniz
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
                      navigate('/tournament');
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
    console.log('🚀 Manuel yönlendirme denemesi...');
    
    // ✅ URL'den tournament ID al
    const tournamentId = searchParams.get('tournament');
    
    if (!tournamentId) {
      console.error('❌ tournament ID URL parameter missing');
      navigate('/tournament');
      return;
    }

    console.log('🏆 Tournament ID from URL:', tournamentId);
    
    // ✅ React Router ile Yönlendirme
    navigate(`/tournament-bracket/${tournamentId}`);
  }} 
  className="w-full"
>
  <Trophy className="w-4 h-4 mr-2" />
  Turnuva Sayfasına Git
</Button>
)}
              </>
            ) : gameMode === 'private-room' || gameMode === 'random-match' ? (
    // ✅ ÖZEL ODA VE RASTGELE EŞLEŞME BUTONLARI - YENİ
    <div className="space-y-2">
      {/* Disconnect durumunda rematch butonu gösterme */}
      {!disconnectWin && !rematchRequested && !waitingForRematchResponse && (
        <Button 
          onClick={() => {
            playSound('buttonClick');
            requestRematch();
          }}
          className="w-full bg-green-500 hover:bg-green-600"
        >
          🔄 Tekrar Oyna İste
        </Button>
      )}
      
      {waitingForRematchResponse && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-blue-800 font-medium">
              Rakibinizin yanıtı bekleniyor...
            </span>
          </div>
          <p className="text-blue-600 text-xs text-center mt-2">
            30 saniye içinde yanıt vermezse istek iptal olacak
          </p>
        </div>
      )}
      
      <Button onClick={() => {
        playSound('buttonClick');
        navigate('/');
      }} variant="outline" className="w-full">
        Ana Menüye Dön
      </Button>
    </div>
  ) : (
              // Normal mod butonları
              <>
                <Button onClick={() => {
                  playSound('buttonClick');
                  navigate('/');
                }} className="w-full">
                  Ana Menüye Dön
                </Button>
                {!disconnectWin && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      playSound('buttonClick');
                      resetGameForRematch();
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
                      setShowCountdown(true);
                      setGameStarted(false);
                      setGameEnded(false);
                      setWinner(null);
                      setTimeWarningPlayed(false);
                      // Jokerler artık envanter sisteminden geliyor
                      setSelectedJoker(null);
                      setHighlightedLetters([]);
                      setIsJokerActive(false);
                    }} 
                    className="w-full"
                  >
                    Tekrar Oyna
                  </Button>
                )}
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
                if (currentRematchRequest.room_code) {
                  const success = await joinRoom(currentRematchRequest.room_code);
                  if (success) {
                    console.log('✅ Rematch receiver: odaya katıldı, yeni oyun başlatılıyor');
                    // Oyun durumunu tamamen sıfırla ve geri sayımı başlat
                    resetGameForRematch();
                    setTimeout(async () => {
                      // 🎯 SERVER-SIDE COUNTDOWN for rematch (receiver)
                      if (currentRoom?.id) {
                        try {
                          const { data, error } = await supabase.rpc('start_game_countdown', {
                            p_room_id: currentRoom.id
                          });
                          if (!error && data) {
                            setCountdownServerTime(data);
                          }
                        } catch (err) {
                          console.error('Rematch countdown error:', err);
                        }
                      }
                      setShowCountdown(true);
                    }, 500);
                    // Aynı route ise no-op; yine de güvenli olması için replace ile yönlendir
                    const targetRoute = gameMode === 'random-match' ? `/game/random-match?type=${gameType}` : `/game/private-room?type=${gameType}`;
                    navigate(targetRoute, { replace: true });
                  }
                }
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

if (waitingForPlayer && gameMode !== 'private-room') {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md text-center">
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="w-16 h-16 bg-green-500 rounded-full mx-auto flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold">
              Eşleşme Bekleniyor
            </h2>
            <p className="text-muted-foreground">
              Rakip aranıyor...
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

const handleCountdownComplete = () => {
  setShowCountdown(false);
  // Süreli modda geri sayım biter bitmez süreyi tamdan başlat
  if (gameType === 'timed') {
    const initial = currentRoom?.time_limit || 120;
    timeLeftRef.current = initial;
    setDisplayTime(initial);
  }
  setGameStarted(true);
  gameHasStartedRef.current = true;
  // Özel oda ve rastgele eşleşmede sunucu senkronunu kısa süre bastır (2:00'ı kesmemesi için)
  if (gameMode === 'private-room' || gameMode === 'random-match') {
    syncSuppressUntilRef.current = Date.now() + 200000; // 3sn (daha kısa süre)
  }
};

return (
  <>
    {showCountdown && (
      <GameCountdown 
        onComplete={handleCountdownComplete}
        serverStartTime={countdownServerTime}
      />
    )}
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 relative overflow-hidden letters-background"
         style={{ 
           paddingTop: 'calc(env(safe-area-inset-top, 8px) + 1rem)', 
           paddingBottom: 'env(safe-area-inset-bottom, 8px)',
           paddingLeft: 'env(safe-area-inset-left, 4px)',
           paddingRight: 'env(safe-area-inset-right, 4px)'
         }}>
      <div className="h-full flex flex-col px-2 relative z-15">
        
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
                        // Sadece touch event olmadığında çalışsın (çift tetiklemeyi engeller)
                        if (e.nativeEvent && 'touches' in e.nativeEvent) return;
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
              submitTouchTsRef.current = Date.now();
              playSound('buttonClick');
              submitWord();
            }}
            onClick={(e) => {
              e.preventDefault();
              // Dokunmatik cihazlarda çift tetiklemeyi önle
              if (Date.now() - submitTouchTsRef.current < 500) return;
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
              if (currentRematchRequest.room_code) {
                const success = await joinRoom(currentRematchRequest.room_code);
                if (success) {
                  console.log('✅ Rematch odaya katıldı, oyun sayfasına yönlendiriliyor');
                  // Oyun durumunu tamamen sıfırla
                  resetGameForRematch();
                  // Yeni oyun başlatması için küçük gecikme
                  setTimeout(async () => {
                    // 🎯 SERVER-SIDE COUNTDOWN
                    if (currentRoom?.id) {
                      try {
                        const { data, error } = await supabase.rpc('start_game_countdown', {
                          p_room_id: currentRoom.id
                        });
                        if (!error && data) {
                          setCountdownServerTime(data);
                        }
                      } catch (err) {
                        console.error('Countdown error:', err);
                      }
                    }
                    setShowCountdown(true);
                  }, 500);
                }
              }
            }
          }}>
            Evet, Tekrar Oyna
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
);
};
export default GamePage;