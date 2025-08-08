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

  // Cleanup old finished rooms and their participants
  const cleanupOldRooms = async () => {
    try {
      // Remove participants from finished rooms first
      const { data: finishedRooms } = await supabase
        .from('game_rooms')
        .select('id')
        .eq('status', 'finished');
      
      if (finishedRooms && finishedRooms.length > 0) {
        const roomIds = finishedRooms.map(room => room.id);
        
        // Delete participants from finished rooms
        await supabase
          .from('game_participants')
          .delete()
          .in('room_id', roomIds);
        
        // Delete finished rooms
        await supabase
          .from('game_rooms')
          .delete()
          .eq('status', 'finished');
        
        console.log('🧹 Cleaned up', finishedRooms.length, 'finished rooms');
      }
      
      // Also cleanup very old waiting rooms (older than 10 minutes) as they're likely abandoned
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      const { data: oldRooms } = await supabase
        .from('game_rooms')
        .select('id')
        .eq('status', 'waiting')
        .lt('created_at', tenMinutesAgo);
      
      if (oldRooms && oldRooms.length > 0) {
        const oldRoomIds = oldRooms.map(room => room.id);
        
        // Delete participants from old rooms
        await supabase
          .from('game_participants')
          .delete()
          .in('room_id', oldRoomIds);
        
        // Delete old rooms
        await supabase
          .from('game_rooms')
          .delete()
          .eq('status', 'waiting')
          .lt('created_at', tenMinutesAgo);
        
        console.log('🧹 Cleaned up', oldRooms.length, 'old waiting rooms');
      }
    } catch (error) {
      console.error('Error cleaning up old rooms:', error);
    }
  };

  // Generate random grid - NO W, Q, X
  const generateRandomGrid = (): string[][] => {
    const letters = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'; // Removed W, Q, X
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
          // Set correct limits based on game type
          max_score: gameMode.includes('score') ? 500 : 100,
          time_limit: gameMode.includes('timed') ? 120 : 0
        })
        .select()
        .single();

      if (error) throw error;

      // Join the room as a participant
      const { error: participantError } = await supabase
        .from('game_participants')
        .insert({
          room_id: room.id,
          user_id: user.id,
          score: 0,
          is_bot: false
        });

      if (participantError) {
        console.error('Error joining room as participant:', participantError);
        throw participantError;
      }

      // Add AI bot for vs-computer mode
      if (gameMode === 'vs-computer') {
        const { error: botError } = await supabase
          .from('game_participants')
          .insert({
            room_id: room.id,
            user_id: null, // AI bot has no user_id
            score: 0,
            is_bot: true
          });

        if (botError) {
          console.error('Error adding AI bot:', botError);
          throw botError;
        }
        
        console.log('✅ AI bot added to vs-computer room');
      }

      console.log('Room created and joined:', room.id, room.room_code);
      setCurrentRoom(room);
      
      toast({
        title: 'Oda Oluşturuldu',
        description: roomCode ? `Oda kodu: ${roomCode}` : 'Oyuna başlamaya hazırsınız',
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
          description: 'Oda bulunamadı veya oyun başlamış',
          variant: 'destructive',
        });
        return false;
      }

      // Check if already in room
      const { data: existingParticipant } = await supabase
        .from('game_participants')
        .select('*')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single();

      if (!existingParticipant) {
        const { error: joinError } = await supabase
          .from('game_participants')
          .insert({
            room_id: room.id,
            user_id: user.id,
            score: 0
          });

        if (joinError) {
          console.error('Error joining room:', joinError);
          throw joinError;
        }
      }

      console.log('Joined room:', room.id, room.room_code);
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

  // Find random match
  const findRandomMatch = async (gameType: 'timed' | 'score'): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('🔍 Starting random match search for gameType:', gameType);
      
      // First cleanup old finished rooms to prevent confusion
      await cleanupOldRooms();
      
      // Look for existing waiting rooms with random-match mode
      const { data: waitingRooms, error: searchError } = await supabase
        .from('game_rooms')
        .select(`
          *,
          game_participants (*)
        `)
        .eq('game_mode', 'random-match')
        .eq('status', 'waiting')
        .not('host_id', 'eq', user.id); // Don't join our own room

      if (searchError) {
        console.error('❌ Search error:', searchError);
        throw searchError;
      }

      console.log('🔍 Found waiting rooms:', waitingRooms?.length || 0);

      // Filter rooms that have exactly 1 participant and match game type
      const availableRooms = waitingRooms?.filter(room => {
        const participantCount = room.game_participants?.length || 0;
        
        // More precise game type matching
        const gameTypeMatch = gameType === 'timed' 
          ? (room.time_limit > 0 && room.max_score === 0)  // Timed: has time_limit but no max_score
          : (room.max_score > 0 && room.time_limit === 0); // Score: has max_score but no time_limit
          
        const isUserInRoom = room.game_participants?.some(p => p.user_id === user.id);
        
        console.log(`🔍 Room ${room.id}: participants=${participantCount}, gameType=${gameType}, time_limit=${room.time_limit}, max_score=${room.max_score}, match=${gameTypeMatch}, userInRoom=${isUserInRoom}`);
        
        return participantCount === 1 && gameTypeMatch && !isUserInRoom;
      }) || [];

      console.log('✅ Available rooms for joining:', availableRooms.length);

      // If found a suitable waiting room, join it
      if (availableRooms.length > 0) {
        const room = availableRooms[0];
        console.log('🎯 Joining existing room:', room.id);
        
        const { error: joinError } = await supabase
          .from('game_participants')
          .insert({
            room_id: room.id,
            user_id: user.id,
            score: 0
          });
        
        if (joinError) {
          console.error('❌ Join error:', joinError);
          throw joinError;
        }

        setCurrentRoom(room);
        console.log('✅ Successfully joined room with real player!');
        return true; // Found real player!
      }

      console.log('🏗️ No available rooms found, creating new room and waiting...');
      
      // If no waiting room found, create one and wait for others
      const grid = generateRandomGrid();
      const { data: room, error } = await supabase
        .from('game_rooms')
        .insert({
          game_mode: 'random-match',
          host_id: user.id,
          current_grid: grid.flat(),
          status: 'waiting',
          // Set only the relevant field based on game type to avoid confusion
          max_score: gameType === 'score' ? 500 : 0,
          time_limit: gameType === 'timed' ? 120 : 0
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Room creation error:', error);
        throw error;
      }

      // Join our own room as participant
      await supabase
        .from('game_participants')
        .insert({
          room_id: room.id,
          user_id: user.id,
          score: 0
        });

      setCurrentRoom(room);
      console.log('✅ Created room and waiting for other players');
      
      // Return false to indicate we're waiting for another player
      return false;
    } catch (error) {
      console.error('💥 Error finding random match:', error);
      toast({
        title: 'Hata',
        description: 'Eşleşme sırasında hata oluştu',
        variant: 'destructive',
      });
      return false;
    }
  };

  // Leave room and cleanup
  const leaveRoom = async (): Promise<void> => {
    if (!user || !currentRoom) return;

    try {
      // Remove user from participants
      await supabase
        .from('game_participants')
        .delete()
        .eq('room_id', currentRoom.id)
        .eq('user_id', user.id);

      // Check if room is now empty, if so delete the room entirely
      const { data: remainingParticipants } = await supabase
        .from('game_participants')
        .select('id')
        .eq('room_id', currentRoom.id);

      if (!remainingParticipants || remainingParticipants.length === 0) {
        // No participants left, delete the room
        await supabase
          .from('game_rooms')
          .delete()
          .eq('id', currentRoom.id);
        
        console.log('🧹 Empty room deleted:', currentRoom.id);
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

  // End game and cleanup
  const endGame = async (): Promise<void> => {
    if (!currentRoom) return;

    try {
      // Update room status to finished
      await supabase
        .from('game_rooms')
        .update({ 
          status: 'finished', 
          finished_at: new Date().toISOString() 
        })
        .eq('id', currentRoom.id);
      
      // Clean up: Remove all participants from this room
      await supabase
        .from('game_participants')
        .delete()
        .eq('room_id', currentRoom.id);
      
      // Clear local state
      setCurrentRoom(null);
      setParticipants([]);
      
      console.log('🧹 Game ended and room cleaned up:', currentRoom.id);
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  // Real-time subscriptions with notifications
  useEffect(() => {
    if (!currentRoom) return;

    const channel = supabase
      .channel(`room-${currentRoom.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_participants',
        filter: `room_id=eq.${currentRoom.id}`
      }, (payload) => {
        console.log('🔔 Participant change detected:', payload);
        
        // If someone joined and it's not the current user
        if (payload.eventType === 'INSERT' && payload.new?.user_id !== user?.id) {
          toast({
            title: '🎉 Oyuncu Katıldı!',
            description: 'Arkadaşınız odaya katıldı, oyun başlayabilir!',
            duration: 3000,
          });
        }
        
        // If someone left and it's not the current user
        if (payload.eventType === 'DELETE' && payload.old?.user_id !== user?.id) {
          toast({
            title: '😔 Rakip Ayrıldı',
            description: 'Rakibiniz oyunu terk etti. Devam ederseniz puan alabilirsiniz!',
            duration: 5000,
            className: 'border-amber-200 bg-amber-50',
          });
        }
        
        // Immediately refresh participants
        setTimeout(() => fetchParticipants(), 200);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${currentRoom.id}`
      }, (payload) => {
        console.log('🏠 Room change:', payload);
        setCurrentRoom(payload.new as GameRoom);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentRoom, user]);

  // Fetch participants when room changes + manual refresh
  useEffect(() => {
    if (currentRoom) {
      console.log('🏠 Current room changed, fetching participants:', currentRoom.id);
      fetchParticipants();
      setIsConnected(true);
      
      // Manual refresh every 2 seconds for debugging
      const interval = setInterval(() => {
        console.log('🔄 Manual refresh participants...');
        fetchParticipants();
      }, 2000);
      
      return () => clearInterval(interval);
    } else {
      setParticipants([]);
      setIsConnected(false);
    }
  }, [currentRoom]);

  // Fetch participants function with better logging + profile data
  const fetchParticipants = async () => {
    if (!currentRoom) {
      console.log('❌ No current room for fetchParticipants');
      return;
    }

    try {
      console.log('🔍 Fetching participants for room:', currentRoom.id);
      const { data, error } = await supabase
        .from('game_participants')
        .select(`
          *,
          profiles!game_participants_user_id_fkey (
            username,
            avatar_url
          )
        `)
        .eq('room_id', currentRoom.id);

      if (error) {
        console.error('❌ Error fetching participants:', error);
        return;
      }

      console.log('✅ Participants fetched:', data?.length || 0, data);
      setParticipants(data || []);
    } catch (error) {
      console.error('💥 Exception fetching participants:', error);
    }
  };

  const value = {
    currentRoom,
    participants,
    createRoom,
    joinRoom,
    findRandomMatch,
    leaveRoom,
    updateScore,
    startGame,
    endGame,
    isConnected,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};