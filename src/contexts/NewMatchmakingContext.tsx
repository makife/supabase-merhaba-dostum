import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useToast } from '@/components/ui/use-toast';

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
  startSearch: (gameType: 'timed' | 'score') => Promise<void>;
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
    setIsSearching(false);
    setCurrentRoom(null);
    setSearchProgress(0);
    setSearchTimeout(false);
    console.log('✅ Matchmaking state temizlendi');
  };

  // Arama başlat
  const startSearch = async (gameType: 'timed' | 'score') => {
    if (!user) return;

    try {
      setIsSearching(true);
      setSearchProgress(0);
      setSearchTimeout(false);
      setCurrentGameType(gameType);

      console.log('🔍 Matchmaking başlatıldı:', gameType);

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
              
              // Önce cleanup yap, sonra navigate et
              cleanup();
              
              toast({
                title: "Eşleşme Bulundu!",
                description: "Mevcut odaya katıldınız!",
              });
              onMatchFound?.(updatedRoom.id);
              return;
            }
          }
        }
      }

      // Oda bulunamadıysa yeni oda oluştur
      if (!roomToJoin) {
        console.log('🆕 Yeni oda oluşturuluyor...');
        const { data: newRoom, error: createError } = await supabase
          .from('matchmaking_rooms')
          .insert({
            game_type: gameType,
            status: 'waiting',
            current_players: 1,
            max_players: 2,
            expires_at: new Date(Date.now() + 60000).toISOString() // 1 dakika
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating room:', createError);
          throw createError;
        }

        roomToJoin = newRoom;
        console.log('✅ Yeni oda oluşturuldu:', roomToJoin.id);
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
              
              // Önce cleanup yap, sonra navigate et
              cleanup();
              
              toast({
                title: "Eşleşme Bulundu!",
                description: "Oyun başlıyor...",
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
    // React Router ile navigate et, sayfa yenileme yapmadan
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