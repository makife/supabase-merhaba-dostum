import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, Home, Users, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSounds } from "@/hooks/useSounds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FriendInviteDialog from "@/components/FriendInviteDialog";
import { usePageResync } from "@/hooks/useGlobalResync";

interface Participant {
  id: string;
  user_id: string | null;
  is_ready: boolean | null;
  is_bot: boolean | null;
}

const PrivateRoomWaitingPage = () => {
  const { roomCode: paramCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playSound } = useSounds();
  const { user } = useAuth();

  const roomCode = paramCode || searchParams.get("code");

  const [roomId, setRoomId] = useState<string | null>(searchParams.get("roomId"));
  const [gameType, setGameType] = useState<"timed" | "score" | null>(
    (searchParams.get("gameType") as "timed" | "score") || null,
  );

  const [copied, setCopied] = useState(false);
  const [navigated, setNavigated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [settingReady, setSettingReady] = useState(false);
  const [friendInviteOpen, setFriendInviteOpen] = useState(false);

  // 🔄 Global Resync Hook
  const handleRoomResync = useCallback(async () => {
    if (!roomId || navigated) return;

    const { data: parts } = await supabase
      .from("game_participants")
      .select("id, user_id, is_ready, is_bot")
      .eq("room_id", roomId);

    if (parts) {
      setParticipants(parts);
      // Check if both players are ready
      const realPlayers = parts.filter(p => !p.is_bot);
      const allReady = realPlayers.length >= 2 && realPlayers.every(p => p.is_ready);
      
      if (allReady && !navigated) {
        await startGameAndNavigate();
      }
    }
  }, [roomId, navigated]);

  usePageResync(handleRoomResync, "PrivateRoomWaitingPage", true);

  const startGameAndNavigate = useCallback(async () => {
    if (!roomId || !gameType || navigated) return;
    setNavigated(true);

    console.log("🎮 İki oyuncu da hazır, countdown başlatılıp GamePage'e yönlendiriliyor...");

    try {
      const { data: roomCheck } = await supabase
        .from("game_rooms")
        .select("countdown_started_at")
        .eq("id", roomId)
        .single();

      if (!roomCheck?.countdown_started_at) {
        console.log("⏱️ Countdown RPC ile başlatılıyor...");
        await supabase.rpc("start_game_countdown", { p_room_id: roomId });
      }
    } catch (err) {
      console.warn("Countdown başlatma hatası (devam ediliyor):", err);
    }

    const basePath = "/game/private-room";
    navigate(`${basePath}?room=${roomId}&type=${gameType}`);
  }, [roomId, gameType, navigated, navigate]);

  // 1. Oda Bilgilerini Çekme
  useEffect(() => {
    if (!user || !roomCode) {
      if (!roomCode) navigate("/");
      return;
    }

    const fetchRoomDetails = async () => {
      if (roomId && gameType) {
        setLoading(false);
        return;
      }

      try {
        const { data: roomRow, error } = await supabase
          .from("game_rooms")
          .select("id, game_mode, game_type_new")
          .eq("room_code", roomCode)
          .maybeSingle();

        if (error || !roomRow) {
          console.error("Oda bulunamadı:", error);
          toast({
            title: "Hata",
            description: "Oda bulunamadı veya süresi dolmuş.",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        setRoomId(roomRow.id);
        const type = roomRow.game_type_new || (roomRow.game_mode?.includes("score") ? "score" : "timed");
        setGameType(type as "timed" | "score");
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoomDetails();
  }, [roomCode, user, roomId, gameType, navigate, toast]);

  // 2. Katılımcı Ekleme ve Dinleme
  useEffect(() => {
    if (!roomId || !user || !gameType) return;

    let unsubscribed = false;

    const ensureSelfParticipant = async () => {
      try {
        const { data: existing } = await supabase
          .from("game_participants")
          .select("id, is_ready")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from("game_participants").insert({
            room_id: roomId,
            user_id: user.id,
            score: 0,
            is_bot: false,
            is_ready: false,
          });
          console.log("✅ Katılımcı eklendi:", roomId);
        } else if (existing.is_ready) {
          setIsReady(true);
        }
      } catch (e: any) {
        if (e?.code !== "23505") {
          console.warn("ensureSelfParticipant warning:", e);
        }
      }
    };

    ensureSelfParticipant();

    // Fetch current participants
    const fetchParticipants = async () => {
      const { data: parts } = await supabase
        .from("game_participants")
        .select("id, user_id, is_ready, is_bot")
        .eq("room_id", roomId);

      if (!unsubscribed && parts) {
        setParticipants(parts);
        
        // Check if both ready
        const realPlayers = parts.filter(p => !p.is_bot);
        const allReady = realPlayers.length >= 2 && realPlayers.every(p => p.is_ready);
        
        if (allReady && !navigated) {
          await startGameAndNavigate();
        }
      }
    };

    fetchParticipants();

    // Realtime: listen for INSERT and UPDATE on participants
    const channel = supabase
      .channel(`room_ready_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_participants",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          console.log("👥 Katılımcı değişikliği algılandı");
          if (!navigated) {
            await fetchParticipants();
          }
        },
      )
      .subscribe();

    return () => {
      unsubscribed = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, gameType, user, navigated, startGameAndNavigate]);

  const handleReady = async () => {
    if (!roomId || !user || settingReady) return;
    setSettingReady(true);
    playSound("buttonClick");

    try {
      await supabase
        .from("game_participants")
        .update({ is_ready: true })
        .eq("room_id", roomId)
        .eq("user_id", user.id);

      setIsReady(true);
      console.log("✅ Hazır durumu güncellendi");
    } catch (err) {
      console.error("Hazır durumu güncelleme hatası:", err);
      toast({ title: "Hata", description: "Hazır durumu güncellenemedi", variant: "destructive" });
    } finally {
      setSettingReady(false);
    }
  };

  const copyRoomCode = async () => {
    if (roomCode) {
      try {
        await navigator.clipboard.writeText(roomCode);
        setCopied(true);
        playSound("buttonClick");
        toast({
          title: "Kopyalandı!",
          description: "Oda kodu panoya kopyalandı",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error("Error copying to clipboard:", error);
      }
    }
  };

  const handleShare = async () => {
    if (!roomCode) return;
    playSound("buttonClick");

    try {
      // Capacitor native share kullan
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import("@capacitor/share");
        await Share.share({
          title: "Özel Oda Daveti",
          text: `Kelimele'de benimle oynamaya gel! Oda kodu: ${roomCode}`,
          dialogTitle: "Oda Kodunu Paylaş",
        });
        return;
      }
    } catch (err) {
      // Native share başarısız olursa veya iptal edilirse devam et
    }

    // Web fallback
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Özel Oda Daveti",
          text: `Kelimele'de benimle oynamaya gel! Oda kodu: ${roomCode}`,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      copyRoomCode();
    }
  };

  const handleBack = () => {
    playSound("buttonClick");
    navigate("/");
  };

  const realPlayers = participants.filter(p => !p.is_bot);
  const opponentJoined = realPlayers.length >= 2;
  const opponentReady = opponentJoined && realPlayers.filter(p => p.user_id !== user?.id).every(p => p.is_ready);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center text-white">
        <div className="animate-pulse">Oda bilgileri yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 p-4">
      {/* Ana Sayfa Butonu */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          onClick={handleBack}
          className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
        >
          <Home className="w-4 h-4 mr-2" />
          Ana Sayfa
        </Button>
      </div>

      <div className="max-w-2xl mx-auto pt-20">
        {/* Durum bilgisi */}
        <div className="text-center mb-8">
          <p className="text-gray-300 text-lg">
            {!opponentJoined
              ? ""
              : !isReady || !opponentReady
                ? "Hazır olun!"
                : "Oyun başlıyor..."}
          </p>
        </div>

        {/* Oda Kodu Kartı */}
        <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-6">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <div className="p-4 sm:p-8 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl border-2 border-yellow-400/30 backdrop-blur-sm">
                <p className="text-sm font-semibold text-yellow-300 mb-4">Oda Kodu</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
                  <span className="text-3xl sm:text-5xl font-bold font-mono text-white tracking-[0.2em] sm:tracking-[0.3em] break-all">
                    {roomCode}
                  </span>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={copyRoomCode}
                    className="bg-white/10 border-white/20 hover:bg-white/20 text-white h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0"
                  >
                    {copied ? <Check className="w-5 h-5 sm:w-6 sm:h-6" /> : <Copy className="w-5 h-5 sm:w-6 sm:h-6" />}
                  </Button>
                </div>
                <p className="text-xs sm:text-sm text-yellow-200 mt-4">6 haneli kodu arkadaşınla paylaş</p>
                
                {/* Paylaş butonları */}
                <div className="flex flex-col sm:flex-row gap-2 mt-4 justify-center">
                  <Button
                    onClick={handleShare}
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold px-6"
                  >
                    📤 Kodu Paylaş
                  </Button>
                  <Button
                    onClick={() => setFriendInviteOpen(true)}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold px-6"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Arkadaşımla Paylaş
                  </Button>
                </div>
              </div>

              {/* Oyuncu Durumları */}
              <div className="space-y-3">
                {/* Sen */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                  isReady 
                    ? "bg-green-500/20 border-green-400/40" 
                    : "bg-white/5 border-white/10"
                }`}>
                  <span className="text-white font-medium">👤 Sen</span>
                  {isReady ? (
                    <span className="flex items-center gap-1 text-green-400 font-bold text-sm">
                      <CheckCircle2 className="w-4 h-4" /> HAZIR
                    </span>
                  ) : (
                    <span className="text-zinc-400 text-sm">Bekleniyor</span>
                  )}
                </div>

                {/* Rakip */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                  opponentReady 
                    ? "bg-green-500/20 border-green-400/40" 
                    : opponentJoined 
                      ? "bg-blue-500/20 border-blue-400/40"
                      : "bg-white/5 border-white/10"
                }`}>
                  <span className="text-white font-medium">👤 Rakip</span>
                  {opponentReady ? (
                    <span className="flex items-center gap-1 text-green-400 font-bold text-sm">
                      <CheckCircle2 className="w-4 h-4" /> HAZIR
                    </span>
                  ) : opponentJoined ? (
                    <span className="text-blue-400 text-sm">Katıldı - Hazır değil</span>
                  ) : (
                    <span className="flex items-center gap-1 text-zinc-400 text-sm">
                      <Loader2 className="w-3 h-3 animate-spin" /> Bekleniyor...
                    </span>
                  )}
                </div>
              </div>

              {/* Hazırım Butonu */}
              {!isReady && (
                <Button
                  onClick={handleReady}
                  disabled={settingReady}
                  className="w-full py-6 text-lg font-black uppercase tracking-widest bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-2xl shadow-lg shadow-green-900/30"
                >
                  {settingReady ? (
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                  )}
                  {settingReady ? "GÜNCELLENİYOR..." : "HAZIRIM!"}
                </Button>
              )}

              {isReady && !opponentReady && (
                <div className="flex items-center justify-center gap-2 py-4 text-green-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-medium">
                    {opponentJoined ? "Rakibiniz hazır olana kadar bekleniyor..." : "Rakibiniz katılana ve hazır olana kadar bekleniyor..."}
                  </span>
                </div>
              )}

              {isReady && opponentReady && (
                <div className="flex items-center justify-center gap-2 py-4 text-yellow-400 animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-bold text-lg">Oyun başlıyor!</span>
                </div>
              )}

              {/* Bekleme Animasyonu - sadece rakip katılmadıysa */}
              {!opponentJoined && (
                <div className="flex items-center justify-center space-x-2 py-4">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-3 h-3 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              )}

            </div>
          </CardContent>
        </Card>
      </div>
      {roomCode && (
        <FriendInviteDialog
          open={friendInviteOpen}
          onOpenChange={setFriendInviteOpen}
          roomCode={roomCode}
          gameType={gameType}
        />
      )}
    </div>
  );
};

export default PrivateRoomWaitingPage;
