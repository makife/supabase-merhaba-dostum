import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom"; // useParams eklendi
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, Home, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSounds } from "@/hooks/useSounds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { usePageResync } from "@/hooks/useGlobalResync";

const PrivateRoomWaitingPage = () => {
  // 1. useParams ile URL'deki kodu alıyoruz (:roomCode)
  const { roomCode: paramCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { playSound } = useSounds();
  const { user } = useAuth();

  // URL'den gelen kod (App.tsx'deki :roomCode) veya Query param (yedek)
  const roomCode = paramCode || searchParams.get("code");

  // Room verilerini State'te tutuyoruz (URL'de taşıyıp durmamak için)
  const [roomId, setRoomId] = useState<string | null>(searchParams.get("roomId"));
  const [gameType, setGameType] = useState<"timed" | "score" | null>(
    (searchParams.get("gameType") as "timed" | "score") || null,
  );

  const [copied, setCopied] = useState(false);
  const [navigated, setNavigated] = useState(false);
  const [loading, setLoading] = useState(true); // Yükleniyor durumu eklendi

  // 🔄 Global Resync Hook
  const handleRoomResync = useCallback(async () => {
    if (!roomId || navigated) return;

    const { data: parts } = await supabase.from("game_participants").select("*").eq("room_id", roomId);

    if (parts && parts.length >= 2) {
      const { data: room } = await supabase
        .from("game_rooms")
        .select("game_mode, game_type_new")
        .eq("id", roomId)
        .single();

      const type = room?.game_type_new || (room?.game_mode?.includes("score") ? "score" : "timed");
      const basePath = room?.game_mode?.includes("random-match") ? "/game/random-match" : "/game/private-room";

      setNavigated(true);
      navigate(`${basePath}?room=${roomId}&type=${type}`);
    }
  }, [roomId, navigated, navigate]);

  usePageResync(handleRoomResync, "PrivateRoomWaitingPage", true);

  // 1. Oda Bilgilerini Çekme Effect'i
  useEffect(() => {
    if (!user || !roomCode) {
      // Sadece user veya roomCode yoksa at, roomId henüz gelmemiş olabilir bekle
      if (!roomCode) navigate("/");
      return;
    }

    const fetchRoomDetails = async () => {
      // Eğer state'te zaten roomId varsa tekrar çekme
      if (roomId && gameType) {
        setLoading(false);
        return;
      }

      try {
        const { data: roomRow, error } = await supabase
          .from("game_rooms")
          .select("id, game_mode, game_type_new")
          .eq("room_code", roomCode) // roomCode string olduğu için .toUpperCase() gerekebilir veriye göre
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

        // State güncelle
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

  // 2. Katılımcı Ekleme ve Dinleme Effect'i
  useEffect(() => {
    // roomId veya user yoksa işlem yapma
    if (!roomId || !user || !gameType) return;

    let unsubscribed = false;

    // Kendini odaya ekle (Eğer ekli değilse)
    const ensureSelfParticipant = async () => {
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
          console.log("✅ Katılımcı eklendi:", roomId);
        }
      } catch (e: any) {
        if (e?.code !== "23505") {
          // Unique violation değilse logla
          console.warn("ensureSelfParticipant warning:", e);
        }
      }
    };

    ensureSelfParticipant();

    // 2. Oyuncu kontrolü VE COUNTDOWN BAŞLATMA
    const checkAndNavigate = async () => {
      const { data: parts } = await supabase.from("game_participants").select("*").eq("room_id", roomId);

      if (!unsubscribed && parts && parts.length >= 2 && !navigated) {
        setNavigated(true);

        console.log("🎮 2. oyuncu katıldı, countdown başlatılıp GamePage'e yönlendiriliyor...");

        // 🎯 COUNTDOWN BAŞLATMA: GamePage'e yönlendirmeden ÖNCE countdown başlat
        // Bu sayede her iki oyuncu da GamePage'e geldiğinde buffer animasyonları senkronize çalışır
        try {
          // Önce mevcut countdown_started_at'ı kontrol et
          const { data: roomCheck } = await supabase
            .from("game_rooms")
            .select("countdown_started_at")
            .eq("id", roomId)
            .single();

          // Eğer countdown henüz başlamamışsa RPC ile başlat
          if (!roomCheck?.countdown_started_at) {
            console.log("⏱️ Countdown RPC ile başlatılıyor...");
            await supabase.rpc("start_game_countdown", { p_room_id: roomId });
          }
        } catch (err) {
          console.warn("Countdown başlatma hatası (devam ediliyor):", err);
        }

        // Yönlendir - GamePage countdown'ı alacak ve buffer animasyonlarını gösterecek
        const basePath = "/game/private-room";
        navigate(`${basePath}?room=${roomId}&type=${gameType}`);
      }
    };

    // İlk kontrol
    checkAndNavigate();

    // Realtime Dinleme
    const channel = supabase
      .channel(`room_waiting_${roomId}`)
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
          if (!navigated) {
            await checkAndNavigate();
          }
        },
      )
      .subscribe();

    return () => {
      unsubscribed = true;
      supabase.removeChannel(channel);
    };
  }, [roomId, gameType, user, navigate, navigated]);

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
                    {gameType === "timed" ? "⏱️ Zamana Karşı" : gameType === "score" ? "🏆 Puanlı" : "Yükleniyor..."}
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
