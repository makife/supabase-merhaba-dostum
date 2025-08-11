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
  user_id: string | null;
  score: number;
  is_bot: boolean;
  joined_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
  };
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

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any> | null;
  old: Record<string, any> | null;
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

  // Helper function to determine game mode
  const getGameModeFromRoom = useCallback((room: GameRoom | null): string => {
    if (!room) return 'unknown';
    return room.game_mode;
  }, []);

  // Cleanup old rooms
  const cleanupOldRooms = useCallback(async () => {
  try {
    console.log('🧹 Cleanup başlıyor - BÜTÜN ESKİ ODALAR SİLİNECEK');
    
    // 10 dakika öncesi tüm odaları sil
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: deleted } = await supabase
      .from('game_rooms')
      .delete()
      .lt('created_at', tenMinutesAgo)
      .select();
    
    console.log('🧹 Silinen oda sayısı:', deleted?.length || 0);
    console.log('🧹 Cleanup tamamlandı');
  } catch (error) {
    console.error('❌ Cleanup hatası:', error);
  }
}, []);

  // Apply disconnect penalty with notifications
  const applyDisconnectPenalty = useCallback(async (userId: string, isCurrentUser: boolean = false) => {
    if (!userId) return;
    
    try {
      console.log('⚖️ Ayrılma cezası uygulanıyor:', userId.slice(-8));
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('total_score, disconnect_count, username')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('❌ Profile fetch error:', error);
        return;
      }
      
      if (profile) {
        const currentScore = profile.total_score || 0;
        const disconnectCount = (profile.disconnect_count || 0) + 1;
        const penaltyAmount = Math.min(50 + (disconnectCount * 10), 200);
        const newScore = Math.max(0, currentScore - penaltyAmount);
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            total_score: newScore,
            disconnect_count: disconnectCount,
            last_disconnect: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (updateError) {
          console.error('❌ Profile update error:', updateError);
          return;
        }
        
        console.log('⚖️ Ceza uygulandı:', penaltyAmount, 'puan');
        
        // Show notifications
        if (isCurrentUser) {
          // Show penalty notification to the user who disconnected
          toast({
            title: '⚖️ Ayrılma Cezası',
            description: `Oyundan ayrıldığınız için ${penaltyAmount} puan kaybettiniz`,
            variant: 'destructive',
          });
        } else {
          // Show notification about opponent leaving
          toast({
            title: '🚪 Rakip Ayrıldı',
            description: `${profile.username} oyundan ayrıldı ve ceza aldı. Siz kazandınız!`,
          });
        }
      }
    } catch (error) {
      console.error('❌ Ceza uygulama hatası:', error);
    }
  }, [toast]);

  // Apply win bonus
  const applyWinBonus = useCallback(async (userId: string | undefined, bonusAmount: number = 100) => {
    if (!userId) return;
    
    try {
      console.log('🏆 Kazanma bonusu veriliyor:', bonusAmount);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('total_score, win_count')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('❌ Profile fetch error:', error);
        return;
      }
      
      if (profile) {
        const currentScore = profile.total_score || 0;
        const winCount = (profile.win_count || 0) + 1;
        const newScore = currentScore + bonusAmount;
        
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ 
            total_score: newScore,
            win_count: winCount,
            last_win: new Date().toISOString()
          })
          .eq('id', userId);
        
        if (updateError) {
          console.error('❌ Profile update error:', updateError);
          return;
        }
        
        console.log('🏆 Bonus verildi:', bonusAmount, 'puan');
      }
    } catch (error) {
      console.error('❌ Bonus verme hatası:', error);
    }
  }, []);

  // Close full room
  const closeFullRoom = useCallback(async (roomId: string) => {
    try {
      console.log('🔒 Oda kapatılıyor (dolu):', roomId.slice(-8));
      
      await supabase
        .from('game_rooms')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', roomId);
        
      console.log('✅ Oda kapatıldı');
    } catch (error) {
      console.error('❌ Oda kapatma hatası:', error);
    }
  }, []);

  // Fetch participants
  const fetchParticipants = useCallback(async (roomId: string) => {
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
        setParticipants(data as GameParticipant[]);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  }, []);

  // Create room
  const createRoom = useCallback(async (gameMode: string, roomCode?: string): Promise<GameRoom | null> => {
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
  }, [user, toast]);

  // Join room
  const joinRoom = useCallback(async (roomCode: string): Promise<boolean> => {
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
            score: 0,
            is_bot: false
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
  }, [user, toast]);

  // Find random match - race condition prevention
  const findRandomMatch = useCallback(async (gameType: 'timed' | 'score'): Promise<boolean> => {
  if (!user) return false;

  try {
    console.log('🔍 ===== BASİT MATCHMAKING BAŞLADI =====');
    console.log('👤 User:', user.id.slice(-8));
    console.log('🎮 Type:', gameType);
    
    // DÜZELTME: Supabase query'sini düzelt - created_at kontrolünü kaldır
    const { data: waitingRooms, error } = await supabase
      .from('game_rooms')
      .select(`
        *,
        game_participants!inner(user_id, is_bot)
      `)
      .eq('game_mode', 'random-match')
      .eq('status', 'waiting')
      .neq('host_id', user.id) // DÜZELTME: UUID format doğru
      .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()); // Son 10 dakika

    if (error) {
      console.error('❌ Waiting rooms query hatası:', error);
      throw error;
    }

    console.log('🔍 Bulunan bekleyen odalar:', waitingRooms?.length || 0);

    // Filter rooms with exactly 1 real player and matching game type
    const availableRooms = waitingRooms?.filter(room => {
      const realPlayers = room.game_participants?.filter(p => !p.is_bot) || [];
      const gameTypeMatch = gameType === 'timed' ? room.time_limit > 0 : room.max_score > 0;
      
      console.log(`🏠 Oda ${room.id.slice(-8)}: ${realPlayers.length} oyuncu, type: ${gameTypeMatch ? 'uygun' : 'uyumsuz'}`);
      
      return realPlayers.length === 1 && gameTypeMatch;
    }) || [];

    console.log('✅ Uygun oda sayısı:', availableRooms.length);

    // Try to join first available room
    if (availableRooms.length > 0) {
      const targetRoom = availableRooms[0];
      console.log('🎯 Hedef oda:', targetRoom.id.slice(-8));
      
      try {
        // DÜZELTME: Önce mevcut katılımları kontrol et
        const { data: existingParticipant } = await supabase
          .from('game_participants')
          .select('id')
          .eq('room_id', targetRoom.id)
          .eq('user_id', user.id)
          .single();

        if (existingParticipant) {
          console.log('⚠️ Zaten bu odada katılımcısınız');
          setCurrentRoom(targetRoom);
          return true;
        }

        // Atomic insert - only one person succeeds
        const { error: joinError } = await supabase
          .from('game_participants')
          .insert({
            room_id: targetRoom.id,
            user_id: user.id,
            score: 0,
            is_bot: false
          });

        if (joinError) {
          // Probably someone else joined first
          console.log('⚠️ Katılma başarısız (başkası önce katıldı):', joinError.message);
          
          if (joinError.code === '23505') {
            console.log('🔄 Duplicate - başka oda deneniyor...');
            // Continue to create new room
          } else {
            throw joinError;
          }
        } else {
          // Successful join!
          setCurrentRoom(targetRoom);
          console.log('✅ BAŞARILI EŞLEŞME!');
          
          // DÜZELTME: Oyunu hemen başlat
          toast({
            title: '🎯 Eşleşme Bulundu!',
            description: 'Rakip bulundu, oyun başlıyor...',
            duration: 2000,
          });
          
          return true;
        }
      } catch (error) {
        console.error('❌ Katılma hatası:', error);
      }
    }

    // Create new room if no available room or join failed
    console.log('🆕 Yeni oda açılıyor...');
    
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

    if (roomError) throw roomError;

    // Add self to room
    const { error: participantError } = await supabase
      .from('game_participants')
      .insert({
        room_id: newRoom.id,
        user_id: user.id,
        score: 0,
        is_bot: false
      });

    if (participantError) throw participantError;

    setCurrentRoom(newRoom);
    console.log('🆕 Yeni oda oluşturuldu:', newRoom.id.slice(-8));
    console.log('🔍 ===== MATCHMAKING BİTTİ (BEKLEMEDE) =====');
    
    toast({
      title: '🔍 Rakip Aranıyor...',
      description: 'Oyuncular aranıyor, bekleyiniz...',
      duration: 3000,
    });
    
    return false; // Waiting
    
  } catch (error) {
    console.error('🚨 Matchmaking hatası:', error);
    toast({
      title: 'Eşleşme Hatası',
      description: 'Rakip bulunurken hata oluştu. Tekrar deneyin.',
      variant: 'destructive',
    });
    return false;
  }
}, [user, toast]);

  // Add AI opponent to current room
  const addAIOpponent = useCallback(async (): Promise<void> => {
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
  }, [currentRoom]);

  // Leave room
  const leaveRoom = useCallback(async (): Promise<void> => {
  if (!user || !currentRoom) return;

  try {
    console.log('🚪 Manual leave - oda siliniyor:', currentRoom.id.slice(-8));
    
    // Aktif oyunsa ceza uygula
    if (currentRoom.status === 'active') {
      await applyDisconnectPenalty(user.id, true);
    }

    // ★★★ SIMPLE: ODAYI HEMEN SİL ★★★
    await supabase
      .from('game_rooms')
      .delete()
      .eq('id', currentRoom.id);

    setCurrentRoom(null);
    setParticipants([]);
    console.log('✅ Oda silindi, state temizlendi');
    
  } catch (error) {
    console.error('❌ Leave room hatası:', error);
  }
}, [user, currentRoom, applyDisconnectPenalty]);

  // Update score
  const updateScore = useCallback(async (score: number): Promise<void> => {
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
  }, [user, currentRoom]);

  // Start game
  const startGame = useCallback(async (): Promise<void> => {
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
  }, [currentRoom]);

  // End game
  const endGame = useCallback(async (): Promise<void> => {
  if (!currentRoom) return;

  try {
    console.log('🏁 Oyun bitiyor - oda siliniyor:', currentRoom.id.slice(-8));
    
    // ★★★ SIMPLE: ODAYI SİL ★★★
    await supabase
      .from('game_rooms')
      .delete()
      .eq('id', currentRoom.id);
    
    setCurrentRoom(null);
    setParticipants([]);
    console.log('✅ Oyun bitti, oda silindi');
    
  } catch (error) {
    console.error('❌ End game hatası:', error);
  }
}, [currentRoom]);

  // Check if room is full and close it
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'waiting') return;
    
    const realPlayers = participants.filter(p => !p.is_bot);
    
    if (realPlayers.length >= 2) {
      console.log('🔒 Oda dolu, kapatılıyor...');
      closeFullRoom(currentRoom.id);
    }
  }, [participants, currentRoom, closeFullRoom]);

  // Real-time subscriptions
  useEffect(() => {
  if (!currentRoom) {
    setIsConnected(false);
    return;
  }

  console.log('🔗 Real-time bağlantı kuruluyor:', currentRoom.id.slice(-8));
  setIsConnected(true);
  fetchParticipants(currentRoom.id);

  const currentGameMode = getGameModeFromRoom(currentRoom);

  const channel = supabase
    .channel(`room-${currentRoom.id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'game_participants',
      filter: `room_id=eq.${currentRoom.id}`
    }, async (payload: RealtimePayload) => {
      console.log('📡 ===== REAL-TIME EVENT =====');
      console.log('📡 Event Type:', payload.eventType);
      console.log('📡 Game Mode:', currentGameMode);
      
      // Handle DELETE events - OYUNCU AYRILDI
      if (payload.eventType === 'DELETE' && payload.old) {
        console.log('🚪 OYUNCU AYRILDI!');
        
        if (!payload.old.is_bot && 
            payload.old.user_id && 
            payload.old.user_id !== user?.id &&
            currentRoom.status === 'active') {
          
          console.log('🏆 RAKIP AYRILDI - KAZANDIN!');
          
          // Ceza ver
          await applyDisconnectPenalty(payload.old.user_id, false);
          
          // Bonus ver
          await applyWinBonus(user?.id);
          
          toast({
            title: '🏆 Kazandınız!',
            description: 'Rakip oyundan ayrıldı. +100 bonus puan!',
            duration: 4000,
          });
          
          // ★★★ KILIT NOKTA: ODAYI SİL! ★★★
          console.log('🗑️ ODA SİLİNİYOR - TEKRAR EŞLEŞME ÖNLEME');
          await supabase
            .from('game_rooms')
            .delete()
            .eq('id', currentRoom.id);
          
          // Disconnect event gönder
          window.dispatchEvent(new CustomEvent('playerDisconnected', {
            detail: { winner: 'player', reason: 'opponent_left' }
          }));
          
          // State temizle
          setTimeout(() => {
            setCurrentRoom(null);
            setParticipants([]);
          }, 2000);
        }
      }
      
      fetchParticipants(currentRoom.id);
    })
    .on('presence', { event: 'leave' }, async ({ key }) => {
      console.log('🚪 Bağlantı koptu:', key);
      
      if (currentRoom.status === 'active' && key !== `user-${user?.id}`) {
        setTimeout(async () => {
          const { data: participants } = await supabase
            .from('game_participants')
            .select('user_id, is_bot')
            .eq('room_id', currentRoom.id)
            .neq('user_id', user?.id);
          
          const realPlayers = participants?.filter(p => !p.is_bot) || [];
          
          if (realPlayers.length === 0) {
            console.log('🏆 Bağlantı kopması - kazandın!');
            
            await applyWinBonus(user?.id, 50);
            
            toast({
              title: '🏆 Kazandınız!',
              description: 'Rakip bağlantısı koptu. +50 puan!',
              duration: 4000,
            });
            
            // ★★★ KILIT NOKTA: ODAYI SİL! ★★★
            console.log('🗑️ ODA SİLİNİYOR - BAĞLANTI KOPMASI');
            await supabase
              .from('game_rooms')
              .delete()
              .eq('id', currentRoom.id);
            
            window.dispatchEvent(new CustomEvent('playerDisconnected', {
              detail: { winner: 'player', reason: 'connection_lost' }
            }));
            
            setTimeout(() => {
              setCurrentRoom(null);
              setParticipants([]);
            }, 2000);
          }
        }, 5000); // 5 saniye bekle
      }
    })
    .subscribe();

  return () => {
    console.log('🔌 Real-time bağlantı kesiliyor');
    supabase.removeChannel(channel);
  };
}, [currentRoom?.id, currentRoom?.status, user?.id]);

  // Handle page close/refresh cleanup
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (currentRoom && user && currentRoom.status === 'active') {
        console.log('🚪 Oyuncu oyunu kapatıyor - ceza uygulanacak');
        
        // Apply penalty to self and show notification
        await applyDisconnectPenalty(user.id, true);
        
        // Leave room
        await supabase
          .from('game_participants')
          .delete()
          .eq('room_id', currentRoom.id)
          .eq('user_id', user.id);
      }
    };

    // Handle page close
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Check on component unmount as well
      if (currentRoom && user && currentRoom.status === 'active') {
        // Run in background (non-blocking)
        handleBeforeUnload();
      }
    };
  }, [currentRoom, user, applyDisconnectPenalty]);

  // Initialize cleanup on mount
  useEffect(() => {
    cleanupOldRooms();
  }, [cleanupOldRooms]);

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