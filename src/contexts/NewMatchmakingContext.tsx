import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { matchBanlist } from "@/utils/matchBanlist";
import { useAppState } from "@/hooks/useAppState";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";
import { getGlobalServerNow } from "./ServerTimeContext";
import { matchmakingMode } from "@/utils/matchmakingMode";
import SearchCancelledCard from "@/components/SearchCancelledCard";

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
  matchFound: boolean;
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
  const [matchFound, setMatchFound] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(false);
  const [currentGameType, setCurrentGameType] = useState<"timed" | "score">("timed");
  const [searchChannel, setSearchChannel] = useState<any>(null);
  const [showCancelledCard, setShowCancelledCard] = useState(false);
  const progressIntervalRef = React.useRef<number | null>(null);
  const botFallbackTimerRef = React.useRef<number | null>(null);
  // 🔒 İptal koruması: her arama kendi id'sine sahip, iptalde id artar
  const searchIdRef = React.useRef(0);
  const currentRoomRef = React.useRef<MatchmakingRoom | null>(null);
  const searchChannelRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  const clearBotFallbackTimer = () => {
    if (botFallbackTimerRef.current) {
      clearTimeout(botFallbackTimerRef.current);
      botFallbackTimerRef.current = null;
    }
  };




  // Arka plan yönetimi - matchmaking devam ediyor mu kontrol et
  const matchmakingStateRef = React.useRef({ isSearching: false, foundMatch: false });

  useAppState({
    onBackground: () => {
      console.log("📱 Uygulama arka plana gitti");
      if (isSearching) {
        console.log("🔍 Matchmaking arka planda devam ediyor...");
        matchmakingStateRef.current.isSearching = true;
      }
    },
    onForeground: () => {
      console.log("📱 Uygulama ön plana geldi");
      if (matchmakingStateRef.current.foundMatch) {
        console.log("✅ Arka planda eşleşme bulundu!");
        matchmakingStateRef.current.foundMatch = false;
      }
      matchmakingStateRef.current.isSearching = false;
    },
  });

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
        matchmakingMode.deactivate();
        console.log("⏰ Arama tamamlandı - oyuncu bulunamadı");
      }
    }, 1000);
    progressIntervalRef.current = id;
  };

  // Temizlik fonksiyonu
  const cleanup = async () => {
    console.log("🧹 Matchmaking cleanup başlatılıyor...");

    searchIdRef.current++;
    clearProgressTimer();
    clearBotFallbackTimer();

    const activeChannel = searchChannelRef.current || searchChannel;
    if (activeChannel) {
      autoReconnect.unregisterChannel(activeChannel);
      setSearchChannel(null);
      searchChannelRef.current = null;
      console.log("📡 Real-time channel kapatıldı");
    }


    setIsSearching(false);
    setCurrentRoom(null);
    currentRoomRef.current = null;

    setSearchProgress(0);
    setMatchFound(false);
    setSearchTimeout(false);
    setCurrentGameType("timed");

    // 🚀 Arka plan polling'lerini devam ettir
    matchmakingMode.deactivate();

    console.log("✅ Matchmaking tamamen temizlendi");
  };

  // Supabase Realtime ile matchmaking başlat
  const startSearch = async (gameType: "timed" | "score") => {
    if (!user) return;

    const mySearchId = ++searchIdRef.current;
    const isStale = () => searchIdRef.current !== mySearchId;

    try {
      setIsSearching(true);

      setSearchProgress(0);
      setMatchFound(false);
      setSearchTimeout(false);
      setCurrentGameType(gameType);

      // 🚀 Arka plan polling'lerini duraklat
      matchmakingMode.activate();

      // Store current game type globally for App.tsx callback
      (window as any).__currentMatchmakingType = gameType;

      console.log("🔍 Supabase Realtime matchmaking başlatıldı:", gameType);
      startProgressTimer();

      // 1️⃣ ÖNCELİKLE BOŞ ODA ARA (matchBanlist kontrollü)
      // 🔧 FIX: 2 dakika içinde oluşturulan bekleyen odaları ara (5dk → 2dk) - SERVER TIME kullan!
      const serverNow = getGlobalServerNow();
      const twoMinutesAgo = new Date(serverNow - 120000).toISOString(); // 2 dakika = 120000ms
      console.log("🔍 Boş oda aranıyor... (serverNow:", new Date(serverNow).toISOString(), ", 2dk önce:", twoMinutesAgo, ")");

      const { data: existingRooms, error: searchError } = await supabase
        .from("game_rooms")
        .select("id, status, current_grid, host_id, game_type_new, created_at")
        .eq("game_mode", "random-match")
        .eq("game_type_new", gameType)
        .eq("status", "waiting")
        .gt("created_at", twoMinutesAgo)
        .order("created_at", { ascending: true })
        .limit(10);

      if (isStale()) {
        console.log("🛑 Arama iptal edildi (oda arama sonrası) - çıkılıyor");
        return;
      }



      if (searchError) {
        console.error("❌ Oda arama hatası:", searchError);
      }

      console.log(
        "📋 Bulunan odalar:",
        existingRooms?.length || 0,
        existingRooms?.map((r) => r.id.slice(-8)),
      );

      // --- DÜZELTME BAŞLANGICI ---
      // Eski hatalı kod: Array.find içinde async çalışmaz.
      /* let targetRoom = existingRooms?.find(
        (room) => !matchBanlist.has(room.id) && room.host_id !== user.id
      ); 
      */

      // Yeni kod: for...of döngüsü ile await kullanımı
      let targetRoom = null;

      if (existingRooms && existingRooms.length > 0) {
        for (const room of existingRooms) {
          // Kendi kurduğumuz odaya girmeyelim
          if (room.host_id === user.id) continue;

          // Banlı olup olmadığını asenkron kontrol et
          const isBanned = await matchBanlist.has(room.id);

          if (!isBanned) {
            // Uygun oda bulundu
            targetRoom = room;
            break; // Döngüyü kır
          }
        }
      }
      // --- DÜZELTME BİTİŞİ ---

      if (targetRoom) {
        console.log("✅ Uygun boş oda bulundu:", targetRoom.id.slice(-8));

        // 🔧 RACE CONDITION FIX: 3 deneme, 200ms aralıkla
        let joinSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          // Odaya katıl
          const { error: participantError } = await supabase.from("game_participants").insert({
            room_id: targetRoom.id,
            user_id: user.id,
            score: 0,
            is_bot: false,
          });

          if (!participantError) {
            joinSuccess = true;
            console.log("✅ Odaya katıldı! (deneme:", attempt, ")");
            break;
          } else if (participantError.code === "23505") {
            // Duplicate key - zaten katılmış
            joinSuccess = true;
            console.log("ℹ️ Zaten odada (deneme:", attempt, ")");
            break;
          } else if (participantError.code === "23503") {
            // Foreign key - oda silindi
            console.log("⚠️ Oda silindi, sonraki odayı dene (deneme:", attempt, ")");

            // Mevcut targetRoom geçersiz oldu, tekrar arama yapmaya gerek yok,
            // döngüden çıkıp yeni oda oluşturmaya gidebiliriz veya bir sonraki odayı deneyebiliriz.
            // Basitlik adına burada başarısız kabul edip yeni oda oluşturmaya düşebiliriz
            // veya listedeki bir sonraki odayı manuel deneyebiliriz.
            // Ancak yukarıdaki for döngüsü zaten en uygununu seçmişti.
            // Bu basit fix içinde break yapıyoruz, aşağıda "targetRoom" olmasına rağmen joinSuccess false kalırsa logic yönetilmeli.
            break;
          } else {
            console.error("❌ Katılımcı ekleme hatası (deneme:", attempt, "):", participantError);
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }

        if (isStale()) {
          console.log("🛑 Arama iptal edildi (katılım sonrası) - odadan çıkılıyor");
          if (joinSuccess && targetRoom) {
            await supabase
              .from("game_participants")
              .delete()
              .eq("room_id", targetRoom.id)
              .eq("user_id", user.id);
          }
          return;
        }

        if (joinSuccess && targetRoom) {
          console.log("✅ Odaya başarıyla katıldı! Countdown başlatılıyor...");

          // Countdown başlat (Player 1)
          const { data: countdownTime, error: rpcError } = await supabase.rpc("start_game_countdown", {
            p_room_id: targetRoom.id,
          });

          if (rpcError) {
            console.error("❌ Countdown RPC error:", rpcError);
          } else if (countdownTime) {
            console.log("✅ Countdown başlatıldı (Player 1) - real-time subscription event'i bekleyeceğiz");
          }

          if (isStale()) {
            console.log("🛑 Arama iptal edildi (countdown sonrası) - navigate edilmiyor");
            return;
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
          setMatchFound(true);
          setIsSearching(false);
          matchmakingMode.deactivate();
          onMatchFound?.(targetRoom.id);
          return;
        }
      }

      // 2️⃣ BOŞ ODA YOK, YENİ ODA OLUŞTUR
      console.log("❌ Boş oda yok veya katılım sağlanamadı, yeni oda oluşturuluyor...");

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

      if (isStale()) {
        console.log("🛑 Arama iptal edildi (oda oluşturma öncesi) - çıkılıyor");
        return;
      }

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

      const abandonRoom = async () => {
        await supabase.from("game_participants").delete().eq("room_id", newRoomId);
        await supabase.from("game_rooms").delete().eq("id", newRoomId).eq("host_id", user.id);
        console.log("🗑️ İptal sonrası oluşturulan oda silindi");
      };

      if (isStale()) {
        await abandonRoom();
        return;
      }

      // Kendini katılımcı olarak ekle
      const { error: participantError } = await supabase.from("game_participants").insert({
        room_id: newRoomId,
        user_id: user.id,
        score: 0,
        is_bot: false,
      });

      if (participantError && participantError.code !== "23505") {
        console.error("❌ Katılımcı ekleme hatası:", participantError);
      }

      if (isStale()) {
        await abandonRoom();
        return;
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

      // 3️⃣ REALTIME SUBSCRIPTION - 2. oyuncu gelince tetiklenecek (auto-reconnect destekli)
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
              if (isStale()) return;
              console.log("📡 Yeni katılımcı tespit edildi:", payload);

              // Farklı oyuncu ve bot değilse
              if (!payload.new.is_bot && payload.new.user_id !== user.id && payload.new.user_id !== null) {

                console.log("🎉 2. oyuncu odaya katıldı! (Player 2 - oda sahibi tespit etti)");

                // Bot fallback'i iptal et - gerçek oyuncu geldi
                clearBotFallbackTimer();

                // SADECE countdown bilgisini dinle, navigate için bekle
                // Countdown Player 1 tarafından başlatıldı, biz sadece tespit ediyoruz
                console.log("⏳ Player 1 countdown başlattı, realtime'dan bekliyoruz...");

                clearProgressTimer();
                setSearchProgress(100);
                setMatchFound(true);
                setIsSearching(false);

                // Channel'ı KAPATMA - room update için açık tutuyoruz
                console.log("📡 Participant subscription tamamlandı, room update dinleniyor...");

                // Navigate etmeden önce countdown_started_at'ın set edilmesini bekle
                // Bu bilgi room update realtime'ından gelecek
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
              if (isStale()) {
                autoReconnect.unregisterChannel(channelName);
                return;
              }
              console.log("📡 Room update tespit edildi:", payload);


              // countdown_started_at set edildiyse navigate yap
              if (payload.new.countdown_started_at) {
                console.log("✅ Countdown timestamp alındı, navigate ediliyor...", payload.new.countdown_started_at);
                clearProgressTimer();
                setSearchProgress(100);
                setMatchFound(true);

                // ÖNCE channel'ı kapat - duplicate tetiklemeyi önle
                autoReconnect.unregisterChannel(channelName);
                setSearchChannel(null);
                console.log("📡 Room update subscription kapatıldı (duplicate önleme)");

                // Event dispatch et
                window.dispatchEvent(
                  new CustomEvent("countdownStarted", { detail: { serverTime: payload.new.countdown_started_at } }),
                );

                // Son olarak navigate
                onMatchFound?.(newRoomId);
              }
            },
          )
          .subscribe(),
      );

      if (isStale()) {
        autoReconnect.unregisterChannel(channelName);
        await abandonRoom();
        return;
      }

      setSearchChannel(channelName);
      searchChannelRef.current = channelName;
      console.log("📡 Realtime subscription aktif (participants + room updates) - auto-reconnect destekli");

      // 4️⃣ BOT FALLBACK: 5-12 saniye içinde gerçek oyuncu bulunamazsa bot ekle
      // ?botNow=1 (rematch sonrası) varsa hemen bot ekle
      const urlParams = new URLSearchParams(window.location.search);
      const instantBot = urlParams.get("botNow") === "1";
      const botDelay = instantBot ? 300 : (5000 + Math.floor(Math.random() * 7001));
      clearBotFallbackTimer();
      botFallbackTimerRef.current = window.setTimeout(async () => {
        if (isStale()) return;
        console.log(`🤖 ${instantBot ? "Instant" : `${botDelay}ms`} bot fallback tetiklendi`);

        try {
          const { data: countdownTs, error: botErr } = await supabase.rpc("add_random_match_bot" as any, {
            p_room_id: newRoomId,
          });
          if (botErr) {
            console.error("❌ Bot ekleme hatası:", botErr);
            return;
          }
          console.log("✅ Bot rakip eklendi, countdown:", countdownTs);
        } catch (e) {
          console.error("❌ Bot fallback exception:", e);
        }
      }, botDelay);
    } catch (error) {
      if (isStale()) {
        console.log("🛑 Arama iptal edilmişti, hata yoksayıldı:", error);
        return;
      }

      console.error("❌ Matchmaking hatası:", error);
      setIsSearching(false);
      clearProgressTimer();
      matchmakingMode.deactivate();
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
    // 🔒 Devam eden async arama akışını geçersiz kıl
    searchIdRef.current++;
    clearProgressTimer();
    clearBotFallbackTimer();

    const activeChannel = searchChannelRef.current || searchChannel;
    if (activeChannel) {
      autoReconnect.unregisterChannel(activeChannel);
      setSearchChannel(null);
      searchChannelRef.current = null;
      console.log("📡 Real-time channel kapatıldı");
    }

    const roomToDelete = currentRoomRef.current || currentRoom;

    setIsSearching(false);
    setCurrentRoom(null);
    currentRoomRef.current = null;
    matchmakingMode.deactivate();
    setShowCancelledCard(true);

    // Veritabanından odayı sil (eğer bekleyen oda varsa)
    if (roomToDelete && user) {
      console.log("🗑️ Bekleyen oda veritabanından siliniyor:", roomToDelete.id.slice(-8));

      // Önce katılımcıları sil
      await supabase.from("game_participants").delete().eq("room_id", roomToDelete.id);

      // Sonra odayı sil
      const { error } = await supabase
        .from("game_rooms")
        .delete()
        .eq("id", roomToDelete.id)
        .eq("host_id", user.id)
        .eq("status", "waiting");

      if (error) {
        console.error("❌ Oda silme hatası:", error);
      } else {
        console.log("✅ Bekleyen oda veritabanından silindi");
      }
    }
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

    // 🔧 FIX: GamePage "cleanupMatchmaking" event'i gönderiyor,
    // eski isim ("matchmaking:cleanup") hiç tetiklenmiyordu.
    window.addEventListener("matchmaking:cleanup", handleCleanup);
    window.addEventListener("cleanupMatchmaking", handleCleanup);
    return () => {
      window.removeEventListener("matchmaking:cleanup", handleCleanup);
      window.removeEventListener("cleanupMatchmaking", handleCleanup);
    };
  }, []);


  const value: MatchmakingContextType = {
    isSearching,
    currentRoom,
    searchProgress,
    matchFound,
    searchTimeout,
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
      <SearchCancelledCard open={showCancelledCard} onClose={() => setShowCancelledCard(false)} />
    </MatchmakingContext.Provider>
  );
};
