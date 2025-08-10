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
  // GameContext.tsx - BASIT VE NET Matchmaking

const findRandomMatch = useCallback(async (gameType: 'timed' | 'score'): Promise<boolean> => {
  if (!user) return false;

  try {
    console.log('🔍 ===== BASİT MATCHMAKING BAŞLADI =====');
    console.log('👤 User:', user.id.slice(-8));
    console.log('🎮 Type:', gameType);
    
    // 1. ARAMA: Tam olarak 1 kişisi olan bekleyen odalar
    const { data: waitingRooms } = await supabase
      .from('game_rooms')
      .select(`
        *,
        game_participants!inner(user_id, is_bot)
      `)
      .eq('game_mode', 'random-match')
      .eq('status', 'waiting')
      .neq('host_id', user.id) // Kendi odası değil
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Son 5 dakika

    console.log('🔍 Bulunan bekleyen odalar:', waitingRooms?.length || 0);

    // 2. FILTRELEME: Sadece 1 gerçek oyuncusu olan odalar
    const availableRooms = waitingRooms?.filter(room => {
      const realPlayers = room.game_participants?.filter(p => !p.is_bot) || [];
      const gameTypeMatch = gameType === 'timed' ? room.time_limit > 0 : room.max_score > 0;
      
      console.log(`🏠 Oda ${room.id.slice(-8)}: ${realPlayers.length} oyuncu, type: ${gameTypeMatch ? 'uygun' : 'uyumsuz'}`);
      
      return realPlayers.length === 1 && gameTypeMatch;
    }) || [];

    console.log('✅ Uygun oda sayısı:', availableRooms.length);

    // 3. EŞLEŞME: İlk uygun odaya katıl
    if (availableRooms.length > 0) {
      const targetRoom = availableRooms[0];
      console.log('🎯 Hedef oda:', targetRoom.id.slice(-8));
      
      try {
        // Atomic insert - sadece bir kişi başarır
        const { error: joinError } = await supabase
          .from('game_participants')
          .insert({
            room_id: targetRoom.id,
            user_id: user.id,
            score: 0,
            is_bot: false
          });

        if (joinError) {
          // Muhtemelen başka biri daha hızlı katıldı
          console.log('⚠️ Katılma başarısız (başkası önce katıldı):', joinError.message);
          
          // Eğer duplicate key hatası ise, başka oda aramaya devam et
          if (joinError.code === '23505') {
            console.log('🔄 Duplicate - başka oda deneniyor...');
            // Yeni oda açmaya geç
          } else {
            throw joinError;
          }
        } else {
          // Başarılı katılım!
          setCurrentRoom(targetRoom);
          console.log('✅ BAŞARILI EŞLEŞME!');
          return true;
        }
      } catch (error) {
        console.error('❌ Katılma hatası:', error);
      }
    }

    // 4. YENİ ODA AÇ: Uygun oda yok veya katılma başarısız
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

    // Kendini odaya ekle
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
    
    return false; // Beklemede
    
  } catch (error) {
    console.error('🚨 Matchmaking hatası:', error);
    return false;
  }
}, [user]);

