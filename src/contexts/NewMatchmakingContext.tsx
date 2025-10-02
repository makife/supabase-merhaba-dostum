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
// startNakamaSearch fonksiyonunu değiştir

const startNakamaSearch = async (gameType: 'timed' | 'score') => {
  try {
    console.log('🎯 Nakama matchmaking başlatılıyor:', gameType);
    
    await nakamaService.authenticate(user.id);
    const socket = await nakamaService.createSocket();

    socket.onmatchmakermatched = async (matched: any) => {
      console.log('🎉 Nakama match bulundu!', matched);
      console.log('📋 Matched object:', JSON.stringify(matched, null, 2));
      
      try {
        // ÖNEMLİ: match_id kullan (token DEĞİL)
        let matchId = matched.match_id || matched.matchId;
        
        if (!matchId) {
          // Eğer match_id yoksa, yeni bir match oluştur
          console.log('🏗️ match_id yok, yeni match oluşturuluyor...');
          const newMatch = await socket.createMatch();
          matchId = newMatch.match_id;
          console.log('✅ Yeni match oluşturuldu:', matchId);
        }
        
        // Sondaki noktayı temizle
        const cleanMatchId = matchId.endsWith('.') ? matchId.slice(0, -1) : matchId;
        console.log('🧹 Temiz match ID:', cleanMatchId);
        
        setNakamaMatch({
          matchId: cleanMatchId,
          gameType: gameType
        });
        
        setIsSearching(false);
        if (progressInterval) {
          clearInterval(progressInterval);
          setProgressInterval(null);
        }
        
        toast({
          title: "🎉 Eşleşme Bulundu!",
          description: "Oyun başlıyor...",
        });
        
        onMatchFound?.(cleanMatchId);
        
      } catch (error: any) {
        console.error('❌ Match setup failed:', error);
        toast({
          title: "❌ Hata",
          description: error.message,
          variant: "destructive",
        });
      }
    };

    const ticket = await nakamaService.findMatch(gameType);
    setCurrentTicket(ticket.ticket);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 3.33;
      setSearchProgress(Math.min(progress, 100));
      
      if (progress >= 100 && isSearching) {
        clearInterval(interval);
        setIsSearching(false);
        setSearchTimeout(true);
        toast({
          title: "⏰ Timeout",
          description: "Oyuncu bulunamadı",
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
    cleanup();
    setSearchTimeout(false);
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