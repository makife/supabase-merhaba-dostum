/**
 * RandomMatchPage.tsx - Production-Ready Random Match Implementation
 * 
 * Temiz sayfa yaklaşımı ile yazıldı:
 * - Supabase Realtime tabanlı eşleşme
 * - Server-authoritative timing (server time offset)
 * - Minimal state, maksimum güvenilirlik
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion, LayoutGroup } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useWordValidation } from "@/hooks/useWordValidation";
import { useSounds } from "@/hooks/useSounds";
import { useJokerInventory } from "@/hooks/useJokerInventory";
import { supabase, getSupabaseClient } from "@/integrations/supabase/client";
import { useServerTime } from "@/hooks/useServerTime";
import GameCountdown from "@/components/GameCountdown";
import {
  ArrowLeft,
  Trash2,
  Send,
  User,
  Shuffle,
  Lightbulb,
  PenTool,
  Loader2,
  Crown,
} from "lucide-react";
import { matchBanlist } from "@/utils/matchBanlist";
import { useGlobalResync } from "@/hooks/useGlobalResync";

// ============= TYPES =============
interface RoomData {
  id: string;
  status: string;
  current_grid: string[] | null;
  countdown_started_at: string | null;
  ends_at: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number;
  player2_score: number;
  time_limit: number;
}

interface OpponentInfo {
  id: string;
  username: string;
  avatar_url: string | null;
  isPremium?: boolean;
}

// ============= CONSTANTS =============
const GAME_DURATION = 120; // 2 dakika
const COUNTDOWN_DURATION = 5; // 5 saniye geri sayım
const BUFFER_DURATION = 5; // 5 saniye hazırlık

// ============= HELPER FUNCTIONS =============
const generateSeededGrid = (seed: string): string[][] => {
  const seedNum = parseInt(seed.slice(-8), 16) || Date.now();
  let currentSeed = seedNum;

  const seededRandom = () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    return currentSeed / 4294967296;
  };

  const letterPool = [
    "A", "A", "A", "A", "A", "A", "A", "A",
    "E", "E", "E", "E", "E", "E", "E",
    "İ", "İ", "İ", "İ", "İ", "İ",
    "I", "I", "I", "I", "I",
    "O", "O", "O", "O", "O",
    "U", "U", "U", "U",
    "Ü", "Ü", "Ü",
    "Ö", "Ö", "Ö",
    "L", "L", "L", "L", "L",
    "N", "N", "N", "N", "N",
    "R", "R", "R", "R", "R",
    "K", "K", "K", "K",
    "M", "M", "M", "M",
    "T", "T", "T", "T",
    "S", "S", "S", "S",
    "D", "D", "D",
    "Y", "Y", "Y",
    "B", "B", "B",
    "C", "C",
    "Ç", "Ç",
    "F", "F",
    "G", "G",
    "Ğ", "Ğ",
    "H", "H",
    "J",
    "P", "P",
    "Ş", "Ş",
    "V", "V",
    "Z",
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
  return grid;
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const calculateWordScore = (word: string): number => {
  const baseScore = word.length * 10;
  const multiplier = word.length >= 6 ? 2 : word.length >= 4 ? 1.5 : 1;
  return Math.floor(baseScore * multiplier * 3); // random-match x3 multiplier
};

// ============= MAIN COMPONENT =============
const RandomMatchPage = () => {
  const { user } = useAuth();
  const { profile, isPremium, addBonusCredits } = useUser();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("room");

  // Hooks
  const { serverNow, offset: serverTimeOffset, isReady: serverTimeReady } = useServerTime();
  const { validateWord, isValidating } = useWordValidation();
  const { playSound, playCelebrationSound, playGameLoseSound, playTieSound, playSpecialSound } = useSounds();
  const { jokers, useJoker } = useJokerInventory();

  // ============= REFS =============
  const isMountedRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownInitiatedRef = useRef(false);
  const statsUpdatedRef = useRef(false);
  const gameStartTimeRef = useRef<number>(0);
  const firstWordTimeRef = useRef<number | null>(null);

  // ============= ROOM STATE =============
  const [room, setRoom] = useState<RoomData | null>(null);
  const [opponent, setOpponent] = useState<OpponentInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============= GAME STATE =============
  const [gameGrid, setGameGrid] = useState<string[][]>([]);
  const [selectedLetters, setSelectedLetters] = useState<{ letter: string; row: number; col: number }[]>([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [playerWords, setPlayerWords] = useState<string[]>([]);
  const [playerWordsWithScores, setPlayerWordsWithScores] = useState<{ word: string; score: number }[]>([]);
  const [usedWords, setUsedWords] = useState<Set<string>>(new Set());
  const [displayTime, setDisplayTime] = useState(GAME_DURATION);

  // ============= WORDLIST STATE =============
  const [wordlist, setWordlist] = useState<Set<string>>(new Set());
  const [wordlistLoaded, setWordlistLoaded] = useState(false);

  // ============= UI STATE =============
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownServerTime, setCountdownServerTime] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [winner, setWinner] = useState<"player" | "opponent" | "tie" | null>(null);
  const [preparingOpponent, setPreparingOpponent] = useState<"preparing" | "ready" | null>(null);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [inputFlash, setInputFlash] = useState<"success" | "error" | null>(null);
  const [highlightedLetters, setHighlightedLetters] = useState<{ row: number; col: number }[]>([]);
  const [isJokerActive, setIsJokerActive] = useState(false);
  const [selectedJoker, setSelectedJoker] = useState<string | null>(null);

  // Derived state
  const currentWord = useMemo(() => selectedLetters.map((s) => s.letter).join(""), [selectedLetters]);

  // ============= GLOBAL RESYNC - Bağlantı kopup geldiğinde oda ve skor senkronizasyonu =============
  const handleMatchResync = useCallback(async () => {
    if (!roomId || !user?.id || gameEnded) return;
    
    console.log("🔄 [RandomMatchPage] Bağlantı geri geldi - oda verisi senkronize ediliyor...");
    
    try {
      // Room verisini yeniden çek
      const { data: roomData, error: roomError } = await supabase
        .from("game_rooms")
        .select("*")
        .eq("id", roomId)
        .single();
      
      if (roomError || !roomData) {
        console.log("❌ [Resync] Oda bulunamadı");
        return;
      }
      
      setRoom(roomData as RoomData);
      
      // Skorları güncelle
      const myId = user.id;
      const isPlayer1 = roomData.player1_id === myId;
      
      if (isPlayer1) {
        setOpponentScore(roomData.player2_score || 0);
      } else {
        setOpponentScore(roomData.player1_score || 0);
      }
      
      console.log("✅ [Resync] Oda verisi senkronize edildi - skorlar:", {
        p1: roomData.player1_score,
        p2: roomData.player2_score
      });
      
      // Opponent bilgisi yoksa yükle
      if (!opponentRef.current) {
        const opponentId = isPlayer1 ? roomData.player2_id : roomData.player1_id;
        if (opponentId) {
          const { data: opponentData } = await supabase
            .from("profiles")
            .select("id, username, avatar_url, premium_until")
            .eq("id", opponentId)
            .single();
          
          if (opponentData) {
            const isPremiumActive = opponentData.premium_until ? new Date(opponentData.premium_until) > new Date() : false;
            setOpponent({ ...opponentData, isPremium: isPremiumActive });
            opponentRef.current = { ...opponentData, isPremium: isPremiumActive };
            console.log("✅ [Resync] Opponent yüklendi:", opponentData.username);
          }
        }
      }
    } catch (err) {
      console.error("❌ [Resync] Hata:", err);
    }
  }, [roomId, user?.id, gameEnded]);

  // Priority: true - Oyun sayfası kritik
  useGlobalResync({
    onResync: handleMatchResync,
    isActive: !gameEnded && !!roomId,
    isPriority: true,
    pageName: 'RandomMatchPage'
  });

  // ============= LOAD WORDLIST =============
  useEffect(() => {
    const loadWordlist = async () => {
      try {
        const response = await fetch("/wordlist.txt");
        if (!response.ok) throw new Error("Wordlist fetch failed");
        const text = await response.text();
        const words = text
          .split("\n")
          .map((word) => word.trim().toLocaleUpperCase("tr-TR"))
          .filter((word) => word.length >= 3);
        
        const wordSet = new Set(words);
        setWordlist(wordSet);
        setWordlistLoaded(true);
        console.log(`✅ Wordlist loaded: ${wordSet.size} words`);
      } catch (error) {
        console.error("❌ Failed to load wordlist:", error);
        setWordlistLoaded(false);
      }
    };
    loadWordlist();
  }, []);

  // ============= CLEANUP =============
  // ⚠️ DEVRE DIŞI - Bağlantı koruması
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // ❌ DEVRE DIŞI: supabase.removeChannel(channelRef.current);
      console.log("⚠️ [RandomMatchPage] Main cleanup ATLANYOR (bağlantı koruması)");
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // ============= REDIRECT IF NO ROOM =============
  useEffect(() => {
    if (!roomId || roomId === "ROOM_ID") {
      console.log("⚠️ Geçersiz room ID, ana sayfaya yönlendiriliyor...");
      navigate("/", { replace: true });
    }
  }, [roomId, navigate]);

  // ============= LOAD ROOM & OPPONENT =============
  const opponentRef = useRef<OpponentInfo | null>(null);
  
  useEffect(() => {
    if (!roomId || roomId === "ROOM_ID" || !user?.id) return;

    const loadRoom = async () => {
      try {
        // Fetch room
        const { data: roomData, error: roomError } = await supabase
          .from("game_rooms")
          .select("*")
          .eq("id", roomId)
          .single();

        if (roomError || !roomData) {
          console.log("❌ Oda bulunamadı, ana sayfaya yönlendiriliyor...");
          toast({
            title: "Oda bulunamadı",
            description: "Eşleşme bulunamadı veya süresi doldu.",
            variant: "destructive",
          });
          navigate("/", { replace: true });
          return;
        }

        setRoom(roomData as RoomData);

        // Determine which player we are - CRITICAL: use user.id not room player id
        const myId = user.id;
        const isPlayer1 = roomData.player1_id === myId;
        const isPlayer2 = roomData.player2_id === myId;
        
        console.log("🎮 Room loaded - myId:", myId);
        console.log("🎮 Room players - p1:", roomData.player1_id, "p2:", roomData.player2_id);
        console.log("🎮 I am - isPlayer1:", isPlayer1, "isPlayer2:", isPlayer2);
        console.log("🔢 Scores - p1:", roomData.player1_score, "p2:", roomData.player2_score);

        // Set initial scores correctly
        if (isPlayer1) {
          setPlayerScore(roomData.player1_score || 0);
          setOpponentScore(roomData.player2_score || 0);
        } else if (isPlayer2) {
          setPlayerScore(roomData.player2_score || 0);
          setOpponentScore(roomData.player1_score || 0);
        }

        // Set grid from room - CRITICAL: This MUST be the same for both players
        if (roomData.current_grid && Array.isArray(roomData.current_grid) && roomData.current_grid.length === 16) {
          const flat = roomData.current_grid as string[];
          const grid: string[][] = [];
          for (let i = 0; i < 4; i++) {
            grid.push(flat.slice(i * 4, (i + 1) * 4));
          }
          console.log("📊 Grid from DB:", grid);
          setGameGrid(grid);
        } else {
          // FALLBACK: generate from room ID - SAME SEED = SAME GRID
          console.log("⚠️ No grid in DB, generating from roomId seed:", roomId);
          const seededGrid = generateSeededGrid(roomId);
          console.log("📊 Seeded grid:", seededGrid);
          setGameGrid(seededGrid);
        }

        // Load opponent - CRITICAL: wait for this to complete
        const opponentId = isPlayer1 ? roomData.player2_id : roomData.player1_id;
        console.log("👤 Opponent ID to load:", opponentId);
        
        if (opponentId) {
          const { data: opponentData, error: opponentError } = await supabase
            .from("profiles")
            .select("id, username, avatar_url, premium_until")
            .eq("id", opponentId)
            .single();
          
          if (opponentError) {
            console.error("❌ Opponent load error:", opponentError);
          }
          
          if (opponentData) {
            console.log("✅ Opponent loaded:", opponentData.username, opponentData.id);
            const isPremiumActive = opponentData.premium_until ? new Date(opponentData.premium_until) > new Date() : false;
            setOpponent({ ...opponentData, isPremium: isPremiumActive });
            opponentRef.current = { ...opponentData, isPremium: isPremiumActive };
          } else {
            console.log("⚠️ Opponent data null for id:", opponentId);
          }
        } else {
          console.log("⚠️ No opponent ID yet in room data");
        }

        setIsLoading(false);

        // Check if countdown already started - start countdown IMMEDIATELY
        // Buffer animation runs in parallel, countdown starts right away
        if (roomData.countdown_started_at && !countdownInitiatedRef.current) {
          countdownInitiatedRef.current = true;
          
          // Calculate ADJUSTED server time: countdown_started_at + 5s buffer = actual countdown start
          // Bu sayede countdown 5 saniye sonra başlayacak şekilde hesaplanır
          const originalStartTime = new Date(roomData.countdown_started_at).getTime();
          const adjustedStartTime = new Date(originalStartTime + 5000).toISOString(); // Add 5s buffer
          
          console.log("⏱️ Countdown timing:", {
            original: roomData.countdown_started_at,
            adjusted: adjustedStartTime,
            bufferMs: 5000
          });
          
          // Buffer animasyonu: 3.5s hazırlanıyor, 0.5s hazır, 1s boşluk
          setPreparingOpponent("preparing");
          
          setTimeout(() => {
            if (!isMountedRef.current) return;
            setPreparingOpponent("ready");
          }, 3000);
          
          setTimeout(() => {
            if (!isMountedRef.current) return;
            setPreparingOpponent(null);
          }, 3500);
          
          // Countdown'u HEMEN göster ama ADJUSTED time ile (5s sonra başlayacak)
          // Bu sayede 5 4 3 2 1 tam olarak görünür
          setTimeout(() => {
            if (!isMountedRef.current) return;
            setCountdownServerTime(adjustedStartTime);
            setShowCountdown(true);
          }, 5000);
        }

      } catch (err) {
        console.error("Room load error:", err);
        toast({
          title: "Bağlantı hatası",
          description: "Oda yüklenirken hata oluştu.",
          variant: "destructive",
        });
        navigate("/", { replace: true });
      }
    };

    loadRoom();
  }, [roomId, user?.id, navigate, toast]);

  // ============= REALTIME SUBSCRIPTION =============
  // 🆕 Ref ile kanal oluşturma zamanını takip et - gereksiz yeniden oluşturmayı önle
  const channelCreatedRef = useRef(false);
  const channelIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!roomId || !user?.id) return;
    
    // 🛡️ Kanal zaten oluşturulduysa tekrar oluşturma
    if (channelCreatedRef.current && channelIdRef.current === roomId) {
      console.log("📡 [RandomMatchPage] Kanal zaten mevcut, skip...");
      return;
    }

    const myId = user.id;
    let currentChannel: any = null;

    const setupChannel = () => {
      console.log("📡 Setting up realtime subscription for room:", roomId, "myId:", myId);
      
      // 🆕 Sabit kanal adı kullan (Date.now() kullanma!)
      const channelName = `room-${roomId}`;

      currentChannel = getSupabaseClient().channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "game_rooms",
            filter: `id=eq.${roomId}`,
          },
          async (payload) => {
            const newRoom = payload.new as RoomData;
            console.log("📡 Room update received:", {
              status: newRoom.status,
              p1_id: newRoom.player1_id,
              p2_id: newRoom.player2_id,
              p1_score: newRoom.player1_score,
              p2_score: newRoom.player2_score
            });

            setRoom(newRoom);

            // Determine which player we are - CRITICAL: compare with myId
            const isPlayer1 = myId === newRoom.player1_id;
            const isPlayer2 = myId === newRoom.player2_id;
            
            console.log("🔍 Player determination - myId:", myId, "isPlayer1:", isPlayer1, "isPlayer2:", isPlayer2);

            // Update opponent score only (player score is managed locally)
            if (isPlayer1) {
              console.log("📊 I am player1, updating opponent (p2) score to:", newRoom.player2_score);
              setOpponentScore(newRoom.player2_score || 0);
            } else if (isPlayer2) {
              console.log("📊 I am player2, updating opponent (p1) score to:", newRoom.player1_score);
              setOpponentScore(newRoom.player1_score || 0);
            } else {
              console.log("⚠️ I am neither player1 nor player2!");
            }

            // Load opponent if not loaded yet (may have joined after page load)
            // Use ref to avoid stale closure
            if (!opponentRef.current) {
              const opponentId = isPlayer1 ? newRoom.player2_id : newRoom.player1_id;
              if (opponentId) {
                console.log("👤 Loading opponent from realtime update:", opponentId);
                const { data: opponentData, error: opponentError } = await getSupabaseClient()
                  .from("profiles")
                  .select("id, username, avatar_url, premium_until")
                  .eq("id", opponentId)
                  .single();
                
                if (opponentError) {
                  console.error("❌ Failed to load opponent:", opponentError);
                }
                
                if (opponentData) {
                  console.log("✅ Opponent loaded from realtime:", opponentData.username);
                  const isPremiumActive = opponentData.premium_until ? new Date(opponentData.premium_until) > new Date() : false;
                  setOpponent({ ...opponentData, isPremium: isPremiumActive });
                  opponentRef.current = { ...opponentData, isPremium: isPremiumActive };
                }
              }
            }

            // Countdown başlatma - buffer animasyonu ile
            if (newRoom.countdown_started_at && !countdownInitiatedRef.current) {
              console.log("⏱️ Countdown started from realtime - buffer başlıyor");
              countdownInitiatedRef.current = true;
              
              // Calculate ADJUSTED server time: countdown_started_at + 5s buffer = actual countdown start
              const originalStartTime = new Date(newRoom.countdown_started_at).getTime();
              const adjustedStartTime = new Date(originalStartTime + 5000).toISOString();
              
              console.log("⏱️ Realtime countdown timing:", {
                original: newRoom.countdown_started_at,
                adjusted: adjustedStartTime,
                bufferMs: 5000
              });
              
              // Buffer animasyonu: 3.5s hazırlanıyor, 0.5s hazır, 1s boşluk
              setPreparingOpponent("preparing");
              
              setTimeout(() => {
                if (!isMountedRef.current) return;
                setPreparingOpponent("ready");
              }, 3000);
              
              setTimeout(() => {
                if (!isMountedRef.current) return;
                setPreparingOpponent(null);
              }, 3500);
              
              // Countdown'u HEMEN göster ama ADJUSTED time ile (5s sonra başlayacak)
              setTimeout(() => {
                if (!isMountedRef.current) return;
                console.log("⏱️ Buffer tamamlandı, countdown gösteriliyor");
                setCountdownServerTime(adjustedStartTime);
                setShowCountdown(true);
              }, 5000);
            }

            // Game ended
            if (newRoom.status === "finished") {
              // 🆕 gameEnded ref kullanarak closure sorununu önle
              if (!gameEndedRef.current) {
                gameEndedRef.current = true;
                handleGameEnd(newRoom);
              }
            }
          }
        )
        .subscribe((status) => {
          console.log("📡 Realtime subscription status:", status);
          if (status === 'SUBSCRIBED') {
            channelCreatedRef.current = true;
            channelIdRef.current = roomId;
          }
        });

      channelRef.current = currentChannel;
    };

    // İlk setup
    setupChannel();

    // Reconnect event'ini dinle
    // ⚠️ DEVRE DIŞI: removeChannel çağrıları - bağlantı koruması
    const handleReconnect = () => {
      console.log("🔄 [RandomMatchPage] Reconnect algılandı - resubscribe deneniyor");
      
      // Sadece resubscribe dene (yeni kanal oluşturma)
      if (currentChannel && currentChannel.state !== 'joined') {
        try {
          currentChannel.subscribe();
        } catch (e) {}
      }
    };

    window.addEventListener("supabase-reconnected", handleReconnect);

    return () => {
      console.log("📡 ⚠️ Realtime cleanup ATLANYOR (bağlantı koruması)");
      window.removeEventListener("supabase-reconnected", handleReconnect);
      // ❌ DEVRE DIŞI: removeChannel
      // if (currentChannel) {
      //   try {
      //     getSupabaseClient().removeChannel(currentChannel);
      //   } catch (e) {}
      // }
    };
  }, [roomId, user?.id]); // 🆕 gameEnded kaldırıldı - closure sorunu yaratıyordu
  
  // 🆕 gameEnded ref - closure sorununu önlemek için
  const gameEndedRef = useRef(false);
  useEffect(() => {
    gameEndedRef.current = gameEnded;
  }, [gameEnded]);

  // ============= GAME HANDLERS =============
  const handleTimeUp = useCallback(async () => {
    if (gameEnded) return;
    
    setGameEnded(true);
    
    const isWinner = playerScore > opponentScore;
    const isTie = playerScore === opponentScore;
    
    // Determine winner
    if (isWinner) {
      setWinner("player");
      playCelebrationSound();
    } else if (!isTie) {
      setWinner("opponent");
      playGameLoseSound();
    } else {
      setWinner("tie");
      playTieSound();
    }

    // Update game statistics
    if (user && !statsUpdatedRef.current) {
      statsUpdatedRef.current = true;
      
      const gameDuration = 120;
      const wordsJson = playerWordsWithScores.map(w => ({ word: w.word, score: w.score }));
      
      try {
        const { error } = await (supabase.rpc as any)("update_game_stats", {
          p_user_id: user.id,
          p_score: playerScore,
          p_words: wordsJson,
          p_is_winner: isWinner,
          p_game_duration: gameDuration,
          p_first_word_time: firstWordTimeRef.current,
          p_game_mode: "random-match",
        });
        
        if (error) {
          console.error("❌ İstatistik güncelleme hatası:", error);
        } else {
          console.log("✅ İstatistikler güncellendi");
        }
      } catch (err) {
        console.error("❌ İstatistik güncelleme exception:", err);
      }
    }

    setShowResults(true);
  }, [gameEnded, playerScore, opponentScore, user, playerWordsWithScores, playCelebrationSound, playGameLoseSound, playTieSound]);

  // ============= TIMER (timestamp-based) =============
  useEffect(() => {
    if (!gameStarted || gameEnded) return;

    // Oyun başladığında başlangıç zamanını kaydet
    if (!gameStartTimeRef.current) {
      gameStartTimeRef.current = Date.now() + serverTimeOffset;
    }

    let endsAt: number;
    
    if (room?.ends_at) {
      endsAt = new Date(room.ends_at).getTime();
    } else {
      // ends_at yoksa, oyun başlangıç zamanından hesapla
      endsAt = gameStartTimeRef.current + (GAME_DURATION * 1000);
    }

    const updateTimer = () => {
      if (!isMountedRef.current) return;

      const now = Date.now() + serverTimeOffset;
      const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
      
      setDisplayTime(remaining);

      if (remaining <= 0 && !gameEnded) {
        handleTimeUp();
      }
    };

    // Initial update
    updateTimer();

    // Update every 100ms for smooth display
    timerRef.current = setInterval(updateTimer, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [gameStarted, gameEnded, room?.ends_at, serverTimeOffset, handleTimeUp]);

  const handleCountdownComplete = useCallback(() => {
    console.log("🎮 Countdown complete, starting game!");
    setShowCountdown(false);
    setGameStarted(true);
    // Timer GAME_DURATION ile başlamalı - ends_at'tan hesaplanacak
    setDisplayTime(GAME_DURATION);
    
    // Record game start time for first word tracking
    gameStartTimeRef.current = Date.now() + serverTimeOffset;
    
    // ends_at henüz set edilmediyse şimdi hesapla
    if (room && !room.ends_at) {
      const endsAt = new Date(Date.now() + serverTimeOffset + GAME_DURATION * 1000).toISOString();
      supabase
        .from("game_rooms")
        .update({ ends_at: endsAt, status: "active" })
        .eq("id", room.id)
        .then(() => console.log("✅ ends_at set:", endsAt));
    }
  }, [room, serverTimeOffset]);

  const handleGameEnd = useCallback((roomData: RoomData) => {
    // 🆕 Ref kullan - closure sorunu önle
    if (gameEndedRef.current) return;

    setGameEnded(true);
    gameEndedRef.current = true;

    const myScore = user?.id === roomData.player1_id ? roomData.player1_score : roomData.player2_score;
    const theirScore = user?.id === roomData.player1_id ? roomData.player2_score : roomData.player1_score;

    if (myScore > theirScore) {
      setWinner("player");
      playCelebrationSound();
    } else if (theirScore > myScore) {
      setWinner("opponent");
      playGameLoseSound();
    } else {
      setWinner("tie");
      playTieSound();
    }

    setShowResults(true);
  }, [user, playCelebrationSound, playGameLoseSound, playTieSound]); // 🆕 gameEnded kaldırıldı

  // ============= WORD SUBMISSION =============
  const submitWord = useCallback(async () => {
    if (currentWord.length < 3 || !gameStarted || gameEnded || !room) return;

    const word = currentWord.toUpperCase();

    // Check if already used
    if (usedWords.has(word)) {
      setInputFlash("error");
      playSound("wrongWord");
      setTimeout(() => setInputFlash(null), 300);
      toast({ title: "Bu kelime zaten kullanıldı", variant: "destructive" });
      return;
    }

    // Validate word
    const isValid = await validateWord(word);

    if (isValid) {
      const score = calculateWordScore(word);
      const newScore = playerScore + score;

      // Record first word time
      if (firstWordTimeRef.current === null && gameStartTimeRef.current) {
        firstWordTimeRef.current = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
        console.log("⚡ İlk kelime süresi:", firstWordTimeRef.current, "saniye");
      }

      setPlayerScore(newScore);
      setPlayerWords(prev => [...prev, word]);
      setPlayerWordsWithScores(prev => [...prev, { word, score }]);
      setUsedWords(prev => new Set([...prev, word]));
      setInputFlash("success");
      playSound("correctWord");

      // Play special sound for 4+ letter words
      if (word.length >= 4) {
        const specialSounds = ["/yes.mp3", "/wow2.mp3", "/yahoo.mp3"];
        const randomSound = specialSounds[Math.floor(Math.random() * specialSounds.length)];
        playSpecialSound(randomSound);
      }

      // Update score in database
      const scoreField = user?.id === room.player1_id ? "player1_score" : "player2_score";
      await supabase
        .from("game_rooms")
        .update({ [scoreField]: newScore })
        .eq("id", room.id);

      // Record word
      await supabase.from("game_words").insert({
        room_id: room.id,
        player_id: user?.id,
        word,
        points: score,
      });
    } else {
      setInputFlash("error");
      playSound("wrongWord");
      toast({ title: "Geçersiz kelime", variant: "destructive" });
    }

    setTimeout(() => setInputFlash(null), 300);
    setSelectedLetters([]);
  }, [currentWord, gameStarted, gameEnded, room, user, playerScore, usedWords, validateWord, playSound, playSpecialSound, toast]);

  // ============= LETTER HANDLING =============
  const handleLetterClick = useCallback((letter: string, row: number, col: number) => {
    if (!gameStarted || gameEnded) return;

    const isSelected = selectedLetters.some(s => s.row === row && s.col === col);

    if (isSelected) {
      // Remove this and all letters after it
      const index = selectedLetters.findIndex(s => s.row === row && s.col === col);
      setSelectedLetters(prev => prev.slice(0, index));
    } else {
      // Add letter
      setSelectedLetters(prev => [...prev, { letter, row, col }]);
      playSound("buttonClick");
    }
  }, [gameStarted, gameEnded, selectedLetters, playSound]);

  const clearWord = useCallback(() => {
    setSelectedLetters([]);
    setHighlightedLetters([]);
  }, []);

  // ============= JOKER HANDLERS =============
  const useDegisTirJoker = useCallback(async () => {
    if (jokers.degistir <= 0 || !gameStarted || isJokerActive) return;

    playSpecialSound("/degistir.mp3");
    setIsJokerActive(true);

    const vowels = ["A", "E", "İ", "I", "O", "U", "Ü", "Ö"];
    const consonants = ["B", "C", "Ç", "D", "F", "G", "Ğ", "H", "J", "K", "L", "M", "N", "P", "R", "S", "Ş", "T", "V", "Y", "Z"];

    const newGrid = [...gameGrid.map((row) => [...row])];

    // Rastgele 5 pozisyon seç
    const positions: { row: number; col: number }[] = [];
    while (positions.length < 5) {
      const row = Math.floor(Math.random() * 4);
      const col = Math.floor(Math.random() * 4);
      if (!positions.some((p) => p.row === row && p.col === col)) {
        positions.push({ row, col });
      }
    }

    // İlk 3 pozisyona sesli harf
    for (let i = 0; i < 3; i++) {
      newGrid[positions[i].row][positions[i].col] = vowels[Math.floor(Math.random() * vowels.length)];
    }

    // Son 2 pozisyona sessiz harf
    for (let i = 3; i < 5; i++) {
      newGrid[positions[i].row][positions[i].col] = consonants[Math.floor(Math.random() * consonants.length)];
    }

    setHighlightedLetters(positions);
    setGameGrid(newGrid);

    const jokerUsed = await useJoker("degistir");
    if (!jokerUsed) {
      setIsJokerActive(false);
      return;
    }

    setTimeout(() => {
      setHighlightedLetters([]);
      setIsJokerActive(false);
    }, 1000);

    setSelectedLetters([]);
    playSound("correctWord");
  }, [jokers.degistir, gameStarted, isJokerActive, gameGrid, useJoker, playSpecialSound, playSound]);

  const useFisildaJoker = useCallback(async () => {
    if (jokers.fisilida <= 0 || !gameStarted || isJokerActive) return;

    playSpecialSound("/fisilda.mp3");
    setIsJokerActive(true);

    const availableLetters = gameGrid.flat();
    const letterCount: { [key: string]: number } = {};
    availableLetters.forEach((letter) => {
      letterCount[letter] = (letterCount[letter] || 0) + 1;
    });

    // Wordlist'ten geçerli kelimeleri bul
    let validWords: string[] = [];
    if (wordlistLoaded) {
      const wordArray = Array.from(wordlist).map((word) => word.toLocaleUpperCase("tr-TR").trim());
      validWords = wordArray.filter((word) => {
        if (usedWords.has(word)) return false;
        const wordLetterCount: { [key: string]: number } = {};
        for (const letter of word) {
          wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
        }
        for (const [letter, needed] of Object.entries(wordLetterCount)) {
          if ((letterCount[letter] || 0) < needed) return false;
        }
        return true;
      });
    }

    if (validWords.length > 0) {
      const selectedWord = validWords[Math.floor(Math.random() * validWords.length)];

      // Harflerin pozisyonlarını bul
      const wordPositions: { row: number; col: number }[] = [];
      const usedPositions: { row: number; col: number }[] = [];

      for (const letter of selectedWord) {
        for (let row = 0; row < 4; row++) {
          let found = false;
          for (let col = 0; col < 4; col++) {
            if (gameGrid[row][col] === letter && !usedPositions.some((p) => p.row === row && p.col === col)) {
              wordPositions.push({ row, col });
              usedPositions.push({ row, col });
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }

      // Sırayla harfleri göster
      for (let i = 0; i < wordPositions.length; i++) {
        setTimeout(() => {
          setHighlightedLetters([wordPositions[i]]);
          playSound("buttonClick");
          setTimeout(() => setHighlightedLetters([]), 400);
        }, i * 500);
      }

      setTimeout(() => setIsJokerActive(false), wordPositions.length * 500 + 800);

      await useJoker("fisilida");
    } else {
      setIsJokerActive(false);
      toast({
        title: "💡 Fısılda Jokeri",
        description: "Şu an kulağına fısıldayacağım bir kelime aklıma gelmedi. Değiştir jokeri ile yeni harfler al!",
        duration: 4000,
      });
    }
  }, [jokers.fisilida, gameStarted, isJokerActive, gameGrid, wordlist, wordlistLoaded, usedWords, useJoker, playSpecialSound, playSound, toast]);

  const useSenYazJoker = useCallback(async () => {
    if (jokers.senYaz <= 0 || !gameStarted || isJokerActive) return;

    playSpecialSound("/senyaz.mp3");
    setIsJokerActive(true);

    const availableLetters = gameGrid.flat();
    const letterCount: { [key: string]: number } = {};
    availableLetters.forEach((letter) => {
      letterCount[letter] = (letterCount[letter] || 0) + 1;
    });

    // Wordlist'ten geçerli kelimeleri bul
    let validWords: string[] = [];
    if (wordlistLoaded) {
      const wordArray = Array.from(wordlist);
      validWords = wordArray.filter((word) => {
        if (usedWords.has(word)) return false;
        const wordLetterCount: { [key: string]: number } = {};
        for (const letter of word) {
          wordLetterCount[letter] = (wordLetterCount[letter] || 0) + 1;
        }
        for (const [letter, needed] of Object.entries(wordLetterCount)) {
          if ((letterCount[letter] || 0) < needed) return false;
        }
        return true;
      });
    }

    if (validWords.length === 0) {
      setIsJokerActive(false);
      toast({
        title: "✍️ Sen Yaz Jokeri",
        description: "Düşünüyorum ama henüz bulamadım. Değiştir jokeri ile harfleri değiştir!",
        duration: 4000,
      });
      return;
    }

    const selectedWord = validWords[Math.floor(Math.random() * validWords.length)];
    const normalizedWord = selectedWord.toLocaleUpperCase("tr-TR");

    if (usedWords.has(normalizedWord)) {
      setIsJokerActive(false);
      return;
    }

    // Pozisyonları bul
    const wordPositions: { letter: string; row: number; col: number }[] = [];
    const usedPositions: { row: number; col: number }[] = [];

    for (const letter of selectedWord) {
      for (let row = 0; row < 4; row++) {
        let found = false;
        for (let col = 0; col < 4; col++) {
          if (gameGrid[row][col] === letter && !usedPositions.some((p) => p.row === row && p.col === col)) {
            wordPositions.push({ letter, row, col });
            usedPositions.push({ row, col });
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    if (wordPositions.length !== selectedWord.length) {
      setIsJokerActive(false);
      return;
    }

    setSelectedLetters(wordPositions);

    setTimeout(async () => {
      const score = calculateWordScore(selectedWord);
      const newScore = playerScore + score;

      setPlayerScore(newScore);
      setPlayerWords(prev => [...prev, selectedWord]);
      setPlayerWordsWithScores(prev => [...prev, { word: selectedWord, score }]);
      setUsedWords(prev => new Set([...prev, normalizedWord]));
      playSound("correctWord");

      // Update score in database
      if (room) {
        const scoreField = user?.id === room.player1_id ? "player1_score" : "player2_score";
        await supabase.from("game_rooms").update({ [scoreField]: newScore }).eq("id", room.id);
        await supabase.from("game_words").insert({
          room_id: room.id,
          player_id: user?.id,
          word: selectedWord,
          points: score,
        });
      }

      await useJoker("senYaz");
      setSelectedLetters([]);
      setIsJokerActive(false);
    }, 1500);
  }, [jokers.senYaz, gameStarted, isJokerActive, gameGrid, wordlist, wordlistLoaded, usedWords, room, user, playerScore, useJoker, playSpecialSound, playSound, toast]);

  // ============= EXIT HANDLING =============
  const handleBackToMenu = useCallback(() => {
    if (gameStarted && !gameEnded) {
      setShowExitDialog(true);
    } else {
      navigate("/");
    }
  }, [gameStarted, gameEnded, navigate]);

  const confirmExit = useCallback(async () => {
    if (room) {
      matchBanlist.add(room.id);
      // Leave room
      await supabase
        .from("game_rooms")
        .update({ status: "finished" })
        .eq("id", room.id);
    }
    navigate("/");
  }, [room, navigate]);

  // ============= LOADING STATE =============
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
        <Card className="max-w-sm mx-auto">
          <CardContent className="p-6 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <p className="text-lg font-semibold">Oyun yükleniyor...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============= ERROR STATE =============
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
        <Card className="max-w-sm mx-auto">
          <CardContent className="p-6 text-center">
            <p className="text-lg font-semibold text-destructive mb-4">{error}</p>
            <Button onClick={() => navigate("/")}>Ana Menüye Dön</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============= RESULTS SCREEN =============
  if (showResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <h2 className={`text-2xl font-bold mb-4 ${
              winner === "player" ? "text-yellow-600" : winner === "opponent" ? "text-gray-600" : "text-blue-600"
            }`}>
              {winner === "player" ? "Kazandınız! 🎉" : winner === "opponent" ? "Kaybettiniz" : "Beraberlik!"}
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
              <Button
                onClick={() => navigate("/")}
                className="w-full"
              >
                Ana Menüye Dön
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============= MAIN GAME UI =============
  return (
    <LayoutGroup>
      <>
        {showCountdown && countdownServerTime && (
          <GameCountdown
            key={`countdown-${room?.id}`}
            onComplete={handleCountdownComplete}
            serverStartTime={(() => {
              // Buffer (5s) sonrası için serverStartTime'ı ayarla
              // countdown_started_at + 5s buffer = countdown görüntülenmeye başladığı an
              const startDate = new Date(countdownServerTime);
              startDate.setSeconds(startDate.getSeconds() + 5); // 5s buffer eklendi
              return startDate.toISOString();
            })()}
            serverTimeOffset={serverTimeOffset}
          />
        )}

        <div
          className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 relative overflow-hidden"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 8px) + 1rem)",
            paddingBottom: "env(safe-area-inset-bottom, 8px)",
            paddingLeft: "env(safe-area-inset-left, 4px)",
            paddingRight: "env(safe-area-inset-right, 4px)",
          }}
        >
          <div className="h-full flex flex-col px-2 relative z-15">
            {/* Header */}
            <div className="flex items-center justify-between py-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs px-2 py-1 h-8"
                onClick={handleBackToMenu}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Çıkış
              </Button>

              {/* Timer */}
              <div className="flex flex-col items-center space-y-2">
                <div className={`flex items-center space-x-2 ${displayTime <= 15 ? "text-red-500 animate-pulse" : ""}`}>
                  <span className="text-lg">⏳</span>
                  <span className="font-mono text-lg font-bold">{formatTime(displayTime)}</span>
                </div>
                <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      displayTime <= 15 ? "bg-red-500" : displayTime <= 30 ? "bg-orange-500" : "bg-green-500"
                    }`}
                    style={{ width: `${(displayTime / GAME_DURATION) * 100}%` }}
                  />
                </div>
              </div>

              <div className="w-16" />
            </div>

            {/* Scores */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border border-gray-300 shadow-lg">
                <CardContent className="p-4 text-center">
                  <div className="relative inline-block">
                    <Avatar className="w-16 h-16 mx-auto mb-2">
                      <AvatarImage src={profile?.avatar_url} alt="Profile" />
                      <AvatarFallback><User className="w-8 h-8" /></AvatarFallback>
                    </Avatar>
                    {/* VIP rozet - kendi kartımız */}
                    {isPremium && (
                      <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full p-1 border-2 border-white shadow-md">
                        <Crown className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-bold">Siz</p>
                  <p className="text-2xl font-bold">{playerScore}</p>
                </CardContent>
              </Card>

              <Card className="border border-gray-300 shadow-lg">
                <CardContent className="p-4 text-center relative">
                  <div className="relative inline-block">
                    <Avatar className="w-16 h-16 mx-auto mb-2">
                      <AvatarImage src={opponent?.avatar_url || ""} alt="Opponent" />
                      <AvatarFallback><User className="w-8 h-8" /></AvatarFallback>
                    </Avatar>
                    {/* VIP rozet - rakip kartı */}
                    {opponent?.isPremium && (
                      <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full p-1 border-2 border-white shadow-md">
                        <Crown className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-bold">{opponent?.username || "Rakip"}</p>
                  <p className="text-2xl font-bold">{opponentScore}</p>

                  {preparingOpponent && (
                    <div className="absolute inset-0 bg-white/95 flex items-center justify-center">
                      {preparingOpponent === "preparing" ? (
                        <div className="text-center animate-pulse">
                          <p className="text-sm font-bold">Oyuncu Hazırlanıyor...</p>
                        </div>
                      ) : (
                        <Badge className="bg-green-500">✓ Oyuncu Hazır!</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Joker Panel */}
            <Card className="bg-gradient-to-r from-amber-50 to-orange-100 border-amber-200 shadow-md mt-4">
              <CardContent className="p-2">
                <h3 className="text-sm font-bold text-purple-800 mb-2">🎭 Jokerler</h3>
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex flex-col items-center p-1 h-auto relative text-xs"
                    onClick={useDegisTirJoker}
                    disabled={jokers.degistir <= 0 || !gameStarted}
                  >
                    <Shuffle className="w-3 h-3 mb-0.5" />
                    <span className="text-xs">Değiştir</span>
                    <Badge variant="secondary" className="absolute -top-1 -right-1 text-xs">
                      {jokers.degistir}
                    </Badge>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex flex-col items-center p-1 h-auto relative text-xs"
                    onClick={useFisildaJoker}
                    disabled={jokers.fisilida <= 0 || !gameStarted}
                  >
                    <Lightbulb className="w-4 h-4 mb-1" />
                    <span className="text-xs">Fısılda</span>
                    <Badge variant="secondary" className="absolute -top-1 -right-1 text-xs">
                      {jokers.fisilida}
                    </Badge>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex flex-col items-center p-1 h-auto relative text-xs"
                    onClick={useSenYazJoker}
                    disabled={jokers.senYaz <= 0 || !gameStarted}
                  >
                    <PenTool className="w-4 h-4 mb-1" />
                    <span className="text-xs">Sen Yaz</span>
                    <Badge variant="secondary" className="absolute -top-1 -right-1 text-xs">
                      {jokers.senYaz}
                    </Badge>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Current Word Input */}
            <Card className="border-0 mt-4">
              <CardContent className="p-2">
                <div className="flex items-center justify-center space-x-2 w-full">
                  <div
                    className={`flex items-center justify-center h-14 w-full rounded-xl bg-white/80 px-3 ${
                      inputFlash === "success"
                        ? "border-2 border-green-500"
                        : inputFlash === "error"
                          ? "border-2 border-red-500"
                          : "border-2 border-slate-200/50"
                    }`}
                  >
                    {selectedLetters.length === 0 ? (
                      <span className="text-slate-400 font-mono text-lg animate-pulse">K E L İ M E L E</span>
                    ) : (
                      <div className="flex gap-1">
                        {selectedLetters.map((item) => (
                          <motion.span
                            key={`input-${item.row}-${item.col}`}
                            layoutId={`letter-${item.row}-${item.col}`}
                            className="text-3xl font-mono font-extrabold"
                          >
                            {item.letter}
                          </motion.span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge className="bg-slate-800 text-white text-base font-bold px-3 py-1">
                    {currentWord.length}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Game Grid */}
            <Card className="border-0 mt-2 flex-1">
              <CardContent className="p-3 h-full flex items-center justify-center">
                <div className="grid grid-cols-4 gap-2 w-full max-w-xs">
                  {gameGrid.map((row, rowIndex) =>
                    row.map((letter, colIndex) => {
                      const isSelected = selectedLetters.some(s => s.row === rowIndex && s.col === colIndex);
                      const selectionOrder = selectedLetters.findIndex(s => s.row === rowIndex && s.col === colIndex);

                      return (
                        <Button
                          key={`${rowIndex}-${colIndex}`}
                          className={`h-12 text-lg font-bold relative ${
                            isSelected ? "bg-green-900/40 border-green-400" : ""
                          } ${!gameStarted ? "opacity-50" : ""}`}
                          disabled={!gameStarted}
                          onClick={() => handleLetterClick(letter, rowIndex, colIndex)}
                        >
                          {!isSelected && (
                            <motion.span layoutId={`letter-${rowIndex}-${colIndex}`}>
                              {letter}
                            </motion.span>
                          )}
                          {isSelected && (
                            <span className="opacity-30">{letter}</span>
                          )}
                          {isSelected && selectionOrder >= 0 && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-2 -right-2 bg-green-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold"
                            >
                              {selectionOrder + 1}
                            </motion.span>
                          )}
                        </Button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 shrink-0 mt-2">
              <Button
                variant="outline"
                onClick={clearWord}
                className="h-12"
                disabled={selectedLetters.length === 0 || !gameStarted}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
              </Button>

              <Button
                onClick={submitWord}
                className="h-12"
                disabled={currentWord.length < 3 || isValidating || !gameStarted}
              >
                <Send className="w-4 h-4 mr-2" />
                {isValidating ? "Kontrol..." : "Gönder"}
              </Button>
            </div>
          </div>
        </div>

        {/* Exit Dialog */}
        <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
          <AlertDialogContent className="max-w-sm mx-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>⚠️ Aktif Oyun Uyarısı</AlertDialogTitle>
              <AlertDialogDescription>
                Oyundan çıkarsan ceza alacaksın ve rakibin kazanacak. Emin misin?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col space-y-2">
              <AlertDialogAction onClick={confirmExit} className="w-full bg-destructive">
                🚪 Evet, Çıkış Yap
              </AlertDialogAction>
              <AlertDialogCancel className="w-full">🎮 Hayır, Devam Et</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </LayoutGroup>
  );
};

export default RandomMatchPage;
