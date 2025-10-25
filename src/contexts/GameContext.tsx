import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
// removed sonner toast import (using shadcn use-toast)
import { useAuth } from "./AuthContext";
import { useUser } from "./UserContext";
import { useToast } from "@/hooks/use-toast";
import { useNakamaMatchmaking } from "@/hooks/useNakamaMatchmaking";
import { useNavigate } from "react-router-dom";
import { realtimeManager } from "@/utils/realtimeManager";
import { matchBanlist } from "@/utils/matchBanlist";
import { Button } from "@/components/ui/button";

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
  };
}

interface RematchRequest {
  id: string;
  room_code: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "rejected";
  game_type: "timed" | "score";
  created_at?: string;
  responded_at?: string;
}

interface GameContextType {
  currentRoom: GameRoom | null;
  participants: GameParticipant[];
  lastOpponent: GameParticipant | null;
  createRoom: (gameMode: string, roomCode?: string) => Promise<GameRoom | null>;
  sendRematchRequest: (roomCode: string, gameType: "timed" | "score") => Promise<void>;
  respondRematchRequest: (requestId: string, accepted: boolean) => Promise<void>;
  currentRematchRequest: RematchRequest | null;
  setCurrentRematchRequest: (request: RematchRequest | null) => void; // BU SATIRI EKLEYİN
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
  useNakama: boolean;
  toggleNakama: () => void;
}

interface RealtimePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, any> | null;
  old: Record<string, any> | null;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const isValidParticipantPayload = (payload: any): payload is GameParticipantPayload => {
  return payload && typeof payload === "object";
};

