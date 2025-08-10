import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
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

  // 🔧 DÜZELT: Cleanup sürelerini genişlet
  const cleanupOldRooms = async () => {
    try {
      // DEĞIŞIKLIK: 5 dakika → 2 saat (bekleyen odalar)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      // DEĞIŞIKLIK: 1 dakika → 30 dakika (bitmiş oyunlar)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      console.log('🧹 Cleanup başlıyor - 2 saat öncesi bekleyen odalar silinecek');
      
      // Bekleyen odalar için 2 saat bekle
      const { data: deletedWaiting } = await supabase
        .from('game_rooms')
        .delete()
        .eq('status', 'waiting')
        .lt('created_at', twoHoursAgo)
        .select();
      
      console.log('🧹 Silinen bekleyen oda sayısı:', deletedWaiting?.length || 0);
        
      // Bitmiş oyunlar 30 dakika sonra silinsin
      const { data: deletedFinished } = await supabase
        .from('game_rooms')
        .delete()
        .eq('status', 'finished')
        .lt('finished_at', thirtyMinutesAgo)
        .select();
        
      console.log('🧹 Silinen bitmiş oyun sayısı:', deletedFinished?.length || 0);
        
      // Başlamış ama takılmış oyunlar (1 saat sonra)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: deletedStale } = await supabase
        .from('game_rooms')
        .delete()
        .eq('status', 'active')
        .lt('started_at', oneHourAgo)
        .select();
        
      console.log('🧹 Silinen takılmış oyun sayısı:', deletedStale?.length || 0);
      console.log('🧹 Cleanup tamamlandı');
    } catch (error) {
      console.error('❌ Cleanup hatası:', error);
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

  // 🔧 DÜZELT: Race condition önleyici matchmaking
  const findRandomMatch = useCallback(async (gameType: 'timed' | 'score'): Promise<boolean> => {
    if (!user) {
      console.log('❌ No user found in findRandomMatch');
      return false;
    }

    try {
      console.log('🔍 ===== MATCHMAKING DEBUG START =====');
      console.log('👤 User ID:', user.id);
      console.log('🎮 Game Type:', gameType);
      console.log('⏰ Timestamp:', new Date().toISOString());
      
      // 🚀 RACE CONDITION ÖNLEYİCİ: Rastgele kısa bekleme
      const randomDelay = 500 + Math.random() * 2000; // 0.5-2.5 saniye
      console.log('⏳ Race condition önleme bekleme:', Math.round(randomDelay), 'ms');
      await new Promise(resolve => setTimeout(resolve, randomDelay));
      
      // Cleanup öncesi durum
      const { data: beforeCleanup } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('game_mode', 'random-match');
      console.log('📊 Cleanup öncesi toplam oda:', beforeCleanup?.length);
      
      // Hafif cleanup (çok eski olanları sil)
      await cleanupOldRooms();
      
      // İLK ARAMA: Mevcut bekleyen odaları kontrol et
      console.log('🔍 1. ARAMA - Mevcut bekleyen odalar...');
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: waitingRooms } = await supabase
        .from('game_rooms')
        .select(`
          *,
          game_participants!inner (
            id,
            user_id,
            is_bot,
            score,
            profiles:user_id (username, avatar_url)
          )
        `)
        .eq('game_mode', 'random-match')
        .eq('status', 'waiting')
        .neq('host_id', user.id) // Kendi odası değil
        .gt('created_at', fiveMinutesAgo) // Son 5 dakika
        .order('created_at', { ascending: false }); // En yeni önce

      console.log('🔍 Bulunan bekleyen oda sayısı:', waitingRooms?.length || 0);

      // Her odayı detaylı analiz et
      let suitableRoom = null;
      if (waitingRooms && waitingRooms.length > 0) {
        for (const room of waitingRooms) {
          const participants = room.game_participants || [];
          console.log('🔍 Oda analizi:', {
            roomId: room.id.slice(-8),
            createdAt: room.created_at,
            participants: participants.length,
            timeLimit: room.time_limit,
            maxScore: room.max_score
          });

          // Katılımcı detayları
          participants.forEach((p: any, index: number) => {
            console.log(`  👤 Katılımcı ${index + 1}:`, {
              userId: p.user_id?.slice(-8) || 'null',
              isBot: p.is_bot,
              username: p.profiles?.username || 'Bot'
            });
          });

          // Gerçek oyuncu sayısını kontrol et (bot olmayan ve kendisi olmayan)
          const realPlayers = participants.filter((p: any) => 
            !p.is_bot && 
            p.user_id !== null && 
            p.user_id !== user.id
          );

          // Oyun tipi uyumu kontrol et
          const isCorrectType = gameType === 'timed' 
            ? room.time_limit > 0 
            : room.max_score > 0;

          console.log('🔍 Oda uygunluk:', {
            realPlayerCount: realPlayers.length,
            isCorrectType,
            needsOnePlayer: realPlayers.length === 1
          });

          // Tam olarak 1 gerçek oyuncusu olan ve tip uyumlu oda
          if (realPlayers.length === 1 && isCorrectType) {
            suitableRoom = room;
            console.log('✅ UYGUN ODA BULUNDU:', room.id.slice(-8));
            break;
          }
        }
      }

      // UYGUN ODA BULUNDU - KATIL
      if (suitableRoom) {
        console.log('🎯 Mevcut odaya katılıyor:', suitableRoom.id.slice(-8));
        
        try {
          const { error: joinError } = await supabase
            .from('game_participants')
            .insert({
              room_id: suitableRoom.id,
              user_id: user.id,
              score: 0,
              is_bot: false
            });

          if (joinError) {
            console.error('❌ Katılma hatası:', joinError);
            // Eğer duplicate hata ise başka oda aç
            if (joinError.code === '23505') {
              console.log('⚠️ Duplicate key - başka oyuncu aynı anda katıldı');
            } else {
              throw joinError;
            }
          } else {
            setCurrentRoom(suitableRoom);
            console.log('✅ BAŞARILI EŞLEŞME - Mevcut odaya katıldı');
            console.log('🔍 ===== MATCHMAKING DEBUG END (SUCCESS) =====');
            return true; // Anında eşleşme bulundu
          }
        } catch (error) {
          console.error('❌ Katılma sırasında hata:', error);
          // Hata durumunda yeni oda açmaya devam et
        }
      }

      // 2. ARAMA: Son şans - çok yeni odalar
      console.log('🔍 2. ARAMA - Son şans kontrol...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Kısa bekleme
      
      const { data: lastChanceRooms } = await supabase
        .from('game_rooms')
        .select('*, game_participants(*)')
        .eq('game_mode', 'random-match')
        .eq('status', 'waiting')
        .neq('host_id', user.id)
        .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString()) // Son 2 dakika
        .limit(3);

      if (lastChanceRooms && lastChanceRooms.length > 0) {
        console.log('🔍 Son şans odaları:', lastChanceRooms.length);
        for (const room of lastChanceRooms) {
          const realCount = room.game_participants?.filter((p: any) => 
            !p.is_bot && p.user_id !== user.id
          ).length || 0;
          
          if (realCount === 1) {
            console.log('🎯 Son şans odası bulundu:', room.id.slice(-8));
            try {
              await supabase
                .from('game_participants')
                .insert({
                  room_id: room.id,
                  user_id: user.id,
                  score: 0,
                  is_bot: false
                });
              
              setCurrentRoom(room);
              console.log('✅ SON ŞANS EŞLEŞME BAŞARILI');
              return true;
            } catch (error) {
              console.log('⚠️ Son şans odası dolu olmuş');
              continue;
            }
          }
        }
      }

      // UYGUN ODA YOK - YENİ ODA AÇ
      console.log('🆕 Hiç uygun oda bulunamadı, yeni oda açılıyor...');
      const grid = generateRandomGrid();
      const { data: newRoom, error: roomError } = await supabase
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

      if (roomError) {
        console.error('❌ Oda oluşturma hatası:', roomError);
        throw roomError;
      }

      const { error: participantError } = await supabase
        .from('game_participants')
        .insert({
          room_id: newRoom.id,
          user_id: user.id,
          score: 0,
          is_bot: false
        });

      if (participantError) {
        console.error('❌ Katılımcı ekleme hatası:', participantError);
        throw participantError;
      }

      setCurrentRoom(newRoom);
      console.log('🆕 Yeni oda oluşturuldu ve beklemeye geçildi:', newRoom.id.slice(-8));
      console.log('🔍 ===== MATCHMAKING DEBUG END (WAITING) =====');
      return false; // Anında eşleşme yok, bekleniyor
      
    } catch (error) {
      console.error('🚨 Random match hatası:', error);
      console.log('🔍 ===== MATCHMAKING DEBUG END (ERROR) =====');
      return false;
    }
  }, [user]);

  // Add AI opponent to current room
  const addAIOpponent = async (): Promise<void> => {
    if (!currentRoom) return;

    try {
      console.log('🤖 AI rakip ekleniyor...');
      await supabase
        .from('game_participants')
        .insert({
          room_id: currentRoom.id,
          user_id: null,
          score: 0,
          is_bot: true
        });
      
      console.log('🤖 AI rakip başarıyla eklendi');
    } catch (error) {
      console.error('❌ AI rakip ekleme hatası:', error);
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
        console.log('👥 Katılımcılar güncellendi:', data.length);
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

    console.log('🔗 Real-time bağlantı kuruluyor:', currentRoom.id);
    setIsConnected(true);
    fetchParticipants(currentRoom.id);

    const channel = supabase
      .channel(`room-${currentRoom.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_participants',
        filter: `room_id=eq.${currentRoom.id}`
      }, (payload) => {
        console.log('📡 Real-time katılımcı değişikliği:', payload);
        fetchParticipants(currentRoom.id);
      })
      .subscribe();

    return () => {
      console.log('🔌 Real-time bağlantı kesiliyor');
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