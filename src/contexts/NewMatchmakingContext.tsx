import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { getGlobalServerNow } from "@/contexts/ServerTimeContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { matchBanlist } from "@/utils/matchBanlist";
import { useAppState } from "@/hooks/useAppState";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";

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
  // Ref to access current room inside closures/timeouts without dependency issues
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

      // Önce katılımcıları sil (Constraints hatasını önlemek için)
      await supabase.from("game_participants").delete().eq("room_id", roomToDelete.id);

      // Sonra odayı sil
      await supabase
        .from("game_rooms")
        .delete()
        .eq("id", roomToDelete.id)
        .eq("host_id", user.id) // Sadece host ise sil
        .eq("status", "waiting"); // Sadece bekliyorsa sil
    }
  };

  const handleSearchTimeout = async () => {
    console.log("⏰ Arama zaman aşımına uğradı - Oda temizleniyor...");
    clearProgressTimer();

    // Zaman aşımında odayı mutlaka sil!
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
    // 60 saniyelik sayaç (Her tick 1.66 eklerse yaklaşık 60sn sürer)
    // Mevcut kodunuzda 3.33 vardı (30 sn). Bunu 60 sn'ye çıkaralım daha sağlıklı olur.
    const increment = 100 / 60;

    const id = window.setInterval(() => {
      progress += increment;
      setSearchProgress(Math.min(progress, 100));

      if (progress >= 100) {
        clearInterval(id);
        handleSearchTimeout(); // Timeout logic'i çağır
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
    // Timeout state'ini burada sıfırlamıyoruz çünkü UI'da göstermek isteyebiliriz
  };

  // Tam temizlik (Unmount veya Cancel durumunda)
  const cleanup = async () => {
    console.log("🧹 Matchmaking cleanup...");
    clearProgressTimer();
    await cleanupLocalState();
    setSearchTimeout(false);
    setCurrentGameType("timed");
  };

  // Supabase Realtime ile matchmaking başlat
  const startSearch = async (gameType: "timed" | "score") => {
    if (!user) return;

    try {
      // Önce temizlik yap
      await cleanup();

      setIsSearching(true);
      setSearchProgress(0);
      setSearchTimeout(false);
      setCurrentGameType(gameType);

      // Global flag set et
      (window as any).__currentMatchmakingType = gameType;

      console.log("🔍 Matchmaking başlatıldı:", gameType);
      startProgressTimer();

      // 1️⃣ ADIM: ÖNCE MEVCUT ODALARI ARA
      // -------------------------------------------------------------
      // KRİTİK DÜZELTME:
      // 1. getGlobalServerNow() kullanarak telefon saati hatalarını yok sayıyoruz.
      // 2. Süreyi 1 SAAT (3600000ms) yapıyoruz ki "az önce kurulmuş" odalar kaybolmasın.
      // 3. Status 'waiting' olduğu sürece odayı alıyoruz.
      // -------------------------------------------------------------
      console.log("🔍 Boş oda aranıyor...");

      const { data: existingRooms, error: searchError } = await supabase
        .from("game_rooms")
        .select("id, status, current_grid, host_id, game_type_new, created_at")
        .eq("game_mode", "random-match") // Mod kontrolü
        .eq("game_type_new", gameType) // Oyun tipi kontrolü
        .eq("status", "waiting") // Sadece bekleyenler
        .gt("created_at", new Date(getGlobalServerNow() - 3600000).toISOString()) // Son 1 saat
        .neq("host_id", user.id) // Kendi odamızı bulmayalım
        .limit(10);

      if (searchError) {
        console.error("❌ Oda arama hatası:", searchError);
      } else {
        console.log(`🔍 Bulunan potansiyel oda sayısı: ${existingRooms?.length || 0}`);
      }

      // Banlı olmayan ve uygun bir oda seç
      let targetRoom = existingRooms?.find((room) => !matchBanlist.has(room.id));

      // --- BULUNDU: ODAYA KATIL ---
      if (targetRoom) {
        console.log("✅ Uygun oda bulundu, katılım yapılıyor:", targetRoom.id);

        // Katılımcı ekle
        const { error: participantError } = await supabase.from("game_participants").insert({
          room_id: targetRoom.id,
          user_id: user.id,
          score: 0,
          is_bot: false,
        });

        if (participantError && participantError.code !== "23505") {
          console.error("❌ Katılımcı ekleme hatası:", participantError);
          // Hata varsa döngüyü kırma, aşağı inip kendi odasını kursun
        } else {
          console.log("✅ Odaya başarıyla girildi! (Guest)");

          // Countdown başlat (Tetikleyici)
          await supabase.rpc("start_game_countdown", {
            p_room_id: targetRoom.id,
          });

          // State güncelle
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

          // Yönlendirme callback
          onMatchFound?.(targetRoom.id);
          return; // Fonksiyondan çık
        }
      }

      // 2️⃣ ADIM: ODA BULUNAMADI, HEMEN YENİ ODA KUR
      // -------------------------------------------------------------
      // Burada bekleme yok! Bulamadıysa anında kurar.
      // -------------------------------------------------------------
      console.log("❌ Uygun oda bulunamadı, yeni oda kuruluyor (Host)...");

      // Grid oluştur
      const generateRandomGrid = (): string[] => {
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
          grid.push(letterPool[Math.floor(Math.random() * letterPool.length)]);
        }
        return grid;
      };

      const newRoomId = crypto.randomUUID();

      // Odayı oluştur
      const { error: roomError } = await supabase.from("game_rooms").insert({
        id: newRoomId,
        room_code: newRoomId,
        host_id: user.id,
        player1_id: user.id, // Host aynı zamanda Player 1'dir
        game_mode: "random-match", // Modun doğru olduğundan emin ol
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

      // Kendini katılımcı olarak ekle
      await supabase.from("game_participants").insert({
        room_id: newRoomId,
        user_id: user.id,
        score: 0,
        is_bot: false,
      });

      // State güncelle (Host modu)
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

      // 3️⃣ ADIM: RAKİBİ BEKLE (Realtime)
      const channelName = `matchmaking-${newRoomId}`;
      const channel = autoReconnect.registerChannel(channelName, () =>
        supabase
          .channel(channelName)
          // Katılımcı gelmesini dinle
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "game_participants",
              filter: `room_id=eq.${newRoomId}`,
            },
            async (payload) => {
              // Gelen kişi ben değilsem ve bot değilse -> RAKİPTİR
              if (!payload.new.is_bot && payload.new.user_id !== user.id) {
                console.log("🎉 Rakip bulundu! (Player 2 katıldı)");
                clearProgressTimer();
                setSearchProgress(100);
                setIsSearching(false);
                // Burada yönlendirme YAPMA, countdown_started_at'i bekle
              }
            },
          )
          // Oda güncellemesini dinle (Countdown başlayınca git)
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

                // Event fırlat (Timer senkronizasyonu için)
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

    // İptal durumunda da odayı silmeliyiz!
    await deleteRoomFromDB();
    await cleanupLocalState();

    toast({ title: "Arama İptal Edildi" });
  };

  const restartSearch = async (gameType: "timed" | "score") => {
    await cleanup();
    setTimeout(() => startSearch(gameType), 100); // Hafif gecikme ile başlat (race condition önlemek için)
  };

  const playWithAI = () => {
    // AI mantığı
  };

  useEffect(() => {
    return () => {
      // Unmount olduğunda odayı silmeye çalış (User navigating away while searching)
      if (currentRoomRef.current) {
        deleteRoomFromDB();
      }
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
