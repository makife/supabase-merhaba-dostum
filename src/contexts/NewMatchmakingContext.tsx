// src/contexts/NewMatchmakingContext.tsx
import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

// ========================
// TYPES
// ========================

interface MatchmakingState {
  status: 'idle' | 'searching' | 'matched' | 'in_game' | 'error';
  queueTime: number;
  estimatedWait: number;
  currentRoom: GameRoom | null;
  error: string | null;
  gameGrid: string[][];
  playerScore: number;
  opponentScore: number;
  usedWords: string[];
}

interface GameRoom {
  id: string;
  game_type: 'timed' | 'score';
  status: 'waiting' | 'active' | 'finished';
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  current_grid: string[];
  used_words: string[];
  winner_id?: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
}

interface MatchmakingContextType {
  state: MatchmakingState;
  startSearching: (gameType: 'timed' | 'score') => Promise<void>;
  cancelSearch: () => Promise<void>;
  updateScore: (score: number) => Promise<void>;
  submitWord: (word: string) => Promise<boolean>;
  leaveGame: () => Promise<void>;
  isOpponent: (userId: string) => boolean;
  resetToIdle: () => void;
}

// ========================
// CONTEXT
// ========================

const NewMatchmakingContext = createContext<MatchmakingContextType | null>(null);

export const useNewMatchmaking = () => {
  const context = useContext(NewMatchmakingContext);
  if (!context) {
    throw new Error('useNewMatchmaking must be used within NewMatchmakingProvider');
  }
  return context;
};

// ========================
// PROVIDER
// ========================

interface NewMatchmakingProviderProps {
  children: ReactNode;
}

