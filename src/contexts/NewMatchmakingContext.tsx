import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { matchBanlist } from "@/utils/matchBanlist";
import { useAppState } from "@/hooks/useAppState";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";
import { getGlobalServerNow } from "@/contexts/ServerTimeContext"; // Server saati eklendi

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
  const progressIntervalRef = useRef<number | null>(null);
  const currentRoomRef = useRef<MatchmakingRoom | null>(null);

  // State'i ref ile senkronize et
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  // Arka plan yönetimi
  const matchmakingStateRef = React.useRef({ isSearching: false, foundMatch: false });

  useAppState({
    onBackground: () => {
      console.log("📱 Uygulama arka plana gitti");
      if (isSearching) {
        matchmakingStateRef.current.isSearching = true;
      }
    },
    onForeground: () => {
      console.log("📱 Uygulama ön plana geldi");
      if (matchmakingStateRef.current.foundMatch) {
        matchmakingStateRef.current.foundMatch = false;
      }
      matchmakingStateRef.current.isSearching = false;
    },
  });

  const clearProgressTimer = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  // Odayı veritabanından silme fonksiyonu
  const deleteRoomFromDB = async () => {
    const roomToDelete = currentRoomRef.current;
    if (roomToDelete && user) {
      console.log("🗑️ Oda veritabanından siliniyor (Cleanup):", roomToDelete.id.slice(-8));

      await supabase.from("game_participants").delete().eq("room_id", roomToDelete.id);

      await supabase
        .from("game_rooms")
        .delete()
        .eq("id", roomToDelete.id)
        .eq("host_id", user.id)
        .eq("status", "waiting");
    }
  };

  const handleSearchTimeout = async () => {
    console.log("⏰ Arama zaman aşımına uğradı - Oda temizleniyor...");
    clearProgressTimer();
    await deleteRoomFromDB();
    await cleanupLocalState();
    setSearchTimeout(true);
    toast({
      title: "Oyuncu Bulunamadı",
      description: "Yeterli süre içinde eşleşme sağlanamadı.",
      variant: "destructive",
    });
  };

  const startProgressTimer = () => {
    clearProgressTimer();
    let progress = 0;
    const increment = 100 / 60; // 60 saniye

    const id = window.setInterval(() => {
      progress += increment;
      setSearchProgress(Math.min(progress, 100));
      if (progress >= 100) {
        clearInterval(id);
        handleSearchTimeout();
      }
    }, 1000);
    progressIntervalRef.current = id;
  };

  const cleanupLocalState = async () => {
    if (searchChannel) {
      autoReconnect.unregisterChannel(searchChannel);
      setSearchChannel(null);
    }
    setIsSearching(false);
    setCurrentRoom(null);
    setSearchProgress(0);
  };

  const cleanup = async () => {
    console.log("🧹 Matchmaking cleanup...");
    clearProgressTimer();
    await cleanupLocalState();
    setSearchTimeout(false);
    setCurrentGameType("timed");
  };

  const startSearch = async (gameType: "timed" | "score") => {
    if (!user) return;

    try {
      await cleanup();
      setIsSearching(true);
      setSearchProgress(0);
      setSearchTimeout(false);
      setCurrentGameType(gameType);

      (window as any).__currentMatchmakingType = gameType;
      console.log("🔍 Matchmaking başlatıldı:", gameType);
      startProgressTimer();

      // 1️⃣ ADIM: MEVCUT ODALARI ARA
      // -------------------------------------------------------------
      // getGlobalServerNow() ve 1 SAAT (3600000ms) süresi kullanıldı
      // -------------------------------------------------------------
      console.log("🔍 Boş oda aranıyor...");

      // Server saati hazır değilse fallback olarak Date.now() kullan
      const currentTime = getGlobalServerNow() || Date.now();
      const oneHourAgo = new Date(currentTime - 3600000).toISOString();

      const { data: existingRooms, error: searchError } = await supabase
        .from("game_rooms")
        .select("id, status, current_grid, host_id, game_type_new, created_at")
        .eq("game_mode", "random-match")
        .eq("game_type_new", gameType)
        .eq("status", "waiting")
        .gt("created_at", oneHourAgo)
        .neq("host_id", user.id) // KENDİ ODAMI BULMA
        .limit(10);

      if (searchError) {
        console.error("❌ Oda arama hatası:", searchError);
      } else {
        console.log(`🔍 Bulunan potansiyel oda sayısı: ${existingRooms?.length || 0}`);
      }

      let targetRoom = existingRooms?.find((room) => !matchBanlist.has(room.id));

      // --- BULUNDU: ODAYA KATIL ---
      if (targetRoom) {
        console.log("✅ Uygun oda bulundu, katılım yapılıyor:", targetRoom.id);

        const { error: participantError } = await supabase.from("game_participants").insert({
          room_id: targetRoom.id,
          user_id: user.id,
          score: 0,
          is_bot: false,
        });

        if (participantError && participantError.code !== "23505") {
          console.error("❌ Katılımcı ekleme hatası:", participantError);
        } else {
          console.log("✅ Odaya başarıyla girildi! (Guest)");

          // Countdown başlat
          await supabase.rpc("start_game_countdown", {
            p_room_id: targetRoom.id,
          });

          setCurrentRoom({
            id: targetRoom.id,
            game_type: gameType,
            status: "waiting",
            current_players: 2,
            max_players: 2,
            created_at: targetRoom.created_at,
            expires_at: new Date(Date.now() + 300000).toISOString(),
          });

          clearProgressTimer();
          setSearchProgress(100);
          setIsSearching(false);

          onMatchFound?.(targetRoom.id);
          return;
        }
      }

      // 2️⃣ ADIM: ODA BULUNAMADI, YENİ ODA KUR
      console.log("❌ Uygun oda bulunamadı, yeni oda kuruluyor (Host)...");

      const generateRandomGrid = (): string[] => {
        const letterPool = [
          "A",
          "A",
          "E",
          "E",
          "İ",
          "I",
          "O",
          "U",
          "Ü",
          "Ö",
          "L",
          "N",
          "R",
          "K",
          "M",
          "T",
          "S",
          "D",
          "Y",
          "B",
          "C",
          "Ç",
          "F",
          "G",
          "Ğ",
          "H",
          "J",
          "P",
          "Ş",
          "V",
          "Z",
        ];
        const grid: string[] = [];
        for (let i = 0; i < 16; i++) {
          grid.push(letterPool[Math.floor(Math.random() * letterPool.length)]);
        }
        return grid;
      };

      const newRoomId = crypto.randomUUID();

      const { error: roomError } = await supabase.from("game_rooms").insert({
        id: newRoomId,
        room_code: newRoomId,
        host_id: user.id,
        player1_id: user.id, // Player 1 olarak kendini kaydet
        game_mode: "random-match",
        game_type_new: gameType,
        status: "waiting",
        max_players: 2,
        time_limit: gameType === "timed" ? 120 : 0,
        max_score: gameType === "score" ? 500 : 0,
        current_grid: generateRandomGrid(),
      });

      if (roomError) {
        console.error("❌ Oda oluşturma hatası:", roomError);
        throw roomError;
      }

      console.log("✅ Oda veritabanına kaydedildi:", newRoomId);

      await supabase.from("game_participants").insert({
        room_id: newRoomId,
        user_id: user.id,
        score: 0,
        is_bot: false,
      });

      const newRoomObj = {
        id: newRoomId,
        game_type: gameType,
        status: "waiting",
        current_players: 1,
        max_players: 2,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 300000).toISOString(),
      };

      setCurrentRoom(newRoomObj);
      currentRoomRef.current = newRoomObj;

      // 3️⃣ ADIM: RAKİBİ BEKLE
      const channelName = `matchmaking-${newRoomId}`;
      const channel = autoReconnect.registerChannel(channelName, () =>
        supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "game_participants",
              filter: `room_id=eq.${newRoomId}`,
            },
            async (payload) => {
              if (!payload.new.is_bot && payload.new.user_id !== user.id) {
                console.log("🎉 Rakip bulundu! (Player 2 katıldı)");
                clearProgressTimer();
                setSearchProgress(100);
                setIsSearching(false);
              }
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "game_rooms",
              filter: `id=eq.${newRoomId}`,
            },
            async (payload) => {
              if (payload.new.countdown_started_at) {
                console.log("🚀 Oyun başlıyor! Countdown:", payload.new.countdown_started_at);

                autoReconnect.unregisterChannel(channelName);
                setSearchChannel(null);

                window.dispatchEvent(
                  new CustomEvent("countdownStarted", {
                    detail: { serverTime: payload.new.countdown_started_at },
                  }),
                );

                onMatchFound?.(newRoomId);
              }
            },
          )
          .subscribe(),
      );

      setSearchChannel(channelName);
      console.log("📡 Rakip bekleniyor...");
    } catch (error) {
      console.error("❌ Matchmaking genel hatası:", error);
      setIsSearching(false);
      clearProgressTimer();
      toast({
        title: "Hata",
        description: "Arama başlatılamadı. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    }
  };

  const cancelSearch = async () => {
    console.log("❌ Arama iptal ediliyor...");
    clearProgressTimer();
    await deleteRoomFromDB();
    await cleanupLocalState();
    toast({ title: "Arama İptal Edildi" });
  };

  const restartSearch = async (gameType: "timed" | "score") => {
    await cleanup();
    setTimeout(() => startSearch(gameType), 100);
  };

  const playWithAI = () => {};

  useEffect(() => {
    return () => {
      if (currentRoomRef.current) deleteRoomFromDB();
      cleanup();
    };
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
