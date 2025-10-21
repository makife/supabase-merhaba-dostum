import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { nakamaService } from "@/services/nakamaService";
import { matchBanlist } from "@/utils/matchBanlist";

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
  currentGameType: "timed" | "score";
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
  const progressIntervalRef = React.useRef<number | null>(null);
  const clearProgressTimer = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
      console.log("⏰ Progress timer temizlendi");
    }
  };
  const startProgressTimer = () => {
    console.log("⏱️ Progress timer başlatılıyor");
    clearProgressTimer();
    let progress = 0;
    const id = window.setInterval(() => {
      progress += 3.33;
      setSearchProgress(Math.min(progress, 100));
      if (progress >= 100) {
        clearInterval(id);
        if (isSearching) {
          cancelSearch();
          setSearchTimeout(true);
          toast({ title: "Timeout", description: "Oyuncu bulunamadi", variant: "destructive" });
        }
      }
    }, 1000);
    progressIntervalRef.current = id;
  };
  const [useNakama, setUseNakama] = useState(false);
  const [nakamaMatch, setNakamaMatch] = useState<{ matchId: string; gameType: "timed" | "score" } | null>(null);
  const [currentTicket, setCurrentTicket] = useState<string | null>(null);

  // Temizlik fonksiyonu - Global kullanım için export edilebilir
  const cleanup = async () => {
    console.log("🧹 Matchmaking cleanup başlatılıyor...");

    // Timer'ı durdur
    clearProgressTimer();

    // Real-time channel kapat
    if (searchChannel) {
      supabase.removeChannel(searchChannel);
      setSearchChannel(null);
      console.log("📡 Real-time channel kapatıldı");
    }

    // Nakama ticket iptal
    if (currentTicket) {
      try {
        await nakamaService.cancelMatchmaking(currentTicket);
        console.log("✅ Nakama ticket iptal edildi");
      } catch (e) {
        console.warn("Cleanup cancel error:", e);
      }
      setCurrentTicket(null);
    }

    // Nakama socket'i kapat
    try {
      nakamaService.disconnect();
      console.log("✅ Nakama socket kapatıldı");
    } catch (e) {
      console.warn("Nakama disconnect error:", e);
    }

    // State'leri TAMAMEN sıfırla
    setIsSearching(false);
    setCurrentRoom(null);
    setSearchProgress(0);
    setSearchTimeout(false);
    setUseNakama(false);
    setNakamaMatch(null);
    setCurrentGameType("timed"); // Default'a dön

    console.log("✅ Matchmaking tamamen temizlendi");
  };

  // Arama başlat - Default olarak Nakama kullan
  const startSearch = async (gameType: "timed" | "score") => {
    if (!user) return;
    if (isSearching) {
      console.warn('⚠️ Arama zaten devam ediyor, tekrar başlatma atlandı');
      return;
    }

    try {
      // Önce tam temizlik yap
      console.log("🧹 Yeni arama öncesi tam temizlik yapılıyor...");
      await cleanup();
      
      // Kısa gecikme - state'lerin tamamen temizlenmesi için
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setIsSearching(true);
      setSearchProgress(0);
      setSearchTimeout(false);
      setCurrentGameType(gameType);
      setUseNakama(true);

      console.log("🔍 Nakama matchmaking başlatıldı:", gameType);

      // Progress timer'ı hemen başlat
      startProgressTimer();

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
      console.log("🔍 Nakama matchmaking başlatılıyor:", gameType);

      // Progress timer already started in startSearch
      console.log("🔐 Authenticating with Nakama...");
      // Her bağlantı için unique bir device ID kullan (aynı user farklı cihazlarda olabilir)
      const deviceId = `${user.id}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log("🆔 Device ID:", deviceId);
      await nakamaService.authenticate(deviceId);
      console.log("✅ Nakama authenticated with device:", deviceId);
      
      console.log("🔌 Creating Nakama socket...");
      const socket = await nakamaService.createSocket();
      console.log("✅ Nakama socket created");

      // ÖNCE handler'ı set et, SONRA matchmaker'a ekle
      console.log("📡 Setting up match found handler...");
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

          // Eğer bu match ID banlıysa, hemen ayrıl ve yeni aramayı başlat
          if (matchBanlist.has(cleanMatchId)) {
            console.warn("Banned/ended match detected, restarting search:", cleanMatchId);
            try { await (socket as any).leaveMatch(cleanMatchId); } catch {}
            toast({ title: "Eski oda engellendi", description: "Yeni eşleşme aranıyor..." });
            clearProgressTimer();
            restartSearch(gameType);
            return;
          }

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
              game_mode: `random-match-${gameType}`,
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

          // Ensure current user is participant in this Nakama room (idempotent)
          try {
            const { error: participantErr } = await supabase
              .from('game_participants')
              .insert({ room_id: cleanMatchId, user_id: user.id, score: 0, is_bot: false });
            if (participantErr && participantErr.code !== '23505') {
              console.warn('Participant insert error:', participantErr);
            } else if (!participantErr) {
              console.log('👤 Participant inserted for current user');
            } else {
              console.log('👤 Participant already exists for current user');
            }
          } catch (piErr) {
            console.warn('Participant insert exception:', piErr);
          }

          setNakamaMatch({
            matchId: cleanMatchId,
            gameType: gameType,
          });

          // Artık bilet gereksiz, temizle
          setCurrentTicket(null);

          setIsSearching(false);
          clearProgressTimer();

          toast({
            title: "Eslesme Bulundu!",
            description: "Oyun basliyor...",
          });

          // Skor/oda birikmesini önlemek için reset kaldırıldı - countdown ve katılımcı tutarlılığı için
          console.log('⏭️ Room reset skipped to preserve participants and countdown state');

          // ✅ Supabase tutarlılığını bekle - oda görünene kadar kısa süre dene
          try {
            for (let i = 1; i <= 20; i++) {
              const { data } = await supabase
                .from('game_rooms')
                .select('id')
                .eq('id', cleanMatchId)
                .maybeSingle();
              if (data?.id) {
                console.log(`🟢 Room visible on Supabase after ${i} tries`);
                break;
              }
              await new Promise((r) => setTimeout(r, 150));
            }
          } catch (visErr) {
            console.warn('Room visibility wait error:', visErr);
          }

          // ⏱️ Countdown başlat - Nakama eşleşmesi = 2 oyuncu = direkt başla
          try {
            console.log('⏰ Nakama eşleşmesi tamamlandı, countdown başlatılıyor...');
            const { data: countdownTime, error: rpcError } = await supabase.rpc('start_game_countdown', { p_room_id: cleanMatchId });
            if (rpcError) {
              console.warn('⚠️ Countdown RPC error:', rpcError);
            } else if (countdownTime) {
              console.log('✅ Countdown başlatıldı:', countdownTime);
              // UI'ya anında haber ver
              window.dispatchEvent(new CustomEvent('countdownStarted', { detail: { serverTime: countdownTime } }));
            }
          } catch (e) {
            console.warn('Countdown start error:', e);
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

      // Progress timer already running at start; no duplicate timer here
    } catch (error: any) {
      console.error("Nakama matchmaking failed:", error);
      clearProgressTimer();
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

    // Progress interval'ı durdur
    clearProgressTimer();

    // Nakama ticket'ı iptal et (bağlantı açıkken)
    if (useNakama && currentTicket) {
      try {
        console.log("❌ Cancelling Nakama matchmaking:", currentTicket);
        await nakamaService.cancelMatchmaking(currentTicket);
        console.log("✅ Nakama matchmaking ticket iptal edildi");
      } catch (error) {
        console.error("Nakama cancel error:", error);
        // Hata olsa bile devam et
      }
    }

    // State'leri temizle
    setIsSearching(false);
    setSearchProgress(0);
    setSearchTimeout(false);
    setNakamaMatch(null);
    setCurrentTicket(null);

    console.log("✅ Arama iptal edildi");
  };
  // Tekrar arama yap
  const restartSearch = async (gameType: "timed" | "score") => {
    console.log("🔄 Tekrar arama başlatılıyor...");
    
    // Önce tüm aktif işlemleri temizle
    await cancelSearch();
    await cleanup();

    // Kısa bekleme sonra yeni arama başlat
    setTimeout(() => {
      startSearch(gameType);
    }, 300);
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

  // Oyun bitimi veya ayrılma durumlarında cleanup eventi dinle
  useEffect(() => {
    const handleCleanup = () => {
      console.log("🧹 Global cleanup eventi alındı, matchmaking temizleniyor...");
      cleanup();
    };

    window.addEventListener('cleanupMatchmaking', handleCleanup);
    
    return () => {
      window.removeEventListener('cleanupMatchmaking', handleCleanup);
    };
  }, []);

  const value: MatchmakingContextType = {
    isSearching,
    currentRoom,
    searchProgress,
    searchTimeout,
    useNakama,
    nakamaMatch,
    currentGameType,
    startSearch,
    cancelSearch,
    restartSearch,
    playWithAI,
    onMatchFound,
  };

  return (
    <MatchmakingContext.Provider value={value}>
      {children}
    </MatchmakingContext.Provider>
  );
};
