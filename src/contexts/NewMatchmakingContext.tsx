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

  // Arama başlat - Default olarak Nakama kullan
  const startSearch = async (gameType: 'timed' | 'score') => {
    if (!user) return;

    try {
      setIsSearching(true);
      setSearchProgress(0);
      setSearchTimeout(false);
      setCurrentGameType(gameType);
      setUseNakama(true);

      console.log('🔍 Nakama matchmaking başlatıldı:', gameType);

      // Her zaman Nakama kullan
      return await startNakamaSearch(gameType);

      // Önce süresi dolmuş odaları temizle
      await supabase
        .from('matchmaking_rooms')
        .delete()
        .lt('expires_at', new Date().toISOString());

      console.log('✅ Expired rooms cleaned, starting search...');

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
    // Nakama için cancellation logic
    if (useNakama && currentTicket) {
      try {
        await nakamaService.cancelMatchmaking(currentTicket);
        setCurrentTicket(null);
      } catch (error) {
        console.error('Nakama cancel error:', error);
      }
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