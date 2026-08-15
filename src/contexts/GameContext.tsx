import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
// removed sonner toast import (using shadcn use-toast)
import { useAuth } from "./AuthContext";
import { useUser } from "./UserContext";
import { useToast } from "@/hooks/use-toast";

import { useNavigate } from "react-router-dom";
import { realtimeManager } from "@/utils/realtimeManager";
import { matchBanlist } from "@/utils/matchBanlist";
import { Button } from "@/components/ui/button";
import { setLastRoomId, getLastRoomId } from "@/utils/persistentState";
// NativeRealtime kaldırıldı - Supabase JS SDK yeterli

interface GameRoom {
  id: string;
  room_code: string | null;
  game_mode: string;
  status: string;
  host_id: string;
  max_score: number;
  time_limit: number;
  current_grid: any;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  countdown_started_at?: string | null;
  player1_id?: string | null;
  player2_id?: string | null;
  winner_id?: string | null;
  player1_score?: number;
  player2_score?: number;
}

interface GameParticipantPayload {
  user_id?: string | null;
  is_bot?: boolean;
  room_id?: string;
  score?: number;
}

interface GameParticipant {
  id: string;
  room_id: string;
  user_id: string | null;
  score: number;
  is_bot: boolean;
  joined_at: string;
  profiles?: {
    username: string;
    avatar_url: string | null;
    premium_until?: string | null;
  };
}

interface GameContextType {
  currentRoom: GameRoom | null;
  participants: GameParticipant[];
  lastOpponent: GameParticipant | null;
  createRoom: (gameMode: string, roomCode?: string) => Promise<GameRoom | null>;
  joinRoom: (roomCode: string) => Promise<boolean>;
  findRandomMatch: (gameType: "timed" | "score") => Promise<boolean>;
  addAIOpponent: () => Promise<void>;
  leaveRoom: () => Promise<void>;
  updateScore: (score: number) => Promise<void>;
  startGame: () => Promise<void>;
  endGame: (
    playerStats?: {
      userId: string;
      score: number;
      words: Array<{ word: string; score: number }>;
      isWinner: boolean;
    },
    opponentStats?: {
      userId: string;
      score: number;
      words: Array<{ word: string; score: number }>;
      isWinner: boolean;
    },
  ) => Promise<void>;
  updatePlayerStatistics: (
    userId: string,
    gameScore: number,
    words: Array<{ word: string; score: number }>,
    isWinner?: boolean,
  ) => Promise<void>;
  checkBadges: (userId: string, wordsCount?: number) => Promise<void>;
  isConnected: boolean;
}

interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, any> | null;
  old: Record<string, any> | null;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// SVG rozet ikonu - toast başlığında kupa emojisi yerine kullanılır
const BadgeIcon = () => (
  <img
    src="/icons/badge.svg"
    alt="rozet"
    style={{ width: 20, height: 20, display: "inline-block", verticalAlign: "middle", marginRight: 6 }}
  />
);

const BadgeToastTitle = () => (
  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <BadgeIcon />
    Yeni Rozet!
  </span>
);

const isValidParticipantPayload = (payload: any): payload is GameParticipantPayload => {
  return payload && typeof payload === "object";
};

// Katılımcıları tekilleştir - gerçek oyuncuları tekilleştir, bot fallback'i ayrı rakip olarak koru
const dedupeParticipants = (list: GameParticipant[], gameMode?: string): GameParticipant[] => {
  if (!Array.isArray(list)) return [];

  const usersMap = new Map<string, GameParticipant>();
  let botEntry: GameParticipant | null = null;

  for (const p of list) {
    if (p.is_bot) {
      // 🤖 Tüm modlarda (random-match fallback dahil) tek bot'a izin ver
      if (!botEntry) botEntry = p as GameParticipant;
      continue;
    }
    const key = p.user_id || "";
    if (key && !usersMap.has(key)) {
      usersMap.set(key, p as GameParticipant);
    }
  }

  const realUsers = Array.from(usersMap.values());

  // Random-match: 2 gerçek oyuncu varsa onları kullan; yoksa bot fallback'i rakip olarak koru
  if (gameMode?.startsWith("random-match")) {
    if (realUsers.length >= 2) return realUsers.slice(0, 2);
    if (realUsers.length === 1) return botEntry ? [realUsers[0], botEntry] : realUsers;
    return botEntry ? [botEntry] : [];
  }

  // Diğer modlar: Gerçek oyuncular + opsiyonel bot
  if (realUsers.length >= 2) return realUsers.slice(0, 2);
  if (realUsers.length === 1) return botEntry ? [realUsers[0], botEntry] : realUsers;
  return botEntry ? [botEntry] : [];
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};

interface GameProviderProps {
  children: ReactNode;
}

