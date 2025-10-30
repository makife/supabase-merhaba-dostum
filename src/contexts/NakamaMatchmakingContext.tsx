import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { nakamaService } from "@/services/nakamaService";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";

interface NakamaMatch {
  matchId: string;
  gameType: "timed" | "score";
  players: any[];
}

interface NakamaMatchmakingContextType {
  isSearching: boolean;
  currentMatch: NakamaMatch | null;
  searchProgress: number;
  matchFound: boolean;
  startRandomMatch: (gameType: "timed" | "score") => Promise<void>;
  createPrivateRoom: (gameType: "timed" | "score") => Promise<string>;
  joinPrivateRoom: (roomCode: string) => Promise<void>;
  createTournament: (name: string) => Promise<string>;
  joinTournament: (tournamentId: string) => Promise<void>;
  cancelSearch: () => void;
  onMatchFound?: (matchId: string, gameType: "timed" | "score") => void;
}

const NakamaMatchmakingContext = createContext<NakamaMatchmakingContextType | undefined>(undefined);

export const useNakamaMatchmaking = () => {
  const context = useContext(NakamaMatchmakingContext);
  if (!context) {
    throw new Error("useNakamaMatchmaking must be used within a NakamaMatchmakingProvider");
  }
  return context;
};

interface NakamaMatchmakingProviderProps {
  children: ReactNode;
  onMatchFound?: (matchId: string, gameType: "timed" | "score") => void;
}

