import { useState, useCallback } from 'react';
import { nakamaService } from '@/services/nakamaService';
import { useToast } from '@/hooks/use-toast';

export const useNakamaMatchmaking = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [matchFound, setMatchFound] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const findMatch = useCallback(async (gameType: 'timed' | 'score') => {
    try {
      setIsSearching(true);
      setError(null);
      setMatchFound(false);
      
      console.log("🔍 Starting Nakama matchmaking...");
      
      // Authenticate user
      await nakamaService.authenticate(`user_${Date.now()}`);
      
      // Create WebSocket connection
      const socket = await nakamaService.createSocket();
      
      // Start matchmaking
      const ticket = await nakamaService.findMatch(gameType);
      setCurrentTicket(ticket.ticket);
      
      console.log("⏳ Waiting for match...");
      
      let foundMatch = false;
      
      // Listen for match found
      socket.onmatchmakermatched = (matched: any) => {
        console.log("🎉 Nakama match found!", matched);
        foundMatch = true;
        setMatchFound(true);
        setIsSearching(false);
        setCurrentTicket(null);
        
        toast({
          title: "🎉 Rakip Bulundu!",
          description: "Nakama ile eşleştiniz, oyun başlıyor...",
          duration: 2000,
        });
        
        return matched;
      };

      // Timeout fallback (60 saniye)
      const timeoutId = setTimeout(() => {
        if (!foundMatch) {
          console.log("⏰ Nakama matchmaking timeout");
          cancelSearch();
          
          toast({
            title: "⏰ Zaman Aştı",
            description: "Nakama'da rakip bulunamadı",
            variant: "destructive",
          });
        }
      }, 60000);

      return ticket.ticket;
    } catch (error: any) {
      console.error("❌ Nakama matchmaking failed:", error);
      setError(error.message);
      setIsSearching(false);
      
      toast({
        title: "❌ Nakama Hatası",
        description: error.message,
        variant: "destructive",
      });
      
      throw error;
    }
  }, [isSearching, matchFound, toast]);

  const cancelSearch = useCallback(async () => {
    if (currentTicket) {
      try {
        await nakamaService.cancelMatchmaking(currentTicket);
      } catch (error) {
        console.error("Cancel failed:", error);
      }
    }
    
    setIsSearching(false);
    setCurrentTicket(null);
    setError(null);
    setMatchFound(false);
  }, [currentTicket]);

  return {
    isSearching,
    matchFound,
    error,
    findMatch,
    cancelSearch
  };
};
