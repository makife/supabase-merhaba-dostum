import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

interface GameRoom {
  id: string;
  room_code: string | null;
  game_mode: string;
  status: string;
  host_id: string;
  max_score: number;
  time_limit: number;
  current_grid: any;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface GameParticipant {
  id: string;
  room_id: string;
  user_id: string;
  score: number;
  is_bot: boolean;
  joined_at: string;
}

interface GameContextType {
  currentRoom: GameRoom | null;
  participants: GameParticipant[];
  createRoom: (gameMode: string, roomCode?: string) => Promise<GameRoom | null>;
  joinRoom: (roomCode: string) => Promise<boolean>;
  findRandomMatch: (gameType: 'timed' | 'score') => Promise<boolean>;
  addAIOpponent: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  updateScore: (score: number) => Promise<void>;
  startGame: () => Promise<void>;
  endGame: () => Promise<void>;
  isConnected: boolean;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider = ({ children }: GameProviderProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [participants, setParticipants] = useState<GameParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Generate random grid
  const generateRandomGrid = (): string[][] => {
    const letters = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ';
    const grid: string[][] = [];
    for (let i = 0; i < 4; i++) {
      const row: string[] = [];
      for (let j = 0; j < 4; j++) {
        row.push(letters[Math.floor(Math.random() * letters.length)]);
      }
      grid.push(row);
    }
    return grid;
  };

  // Clean up old rooms - more aggressive cleanup
  const cleanupOldRooms = async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
      
      // Delete old waiting rooms older than 5 minutes
      await supabase
        .from('game_rooms')
        .delete()
        .eq('status', 'waiting')
        .lt('created_at', fiveMinutesAgo);
        
      // Delete finished rooms older than 1 minute
      await supabase
        .from('game_rooms')
        .delete()
        .eq('status', 'finished')
        .lt('finished_at', oneMinuteAgo);
        
      // Delete active rooms that started more than 10 minutes ago (stale games)
      await supabase
        .from('game_rooms')
        .delete()
        .eq('status', 'active')
        .lt('started_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
        
      console.log('🧹 Aggressive cleanup completed');
    } catch (error) {
      console.error('Error in cleanup:', error);
    }
  };

  // Create room
  const createRoom = async (gameMode: string, roomCode?: string): Promise<GameRoom | null> => {
    if (!user) return null;

    try {
      const grid = generateRandomGrid();
      const { data: room, error } = await supabase
        .from('game_rooms')
        .insert({
          game_mode: gameMode,
          host_id: user.id,
          room_code: roomCode,
          current_grid: grid.flat(),
          status: 'waiting',
          max_score: gameMode.includes('score') ? 500 : 100,
          time_limit: gameMode.includes('timed') ? 120 : 0
        })
        .select()
        .single();

      if (error) throw error;

      // Join as participant
      await supabase
        .from('game_participants')
        .insert({
          room_id: room.id,
          user_id: user.id,
          score: 0,
          is_bot: false
        });

      // Add AI for vs-computer mode
      if (gameMode === 'vs-computer') {
        await supabase
          .from('game_participants')
          .insert({
            room_id: room.id,
            user_id: null,
            score: 0,
            is_bot: true
          });
      }

      setCurrentRoom(room);
      
      toast({
        title: 'Oda Oluşturuldu',
        description: roomCode ? `Oda kodu: ${roomCode}` : 'Oyuna hazırsınız',
      });

      return room;
    } catch (error) {
      console.error('Error creating room:', error);
      toast({
        title: 'Hata',
        description: 'Oda oluşturulamadı',
        variant: 'destructive',
      });
      return null;
    }
  };

