import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import { useSounds } from "@/hooks/useSounds";
import { UserAvatar } from "@/components/UserAvatar";
import { User, UserPlus, MessageCircle, Gamepad2, Check, Clock } from "lucide-react";
import { toast } from "sonner";

interface UserActionMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  username?: string;
  avatarUrl?: string | null;
  fromRoute?: string;
}

type FriendshipStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "self";

export function UserActionMenu({
  open,
  onOpenChange,
  userId,
  username,
  avatarUrl,
  fromRoute,
}: UserActionMenuProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playSound } = useSounds();
  const { sendFriendRequestNotification, sendMessageNotification } = useSmartNotifications();
  const [status, setStatus] = useState<FriendshipStatus>("none");
  const [busy, setBusy] = useState(false);

  const isSelf = !!user && !!userId && user.id === userId;

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

  const inviteToGame = async () => {
    if (!user || !userId || busy) return;
    playSound("buttonClick");
    close();
    toast("Oyuna davet için özel oda oluştur", {
      description: "Ana sayfadan özel oda aç, arkadaşını oradan davet edebilirsin.",
    });
    navigate("/");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-sm rounded-3xl border-0 p-0 shadow-2xl bg-[#16213e] ring-1 ring-white/10">
        <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center gap-3">
          <UserAvatar
            src={avatarUrl || undefined}
            alt={username || "Kullanıcı"}
            fallback={(username || "?").charAt(0).toUpperCase()}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate">{username || "Kullanıcı"}</p>
            <p className="text-[11px] text-slate-400">Ne yapmak istersin?</p>
          </div>
        </div>

        {isSelf ? (
          <div className="px-5 py-6 text-center text-slate-400 text-sm">Bu senin profilin</div>
        ) : (
          <div className="px-4 py-4 flex flex-col gap-2.5">
            <ActionRow
              dot="bg-indigo-400"
              icon={User}
              iconClass={toneMap.indigo}
              label="Profili Görüntüle"
              sub="Kullanıcı profiline git"
              onClick={viewProfile}
            />

            {friendLabel && (
              <ActionRow
                dot={friendLabel.tone === "amber" ? "bg-amber-400" : "bg-emerald-400"}
                icon={friendLabel.icon}
                iconClass={toneMap[friendLabel.tone]}
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
              label="Mesaj Gönder"
              sub="Özel sohbet aç"
              disabled={busy}
              onClick={sendMessage}
            />

            <ActionRow
              dot="bg-purple-400"
              icon={Gamepad2}
              iconClass={toneMap.purple}
              label="Oyuna Davet Et"
              sub="Özel oda daveti gönder"
              onClick={inviteToGame}
            />
          </div>
        )}

        <div className="h-2" />
      </DialogContent>
    </Dialog>
  );
}

function ActionRow({
  dot,
  icon: Icon,
  iconClass,
  label,
  sub,
  onClick,
  disabled,
}: {
  dot: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`flex items-center gap-3 select-none rounded-2xl px-3 py-3 ring-1 ring-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.3)] transition-colors duration-150 ${
        disabled
          ? "bg-white/[0.04] opacity-60 cursor-not-allowed"
          : "bg-white/8 hover:bg-white/12 hover:ring-white/20 cursor-pointer active:scale-95"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/95">{label}</p>
        <p className="text-[11px] text-slate-400">{sub}</p>
      </div>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
  );
}