// YENİ: Oda dolduğunda otomatik kapatma
const closeFullRoom = async (roomId: string) => {
  try {
    console.log('🔒 Oda kapatılıyor (dolu):', roomId.slice(-8));
    
    // Oda durumunu 'active' yap (artık kimse katılamaz)
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
};

// YENİ: Participants değiştiğinde oda durumunu kontrol et
useEffect(() => {
  if (!currentRoom || currentRoom.status !== 'waiting') return;
  
  // Eğer 2 gerçek oyuncu varsa odayı kapat
  const realPlayers = participants.filter(p => !p.is_bot);
  
  if (realPlayers.length >= 2) {
    console.log('🔒 Oda dolu, kapatılıyor...');
    closeFullRoom(currentRoom.id);
  }
}, [participants, currentRoom]);

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

  // GameContext.tsx'e EKLE - Oyuncu ayrılma sistemi

// Real-time subscriptions bölümüne EKLENECEKLer:
useEffect(() => {
  if (!currentRoom) {
    setIsConnected(false);
    return;
  }

  console.log('🔗 Real-time bağlantı kuruluyor:', currentRoom.id.slice(-8));
  setIsConnected(true);
  fetchParticipants(currentRoom.id);

  const channel = supabase
    .channel(`room-${currentRoom.id}`)
    .on('postgres_changes', {
       event: '*',
       schema: 'public',
       table: 'game_participants',
       filter: `room_id=eq.${currentRoom.id}`
    }, async (payload: any) => { // ← any type ekle
  console.log('📡 ===== REAL-TIME EVENT =====');
  console.log('📡 Event Type:', payload.eventType);
  console.log('📡 New:', payload.new);
  console.log('📡 Old:', payload.old);
  console.log('📡 =============================');
  
  // SADECE DELETE kontrol et
  if (payload.eventType === 'DELETE') {
    console.log('🚪 DELETE event tespit edildi!');
    console.log('🚪 Ayrılan oyuncu:', payload.old);
    
    // Type checking ekle
    if (payload.old && 
        !payload.old.is_bot && 
        payload.old.user_id && 
        payload.old.user_id !== user?.id) {
      
      console.log('🏆 GERÇEK OYUNCU AYRILDI - KAZANMA BAŞLADI!');
      
      // Ayrılan oyuncuya ceza puanı uygula
      await applyDisconnectPenalty(payload.old.user_id);
      
      // Kalan oyuncuya kazanma bonusu ver
      await applyWinBonus(user?.id);
      
      toast({
        title: '🏆 Kazandınız!',
        description: 'Rakip oyuncu oyundan ayrıldı. +100 bonus puan!',
        duration: 4000,
      });
      
      // Oyunu sonlandır
      setTimeout(() => {
        console.log('🎮 Disconnect event dispatch ediliyor...');
        window.dispatchEvent(new CustomEvent('playerDisconnected', {
          detail: { winner: 'player', reason: 'opponent_left' }
        }));
      }, 1000);
    }
  }
  
  fetchParticipants(currentRoom.id);
})
    })
    // YENI: Presence tracking ekle (bağlantı kopması)
    .on('presence', { event: 'sync' }, () => {
      console.log('👥 Presence sync');
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('👋 Kullanıcı katıldı:', key);
    })
    .on('presence', { event: 'leave' }, async ({ key, leftPresences }) => {
      console.log('🚪 Kullanıcı bağlantısı koptu:', key);
      
      // Eğer oyun aktif ve başka oyuncu ayrıldıysa
      if (currentRoom.status === 'active' && key !== `user-${user?.id}`) {
        console.log('📡 Bağlantı kopması tespit edildi');
        
        // Kısa bir süre bekle (geçici bağlantı sorunu olabilir)
        setTimeout(async () => {
          // Hala yoksa ceza uygula
          const { data: participants } = await supabase
            .from('game_participants')
            .select('user_id')
            .eq('room_id', currentRoom.id)
            .neq('user_id', user?.id);
          
          if (!participants || participants.length === 0) {
            console.log('🏆 Rakip bağlantısı koptu - oyuncu kazandı!');
            
            toast({
              title: '🏆 Kazandınız!',
              description: 'Rakip oyuncunun bağlantısı koptu. +50 puan!',
              duration: 4000,
            });
            
            // Kazanma bonusu ver
            await applyWinBonus(user?.id, 50);
            
            // Oyunu sonlandır
            window.dispatchEvent(new CustomEvent('playerDisconnected', {
              detail: { winner: 'player', reason: 'connection_lost' }
            }));
          }
        }, 10000); // 10 saniye bekle
      }
    })
    .subscribe();

  return () => {
    console.log('🔌 Real-time bağlantı kesiliyor');
    supabase.removeChannel(channel);
  };
}, [currentRoom, user]);

// YENI: Ayrılma cezası uygulama fonksiyonu
const applyDisconnectPenalty = async (userId: string) => {
  if (!userId) return;
  
  try {
    console.log('⚖️ Ayrılma cezası uygulanıyor:', userId.slice(-8));
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('total_score, disconnect_count')
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
    }
  } catch (error) {
    console.error('❌ Ceza uygulama hatası:', error);
  }
};

// YENI: Kazanma bonusu verme fonksiyonu
const applyWinBonus = async (userId: string | undefined, bonusAmount: number = 100) => {
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
};

// YENI: Sayfa kapatılırken temizlik ve ceza
useEffect(() => {
  const handleBeforeUnload = async () => {
    if (currentRoom && user && currentRoom.status === 'active') {
      console.log('🚪 Oyuncu oyunu kapatıyor - ceza uygulanacak');
      
      // Kendine ceza uygula
      await applyDisconnectPenalty(user.id);
      
      // Odadan çıkar
      await supabase
        .from('game_participants')
        .delete()
        .eq('room_id', currentRoom.id)
        .eq('user_id', user.id);
    }
  };

  // Sayfa kapatılırken
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // Uygulama kapanırken (React cleanup)
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    
    // Component unmount olurken de kontrol et
    if (currentRoom && user && currentRoom.status === 'active') {
      // Background'da çalıştır (blocking olmayacak şekilde)
      handleBeforeUnload();
    }
  };
}, [currentRoom, user]);

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