  // Join room
  const joinRoom = async (roomCode: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', roomCode)
        .eq('status', 'waiting')
        .single();

      if (roomError || !room) {
        toast({
          title: 'Hata',
          description: 'Oda bulunamadı',
          variant: 'destructive',
        });
        return false;
      }

      // Check if already in room
      const { data: existing } = await supabase
        .from('game_participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single();

      if (!existing) {
        await supabase
          .from('game_participants')
          .insert({
            room_id: room.id,
            user_id: user.id,
            score: 0
          });
      }

      setCurrentRoom(room);
      
      toast({
        title: 'Odaya Katıldınız',
        description: 'Oyun başlamayı bekliyor',
      });

      return true;
    } catch (error) {
      console.error('Error joining room:', error);
      toast({
        title: 'Hata',
        description: 'Odaya katılamadı',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Simple random match finder - returns true if immediate match found
  const findRandomMatch = async (gameType: 'timed' | 'score'): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('🔍 Starting random match search for:', gameType);
      
      // Aggressive cleanup first
      await cleanupOldRooms();
      
      // Look for ONLY fresh waiting rooms from the last minute
      const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
      
      const { data: waitingRooms } = await supabase
        .from('game_rooms')
        .select(`
          *,
          game_participants!inner (
            id,
            user_id,
            is_bot
          )
        `)
        .eq('game_mode', 'random-match')
        .eq('status', 'waiting')
        .neq('host_id', user.id)
        .gt('created_at', oneMinuteAgo)  // Only rooms created in last minute
        .eq('game_participants.is_bot', false);

      console.log('🔍 Found waiting rooms:', waitingRooms?.length || 0);

      // Find suitable room with exactly 1 real player
      const suitableRoom = waitingRooms?.find(room => {
        const participants = room.game_participants || [];
        const realPlayers = participants.filter((p: any) => !p.is_bot);
        const isCorrectType = gameType === 'timed' 
          ? room.time_limit > 0 
          : room.max_score > 0;
        return realPlayers.length === 1 && isCorrectType;
      });

      if (suitableRoom) {
        // Join existing room
        await supabase
          .from('game_participants')
          .insert({
            room_id: suitableRoom.id,
            user_id: user.id,
            score: 0,
            is_bot: false
          });

        setCurrentRoom(suitableRoom);
        console.log('✅ Found and joined existing fresh room');
        return true; // Immediate match found
      }

      // No suitable room found - create brand new room
      const grid = generateRandomGrid();
      const { data: newRoom } = await supabase
        .from('game_rooms')
        .insert({
          game_mode: 'random-match',
          host_id: user.id,
          current_grid: grid.flat(),
          status: 'waiting',
          max_score: gameType === 'score' ? 500 : 0,
          time_limit: gameType === 'timed' ? 120 : 0
        })
        .select()
        .single();

      if (newRoom) {
        await supabase
          .from('game_participants')
          .insert({
            room_id: newRoom.id,
            user_id: user.id,
            score: 0,
            is_bot: false
          });

        setCurrentRoom(newRoom);
        console.log('🆕 Created brand new room for matchmaking');
      }
      
      return false; // No immediate match, waiting for players
    } catch (error) {
      console.error('🚨 Random match error:', error);
      return false;
    }
  };

  // Add AI opponent to current room
  const addAIOpponent = async (): Promise<void> => {
    if (!currentRoom) return;

    try {
      await supabase
        .from('game_participants')
        .insert({
          room_id: currentRoom.id,
          user_id: null,
          score: 0,
          is_bot: true
        });
      
      console.log('🤖 Added AI opponent to room');
    } catch (error) {
      console.error('Error adding AI opponent:', error);
    }
  };

  // Leave room
  const leaveRoom = async (): Promise<void> => {
    if (!user || !currentRoom) return;

    try {
      await supabase
        .from('game_participants')
        .delete()
        .eq('room_id', currentRoom.id)
        .eq('user_id', user.id);

      // Delete room if empty
      const { data: remaining } = await supabase
        .from('game_participants')
        .select('id')
        .eq('room_id', currentRoom.id);

      if (!remaining || remaining.length === 0) {
        await supabase
          .from('game_rooms')
          .delete()
          .eq('id', currentRoom.id);
      }

      setCurrentRoom(null);
      setParticipants([]);
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  };

  // Update score
  const updateScore = async (score: number): Promise<void> => {
    if (!user || !currentRoom) return;

    try {
      await supabase
        .from('game_participants')
        .update({ score })
        .eq('room_id', currentRoom.id)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error updating score:', error);
    }
  };

  // Start game
  const startGame = async (): Promise<void> => {
    if (!currentRoom) return;

    try {
      await supabase
        .from('game_rooms')
        .update({ 
          status: 'active', 
          started_at: new Date().toISOString() 
        })
        .eq('id', currentRoom.id);
    } catch (error) {
      console.error('Error starting game:', error);
    }
  };

  // End game
  const endGame = async (): Promise<void> => {
    if (!currentRoom) return;

    try {
      await supabase
        .from('game_rooms')
        .update({ 
          status: 'finished', 
          finished_at: new Date().toISOString() 
        })
        .eq('id', currentRoom.id);
      
      setCurrentRoom(null);
      setParticipants([]);
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  // Fetch participants
  const fetchParticipants = async (roomId: string) => {
    try {
      const { data } = await supabase
        .from('game_participants')
        .select(`
          *,
          profiles:user_id (username, avatar_url)
        `)
        .eq('room_id', roomId);
      
      if (data) {
        setParticipants(data);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  // Real-time subscriptions
  useEffect(() => {
    if (!currentRoom) {
      setIsConnected(false);
      return;
    }

    setIsConnected(true);
    fetchParticipants(currentRoom.id);

    const channel = supabase
      .channel(`room-${currentRoom.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_participants',
        filter: `room_id=eq.${currentRoom.id}`
      }, () => {
        fetchParticipants(currentRoom.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom]);

  return (
    <GameContext.Provider value={{
      currentRoom,
      participants,
      createRoom,
      joinRoom,
      findRandomMatch,
      addAIOpponent,
      leaveRoom,
      updateScore,
      startGame,
      endGame,
      isConnected
    }}>
      {children}
    </GameContext.Provider>
  );
};