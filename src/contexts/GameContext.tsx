import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNakamaMatchmaking } from '@/hooks/useNakamaMatchmaking';

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
  endGame: (
    playerStats?: {
      userId: string;
      score: number;
      words: Array<{word: string, score: number}>;
      isWinner: boolean;
    },
    opponentStats?: {
      userId: string;
      score: number;
      words: Array<{word: string, score: number}>;
      isWinner: boolean;
    }
  ) => Promise<void>;
  updatePlayerStatistics: (
    userId: string, 
    gameScore: number, 
    words: Array<{word: string, score: number}>, 
    isWinner?: boolean
  ) => Promise<void>;
  checkBadges: (userId: string, wordsCount?: number) => Promise<void>;
  isConnected: boolean;
  useNakama: boolean;
  toggleNakama: () => void;
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
  const [useNakama, setUseNakama] = useState(false);

  const toggleNakama = () => {
  setUseNakama(!useNakama);
};

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
    if (!userId) {
      console.log('⚠️ applyDisconnectPenalty: userId boş');
      return;
    }
    
    try {
      console.log('⚖️ Ceza uygulanacak oyuncu:', userId.slice(-8));
      console.log('⚖️ Current user mi?', isCurrentUser);
      console.log('⚖️ Actual current user:', user?.id?.slice(-8));
    
      // Double check: Kendine ceza verme!
      if (userId === user?.id && !isCurrentUser) {
        console.log('🛡️ KORUNMA: Kendine ceza vermeyi engellendi!');
        return;
      }
    
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
      
        console.log('⚖️ Ceza uygulandı:', {
          userId: userId.slice(-8),
          penaltyAmount,
          newScore,
          username: profile.username
        });
      
        // Notifications
        if (isCurrentUser) {
          // Kendine ceza mesajı
          toast({
            title: '⚖️ Ayrılma Cezası',
            description: `Oyundan ayrıldığınız için ${penaltyAmount} puan kaybettiniz`,
            variant: 'destructive',
          });
        } else {
          // Rakip ayrıldı mesajı (kazanan için)
          toast({
            title: '🚪 Rakip Ayrıldı',
            description: `${profile.username} oyundan ayrıldı ve ceza aldı.`,
          });
        }
      }
    } catch (error) {
      console.error('❌ Ceza uygulama hatası:', error);
    }
  }, [toast, user?.id]);


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
    console.log('📊 === PARTICIPANTS DEBUG BAŞLADI ===');
    console.log('📊 Room ID:', roomId.slice(-8));
    console.log('📊 User ID:', user?.id?.slice(-8));
  
    // 🔥 FIX: LEFT JOIN kullan - profile olmasa da participant'ı getir
    const { data, error, count } = await supabase
      .from('game_participants')
      .select(`
        *,
        profiles (
          id,
          username,
          avatar_url
        )
      `, { count: 'exact' })
      .eq('room_id', roomId);
  
    console.log('📊 SQL Query Result:', {
      data: data?.length || 0,
      error: error?.message,
      count,
      participants: data
    });
  
    if (error) {
      console.error('❌ SQL Error:', error);
      return;
    }
  
    if (data) {
      console.log('📊 Raw participants data:');
      data.forEach((p, i) => {
        console.log(`  ${i+1}. User: ${p.user_id?.slice(-8) || 'null'}, Bot: ${p.is_bot}, Score: ${p.score}`);
        console.log(`      Username: ${(p as any).profiles?.username || 'N/A'}`);
        console.log(`      Avatar: ${(p as any).profiles?.avatar_url || 'N/A'}`);
      });
    
      setParticipants(data as GameParticipant[]);
      console.log('✅ Participants state güncellendi:', data.length);
    } else {
      console.log('⚠️ No participants data received');
      setParticipants([]);
    }
  
    console.log('📊 === PARTICIPANTS DEBUG BİTTİ ===');
  } catch (error) {
    console.error('❌ fetchParticipants HATA:', error);
    setParticipants([]);
  }
}, [user?.id]);

  // Create room
  const createRoom = useCallback(async (gameMode: string, roomCode?: string): Promise<GameRoom | null> => {
    if (!user) return null;

    try {
      console.log('🏠 === ROOM CREATE DEBUG BAŞLADI ===');
      console.log('🏠 Game Mode:', gameMode);
      console.log('🏠 Room Code:', roomCode);
      console.log('🏠 User ID:', user.id.slice(-8));
    
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

      if (error) {
        console.error('❌ Room creation error:', error);
        throw error;
      }
    
      console.log('✅ Room created:', room.id.slice(-8));

      // Join as participant - DEBUG
      console.log('👤 Adding self as participant...');
      const { data: participantData, error: participantError } = await supabase
        .from('game_participants')
        .insert({
          room_id: room.id,
          user_id: user.id,
          score: 0,
          is_bot: false
        })
        .select()
        .single();

      if (participantError) {
        console.error('❌ Participant creation error:', participantError);
        throw participantError;
      }
    
      console.log('✅ Participant created:', participantData.id);

      // Add AI for vs-computer mode
      if (gameMode === 'vs-computer') {
        console.log('🤖 Adding AI opponent...');
        const { error: aiError } = await supabase
          .from('game_participants')
          .insert({
            room_id: room.id,
            user_id: null,
            score: 0,
            is_bot: true
          });
        
        if (aiError) {
          console.error('❌ AI creation error:', aiError);
        } else {
          console.log('✅ AI opponent added');
        }
      }

      setCurrentRoom(room);
    
      // MANUEL PARTICIPANTS FETCH
      console.log('🔄 Manual participants fetch...');
      setTimeout(() => {
        fetchParticipants(room.id);
      }, 500); // 500ms bekle
    
      toast({
        title: 'Oda Oluşturuldu',
        description: roomCode ? `Oda kodu: ${roomCode}` : 'Oyuna hazırsınız',
      });

      console.log('🏠 === ROOM CREATE DEBUG BİTTİ ===');
      return room;
    } catch (error) {
      console.error('❌ Error creating room:', error);
      toast({
        title: 'Hata',
        description: 'Oda oluşturulamadı',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, toast, fetchParticipants]);

  // Join room
  const joinRoom = useCallback(async (roomCode: string): Promise<boolean> => {
    if (!user) return false;

    try {
      console.log('🔍 Özel oda aranıyor:', roomCode);
    
      // Önce oda var mı kontrol et
      const { data: room, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', roomCode)
        .eq('status', 'waiting')
        .single();

      if (roomError || !room) {
        console.error('❌ Oda bulunamadı:', roomError);
        toast({
          title: 'Hata',
          description: 'Oda bulunamadı veya dolu',
          variant: 'destructive',
        });
        return false;
      }

      console.log('✅ Oda bulundu:', room.id.slice(-8));

      // Mevcut katılımcıları kontrol et - Normal sorgu kullan (RPC tip sorunu)
      const { data: participants, error: participantsError } = await supabase
        .from('game_participants')
        .select('user_id, is_bot')
        .eq('room_id', room.id);

      if (participantsError) {
        console.error('❌ Katılımcı kontrolü hatası:', participantsError);
        toast({
          title: 'Hata',
          description: 'Katılımcı kontrolü başarısız',
          variant: 'destructive',
        });
        return false;
      }

      const realPlayerCount = participants?.filter(p => !p.is_bot).length || 0;
      if (realPlayerCount >= 2) {
        toast({
          title: 'Hata',
          description: 'Oda dolu',
          variant: 'destructive', // destructive " -> destructive (boşluk kaldır)
        });
        return false;
      }

      // Kullanıcı zaten katılmış mı kontrol et
      const isAlreadyJoined = participants?.some(p => p.user_id === user.id);
      if (isAlreadyJoined) {
        console.log('✅ Kullanıcı zaten katılmış, room state güncelleniyor');
        setCurrentRoom(room);
        await fetchParticipants(room.id);
        return true;
      }

      // Odaya katıl
      const { error: joinError } = await supabase
        .from('game_participants')
        .insert({
          room_id: room.id,
          user_id: user.id,
          score: 0,
          is_bot: false
        });

      if (joinError) {
        console.error('❌ Odaya katılma hatası:', joinError);
        toast({
          title: 'Hata',
          description: 'Odaya katılamadı',
          variant: 'destructive',
        });
        return false;
      }

      console.log('✅ Odaya katılım başarılı');
      setCurrentRoom(room);
    
      toast({
        title: 'Odaya Katıldınız',
        description: 'Diğer oyuncuyu bekleniyor...',
      });

      return true;
    } catch (error: any) {
      console.error('❌ Özel oda katılım hatası:', error);
      toast({
        title: 'Hata',
        description: 'Odaya katılamadı',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast, fetchParticipants]);

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
          console.log('⚠️ Zaten bu odada katılımcısınız, oda güncelleniyor');
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

    // Add self to room as participant (host can play too)
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
    console.log('🆕 Yeni oda oluşturuldu:', newRoom.id.slice(-8));
    console.log('👤 Host kendini katılımcı olarak ekledi:', user.id.slice(-8));
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
    
    // Önce mevcut AI kontrolü
    const { data: existingAI } = await supabase
      .from('game_participants')
      .select('id')
      .eq('room_id', currentRoom.id)
      .eq('is_bot', true)
      .single();
    
    if (existingAI) {
      console.log('⚠️ AI zaten mevcut');
      return;
    }
    
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
  if (!user || !currentRoom) {
    // Eğer currentRoom yoksa sadece state temizle
    console.log('🧹 Room yok ama state temizleniyor');
    setCurrentRoom(null);
    setParticipants([]);
    return;
  }

  try {
    console.log('🚪 Manual leave başlıyor:', {
      roomId: currentRoom.id.slice(-8),
      status: currentRoom.status,
      participantCount: participants.length,
      userId: user.id.slice(-8)
    });
    
    // 🔥 FIX: Sadece gerçekten aktif oyun + gerçek rakipli durumda ceza
    const shouldApplyPenalty = currentRoom.status === 'active' && 
                              participants.length >= 2 &&
                              participants.some(p => !p.is_bot && p.user_id !== user.id);
    
    // 🔥 YENİ: Karşı tarafa bonus ver (manuel ayrılmadan önce)
    const realOpponent = participants.find(p => !p.is_bot && p.user_id !== user.id);
    if (realOpponent && (currentRoom.status === 'active' || currentRoom.status === 'waiting')) {
      console.log('📢 Karşı tarafa bonus veriliyor:', realOpponent.user_id?.slice(-8));
      
      // Karşı tarafa kazanma bonusu ver
      await applyWinBonus(realOpponent.user_id!, 100);
      console.log('💰 Rakip +100 bonus puan aldı');
    }
    
    if (shouldApplyPenalty) {
      console.log('⚖️ Ceza uygulanacak (aktif oyun + gerçek rakip)');
      await applyDisconnectPenalty(user.id, true);
    } else {
      console.log('✅ Ceza yok:', {
        isActive: currentRoom.status === 'active',
        hasEnoughParticipants: participants.length >= 2,
        hasRealOpponent: participants.some(p => !p.is_bot && p.user_id !== user.id)
      });
    }

    // Participant'ı sil
    await supabase
      .from('game_participants')
      .delete()
      .eq('room_id', currentRoom.id)
      .eq('user_id', user.id);

    console.log('✅ Participant silindi');

    // Eğer host isen veya tek kalınsa odayı sil
    const remainingParticipants = participants.filter(p => p.user_id !== user.id);
    const realPlayersRemaining = remainingParticipants.filter(p => !p.is_bot);
    
    if (currentRoom.host_id === user.id || realPlayersRemaining.length === 0) {
      console.log('🗑️ Oda siliniyor (host ayrıldı veya gerçek oyuncu kalmadı)');
      await supabase
        .from('game_rooms')
        .delete()
        .eq('id', currentRoom.id);
    }

    // 🔥 STATE TEMİZLEME - HER DURUMDA!
    console.log('🧹 Local state temizleniyor...');
    setCurrentRoom(null);
    setParticipants([]);
    console.log('✅ Leave room tamamlandı, state temizlendi');
    
  } catch (error) {
    console.error('❌ Leave room hatası:', error);
    // Hata olsa bile state'i temizle
    setCurrentRoom(null);
    setParticipants([]);
  }
}, [user, currentRoom, participants, applyDisconnectPenalty, applyWinBonus]);

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


  // Update game statistics for a player - NOW HANDLED BY DATABASE TRIGGERS
  const updatePlayerStatistics = useCallback(async (
    userId: string, 
    gameScore: number, 
    words: Array<{word: string, score: number}>, 
    isWinner: boolean = false
  ) => {
    // Statistics are now automatically handled by database triggers
    // when game room status is updated to 'finished'
    console.log('📊 Istatistikler artık database trigger ile otomatik güncelleniyor');
   }, []);

  // Check and award badges for a user
  const checkBadges = useCallback(async (userId: string, wordsCount?: number) => {
    try {
      console.log('🏆 Rozet kontrolü yapılıyor:', userId);
    
      // General badge check - Type assertion ile düzelt
      const { data: generalBadges, error: generalError } = await supabase.rpc('check_and_award_badges', {
        p_user_id: userId
      });
    
      if (generalError) {
        console.error('❌ Genel rozet kontrolü hatası:', generalError);
      } else if (generalBadges && Array.isArray(generalBadges) && generalBadges.length > 0) {
        // Type assertion: generalBadges as any[]
        (generalBadges as any[]).forEach((badge: any) => {
          toast({
            title: '🏆 Yeni Rozet!',
            description: `"${badge.new_badge_name}" rozetini kazandınız! ${badge.new_badge_icon}`,
            duration: 4000,
          });
        });
      }
    
      // Words per game badge check
      if (wordsCount && wordsCount > 0) {
        const { data: wordsBadges, error: wordsError } = await supabase.rpc('check_words_per_game_badge', {
          p_user_id: userId,
          p_words_count: wordsCount
        });
      
        if (wordsError) {
          console.error('❌ Kelime rozeti kontrolü hatası:', wordsError);
        } else if (wordsBadges && Array.isArray(wordsBadges) && wordsBadges.length > 0) {
          // Type assertion: wordsBadges as any[]
          (wordsBadges as any[]).forEach((badge: any) => {
            toast({
              title: '🏆 Yeni Rozet!',
              description: `"${badge.new_badge_name}" rozetini kazandınız! ${badge.new_badge_icon}`,
              duration: 4000,
            });
          });
        }
      }
    
      console.log('✅ Rozet kontrolü tamamlandı');
    } catch (error) {
      console.error('❌ Rozet kontrolü hatası:', error);
    }
  }, [toast]);

  // End game
  const endGame = useCallback(async (
    playerStats?: {
      userId: string;
      score: number;
      words: Array<{word: string, score: number}>;
      isWinner: boolean;
    },
    opponentStats?: {
      userId: string;
      score: number;
      words: Array<{word: string, score: number}>;
      isWinner: boolean;
    }
  ): Promise<void> => {
  if (!currentRoom) return;

  try {
    console.log('🏁 Oyun bitiyor - room güncelleniyor:', currentRoom.id.slice(-8));
    
    // Determine winner and add words to game_words table
    let winnerId: string | null = null;
    let player1Id: string | null = null;
    let player2Id: string | null = null;
    let player1Score = 0;
    let player2Score = 0;
    
    if (playerStats) {
      if (participants.some(p => p.user_id === playerStats.userId)) {
        player1Id = playerStats.userId;
        player1Score = playerStats.score;
        if (playerStats.isWinner) winnerId = playerStats.userId;
        
        // Add player's words to game_words table
        for (const word of playerStats.words) {
          await supabase
            .from('game_words')
            .insert({
              room_id: currentRoom.id,
              player_id: playerStats.userId,
              word: word.word,
              points: word.score
            });
        }
      }
    }
    
    if (opponentStats && !participants.find(p => p.user_id === opponentStats.userId && p.is_bot)) {
      player2Id = opponentStats.userId;
      player2Score = opponentStats.score;
      if (opponentStats.isWinner) winnerId = opponentStats.userId;
      
      // Add opponent's words to game_words table
      for (const word of opponentStats.words) {
        await supabase
          .from('game_words')
          .insert({
            room_id: currentRoom.id,
            player_id: opponentStats.userId,
            word: word.word,
            points: word.score
          });
      }
    }
    
    // Update room with final status and winner - THIS TRIGGERS THE DATABASE FUNCTION
    await supabase
      .from('game_rooms')
      .update({
        status: 'finished',
        finished_at: new Date().toISOString(),
        winner_id: winnerId,
        player1_id: player1Id,
        player2_id: player2Id,
        player1_score: player1Score,
        player2_score: player2Score
      })
      .eq('id', currentRoom.id);
    
    console.log('✅ Room updated with game completion - triggers will handle stats');
    
    // Wait a moment for triggers to process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check for new badges after database triggers complete
    if (playerStats) {
      await checkBadges(playerStats.userId, playerStats.words.length);
    }
    if (opponentStats && !participants.find(p => p.user_id === opponentStats.userId && p.is_bot)) {
      await checkBadges(opponentStats.userId, opponentStats.words.length);
    }
    
    // Clean up room after a delay to allow triggers to complete
    setTimeout(async () => {
      try {
        await supabase
          .from('game_rooms')
          .delete()
          .eq('id', currentRoom.id);
        console.log('✅ Room cleaned up after stats processing');
      } catch (error) {
        console.error('❌ Room cleanup error:', error);
      }
    }, 2000);
    
    setCurrentRoom(null);
    setParticipants([]);
    console.log('✅ Oyun bitti, istatistikler database trigger ile güncellendi');
    
  } catch (error) {
    console.error('❌ End game hatası:', error);
  }
}, [currentRoom, participants, checkBadges]);

  // Check if room is full and close it
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== 'waiting') return;
  
    const realPlayers = participants.filter(p => !p.is_bot);
    console.log('🔍 Oda kontrolü - Gerçek oyuncu sayısı:', realPlayers.length);
  
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
    console.log('📡 Current User:', user?.id?.slice(-8));
    console.log('📡 Payload User:', payload.new?.user_id?.slice(-8) || payload.old?.user_id?.slice(-8));
    
    // PRIVATE ROOM için özel INSERT handling
    if (payload.eventType === 'INSERT' && payload.new) {
      console.log('👤 Yeni katılımcı tespit edildi:', payload.new.user_id?.slice(-8));
      
      if (!payload.new.is_bot && 
          payload.new.user_id && 
          payload.new.user_id !== user?.id) {
        
        console.log('✅ GERÇEK OYUNCU KATILDI! Private room eşleşmesi');
        
        toast({
          title: '🎉 Oyuncu Katıldı!',
          description: 'İkinci oyuncu odaya katıldı, oyun başlıyor...',
          duration: 2000,
        });
      }
    }
    
    // Handle DELETE events - OYUNCU AYRILDI - DÜZELTME
    if (payload.eventType === 'DELETE' && payload.old) {
  console.log('🚪 OYUNCU AYRILDI!');
  console.log('🚪 Ayrılan oyuncu:', payload.old.user_id?.slice(-8));
  console.log('🚪 Mevcut oyuncu:', user?.id?.slice(-8));
  console.log('🚪 Room status:', currentRoom.status);
  
  // SADECE gerçek rakip ayrıldıysa VE aktif oyunda işlem yap
  if (!payload.old.is_bot && 
      payload.old.user_id && 
      payload.old.user_id !== user?.id && 
      currentRoom.status === 'active') { // Sadece aktif oyunda
    
    console.log('🏆 RAKIP AYRILDI - SEN KAZANDIN!');
    
    await applyDisconnectPenalty(payload.old.user_id, false);
    
    if (user?.id) {
      await applyWinBonus(user.id);
      toast({
        title: '🏆 Kazandınız!',
        description: 'Rakip oyundan ayrıldı. +100 bonus puan!',
        duration: 4000,
      });
    }
    
    console.log('🗑️ ODA SİLİNİYOR');
    await supabase
      .from('game_rooms')
      .delete()
      .eq('id', currentRoom.id);
    
    // State temizle
    setTimeout(() => {
      setCurrentRoom(null);
      setParticipants([]);
    }, 2000);
  } else {
    console.log('🔄 DELETE event ama işlem yapmıyoruz');
  }
}
    
    // Participants'ı güncelle
    await fetchParticipants(currentRoom.id);
  })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public', 
      table: 'game_rooms',
      filter: `id=eq.${currentRoom.id}`
    }, (payload) => {
      console.log('🏠 Room güncelleme:', payload.new);
      setCurrentRoom(payload.new as GameRoom);
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
}, [currentRoom?.id, currentRoom?.status, user?.id, fetchParticipants, toast, applyDisconnectPenalty, applyWinBonus, getGameModeFromRoom]);

  // Handle page close/refresh cleanup
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // 🔥 TAMAMEN DEVİRE DIŞI - Real-time listener ile yönetilecek
      console.log('🚪 Page unload detected, but handling via real-time listeners only');
      
      // Sadece manual cleanup, ceza yok
      if (currentRoom && user) {
        console.log('🧹 Manual cleanup on page close');
      }
    };

    // 🔥 ŞİMDİLİK DEVRE DIŞI - beforeunload listener'ı kaldır
    // window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup on component unmount
    return () => {
      // window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // 🔥 Component unmount'da da sadece log
      console.log('🧹 GameContext component unmounting');
    };
  }, [currentRoom, user, participants, applyDisconnectPenalty]);

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
      updatePlayerStatistics,
      checkBadges,
      isConnected,
      useNakama,
      toggleNakama
    }}>
      {children}
    </GameContext.Provider>
  );
};