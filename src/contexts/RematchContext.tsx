import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface RematchRequest {
  id: string;
  room_code: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "rejected";
  game_type: "timed" | "score";
  created_at: string;
}

interface IncomingRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  roomCode: string;
  gameType: "timed" | "score";
}

interface RematchContextType {
  isSending: boolean;
  isWaiting: boolean;
  incomingRequest: IncomingRequest | null;
  sendRematchRequest: (opponentId: string, gameType: "timed" | "score", currentGameMode: string) => Promise<boolean>;
  acceptRematch: () => Promise<void>;
  rejectRematch: () => Promise<void>;
  resetRematchState: () => void;
}

const RematchContext = createContext<RematchContextType | undefined>(undefined);

export const useRematchContext = () => {
  const context = useContext(RematchContext);
  if (!context) {
    throw new Error("useRematchContext must be used within RematchProvider");
  }
  return context;
};

export const RematchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [isSending, setIsSending] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  
  const sendingRef = useRef(false);
  const processedRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const waitingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const userId = user?.id;

  // Generate room code
  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Generate random grid
  const generateGrid = () => {
    const letterPool = [
      "A","A","A","A","A","A","A","A",
      "E","E","E","E","E","E","E",
      "İ","İ","İ","İ","İ","İ",
      "I","I","I","I","I",
      "O","O","O","O","O",
      "U","U","U","U",
      "Ü","Ü","Ü",
      "Ö","Ö","Ö",
      "L","L","L","L","L",
      "N","N","N","N","N",
      "R","R","R","R","R",
      "K","K","K","K",
      "M","M","M","M",
      "T","T","T","T",
      "S","S","S","S",
      "D","D","D",
      "Y","Y","Y",
      "B","B","B",
      "C","C",
      "Ç","Ç",
      "F","F",
      "G","G",
      "Ğ","Ğ",
      "H","H",
      "J",
      "P","P",
      "Ş","Ş",
      "V","V",
      "Z",
    ];
    const grid: string[] = [];
    for (let i = 0; i < 16; i++) {
      grid.push(letterPool[Math.floor(Math.random() * letterPool.length)]);
    }
    return grid;
  };

  // Send rematch request
  const sendRematchRequest = useCallback(async (
    opponentId: string,
    gameType: "timed" | "score",
    currentGameMode: string
  ): Promise<boolean> => {
    if (!userId) {
      toast({
        title: "Hata",
        description: "Giriş yapmanız gerekiyor",
        variant: "destructive",
      });
      return false;
    }
    
    if (!opponentId) {
      toast({
        title: "Hata",
        description: "Rakip bulunamadı",
        variant: "destructive",
      });
      return false;
    }

    if (sendingRef.current) {
      return false;
    }
    sendingRef.current = true;
    setIsSending(true);

    try {
      console.log("🔄 Rematch gönderiliyor:", { from: userId.slice(-8), to: opponentId.slice(-8) });

      // Check opt-out
      const { data: optOut } = await supabase
        .from("rematch_opt_outs")
        .select("opt_out_until")
        .eq("user_id", opponentId)
        .maybeSingle();

      if (optOut && new Date(optOut.opt_out_until) > new Date()) {
        toast({
          title: "Rematch Gönderilemedi",
          description: "Rakibiniz oyunu terk etti",
          variant: "destructive",
        });
        return false;
      }

      // FIRST-WINS: Check if opponent already sent a pending request to us
      const { data: existingFromOpponent } = await supabase
        .from("rematch_requests")
        .select("id, room_code, game_type")
        .eq("from_user_id", opponentId)
        .eq("to_user_id", userId)
        .eq("status", "pending")
        .gte("created_at", new Date(Date.now() - 30000).toISOString()) // Son 30 saniye içinde
        .maybeSingle();

      if (existingFromOpponent) {
        console.log("✅ Rakip zaten istek göndermiş, otomatik kabul ediyorum:", existingFromOpponent.room_code);
        
        // Auto-accept the existing request
        await supabase
          .from("rematch_requests")
          .update({ status: "accepted", responded_at: new Date().toISOString() })
          .eq("id", existingFromOpponent.id);

        // Get the room
        const { data: room } = await supabase
          .from("game_rooms")
          .select("id, game_mode")
          .eq("room_code", existingFromOpponent.room_code)
          .maybeSingle();

        if (room) {
          // Add as participant if not exists
          const { data: existing } = await supabase
            .from("game_participants")
            .select("id")
            .eq("room_id", room.id)
            .eq("user_id", userId)
            .maybeSingle();

          if (!existing) {
            await supabase.from("game_participants").insert({
              room_id: room.id,
              user_id: userId,
              score: 0,
              is_bot: false,
            });
          }

          const gameType = room.game_mode?.includes("score") ? "score" : "timed";
          
          toast({
            title: "✅ Rematch Eşleşti",
            description: "Her iki oyuncu da aynı anda istek gönderdi!",
          });

          navigate(`/private-room-waiting?code=${existingFromOpponent.room_code}&roomId=${room.id}&gameType=${gameType}`);
          return true;
        }
      }

      // Cancel any other old pending requests (cleanup)
      await supabase
        .from("rematch_requests")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .eq("from_user_id", userId)
        .eq("to_user_id", opponentId)
        .eq("status", "pending");

      // Create room
      const roomCode = generateRoomCode();
      const baseMode = currentGameMode?.includes("random-match") ? "random-match" : "private-room";
      const mode = `${baseMode}-${gameType}`;

      const { data: room, error: roomError } = await supabase
        .from("game_rooms")
        .insert({
          game_mode: mode,
          host_id: userId,
          room_code: roomCode,
          current_grid: generateGrid(),
          status: "waiting",
          max_score: gameType === "score" ? 500 : 100,
          time_limit: gameType === "timed" ? 120 : 0,
        })
        .select()
        .single();

      if (roomError || !room) {
        throw new Error("Oda oluşturulamadı");
      }

      // Add sender as participant
      await supabase.from("game_participants").insert({
        room_id: room.id,
        user_id: userId,
        score: 0,
        is_bot: false,
      });

      // Create rematch request
      const { error: requestError } = await supabase
        .from("rematch_requests")
        .insert({
          room_code: roomCode,
          from_user_id: userId,
          to_user_id: opponentId,
          status: "pending",
          game_type: gameType,
        });

      if (requestError) throw new Error("Rematch isteği gönderilemedi");

      // Get sender profile for notification
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .single();

      // Create notification
      await supabase.rpc("create_notification", {
        p_user_id: opponentId,
        p_type: "rematch",
        p_message: `${profile?.username || "Bir oyuncu"} tekrar oyun istiyor`,
        p_related_id: roomCode,
      });

      // Send push
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            receiverId: opponentId,
            title: "🔄 Rematch İsteği",
            body: `${profile?.username || "Bir oyuncu"} tekrar oyun istiyor!`,
            data: { type: "rematch", roomCode, gameType },
          },
        });
      } catch (e) {
        console.warn("Push notification gönderilemedi");
      }

      setIsWaiting(true);
      toast({
        title: "🔄 Tekrar Oyun İsteği Gönderildi",
        description: "Rakibinizin yanıtını bekliyoruz...",
      });

      // Set timeout
      waitingTimeoutRef.current = setTimeout(() => {
        setIsWaiting(false);
        toast({
          title: "⏰ Süre Doldu",
          description: "Rakibiniz yanıt vermedi.",
          variant: "destructive",
        });
      }, 30000);

      return true;
    } catch (error: any) {
      console.error("❌ Rematch hatası:", error);
      toast({
        title: "Hata",
        description: error.message || "Rematch gönderilemedi",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSending(false);
      setTimeout(() => {
        sendingRef.current = false;
      }, 2000);
    }
  }, [userId, toast, navigate]);

  // Accept rematch
  const acceptRematch = useCallback(async () => {
    if (!userId || !incomingRequest) return;

    try {
      console.log("✅ Rematch kabul ediliyor:", incomingRequest.id);

      // Update status
      await supabase
        .from("rematch_requests")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .eq("id", incomingRequest.id);

      // Get room
      const { data: room } = await supabase
        .from("game_rooms")
        .select("id, game_mode")
        .eq("room_code", incomingRequest.roomCode)
        .maybeSingle();

      if (!room) {
        toast({
          title: "Hata",
          description: "Oda bulunamadı",
          variant: "destructive",
        });
        setIncomingRequest(null);
        return;
      }

      // Add as participant
      const { data: existing } = await supabase
        .from("game_participants")
        .select("id")
        .eq("room_id", room.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("game_participants").insert({
          room_id: room.id,
          user_id: userId,
          score: 0,
          is_bot: false,
        });
      }

      const gameType = room.game_mode?.includes("score") ? "score" : "timed";
      
      setIncomingRequest(null);
      
      // Navigate
      navigate(`/private-room-waiting?code=${incomingRequest.roomCode}&roomId=${room.id}&gameType=${gameType}`);
    } catch (error) {
      console.error("❌ Rematch kabul hatası:", error);
      toast({
        title: "Hata",
        description: "Rematch kabul edilemedi",
        variant: "destructive",
      });
    }
  }, [userId, incomingRequest, toast, navigate]);

  // Reject rematch
  const rejectRematch = useCallback(async () => {
    if (!userId || !incomingRequest) return;

    try {
      console.log("❌ Rematch reddediliyor:", incomingRequest.id);

      await supabase
        .from("rematch_requests")
        .update({
          status: "rejected",
          responded_at: new Date().toISOString(),
        })
        .eq("id", incomingRequest.id);

      setIncomingRequest(null);
    } catch (error) {
      console.error("❌ Rematch red hatası:", error);
    }
  }, [userId, incomingRequest]);

  // Reset state
  const resetRematchState = useCallback(() => {
    setIsSending(false);
    setIsWaiting(false);
    setIncomingRequest(null);
    processedRef.current.clear();
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
  }, []);

  // Global listener for rematch requests
  useEffect(() => {
    if (!userId) return;

    console.log("🎮 RematchContext: Global listener başlatılıyor");

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`global-rematch-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rematch_requests",
          filter: `to_user_id=eq.${userId}`,
        },
        async (payload) => {
          const request = payload.new as RematchRequest;
          
          // Skip if already processed
          if (processedRef.current.has(request.id)) return;
          processedRef.current.add(request.id);

          // Check if request is recent (within 30 seconds)
          const requestAge = Date.now() - new Date(request.created_at).getTime();
          if (requestAge > 30000) {
            console.log("⏭️ Eski rematch isteği atlanıyor:", request.id);
            return;
          }

          console.log("🔔 Yeni rematch isteği alındı:", request.id);

          // Get sender profile
          const { data: sender } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", request.from_user_id)
            .single();

          setIncomingRequest({
            id: request.id,
            senderId: request.from_user_id,
            senderName: sender?.username || "Bilinmeyen oyuncu",
            senderAvatar: sender?.avatar_url || null,
            roomCode: request.room_code,
            gameType: request.game_type,
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rematch_requests",
          filter: `from_user_id=eq.${userId}`,
        },
        async (payload) => {
          const request = payload.new as RematchRequest;
          
          const responseKey = `resp-${request.id}`;
          if (processedRef.current.has(responseKey)) return;
          processedRef.current.add(responseKey);

          if (request.status === "accepted") {
            console.log("✅ Rematch kabul edildi:", request.room_code);
            
            if (waitingTimeoutRef.current) {
              clearTimeout(waitingTimeoutRef.current);
              waitingTimeoutRef.current = null;
            }
            setIsWaiting(false);

            const { data: room } = await supabase
              .from("game_rooms")
              .select("id, game_mode")
              .eq("room_code", request.room_code)
              .maybeSingle();

            if (room) {
              const gameType = room.game_mode?.includes("score") ? "score" : "timed";
              
              toast({
                title: "✅ Rematch Kabul Edildi",
                description: "Oyun başlıyor...",
              });

              navigate(`/private-room-waiting?code=${request.room_code}&roomId=${room.id}&gameType=${gameType}`);
            }
          } else if (request.status === "rejected") {
            console.log("❌ Rematch reddedildi");
            
            if (waitingTimeoutRef.current) {
              clearTimeout(waitingTimeoutRef.current);
              waitingTimeoutRef.current = null;
            }
            setIsWaiting(false);
            
            toast({
              title: "❌ Rematch Reddedildi",
              description: "Rakip rematch isteğini reddetti.",
              variant: "destructive",
            });
          }
        }
      )
      .subscribe((status) => {
        console.log("🔌 RematchContext channel:", status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current);
      }
    };
  }, [userId, toast, navigate]);

  return (
    <RematchContext.Provider
      value={{
        isSending,
        isWaiting,
        incomingRequest,
        sendRematchRequest,
        acceptRematch,
        rejectRematch,
        resetRematchState,
      }}
    >
      {children}
    </RematchContext.Provider>
  );
};
