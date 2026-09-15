import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Lottie from "lottie-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { toast as sonnerToast } from "sonner";
import FriendInviteDialog from "@/components/FriendInviteDialog";
import { PressableZone } from "@/components/ui/pressable-zone";
import odaKurKart from "@/assets/odaKurKart.webp";
import odayaKatilKart from "@/assets/odayaKatilKart.webp";
import odaBeklemeKart from "@/assets/odaBeklemeKart.webp";
import bekleyenOdaKart from "@/assets/bekleyenOdaKart.webp";
import beklemeAramaAnim from "@/assets/ozelOdaBeklemeArama.json";
import yukleniyorAnim from "@/assets/ozelOdaYukleniyor.json";
import beklemeHazirSvg from "@/assets/ozelOdaBeklemeHazir.svg";
import arkadasinGeldiGorsel from "@/assets/arkadasinGeldiGorsel.webp";
import arkadasinOdadanAyrildiGorsel from "@/assets/arkadasinOdadanAyrildiGorsel.webp";

interface PrivateRoomCardsProps {
  onClose: () => void;
  /** Doğrudan bekleme ekranıyla açmak için (rematch / davet akışları) */
  initialRoomId?: string | null;
  initialRoomCode?: string | null;
  gameType?: "timed" | "score";
  /** Bilgisayara karşı rematch: bot hazır olduğunda tek gerçek oyuncuyla başlar */
  botRematch?: boolean;
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
    <PressableZone
      label={label || "buton"}
      onPress={onClick}
      disabled={disabled}
      className="disabled:opacity-100"
      style={style}
    />
  );
};

const LETTER_POOL = [
  "A","A","E","E","İ","İ","I","O","U","L","L","N","R","K","M","T","S","D","Y","B","C","Ç","F","G","Ğ","H","P","Ş","V","Z",
];

