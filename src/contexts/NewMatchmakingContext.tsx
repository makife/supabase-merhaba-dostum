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
  startSearch: (gameType: 'timed' | 'score') => Promise<void>;
  cancelSearch: () => void;
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
  const [searchChannel, setSearchChannel] = useState<any>(null);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);

  // Temizlik fonksiyonu
  const cleanup = () => {
    if (searchChannel) {
      supabase.removeChannel(searchChannel);
      setSearchChannel(null);
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
    setIsSearching(false);
    setCurrentRoom(null);
    setSearchProgress(0);
  };

  // Arama başlat
  const startSearch = async (gameType: 'timed' | 'score') => {
    if (!user) return;

    try {
      setIsSearching(true);
      setSearchProgress(0);

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
          // Odaya katıl
          const { error: updateError } = await supabase
            .from('matchmaking_rooms')
            .update({ 
              current_players: roomToJoin.current_players + 1,
              status: roomToJoin.current_players + 1 >= 2 ? 'matched' : 'waiting'
            })
            .eq('id', roomToJoin.id);

          if (updateError) {
            console.error('Error joining room:', updateError);
            roomToJoin = null;
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
              console.log('🎉 Eşleşme bulundu!');
              setIsSearching(false);
              toast({
                title: "Eşleşme Bulundu!",
                description: "Oyun başlıyor...",
              });
              onMatchFound?.(updatedRoom.id);
              cleanup();
            } else {
              setCurrentRoom(updatedRoom);
            }
          }
        )
        .subscribe();

      setSearchChannel(channel);

      // Progress animasyonu
      let progress = 0;
      const interval = setInterval(() => {
        progress += 2;
        setSearchProgress(Math.min(progress, 100));
      }, 200);
      setProgressInterval(interval);

      // 30 saniye sonra eşleşme bulunamazsa AI ile eşleştir
      setTimeout(() => {
        if (isSearching && currentRoom && currentRoom.current_players < 2) {
          console.log('⏰ Timeout: AI rakip ekleniyor...');
          setIsSearching(false);
          toast({
            title: "AI Rakip Bulundu!",
            description: "AI ile oyun başlıyor...",
          });
          onMatchFound?.(roomToJoin.id);
          cleanup();
        }
      }, 30000);

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
    if (currentRoom && currentRoom.current_players === 1) {
      // Oda boşsa sil
      await supabase
        .from('matchmaking_rooms')
        .delete()
        .eq('id', currentRoom.id);
    }
    cleanup();
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
    startSearch,
    cancelSearch,
    onMatchFound
  };

  return (
    <MatchmakingContext.Provider value={value}>
      {children}
    </MatchmakingContext.Provider>
  );
};