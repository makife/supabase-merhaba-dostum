import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RematchRequest {
  id: string;
  room_code: string;
  from_user_id: string;
  to_user_id: string;
  status: "pending" | "accepted" | "rejected";
  game_type: "timed" | "score";
  created_at: string;
}

interface RematchState {
  isSending: boolean;
  isWaiting: boolean;
  incomingRequest: {
    id: string;
    senderId: string;
    senderName: string;
    senderAvatar: string | null;
    roomCode: string;
    gameType: "timed" | "score";
  } | null;
}

export const useRematch = (userId: string | undefined, opponentId: string | null) => {
  const { toast } = useToast();
  const [state, setState] = useState<RematchState>({
    isSending: false,
    isWaiting: false,
    incomingRequest: null,
  });
  
  const sendingRef = useRef(false);
  const processedRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
    gameType: "timed" | "score",
    currentGameMode: string
  ): Promise<boolean> => {
    if (!userId) {
      console.error("❌ Rematch: userId yok");
      toast({
        title: "Hata",
        description: "Giriş yapmanız gerekiyor",
        variant: "destructive",
      });
      return false;
    }
    
    if (!opponentId) {
      console.error("❌ Rematch: Opponent yok");
      toast({
        title: "Hata",
        description: "Rakip bulunamadı. Lütfen ana menüye dönüp tekrar deneyin.",
        variant: "destructive",
      });
      return false;
    }

    // Concurrent guard
    if (sendingRef.current) {
      console.warn("⚠️ Rematch zaten gönderiliyor");
      return false;
    }
    sendingRef.current = true;

    try {
      console.log("🔄 Rematch gönderiliyor:", {
        from: userId.slice(-8),
        to: opponentId.slice(-8),
        gameType,
      });

      // Check opt-out status
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

      // Cancel any existing pending requests between these users
      await supabase
        .from("rematch_requests")
        .update({ status: "rejected", responded_at: new Date().toISOString() })
        .or(`and(from_user_id.eq.${userId},to_user_id.eq.${opponentId}),and(from_user_id.eq.${opponentId},to_user_id.eq.${userId})`)
        .eq("status", "pending");

      // Create new room
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
        console.error("❌ Room oluşturulamadı:", roomError);
        throw new Error("Oda oluşturulamadı");
      }

      // Add self as participant
      await supabase.from("game_participants").insert({
        room_id: room.id,
        user_id: userId,
        score: 0,
        is_bot: false,
      });

      // Create rematch request
      const { data: request, error: requestError } = await supabase
        .from("rematch_requests")
        .insert({
          room_code: roomCode,
          from_user_id: userId,
          to_user_id: opponentId,
          status: "pending",
          game_type: gameType,
        })
        .select()
        .single();

      if (requestError) {
        console.error("❌ Rematch request oluşturulamadı:", requestError);
        throw new Error("Rematch isteği gönderilemedi");
      }

      console.log("✅ Rematch request oluşturuldu:", request.id);

      // Get sender username for notification
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .single();

      // Send notification
      const gameTypeText = gameType === "timed" ? "Zamana Karşı" : "Skora Karşı";
      await supabase.rpc("create_notification", {
        p_user_id: opponentId,
        p_type: "rematch",
        p_message: `${profile?.username || "Bir oyuncu"} tekrar oyun istiyor (${gameTypeText})`,
        p_related_id: roomCode,
      });

      // Send push notification
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            receiverId: opponentId,
            title: "🔄 Rematch İsteği",
            body: `${profile?.username || "Bir oyuncu"} tekrar oyun istiyor! (${gameTypeText})`,
            data: { type: "rematch", roomCode, gameType },
          },
        });
      } catch (e) {
        console.warn("Push notification gönderilemedi:", e);
      }

      setState(prev => ({ ...prev, isWaiting: true }));
      
      toast({
        title: "🔄 Tekrar Oyun İsteği Gönderildi",
        description: "Rakibinizin yanıtını bekliyoruz...",
      });

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
      setTimeout(() => {
        sendingRef.current = false;
      }, 2000);
    }
  }, [userId, opponentId, toast]);

  // Respond to rematch request
  const respondToRematch = useCallback(async (
    requestId: string,
    accepted: boolean
  ): Promise<{ roomCode?: string; roomId?: string; gameType?: string } | null> => {
    if (!userId) return null;

    try {
      console.log("📝 Rematch yanıtı:", { requestId, accepted });

      // Get request details
      const { data: request } = await supabase
        .from("rematch_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      if (!request) {
        console.error("❌ Request bulunamadı");
        return null;
      }

      // Update request status
      const { error } = await supabase
        .from("rematch_requests")
        .update({
          status: accepted ? "accepted" : "rejected",
          responded_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("to_user_id", userId);

      if (error) throw error;

      if (!accepted) {
        setState(prev => ({ ...prev, incomingRequest: null }));
        return null;
      }

      // Get room info
      const { data: room } = await supabase
        .from("game_rooms")
        .select("id, game_mode")
        .eq("room_code", request.room_code)
        .maybeSingle();

      if (!room) {
        toast({
          title: "Hata",
          description: "Oda bulunamadı",
          variant: "destructive",
        });
        return null;
      }

      // Add self as participant if not already
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
      
      setState(prev => ({ ...prev, incomingRequest: null }));

      return {
        roomCode: request.room_code,
        roomId: room.id,
        gameType,
      };
    } catch (error) {
      console.error("❌ Rematch yanıt hatası:", error);
      toast({
        title: "Hata",
        description: "Rematch işlemi başarısız",
        variant: "destructive",
      });
      return null;
    }
  }, [userId, toast]);

  // Reset state
  const resetRematchState = useCallback(() => {
    setState({
      isSending: false,
      isWaiting: false,
      incomingRequest: null,
    });
    processedRef.current.clear();
  }, []);

  // Listen for rematch requests and responses
  useEffect(() => {
    if (!userId) return;

    console.log("🎮 useRematch: Listener başlatılıyor:", userId.slice(-8));

    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`rematch-${userId}`)
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
          console.log("🔔 Rematch isteği alındı:", request.id);

          // Duplicate guard
          if (processedRef.current.has(request.id)) {
            console.log("⏭️ Zaten işlendi:", request.id);
            return;
          }
          processedRef.current.add(request.id);

          // Fetch sender profile
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", request.from_user_id)
            .single();

          setState(prev => ({
            ...prev,
            incomingRequest: {
              id: request.id,
              senderId: request.from_user_id,
              senderName: senderProfile?.username || "Bilinmeyen oyuncu",
              senderAvatar: senderProfile?.avatar_url || null,
              roomCode: request.room_code,
              gameType: request.game_type,
            },
          }));
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
          console.log("📬 Rematch yanıtı alındı:", request.status);

          const responseKey = `response-${request.id}`;
          if (processedRef.current.has(responseKey)) {
            console.log("⏭️ Yanıt zaten işlendi:", responseKey);
            return;
          }
          processedRef.current.add(responseKey);

          if (request.status === "accepted") {
            console.log("✅ Rematch kabul edildi:", request.room_code);
            
            // Get room info
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

              // Navigate to waiting page
              window.location.href = `/private-room-waiting?code=${request.room_code}&roomId=${room.id}&gameType=${gameType}`;
            }
          } else if (request.status === "rejected") {
            console.log("❌ Rematch reddedildi");
            toast({
              title: "❌ Rematch Reddedildi",
              description: "Oyuncu rematch isteğini reddetti.",
              variant: "destructive",
            });
            setState(prev => ({ ...prev, isWaiting: false }));
          }
        }
      )
      .subscribe((status) => {
        console.log("🔌 Rematch channel status:", status);
      });

    channelRef.current = channel;

    return () => {
      console.log("🧹 useRematch: Listener temizleniyor");
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, toast]);

  // Timeout for waiting state
  useEffect(() => {
    if (!state.isWaiting) return;

    const timeout = setTimeout(() => {
      console.log("⏰ Rematch timeout");
      setState(prev => ({ ...prev, isWaiting: false }));
      toast({
        title: "⏰ Süre Doldu",
        description: "Rakibiniz yanıt vermedi.",
        variant: "destructive",
      });
    }, 30000); // 30 seconds timeout

    return () => clearTimeout(timeout);
  }, [state.isWaiting, toast]);

  return {
    ...state,
    sendRematchRequest,
    respondToRematch,
    resetRematchState,
  };
};