// Katılımcıları tekilleştir - Random-match'te sadece gerçek oyuncular, diğer modlarda bot+oyuncu
const dedupeParticipants = (list: GameParticipant[], gameMode?: string): GameParticipant[] => {
  if (!Array.isArray(list)) return [];

  const usersMap = new Map<string, GameParticipant>();
  let botEntry: GameParticipant | null = null;

  for (const p of list) {
    if (p.is_bot) {
      // Random-match'te bot'a izin verme
      if (gameMode?.startsWith("random-match")) continue;
      // Diğer modlarda sadece tek bot'a izin ver
      if (!botEntry) botEntry = p as GameParticipant;
      continue;
    }
    const key = p.user_id || "";
    if (key && !usersMap.has(key)) {
      usersMap.set(key, p as GameParticipant);
    }
  }

  const realUsers = Array.from(usersMap.values());

  // Random-match: Sadece gerçek oyuncular (max 2)
  if (gameMode?.startsWith("random-match")) return realUsers.slice(0, 2);

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
  const { refreshProfile } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentRoom, setCurrentRoom] = useState<GameRoom | null>(null);
  const [participants, setParticipants] = useState<GameParticipant[]>([]);
  const [lastOpponent, setLastOpponent] = useState<GameParticipant | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [useNakama, setUseNakama] = useState(false);
  const [currentRematchRequest, setCurrentRematchRequest] = useState<RematchRequest | null>(null);

  const isClosingRoomRef = useRef(false);
  const lastCountdownAtRef = useRef<string | null>(null);

  const toggleNakama = () => {
    setUseNakama(!useNakama);
  };

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

  const sendRematchRequest = useCallback(
    async (_roomCode: string, gameType: "timed" | "score") => {
      if (!user) {
        console.error("❌ User bulunamadı");
        throw new Error("Kullanıcı bulunamadı");
      }

      console.log("🔔 sendRematchRequest çağrıldı:", {
        roomCode: _roomCode,
        gameType,
        userId: String(user.id).slice(-8),
        participantCount: participants.length,
        participants: participants.map((p) => ({
          userId: p.user_id?.slice(-8),
          isBot: p.is_bot,
        })),
      });

      // Rakip bul: Önce aktif participants, yoksa lastOpponent, o da yoksa currentRoom player alanları
      let opponent = participants.find((p) => !p.is_bot && p.user_id !== user.id);
      if (!opponent && lastOpponent) {
        console.log("⚠️ Participants'ta rakip yok, lastOpponent kullanılıyor");
        opponent = lastOpponent;
      }
      if (!opponent && currentRoom) {
        const candidate = currentRoom.player1_id === user.id ? currentRoom.player2_id : currentRoom.player1_id;
        if (candidate) {
          console.log("🧭 Fallback: currentRoom üzerinden rakip bulundu");
          opponent = { id: '', room_id: currentRoom.id, user_id: candidate, score: 0, is_bot: false, joined_at: '' } as any;
        }
      }

      if (!opponent || !opponent.user_id) {
        console.error("❌ Rakip bulunamadı!", {
          participantsLength: participants.length,
          hasLastOpponent: !!lastOpponent,
        });
        throw new Error("Rakip bulunamadı");
      }

      console.log("🔄 Tekrar oyun isteği gönderiliyor:", {
        from: String(user.id).slice(-8),
        to: String(opponent.user_id || "").slice(-8),
        gameType,
        currentMode: currentRoom?.game_mode,
      });

      try {
        // Her rematch için yeni ve boş bir oda oluştur
        const code = generateRoomCode();

        // Mevcut moddan base mode'u al (private-room veya random-match)
        const baseMode = currentRoom?.game_mode?.includes("random-match") ? "random-match" : "private-room";
        const mode = `${baseMode}-${gameType}`;

        // Rastgele grid üret
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
        const grid: string[][] = [];
        for (let i = 0; i < 4; i++) {
          const row: string[] = [];
          for (let j = 0; j < 4; j++) {
            const randomIndex = Math.floor(Math.random() * letterPool.length);
            row.push(letterPool[randomIndex]);
          }
          grid.push(row);
        }

        const { data: room, error: roomError } = await supabase
          .from("game_rooms")
          .insert({
            game_mode: mode,
            host_id: user.id,
            room_code: code,
            current_grid: grid.flat(),
            status: "waiting",
            max_score: gameType === "score" ? 500 : 100,
            time_limit: gameType === "timed" ? 120 : 0,
          })
          .select()
          .single();

        if (roomError || !room) throw roomError;

        // Kendini participant olarak ekle
        const { error: participantError } = await supabase.from("game_participants").insert({
          room_id: room.id,
          user_id: user.id,
          score: 0,
          is_bot: false,
        });

        if (participantError) throw participantError;

        // State güncelle
        setCurrentRoom(room);

        // Participants'ı hemen çek
        try {
          const { data: parts } = await supabase
            .from("game_participants")
            .select(`*, profiles:user_id (username, avatar_url)`)
            .eq("room_id", room.id);
          if (parts) setParticipants(parts as any);
        } catch {}

        console.log("📤 Rematch request DB'ye yazılıyor:", {
          room_code: code,
          from_user_id: String(user.id).slice(-8),
          to_user_id: String(opponent.user_id || "").slice(-8),
          game_type: gameType,
        });

        // Eski pending rematch isteklerini kapat (iki yönlü)
        try {
          await supabase
            .from("rematch_requests")
            .update({ status: "rejected", responded_at: new Date().toISOString() })
            .eq("from_user_id", user.id)
            .eq("to_user_id", opponent.user_id)
            .eq("status", "pending");
          await supabase
            .from("rematch_requests")
            .update({ status: "rejected", responded_at: new Date().toISOString() })
            .eq("from_user_id", opponent.user_id)
            .eq("to_user_id", user.id)
            .eq("status", "pending");
        } catch (e) {
          console.warn("⚠️ Önceki rematch istekleri kapatılamadı (devam ediliyor)", e);
        }

        // Rematch request kaydı oluştur
        const { data, error } = await supabase
          .from("rematch_requests")
          .insert({
            room_code: code,
            from_user_id: user.id,
            to_user_id: opponent.user_id,
            status: "pending",
            game_type: gameType,
          })
          .select()
          .single();

        if (error) {
          console.error("❌ Rematch request insert hatası:", error);
          throw error;
        }

        console.log("✅ Rematch request başarıyla oluşturuldu:", {
          requestId: data.id,
          room: code,
          mode: mode,
          from: String(user.id).slice(-8),
          to: String(opponent.user_id || "").slice(-8),
        });

        // Rematch bildirimi özelliği kaldırıldı

        toast({
          title: "🔄 Tekrar Oyun İsteği Gönderildi",
          description: "Rakibinizin yanıtını bekliyoruz...",
          duration: 3000,
        });
      } catch (error) {
        console.error("❌ Tekrar oyun isteği hatası:", error);
        throw error;
      }
    },
    [user, participants, lastOpponent, currentRoom, toast, setCurrentRoom],
  );

  const respondRematchRequest = useCallback(
    async (requestId: string, accepted: boolean) => {
      if (!user) return;

      try {
        console.log("📝 Rematch yanıtı veriliyor:", { requestId, accepted });

        // İstek detaylarını al
        const { data: request } = await supabase.from("rematch_requests").select("*").eq("id", requestId).single();

        if (!request) {
          console.error("❌ Rematch request bulunamadı");
          return;
        }

        const { error } = await supabase
          .from("rematch_requests")
          .update({
            status: accepted ? "accepted" : "rejected",
            responded_at: new Date().toISOString(),
          })
          .eq("id", requestId)
          .eq("to_user_id", user.id);

        if (error) throw error;

        console.log("✅ Tekrar oyun isteğine yanıt verildi:", accepted);

        if (accepted) {
          // Mevcut rematch odasına gir ve o sayfayı açmadan önce güvenli şekilde katılımı garantile
          if (!request.room_code) {
            console.error('❌ Rematch request room_code eksik');
            toast({ title: 'Hata', description: 'Rematch odası bulunamadı', variant: 'destructive' });
            return;
          }
          console.log('🎮 Rematch kabul edildi, mevcut oda açılıyor', {
            roomCode: request.room_code,
            gameType: request.game_type,
          });

          // Oda ID'sini room_code üzerinden bul
          const { data: roomRow } = await supabase
            .from('game_rooms')
            .select('id, game_mode')
            .eq('room_code', request.room_code)
            .maybeSingle();

          if (!roomRow?.id) {
            toast({ title: 'Hata', description: 'Oda bulunamadı', variant: 'destructive' });
            return;
          }

          // Katılımcı olarak ekli değilsek ekle (yeni eşleşme gibi davran)
          try {
            const { data: existing } = await supabase
              .from('game_participants')
              .select('id')
              .eq('room_id', roomRow.id)
              .eq('user_id', user.id)
              .maybeSingle();

            if (!existing) {
              await supabase.from('game_participants').insert({
                room_id: roomRow.id,
                user_id: user.id,
                score: 0,
                is_bot: false,
              });
            }
          } catch (e) {
            console.warn('Katılımcı ekleme sırasında uyarı:', e);
          }

          // Önce bekleme sayfasına yönlendir; iki oyuncu hazır olunca oyun sayfasına geçer
          const type = roomRow?.game_mode?.includes('score') ? 'score' : 'timed';
          setTimeout(() =>
            navigate(`/private-room-waiting?code=${request.room_code}&roomId=${roomRow.id}&gameType=${type}`),
          0);
        }

        setCurrentRematchRequest(null);
      } catch (error) {
        console.error("❌ Tekrar oyun yanıt hatası:", error);
        toast({
          title: "Hata",
          description: "Rematch işlemi başarısız",
          variant: "destructive",
        });
      }
    },
    [user, setCurrentRematchRequest, navigate, setCurrentRoom, setParticipants, toast],
  );

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

        if (!result.applied) {
          console.log("⚠️ Penalty not applied - user not authorized or not found");
          return;
        }

        console.log("✅ ===== PENALTY APPLIED SUCCESSFULLY =====");
        console.log("⚖️ Ceza uygulandı:", {
          userId: userId.slice(-8),
          penaltyAmount: result.penalty,
          newScore: result.new_score,
          disconnectCount: result.disconnect_count,
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

  // Close full room
  const closeFullRoom = useCallback(async (roomId: string) => {
    try {
      if (isClosingRoomRef.current) {
        return;
      }
      isClosingRoomRef.current = true;

      console.log("🔒 Oda kapatılıyor (dolu):", String(roomId).slice(-8));

      const startedAt = new Date().toISOString();

      // Odaya katılan gerçek oyuncuları sırayla al (ilk giren player1)
      const { data: realPlayers } = await supabase
        .from("game_participants")
        .select("user_id, joined_at")
        .eq("room_id", roomId)
        .eq("is_bot", false)
        .order("joined_at", { ascending: true } as any);

      const player1Id = realPlayers?.[0]?.user_id || null;
      const player2Id = realPlayers?.[1]?.user_id || null;

      // 🎯 SERVER-SIDE COUNTDOWN başlat
      const { data: countdownTime, error: rpcError } = await supabase.rpc("start_game_countdown", {
        p_room_id: roomId,
      });

      const serverTime = rpcError ? startedAt : countdownTime;

      if (rpcError) {
        console.warn("⚠️ RPC countdown hatası, fallback kullanılıyor:", rpcError);
        // Fallback: Manuel DB update
        await supabase
          .from("game_rooms")
          .update({
            status: "active",
            countdown_started_at: startedAt,
            player1_id: player1Id,
            player2_id: player2Id,
          })
          .eq("id", roomId)
          .is("countdown_started_at", null);
      } else {
        console.log("✅ Server-side countdown başlatıldı:", countdownTime);
        await supabase
          .from("game_rooms")
          .update({
            status: "active",
            player1_id: player1Id,
            player2_id: player2Id,
          })
          .eq("id", roomId)
          .is("countdown_started_at", null);
      }

      // 🎯 KRITIK: Lokal state'i HEMEN güncelle + countdown zamanını set et
      setCurrentRoom((prev) => {
        if (!prev || prev.id !== roomId) return prev;
        return {
          ...prev,
          status: "active",
          countdown_started_at: serverTime,
          player1_id: player1Id,
          player2_id: player2Id,
        } as GameRoom;
      });

      console.log("✅ Oda kapatıldı ve countdown başlatıldı");
    } catch (error) {
      console.error("❌ Oda kapatma hatası:", error);
    } finally {
      isClosingRoomRef.current = false;
    }
  }, []);

  // Fetch participants
  const fetchParticipants = useCallback(
    debounce(async (roomId: string) => {
      try {
        console.log("📥 Fetching participants for room:", String(roomId).slice(-8));

        const { data, error } = await supabase
          .from("game_participants")
          .select(
            `
          *,
          profiles:user_id (username, avatar_url)
        `,
          )
          .eq("room_id", roomId);

        if (error) {
          console.error("❌ Participant fetch error:", error);
          return;
        }

        if (data) {
          // RoomId'den game mode'u al ve buna göre dedupe et
          const { data: roomData } = await supabase.from("game_rooms").select("game_mode").eq("id", roomId).single();

          const gameMode = roomData?.game_mode || "unknown";
          const dedupedData = dedupeParticipants(data as GameParticipant[], gameMode);

          console.log("✅ Participants güncellenecek:", {
            count: dedupedData.length,
            gameMode: gameMode,
            details: dedupedData.map((p) => ({
              id: p.user_id?.slice(-8) || "null",
              isBot: p.is_bot,
              username: (p as any).profiles?.username || "No name",
            })),
          });

          setParticipants(dedupedData);
        }
      } catch (error) {
        console.error("❌ fetchParticipants error:", error);
      }
    }, 300), // 300ms debounce
    [],
  );

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

          // Hemen participants fetch et
          setTimeout(() => {
            fetchParticipants(room.id);
          }, 300);

          // Only show room created notification for private rooms (avoid random-match spam)
          if (gameMode.startsWith("private-room")) {
            toast({
              title: "Oda Oluşturuldu",
              description: `Oda kodu: ${currentRoomCode}`,
              duration: 1000,
            });
          }

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
          .in("status", ["waiting", "active"])
          .maybeSingle();

        if (roomById) {
          room = roomById;
          console.log("✅ Oda ID ile bulundu:", String(room.id).slice(-8));
        } else {
          // ID ile bulunamazsa room_code ile ara
          const { data: roomByCode, error: errorByCode } = await supabase
            .from("game_rooms")
            .select("*")
            .eq("room_code", roomCode)
            .in("status", ["waiting", "active"])
            .maybeSingle();

          room = roomByCode;
          roomError = errorByCode;

          if (room) {
            console.log("✅ Oda room_code ile bulundu:", String(room.id).slice(-8));
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

        // 🎯 PRIVATE ROOM İÇİN COUNTDOWN BAŞLATMA
        // Eğer ikinci oyuncu join olduysa countdown başlat
        if (room.game_mode.includes("private-room")) {
          const { data: participantCount } = await supabase
            .from("game_participants")
            .select("id", { count: "exact" })
            .eq("room_id", room.id)
            .eq("is_bot", false);

          const playerCount = participantCount?.length || 0;
          console.log("👥 Private room oyuncu sayısı:", playerCount);

          if (playerCount >= 2) {
            // İkinci oyuncu join oldu, countdown'ı güvenli şekilde başlat (RPC olmadan)
            try {
              await closeFullRoom(room.id);
            } catch (countdownError) {
              console.error("❌ Countdown başlatma hatası:", countdownError);
            }
          } else {
            toast({
              title: "Odaya Katıldınız",
              description: "Diğer oyuncu bekleniyor...",
            });
          }
        }

        // ✅ ÖNEMLI: Hemen participants'ı fetch et
        setTimeout(() => {
          fetchParticipants(room.id);
        }, 500);

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

              // ✅ RASTGELE OYUN FIX: HEMEN participants'ı fetch et
              setTimeout(() => {
                console.log("🔄 RASTGELE OYUN: Participants fetch ediliyor...");
                fetchParticipants(targetRoom.id);
              }, 200);

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

              // ✅ RASTGELE OYUN FIX: HEMEN participants'ı fetch et
              setTimeout(() => {
                console.log("🔄 RASTGELE OYUN: Katılım sonrası participants fetch ediliyor...");
                fetchParticipants(targetRoom.id);
              }, 300);

              toast({
                title: "🎯 Eşleşme Bulundu!",
                description: `${gameType === "timed" ? "Zamana karşı" : "Puanlı"} rakip bulundu!`,
                duration: 2000,
              });

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

        // ✅ RASTGELE OYUN FIX: Host olarak oda oluşturduktan sonra participants'ı fetch et
        setTimeout(() => {
          console.log("🔄 RASTGELE OYUN: Host oda oluşturma sonrası participants fetch ediliyor...");
          fetchParticipants(newRoom.id);
        }, 500);

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
      } else if (isActiveGame && gameMode === "tournament") {
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

        toast({
          title: "🏆 Turnuva Cezası",
          description: "Turnuva maçından ayrıldığınız için -50 puan cezası aldınız.",
          variant: "destructive",
          duration: 4000,
        });
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

      // State temizle
      setCurrentRoom(null);
      setParticipants([]);

      console.log("✅ Oyundan çıkış tamamlandı");
    } catch (error) {
      console.error("❌ Oyundan çıkış hatası:", error);
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
        // Game participants tablosunu güncelle
        await supabase.from("game_participants").update({ score }).eq("room_id", currentRoom.id).eq("user_id", user.id);

        // 🔥 YENİ: Game rooms skorlarını DA güncelle (yalnızca eşleşme atandıysa)
        const isP1 = currentRoom.player1_id === user.id;
        const isP2 = currentRoom.player2_id === user.id;
        if (isP1 || isP2) {
          const scoreField = isP1 ? "player1_score" : "player2_score";
          await supabase
            .from("game_rooms")
            .update({
              [scoreField]: score,
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentRoom.id);
        } else {
          console.log("ℹ️ Skor sadece participants tablosunda güncellendi (player1/2 eşleşmesi daha atanmadı).");
        }

        // Local state'i de güncelle
        const updatedParticipants = participants.map((p) => (p.user_id === user.id ? { ...p, score } : p));
        setParticipants(updatedParticipants);

        const fieldLabel = isP1 ? "player1_score" : isP2 ? "player2_score" : "participants_only";
        console.log("🔄 Skor güncellendi:", score, "Field:", fieldLabel);
      } catch (error) {
        console.error("Error updating score:", error);
      }
    },
    [user, currentRoom],
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
              title: "🏆 Yeni Rozet!",
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
                title: "🏆 Yeni Rozet!",
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

        // Use database function to update game stats (only for non-trigger flows if needed)
        // Rely primarily on game_rooms 'finished' triggers to avoid double increments
        if (playerStats) {
          // No-op: triggers will handle stats to prevent duplication
        }

        if (opponentStats && !participants.find((p) => p.user_id === opponentStats.userId && p.is_bot)) {
          // No-op: triggers will handle stats to prevent duplication
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

        console.log("✅ Room updated with game completion - triggers will handle stats");

        // Wait a moment for triggers to process
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check for new badges after database triggers complete
        if (playerStats) {
          await checkBadges(playerStats.userId, playerStats.words.length);
          // Refresh user profile to update stats in UI
          if (playerStats.userId === user?.id) {
            // Trigger immediate profile refresh for real-time updates
            refreshProfile();
          }
        }
        if (opponentStats && !participants.find((p) => p.user_id === opponentStats.userId && p.is_bot)) {
          await checkBadges(opponentStats.userId, opponentStats.words.length);
          // Refresh user profile to update stats in UI
          if (opponentStats.userId === user?.id) {
            // Trigger immediate profile refresh for real-time updates
            refreshProfile();
          }
        }

        // Clean up room after a delay to allow triggers to complete
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
        console.log("✅ Oyun bitti, istatistikler database trigger ile güncellendi");
      } catch (error) {
        console.error("❌ End game hatası:", error);
      }
    },
    [currentRoom, participants, checkBadges],
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

  // 🎯 OPTIMIZED Real-time subscriptions with RealtimeManager + Presence
  useEffect(() => {
    if (!currentRoom || !user) {
      setIsConnected(false);
      return;
    }

    if (!currentRoom.id) {
      console.warn('⚠️ Room ID eksik, real-time kurulumu atlandı');
      setIsConnected(false);
      return;
    }

    console.log("🔗 Setting up optimized real-time for room:", String(currentRoom.id).slice(-8));
    setIsConnected(true);
    // Init countdown guard with current room state to avoid duplicate dispatches
    lastCountdownAtRef.current = currentRoom.countdown_started_at ?? null;
    const pendingTimers: NodeJS.Timeout[] = [];

    // Participants'ı fetch et
    const fetchParticipantsLocal = async (roomId: string) => {
      try {
        if (!roomId) {
          console.warn('⚠️ fetchParticipantsLocal çağrıldı ama roomId yok');
          return;
        }
        const { data, error } = await supabase
          .from("game_participants")
          .select(
            `
          *,
          profiles:user_id (username, avatar_url)
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

    fetchParticipantsLocal(currentRoom.id);

    const currentGameMode = getGameModeFromRoom(currentRoom);
    const presenceGraceUntil = Date.now() + 2000;

    // ✅ PRESENCE CHANNEL (ayrı, tek instance - duplicate önleme)
    const presenceChannel = supabase
      .channel(`presence-${currentRoom.id}`, {
        config: {
          presence: {
            key: user.id, // ✅ Sadece user.id (user-${user.id} değil)
          },
        },
      })
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        console.log("🔄 Presence sync:", state);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("👋 Player joined:", key, newPresences);
      })
      .on("presence", { event: "leave" }, async ({ key }) => {
        console.log("🚪 Presence leave event:", key);

        if (Date.now() < presenceGraceUntil) {
          console.log("⏳ Grace period - ignoring presence leave");
          return;
        }

        if (currentRoom.status === "active" && key !== user?.id) {
          console.log("⏱️ Bağlantı kopması kontrolü başlıyor, 3 saniye bekleniyor...");

          setTimeout(async () => {
            const state = presenceChannel.presenceState() as Record<string, Array<{ user_id?: string }>>;
            const otherPlayers = Object.values(state)
              .flat()
              .filter((p: any) => p.user_id && p.user_id !== user?.id);

            const { count: realCount } = await supabase
              .from("game_participants")
              .select("user_id", { count: "exact", head: true } as any)
              .eq("room_id", currentRoom.id)
              .eq("is_bot", false);

            if (currentRoom.status === "active" && (otherPlayers.length === 0 || (realCount ?? 0) <= 1)) {
              console.log("🏆 Gerçek rakip yok - kazandın! (presence+DB doğrulandı)");

              if (typeof key === "string") {
                console.log("⚖️ Disconnect penalty uygulanıyor. Offender:", key.slice(-8));
                await applyDisconnectPenalty(key, currentRoom.id);
              }

              if (applyWinBonus && user?.id) {
                await applyWinBonus(user?.id, 50);
              }

              toast({
                title: "🏆 Kazandınız!",
                description: "Rakip bağlantısı koptu. +50 puan!",
                duration: 4000,
              });

              await supabase
                .from("game_rooms")
                .update({
                  status: "finished",
                  winner_id: user?.id || null,
                  finished_at: new Date().toISOString(),
                })
                .eq("id", currentRoom.id);

              window.dispatchEvent(
                new CustomEvent("playerDisconnected", {
                  detail: { winner: "player", reason: "connection_lost", roomId: currentRoom.id },
                }),
              );
            }
          }, 3000);
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
          
          console.log('🔄 Participant UPDATE payload:', {
            user_id: updatedParticipant.user_id?.slice(-8),
            score: (updatedParticipant as any).score,
          });

          if (updatedParticipant.user_id) {
            const newScore = (updatedParticipant as any).score;
            if (typeof newScore === 'number') {
              setParticipants((prevParticipants) =>
                prevParticipants.map((p) => {
                  if (p.user_id === updatedParticipant.user_id) {
                    // 🛡️ KRITIK: Profile bilgilerini koru, sadece score'u güncelle
                    return { 
                      ...p, 
                      score: newScore,
                      // profiles bilgisini koru (kaybolmasın!)
                      profiles: p.profiles || (updatedParticipant as any).profiles
                    };
                  }
                  return p;
                }),
              );
              console.log('✅ Participant score updated (profile preserved):', updatedParticipant.user_id?.slice(-8), 'new score:', newScore);
            } else {
              console.warn('⚠️ Score field missing or invalid in UPDATE payload');
            }
          }
        }

        // INSERT: Yeni participant eklendi - Profile bilgileriyle birlikte fetch et
        if (payload.eventType === "INSERT" && isValidParticipantPayload(payload.new)) {
          const newParticipant = payload.new as GameParticipantPayload;

          console.log("👤 Yeni participant eklendi, profil bilgisi çekiliyor...", newParticipant.user_id?.slice(-8));

          // 🔄 Profil bilgileriyle birlikte participant'ı fetch et
          if (newParticipant.user_id) {
            try {
              const { data: participantWithProfile } = await supabase
                .from("game_participants")
                .select(`
                  *,
                  profiles!inner(username, avatar_url)
                `)
                .eq("room_id", currentRoom.id)
                .eq("user_id", newParticipant.user_id)
                .single();

              if (participantWithProfile) {
                setParticipants((prev) => {
                  // Duplicate check
                  if (prev.some((p) => p.user_id === newParticipant.user_id)) {
                    return prev;
                  }
                  console.log("✅ Participant profil bilgileriyle eklendi:", participantWithProfile.profiles?.username);
                  return [...prev, participantWithProfile as GameParticipant];
                });
              }
            } catch (error) {
              console.error("❌ Participant profil fetch hatası:", error);
              // Fallback: Profil bilgisi olmadan ekle
              setParticipants((prev) => {
                if (prev.some((p) => p.user_id === newParticipant.user_id)) {
                  return prev;
                }
                return [...prev, newParticipant as GameParticipant];
              });
            }
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
                duration: 2000,
              });
            } else {
              toast({
                title: "🎉 Oyuncu Katıldı!",
                description: "İkinci oyuncu odaya katıldı, oyun başlıyor...",
                duration: 2000,
              });
            }
          }
        }

        // DELETE: Participant silindi + Disconnect handling
        if (payload.eventType === "DELETE" && isValidParticipantPayload(payload.old)) {
          await fetchParticipantsLocal(currentRoom.id);

          const oldParticipant = payload.old as GameParticipantPayload;

          if (
            !oldParticipant.is_bot &&
            oldParticipant.user_id &&
            oldParticipant.user_id !== user?.id &&
            currentRoom.status === "active" &&
            getGameModeFromRoom(currentRoom) !== "vs-computer"
          ) {
            console.log("⏳ DELETE event alındı, 2sn sonra doğrulanacak...");

            const eventRoomId = currentRoom.id;
            const winnerUserId = user?.id || null;

            const tId = setTimeout(async () => {
              try {
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

                const gameMode = getGameModeFromRoom(currentRoom);
                if (gameMode === "tournament") {
                  // Turnuva maçında rakip ayrılırsa oyuncuya +500 bonus puan ver ve devam etmesine izin ver
                  const bonusScore = 500;

                  // Mevcut skora +500 ekle
                  const currentScore =
                    currentRoom.player1_id === winnerUserId
                      ? currentRoom.player1_score || 0
                      : currentRoom.player2_score || 0;

                  await supabase
                    .from("game_rooms")
                    .update({
                      // Oyunu bitirme, sadece skoru güncelle
                      ...(currentRoom.player1_id === winnerUserId
                        ? { player1_score: currentScore + bonusScore }
                        : { player2_score: currentScore + bonusScore }),
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", eventRoomId);

                  toast({
                    title: "⚠️ Rakip Ayrıldı",
                    description:
                      "Rakip oyuncu ayrıldı veya bağlantısı koptu, +500 puan ile oyun bitene kadar devam edebilirsin",
                    duration: 5000,
                  });

                  // Bonus puanı profile'a da ekle
                  if (winnerUserId) {
                    await supabase
                      .from("profiles")
                      .update({
                        total_score:
                          (currentRoom.player1_id === winnerUserId
                            ? currentRoom.player1_score
                            : currentRoom.player2_score) + bonusScore,
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
    const roomChannel = realtimeManager.subscribe("game_rooms", user.id, `id=eq.${currentRoom.id}`, (payload) => {
      const newRoom = payload.new as GameRoom;
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
    });

    console.log("🔧 Real-time subscriptions active (RealtimeManager + Presence)");

    // Cleanup
    return () => {
      console.log("🔌 Cleaning up real-time subscriptions for room:", String(currentRoom.id).slice(-8));
      // Reset countdown guard for next room/game
      lastCountdownAtRef.current = null;

      // Presence untrack & cleanup
      presenceChannel.untrack();
      supabase.removeChannel(presenceChannel);

      // RealtimeManager cleanup
      if (participantsChannel) {
        realtimeManager.unsubscribe(`game_participants-room_id=eq.${currentRoom.id}`, user.id);
      }
      if (roomChannel) {
        realtimeManager.unsubscribe(`game_rooms-id=eq.${currentRoom.id}`, user.id);
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

  // 🎯 OPTIMIZED Rematch listener (RealtimeManager ile) - GLOBAL (her zaman aktif)
  useEffect(() => {
    if (!user) return;

    console.log("🔄 Rematch realtime listener kuruluyor... User:", String(user.id).slice(-8));
    const timeoutMap = new Map<string, NodeJS.Timeout>();

    // Bana gelen istekler
    const incomingChannel = realtimeManager.subscribe(
      "rematch_requests",
      user.id,
      `to_user_id=eq.${user.id}`,
      (payload) => {
        if (payload.eventType === "INSERT") {
          const request = payload.new as RematchRequest;
          console.log("📨 Rematch isteği alındı:", {
            requestId: request.id,
            from: request.from_user_id?.slice(-8),
            to: request.to_user_id?.slice(-8),
            myId: String(user.id).slice(-8),
            status: request.status,
          });

          if (request.status === "pending" && request.to_user_id === user.id) {
            console.log("✅ Rematch dialog açılıyor");
            setCurrentRematchRequest(request);
            toast({
              title: "🔄 Tekrar Oyun İsteği",
              description: "Rakibiniz tekrar oyun istiyor! 30 saniye içinde yanıt verin.",
              duration: 10000,
              action: (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const t = timeoutMap.get(request.id);
                      if (t) {
                        clearTimeout(t);
                        timeoutMap.delete(request.id);
                      }
                      respondRematchRequest(request.id, true);
                    }}
                  >
                    Kabul
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const t = timeoutMap.get(request.id);
                      if (t) {
                        clearTimeout(t);
                        timeoutMap.delete(request.id);
                      }
                      respondRematchRequest(request.id, false);
                    }}
                  >
                    Reddet
                  </Button>
                </div>
              ) as any,
            });

            const timeoutId = setTimeout(async () => {
              console.log("⏰ Rematch timeout - istek iptal ediliyor:", request.id);

              await supabase
                .from("rematch_requests")
                .update({
                  status: "rejected",
                  responded_at: new Date().toISOString(),
                })
                .eq("id", request.id);

              setCurrentRematchRequest(null);

              toast({
                title: "⏰ Süre Doldu",
                description: "Tekrar oyun isteği zaman aşımına uğradı.",
                variant: "destructive",
                duration: 3000,
              });

              timeoutMap.delete(request.id);
            }, 30000);

            timeoutMap.set(request.id, timeoutId);
          } else {
            console.log("⚠️ Rematch isteği göz ardı edildi - pending değil veya bana yönelik değil");
          }
        }
      },
    );

    // Benim gönderdiğim isteklerin yanıtları
    const outgoingChannel = realtimeManager.subscribe(
      "rematch_requests",
      user.id,
      `from_user_id=eq.${user.id}`,
      (payload) => {
        if (payload.eventType === "UPDATE") {
          const request = payload.new as RematchRequest;
          console.log("📬 Gönderdiğim istek yanıtlandı:", request);

          const timeoutId = timeoutMap.get(request.id);
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutMap.delete(request.id);
          }

          if (request.status === "accepted") {
            toast({
              title: "✅ İstek Kabul Edildi!",
              description: "Rakibiniz tekrar oyunu kabul etti, oyun başlıyor...",
              duration: 3000,
            });
            // ✅ Navigation App.tsx'teki GlobalRematchListener tarafından yapılıyor
          } else if (request.status === "rejected") {
            toast({
              title: "❌ İstek Reddedildi",
              description: "Rakibiniz tekrar oyunu reddetti.",
              duration: 3000,
            });
          }

          setCurrentRematchRequest(null);
        }
      },
    );

    return () => {
      console.log("🔌 Rematch listener kapatılıyor...");
      timeoutMap.forEach((timeout) => clearTimeout(timeout));
      timeoutMap.clear();

      if (incomingChannel) {
        realtimeManager.unsubscribe(`rematch_requests-to_user_id=eq.${user.id}`, user.id);
      }
      if (outgoingChannel) {
        realtimeManager.unsubscribe(`rematch_requests-from_user_id=eq.${user.id}`, user.id);
      }
    };
  }, [user?.id, setCurrentRematchRequest, toast, navigate, respondRematchRequest]);

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

    // Cleanup on component unmount
    return () => {
      console.log("🧹 GameContext unmounting - cleaning all real-time subscriptions");

      // RealtimeManager'daki user'ın tüm subscription'larını temizle
      if (user?.id) {
        realtimeManager.unsubscribeAll(user.id);
      }
    };
  }, [currentRoom?.id, user?.id]);

  // Initialize cleanup on mount
  useEffect(() => {
    cleanupOldRooms();
  }, [cleanupOldRooms]);

  return (
    <GameContext.Provider
      value={{
        currentRoom,
        participants,
        lastOpponent,
        createRoom,
        sendRematchRequest,
        respondRematchRequest,
        currentRematchRequest,
        setCurrentRematchRequest,
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
        useNakama,
        toggleNakama,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
