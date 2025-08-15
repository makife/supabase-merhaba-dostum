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
  Bot,
  Shuffle,
  Lightbulb,
  PenTool
} from 'lucide-react';

interface GamePageProps {
  gameMode: 'vs-computer' | 'private-room' | 'random-match' | 'tournament';
  onGameComplete?: (winnerId: string, player1Score: number, player2Score: number) => void;
  tournamentMatch?: any;
  gameType?: 'timed' | 'score';
}

// Joker türleri
interface JokerState {
  degistir: number; // Kalan kullanım sayısı
  fisilida: number;
  senYaz: number;
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
  };

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

  // JOKER FONKSİYONLARI

  // 1. Değiştir Jokeri - 5 harf değiştir (3 sesli, 2 sessiz)
  const useDegisTirJoker = () => {
    if (jokers.degistir <= 0 || isJokerActive) return;
    
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

    setHighlightedLetters(positions); // Tüm değişen pozisyonları highlight et
  
    setTimeout(() => {
    setHighlightedLetters([]); // 1 saniye sonra highlight'ı kaldır
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
      
      const { data: playerData } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      
      if (playerData?.avatar_url) {
        setPlayerAvatar(playerData.avatar_url);
      }

      if (gameMode === 'private-room' && participants.length >= 2) {
        const opponent = participants.find(p => p.user_id !== user.id);
        if (opponent && (opponent as any).profiles) {
          const opponentProfile = (opponent as any).profiles;
          if (opponentProfile.avatar_url) {
            setOpponentAvatar(opponentProfile.avatar_url);
          }
        }
        
        if (opponent && opponent.score !== undefined && !gameEnded) {
          console.log('🔄 Updating opponent score from participants:', opponent.score);
          setOpponentScore(opponent.score);
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
  }, [user, participants, gameMode, currentRoom]);

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
  // Latin karakterleri Türkçe'ye çevir
  const latinToTurkish = (text: string): string => {
    return text
      .toUpperCase()
      .replace(/I/g, 'İ')  // Latin I -> Turkish İ
      .replace(/S/g, 'Ş')  // Bazı S'ler Ş olabilir (opsiyonel)
      .replace(/G/g, 'Ğ')  // Bazı G'ler Ğ olabilir (opsiyonel)  
      .replace(/C/g, 'Ç')  // Bazı C'ler Ç olabilir (opsiyonel)
      .replace(/U/g, 'Ü')  // Bazı U'lar Ü olabilir (opsiyonel)
      .replace(/O/g, 'Ö')  // Bazı O'lar Ö olabilir (opsiyonel)
      .trim();
  };

  const normalizedWord = word.toUpperCase().trim();
  
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

  // Check against wordlist - HEM ORİJİNAL HEM TÜRKÇELEŞTİRİLMİŞ HALİ
  if (wordlistLoaded) {
    const wordExists = Array.from(wordlist).some(dictWord => {
      const originalMatch = dictWord.toUpperCase() === normalizedWord;
      const turkishMatch = latinToTurkish(dictWord).toUpperCase() === normalizedWord;
      return originalMatch || turkishMatch;
    });
    
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
}, [wordlist, wordlistLoaded]);
  
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
  }, [gameStarted, gameEnded, gameType, timeWarningPlayed, playTimeWarningSequence]);

  // Check for winner and apply end game bonuses
  const checkWinnerWithScores = useCallback(async (currentPlayerScore: number, currentOpponentScore: number) => {
    if (gameEnded || winner !== null) return;
    
    console.log('🏆 Checking winner with scores - Player:', currentPlayerScore, 'Opponent:', currentOpponentScore);
    
    let gameResult: 'player' | 'opponent' | 'tie';
    let bonusPoints = 0;
    
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
      gameResult = 'tie';
      bonusPoints = 25;
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
  }, [gameEnded, winner, user, currentRoom, gameMode, endGame, playSound, playCelebrationSound, playGameLoseSound, toast, participants, playerWordsWithScores, opponentWordsWithScores]);

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
          return true; // Always AI
        case 'private-room':
          return participants.length < 2; // AI if no second player
        case 'random-match':
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
            'ARKADAŞ', 'AILE', 'İNSAN', 'ÇOCUK', 'BEBEK', 'YAŞ', 'GÜN', 'GECE',
            'SABAH', 'ÖĞLE', 'AKŞAM', 'HAFTA', 'AY', 'YIL', 'ZAMAN', 'SAAT'
          ];
          
          // Shuffle and try words until we find a valid unused one
          const shuffledWords = potentialWords.sort(() => Math.random() - 0.5);
          
          for (const word of shuffledWords) {
            const normalizedWord = word.toUpperCase();
            
            // Kullanılmış kelime kontrolü
            if (!usedWords.has(normalizedWord)) {
              // LOCAL WORDLIST CHECK FOR AI
              if (wordlistLoaded && wordlist.has(normalizedWord)) {
                const points = Math.floor(Math.random() * 25) + 10;
                console.log(`🤖 AI used validated word (local): ${word} in ${gameMode} mode with ${points} points`);
                
                setOpponentScore(prev => prev + points);
                
                // Store AI word with score for statistics
                setOpponentWords(prev => [...prev, word]);
                setOpponentWordsWithScores(prev => [...prev, { word, score: points }]);
                
                playSound('correctWord');
                
                // Update used words
                setUsedWords(prev => new Set([...prev, normalizedWord]));
                console.log('🤖 AI added word to used:', normalizedWord);
                return;
              } else if (!wordlistLoaded) {
                // Fallback if wordlist not loaded
                const points = Math.floor(Math.random() * 15) + 8;
                console.log(`🤖 AI used word (no wordlist): ${word} with ${points} points`);
                
                setOpponentScore(prev => prev + points);
                setOpponentWords(prev => [...prev, word]);
                setOpponentWordsWithScores(prev => [...prev, { word, score: points }]);
                playSound('correctWord');
                setUsedWords(prev => new Set([...prev, normalizedWord]));
                return;
              }
            }
          }
          
          // If no valid word found, AI gets fewer points
          const opponentPoints = Math.floor(Math.random() * 10) + 5;
          setOpponentScore(prev => prev + opponentPoints);
          console.log(`🤖 AI couldn't find unused word, got ${opponentPoints} points in ${gameMode} mode`);
          
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
  }, [gameStarted, gameEnded, gameMode, participants.length, usedWords, playSound, lastPlayerAction, isPlayingWithAI, wordlist, wordlistLoaded]);

  // Private room logic
  useEffect(() => {
    if (gameMode === 'private-room') {
      if (participants.length >= 2) {
        console.log('✅ 2 players ready - START GAME FOR BOTH');
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
        console.log('⏳ Waiting for second player...');
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
  }, [participants, gameMode, hasShownStartMessage, gameType]);

  // Handle letter click
  const handleLetterClick = (letter: string, row: number, col: number) => {
    if (gameEnded || waitingForPlayer || isJokerActive) return;

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
  };

  // Clear current word
  const clearWord = () => {
    setSelectedLetters([]);
    setCurrentWord('');
  };

  // Submit word - Using local wordlist validation
  const submitWord = async () => {
    if (waitingForPlayer || isJokerActive) return;
    
    setLastPlayerAction(Date.now());
    
    if (currentWord.length < 3) {
      toast({
        title: 'Geçersiz Kelime',
        description: 'Kelime en az 3 harf olmalıdır.',
        variant: 'destructive',
        duration: 400, // 0.5 saniye
      });
      return;
    }

    const normalizedWord = currentWord.toUpperCase();
    
    // Önce kullanılmış kelime kontrolü yap
    if (usedWords.has(normalizedWord)) {
      toast({
        title: 'Kelimeyi Zaten Kullandınız',
        description: 'Bu kelimeyi daha önce kullandınız.',
        variant: 'destructive',
        duration: 400, // 0.5 saniye
      });
      playSound('wrongWord');
      clearWord();
      return;
    }

    console.log('🔍 Validating word locally:', currentWord);
    
    // LOCAL WORDLIST VALIDATION
    const result = validateWordLocal(currentWord);
    
    if (!result.isValid) {
      playSound('wrongWord');
      toast({
        title: 'Geçersiz Kelime',
        description: result.message,
        variant: 'destructive',
        duration: 400, // 0.5 saniye
      });
      clearWord();
      return;
    }

    console.log('✅ Word accepted (local validation):', currentWord, 'Points:', result.points);
    
    const newUsedWords = new Set([...usedWords, normalizedWord]);
    setUsedWords(newUsedWords);
    
    playSound('correctWord');
    const newScore = playerScore + result.points;
    setPlayerScore(newScore);
    
    setPlayerWords(prev => [...prev, currentWord]);
    setPlayerWordsWithScores(prev => [...prev, { word: currentWord, score: result.points }]);
    
    triggerWordEffects();
    
    if (currentRoom) {
      await updateScore(newScore);
    }

    // Update total score in database for level progression
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
  };

  // Trigger word effects (confetti/fireworks) if purchased
  const triggerWordEffects = () => {
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
  };

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
  
  // Get opponent info based on game mode with avatar
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

  if (gameEnded) {
 return (
   <div className="min-h-screen flex items-center justify-center p-4 game-grid relative overflow-hidden">
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
               src="/public/sevinc.gif" 
               alt="Sevinç" 
               className="w-16 h-16 object-contain animate-bounce"
             />
           )}
           {winner === 'opponent' && (
             <img 
               src="/public/uzgun.gif" 
               alt="Üzgün" 
               className="w-16 h-16 object-contain"
             />
           )}
           {winner === 'tie' && (
             <img 
               src="/public/sabit.gif" 
               alt="Beraberlik" 
               className="w-16 h-16 object-contain"
             />
           )}
         </div>
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
               // Reset jokers
               setJokers({ degistir: 3, fisilida: 3, senYaz: 3 });
               setSelectedJoker(null);
               setHighlightedLetters([]);
               setIsJokerActive(false);
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted relative overflow-hidden"
       style={{ 
         paddingTop: 'env(safe-area-inset-top, 8px)', 
         paddingBottom: 'env(safe-area-inset-bottom, 8px)',
         paddingLeft: 'env(safe-area-inset-left, 4px)',
         paddingRight: 'env(safe-area-inset-right, 4px)'
       }}>
      <div className="h-full flex flex-col px-2">
        {/* Header */}
        <div className="flex items-center justify-between py-2 shrink-0">
          <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-8" onClick={() => {
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
        <div className="grid grid-cols-2 gap-2 mb-2 shrink-0">
          <Card className="light-gradient border-0">
            <CardContent className="p-2 text-center relative overflow-hidden">
              <Avatar className="w-10 h-10 mx-auto mb-1">
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
            <CardContent className="p-2 text-center relative overflow-hidden">
              <Avatar className="w-10 h-10 mx-auto mb-1">
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
<Card className="bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200 joker-panel-float">
  <CardContent className="p-2">
    <div className="flex justify-between items-center">
      <h3 className="text-sm font-bold text-purple-800 mb-2">🎭 Jokerler</h3>
    </div>
    <div className="grid grid-cols-3 gap-1">
      {/* Değiştir Jokeri - DÜZELTME: onClick doğru yerde */}
      <Button
        variant={selectedJoker === 'degistir' ? 'default' : 'outline'}
        size="sm"
        className="joker-button flex flex-col items-center p-1 h-auto relative text-xs focus:bg-purple-200"
        onClick={() => {
          setSelectedJoker('degistir');
          useDegisTirJoker();
       }}
        disabled={jokers.degistir <= 0 || isJokerActive}
      >
        <Shuffle className="w-3 h-3 mb-0.5" />
        <span className="text-xs">Değiştir</span>
        <Badge variant="secondary" className="joker-badge absolute -top-1 -right-1 text-xs min-w-5 h-5 flex items-center justify-center">
          {jokers.degistir}
        </Badge>
      </Button>

      {/* Fısılda Jokeri - DÜZELTME: onClick doğru yerde */}
      <Button
        variant={selectedJoker === 'fisilida' ? 'default' : 'outline'}
        size="sm"
        className="joker-button flex flex-col items-center p-1 h-auto relative text-xs"
        onClick={() => {
          setSelectedJoker('fisilda');
          useFisildaJoker();
       }}
        disabled={jokers.fisilida <= 0 || isJokerActive}
      >
        <Lightbulb className="w-4 h-4 mb-1" />
        <span className="text-xs">Fısılda</span>
        <Badge variant="secondary" className="joker-badge absolute -top-1 -right-1 text-xs min-w-5 h-5 flex items-center justify-center">
          {jokers.fisilida}
        </Badge>
      </Button>

      {/* Sen Yaz Jokeri - DÜZELTME: onClick doğru yerde */}
      <Button
        variant={selectedJoker === 'senYaz' ? 'default' : 'outline'}
        size="sm"
        className="joker-button flex flex-col items-center p-1 h-auto relative text-xs"
        onClick={() => {
          setSelectedJoker('senYaz');
          useSenYazJoker();
       }}
        disabled={jokers.senYaz <= 0 || isJokerActive}
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
              <Badge variant="secondary" className="bg-white/20 text-white... text-sm px-2 py-0.5 min-w-8 h-8 flex items-center justify-center">
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
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <Button 
            variant="outline" 
            onClick={clearWord}
            className="h-9"
            disabled={selectedLetters.length === 0 || isJokerActive}
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
            disabled={currentWord.length < 3 || isValidating || isJokerActive}
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
