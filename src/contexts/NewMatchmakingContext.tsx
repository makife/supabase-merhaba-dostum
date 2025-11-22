import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { matchBanlist } from "@/utils/matchBanlist";
import { useAppState } from "@/hooks/useAppState";

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

  // Arka plan yönetimi - matchmaking devam ediyor mu kontrol et
  const matchmakingStateRef = React.useRef({ isSearching: false, foundMatch: false });

  useAppState(
    () => {
      // Arka plana gitti
      console.log("📱 Uygulama arka plana gitti");
      if (isSearching) {
        console.log("🔍 Matchmaking arka planda devam ediyor...");
        matchmakingStateRef.current.isSearching = true;
      }
    },
    () => {
      // Ön plana geldi
      console.log("📱 Uygulama ön plana geldi");
      if (matchmakingStateRef.current.foundMatch) {
        console.log("✅ Arka planda eşleşme bulundu!");
        matchmakingStateRef.current.foundMatch = false;
      }
      matchmakingStateRef.current.isSearching = false;
    },
  );

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
        setIsSearching(false);
        console.log("⏰ Arama tamamlandı - oyuncu bulunamadı");
      }
    }, 1000);
    progressIntervalRef.current = id;
  };

  // Temizlik fonksiyonu
  const cleanup = async () => {
    console.log("🧹 Matchmaking cleanup başlatılıyor...");

    clearProgressTimer();

    if (searchChannel) {
      supabase.removeChannel(searchChannel);
      setSearchChannel(null);
      console.log("📡 Real-time channel kapatıldı");
    }

    setIsSearching(false);
    setCurrentRoom(null);
    setSearchProgress(0);
    setSearchTimeout(false);
    setCurrentGameType("timed");

    console.log("✅ Matchmaking tamamen temizlendi");
  };

  // Supabase Realtime ile matchmaking başlat
  const startSearch = async (gameType: "timed" | "score") => {
    if (!user) return;

    try {
      setIsSearching(true);
      setSearchProgress(0);
      setSearchTimeout(false);
      setCurrentGameType(gameType);
      
      // Store current game type globally for App.tsx callback
      (window as any).__currentMatchmakingType = gameType;

      console.log("🔍 Supabase Realtime matchmaking başlatıldı:", gameType);
      startProgressTimer();

      // 1️⃣ ÖNCELİKLE BOŞ ODA ARA (matchBanlist kontrollü)
      console.log("🔍 Boş oda aranıyor...");
      const { data: existingRooms, error: searchError } = await supabase
        .from("game_rooms")
        .select("id, status, current_grid, host_id, game_type_new")
        .eq("game_mode", "random-match")
        .eq("game_type_new", gameType)
        .eq("status", "waiting")
        .gt("created_at", new Date(Date.now() - 60000).toISOString())
        .order("created_at", { ascending: true })
        .limit(10);

      if (searchError) {
        console.error("❌ Oda arama hatası:", searchError);
      }

      // Uygun oda bul (banlist dışında ve farklı host)
      let targetRoom = existingRooms?.find(
        (room) => !matchBanlist.has(room.id) && room.host_id !== user.id
      );

      if (targetRoom) {
        console.log("✅ Uygun boş oda bulundu:", targetRoom.id.slice(-8));
        
        // Odaya katıl
        const { error: participantError } = await supabase
          .from("game_participants")
          .insert({
            room_id: targetRoom.id,
            user_id: user.id,
            score: 0,
            is_bot: false,
          });

        if (participantError && participantError.code !== "23505") {
          console.error("❌ Katılımcı ekleme hatası:", participantError);
        } else {
          console.log("✅ Odaya katıldı, oyun başlatılıyor...");
          
          // Countdown başlat
          const { data: countdownTime, error: rpcError } = await supabase.rpc("start_game_countdown", {
            p_room_id: targetRoom.id,
          });
          
          if (rpcError) {
            console.warn("⚠️ Countdown RPC error:", rpcError);
          } else if (countdownTime) {
            console.log("✅ Countdown başlatıldı:", countdownTime);
            window.dispatchEvent(new CustomEvent("countdownStarted", { detail: { serverTime: countdownTime } }));
          }

          setCurrentRoom({
            id: targetRoom.id,
            game_type: gameType,
            status: "waiting",
            current_players: 2,
            max_players: 2,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 300000).toISOString(),
          });

          clearProgressTimer();
          setSearchProgress(100);
          setIsSearching(false);
          onMatchFound?.(targetRoom.id);
          return;
        }
      }

      // 2️⃣ BOŞ ODA YOK, YENİ ODA OLUŞTUR
      console.log("❌ Boş oda yok, yeni oda oluşturuluyor...");
      
      // Grid oluştur
      const generateRandomGrid = (): string[] => {
        const letterPool = [
          "A","A","A","A","A","A","A","A","E","E","E","E","E","E","E","İ","İ","İ","İ","İ","İ",
          "I","I","I","I","I","O","O","O","O","O","U","U","U","U","Ü","Ü","Ü","Ö","Ö","Ö",
          "L","L","L","L","L","N","N","N","N","N","R","R","R","R","R","K","K","K","K",
          "M","M","M","M","T","T","T","T","S","S","S","S","D","D","D","Y","Y","Y",
          "B","B","B","C","C","Ç","Ç","F","F","G","G","Ğ","Ğ","H","H","J","P","P","Ş","Ş","V","V","Z",
        ];
        const grid: string[] = [];
        for (let i = 0; i < 16; i++) {
          grid.push(letterPool[Math.floor(Math.random() * letterPool.length)]);
        }
        return grid;
      };

      const gridArray = generateRandomGrid();
      const newRoomId = crypto.randomUUID();

      const { error: roomError } = await supabase.from("game_rooms").insert({
        id: newRoomId,
        room_code: newRoomId,
        host_id: user.id,
        game_mode: "random-match",
        game_type_new: gameType,
        status: "waiting",
        max_players: 2,
        time_limit: gameType === "timed" ? 120 : 0,
        max_score: gameType === "score" ? 500 : 0,
        current_grid: gridArray,
      });

      if (roomError) {
        console.error("❌ Oda oluşturma hatası:", roomError);
        throw roomError;
      }

      console.log("✅ Yeni oda oluşturuldu:", newRoomId.slice(-8));

      // Kendini katılımcı olarak ekle
      const { error: participantError } = await supabase
        .from("game_participants")
        .insert({
          room_id: newRoomId,
          user_id: user.id,
          score: 0,
          is_bot: false,
        });

      if (participantError && participantError.code !== "23505") {
        console.error("❌ Katılımcı ekleme hatası:", participantError);
      }

      setCurrentRoom({
        id: newRoomId,
        game_type: gameType,
        status: "waiting",
        current_players: 1,
        max_players: 2,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 300000).toISOString(),
      });

      console.log("⏳ Oda hazır, 2. oyuncu bekleniyor...");

      // 3️⃣ REALTIME SUBSCRIPTION - 2. oyuncu gelince tetiklenecek
      const channel = supabase
        .channel(`matchmaking-${newRoomId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "game_participants",
            filter: `room_id=eq.${newRoomId}`,
          },
          async (payload) => {
            console.log("📡 Yeni katılımcı tespit edildi:", payload);

            // Farklı oyuncu ve bot değilse
            if (!payload.new.is_bot && payload.new.user_id !== user.id && payload.new.user_id !== null) {
              console.log("🎉 2. oyuncu odaya katıldı!");

              // Countdown başlat
              const { data: countdownTime, error: rpcError } = await supabase.rpc("start_game_countdown", {
                p_room_id: newRoomId,
              });

              if (rpcError) {
                console.warn("⚠️ Countdown RPC error:", rpcError);
              } else if (countdownTime) {
                console.log("✅ Countdown başlatıldı:", countdownTime);
                window.dispatchEvent(new CustomEvent("countdownStarted", { detail: { serverTime: countdownTime } }));
              }

              clearProgressTimer();
              setSearchProgress(100);
              setIsSearching(false);
              
              // Channel'ı kapat
              supabase.removeChannel(channel);
              setSearchChannel(null);

              onMatchFound?.(newRoomId);
            }
          }
        )
        .subscribe();

      setSearchChannel(channel);
      console.log("📡 Realtime subscription aktif");

    } catch (error) {
      console.error("❌ Matchmaking hatası:", error);
      setIsSearching(false);
      clearProgressTimer();
      toast({
        title: "Arama Hatası",
        description: "Eşleşme araması başlatılamadı",
        variant: "destructive",
      });
    }
  };

  // Arama iptal et
  const cancelSearch = async () => {
    console.log("❌ Arama iptal ediliyor...");
    clearProgressTimer();

    if (searchChannel) {
      supabase.removeChannel(searchChannel);
      setSearchChannel(null);
      console.log("📡 Real-time channel kapatıldı");
    }

    setIsSearching(false);
    setCurrentRoom(null);

    toast({
      title: "Arama İptal Edildi",
      description: "Eşleşme araması durduruldu",
    });
  };

  // Aramayı yeniden başlat
  const restartSearch = async (gameType: "timed" | "score") => {
    console.log("🔄 Arama yeniden başlatılıyor...");
    await cleanup();
    await startSearch(gameType);
  };

  // AI ile oyna (placeholder)
  const playWithAI = () => {
    console.log("🤖 AI ile oyun başlatılacak");
    // AI logic will be handled by GameContext
  };

  // Component unmount'ta cleanup
  useEffect(() => {
    return () => {
      console.log("🧹 MatchmakingProvider unmount - cleanup çağrılıyor");
      cleanup();
    };
  }, []);

  // Global cleanup event listener
  useEffect(() => {
    const handleCleanup = () => {
      console.log("🧹 Global cleanup event alındı");
      cleanup();
    };

    window.addEventListener("matchmaking:cleanup", handleCleanup);
    return () => window.removeEventListener("matchmaking:cleanup", handleCleanup);
  }, []);

  const value: MatchmakingContextType = {
    isSearching,
    currentRoom,
    searchProgress,
    searchTimeout,
    currentGameType,
    startSearch,
    cancelSearch,
    restartSearch,
    playWithAI,
    onMatchFound,
  };

  return <MatchmakingContext.Provider value={value}>{children}</MatchmakingContext.Provider>;
};
