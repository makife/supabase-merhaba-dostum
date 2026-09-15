import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import { useSounds } from "@/hooks/useSounds";
import { UserAvatar } from "@/components/UserAvatar";
import { User, UserPlus, MessageCircle, Gamepad2, Check, Clock } from "lucide-react";
import { toast } from "sonner";

export interface AnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface UserActionMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  username?: string;
  avatarUrl?: string | null;
  fromRoute?: string;
  /** Bounding rect (from e.currentTarget.getBoundingClientRect()) of the avatar that was clicked.
   *  The menu anchors itself right next to this instead of centering on screen. */
  anchorRect?: AnchorRect | null;
}

type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "self";

export function UserActionMenu({
  open,
  onOpenChange,
  userId,
  username,
  avatarUrl,
  fromRoute,
  anchorRect,
}: UserActionMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isPremium } = useUser();
  const { playSound } = useSounds();
  const { sendFriendRequestNotification, sendMessageNotification, sendGameInviteNotification } =
    useSmartNotifications();
  const [status, setStatus] = useState<FriendshipStatus>("none");
  const [busy, setBusy] = useState(false);
  const [acceptsGameInvites, setAcceptsGameInvites] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({
    position: "fixed",
    top: -9999,
    left: -9999,
    opacity: 0,
  });
  const [arrow, setArrow] = useState<{ left: number; placement: "top" | "bottom" }>({
    left: 24,
    placement: "top",
  });

  const isSelf = !!user && !!userId && user.id === userId;

  // Position the popover next to the clicked avatar (anchorRect), clamped to viewport.
  useLayoutEffect(() => {
    if (!open || !anchorRect || !menuRef.current) return;

    const reposition = () => {
      const menu = menuRef.current;
      if (!menu) return;
      const menuW = menu.offsetWidth;
      const menuH = menu.offsetHeight;
      const gap = 10;
      const margin = 8;

      let left = anchorRect.left + anchorRect.width / 2 - menuW / 2;
      left = Math.min(Math.max(left, margin), window.innerWidth - menuW - margin);

      let top = anchorRect.top - menuH - gap;
      let placement: "top" | "bottom" = "top";
      if (top < margin) {
        top = anchorRect.bottom + gap;
        placement = "bottom";
      }
      if (top + menuH > window.innerHeight - margin) {
        top = Math.max(window.innerHeight - menuH - margin, margin);
      }

      setPopStyle({
        position: "fixed",
        top,
        left,
        opacity: 1,
        transform: "translateY(0)",
        transition: "opacity 120ms ease, transform 120ms ease",
      });
      setArrow({
        left: Math.min(
          Math.max(anchorRect.left + anchorRect.width / 2 - left, 16),
          menuW - 16,
        ),
        placement,
      });
    };

    // Start slightly offset + transparent, then snap into place (no visible centered flash).
    setPopStyle((s) => ({ ...s, position: "fixed", top: anchorRect.top, left: anchorRect.left, opacity: 0 }));
    const raf = requestAnimationFrame(reposition);

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, anchorRect]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || !user || !userId) return;
    if (isSelf) {
      setStatus("self");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("friendships")
        .select("id, user_id, friend_id, status")
        .or(
          `and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`,
        )
        .maybeSingle();
      if (cancelled) return;
      if (!data) return setStatus("none");
      if (data.status === "accepted") setStatus("accepted");
      else if (data.status === "pending" && data.user_id === user.id) setStatus("pending_sent");
      else setStatus("pending_received");
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, userId, isSelf]);

  useEffect(() => {
    if (!open || !userId || isSelf) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("accepts_game_invites")
        .eq("id", userId)
        .single();
      if (cancelled) return;
      setAcceptsGameInvites(data?.accepts_game_invites !== false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, userId, isSelf]);

  const close = () => onOpenChange(false);

  const viewProfile = () => {
    if (!userId) return;
    playSound("buttonClick");
    close();
    navigate(`/profile/${userId}`, fromRoute ? { state: { from: fromRoute } } : undefined);
  };

  const addFriend = async () => {
    if (!user || !userId || busy) return;
    playSound("buttonClick");
    setBusy(true);
    const { error } = await supabase.from("friendships").insert({
      user_id: user.id,
      friend_id: userId,
      status: "pending",
    });
    if (error) {
      if (error.code === "23505") toast.error("Zaten bir davet mevcut");
      else toast.error("Davet gönderilemedi");
    } else {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      const senderName = myProfile?.username || "Bir oyuncu";
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "friend_request",
        message: `${senderName} sana arkadaşlık daveti gönderdi!`,
        related_id: user.id,
      });
      await sendFriendRequestNotification(userId, senderName);
      toast.success("Arkadaşlık daveti gönderildi! 🤝");
      setStatus("pending_sent");
    }
    setBusy(false);
  };

  const sendMessage = async () => {
    if (!user || !userId || busy) return;
    playSound("buttonClick");
    setBusy(true);
    try {
      const participants = [user.id, userId].sort();
      const chatId = `chat_${participants.join("_")}`;
      const { data: existingChat } = await supabase
        .from("private_chats")
        .select("id")
        .eq("id", chatId)
        .maybeSingle();
      if (!existingChat) {
        await supabase.from("private_chats").insert({
          id: chatId,
          user1_id: participants[0],
          user2_id: participants[1],
        });
      }
      close();
      navigate(`/chat?openPrivateChat=${userId}`);
    } catch {
      toast.error("Sohbet açılamadı");
    }
    setBusy(false);
  };

  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const inviteToGame = async () => {
    if (!user || !userId || busy || !acceptsGameInvites) return;

    if (!isPremium && (profile?.game_credits || 0) + (profile?.bonus_credits || 0) <= 0) {
      playSound("buttonClick");
      toast.error("Oyun için sayfaların yetersiz!", {
        description: "Özel oda oluşturmak için hak satın alın veya dolmasını bekleyin.",
      });
      return;
    }

    playSound("buttonClick");
    setBusy(true);
    try {
      // Zaten bekleyen (waiting) bir odan varsa yeni oda açmak yerine ona davet gönder,
      // böylece art arda birden fazla kişiye davet gönderince sahipsiz odalar birikmez.
      const { data: existingRoom } = await supabase
        .from("game_rooms")
        .select("id, room_code")
        .eq("host_id", user.id)
        .eq("status", "waiting")
        .eq("game_mode", "private-room")
        .gte("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let shortCode: string;

      if (existingRoom?.room_code) {
        shortCode = existingRoom.room_code;
      } else {
        const roomId = crypto.randomUUID();
        shortCode = generateRoomCode();

        localStorage.setItem(`room_${shortCode}`, roomId);
        localStorage.setItem(`room_type_${shortCode}`, "timed");

        const letterPool = [
          "A", "A", "E", "E", "İ", "İ", "I", "O", "U", "L", "L", "N", "R", "K", "M",
          "T", "S", "D", "Y", "B", "C", "Ç", "F", "G", "Ğ", "H", "P", "Ş", "V", "Z",
        ];
        const grid: string[] = [];
        for (let i = 0; i < 16; i++) {
          grid.push(letterPool[Math.floor(Math.random() * letterPool.length)]);
        }

        const { error: roomError } = await supabase.from("game_rooms").insert({
          id: roomId,
          room_code: shortCode,
          host_id: user.id,
          game_mode: "private-room",
          game_type_new: "timed",
          status: "waiting",
          max_players: 2,
          time_limit: 120,
          max_score: 0,
          current_grid: grid,
        });
        if (roomError) throw roomError;

        await supabase.from("game_participants").insert({
          room_id: roomId,
          user_id: user.id,
        });
      }

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      const senderName = myProfile?.username || "Bir oyuncu";

      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: userId,
        type: "room_invite",
        message: `${senderName} seni özel odaya davet ediyor! Kod: ${shortCode}`,
        related_id: shortCode,
        is_read: false,
      });
      if (notifError) {
        console.error("Bildirim kaydı oluşturulamadı:", notifError);
        toast.error("Davet gönderilemedi", { description: notifError.message });
        setBusy(false);
        return;
      }

      try {
        await sendGameInviteNotification(userId, senderName, shortCode);
      } catch (pushErr) {
        // In-app bildirim kaydı başarılı oldu (yukarıda), yalnızca push gönderimi
        // başarısız oldu — kullanıcı çevrimiçiyse yine de görecek, o yüzden akışı
        // burada durdurmuyoruz ama loglayıp haber veriyoruz.
        console.error("Push bildirimi gönderilemedi:", pushErr);
        toast.error("Davet gönderildi ama push bildirimi başarısız oldu");
      }

      toast.success("Oyun daveti gönderildi! 🎮");
      close();
      navigate(`/private-room/waiting/${shortCode}`);
    } catch (error) {
      console.error("Oyun daveti hatası:", error);
      toast.error("Davet gönderilemedi");
    } finally {
      setBusy(false);
    }
  };

  const friendLabel =
    status === "self"
      ? null
      : status === "accepted"
        ? { icon: Check, label: "Arkadaşınız", disabled: true, tone: "emerald" as const }
        : status === "pending_sent"
          ? { icon: Clock, label: "Davet Gönderildi", disabled: true, tone: "amber" as const }
          : status === "pending_received"
            ? { icon: UserPlus, label: "İsteği Yanıtla", disabled: false, tone: "green" as const }
            : { icon: UserPlus, label: "Arkadaş Ekle", disabled: false, tone: "green" as const };

  const toneMap: Record<string, string> = {
    indigo: "bg-indigo-500/20 text-indigo-300",
    green: "bg-emerald-500/20 text-emerald-300",
    amber: "bg-amber-500/20 text-amber-300",
    emerald: "bg-emerald-500/20 text-emerald-300",
    cyan: "bg-cyan-500/20 text-cyan-300",
    purple: "bg-purple-500/20 text-purple-300",
  };

  const rowTintMap: Record<string, string> = {
    indigo: "bg-indigo-500/10 hover:bg-indigo-500/15",
    green: "bg-emerald-500/10 hover:bg-emerald-500/15",
    amber: "bg-amber-500/10 hover:bg-amber-500/15",
    emerald: "bg-emerald-500/10 hover:bg-emerald-500/15",
    cyan: "bg-cyan-500/10 hover:bg-cyan-500/15",
    purple: "bg-purple-500/10 hover:bg-purple-500/15",
  };

  if (!open) return null;

  return createPortal(
    <>
      {/* Invisible backdrop: click anywhere outside to close, no dark overlay */}
      <div className="fixed inset-0 z-[100]" onClick={close} />

      <div
        ref={menuRef}
        style={popStyle}
        className="relative z-[101] w-32 max-w-[calc(100vw-16px)] rounded-xl border-0 shadow-2xl bg-[#16213e] ring-2 ring-white/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Little caret pointing at the avatar that was clicked */}
        <div
          className="absolute w-1.5 h-1.5 bg-[#16213e] ring-2 ring-white/80 rotate-45"
          style={{
            left: arrow.left - 3,
            ...(arrow.placement === "top"
              ? { bottom: -3, clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }
              : { top: -3, clipPath: "polygon(0 0, 100% 0, 0 100%)" }),
          }}
        />

        <div className="px-2 pt-2 pb-1.5 border-b border-white/5 flex items-center gap-1.5">
          <UserAvatar
            src={avatarUrl || undefined}
            alt={username || "Kullanıcı"}
            fallback={(username || "?").charAt(0).toUpperCase()}
            size="sm"
            className="!w-5 !h-5"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-white truncate">{username || "Kullanıcı"}</p>
            <p className="text-[7px] text-slate-400">Ne yapmak istersin?</p>
          </div>
        </div>

        {isSelf ? (
          <div className="px-2 py-2.5 text-center text-slate-400 text-[10px]">Bu senin profilin</div>
        ) : (
          <div className="px-1.5 py-1.5 flex flex-col gap-1">
            <ActionRow
              dot="bg-indigo-400"
              icon={User}
              iconClass={toneMap.indigo}
              tint={rowTintMap.indigo}
              label="Profili Görüntüle"
              sub="Kullanıcı profiline git"
              onClick={viewProfile}
            />

            {friendLabel && (
              <ActionRow
                dot={friendLabel.tone === "amber" ? "bg-amber-400" : "bg-emerald-400"}
                icon={friendLabel.icon}
                iconClass={toneMap[friendLabel.tone]}
                tint={rowTintMap[friendLabel.tone]}
                label={friendLabel.label}
                sub={
                  status === "accepted"
                    ? "Zaten arkadaşsınız"
                    : status === "pending_sent"
                      ? "Yanıt bekleniyor"
                      : status === "pending_received"
                        ? "Sana arkadaşlık daveti gönderdi"
                        : "Arkadaşlık daveti gönder"
                }
                disabled={friendLabel.disabled || busy}
                onClick={status === "pending_received" ? viewProfile : addFriend}
              />
            )}

            <ActionRow
              dot="bg-cyan-400"
              icon={MessageCircle}
              iconClass={toneMap.cyan}
              tint={rowTintMap.cyan}
              label="Mesaj Gönder"
              sub="Özel sohbet aç"
              disabled={busy}
              onClick={sendMessage}
            />

            <ActionRow
              dot="bg-purple-400"
              icon={Gamepad2}
              iconClass={toneMap.purple}
              tint={rowTintMap.purple}
              label="Oyuna Davet Et"
              sub={acceptsGameInvites ? "Özel odaya davet gönder" : "Oyun davetlerini kapattı"}
              disabled={busy || !acceptsGameInvites}
              onClick={inviteToGame}
            />
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

function ActionRow({
  dot,
  icon: Icon,
  iconClass,
  tint,
  label,
  sub,
  onClick,
  disabled,
}: {
  dot: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  tint: string;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`flex items-center gap-1.5 select-none rounded-lg px-1.5 py-1.5 ring-1 ring-white/10 shadow-[0_1px_6px_rgba(0,0,0,0.3)] transition-colors duration-150 ${
        disabled
          ? "bg-white/[0.04] opacity-60 cursor-not-allowed"
          : `${tint} hover:ring-white/20 cursor-pointer active:scale-95`
      }`}
    >
      <span className={`w-1 h-1 rounded-full flex-shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-white/95 truncate">{label}</p>
        <p className="text-[7px] text-slate-400 truncate">{sub}</p>
      </div>
      <div className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-2 h-2" />
      </div>
    </div>
  );
}