export const NakamaMatchmakingProvider: React.FC<NakamaMatchmakingProviderProps> = ({ children, onMatchFound }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSearching, setIsSearching] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<NakamaMatch | null>(null);
  const [searchProgress, setSearchProgress] = useState(0);
  const [matchFound, setMatchFound] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<string | null>(null);

  // Cleanup function
  const cleanup = () => {
    console.log("🧹 Nakama cleanup...");
    setIsSearching(false);
    setCurrentMatch(null);
    setSearchProgress(0);
    setMatchFound(false);
    setCurrentTicket(null);
    //nakamaService.disconnect();
  };

  // Random matchmaking
  const startRandomMatch = async (gameType: "timed" | "score") => {
    if (!user) return;

    try {
      setIsSearching(true);
      setSearchProgress(0);
      setMatchFound(false);

      console.log("🔍 Starting Nakama random match:", gameType);

      // Authenticate and create socket
      await nakamaService.authenticate(user.id);
      const socket = await nakamaService.createSocket();

      // Setup match found listener
      socket.onmatchmakermatched = async (matched: any) => {
        console.log("🎉 Nakama match found!", matched);

        try {
          // Match'i oluştur veya katıl
          let actualMatchId: string;

          if (matched.match_id) {
            actualMatchId = matched.match_id;
            console.log("✅ Using existing match_id:", actualMatchId);
          } else {
            console.log("🏗️ Creating new match from matchmaking...");
            const newMatch = await socket.createMatch();
            actualMatchId = newMatch.match_id;
            console.log("✅ Created new match:", actualMatchId);
          }

          // Match ID'deki noktayı temizle
          const cleanMatchId = actualMatchId.endsWith(".") ? actualMatchId.slice(0, -1) : actualMatchId;
          console.log("🧹 Clean match ID:", cleanMatchId);

          // Match'e katıl
          await socket.joinMatch(cleanMatchId);
          console.log("✅ Joined match successfully");

          setMatchFound(true);
          setIsSearching(false);
          setCurrentTicket(null);

          const match: NakamaMatch = {
            matchId: cleanMatchId,
            gameType,
            players: matched.users || [],
          };
          setCurrentMatch(match);

          toast({
            title: "🎉 Eşleşme Bulundu!",
            description: `${gameType === "timed" ? "Zamana karşı" : "Puanlı"} oyun başlıyor!`,
          });

          onMatchFound?.(cleanMatchId, gameType);
        } catch (error: any) {
          console.error("❌ Failed to create/join match:", error);
          setIsSearching(false);
          toast({
            title: "❌ Match Hatası",
            description: error.message,
            variant: "destructive",
          });
        }
      };

      // Start matchmaking
      const ticket = await nakamaService.findMatch(gameType);
      setCurrentTicket(ticket.ticket);

      // Progress animation
      let progress = 0;
      const interval = setInterval(() => {
        progress += 3.33; // 30 saniye için
        setSearchProgress(Math.min(progress, 100));

        if (progress >= 100 && isSearching && !matchFound) {
          clearInterval(interval);
          cancelSearch();
          toast({
            title: "⏰ Zaman Aştı",
            description: "Nakama'da oyuncu bulunamadı",
            variant: "destructive",
          });
        }
      }, 1000);
    } catch (error: any) {
      console.error("❌ Nakama random match failed:", error);
      setIsSearching(false);

      toast({
        title: "❌ Nakama Hatası",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Private room creation
  const createPrivateRoom = async (gameType: "timed" | "score"): Promise<string> => {
    if (!user) throw new Error("User not authenticated");

    try {
      console.log("🏠 Creating Nakama private room:", gameType);

      await nakamaService.authenticate(user.id);
      await nakamaService.createSocket();
      const roomId = await nakamaService.createPrivateRoom(gameType);

      toast({
        title: "🏠 Özel Oda Oluşturuldu",
        description: `Match ID: ${roomId.slice(0, 8)}...`,
      });

      return roomId;
    } catch (error: any) {
      console.error("❌ Failed to create private room:", error);
      toast({
        title: "❌ Oda Oluşturulamadı",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Join private room
  const joinPrivateRoom = async (roomCode: string): Promise<void> => {
    if (!user) throw new Error("User not authenticated");

    try {
      console.log("🚪 Joining Nakama private room:", roomCode);

      await nakamaService.authenticate(user.id);
      await nakamaService.createSocket();
      const actualMatchId = await nakamaService.joinPrivateRoom(roomCode);

      toast({
        title: "🚪 Odaya Katıldınız",
        description: `Match ID: ${actualMatchId.slice(0, 8)}...`,
      });
    } catch (error: any) {
      console.error("❌ Failed to join private room:", error);
      toast({
        title: "❌ Odaya Katılamadı",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Tournament creation
  const createTournament = async (name: string): Promise<string> => {
    if (!user) throw new Error("User not authenticated");

    try {
      console.log("🏆 Creating Nakama tournament:", name);

      await nakamaService.authenticate(user.id);
      await nakamaService.createSocket();
      const tournamentId = await nakamaService.createTournament(name);

      return tournamentId;
    } catch (error: any) {
      console.error("❌ Failed to create tournament:", error);
      throw error;
    }
  };

  // Join tournament
  const joinTournament = async (tournamentId: string): Promise<void> => {
    if (!user) throw new Error("User not authenticated");

    try {
      console.log("🎯 Joining Nakama tournament:", tournamentId);

      await nakamaService.authenticate(user.id);
      await nakamaService.createSocket();
      await nakamaService.joinTournament(tournamentId);
    } catch (error: any) {
      console.error("❌ Failed to join tournament:", error);
      throw error;
    }
  };

  // Cancel search
  const cancelSearch = async () => {
    console.log("❌ Cancelling Nakama search...");
    try {
      if (currentTicket) {
        await nakamaService.cancelMatchmaking(currentTicket);
      }
    } catch (error) {
      console.error("Cancel failed:", error);
    }
    cleanup();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const value: NakamaMatchmakingContextType = {
    isSearching,
    currentMatch,
    searchProgress,
    matchFound,
    startRandomMatch,
    createPrivateRoom,
    joinPrivateRoom,
    createTournament,
    joinTournament,
    cancelSearch,
    onMatchFound,
  };

  return <NakamaMatchmakingContext.Provider value={value}>{children}</NakamaMatchmakingContext.Provider>;
};