export const NewMatchmakingProvider = ({ children }: NewMatchmakingProviderProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State
  const [state, setState] = useState<MatchmakingState>({
    status: 'idle',
    queueTime: 0,
    estimatedWait: 30,
    currentRoom: null,
    error: null,
    gameGrid: [],
    playerScore: 0,
    opponentScore: 0,
    usedWords: []
  });

  // Refs for cleanup
  const queueTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queueChannelRef = useRef<any>(null);
  const gameChannelRef = useRef<any>(null);

  // ========================
  // UTILITY FUNCTIONS
  // ========================

  const generateRandomGrid = (): string[][] => {
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
      'Z'
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

  const flatGridToMatrix = (flatGrid: string[]): string[][] => {
    const grid: string[][] = [];
    for (let i = 0; i < 4; i++) {
      grid.push(flatGrid.slice(i * 4, (i + 1) * 4));
    }
    return grid;
  };

  const cleanupListeners = useCallback(() => {
    console.log('🧹 Cleanup listeners başlatılıyor...');
    
    if (queueTimerRef.current) {
      clearInterval(queueTimerRef.current);
      queueTimerRef.current = null;
    }
    
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    
    if (queueChannelRef.current) {
      supabase.removeChannel(queueChannelRef.current);
      queueChannelRef.current = null;
    }
    
    if (gameChannelRef.current) {
      supabase.removeChannel(gameChannelRef.current);
      gameChannelRef.current = null;
    }
    
    console.log('✅ Cleanup tamamlandı');
  }, []);

  // ========================
  // MATCHMAKING FUNCTIONS
  // ========================

  const startSearching = useCallback(async (gameType: 'timed' | 'score') => {
    if (!user) {
      console.error('❌ User not found');
      return;
    }

    try {
      console.log('🔍 Matchmaking başlatılıyor:', { 
        userId: user.id.slice(-8), 
        gameType 
      });
      
      // Cleanup previous state
      cleanupListeners();
      
      setState(prev => ({ 
        ...prev, 
        status: 'searching', 
        queueTime: 0, 
        estimatedWait: 30,
        error: null,
        gameGrid: [],
        playerScore: 0,
        opponentScore: 0,
        usedWords: []
      }));

      // 1. Clear existing queue records
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      console.log('🧹 Eski queue kayıtları temizlendi');

      // 2. Enter queue
      const { error: queueError } = await supabase
        .from('matchmaking_queue')
        .insert({
          user_id: user.id,
          game_type: gameType,
          status: 'searching'
        });

      if (queueError) {
        console.error('❌ Queue insert error:', queueError);
        throw queueError;
      }

      console.log('🔍 Function çağrılıyor:', { userId: user.id, gameType });

      // 3. Try to find immediate match
      const { data: matchResult, error: matchError } = await supabase
        .rpc('find_match', { 
          p_user_id: user.id, 
          p_game_type: gameType 
        });

      console.log('🔍 Function sonucu:', { matchResult, matchError });

      if (matchError) {
        console.error('❌ Match finding error:', matchError);
        // Continue to queue anyway
      }

      if (matchResult?.found && matchResult?.room_id) {
        // Immediate match found
        console.log('🎉 Anında eşleşme bulundu:', matchResult.room_id.slice(-8));
        
        setState(prev => ({ 
          ...prev, 
          status: 'matched' 
        }));

        // Load room
        await loadRoom(matchResult.room_id);
      } else {
        console.log('❌ Anında eşleşme yok, polling başlatılıyor...');
        // Start queue listening
        console.log('⏳ Queue\'da bekleniyor...');
        startQueueListener(gameType);
      }

    } catch (error: any) {
      console.error('❌ Matchmaking error:', error);
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error.message || 'Eşleşme sırasında hata oluştu'
      }));
    }
  }, [user, cleanupListeners]);

  const startQueueListener = useCallback((gameType: 'timed' | 'score') => {
  if (!user) return;

  console.log('👂 Queue listener başlatılıyor...');

  // *** DEBUG CHANNEL'I KALDIR, SADECE ANA LISTENER ***
  queueChannelRef.current = supabase
    .channel(`queue-${user.id}`)
    .on('postgres_changes', {
      event: '*',  // ← UPDATE yerine * kullan (tüm eventler)
      schema: 'public',
      table: 'matchmaking_queue',
      // ← Filter'ı kaldır, tüm değişiklikleri dinle
    }, async (payload) => {
      console.log('📡 REALTIME EVENT:', payload);
      
      // Sadece kendi user'ımızla ilgili değişiklikler
      if (payload.new && payload.new.user_id === user.id) {
        console.log('📡 Queue update for me:', payload.new);
        
        if (payload.new.status === 'matched' && payload.new.room_id) {
          console.log('🎉 Eşleşme bulundu!', payload.new.room_id);
          
          clearInterval(queueTimerRef.current!);
          clearTimeout(aiTimeoutRef.current!);
          
          setState(prev => ({ 
            ...prev, 
            status: 'matched' 
          }));

          await loadRoom(payload.new.room_id);
        }
      }
    })
    .subscribe();

  console.log('✅ Queue listener aktif');

  // Set AI timeout
  aiTimeoutRef.current = setTimeout(async () => {
    console.log('⏰ Queue timeout - AI oyunu başlatılıyor');
    clearInterval(pollingInterval);
    await createAIGame(gameType);
  }, 30000);

  // Store polling interval for cleanup
  queueChannelRef.current = { unsubscribe: () => clearInterval(pollingInterval) };
}, [user]);

  const createAIGame = useCallback(async (gameType: 'timed' | 'score') => {
    if (!user) return;

    console.log('🤖 AI oyunu oluşturuluyor...');

    try {
      // Clear queue
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      // Create AI game room (simplified)
      const grid = generateRandomGrid();
      
      setState(prev => ({ 
        ...prev, 
        status: 'in_game',
        currentRoom: {
          id: `ai-${Date.now()}`,
          game_type: gameType,
          status: 'active',
          player1_id: user.id,
          player2_id: 'ai-player',
          player1_score: 0,
          player2_score: 0,
          current_grid: grid.flat(),
          used_words: [],
          created_at: new Date().toISOString()
        },
        gameGrid: grid
      }));

      toast({
        title: '🤖 AI Rakip',
        description: 'Gerçek oyuncu bulunamadı, AI ile oynuyorsunuz',
      });

      // Start AI opponent simulation
      startAIOpponent();

    } catch (error) {
      console.error('❌ AI game creation error:', error);
      setState(prev => ({ 
        ...prev, 
        status: 'error',
        error: 'AI oyunu oluşturulamadı'
      }));
    }
  }, [user, toast]);

  const loadRoom = useCallback(async (roomId: string) => {
    if (!user) return;

    try {
      console.log('🏠 Room yükleniyor:', roomId.slice(-8));

      const { data: room, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (error) {
        console.error('❌ Room loading error:', error);
        throw error;
      }

      console.log('✅ Room yüklendi:', room);

      // Convert grid
      const gameGrid = room.current_grid ? flatGridToMatrix(room.current_grid) : generateRandomGrid();
      
      // Determine scores
      const isPlayer1 = room.player1_id === user.id;
      const playerScore = isPlayer1 ? room.player1_score : room.player2_score;
      const opponentScore = isPlayer1 ? room.player2_score : room.player1_score;

      setState(prev => ({ 
        ...prev, 
        status: 'in_game',
        currentRoom: room,
        gameGrid: gameGrid,
        playerScore: playerScore,
        opponentScore: opponentScore,
        usedWords: room.used_words || []
      }));

      // Start game listener
      startGameListener(roomId);

      toast({
        title: '🎮 Oyun Başladı!',
        description: 'Rakibinizle eşleştiniz, iyi oyunlar!',
      });

    } catch (error: any) {
      console.error('❌ Room loading error:', error);
      setState(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error.message || 'Room yüklenemedi'
      }));
    }
  }, [user, toast]);

  const startGameListener = useCallback((roomId: string) => {
    if (!user) return;

    console.log('🎮 Game listener başlatılıyor:', roomId.slice(-8));

    gameChannelRef.current = supabase
      .channel(`game-${roomId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${roomId}`
      }, (payload) => {
        console.log('🎯 Game update:', payload.new);
        
        const updatedRoom = payload.new as GameRoom;
        
        // Update scores
        const isPlayer1 = updatedRoom.player1_id === user.id;
        const playerScore = isPlayer1 ? updatedRoom.player1_score : updatedRoom.player2_score;
        const opponentScore = isPlayer1 ? updatedRoom.player2_score : updatedRoom.player1_score;

        setState(prev => ({ 
          ...prev, 
          currentRoom: updatedRoom,
          playerScore: playerScore,
          opponentScore: opponentScore,
          usedWords: updatedRoom.used_words || []
        }));

        // Check if game ended
        if (updatedRoom.status === 'finished') {
          handleGameEnd(updatedRoom);
        }
      })
      .subscribe();

    console.log('✅ Game listener aktif');
  }, [user]);

  const startAIOpponent = useCallback(() => {
    // Simple AI simulation
    const aiInterval = setInterval(() => {
      setState(prev => {
        if (prev.status !== 'in_game' || !prev.currentRoom) {
          clearInterval(aiInterval);
          return prev;
        }

        // AI scores randomly
        const aiScore = prev.opponentScore + Math.floor(Math.random() * 15) + 5;
        
        return {
          ...prev,
          opponentScore: aiScore
        };
      });
    }, 5000); // AI scores every 5 seconds

    // Cleanup AI interval when component unmounts or game ends
    return () => clearInterval(aiInterval);
  }, []);

  // ========================
  // GAME ACTIONS
  // ========================

  const updateScore = useCallback(async (score: number) => {
    if (!user || !state.currentRoom || state.currentRoom.player2_id === 'ai-player') {
      // For AI games, just update local state
      setState(prev => ({ ...prev, playerScore: score }));
      return;
    }

    try {
      const isPlayer1 = state.currentRoom.player1_id === user.id;
      const updateField = isPlayer1 ? 'player1_score' : 'player2_score';

      const { error } = await supabase
        .from('game_rooms')
        .update({ [updateField]: score })
        .eq('id', state.currentRoom.id);

      if (error) {
        console.error('❌ Score update error:', error);
        throw error;
      }

      console.log('✅ Score updated:', score);

    } catch (error: any) {
      console.error('❌ Score update error:', error);
    }
  }, [user, state.currentRoom]);

  const submitWord = useCallback(async (word: string): Promise<boolean> => {
    if (!user || !state.currentRoom) return false;

    try {
      const normalizedWord = word.toUpperCase();
      
      // Check if word already used
      if (state.usedWords.includes(normalizedWord)) {
        return false;
      }

      // For AI games, just update local state
      if (state.currentRoom.player2_id === 'ai-player') {
        setState(prev => ({ 
          ...prev, 
          usedWords: [...prev.usedWords, normalizedWord]
        }));
        return true;
      }

      // For real multiplayer games, update database
      const newUsedWords = [...state.usedWords, normalizedWord];

      const { error } = await supabase
        .from('game_rooms')
        .update({ used_words: newUsedWords })
        .eq('id', state.currentRoom.id);

      if (error) {
        console.error('❌ Word submit error:', error);
        throw error;
      }

      console.log('✅ Word submitted:', normalizedWord);
      return true;

    } catch (error: any) {
      console.error('❌ Word submit error:', error);
      return false;
    }
  }, [user, state.currentRoom, state.usedWords]);

  // ========================
  // CLEANUP FUNCTIONS
  // ========================

  const cancelSearch = useCallback(async () => {
    if (!user) return;

    try {
      console.log('❌ Search iptal ediliyor...');

      // Clear queue
      await supabase
        .from('matchmaking_queue')
        .delete()
        .eq('user_id', user.id);

      // Cleanup listeners
      cleanupListeners();

      setState(prev => ({ 
        ...prev, 
        status: 'idle',
        queueTime: 0,
        error: null 
      }));

      console.log('✅ Search iptal edildi');

    } catch (error: any) {
      console.error('❌ Cancel search error:', error);
    }
  }, [user, cleanupListeners]);

  const leaveGame = useCallback(async () => {
    if (!user || !state.currentRoom) return;

    try {
      console.log('🚪 Oyundan çıkılıyor...');

      // For AI games, just reset state
      if (state.currentRoom.player2_id === 'ai-player') {
        setState(prev => ({ 
          ...prev, 
          status: 'idle',
          currentRoom: null,
          gameGrid: [],
          playerScore: 0,
          opponentScore: 0,
          usedWords: []
        }));
        cleanupListeners();
        return;
      }

      // For real multiplayer games, end the game and set winner
      const winnerId = state.currentRoom.player1_id === user.id 
        ? state.currentRoom.player2_id 
        : state.currentRoom.player1_id;

      const { error } = await supabase
        .from('game_rooms')
        .update({ 
          status: 'finished',
          winner_id: winnerId,
          finished_at: new Date().toISOString()
        })
        .eq('id', state.currentRoom.id);

      if (error) {
        console.error('❌ Leave game error:', error);
      }

      // Apply penalty (you can integrate existing penalty system here)
      // await applyLeavePenalty(user.id);

      setState(prev => ({ 
        ...prev, 
        status: 'idle',
        currentRoom: null,
        gameGrid: [],
        playerScore: 0,
        opponentScore: 0,
        usedWords: []
      }));

      cleanupListeners();

      toast({
        title: '🚪 Oyundan Çıkıldı',
        description: 'Oyunu terk ettiniz',
        variant: 'destructive'
      });

    } catch (error: any) {
      console.error('❌ Leave game error:', error);
    }
  }, [user, state.currentRoom, cleanupListeners, toast]);

  const resetToIdle = useCallback(() => {
    console.log('🔄 State reset to idle');
    cleanupListeners();
    setState({
      status: 'idle',
      queueTime: 0,
      estimatedWait: 30,
      currentRoom: null,
      error: null,
      gameGrid: [],
      playerScore: 0,
      opponentScore: 0,
      usedWords: []
    });
  }, [cleanupListeners]);

  // ========================
  // HELPER FUNCTIONS
  // ========================

  const isOpponent = useCallback((userId: string): boolean => {
    if (!state.currentRoom || !user) return false;
    
    if (state.currentRoom.player1_id === user.id) {
      return state.currentRoom.player2_id === userId;
    } else {
      return state.currentRoom.player1_id === userId;
    }
  }, [state.currentRoom, user]);

  const handleGameEnd = useCallback((room: GameRoom) => {
    if (!user) return;

    console.log('🏁 Oyun bitti:', room);

    const isWinner = room.winner_id === user.id;
    const isDraw = !room.winner_id;
    
    toast({
      title: isWinner ? '🏆 Kazandınız!' : isDraw ? '🤝 Beraberlik!' : '😞 Kaybettiniz',
      description: `Final skor: ${room.player1_score} - ${room.player2_score}`,
      duration: 5000
    });

    // Clean up and reset to idle after a delay
    setTimeout(() => {
      resetToIdle();
    }, 3000);

  }, [user, toast, resetToIdle]);

  // ========================
  // CLEANUP ON UNMOUNT
  // ========================

  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up...');
      cleanupListeners();
    };
  }, [cleanupListeners]);

  // ========================
  // AUTO CLEANUP STALE STATES
  // ========================

  useEffect(() => {
    // If user changes, reset everything
    if (!user && state.status !== 'idle') {
      resetToIdle();
    }
  }, [user, state.status, resetToIdle]);

  // ========================
  // RETURN PROVIDER
  // ========================

  const contextValue: MatchmakingContextType = {
    state,
    startSearching,
    cancelSearch,
    updateScore,
    submitWord,
    leaveGame,
    isOpponent,
    resetToIdle
  };

  return (
    <NewMatchmakingContext.Provider value={contextValue}>
      {children}
    </NewMatchmakingContext.Provider>
  );
};

// ========================
// EXPORT DEFAULT
// ========================

export default NewMatchmakingProvider;