function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export const GameProvider = ({ children }: GameProviderProps) => {
  const { user } = useAuth();
  const { refreshProfile, isSystemConnected } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentRoom, setCurrentRoomState] = useState<GameRoom | null>(null);
  const [participants, setParticipants] = useState<GameParticipant[]>([]);
  const [lastOpponent, setLastOpponent] = useState<GameParticipant | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const isClosingRoomRef = useRef(false);
  const lastCountdownAtRef = useRef<string | null>(null);
  const hasRegisteredListenerRef = useRef(false);

  // 🆕 WRAPPER: setCurrentRoom çağrıldığında Native Storage'a da kaydet
  const setCurrentRoom = useCallback((room: GameRoom | null) => {
    setCurrentRoomState(room);
    // Native Storage'a kaydet
    setLastRoomId(room?.id || null);
    console.log("[GameContext] 💾 Room ID persisted:", room?.id?.slice(-8) || "null");
  }, []);

  // 🆕 isSystemConnected true olduğunda room'u geri yükle
  useEffect(() => {
    if (!isSystemConnected || !user) return;

    const path = window.location.pathname;
    const isActiveRoomRoute = path.includes("/game/") || path.startsWith("/private-room/waiting");
    if (isActiveRoomRoute) {
      console.log("[GameContext] 🚫 Aktif oda rotasında eski room restore atlandı");
      return;
    }

    const restoreRoom = async () => {
      console.log("[GameContext] 🔄 isSystemConnected true, room restore kontrolü...");

      // Eğer zaten aktif bir room varsa tekrar yükleme
      if (currentRoom) {
        console.log("[GameContext] ✓ Zaten aktif room var, skip");
        return;
      }

      try {
        const lastRoomId = await getLastRoomId();
        if (!lastRoomId) {
          console.log("[GameContext] 📭 Cached room ID yok");
          return;
        }

        // 🔒 KRİTİK: Banlist'te olan odayı geri yükleme (ASYNC!)
        const isBanned = await matchBanlist.has(lastRoomId);
        if (isBanned) {
          console.log("[GameContext] 🚫 Room banlist'te, geri yükleme atlanıyor:", lastRoomId.slice(-8));
          await setLastRoomId(null);
          return;
        }

        console.log("[GameContext] 📖 Cached room ID bulundu:", lastRoomId.slice(-8));

        // Room'u DB'den çek
        const { data: room, error } = await supabase.from("game_rooms").select("*").eq("id", lastRoomId).single();

        if (error || !room) {
          console.log("[GameContext] ⚠️ Room artık yok veya hata:", error?.message);
          await setLastRoomId(null);
          return;
        }

        // Eğer room bitmiş veya kapatılmışsa skip
        if (room.status === "finished" || room.status === "cancelled" || room.status === "completed") {
          console.log("[GameContext] ⚠️ Room bitmiş/iptal, temizleniyor");
          await setLastRoomId(null);
          return;
        }

        console.log("[GameContext] ✅ Room geri yüklendi:", room.id.slice(-8), room.status);
        setCurrentRoomState(room as GameRoom);

        // Participants'ları da çek
        const { data: parts } = await supabase
          .from("game_participants")
          .select("*, profiles:user_id(username, avatar_url, premium_until)")
          .eq("room_id", room.id);

        if (parts) {
          setParticipants(dedupeParticipants(parts as GameParticipant[], room.game_mode));
        }
      } catch (e) {
        console.error("[GameContext] Room restore hatası:", e);
      }
    };

    restoreRoom();
  }, [isSystemConnected, user, currentRoom]);

  // Native message listener kaldırıldı - Supabase JS SDK yeterli
  // Reload stratejisi tüm kanalları sıfırdan kuruyor

  // Generate random grid
  const generateRandomGrid = (): string[][] => {
    // Turkish letters with their frequency weights - NO W, Q, X EVER
    const letterPool = [
      "A",
      "A",
      "A",
      "A",
      "A",
      "A",
      "A",
      "A", // A - very common
      "E",
      "E",
      "E",
      "E",
      "E",
      "E",
      "E", // E - very common
      "İ",
      "İ",
      "İ",
      "İ",
      "İ",
      "İ", // İ - common
      "I",
      "I",
      "I",
      "I",
      "I", // I - common
      "O",
      "O",
      "O",
      "O",
      "O", // O - common
      "U",
      "U",
      "U",
      "U", // U - common
      "Ü",
      "Ü",
      "Ü", // Ü - common
      "Ö",
      "Ö",
      "Ö", // Ö - common
      "L",
      "L",
      "L",
      "L",
      "L", // L - common
      "N",
      "N",
      "N",
      "N",
      "N", // N - common
      "R",
      "R",
      "R",
      "R",
      "R", // R - common
      "K",
      "K",
      "K",
      "K", // K - common
      "M",
      "M",
      "M",
      "M", // M - common
      "T",
      "T",
      "T",
      "T", // T - common
      "S",
      "S",
      "S",
      "S", // S - common
      "D",
      "D",
      "D", // D - common
      "Y",
      "Y",
      "Y", // Y - common
      "B",
      "B",
      "B", // B - medium
      "C",
      "C", // C - medium
      "Ç",
      "Ç", // Ç - medium
      "F",
      "F", // F - medium
      "G",
      "G", // G - medium
      "Ğ",
      "Ğ", // Ğ - medium
      "H",
      "H", // H - medium
      "J", // J - rare
      "P",
      "P", // P - medium
      "Ş",
      "Ş", // Ş - medium
      "V",
      "V", // V - medium
      "Z", // Z - rare
    ];

    const grid: string[][] = [];
    for (let i = 0; i < 4; i++) {
      const row: string[] = [];
      for (let j = 0; j < 4; j++) {
        const randomIndex = Math.floor(Math.random() * letterPool.length);
        row.push(letterPool[randomIndex]);
      }
      grid.push(row);
    }
    return grid;
  };

  // Rematch fonksiyonları RematchContext'e taşındı

  // Helper function to determine game mode
  const getGameModeFromRoom = useCallback((room: GameRoom | null): string => {
    if (!room) return "unknown";
    return room.game_mode;
  }, []);

  // generateRoomCode fonksiyonunu ekle
  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Cleanup old rooms
  const cleanupOldRooms = useCallback(async () => {
    try {
      console.log("🧹 Cleanup başlıyor - BÜTÜN ESKİ ODALAR SİLİNECEK");

      // 10 dakika öncesi tüm odaları sil
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      const { data: deleted } = await supabase.from("game_rooms").delete().lt("created_at", tenMinutesAgo).select();

      console.log("🧹 Silinen oda sayısı:", deleted?.length || 0);
      console.log("🧹 Cleanup tamamlandı");
    } catch (error) {
      console.error("❌ Cleanup hatası:", error);
    }
  }, []);

  // Apply disconnect penalty with notifications using secure RPC
  const applyDisconnectPenalty = useCallback(
    async (userId: string, roomId: string) => {
      if (!userId || !roomId) {
        console.log("⚠️ applyDisconnectPenalty: userId veya room_id boş");
        return;
      }

      try {
        console.log("⚖️ ===== DISCONNECT PENALTY BAŞLADI =====");
        console.log("⚖️ Ceza uygulanacak oyuncu:", userId.slice(-8));
        console.log("⚖️ Room ID:", roomId.slice(-8));

        // Double check: Self-disconnect için uygulanabilir
        const isCurrentUser = userId === user?.id;
        console.log("⚖️ Current user'a ceza mi?", isCurrentUser);

        // Önce kullanıcı adını alalım
        const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).single();

        // Güvenli RPC fonksiyonunu kullan
        const { data: penaltyResult, error: rpcError } = await supabase.rpc("apply_disconnect_penalty", {
          p_offender_id: userId,
          p_room_id: roomId,
        });

        if (rpcError) {
          console.error("❌ RPC penalty error:", rpcError);
          return;
        }

        if (!penaltyResult || penaltyResult.length === 0) {
          console.error("❌ RPC returned no results");
          return;
        }

        const result = penaltyResult[0];

        if (!result.success) {
          console.log("⚠️ Penalty not applied - user not authorized or not found");
          return;
        }

        console.log("✅ ===== PENALTY APPLIED SUCCESSFULLY =====");
        console.log("⚖️ Ceza uygulandı:", {
          userId: userId.slice(-8),
          penaltyAmount: result.penalty,
          newScore: result.new_score,
          disconnectCount: result.new_disconnect_count,
          username: profile?.username,
        });

        // Notifications
        if (isCurrentUser) {
          // Kendine ceza mesajı
          toast({
            title: "⚖️ Ayrılma Cezası",
            description: `Oyundan ayrıldığınız için ${result.penalty} puan kaybettiniz`,
            variant: "destructive",
          });
        } else {
          // Rakip ayrıldı mesajı (kazanan için)
          toast({
            title: "🚪 Rakip Ayrıldı",
            description: `${profile?.username || "Rakip"} oyundan ayrıldı ve ${result.penalty} puan cezası aldı.`,
          });
        }
      } catch (error) {
        console.error("❌ ===== PENALTY APPLICATION FAILED =====");
        console.error("❌ Ceza uygulama hatası:", error);
      }
    },
    [toast, user?.id, currentRoom?.id],
  );

  // Apply win bonus
  const applyWinBonus = useCallback(async (userId: string | undefined, bonusAmount: number = 100) => {
    if (!userId) return;

    try {
      console.log("🏆 Kazanma bonusu veriliyor:", bonusAmount);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("total_score, win_count")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("❌ Profile fetch error:", error);
        return;
      }

      if (profile) {
        const currentScore = profile.total_score || 0;
        const winCount = (profile.win_count || 0) + 1;
        const newScore = currentScore + bonusAmount;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            total_score: newScore,
            win_count: winCount,
            last_win: new Date().toISOString(),
          })
          .eq("id", userId);

        if (updateError) {
          console.error("❌ Profile update error:", updateError);
          return;
        }

        console.log("🏆 Bonus verildi:", bonusAmount, "puan");
      }
    } catch (error) {
      console.error("❌ Bonus verme hatası:", error);
    }
  }, []);

  // Close full room - SADECE RPC çağır, real-time subscription countdown'u dispatch edecek
  const closeFullRoom = useCallback(async (roomId: string) => {
    try {
      if (isClosingRoomRef.current) {
        return;
      }
      isClosingRoomRef.current = true;

      console.log("🔒 Oda kapatılıyor (dolu):", String(roomId).slice(-8));

      // Odaya katılan gerçek oyuncuları sırayla al (ilk giren player1)
      const { data: realPlayers } = await supabase
        .from("game_participants")
        .select("user_id, joined_at")
        .eq("room_id", roomId)
        .eq("is_bot", false)
        .order("joined_at", { ascending: true } as any);

      const player1Id = realPlayers?.[0]?.user_id || null;
      const player2Id = realPlayers?.[1]?.user_id || null;

      // Player bilgilerini set et
      await supabase
        .from("game_rooms")
        .update({
          status: "active",
          player1_id: player1Id,
          player2_id: player2Id,
        })
        .eq("id", roomId);

      // 🎯 SERVER-SIDE COUNTDOWN başlat - Real-time subscription yakalayacak
      const { data: countdownTime, error: rpcError } = await supabase.rpc("start_game_countdown", {
        p_room_id: roomId,
      });

      if (rpcError) {
        console.error("❌ RPC countdown hatası:", rpcError);
      } else {
        console.log("✅ Server-side countdown başlatıldı:", countdownTime);
        // Real-time subscription countdown_started_at değişikliğini yakalayıp event dispatch edecek
      }

      console.log("✅ Oda kapatma işlemi tamamlandı (countdown real-time'dan gelecek)");
    } catch (error) {
      console.error("❌ Oda kapatma hatası:", error);
    } finally {
      isClosingRoomRef.current = false;
    }
  }, []);

  // Fetch participants - OPTIMIZED: basic info first, profiles async
  const fetchParticipants = useCallback(async (roomId: string) => {
    try {
      console.log("📥 Fetching participants for room:", String(roomId).slice(-8));

      // STEP 1: Fetch basic participant info immediately (no profiles)
      const { data: basicData, error } = await supabase.from("game_participants").select("*").eq("room_id", roomId);

      if (error) {
        console.error("❌ Participant fetch error:", error);
        return;
      }

      if (!basicData || basicData.length === 0) {
        console.log("⚠️ No participants found");
        return;
      }

      // Get game mode for deduplication
      const { data: roomData } = await supabase.from("game_rooms").select("game_mode").eq("id", roomId).single();
      const gameMode = roomData?.game_mode || "unknown";

      // STEP 2: Immediately set participants with basic info (enables countdown to start)
      const dedupedBasic = dedupeParticipants(basicData as GameParticipant[], gameMode);
      setParticipants(dedupedBasic);

      console.log("✅ Basic participants loaded:", {
        count: dedupedBasic.length,
        gameMode: gameMode,
      });

      // STEP 3: Async load profiles without blocking
      const userIds = basicData.map((p) => p.user_id).filter(Boolean);
      if (userIds.length > 0) {
        (async () => {
          try {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, username, avatar_url, premium_until")
              .in("id", userIds);

            if (profiles) {
              setParticipants((prev) => {
                const updated = prev.map((p) => ({
                  ...p,
                  profiles: profiles.find((prof) => prof.id === p.user_id) || (p as any).profiles || null,
                }));
                const dedupedUpdated = dedupeParticipants(updated as GameParticipant[], gameMode);

                console.log("✅ Profiles loaded:", {
                  details: dedupedUpdated.map((p) => ({
                    id: p.user_id?.slice(-8) || "null",
                    isBot: p.is_bot,
                    username: (p as any).profiles?.username || "No name",
                  })),
                });

                return dedupedUpdated;
              });
            }
          } catch (err) {
            console.error("⚠️ Profile fetch error (non-critical):", err);
          }
        })();
      }
    } catch (error) {
      console.error("❌ fetchParticipants error:", error);
    }
  }, []);

  // Create room
  const createRoom = useCallback(
    async (gameMode: string, roomCode?: string): Promise<GameRoom | null> => {
      if (!user) return null;

      // ✅ Önce önceki oda state'ini temizle
      console.log("🔄 Önceki oda state'i temizleniyor...");
      setCurrentRoom(null);
      setParticipants([]);

      const roomCodeToUse = roomCode || generateRoomCode();
      console.log("🏠 === ROOM CREATE DEBUG BAŞLADI ===");
      console.log("🏠 Game Mode:", gameMode);
      console.log("🏠 Room Code:", roomCodeToUse);
      console.log("🏠 User ID:", user.id.slice(-8));

      const grid = generateRandomGrid();
      const maxAttempts = 5;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const currentRoomCode = attempt === 1 ? roomCodeToUse : generateRoomCode();

        try {
          const { data: room, error } = await supabase
            .from("game_rooms")
            .insert({
              game_mode: gameMode,
              host_id: user.id,
              room_code: currentRoomCode,
              current_grid: grid.flat(),
              status: "waiting",
              max_score: gameMode.includes("score") ? 500 : 100,
              time_limit: gameMode.includes("timed") ? 120 : 0,
            })
            .select()
            .single();

          if (error) {
            if (error.code === "23505" && attempt < maxAttempts) {
              console.log(`🔄 Room code çakışması (deneme ${attempt}/${maxAttempts}), yeni kod denenecek`);
              continue;
            }
            throw error;
          }

          if (!room) throw new Error("Room creation failed");

          console.log("✅ Room created:", room.id.slice(-8));

          // Participant ekle
          const { data: participantData, error: participantError } = await supabase
            .from("game_participants")
            .insert({
              room_id: room.id,
              user_id: user.id,
              score: 0,
              is_bot: false,
            })
            .select()
            .single();

          if (participantError) {
            console.error("❌ Participant creation error:", participantError);
            throw participantError;
          }

          console.log("✅ Participant created:", participantData.id);
          setCurrentRoom(room);

          // Immediate fetch - no timeout needed with optimized fetch
          fetchParticipants(room.id);

          console.log("🏠 === ROOM CREATE DEBUG BİTTİ ===");
          return room;
        } catch (error: any) {
          console.error(`❌ Room creation error (attempt ${attempt}):`, error);
          if (attempt === maxAttempts) {
            console.error("❌ Final error creating room:", error);
            return null;
          }
        }
      }

      return null;
    },
    [user, toast, fetchParticipants],
  );

  // Join room
  const joinRoom = useCallback(
    async (roomCode: string): Promise<boolean> => {
      if (!user) return false;

      try {
        console.log("🔍 Özel oda aranıyor:", roomCode);

        // Önce ID ile ara (Nakama özel odaları için)
        let room = null;
        let roomError = null;

        const { data: roomById, error: errorById } = await supabase
          .from("game_rooms")
          .select("*")
          .eq("id", roomCode)
          .maybeSingle();

        if (roomById) {
          room = roomById;
          console.log("✅ Oda ID ile bulundu:", String(room.id).slice(-8), "Status:", room.status);
        } else {
          // ID ile bulunamazsa room_code ile ara
          const { data: roomByCode, error: errorByCode } = await supabase
            .from("game_rooms")
            .select("*")
            .eq("room_code", roomCode)
            .maybeSingle();

          room = roomByCode;
          roomError = errorByCode;

          if (room) {
            console.log("✅ Oda room_code ile bulundu:", String(room.id).slice(-8), "Status:", room.status);
          }
        }

        if (roomError || !room) {
          console.error("❌ Oda bulunamadı:", roomError);
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomCode);
          if (isUuid) {
            // Nakama match odası henüz Supabase'de görünmüyor olabilir; sessizce false dön
            return false;
          }
          toast({
            title: "Hata",
            description: "Oda bulunamadı veya dolu",
            variant: "destructive",
          });
          return false;
        }

        // ✅ Katılımcıları kontrol et
        const { data: participants, error: participantsError } = await supabase
          .from("game_participants")
          .select("user_id, is_bot")
          .eq("room_id", room.id);

        if (participantsError) {
          console.error("❌ Katılımcı kontrolü hatası:", participantsError);
          return false;
        }

        // Kullanıcı zaten katılmış mı? BUNU ÖNCE KONTROL ET
        const isAlreadyJoined = participants?.some((p) => p.user_id === user.id);
        if (isAlreadyJoined) {
          console.log("✅ Kullanıcı zaten katılmış, room state güncelleniyor");
          setCurrentRoom(room);
          await fetchParticipants(room.id);
          return true;
        }

        const realPlayerCount = participants?.filter((p) => !p.is_bot).length || 0;
        console.log("👥 Mevcut gerçek oyuncu sayısı:", realPlayerCount);

        // Rematch odaları için özel kontrol - private-room modunda max 2 kişi olabilir
        const isRematchRoom = room.game_mode.includes("private-room");

        if (realPlayerCount >= 2) {
          toast({
            title: "Hata",
            description: "Oda dolu",
            variant: "destructive",
          });
          return false;
        }

        // Rematch odalarında bile 1 kişi varsa ikinci kişi katılabilmeli
        if (!isRematchRoom && realPlayerCount >= 1) {
          // Normal odalar için 1 kişi varsa dolu sayılır
          // Ama rematch odaları için bu kontrol yapılmaz
        }

        // ✅ DÜZELTME: Odaya katıl ve HEMEN ardından fetch et
        const { error: joinError } = await supabase.from("game_participants").insert({
          room_id: room.id,
          user_id: user.id,
          score: 0,
          is_bot: false,
        });

        if (joinError) {
          // Eğer kullanıcı zaten katılmışsa (unique constraint), başarı olarak kabul et
          if ((joinError as any).code === "23505") {
            console.warn("⚠️ Zaten katılmış - duplicate insert göz ardı edildi");
          } else {
            console.error("❌ Odaya katılma hatası:", joinError);
            return false;
          }
        }

        console.log("✅ Odaya katılım başarılı");
        setCurrentRoom(room);

        // Immediate fetch before countdown
        await fetchParticipants(room.id);

        // Private room'da countdown burada BAŞLATILMAZ.
        // Hazır sistemi PrivateRoomWaitingPage üzerinden iki oyuncu da hazır olduktan sonra tetiklenir.
        if (room.game_mode.includes("private-room")) {
          toast({
            title: "Odaya Katıldınız",
            description: "Diğer oyuncu bekleniyor...",
          });
        }

        return true;
      } catch (error: any) {
        console.error("❌ Özel oda katılım hatası:", error);
        return false;
      }
    },
    [user, toast, fetchParticipants],
  );

  // Find random match - race condition prevention
  const findRandomMatch = useCallback(
    async (gameType: "timed" | "score"): Promise<boolean> => {
      if (!user) return false;

      try {
        console.log("🔍 ===== RASTGELE MATCHMAKING BAŞLADI =====");
        console.log("👤 User:", String(user.id).slice(-8));
        console.log("🎮 Type:", gameType);

        // DÜZELTME: Supabase query'sini düzelt - created_at kontrolünü kaldır
        const { data: waitingRooms, error } = await supabase
          .from("game_rooms")
          .select(
            `
        *,
        game_participants!inner(user_id, is_bot)
      `,
          )
          .eq("game_mode", "random-match")
          .eq("status", "waiting")
          .neq("host_id", user.id) // DÜZELTME: UUID format doğru
          .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString()); // Son 10 dakika

        if (error) {
          console.error("❌ Waiting rooms query hatası:", error);
          throw error;
        }

        console.log("🔍 Bulunan bekleyen odalar:", waitingRooms?.length || 0);

        // Filter rooms with exactly 1 real player and matching game type
        const availableRooms =
          waitingRooms?.filter((room) => {
            const realPlayers = room.game_participants?.filter((p) => !p.is_bot) || [];
            const gameTypeMatch = gameType === "timed" ? room.time_limit > 0 : room.max_score > 0;

            console.log(
              `🏠 Oda ${String(room.id).slice(-8)}: ${realPlayers.length} oyuncu, type: ${gameTypeMatch ? "uygun" : "uyumsuz"}, time_limit: ${room.time_limit}, max_score: ${room.max_score}`,
            );

            return realPlayers.length === 1 && gameTypeMatch;
          }) || [];

        console.log("✅ Uygun oda sayısı:", availableRooms.length);

        // Try to join first available room
        if (availableRooms.length > 0) {
          const targetRoom = availableRooms[0];
          console.log("🎯 Hedef oda:", String(targetRoom.id).slice(-8));

          try {
            // DÜZELTME: Önce mevcut katılımları kontrol et
            const { data: existingParticipant } = await supabase
              .from("game_participants")
              .select("id")
              .eq("room_id", targetRoom.id)
              .eq("user_id", user.id)
              .single();

            if (existingParticipant) {
              console.log("⚠️ Zaten bu odada katılımcısınız, oda güncelleniyor");
              setCurrentRoom(targetRoom);

              // Immediate fetch - no timeout
              await fetchParticipants(targetRoom.id);

              return true;
            }

            // Atomic insert - only one person succeeds
            const { error: joinError } = await supabase.from("game_participants").insert({
              room_id: targetRoom.id,
              user_id: user.id,
              score: 0,
              is_bot: false,
            });

            if (joinError) {
              // Probably someone else joined first
              console.log("⚠️ Katılma başarısız (başkası önce katıldı):", joinError.message);

              if (joinError.code === "23505") {
                console.log("🔄 Duplicate - başka oda deneniyor...");
                // Continue to create new room
              } else {
                throw joinError;
              }
            } else {
              // Successful join!
              console.log("✅ BAŞARILI EŞLEŞME!");

              // 🎯 SERVER-SIDE COUNTDOWN başlat (2. oyuncu join olduğunda)
              try {
                const { data: countdownTime, error: rpcError } = await supabase.rpc("start_game_countdown", {
                  p_room_id: targetRoom.id,
                });

                if (rpcError) {
                  console.warn("⚠️ RPC countdown hatası:", rpcError);
                } else {
                  console.log("✅ Matchmaking countdown başlatıldı:", countdownTime);
                }
              } catch (countdownError) {
                console.error("❌ Countdown başlatma hatası:", countdownError);
              }

              // ✅ ÖNEMLI: Oda zaten bir ızgara var, onu kullan
              setCurrentRoom(targetRoom);

              // Immediate fetch before countdown
              await fetchParticipants(targetRoom.id);

              return true;
            }
          } catch (error) {
            console.error("❌ Katılma hatası:", error);
          }
        }

        // Create new room if no available room or join failed
        console.log("🆕 Yeni oda açılıyor...");

        const grid = generateRandomGrid();
        const { data: newRoom, error: roomError } = await supabase
          .from("game_rooms")
          .insert({
            game_mode: "random-match",
            host_id: user.id,
            current_grid: grid.flat(),
            status: "waiting",
            max_score: gameType === "score" ? 500 : 0,
            time_limit: gameType === "timed" ? 120 : 0,
          })
          .select()
          .single();

        if (roomError) throw roomError;

        // Add self to room as participant (host can play too)
        const { error: participantError } = await supabase.from("game_participants").insert({
          room_id: newRoom.id,
          user_id: user.id,
          score: 0,
          is_bot: false,
        });

        if (participantError) {
          console.error("❌ Katılımcı ekleme hatası:", participantError);
          throw participantError;
        }

        setCurrentRoom(newRoom);

        // Immediate fetch - no timeout
        fetchParticipants(newRoom.id);

        console.log("🆕 Yeni oda oluşturuldu:", String(newRoom.id).slice(-8));
        console.log("👤 Host kendini katılımcı olarak ekledi:", String(user.id).slice(-8));
        console.log("🔍 ===== MATCHMAKING BİTTİ (BEKLEMEDE) =====");

        toast({
          title: "🔍 Rakip Aranıyor...",
          description: "Oyuncular aranıyor, bekleyiniz...",
          duration: 3000,
        });

        return false; // Waiting
      } catch (error) {
        console.error("🚨 Matchmaking hatası:", error);
        toast({
          title: "Eşleşme Hatası",
          description: "Rakip bulunurken hata oluştu. Tekrar deneyin.",
          variant: "destructive",
        });
        return false;
      }
    },
    [user, toast],
  );

  // Add AI opponent to current room
  const addAIOpponent = useCallback(async (): Promise<void> => {
    if (!currentRoom) return;

    try {
      console.log("🤖 AI rakip ekleniyor...");

      // Önce mevcut AI kontrolü
      const { data: existingAI } = await supabase
        .from("game_participants")
        .select("id")
        .eq("room_id", currentRoom.id)
        .eq("is_bot", true)
        .limit(1)
        .single();

      if (existingAI) {
        console.log("⚠️ AI zaten mevcut");
        return;
      }

      await supabase.from("game_participants").insert({
        room_id: currentRoom.id,
        user_id: null,
        score: 0,
        is_bot: true,
      });

      console.log("🤖 AI rakip başarıyla eklendi");
    } catch (error) {
      console.error("❌ AI rakip ekleme hatası:", error);
    }
  }, [currentRoom]);

  // Leave room
  const leaveRoom = useCallback(async (): Promise<void> => {
    if (!currentRoom || !user) return;

    try {
      console.log("🚪 Oyundan çıkış işlemi başlıyor");

      const gameMode = getGameModeFromRoom(currentRoom);
      console.log("🎮 Game mode:", gameMode);

      // Oyun aktif mi kontrol et
      const isActiveGame = currentRoom.status === "active";
      console.log("🎯 Aktif oyun mu?", isActiveGame);

      if (isActiveGame && gameMode === "private") {
        // Aktif özel oyundan ayrılma - ceza uygula
        console.log("💀 Aktif özel oyundan ayrılma - ceza uygulanıyor");
        await applyDisconnectPenalty(user.id, currentRoom.id);

        toast({
          title: "⚠️ Oyun Cezası",
          description: "Aktif oyundan ayrıldığınız için -25 puan cezası aldınız.",
          variant: "destructive",
          duration: 4000,
        });
      } else if (isActiveGame && gameMode?.includes("tournament")) {
        // Turnuva oyunundan ayrılma - özel işlem gerekiyor
        console.log("🏆 Turnuva oyunundan ayrılma - bot ekleniyor");

        // Turnuva maçında ayrılma cezası
        await applyDisconnectPenalty(user.id, currentRoom.id);

        // Oyunu sonlandır - rakip kazanır
        await supabase
          .from("game_rooms")
          .update({
            status: "finished",
            winner_id: currentRoom.player1_id === user.id ? currentRoom.player2_id : currentRoom.player1_id,
            finished_at: new Date().toISOString(),
          })
          .eq("id", currentRoom.id);
      }

      // 🔧 SAFE ROOM EXIT: room_id kontrolü
      if (!currentRoom?.id) {
        console.warn("⚠️ [leaveRoom] room_id undefined, participant silme atlanıyor");
        return;
      }

      // Participant'ı sil
      const { error: deleteError } = await supabase
        .from("game_participants")
        .delete()
        .eq("room_id", currentRoom.id)
        .eq("user_id", user.id);

      if (deleteError) {
        console.error("❌ Participant silme hatası:", deleteError);
      } else {
        console.log("✅ Participant silindi");
      }

      // Normal oyun için room kontrolü
      if (gameMode !== "tournament") {
        // Room durumunu kontrol et ve gerekirse sil
        const { data: remainingParticipants } = await supabase
          .from("game_participants")
          .select("user_id, is_bot")
          .eq("room_id", currentRoom.id);

        const realPlayers = remainingParticipants?.filter((p) => !p.is_bot) || [];

        // Eğer gerçek oyuncu kalmadıysa odayı sil
        if (realPlayers.length === 0) {
          console.log("🗑️ Gerçek oyuncu kalmadı, oda siliniyor");
          await supabase.from("game_rooms").delete().eq("id", currentRoom.id);
        }
      }

      // Odayı banlist'e ekle (tekrar bağlanmayı önle)
      if (currentRoom?.id) {
        matchBanlist.add(currentRoom.id);
        console.log("🚫 Oda banlist'e eklendi:", String(currentRoom.id).slice(-8));
      }

      // Matchmaking state'ini temizle
      window.dispatchEvent(new CustomEvent("cleanupMatchmaking"));

      // State temizle - RoomAutoNavigator'ın yönlendirmesini engellemek için hemen temizle
      setCurrentRoom(null);
      setParticipants([]);
      setLastOpponent(null);

      console.log("✅ Oyundan çıkış tamamlandı - state cleared");
    } catch (error) {
      console.error("❌ Oyundan çıkış hatası:", error);
      // Hata olsa bile state'i temizle
      setCurrentRoom(null);
      setParticipants([]);
      setLastOpponent(null);

      toast({
        title: "Hata",
        description: "Oyundan çıkış sırasında bir hata oluştu",
        variant: "destructive",
      });
    }
  }, [currentRoom, user, applyDisconnectPenalty, toast, getGameModeFromRoom]);

  // Update score
  const updateScore = useCallback(
    async (score: number): Promise<void> => {
      if (!user || !currentRoom) return;

      try {
        // Skoru tek RPC ile yaz: server odadaki gerçek oyuncuyu bulur ve sadece kendi kolonunu günceller.
        const { data: updatedRoom, error } = await supabase.rpc(
          "submit_room_score" as never,
          {
            p_room_id: currentRoom.id,
            p_score: score,
          } as never,
        );

        if (error) {
          console.error("❌ submit_room_score hatası:", error);
          // Fallback: RPC hata verirse en azından kendi participant skorunu güncelle.
          await supabase
            .from("game_participants")
            .update({ score })
            .eq("room_id", currentRoom.id)
            .eq("user_id", user.id);
        } else if (updatedRoom) {
          setCurrentRoom(updatedRoom as GameRoom);
        }

        // Local state'i de güncelle - FUNCTIONAL UPDATE (race condition fix)
        setParticipants((prevParticipants) =>
          prevParticipants.map((p) => (p.user_id === user.id ? { ...p, score: Math.max(p.score || 0, score) } : p)),
        );

        console.log("🔄 Skor RPC ile güncellendi:", score);
      } catch (error) {
        console.error("Error updating score:", error);
      }
    },
    [user, currentRoom, setCurrentRoom],
  );

  // Start game
  const startGame = useCallback(async (): Promise<void> => {
    if (!currentRoom) return;

    try {
      const startTime = new Date().toISOString();

      const { data, error } = await supabase
        .from("game_rooms")
        .update({
          status: "active",
          started_at: startTime,
        })
        .eq("id", currentRoom.id)
        .select()
        .single();

      if (error) {
        console.error("❌ Oyun başlatma hatası:", error);
        return;
      }

      console.log("✅ Oyun başlatıldı, server time:", startTime);

      // Current room'u güncelle ki started_at client'da da olsun
      setCurrentRoom(data);
    } catch (error) {
      console.error("Error starting game:", error);
    }
  }, [currentRoom]);

  // Update game statistics for a player - NOW HANDLED BY DATABASE TRIGGERS
  const updatePlayerStatistics = useCallback(
    async (
      userId: string,
      gameScore: number,
      words: Array<{ word: string; score: number }>,
      isWinner: boolean = false,
    ) => {
      // Statistics are now automatically handled by database triggers
      // when game room status is updated to 'finished'
      console.log("📊 Istatistikler artık database trigger ile otomatik güncelleniyor");
    },
    [],
  );

  // Check and award badges for a user
  const checkBadges = useCallback(
    async (userId: string, wordsCount?: number) => {
      try {
        console.log("🏆 Rozet kontrolü yapılıyor:", userId);

        // General badge check - Type assertion ile düzelt
        const { data: generalBadges, error: generalError } = await supabase.rpc("check_and_award_badges", {
          p_user_id: userId,
        });

        if (generalError) {
          console.error("❌ Genel rozet kontrolü hatası:", generalError);
        } else if (generalBadges && Array.isArray(generalBadges) && generalBadges.length > 0) {
          // Type assertion: generalBadges as any[]
          (generalBadges as any[]).forEach((badge: any) => {
            toast({
              title: (<BadgeToastTitle />) as any,
              description: `"${badge.new_badge_name}" rozetini kazandınız! ${badge.new_badge_icon}`,
              duration: 4000,
            });
          });
        }

        // Words per game badge check
        if (wordsCount && wordsCount > 0) {
          const { data: wordsBadges, error: wordsError } = await supabase.rpc("check_words_per_game_badge", {
            p_user_id: userId,
            p_words_count: wordsCount,
          });

          if (wordsError) {
            console.error("❌ Kelime rozeti kontrolü hatası:", wordsError);
          } else if (wordsBadges && Array.isArray(wordsBadges) && wordsBadges.length > 0) {
            // Type assertion: wordsBadges as any[]
            (wordsBadges as any[]).forEach((badge: any) => {
              toast({
                title: (<BadgeToastTitle />) as any,
                description: `"${badge.new_badge_name}" rozetini kazandınız! ${badge.new_badge_icon}`,
                duration: 4000,
              });
            });
          }
        }

        console.log("✅ Rozet kontrolü tamamlandı");
      } catch (error) {
        console.error("❌ Rozet kontrolü hatası:", error);
      }
    },
    [toast],
  );

  // End game
  // End game fonksiyonunda, room'u finished olarak işaretledikten SONRA ekle
  const endGame = useCallback(
    async (
      playerStats?: {
        userId: string;
        score: number;
        words: Array<{ word: string; score: number }>;
        isWinner: boolean;
      },
      opponentStats?: {
        userId: string;
        score: number;
        words: Array<{ word: string; score: number }>;
        isWinner: boolean;
      },
    ): Promise<void> => {
      if (!currentRoom) return;

      try {
        console.log("🏁 Oyun bitiyor - room güncelleniyor:", String(currentRoom.id).slice(-8));

        // Calculate game duration
        const gameDuration = currentRoom.started_at
          ? Math.floor((Date.now() - new Date(currentRoom.started_at).getTime()) / 1000)
          : 0;

        // Determine winner and add words to game_words table
        let winnerId: string | null = null;
        let player1Id: string | null = null;
        let player2Id: string | null = null;
        let player1Score = 0;
        let player2Score = 0;

        if (playerStats) {
          if (participants.some((p) => p.user_id === playerStats.userId)) {
            player1Id = playerStats.userId;
            player1Score = playerStats.score;
            if (playerStats.isWinner) winnerId = playerStats.userId;

            // Add player's words to game_words table
            for (const word of playerStats.words) {
              await supabase.from("game_words").insert({
                room_id: currentRoom.id,
                player_id: playerStats.userId,
                word: word.word,
                points: word.score,
              });
            }
          }
        }

        if (opponentStats && !participants.find((p) => p.user_id === opponentStats.userId && p.is_bot)) {
          player2Id = opponentStats.userId;
          player2Score = opponentStats.score;
          if (opponentStats.isWinner) winnerId = opponentStats.userId;

          // Add opponent's words to game_words table
          for (const word of opponentStats.words) {
            await supabase.from("game_words").insert({
              room_id: currentRoom.id,
              player_id: opponentStats.userId,
              word: word.word,
              points: word.score,
            });
          }
        }

        // Update room with final status
        await supabase
          .from("game_rooms")
          .update({
            status: "finished",
            finished_at: new Date().toISOString(),
            winner_id: winnerId,
            player1_id: player1Id,
            player2_id: player2Id,
            player1_score: player1Score,
            player2_score: player2Score,
          })
          .eq("id", currentRoom.id);

        console.log("✅ Room updated with game completion");

        // 🎯 YENİ: OYUN KAYITLARINI game_sessions TABLOSUNA EKLE
        if (playerStats) {
          const { error: sessionError } = await supabase.from("game_sessions").insert({
            user_id: playerStats.userId,
            score: playerStats.score,
            words_count: playerStats.words.length,
            game_duration: gameDuration,
            is_winner: playerStats.isWinner,
            game_mode: currentRoom.game_mode,
          });

          if (sessionError) {
            console.error("❌ Player game session kayıt hatası:", sessionError);
          } else {
            console.log("✅ Player game session kaydedildi:", playerStats.userId.slice(-8));
          }
        }

        // ⚠️ Rakip için game session kaydı YAPMA - RLS ihlali!
        // Her oyuncu kendi client'ından kendi session'ını kaydeder
        if (opponentStats && !participants.find((p) => p.user_id === opponentStats.userId && p.is_bot)) {
          console.log("ℹ️ Opponent will save their own session:", opponentStats.userId.slice(-8));
        }

        // Wait a moment for triggers to process
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check for new badges after database triggers complete
        if (playerStats) {
          await checkBadges(playerStats.userId, playerStats.words.length);
          if (playerStats.userId === user?.id) {
            refreshProfile();
          }
        }
        if (opponentStats && !participants.find((p) => p.user_id === opponentStats.userId && p.is_bot)) {
          await checkBadges(opponentStats.userId, opponentStats.words.length);
          if (opponentStats.userId === user?.id) {
            refreshProfile();
          }
        }

        // Clean up room after a delay
        setTimeout(async () => {
          try {
            await supabase.from("game_rooms").delete().eq("id", currentRoom.id);
            console.log("✅ Room cleaned up after stats processing");
          } catch (error) {
            console.error("❌ Room cleanup error:", error);
          }
        }, 2000);

        // Son rakip bilgisini sakla (rematch için)
        const opponent = participants.find((p) => !p.is_bot && p.user_id !== user?.id);
        if (opponent) {
          setLastOpponent(opponent);
        }

        setCurrentRoom(null);
        setParticipants([]);
        console.log("✅ Oyun bitti, game_sessions tablosuna kaydedildi");
      } catch (error) {
        console.error("❌ End game hatası:", error);
      }
    },
    [currentRoom, participants, checkBadges, user?.id, refreshProfile],
  );

  // Check if room is full and close it
  useEffect(() => {
    if (!currentRoom || currentRoom.status !== "waiting") return;

    const realPlayers = participants.filter((p) => !p.is_bot);
    const hasBot = participants.some((p) => p.is_bot);
    console.log("🔍 Oda kontrolü - Gerçek oyuncu sayısı:", realPlayers.length);

    // Oda kapanma kriteri: 2 gerçek oyuncu YA DA 1 gerçek oyuncu + 1 bot (AI)
    if (realPlayers.length >= 2 || (hasBot && realPlayers.length >= 1)) {
      console.log("🔒 Oda dolu (AI dahil), kapatılıyor...");
      closeFullRoom(currentRoom.id);
    }
  }, [participants, currentRoom, closeFullRoom]);

  // 🎯 ROOM UPDATE SUBSCRIPTION - KALDIRILDI
  // Countdown logic tamamen GamePage.tsx'te yönetiliyor
  // Bu subscription duplicate countdown'a neden oluyordu

  // 🔒 REF: Presence handler için güncel room state'i sakla (closure sorunu çözümü)
  const currentRoomRef = useRef<GameRoom | null>(null);
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  // 🎯 OPTIMIZED Real-time subscriptions with RealtimeManager + Presence
  useEffect(() => {
    if (!currentRoom || !user) {
      setIsConnected(false);
      return;
    }

    if (!currentRoom.id) {
      console.warn("⚠️ Room ID eksik, real-time kurulumu atlandı");
      setIsConnected(false);
      return;
    }

    console.log("🔗 Setting up optimized real-time for room:", String(currentRoom.id).slice(-8));
    setIsConnected(true);
    const pendingTimers: NodeJS.Timeout[] = [];

    // 🔒 Subscription için room ID'yi capture et (rematch sonrası değişebilir)
    const subscriptionRoomId = currentRoom.id;

    // Participants'ı fetch et
    const fetchParticipantsLocal = async (roomId: string) => {
      try {
        if (!roomId) {
          console.warn("⚠️ fetchParticipantsLocal çağrıldı ama roomId yok");
          return;
        }
        const { data, error } = await supabase
          .from("game_participants")
          .select(
            `
          *,
          profiles:user_id (username, avatar_url, premium_until)
        `,
          )
          .eq("room_id", roomId);

        if (error) {
          console.error("❌ Participant fetch error:", error);
          return;
        }

        if (data) {
          setParticipants(data as GameParticipant[]);
          console.log("✅ Participants güncellendi:", data.length);
        }
      } catch (error) {
        console.error("❌ fetchParticipants error:", error);
      }
    };

    fetchParticipantsLocal(subscriptionRoomId);

    const presenceGraceUntil = Date.now() + 2000;

    // ✅ PRESENCE CHANNEL (RealtimeManager ile merkezi yönetim)
    const presenceChannel = realtimeManager.createPresenceChannel(subscriptionRoomId, user.id, user.id)!;

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        console.log("🔄 Presence sync:", state);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("👋 Player joined:", key, newPresences);
      })
      .on("presence", { event: "leave" }, async ({ key }) => {
        console.log("🚪 Presence leave event:", key, "for room:", subscriptionRoomId.slice(-8));

        // 🔒 CRITICAL FIX: REF'ten güncel state'i al (closure sorunu çözümü)
        const freshRoom = currentRoomRef.current;
        const currentRoomId = freshRoom?.id;
        const currentRoomStatus = freshRoom?.status;
        const currentUserId = user?.id;

        // 🔒 REMATCH GUARD: Bu subscription farklı bir room için mi?
        if (currentRoomId !== subscriptionRoomId) {
          console.log("🔄 Room değişti (rematch?), eski subscription'dan leave event ignore ediliyor", {
            subscriptionRoom: subscriptionRoomId.slice(-8),
            currentRoom: currentRoomId?.slice(-8),
          });
          return;
        }

        if (!currentRoomId || !currentUserId) {
          console.log("⚠️ Room veya user bilgisi yok, ignore ediliyor");
          return;
        }

        // Grace period kontrolü
        if (Date.now() < presenceGraceUntil) {
          console.log("⏳ Grace period - ignoring presence leave");
          return;
        }

        // ⚠️ SADECE AKTİF OYUNLARDA ve RAKİP AYRILDIYSA
        if (currentRoomStatus === "active" && key !== currentUserId) {
          console.log("⏱️ Rakip bağlantı kopması kontrolü başlıyor...");

          // 3 saniye bekle, belki geri gelir
          setTimeout(async () => {
            try {
              // 🔒 REMATCH GUARD: 3 saniye sonra da kontrol et - oda değişmiş olabilir
              const latestRoom = currentRoomRef.current;
              if (latestRoom?.id !== subscriptionRoomId) {
                console.log("🔄 Room değişti (rematch?), eski disconnect kontrolü iptal", {
                  subscriptionRoom: subscriptionRoomId.slice(-8),
                  latestRoom: latestRoom?.id?.slice(-8),
                });
                return;
              }

              // ⚠️ ÖNEMLİ: Oda state'ini DB'den TEKRAR kontrol et
              const { data: freshRoomData, error: roomError } = await supabase
                .from("game_rooms")
                .select("status, game_mode, player1_id, player2_id")
                .eq("id", currentRoomId)
                .single();

              if (roomError || !freshRoomData) {
                console.error("❌ Oda bilgisi alınamadı:", roomError);
                return;
              }

              // Oda artık aktif değilse işlem yapma
              if (freshRoomData.status !== "active") {
                console.log("🔄 Oda artık aktif değil, ignore ediliyor");
                return;
              }

              // Presence state'ini kontrol et - belki geri geldi
              const state = presenceChannel.presenceState() as Record<string, Array<{ user_id?: string }>>;
              const otherPlayers = Object.values(state)
                .flat()
                .filter((p: any) => p.user_id && p.user_id !== currentUserId);

              // DB'den participant kontrolü
              const { data: participants, error: partsError } = await supabase
                .from("game_participants")
                .select("user_id, is_bot")
                .eq("room_id", currentRoomId)
                .eq("is_bot", false);

              if (partsError) {
                console.error("❌ Katılımcı bilgisi alınamadı:", partsError);
                return;
              }

              const realPlayerCount = participants?.length || 0;
              const isOpponentStillGone = otherPlayers.length === 0;

              console.log("🔍 Disconnect kontrolü:", {
                roomStatus: freshRoomData.status,
                otherPlayersCount: otherPlayers.length,
                realPlayerCount,
                isOpponentStillGone,
              });

              // ⚠️ KRİTİK KOŞUL: Rakip gerçekten gitti mi?
              // NOT: realPlayerCount kontrolü kaldırıldı çünkü DB'de participant silinmiyor,
              // sadece presence kanalından ayrılıyor. isOpponentStillGone yeterli.
              const shouldTriggerDisconnect = freshRoomData.status === "active" && isOpponentStillGone;

              if (shouldTriggerDisconnect) {
                console.log("🏆 Rakip gerçekten gitti - kazandınız!");

                // 1. Disconnect penalty uygula
                if (typeof key === "string") {
                  console.log("⚖️ Disconnect penalty uygulanıyor:", key.slice(-8));
                  await applyDisconnectPenalty(key, currentRoomId);
                }

                // 2. Bonus puan ver (rakip koparsa 200 puan)
                if (applyWinBonus && currentUserId) {
                  await applyWinBonus(currentUserId, 200);
                }

                // 3. Odayı finished yap ama STATE'İ SIFIRLAMA!
                const { error: updateError } = await supabase
                  .from("game_rooms")
                  .update({
                    status: "finished",
                    winner_id: currentUserId,
                    finished_at: new Date().toISOString(),
                  })
                  .eq("id", currentRoomId);

                if (updateError) {
                  console.error("❌ Oda güncelleme hatası:", updateError);
                  return;
                }

                // 4. Sadece bildirim göster, OYUNU KİLİTLEME!
                toast({
                  title: "🏆 Kazandınız!",
                  description: "Rakip bağlantısı koptu. +200 puan!",
                  duration: 4000,
                });

                // 5. Event gönder ki oyun component'i kendi handle etsin
                window.dispatchEvent(
                  new CustomEvent("opponentDisconnected", {
                    detail: {
                      roomId: currentRoomId,
                      winnerId: currentUserId,
                    },
                  }),
                );

                console.log("✅ Rakip disconnect başarıyla handle edildi");
              } else {
                console.log("🔄 Rakip geri geldi veya durum değişti, ignore ediliyor");
              }
            } catch (error) {
              console.error("❌ Presence leave kontrol hatası:", error);
            }
          }, 3000); // 3 saniye bekle
        } else {
          console.log("🔄 Aktif oyun değil veya kendin ayrıldın, ignore ediliyor");
        }
      })
      .subscribe(async (status) => {
        console.log("📡 Presence subscription status:", status);
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ user_id: user.id, room_id: currentRoom.id });
          console.log("✅ Presence tracked for room:", String(currentRoom.id).slice(-8));
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Presence channel error for room:", String(currentRoom.id).slice(-8));
        }
      });

    // ✅ PARTICIPANTS SUBSCRIPTION (RealtimeManager ile optimize)
    const participantsChannel = realtimeManager.subscribe(
      "game_participants",
      user.id,
      `room_id=eq.${currentRoom.id}`,
      async (payload: any) => {
        console.log("🔡 Participant event:", payload.eventType);

        // UPDATE: Anında skor güncellemesi (profile bilgileri korunuyor)
        if (payload.eventType === "UPDATE" && isValidParticipantPayload(payload.new)) {
          const updatedParticipant = payload.new as GameParticipantPayload;

          console.log("🔄 Participant UPDATE payload:", {
            user_id: updatedParticipant.user_id?.slice(-8),
            score: (updatedParticipant as any).score,
          });

          if (updatedParticipant.user_id) {
            const newScore = (updatedParticipant as any).score;
            if (typeof newScore === "number") {
              setParticipants((prevParticipants) =>
                prevParticipants.map((p) => {
                  if (p.user_id === updatedParticipant.user_id) {
                    // 🛡️ KRITIK: Profile bilgilerini koru, sadece score'u güncelle
                    return {
                      ...p,
                      score: newScore,
                      // profiles bilgisini koru (kaybolmasın!)
                      profiles: p.profiles || (updatedParticipant as any).profiles,
                    };
                  }
                  return p;
                }),
              );
              console.log(
                "✅ Participant score updated (profile preserved):",
                updatedParticipant.user_id?.slice(-8),
                "new score:",
                newScore,
              );
            } else {
              console.warn("⚠️ Score field missing or invalid in UPDATE payload");
            }
          }
        }

        // INSERT: Yeni participant eklendi - Profile bilgileriyle birlikte fetch et
        if (payload.eventType === "INSERT" && isValidParticipantPayload(payload.new)) {
          const newParticipant = payload.new as GameParticipantPayload;

          console.log("👤 Yeni participant eklendi, profil bilgisi çekiliyor...", newParticipant.user_id?.slice(-8));

          // 🔄 OPTIMIZATION: Önce participant'ı profil olmadan ekle (hızlı)
          if (newParticipant.user_id) {
            setParticipants((prev) => {
              // Duplicate check
              if (prev.some((p) => p.user_id === newParticipant.user_id)) {
                return prev;
              }
              console.log("✅ Participant hızlı eklendi (profil yükleniyor...):", newParticipant.user_id?.slice(-8));
              return [...prev, { ...newParticipant, profiles: null } as GameParticipant];
            });

            // Profil bilgilerini async yükle (non-blocking)
            (async () => {
              try {
                const { data: profile } = await supabase
                  .from("profiles")
                  .select("id, username, avatar_url, premium_until")
                  .eq("id", newParticipant.user_id)
                  .maybeSingle();

                if (profile) {
                  setParticipants((prev) =>
                    prev.map((p) => (p.user_id === newParticipant.user_id ? { ...p, profiles: profile } : p)),
                  );
                  console.log("✅ Participant profil bilgisi güncellendi:", profile.username);
                }
              } catch (error) {
                console.error("❌ Participant profil fetch hatası:", error);
              }
            })();
          }

          // ❌ fetchParticipantsLocal KALDIRILDI - optimistic update yeterli
          // Gereksiz refetch titreme yapıyordu

          // Rakip katıldı bildirimi
          if (!newParticipant.is_bot && newParticipant.user_id && newParticipant.user_id !== user?.id) {
            const gameMode = getGameModeFromRoom(currentRoom);

            if (gameMode?.startsWith("random-match")) {
              toast({
                title: "🎯 Eşleşme Tamamlandı!",
                description: "Rakip bulundu, oyun başlıyor...",
                duration: 1000,
              });
            }
          }
        }

        // DELETE: Participant silindi + Disconnect handling
        if (payload.eventType === "DELETE" && isValidParticipantPayload(payload.old)) {
          await fetchParticipantsLocal(subscriptionRoomId);

          const oldParticipant = payload.old as GameParticipantPayload;

          // 🔒 REMATCH GUARD: Güncel room'u ref'ten al
          const latestRoom = currentRoomRef.current;
          const latestGameMode = latestRoom ? getGameModeFromRoom(latestRoom) : null;

          if (
            !oldParticipant.is_bot &&
            oldParticipant.user_id &&
            oldParticipant.user_id !== user?.id &&
            latestRoom?.status === "active" &&
            latestRoom?.id === subscriptionRoomId && // 🔒 REMATCH GUARD
            latestGameMode !== "vs-computer"
          ) {
            console.log("⏳ DELETE event alındı, 2sn sonra doğrulanacak...");

            const eventRoomId = subscriptionRoomId;
            const winnerUserId = user?.id || null;

            const tId = setTimeout(async () => {
              try {
                // 🔒 REMATCH GUARD: 2 saniye sonra da kontrol et
                const currentLatestRoom = currentRoomRef.current;
                if (currentLatestRoom?.id !== subscriptionRoomId) {
                  console.log("🔄 Room değişti (rematch?), DELETE disconnect kontrolü iptal");
                  return;
                }

                const { data: roomState } = await supabase
                  .from("game_rooms")
                  .select("status")
                  .eq("id", eventRoomId)
                  .single();

                if (roomState?.status !== "active") return;

                const { data: participantRow } = await supabase
                  .from("game_participants")
                  .select("id")
                  .eq("room_id", eventRoomId)
                  .eq("user_id", oldParticipant.user_id)
                  .maybeSingle();

                const state = presenceChannel.presenceState() as Record<string, Array<{ user_id?: string }>>;
                const reAppearedInPresence = Object.values(state)
                  .flat()
                  .some((p: any) => p?.user_id === oldParticipant.user_id);

                if (participantRow || reAppearedInPresence) {
                  console.log("✅ Oyuncu geri döndü, disconnect yok sayıldı");
                  return;
                }

                console.log("🏆 Doğrulanmış disconnect");

                window.dispatchEvent(
                  new CustomEvent("playerDisconnected", {
                    detail: {
                      winner: "player",
                      reason: "opponent_left",
                      roomId: eventRoomId,
                    },
                  }),
                );

                // 🔒 Güncel room bilgisini ref'ten al
                const activeRoom = currentRoomRef.current;
                const gameMode = activeRoom ? getGameModeFromRoom(activeRoom) : null;

                if (gameMode?.includes("tournament")) {
                  // Turnuva maçında rakip ayrılırsa oyuncuya +500 bonus puan ver ve devam etmesine izin ver
                  const bonusScore = 500;

                  // Mevcut skora +500 ekle
                  const currentScore =
                    activeRoom?.player1_id === winnerUserId
                      ? activeRoom?.player1_score || 0
                      : activeRoom?.player2_score || 0;

                  await supabase
                    .from("game_rooms")
                    .update({
                      // Oyunu bitirme, sadece skoru güncelle
                      ...(activeRoom?.player1_id === winnerUserId
                        ? { player1_score: currentScore + bonusScore }
                        : { player2_score: currentScore + bonusScore }),
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", eventRoomId);

                  toast({
                    title: "⚠️ Rakip Ayrıldı",
                    description: "Rakip oyundan ayrıldı veya bağlantısı koptu. Size +500 puan verildi.",
                    duration: 5000,
                  });

                  // Bonus puanı profile'a da ekle
                  if (winnerUserId) {
                    await supabase
                      .from("profiles")
                      .update({
                        total_score:
                          (activeRoom?.player1_id === winnerUserId
                            ? activeRoom?.player1_score
                            : activeRoom?.player2_score) + bonusScore,
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", winnerUserId);
                  }
                } else {
                  // Diğer oyun modlarında oyunu bitir
                  await applyDisconnectPenalty(oldParticipant.user_id, eventRoomId);

                  if (winnerUserId) {
                    await applyWinBonus(winnerUserId);
                    toast({
                      title: "🏆 Kazandınız!",
                      description: "Rakip oyundan ayrıldı. +100 bonus puan!",
                      duration: 4000,
                    });
                  }

                  await supabase
                    .from("game_rooms")
                    .update({
                      status: "finished",
                      winner_id: winnerUserId,
                      finished_at: new Date().toISOString(),
                    })
                    .eq("id", eventRoomId);
                }
              } catch (err) {
                console.error("❌ DELETE doğrulama hatası:", err);
              }
            }, 2000);

            pendingTimers.push(tId);
          }
        }
      },
    );

    // ✅ ROOM UPDATES SUBSCRIPTION (RealtimeManager ile)
    const roomChannel = realtimeManager.subscribe("game_rooms", user.id, `id=eq.${subscriptionRoomId}`, (payload) => {
      const newRoom = payload.new as GameRoom;
      if (!newRoom?.id) return;
      console.log("🏠 Room güncelleme:", newRoom);

      // 🎯 Countdown event - fire only when value changes (avoid stale-closure issue)
      if (newRoom.countdown_started_at && lastCountdownAtRef.current !== newRoom.countdown_started_at) {
        console.log("⏰ Countdown başlatıldı (real-time):", newRoom.countdown_started_at);
        lastCountdownAtRef.current = newRoom.countdown_started_at;
        window.dispatchEvent(
          new CustomEvent("countdownStarted", {
            detail: { serverTime: newRoom.countdown_started_at },
          }),
        );
      }

      // Do not dispatch 'playerDisconnected' on normal finish; handled by result flow instead.

      setCurrentRoom(newRoom);

      // Skor için game_rooms'u yedek gerçek kaynak olarak kullan.
      // Bazı cihazlarda game_participants UPDATE event'i kaçarsa rakip skorunun 0'da kalmasını engeller.
      setParticipants((prev) =>
        prev.map((participant) => {
          if (participant.user_id === newRoom.player1_id && typeof newRoom.player1_score === "number") {
            return { ...participant, score: Math.max(participant.score || 0, newRoom.player1_score || 0) };
          }
          if (participant.user_id === newRoom.player2_id && typeof newRoom.player2_score === "number") {
            return { ...participant, score: Math.max(participant.score || 0, newRoom.player2_score || 0) };
          }
          return participant;
        }),
      );
    });

    console.log("🔧 Real-time subscriptions active (RealtimeManager + Presence)");

    // 🆕 TARGETED CLEANUP: Oda değiştiğinde ESKİ odanın kanallarını temizle
    return () => {
      console.log("🔌 Real-time cleanup - ESKİ oda kanalları temizleniyor:", subscriptionRoomId.slice(-8));
      // Reset countdown guard for next room/game
      lastCountdownAtRef.current = null;

      // ✅ RealtimeManager tüm kanalları (presence dahil) temizler
      if (user?.id) {
        realtimeManager.cleanupRoom(subscriptionRoomId, user.id);
      }

      // Clear timers
      pendingTimers.forEach((t) => clearTimeout(t));
    };
  }, [
    currentRoom?.id,
    currentRoom?.status,
    user?.id,
    toast,
    applyDisconnectPenalty,
    applyWinBonus,
    getGameModeFromRoom,
  ]);

  // 🎯 Rematch listener removed - now handled by GlobalRematchListener in App.tsx

  // ❌ PRIVATE ROOM POLLING KALDIRILDI - Realtime subscription yeterli

  // Handle page close/refresh cleanup
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // 🔥 TAMAMEN DEVİRE DIŞI - Real-time listener ile yönetilecek
      console.log("🚪 Page unload detected, but handling via real-time listeners only");

      // Sadece manual cleanup, ceza yok
      if (currentRoom && user) {
        console.log("🧹 Manual cleanup on page close");
      }
    };

    // 🔥 ŞİMDİLİK DEVRE DIŞI - beforeunload listener'ı kaldır
    // window.addEventListener('beforeunload', handleBeforeUnload);

    // ✅ Uygulama kapatılırken kanalları temizle
    return () => {
      console.log("🧹 GameContext cleanup - kanallar temizleniyor");
      if (user?.id) {
        realtimeManager.forceCleanupAll();
      }
    };
  }, [currentRoom?.id, user?.id]);

  // Initialize cleanup on mount
  useEffect(() => {
    cleanupOldRooms();
  }, [cleanupOldRooms]);

  // isSystemConnected değiştiğinde mevcut oda ve katılımcı verilerini yenile
  useEffect(() => {
    if (!isSystemConnected || !currentRoom?.id || !user?.id) return;

    console.log("🔄 [GameContext] isSystemConnected true - oda ve katılımcılar yeniden yükleniyor...");

    // Mevcut odayı yeniden fetch et
    (async () => {
      try {
        const { data: roomData } = await supabase.from("game_rooms").select("*").eq("id", currentRoom.id).maybeSingle();

        if (roomData) {
          setCurrentRoom(roomData as GameRoom);
        }

        // Katılımcıları yeniden fetch et
        const { data: parts } = await supabase
          .from("game_participants")
          .select("*, profiles:user_id(id, username, avatar_url, premium_until)")
          .eq("room_id", currentRoom.id);

        if (parts) {
          const deduped = dedupeParticipants(parts as any, roomData?.game_mode);
          setParticipants(deduped);
        }

        console.log("✅ [GameContext] Oda ve katılımcılar yenilendi");
      } catch (error) {
        console.error("❌ [GameContext] Yenileme hatası:", error);
      }
    })();
  }, [isSystemConnected, currentRoom?.id, user?.id]);

  return (
    <GameContext.Provider
      value={{
        currentRoom,
        participants,
        lastOpponent,
        createRoom,
        joinRoom,
        findRandomMatch,
        addAIOpponent,
        leaveRoom,
        updateScore,
        startGame,
        endGame,
        updatePlayerStatistics,
        checkBadges,
        isConnected,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
