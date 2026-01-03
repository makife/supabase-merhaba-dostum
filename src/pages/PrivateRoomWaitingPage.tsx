import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, Home, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSounds } from "@/hooks/useSounds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";

const PrivateRoomWaitingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playSound } = useSounds();
  const { user } = useAuth();
  const { isSystemConnected } = useUser();
  const hasRefreshedRef = useRef(false);

  const roomCode = searchParams.get("code");
  const roomId = searchParams.get("roomId");
  const gameType = searchParams.get("gameType") as "timed" | "score";

  const [copied, setCopied] = useState(false);
  const [navigated, setNavigated] = useState(false);

  useEffect(() => {
    if (!roomCode || !user) {
      navigate("/");
      return;
    }

    // roomId yoksa room_code üzerinden bul ve URL'i tamamla
    if (!roomId) {
      (async () => {
        const { data: roomRow } = await supabase
          .from("game_rooms")
          .select("id, game_mode")
          .eq("room_code", roomCode)
          .maybeSingle();
        if (roomRow?.id) {
          const typeFromRoom = roomRow?.game_mode?.includes("score") ? "score" : "timed";
          navigate(`/private-room-waiting?code=${roomCode}&roomId=${roomRow.id}&gameType=${typeFromRoom}`);
        } else {
          navigate("/");
        }
      })();
      return;
    }

    let unsubscribed = false;

    // Ensure current user is participant (handles rare failed inserts)
    const ensureSelfParticipant = async () => {
      if (!roomId || !user?.id) return;
      try {
        const { data: existing } = await supabase
          .from("game_participants")
          .select("id")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!existing) {
          await supabase.from("game_participants").insert({
            room_id: roomId,
            user_id: user.id,
            score: 0,
            is_bot: false,
          });
          console.log("✅ Self participant inserted for room", roomId);
        }
      } catch (e: any) {
        // Ignore duplicate
        if (e?.code !== "23505") {
          console.warn("ensureSelfParticipant warning:", e);
        }
      }
    };

    ensureSelfParticipant();

    const checkAndNavigate = async () => {
      const { data: parts } = await supabase
        .from("game_participants")
        .select("*")
        .eq("room_id", roomId);
      if (!unsubscribed && parts && parts.length >= 2 && !navigated) {
        setNavigated(true);
        
        // Odanın game_mode'unu al ve doğru type parametresiyle yönlendir
        const { data: room } = await supabase
          .from("game_rooms")
          .select("game_mode, game_type_new")
          .eq("id", roomId)
          .single();
        
        const type = room?.game_type_new || (room?.game_mode?.includes('score') ? 'score' : 'timed');
        const basePath = room?.game_mode?.includes('random-match') ? '/game/random-match' : '/game/private-room';
        
        console.log('🎮 2. oyuncu katıldı, countdown başlatılıyor...', { roomId, type });
        
        // Countdown başlat
        const { data: countdownTime, error: rpcError } = await supabase.rpc("start_game_countdown", {
          p_room_id: roomId,
        });
        
        if (rpcError) {
          console.warn("⚠️ Countdown RPC error:", rpcError);
        } else if (countdownTime) {
          console.log("✅ Countdown başlatıldı:", countdownTime);
          window.dispatchEvent(new CustomEvent("countdownStarted", { detail: { serverTime: countdownTime } }));
        }
        
        console.log('🎮 Oyun sayfasına yönlendiriliyor', { type, gameMode: room?.game_mode, target: `${basePath}?room=${roomId}&type=${type}` });
        navigate(`${basePath}?room=${roomId}&type=${type}`);
      }
    };

    // İlk yüklemede mevcut katılımcıları kontrol et (gecikmeli insert kaçırılabilir)
    checkAndNavigate();

    // Realtime ile participants tablosunu dinle
    const channel = supabase
      .channel(`room_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "game_participants",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log("👥 Yeni katılımcı:", payload);
          if (navigated) return;
          await checkAndNavigate();
        },
      )
      .subscribe();

    return () => {
      unsubscribed = true;
      channel.unsubscribe();
    };
  }, [roomCode, roomId, gameType, user, navigate, navigated]);

  // isSystemConnected değiştiğinde katılımcıları kontrol et
  useEffect(() => {
    if (isSystemConnected && roomId && !navigated && !hasRefreshedRef.current) {
      console.log('🔄 [PrivateRoomWaitingPage] isSystemConnected true - katılımcılar kontrol ediliyor...');
      hasRefreshedRef.current = true;
      // Katılımcı kontrolü için mevcut checkAndNavigate mantığını tetikle
      (async () => {
        const { data: parts } = await supabase
          .from("game_participants")
          .select("*")
          .eq("room_id", roomId);
        if (parts && parts.length >= 2 && !navigated) {
          const { data: room } = await supabase
            .from("game_rooms")
            .select("game_mode, game_type_new")
            .eq("id", roomId)
            .single();
          const type = room?.game_type_new || (room?.game_mode?.includes('score') ? 'score' : 'timed');
          const basePath = room?.game_mode?.includes('random-match') ? '/game/random-match' : '/game/private-room';
          navigate(`${basePath}?room=${roomId}&type=${type}`);
        }
      })();
    }
    if (!isSystemConnected) {
      hasRefreshedRef.current = false;
    }
  }, [isSystemConnected, roomId, navigated, navigate]);

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

  const handleBack = () => {
    playSound("buttonClick");
    navigate("/");
  };

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
        {/* Başlık */}
        <div className="text-center mb-8">
          <div className="h-20 w-20 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Özel Oda</h1>
          <p className="text-gray-300 text-lg">Arkadaşın bekleniyor...</p>
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
              </div>

              {/* Bekleme Animasyonu */}
              <div className="flex items-center justify-center space-x-2 py-4">
                <div
                  className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></div>
                <div
                  className="w-3 h-3 bg-pink-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></div>
              </div>
              {/* Oyun Türü Bilgisi */}
              <div className="pt-4 border-t border-white/20">
                <p className="text-sm text-gray-400 mb-2">Oyun Türü</p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-400/30">
                  <span className="text-white font-semibold">
                    {gameType === "timed" ? "⏱️ Zamana Karşı" : "🏆 Puanlı"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {gameType === "timed" ? "2 dakika içinde en yüksek puanı hedefle" : "500 puana ilk ulaşan kazanır"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivateRoomWaitingPage;
