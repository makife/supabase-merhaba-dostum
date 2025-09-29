import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { nakamaService } from '@/services/nakamaService';

interface MatchmakingRoom {
  id: string;
  game_type: string;
  status: string;
  current_players: number;
  max_players: number;
  created_at: string;
  expires_at: string;
}

interface MatchmakingContextType {
  isSearching: boolean;
  currentRoom: MatchmakingRoom | null;
  searchProgress: number;
  searchTimeout: boolean;
  useNakama: boolean;
  nakamaMatch: { matchId: string; gameType: 'timed' | 'score' } | null;
  startSearch: (gameType: 'timed' | 'score', useNakama?: boolean) => Promise<void>;
  cancelSearch: () => void;
  restartSearch: (gameType: 'timed' | 'score') => Promise<void>;
  playWithAI: () => void;
  onMatchFound?: (roomId: string) => void;
}

const MatchmakingContext = createContext<MatchmakingContextType | undefined>(undefined);

export const useMatchmaking = () => {
  const context = useContext(MatchmakingContext);
  if (!context) {
    throw new Error('useMatchmaking must be used within a MatchmakingProvider');
  }
  return context;
};

interface MatchmakingProviderProps {
  children: ReactNode;
  onMatchFound?: (roomId: string) => void;
}

export const MatchmakingProvider: React.FC<MatchmakingProviderProps> = ({ 
  children, 
  onMatchFound 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSearching, setIsSearching] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<MatchmakingRoom | null>(null);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchTimeout, setSearchTimeout] = useState(false);
  const [currentGameType, setCurrentGameType] = useState<'timed' | 'score'>('timed');
  const [searchChannel, setSearchChannel] = useState<any>(null);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);
  const [useNakama, setUseNakama] = useState(false);
  const [nakamaMatch, setNakamaMatch] = useState<{ matchId: string; gameType: 'timed' | 'score' } | null>(null);
  const [currentTicket, setCurrentTicket] = useState<string | null>(null);

  // Temizlik fonksiyonu
  const cleanup = () => {
    console.log('🧹 Matchmaking cleanup çalışıyor...');
    if (searchChannel) {
      supabase.removeChannel(searchChannel);
      setSearchChannel(null);
      console.log('📡 Real-time channel kapatıldı');
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
      console.log('⏰ Progress timer temizlendi');
    }
    // Nakama cleanup
    if (useNakama && currentTicket) {
      nakamaService.cancelMatchmaking(currentTicket).catch(console.error);
      setCurrentTicket(null);
    }
    nakamaService.disconnect();
    
    setIsSearching(false);
    setCurrentRoom(null);
    setSearchProgress(0);
    setSearchTimeout(false);
    setUseNakama(false);
    setNakamaMatch(null);
    console.log('✅ Matchmaking state temizlendi');
  };

  // Arama başlat
  const startSearch = async (gameType: 'timed' | 'score', enableNakama = false) => {
    if (!user) return;

    try {
      setIsSearching(true);
      setSearchProgress(0);
      setSearchTimeout(false);
      setCurrentGameType(gameType);
      setUseNakama(enableNakama);

      console.log('🔍 Matchmaking başlatıldı:', gameType, enableNakama ? '(Nakama)' : '(Supabase)');

      // Nakama matchmaking
      if (enableNakama) {
        return await startNakamaSearch(gameType);
      }

      // Önce süresi dolmuş odaları temizle
      await supabase
        .from('matchmaking_rooms')
        .delete()
        .lt('expires_at', new Date().toISOString());

  // Mevcut uygun oda ara
  const { data: availableRooms, error: searchError } = await supabase
    .from('matchmaking_rooms')
    .select('*')
    .eq('game_type', gameType)
    .eq('status', 'waiting')
    .lt('current_players', 2)
    .gt('expires_at', new Date().toISOString()) // Süresi dolmamış olanlar
    .order('created_at', { ascending: true })
    .limit(1);

  console.log('🔍 Arama parametreleri:', { gameType, roomsFound: availableRooms?.length || 0 });

      if (searchError) {
        console.error('Error searching for rooms:', searchError);
        throw searchError;
      }

      let roomToJoin = null;

      if (availableRooms && availableRooms.length > 0) {
        // Mevcut odaya katıl
        roomToJoin = availableRooms[0];
        console.log('🎯 Mevcut oda bulundu:', roomToJoin.id);

        // Oda dolu mu kontrol et
        if (roomToJoin.current_players >= 2) {
          console.log('⚠️ Oda dolu, yeni oda oluşturuluyor...');
          roomToJoin = null;
        } else {
          // Race condition önlemek için atomic update
          const { data: updatedRoom, error: updateError } = await supabase
            .from('matchmaking_rooms')
            .update({ 
              current_players: roomToJoin.current_players + 1,
              status: roomToJoin.current_players + 1 >= 2 ? 'matched' : 'waiting'
            })
            .eq('id', roomToJoin.id)
            .eq('current_players', roomToJoin.current_players) // Optimistic locking
            .select()
            .single();

          if (updateError || !updatedRoom) {
            console.error('Error joining room (possibly full):', updateError);
            roomToJoin = null;
          } else {
            roomToJoin = updatedRoom;
            console.log('✅ Odaya katıldı - yeni durum:', {
              players: updatedRoom.current_players,
              status: updatedRoom.status
            });
            
      // Eğer oda dolduysa hemen eşleşme bildir
      if (updatedRoom.status === 'matched' && updatedRoom.current_players >= 2) {
        console.log('🎉 Oda doldu - anında eşleşme! Hemen temizlik yapılıyor...');
        console.log('🎮 Eşleşen oda game_type:', updatedRoom.game_type);
        
        // Önce cleanup yap, sonra navigate et
        cleanup();
        
        toast({
          title: "Eşleşme Bulundu!",
          description: `${updatedRoom.game_type === 'timed' ? 'Zamana karşı' : 'Puanlı'} oyun başlıyor!`,
        });
        onMatchFound?.(updatedRoom.id);
        return;
      }
          }
        }
      }

      // Oda bulunamadıysa yeni oda oluştur - grid'i room_data içinde sakla
      if (!roomToJoin) {
        console.log('🆕 Yeni oda oluşturuluyor...');
        
        // Sabit grid üret (her oyuncu için aynı olacak)
        const letterPool = ['A','A','A','A','A','A','A','A','E','E','E','E','E','E','E','İ','İ','İ','İ','İ','İ','I','I','I','I','I','O','O','O','O','O','U','U','U','U','Ü','Ü','Ü','Ö','Ö','Ö','L','L','L','L','L','N','N','N','N','N','R','R','R','R','R','K','K','K','K','M','M','M','M','T','T','T','T','S','S','S','S','D','D','D','Y','Y','Y','B','B','B','C','C','Ç','Ç','F','F','G','G','Ğ','Ğ','H','H','J','P','P','Ş','Ş','V','V','Z'];
        const gameGrid: string[] = [];
        for (let i = 0; i < 16; i++) {
          const randomIndex = Math.floor(Math.random() * letterPool.length);
          gameGrid.push(letterPool[randomIndex]);
        }
        
        const { data: newRoom, error: createError } = await supabase
          .from('matchmaking_rooms')
          .insert({
            game_type: gameType,
            status: 'waiting',
            current_players: 1,
            max_players: 2,
            expires_at: new Date(Date.now() + 60000).toISOString(), // 1 dakika
            room_data: { game_grid: gameGrid } // Grid'i room_data içinde sakla
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating room:', createError);
          throw createError;
        }

        roomToJoin = newRoom;
        console.log('✅ Yeni oda oluşturuldu:', roomToJoin.id, 'grid:', gameGrid.slice(0, 4));
      }

      setCurrentRoom(roomToJoin);

      // Real-time subscription başlat
      const channel = supabase
        .channel(`matchmaking-${roomToJoin.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'matchmaking_rooms',
            filter: `id=eq.${roomToJoin.id}`
          },
          (payload) => {
            console.log('🔄 Oda güncellendi:', payload);
            const updatedRoom = payload.new as MatchmakingRoom;
            
      if (updatedRoom.status === 'matched' && updatedRoom.current_players >= 2) {
        console.log('🎉 Eşleşme bulundu! Hemen temizlik yapılıyor...');
        console.log('🎮 Real-time güncellenmiş oda game_type:', updatedRoom.game_type);
        
        // Önce cleanup yap, sonra navigate et
        cleanup();
        
        toast({
          title: "Eşleşme Bulundu!",
          description: `${updatedRoom.game_type === 'timed' ? 'Zamana karşı' : 'Puanlı'} oyun başlıyor!`,
        });
        onMatchFound?.(updatedRoom.id);
      } else {
        setCurrentRoom(updatedRoom);
      }
          }
        )
        .subscribe();

      setSearchChannel(channel);

      // Progress animasyonu - 30 saniye
      let progress = 0;
      const interval = setInterval(() => {
        progress += 3.33; // 30 saniye için her 1 saniyede %3.33
        setSearchProgress(Math.min(progress, 100));
        
        // 30 saniye sonra timeout - ama sadece eşleşme sırasında
        if (progress >= 100 && isSearching) {
          clearInterval(interval);
          console.log('⏰ Timeout: Arama tamamlandı ama oyuncu bulunamadı');
          setIsSearching(false);
          setSearchTimeout(true);
          // cleanup();'i çağırmıyoruz çünkü timeout modalini göstereceğiz
        }
      }, 1000); // Her 1 saniye
      setProgressInterval(interval);

    } catch (error) {
      console.error('Error starting search:', error);
      setIsSearching(false);
      toast({
        title: "Arama Hatası",
        description: "Eşleşme araması başlatılamadı",
        variant: "destructive",
      });
    }
  };

  // Nakama arama fonksiyonu
  const startNakamaSearch = async (gameType: 'timed' | 'score') => {
    try {
      console.log('🎯 Nakama matchmaking başlatılıyor:', gameType);
      
      // Authenticate ve socket oluştur
      await nakamaService.authenticate(user.id);
      const socket = await nakamaService.createSocket();

      // Match found listener
      socket.onmatchmakermatched = (matched: any) => {
        console.log('🎉 Nakama match found!', matched);
        
        setNakamaMatch({
          matchId: matched.match_id,
          gameType: gameType
        });
        
        cleanup();
        
        toast({
          title: "🎉 Nakama Eşleşme!",
          description: `Nakama sunucusunda ${gameType === 'timed' ? 'zamana karşı' : 'puanlı'} oyun bulundu!`,
        });
        
        onMatchFound?.(matched.match_id);
      };

      // Matchmaking başlat
      const ticket = await nakamaService.findMatch(gameType);
      setCurrentTicket(ticket.ticket);

      // Progress animation
      let progress = 0;
      const interval = setInterval(() => {
        progress += 3.33; // 30 saniye için
        setSearchProgress(Math.min(progress, 100));
        
        if (progress >= 100 && isSearching) {
          clearInterval(interval);
          setIsSearching(false);
          setSearchTimeout(true);
          toast({
            title: "⏰ Nakama Timeout",
            description: "Nakama'da oyuncu bulunamadı",
            variant: "destructive",
          });
        }
      }, 1000);
      setProgressInterval(interval);

    } catch (error: any) {
      console.error('❌ Nakama matchmaking failed:', error);
      setIsSearching(false);
      toast({
        title: "❌ Nakama Hatası",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Arama iptal et
  const cancelSearch = async () => {
    console.log('❌ Arama iptal ediliyor...');
    try {
      if (currentRoom) {
        // Arama iptal edildiğinde odayı hemen sil veya pasif hale getir
        if (currentRoom.current_players === 1) {
          // Tek oyuncu varsa odayı sil
          await supabase
            .from('matchmaking_rooms')
            .delete()
            .eq('id', currentRoom.id);
          console.log('🗑️ Oda silindi');
        } else {
          // Birden fazla oyuncu varsa odayı expired yaparak pasif hale getir
          await supabase
            .from('matchmaking_rooms')
            .update({ 
              status: 'cancelled',
              expires_at: new Date().toISOString() // Hemen süresi dolmuş yap
            })
            .eq('id', currentRoom.id);
          console.log('🚫 Oda iptal edildi');
        }
      }
    } catch (error) {
      console.error('Oda temizlik hatası:', error);
    }
    cleanup();
  };

  // Tekrar arama yap
  const restartSearch = async (gameType: 'timed' | 'score') => {
    console.log('🔄 Tekrar arama başlatılıyor...');
    cleanup(); // Önce tamamen temizle
    setSearchTimeout(false);
    // Kısa bir delay ekleyelim ki cleanup tam olsun
    setTimeout(() => {
      startSearch(gameType);
    }, 100);
  };

  // AI ile oyna
  const playWithAI = () => {
    console.log('🤖 AI ile oyun başlatılıyor...');
    cleanup();
    onMatchFound?.('ai-game');
  };

  // Component unmount'da temizlik
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const value: MatchmakingContextType = {
    isSearching,
    currentRoom,
    searchProgress,
    searchTimeout,
    useNakama,
    nakamaMatch,
    startSearch,
    cancelSearch,
    restartSearch,
    playWithAI,
    onMatchFound
  };

  return (
    <MatchmakingContext.Provider value={value}>
      {children}
    </MatchmakingContext.Provider>
  );
};