const PrivateRoomCards = ({
  onClose,
  initialRoomId = null,
  initialRoomCode = null,
  gameType = "timed",
  botRematch = false,
}: PrivateRoomCardsProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isPremium } = useUser();

  const hasInitialRoom = Boolean(initialRoomId || initialRoomCode);
  const [step, setStep] = useState<"choose" | "waiting">(hasInitialRoom ? "waiting" : "choose");
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [pendingRoom, setPendingRoom] = useState<{ id: string; room_code: string } | null>(null);
  const [checkingPending, setCheckingPending] = useState(!hasInitialRoom);

  // waiting state
  const [roomId, setRoomId] = useState<string | null>(initialRoomId);
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode || "");
  const [participants, setParticipants] = useState<{ user_id: string | null; is_ready: boolean | null; is_bot: boolean | null }[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [opponentProfile, setOpponentProfile] = useState<{ avatar_url: string | null; username: string | null } | null>(null);
  const [friendArrivedAnim, setFriendArrivedAnim] = useState(false);
  const [friendLeftAnim, setFriendLeftAnim] = useState(false);
  const navigatedRef = useRef(false);
  const prevOpponentJoinedRef = useRef(false);


  // --- Bekleyen oda kontrolü ---
  useEffect(() => {
    if (hasInitialRoom) return;
    if (!user) {
      setCheckingPending(false);
      return;
    }
    let cancelled = false;
    setCheckingPending(true);
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
      if (cancelled) return;
      if (data?.room_code) setPendingRoom({ id: data.id, room_code: data.room_code });
      setCheckingPending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, hasInitialRoom]);

  // Sadece oda kodu verildiyse roomId'yi çöz
  useEffect(() => {
    if (roomId || !initialRoomCode) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("game_rooms")
        .select("id, room_code")
        .eq("room_code", initialRoomCode)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data?.id) {
        setRoomId(data.id);
        setRoomCode(data.room_code);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, initialRoomCode]);

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
    setRoomId(pendingRoom.id);
    setRoomCode(pendingRoom.room_code);
    setStep("waiting");
  };

  const cancelPendingRoom = async () => {
    if (!pendingRoom) return;
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
    navigate(`/game/private-room?room=${roomId}&type=${gameType}`);
  }, [roomId, navigate, gameType]);

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
      const hasReadyBot = data.some((p) => p.is_bot && p.is_ready);
      const allReady = botRematch
        ? real.length >= 1 && hasReadyBot && real.every((p) => p.is_ready)
        : real.length >= 2 && real.every((p) => p.is_ready);
      if (allReady && !navigatedRef.current) {
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
  }, [step, roomId, user, startGame, botRematch]);

  const handleReady = async () => {
    if (!roomId || !user || isReady) return;
    setIsReady(true);
    await supabase
      .from("game_participants")
      .update({ is_ready: true })
      .eq("room_id", roomId)
      .eq("user_id", user.id);
  };

  const handleLeave = async () => {
    if (roomId && user) {
      await supabase.from("game_participants").delete().eq("room_id", roomId).eq("user_id", user.id);
    }
    onClose();
  };

  const real = participants.filter((p) => !p.is_bot);
  const bot = participants.find((p) => p.is_bot);
  const humanOpponent = real.find((p) => p.user_id !== user?.id);
  const opponent = humanOpponent || (botRematch ? bot : undefined);
  const opponentJoined = Boolean(opponent);
  const opponentReady = Boolean(opponent?.is_ready) || Boolean(botRematch && bot);
  const opponentUserId = humanOpponent?.user_id || null;

  useEffect(() => {
    if (opponentJoined && !prevOpponentJoinedRef.current) {
      setFriendArrivedAnim(true);
    } else if (!opponentJoined && prevOpponentJoinedRef.current) {
      setFriendLeftAnim(true);
    }
    prevOpponentJoinedRef.current = opponentJoined;
  }, [opponentJoined]);

  useEffect(() => {
    if (!opponentUserId) {
      setOpponentProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("avatar_url, username")
        .eq("id", opponentUserId)
        .maybeSingle();
      if (!cancelled && data) setOpponentProfile({ avatar_url: data.avatar_url, username: data.username });
    })();
    return () => {
      cancelled = true;
    };
  }, [opponentUserId]);



  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
      {/* Kart genişliğine bağlı (container) yazı ölçekleme: her telefonda konum sabit */}
      <style>{`
        .pr-card { container-type: inline-size; }
        .pr-code { font-size: clamp(10px, 3.4vw, 18px); }
        @supports (font-size: 1cqw) { .pr-code { font-size: 5.4cqw; } }
        .pr-code-lg { font-size: clamp(13px, 4.6vw, 24px); }
        @supports (font-size: 1cqw) { .pr-code-lg { font-size: 5.8cqw; } }
        .pr-code-input { font-size: clamp(12px, 4vw, 22px); }
        @supports (font-size: 1cqw) { .pr-code-input { font-size: 7cqw; } }
        @keyframes prSlideLeft {
          0%   { opacity: 0; transform: translate3d(-120%, 0, 0) scale(0.94); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes prSlideRight {
          0%   { opacity: 0; transform: translate3d(120%, 0, 0) scale(0.94); }
          100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        .pr-in-left  { animation: prSlideLeft 460ms cubic-bezier(0.22,1,0.36,1) both; }
        .pr-in-right { animation: prSlideRight 460ms cubic-bezier(0.22,1,0.36,1) both; animation-delay: 170ms; }
        @keyframes friendArrivedSlide {
          0%   { left: -36%; opacity: 0; transform: translateX(-50%); }
          12%  { left: 50%; opacity: 1; transform: translateX(-50%); }
          88%  { left: 50%; opacity: 1; transform: translateX(-50%); }
          100% { left: 136%; opacity: 0; transform: translateX(-50%); }
        }
        .friend-arrived-slide { animation: friendArrivedSlide 3s ease-in-out forwards; }
      `}</style>
      {step === "choose" ? (
        checkingPending ? (
          <div className="flex flex-col items-center justify-center gap-1 animate-in fade-in duration-200">
            <Lottie animationData={yukleniyorAnim} loop autoplay style={{ width: 120, height: 120 }} />
            <span className="text-white/80 text-sm font-semibold tracking-wide">Yükleniyor</span>
          </div>
        ) : pendingRoom ? (
          /* SADECE BEKLEYEN ODA */
          <div className="pr-card pr-in-left relative w-full max-w-[340px]">
            <img src={bekleyenOdaKart} alt="Bekleyen Oda" className="w-full h-auto select-none pointer-events-none" />
            <Hot l={0.128} r={0.364} t={0.328} b={0.383}>
              <span className="pr-code font-black tracking-[0.12em] text-[#0f2a22] text-center w-full leading-none whitespace-nowrap">
                {pendingRoom.room_code}
              </span>
            </Hot>

            <Hot l={0.092} r={0.494} t={0.801} b={0.91} label="Odama Dön" onClick={resumeRoom} />
            <Hot l={0.511} r={0.927} t={0.801} b={0.91} label="Odayı İptal Et" onClick={cancelPendingRoom} />
          </div>
        ) : (
          <div className="w-full max-w-[980px] flex items-center justify-center gap-2 sm:gap-4 overflow-hidden">
            {/* ODA KUR */}
            <div className="pr-in-left relative flex-1 max-w-[300px]">
              <img src={odaKurKart} alt="Oda Kur" className="w-full h-auto select-none pointer-events-none" />
              <Hot l={0.104} r={0.489} t={0.822} b={0.916} label="Odayı Oluştur" onClick={handleCreate} disabled={loading} />
              <Hot
                l={0.524}
                r={0.899}
                t={0.824}
                b={0.918}
                label="İptal"
                onClick={() => {
                                onClose();
                }}
              />
            </div>

            {/* ODAYA KATIL */}
            <div className="pr-card pr-in-right relative flex-1 max-w-[300px]">
              <img src={odayaKatilKart} alt="Odaya Katıl" className="w-full h-auto select-none pointer-events-none" />
              <Hot l={0.152} r={0.846} t={0.682} b={0.771}>
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  maxLength={6}
                  autoCapitalize="characters"
                  aria-label="Oda kodu"
                  className="pr-code-input w-full h-full bg-transparent border-0 outline-none text-center text-[#0f2a22] font-black tracking-[0.25em] leading-none"
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
                                onClose();
                }}
              />
            </div>
          </div>
        )
      ) : (
        <div className="pr-card relative w-full max-w-[420px] -mt-10 animate-in fade-in zoom-in-95 duration-300">

          <img src={odaBeklemeKart} alt="Oda Bekleniyor" className="w-full h-auto select-none pointer-events-none" />

          {/* Oda kodu */}
          <div
            className="absolute flex items-center"
            style={{ left: "49%", right: "12%", top: "27.3%", height: "7.9%" }}
          >
            <span className="pr-code-lg font-black tracking-[0.28em] text-[#0f2a22] leading-none whitespace-nowrap">
              {roomCode}
            </span>
          </div>


          {/* Arkadaşını davet et */}
          <Hot
            l={0.241}
            r={0.765}
            t={0.39}
            b={0.443}
            label="Arkadaşını Davet Et"
            onClick={() => {
                        setInviteOpen(true);
            }}
          />

          {/* Katılımcı durum kutuları */}
          <Hot l={0.1312} r={0.4537} t={0.5053} b={0.7335}>
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-white">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username || "Sen"}
                    className={`w-full h-full object-cover select-none pointer-events-none transition-all duration-300 ${
                      isReady ? "opacity-40 saturate-50" : ""
                    }`}
                  />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center bg-[#1e2d45] text-white font-black text-2xl transition-all duration-300 ${
                      isReady ? "opacity-40 saturate-50" : ""
                    }`}
                  >
                    {(profile?.username || "S").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {isReady && (
                <img
                  src={beklemeHazirSvg}
                  alt="Hazır"
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[52%] h-auto select-none pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
                />
              )}
            </div>
          </Hot>
          <Hot l={0.5463} r={0.8688} t={0.5053} b={0.7335}>
            {opponentJoined ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-white">
                  {opponentProfile?.avatar_url ? (
                    <img
                      src={opponentProfile.avatar_url}
                      alt={opponentProfile.username || "Rakip"}
                      className={`w-full h-full object-cover select-none pointer-events-none transition-all duration-300 ${
                        opponentReady ? "opacity-40 saturate-50" : ""
                      }`}
                    />
                  ) : (
                    <div
                      className={`w-full h-full flex items-center justify-center bg-[#1e2d45] text-white font-black text-2xl transition-all duration-300 ${
                        opponentReady ? "opacity-40 saturate-50" : ""
                      }`}
                    >
                      {(opponentProfile?.username || "R").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                {opponentReady && (
                  <img
                    src={beklemeHazirSvg}
                    alt="Hazır"
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[52%] h-auto select-none pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
                  />
                )}
              </div>
            ) : (
              <Lottie
                animationData={beklemeAramaAnim}
                loop
                autoplay
                rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
                style={{ width: "78%", height: "78%" }}
              />
            )}
          </Hot>



          {/* HAZIRIM / ÇIK */}
          <Hot l={0.102} r={0.494} t={0.8} b={0.906} label="Hazırım" onClick={handleReady} disabled={isReady} />
          <Hot l={0.519} r={0.91} t={0.8} b={0.906} label="Çık" onClick={handleLeave} />


          {/* Arkadaşın geldi kayan görsel */}
          {friendArrivedAnim && (
            <div className="absolute left-1/2 -translate-x-1/2 w-screen top-[100%] mt-4 pointer-events-none z-30 flex items-start justify-center">
              <img
                src={arkadasinGeldiGorsel}
                alt="Arkadaşın geldi"
                className="friend-arrived-slide absolute top-0 left-1/2 -translate-x-1/2 w-[72%] max-w-[340px] h-auto select-none"
                onAnimationEnd={() => setFriendArrivedAnim(false)}
              />
            </div>
          )}

          {friendLeftAnim && (
            <div className="absolute left-1/2 -translate-x-1/2 w-screen top-[100%] mt-4 pointer-events-none z-30 flex items-start justify-center">
              <img
                src={arkadasinOdadanAyrildiGorsel}
                alt="Arkadaş odadan ayrıldı"
                className="friend-arrived-slide absolute top-0 left-1/2 -translate-x-1/2 w-[72%] max-w-[340px] h-auto select-none"
                onAnimationEnd={() => setFriendLeftAnim(false)}
              />
            </div>
          )}

          {roomCode && (
            <FriendInviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roomCode={roomCode} gameType={gameType} variant="card" />
          )}

        </div>
      )}
    </div>
  );
};

export default PrivateRoomCards;
