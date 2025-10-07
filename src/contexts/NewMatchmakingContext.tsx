import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { nakamaService } from "@/services/nakamaService";

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
  nakamaMatch: { matchId: string; gameType: "timed" | "score" } | null;
  startSearch: (gameType: "timed" | "score") => Promise<void>;
  cancelSearch: () => void;
  restartSearch: (gameType: "timed" | "score") => Promise<void>;
  playWithAI: () => void;
  onMatchFound?: (roomId: string) => void;
}

const MatchmakingContext = createContext<MatchmakingContextType | undefined>(undefined);

export const useMatchmaking = () => {
  const context = useContext(MatchmakingContext);
  if (!context) {
    throw new Error("useMatchmaking must be used within a MatchmakingProvider");
  }
  return context;
};

interface MatchmakingProviderProps {
  children: ReactNode;
  onMatchFound?: (roomId: string) => void;
}

export const MatchmakingProvider: React.FC<MatchmakingProviderProps> = ({ children, onMatchFound }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isSearching, setIsSearching] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<MatchmakingRoom | null>(null);
  const [searchProgress, setSearchProgress] = useState(0);
  const [searchTimeout, setSearchTimeout] = useState(false);
  const [currentGameType, setCurrentGameType] = useState<"timed" | "score">("timed");
  const [searchChannel, setSearchChannel] = useState<any>(null);
  const [progressInterval, setProgressInterval] = useState<NodeJS.Timeout | null>(null);
  const [useNakama, setUseNakama] = useState(false);
  const [nakamaMatch, setNakamaMatch] = useState<{ matchId: string; gameType: "timed" | "score" } | null>(null);
  const [currentTicket, setCurrentTicket] = useState<string | null>(null);

  // Temizlik fonksiyonu
  const cleanup = () => {
    console.log("🧹 Matchmaking cleanup çalışıyor...");

    if (searchChannel) {
      supabase.removeChannel(searchChannel);
      setSearchChannel(null);
      console.log("📡 Real-time channel kapatıldı");
    }

    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
      console.log("⏰ Progress timer temizlendi");
    }

    // ❌ BU SATIRI KALDIR - Nakama bağlantısını kesme!
    // nakamaService.disconnect();

    // State'leri temizle
    setIsSearching(false);
    setCurrentRoom(null);
    setSearchProgress(0);
    setSearchTimeout(false);
    setUseNakama(false);
    setNakamaMatch(null);

    console.log("✅ Matchmaking state temizlendi");
  };

  // Arama başlat - Default olarak Nakama kullan
  const startSearch = async (gameType: "timed" | "score") => {
    if (!user) return;
    if (isSearching) {
      console.warn('⚠️ Arama zaten devam ediyor, tekrar başlatma atlandı');
      return;
    }

    try {
      setIsSearching(true);
      setSearchProgress(0);
      setSearchTimeout(false);
      setCurrentGameType(gameType);
      setUseNakama(true);

      console.log("🔍 Nakama matchmaking başlatıldı:", gameType);

      // Her zaman Nakama kullan
      return await startNakamaSearch(gameType);
    } catch (error) {
      console.error("Error starting search:", error);
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

  const startNakamaSearch = async (gameType: "timed" | "score") => {
    try {
      console.log("Nakama matchmaking baslatiliyor:", gameType);

      await nakamaService.authenticate(user.id);
      const socket = await nakamaService.createSocket();

      socket.onmatchmakermatched = async (matched: any) => {
        console.log("Nakama match bulundu!", matched);
        console.log("Matched object:", JSON.stringify(matched, null, 2));

        try {
          const token = matched.token;

          if (!token) {
            throw new Error("No match token received from Nakama");
          }

          console.log("Using token to join match:", token);

          // Token kullanarak match'e katıl
          const match = await socket.joinMatch(undefined, token);
          const matchId = match.match_id;

          if (!matchId) throw new Error("No match_id returned from joinMatch");

          console.log("Successfully joined Nakama match:", matchId);

          // ID'yi sanitize et (token kaynaklı sondaki nokta vb.)
          const cleanMatchId = (matchId || "").trim().replace(/[^a-f0-9-]/gi, "");
          if (!cleanMatchId || cleanMatchId.length < 10) {
            throw new Error("Invalid match_id after sanitize");
          }
          console.log("Clean match ID:", cleanMatchId);

          // Supabase'e game room olustur
          try {
            // Match ID'yi seed olarak kullanarak deterministik grid olustur
            const generateGridFromSeed = (seed: string): string[] => {
              // Basit LCG (Linear Congruential Generator)
              const seedNum = parseInt(seed.replace(/[^0-9]/g, "").slice(0, 10)) || Date.now();
              let currentSeed = seedNum;

              const seededRandom = () => {
                currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
                return currentSeed / 4294967296;
              };

              const letterPool = [
                "A",
                "A",
                "A",
                "A",
                "A",
                "A",
                "A",
                "A",
                "E",
                "E",
                "E",
                "E",
                "E",
                "E",
                "E",
                "İ",
                "İ",
                "İ",
                "İ",
                "İ",
                "İ",
                "I",
                "I",
                "I",
                "I",
                "I",
                "O",
                "O",
                "O",
                "O",
                "O",
                "U",
                "U",
                "U",
                "U",
                "Ü",
                "Ü",
                "Ü",
                "Ö",
                "Ö",
                "Ö",
                "L",
                "L",
                "L",
                "L",
                "L",
                "N",
                "N",
                "N",
                "N",
                "N",
                "R",
                "R",
                "R",
                "R",
                "R",
                "K",
                "K",
                "K",
                "K",
                "M",
                "M",
                "M",
                "M",
                "T",
                "T",
                "T",
                "T",
                "S",
                "S",
                "S",
                "S",
                "D",
                "D",
                "D",
                "Y",
                "Y",
                "Y",
                "B",
                "B",
                "B",
                "C",
                "C",
                "Ç",
                "Ç",
                "F",
                "F",
                "G",
                "G",
                "Ğ",
                "Ğ",
                "H",
                "H",
                "J",
                "P",
                "P",
                "Ş",
                "Ş",
                "V",
                "V",
                "Z",
              ];

              const grid: string[] = [];
              for (let i = 0; i < 16; i++) {
                const randomIndex = Math.floor(seededRandom() * letterPool.length);
                grid.push(letterPool[randomIndex]);
              }

              return grid;
            };

            const gridArray = generateGridFromSeed(cleanMatchId);
            console.log("Generated seeded grid:", gridArray.slice(0, 4));

            const { error: roomError } = await supabase.from("game_rooms").insert({
              id: cleanMatchId,
              room_code: cleanMatchId,
              host_id: user.id,
              game_mode: gameType,
              status: "waiting",
              max_players: 2,
              time_limit: gameType === "timed" ? 120 : 0,
              max_score: gameType === "score" ? 500 : 0,
              current_grid: gridArray,
            });

            if (roomError) {
              if (roomError.message?.includes("duplicate") || roomError.code === "23505") {
                console.log("Room already exists (expected for 2nd player)");
              } else {
                console.error("Room insert failed:", roomError);
              }
            } else {
              console.log("Game room created with seeded grid");
            }
          } catch (err: any) {
            if (err.code === "23505") {
              console.log("Room already exists (duplicate key)");
            } else {
              console.warn("Room creation error:", err);
            }
          }

          setNakamaMatch({
            matchId: cleanMatchId,
            gameType: gameType,
          });

          // Save match details to service for reuse on the game page (avoid re-join with invalid id)
          try {
            nakamaService.setLastMatch({ id: match.match_id, token });
          } catch (e) {
            console.warn("setLastMatch failed (non-fatal):", e);
          }

          setIsSearching(false);
          if (progressInterval) {
            clearInterval(progressInterval);
            setProgressInterval(null);
          }

          toast({
            title: "Eslesme Bulundu!",
            description: "Oyun basliyor...",
          });

          // Skor/oda birikmesini önlemek için eski katılımcıları ve skorları sıfırla
          try {
            await supabase.from('game_participants').delete().eq('room_id', cleanMatchId);
            await supabase.from('game_rooms')
              .update({ status: 'waiting', started_at: null, player1_score: 0, player2_score: 0 })
              .eq('id', cleanMatchId);
          } catch (resetErr) {
            console.warn('Room reset warning:', resetErr);
          }

          console.log("🎯 Match ready. Navigating via onMatchFound callback.");
          onMatchFound?.(cleanMatchId);
        } catch (error: any) {
          console.error("Match setup failed:", error);
          toast({
            title: "Hata",
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
            title: "Timeout",
            description: "Oyuncu bulunamadi",
            variant: "destructive",
          });
        }
      }, 1000);
      setProgressInterval(interval);
    } catch (error: any) {
      console.error("Nakama matchmaking failed:", error);
      setIsSearching(false);
      toast({
        title: "Nakama Hatasi",
        description: error.message,
        variant: "destructive",
      });
    }
  };
  // Arama iptal et
  const cancelSearch = async () => {
    console.log("❌ Arama iptal ediliyor...");

    // Önce state'leri temizle
    setIsSearching(false);
    setSearchProgress(0);
    setSearchTimeout(false);

    // Progress interval'ı durdur
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }

    // Nakama ticket'ı iptal et (bağlantı açıkken)
    if (useNakama && currentTicket) {
      try {
        console.log("❌ Cancelling Nakama matchmaking:", currentTicket);
        await nakamaService.cancelMatchmaking(currentTicket);
        setCurrentTicket(null);
        console.log("✅ Nakama matchmaking ticket iptal edildi");
      } catch (error) {
        console.error("Nakama cancel error:", error);
        // Hata olsa bile devam et, state'ler temizlensin
      }
    }

    // Diğer state'leri temizle
    setNakamaMatch(null);
    setCurrentTicket(null);

    console.log("✅ Arama iptal edildi");
  };
  // Tekrar arama yap
  const restartSearch = async (gameType: "timed" | "score") => {
    console.log("🔄 Tekrar arama başlatılıyor...");
    cleanup();
    setSearchTimeout(false);
    setTimeout(() => {
      startSearch(gameType);
    }, 100);
  };

  // AI ile oyna
  const playWithAI = () => {
    console.log("🤖 AI ile oyun başlatılıyor...");
    cleanup();
    onMatchFound?.("ai-game");
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
    onMatchFound,
  };

  return (
    <MatchmakingContext.Provider value={value}>
      {children}
      {/* UI rendering moved to NewMatchmakingModal to avoid duplicate overlays */}
    </MatchmakingContext.Provider>
  );
};
