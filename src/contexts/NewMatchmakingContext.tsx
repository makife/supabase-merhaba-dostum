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

      // Önce mevcut odaları temizle - Geçici olarak kapatıldı
      // await supabase.rpc('cleanup_expired_matchmaking_rooms');

      // Uygun oda ara - Geçici olarak kapatıldı
      const availableRooms: any[] = [];
      const searchError = null;

      if (searchError) {
        console.error('Error searching for rooms:', searchError);
        throw searchError;
      }

      // Geçici olarak basit room ID oluştur
      const roomId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Geçici oda bilgisi
      setCurrentRoom({
        id: roomId,
        game_type: gameType,
        status: 'waiting',
        current_players: 1,
        max_players: 2,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60000).toISOString()
      });

      // Real-time dinleme geçici olarak kapatıldı
      // Şimdilik sadece timeout ile çalışacak

      // setSearchChannel(channel); // Geçici olarak kapatıldı

      // Progress animasyonu
      let progress = 0;
      const interval = setInterval(() => {
        progress += 1;
        setSearchProgress(Math.min(progress, 100));
      }, 200);
      setProgressInterval(interval);

      // 30 saniye sonra AI ile eşleştir
      setTimeout(() => {
        if (isSearching) {
          setIsSearching(false);
          toast({
            title: "AI Rakip Bulundu!",
            description: "AI ile oyun başlıyor...",
          });
          onMatchFound?.(roomId);
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
    // Geçici olarak sadece cleanup
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