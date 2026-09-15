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

      // 1️⃣ Oda arama + katılma tek atomik RPC ile yapılıyor (aşağıda)
      console.log("🔍 Atomik eşleşme başlıyor...");


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

      // ⚡ ATOMİK EŞLEŞME: boş oda varsa sunucu tarafında kilitleyip katıl, yoksa yeni oda kur
      // (SKIP LOCKED sayesinde 1000 eşzamanlı aramada aynı odaya yığılma olmaz)
      const bannedIds = await matchBanlist.list();
      const { data: rpcRows, error: rpcMatchError } = await supabase.rpc("find_or_create_random_room", {
        p_game_type: gameType,
        p_grid: gridArray,
        p_exclude: bannedIds,
      });

      if (rpcMatchError) {
        console.error("❌ find_or_create_random_room hatası:", rpcMatchError);
        throw rpcMatchError;
      }

      const matchResult = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      const newRoomId: string = matchResult?.room_id;
      const didJoin: boolean = !!matchResult?.joined;

      if (!newRoomId) {
        console.error("❌ Eşleşme sonucu boş döndü");
        throw new Error("matchmaking_failed");
      }

      const abandonRoom = async () => {
        await supabase.from("game_participants").delete().eq("room_id", newRoomId).eq("user_id", user.id);
        await supabase.from("game_rooms").delete().eq("id", newRoomId).eq("host_id", user.id);
        console.log("🗑️ İptal sonrası oda temizlendi");
      };

      if (isStale()) {
        await abandonRoom();
        return;
      }

      // 🎯 Mevcut odaya katıldık → Player 2 olarak countdown başlat
      if (didJoin) {
        console.log("✅ Boş odaya atomik katılım:", newRoomId.slice(-8));

        const { error: rpcError } = await supabase.rpc("start_game_countdown", {
          p_room_id: newRoomId,
        });
        if (rpcError) console.error("❌ Countdown RPC error:", rpcError);

        if (isStale()) {
          console.log("🛑 Arama iptal edildi (countdown sonrası) - navigate edilmiyor");
          return;
        }

        setCurrentRoom({
          id: newRoomId,
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
        onMatchFound?.(newRoomId);
        return;
      }

      console.log("✅ Yeni oda oluşturuldu (host):", newRoomId.slice(-8));


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
