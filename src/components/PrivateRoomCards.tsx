import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSounds } from "@/hooks/useSounds";
import { toast as sonnerToast } from "sonner";
import FriendInviteDialog from "@/components/FriendInviteDialog";
import odaKurKart from "@/assets/odaKurKart.png";
import odayaKatilKart from "@/assets/odayaKatilKart.png";
import odaBeklemeKart from "@/assets/odaBeklemeKart.png";
import bekleyenOdaKart from "@/assets/bekleyenOdaKart.png";
import beklemeAramaAnim from "@/assets/ozelOdaBeklemeArama.json";
import beklemeHazirSvg from "@/assets/ozelOdaBeklemeHazir.svg";

interface PrivateRoomCardsProps {
  onClose: () => void;
}

/** Görselin üzerine yüzde koordinatlarla oturan görünmez katman */
const Hot = ({
  l,
  r,
  t,
  b,
  onClick,
  disabled,
  label,
  children,
}: {
  l: number;
  r: number;
  t: number;
  b: number;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  children?: React.ReactNode;
}) => {
  const style = {
    left: `${l * 100}%`,
    width: `${(r - l) * 100}%`,
    top: `${t * 100}%`,
    height: `${(b - t) * 100}%`,
  } as React.CSSProperties;

  if (children) {
    return (
      <div className="absolute flex items-center justify-center" style={style}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="absolute bg-transparent border-0 outline-none active:opacity-60 disabled:opacity-100"
      style={style}
    />
  );
};

const LETTER_POOL = [
  "A","A","E","E","İ","İ","I","O","U","L","L","N","R","K","M","T","S","D","Y","B","C","Ç","F","G","Ğ","H","P","Ş","V","Z",
];

const PrivateRoomCards = ({ onClose }: PrivateRoomCardsProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isPremium } = useUser();
  const { playSound } = useSounds();

  const [step, setStep] = useState<"choose" | "waiting">("choose");
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [pendingRoom, setPendingRoom] = useState<{ id: string; room_code: string } | null>(null);

  // waiting state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>("");
  const [participants, setParticipants] = useState<{ user_id: string | null; is_ready: boolean | null; is_bot: boolean | null }[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const navigatedRef = useRef(false);

  // --- Bekleyen oda kontrolü ---
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("game_rooms")
        .select("id, room_code")
        .eq("host_id", user.id)
        .eq("status", "waiting")
        .eq("game_mode", "private-room")
        .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.room_code) setPendingRoom({ id: data.id, room_code: data.room_code });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const hasCredit =
    Boolean(isPremium) ||
    (profile?.game_credits || 0) + (profile?.bonus_credits || 0) > 0 ||
    Boolean(profile?.unlimited_lives_until && new Date(profile.unlimited_lives_until) > new Date());

  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return out;
  };

  const handleCreate = async () => {
    if (loading || !user) return;
    playSound("buttonClick");
    if (!hasCredit) {
      sonnerToast.error("Oyun için sayfaların yetersiz!", {
        description: "Özel oda oluşturmak için hak satın alın veya dolmasını bekleyin.",
      });
      return;
    }
    setLoading(true);
    try {
      const newRoomId = crypto.randomUUID();
      const code = generateRoomCode();
      localStorage.setItem(`room_${code}`, newRoomId);
      localStorage.setItem(`room_type_${code}`, "timed");

      const grid: string[] = [];
      for (let i = 0; i < 16; i++) grid.push(LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)]);

      const { error } = await supabase.from("game_rooms").insert({
        id: newRoomId,
        room_code: code,
        host_id: user.id,
        game_mode: "private-room",
        game_type_new: "timed",
        status: "waiting",
        max_players: 2,
        time_limit: 120,
        max_score: 0,
        current_grid: grid,
      });
      if (error) throw error;

      await supabase.from("game_participants").insert({ room_id: newRoomId, user_id: user.id, is_ready: false });

      setRoomId(newRoomId);
      setRoomCode(code);
      setStep("waiting");
    } catch {
      sonnerToast.error("Oda oluşturulamadı");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (loading || !user || joinCode.trim().length < 3) return;
    playSound("buttonClick");
    setLoading(true);
    try {
      const code = joinCode.toUpperCase().trim();
      const { data: room } = await supabase
        .from("game_rooms")
        .select("id, room_code")
        .eq("room_code", code)
        .eq("status", "waiting")
        .maybeSingle();
      if (!room) throw new Error("Oda bulunamadı veya dolu");

      await supabase.from("game_participants").insert({ room_id: room.id, user_id: user.id, is_ready: false });
      setRoomId(room.id);
      setRoomCode(room.room_code);
      setStep("waiting");
    } catch (e: any) {
      sonnerToast.error(e?.message || "Odaya katılınamadı");
    } finally {
      setLoading(false);
    }
  };

  const resumeRoom = async () => {
    if (!pendingRoom || !user) return;
    playSound("buttonClick");
    setRoomId(pendingRoom.id);
    setRoomCode(pendingRoom.room_code);
    setStep("waiting");
  };

  const cancelPendingRoom = async () => {
    if (!pendingRoom) return;
    playSound("buttonClick");
    await supabase
      .from("game_rooms")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", pendingRoom.id);
    setPendingRoom(null);
  };

  // --- Bekleme odası senkronizasyonu ---
  const startGame = useCallback(async () => {
    if (!roomId || navigatedRef.current) return;
    navigatedRef.current = true;
    try {
      const { data: realPlayers } = await supabase
        .from("game_participants")
        .select("user_id, joined_at")
        .eq("room_id", roomId)
        .eq("is_bot", false)
        .order("joined_at", { ascending: true } as any);

      await supabase
        .from("game_rooms")
        .update({
          status: "active",
          player1_id: realPlayers?.[0]?.user_id || null,
          player2_id: realPlayers?.[1]?.user_id || null,
        })
        .eq("id", roomId);

      const { data: roomCheck } = await supabase
        .from("game_rooms")
        .select("countdown_started_at")
        .eq("id", roomId)
        .maybeSingle();
      if (!roomCheck?.countdown_started_at) {
        await supabase.rpc("start_game_countdown", { p_room_id: roomId });
      }
    } catch {
      /* devam */
    }
    navigate(`/game/private-room?room=${roomId}&type=timed`);
  }, [roomId, navigate]);

  useEffect(() => {
    if (step !== "waiting" || !roomId || !user) return;
    let cancelled = false;

    const ensureSelf = async () => {
      const { data: existing } = await supabase
        .from("game_participants")
        .select("id, is_ready")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!existing) {
        await supabase
          .from("game_participants")
          .insert({ room_id: roomId, user_id: user.id, score: 0, is_bot: false, is_ready: false });
      } else if (existing.is_ready) {
        setIsReady(true);
      }
    };
    ensureSelf();

    const fetchParts = async () => {
      const { data } = await supabase
        .from("game_participants")
        .select("user_id, is_ready, is_bot")
        .eq("room_id", roomId);
      if (cancelled || !data) return;
      setParticipants(data);
      const real = data.filter((p) => !p.is_bot);
      if (real.length >= 2 && real.every((p) => p.is_ready) && !navigatedRef.current) {
        startGame();
      }
    };
    fetchParts();

    const channel = supabase
      .channel(`private_cards_${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_participants", filter: `room_id=eq.${roomId}` },
        () => {
          if (!navigatedRef.current) fetchParts();
        },
      )
      .subscribe();

    const poll = setInterval(() => {
      if (!cancelled && !navigatedRef.current) fetchParts();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [step, roomId, user, startGame]);

  const handleReady = async () => {
    if (!roomId || !user || isReady) return;
    playSound("buttonClick");
    setIsReady(true);
    await supabase
      .from("game_participants")
      .update({ is_ready: true })
      .eq("room_id", roomId)
      .eq("user_id", user.id);
  };

  const handleLeave = async () => {
    playSound("buttonClick");
    if (roomId && user) {
      await supabase.from("game_participants").delete().eq("room_id", roomId).eq("user_id", user.id);
    }
    onClose();
  };

  const real = participants.filter((p) => !p.is_bot);
  const opponent = real.find((p) => p.user_id !== user?.id);
  const opponentJoined = Boolean(opponent);
  const opponentReady = Boolean(opponent?.is_ready);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
      {step === "choose" ? (
        <div className="w-full max-w-[980px] flex items-center justify-center gap-2 sm:gap-4">
          {/* ODA KUR */}
          <div className="relative flex-1 max-w-[300px]">
            <img src={odaKurKart} alt="Oda Kur" className="w-full h-auto select-none pointer-events-none" />
            <Hot l={0.104} r={0.489} t={0.822} b={0.916} label="Odayı Oluştur" onClick={handleCreate} disabled={loading} />
            <Hot
              l={0.524}
              r={0.899}
              t={0.824}
              b={0.918}
              label="İptal"
              onClick={() => {
                playSound("buttonClick");
                onClose();
              }}
            />
          </div>

          {/* ODAYA KATIL */}
          <div className="relative flex-1 max-w-[300px]">
            <img src={odayaKatilKart} alt="Odaya Katıl" className="w-full h-auto select-none pointer-events-none" />
            <Hot l={0.152} r={0.846} t={0.682} b={0.771}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                maxLength={6}
                autoCapitalize="characters"
                aria-label="Oda kodu"
                className="w-full h-full bg-transparent border-0 outline-none text-center text-[#0f2a22] font-black tracking-[0.25em] text-[clamp(12px,4vw,22px)]"
              />
            </Hot>
            <Hot l={0.101} r={0.486} t={0.822} b={0.916} label="Odaya Katıl" onClick={handleJoin} disabled={loading} />
            <Hot
              l={0.522}
              r={0.896}
              t={0.824}
              b={0.918}
              label="İptal"
              onClick={() => {
                playSound("buttonClick");
                onClose();
              }}
            />
          </div>

          {/* BEKLEYEN ODA */}
          {pendingRoom && (
            <div className="relative flex-1 max-w-[300px]">
              <img src={bekleyenOdaKart} alt="Bekleyen Oda" className="w-full h-auto select-none pointer-events-none" />
              <Hot l={0.13} r={0.369} t={0.33} b={0.399}>
                <span className="font-black tracking-[0.15em] text-[#0f2a22] text-[clamp(10px,3vw,18px)]">
                  {pendingRoom.room_code}
                </span>
              </Hot>
              <Hot l={0.092} r={0.494} t={0.801} b={0.91} label="Odama Dön" onClick={resumeRoom} />
              <Hot l={0.511} r={0.927} t={0.801} b={0.91} label="Odayı İptal Et" onClick={cancelPendingRoom} />
            </div>
          )}
        </div>
      ) : (
        <div className="relative w-full max-w-[420px]">
          <img src={odaBeklemeKart} alt="Oda Bekleniyor" className="w-full h-auto select-none pointer-events-none" />

          {/* Oda kodu */}
          <Hot l={0.144} r={0.863} t={0.281} b={0.352}>
            <span className="font-black tracking-[0.3em] text-[#0f2a22] text-[clamp(14px,5vw,26px)]">{roomCode}</span>
          </Hot>

          {/* Arkadaşını davet et */}
          <Hot
            l={0.247}
            r={0.759}
            t={0.386}
            b={0.451}
            label="Arkadaşını Davet Et"
            onClick={() => {
              playSound("buttonClick");
              setInviteOpen(true);
            }}
          />

          {/* Katılımcı durum kutuları */}
          <Hot l={0.141} r={0.491} t={0.489} b={0.661}>
            <span className="text-center font-black leading-tight text-[clamp(9px,2.6vw,13px)] text-white drop-shadow">
              {isReady ? "HAZIR" : "BEKLENİYOR"}
            </span>
          </Hot>
          <Hot l={0.52} r={0.874} t={0.489} b={0.661}>
            <span className="text-center font-black leading-tight text-[clamp(9px,2.6vw,13px)] text-white drop-shadow">
              {!opponentJoined ? "BEKLENİYOR" : opponentReady ? "HAZIR" : "KATILDI"}
            </span>
          </Hot>

          {/* HAZIRIM / ÇIK */}
          <Hot l={0.114} r={0.486} t={0.793} b={0.893} label="Hazırım" onClick={handleReady} disabled={isReady} />
          <Hot l={0.52} r={0.893} t={0.793} b={0.911} label="Çık" onClick={handleLeave} />

          {roomCode && (
            <FriendInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roomCode={roomCode} gameType="timed" />
          )}
        </div>
      )}
    </div>
  );
};

export default PrivateRoomCards;
