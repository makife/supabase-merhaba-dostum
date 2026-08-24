import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";
import { setLastRoomId } from "@/utils/persistentState";

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

/** MatchResultCard / RematchRoboAnimation'ın beklediği animasyon durumu. */
export type RematchStatus = "idle" | "waiting" | "accepted" | "declined";

interface RematchContextType {
  isSending: boolean;
  isWaiting: boolean;
  /** MatchResultCard'daki robot animasyonuna doğrudan bağlanacak durum. */
  rematchStatus: RematchStatus;
  incomingRequest: IncomingRequest | null;
  sendRematchRequest: (opponentId: string, gameType: "timed" | "score", currentGameMode: string) => Promise<boolean>;
  acceptRematch: () => Promise<void>;
  rejectRematch: () => Promise<void>;
  resetRematchState: () => void;
  /** Robot animasyonu (yes/no) bittiğinde çağrılır; bekleyen maç geçişini tetikler. */
  notifyRematchAnimationFinished: () => void;
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
  const [rematchStatus, setRematchStatus] = useState<RematchStatus>("idle");
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);

  const sendingRef = useRef(false);
  const processedRef = useRef<Set<string>>(new Set());
  const waitingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // 🔒 Reddedildiyse aynı rakibe tekrar istek gönderilmesin (oturum boyunca)
  const rejectedOpponentsRef = useRef<Set<string>>(new Set());

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

  const getFreshPlayAccess = useCallback(async (targetUserId: string) => {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("game_credits, bonus_credits, premium_until, unlimited_lives_until")
      .eq("id", targetUserId)
      .single();

    if (error || !profile) {
      console.error("❌ Profil erişim kontrolü başarısız:", error);
      throw new Error("Profil bilgileri alınamadı");
    }

    const now = new Date();
    const hasUnlimitedAccess =
      (profile.premium_until && new Date(profile.premium_until) > now) ||
      (profile.unlimited_lives_until && new Date(profile.unlimited_lives_until) > now);

    const totalCredits = (profile.game_credits || 0) + (profile.bonus_credits || 0);

    return {
      hasAccess: Boolean(hasUnlimitedAccess || totalCredits >= 1),
      hasUnlimitedAccess: Boolean(hasUnlimitedAccess),
      totalCredits,
    };
  }, []);

  // Send rematch request
  const sendRematchRequest = useCallback(
    async (opponentId: string, gameType: "timed" | "score", currentGameMode: string): Promise<boolean> => {
      if (!userId) {
        toast({
          title: "❗",
          description: "Giriş yapmanız gerekiyor",
          variant: "destructive",
        });
        return false;
      }

      if (!opponentId) {
        toast({
          title: "❗",
          description: "Rakip bulunamadı",
          variant: "destructive",
          duration: 1000,
        });
        return false;
      }

      if (sendingRef.current) {
        return false;
      }

      // 🔒 Bu rakip daha önce isteği reddettiyse tekrar gönderme
      if (rejectedOpponentsRef.current.has(opponentId)) {
        toast({
          title: "Rematch Gönderilemedi",
          description: "Rakibiniz daha önce isteğinizi reddetti.",
          variant: "destructive",
          duration: 2000,
        });
        return false;
      }

      sendingRef.current = true;
      setIsSending(true);

      try {
        console.log("🔄 Rematch gönderiliyor:", { from: userId.slice(-8), to: opponentId.slice(-8) });

        // 🔒 HAK KONTROLÜ: Her zaman taze profilden kontrol et
        const senderAccess = await getFreshPlayAccess(userId);

        if (!senderAccess.hasAccess) {
          toast({
            title: "Yetersiz Hak",
            description:
              "Aktif sınırsız hakkınız veya oyun hakkınız bulunmamaktadır. Marketten hak satın alabilirsiniz.",
            variant: "destructive",
            duration: 3000,
          });
          navigate("/market");
          return false;
        }

        // Clear own opt-out since we want to rematch
        await supabase.from("rematch_opt_outs").delete().eq("user_id", userId);

        // Check if opponent explicitly opted out (clicked "Ana Menüye Dön")
        // Only block if opt-out was set very recently (within last 30 seconds)
        // This prevents blocking from stale opt-out entries
        const { data: optOut } = await supabase
          .from("rematch_opt_outs")
          .select("opt_out_until, updated_at")
          .eq("user_id", opponentId)
          .maybeSingle();

        const now = new Date();
        const thirtySecondsAgo = new Date(now.getTime() - 30000);

        if (optOut && new Date(optOut.opt_out_until) > now && new Date(optOut.updated_at) > thirtySecondsAgo) {
          console.log("❌ Rakip son 30 saniye içinde opt-out yaptı");
          toast({
            title: "Rematch Gönderilemedi",
            description: "Rakibiniz oyunu terk etti",
            variant: "destructive",
            duration: 1000,
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
              const { error: participantError } = await supabase.from("game_participants").insert({
                room_id: room.id,
                user_id: userId,
                score: 0,
                is_bot: false,
                is_ready: true,
              });
              if (participantError) throw participantError;
            } else {
              const { error: readyError } = await supabase
                .from("game_participants")
                .update({ is_ready: true })
                .eq("id", existing.id);
              if (readyError) throw readyError;
            }

            const gameType = room.game_mode?.includes("score") ? "score" : "timed";

            await supabase
              .from("rematch_requests")
              .update({ status: "accepted", responded_at: new Date().toISOString() })
              .eq("id", existingFromOpponent.id);

            toast({
              title: "✅ Rematch Eşleşti",
              description: "Her iki oyuncu da aynı anda istek gönderdi!",
              duration: 1000,
            });

            await setLastRoomId(null);
            // Her iki oyuncuyu da hazır işaretle (bekleme ekranı atlanıyor)
            await supabase.from("game_participants").update({ is_ready: true }).eq("room_id", room.id);
            navigate(`/game/private-room?room=${room.id}&type=${gameType}`, { replace: true });
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
        const mode = `private-room-${gameType}`;

        const { data: room, error: roomError } = await supabase
          .from("game_rooms")
          .insert({
            game_mode: mode,
            game_type_new: gameType,
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
        const { error: senderParticipantError } = await supabase.from("game_participants").insert({
          room_id: room.id,
          user_id: userId,
          score: 0,
          is_bot: false,
          is_ready: false,
        });
        if (senderParticipantError) throw senderParticipantError;

        // Create rematch request
        const { error: requestError } = await supabase.from("rematch_requests").insert({
          room_code: roomCode,
          from_user_id: userId,
          to_user_id: opponentId,
          status: "pending",
          game_type: gameType,
        });

        if (requestError) throw new Error("Rematch isteği gönderilemedi");

        // Get sender profile for notification
        const { data: profile } = await supabase.from("profiles").select("username").eq("id", userId).single();

        // Create notification
        await supabase.rpc("create_notification", {
          p_user_id: opponentId,
          p_type: "rematch",
          p_message: `${profile?.username || "Bir oyuncu"} tekrar oyun istiyor`,
          p_related_id: roomCode,
        });

        // Push bildirim gönderilMEZ - rematch sadece in-app realtime + polling ile çalışır
        console.log("ℹ️ Rematch push bildirimi atlandı (tasarım gereği)");

        setIsWaiting(true);
        setRematchStatus("waiting");
        toast({
          title: "🔄 Tekrar Oyun İsteği Gönderildi",
          description: "Rakibinizin yanıtını bekliyoruz...",
          duration: 3000,
        });

        // Set timeout
        waitingTimeoutRef.current = setTimeout(() => {
          setIsWaiting(false);
          setRematchStatus("idle");
          toast({
            title: "⏰ Süre Doldu",
            description: "Rakibiniz yanıt vermedi.",
            variant: "destructive",
            duration: 1000,
          });
        }, 30000);

        return true;
      } catch (error: any) {
        console.error("❌ Rematch hatası:", error);
        toast({
          title: "❗",
          description: error.message || "Rematch gönderilemedi",
          variant: "destructive",
          duration: 1000,
        });
        return false;
      } finally {
        setIsSending(false);
        setTimeout(() => {
          sendingRef.current = false;
        }, 2000);
      }
    },
    [userId, toast, navigate, getFreshPlayAccess],
  );

  // Accept rematch - HAK KONTROLÜ EKLENDİ
  const acceptRematch = useCallback(async () => {
    if (!userId || !incomingRequest) return;

    try {
      console.log("✅ Rematch kabul ediliyor:", incomingRequest.id);

      // 🔒 HAK KONTROLÜ: Kabul etmeden önce taze profil ve aktif hakları kontrol et
      const receiverAccess = await getFreshPlayAccess(userId);

      if (!receiverAccess.hasAccess) {
        console.log("❌ Yetersiz hak, rematch kabul edilemiyor");
        toast({
          title: "Yetersiz Hak",
          description: "Aktif sınırsız hakkınız veya oyun hakkınız bulunmamaktadır. Marketten hak satın alabilirsiniz.",
          variant: "destructive",
          duration: 3000,
        });

        // Rematch'i reddet
        await supabase
          .from("rematch_requests")
          .update({
            status: "rejected",
            responded_at: new Date().toISOString(),
          })
          .eq("id", incomingRequest.id);

        setIncomingRequest(null);
        navigate("/market");
        return;
      }

      // Get room
      const { data: room } = await supabase
        .from("game_rooms")
        .select("id, game_mode")
        .eq("room_code", incomingRequest.roomCode)
        .maybeSingle();

      if (!room) {
        toast({
          title: "❗",
          description: "Oda bulunamadı",
          variant: "destructive",
          duration: 1000,
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
        const { error: participantError } = await supabase.from("game_participants").insert({
          room_id: room.id,
          user_id: userId,
          score: 0,
          is_bot: false,
          is_ready: true,
        });
        if (participantError) throw participantError;
      } else {
        const { error: readyError } = await supabase
          .from("game_participants")
          .update({ is_ready: true })
          .eq("id", existing.id);
        if (readyError) throw readyError;
      }

      const gameType = room.game_mode?.includes("score") ? "score" : "timed";

      await supabase
        .from("rematch_requests")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .eq("id", incomingRequest.id);

      setIncomingRequest(null);

      await setLastRoomId(null);

      // Her iki oyuncuyu hazır yap ve direkt maç sayfasına git
      await supabase.from("game_participants").update({ is_ready: true }).eq("room_id", room.id);
      navigate(`/game/private-room?room=${room.id}&type=${gameType}`, { replace: true });
    } catch (error) {
      console.error("❌ Rematch kabul hatası:", error);
      toast({
        title: "❗",
        description: "Rematch kabul edilemedi",
        variant: "destructive",
        duration: 1000,
      });
    }
  }, [userId, incomingRequest, toast, navigate, getFreshPlayAccess]);

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
    setRematchStatus("idle");
    setIncomingRequest(null);
    processedRef.current.clear();
    if (waitingTimeoutRef.current) {
      clearTimeout(waitingTimeoutRef.current);
      waitingTimeoutRef.current = null;
    }
  }, []);

  // Realtime listener handles accepted/rejected - no polling needed

  // Global listener for rematch requests (auto-reconnect destekli)
  useEffect(() => {
    if (!userId) return;

    console.log("🎮 RematchContext: Global listener başlatılıyor (auto-reconnect)");

    const channelName = `global-rematch-${userId}`;

    autoReconnect.registerChannel(channelName, () =>
      supabase
        .channel(channelName)
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
          },
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
              setRematchStatus("accepted");

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
                  duration: 1000,
                });

                await setLastRoomId(null);
                await supabase.from("game_participants").update({ is_ready: true }).eq("room_id", room.id);

                // "yes" animasyonunun oynaması için maça geçişi minik bir süre erteliyoruz.
                // Animasyon zaten kendi bitince (onResultFinished) navigasyonu tetikleyecekse
                // bu setTimeout'u kaldırıp navigate'i oradan çağırabilirsin.
                setTimeout(() => {
                  navigate(`/game/private-room?room=${room.id}&type=${gameType}`, { replace: true });
                }, 900);
              }
            } else if (request.status === "rejected") {
              console.log("❌ Rematch reddedildi");

              if (waitingTimeoutRef.current) {
                clearTimeout(waitingTimeoutRef.current);
                waitingTimeoutRef.current = null;
              }
              setIsWaiting(false);
              setRematchStatus("declined");
              // "no" animasyonu oynasın diye birkaç saniye sonra idle'a dönüyoruz.
              setTimeout(() => setRematchStatus("idle"), 2500);

              // 🔒 Bu rakibe oturum boyunca tekrar istek gönderme
              if (request.to_user_id) {
                rejectedOpponentsRef.current.add(request.to_user_id);
              }

              toast({
                title: "❌ Rematch Reddedildi",
                description: "Rakip rematch isteğini reddetti.",
                variant: "destructive",
                duration: 1000,
              });
            }
          },
        )
        .subscribe((status) => {
          console.log("🔌 RematchContext channel:", status);
        }),
    );

    return () => {
      autoReconnect.unregisterChannel(channelName);
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
        rematchStatus,
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
