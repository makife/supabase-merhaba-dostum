import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Circle, Loader2, Users, Check } from "lucide-react";
import { toast } from "sonner";

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
}

interface FriendInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomCode: string;
  gameType: string | null;
}

const FriendInviteDialog = ({ open, onOpenChange, roomCode, gameType }: FriendInviteDialogProps) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data } = await supabase
        .from("friendships")
        .select("id, user_id, friend_id, status")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq("status", "accepted");

      if (!data || data.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const friendIds = data.map((f) => (f.user_id === user.id ? f.friend_id : f.user_id));

      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const [{ data: profiles }, { data: presenceData }] = await Promise.all([
        supabase.from("profiles").select("id, username, avatar_url").in("id", friendIds),
        supabase.from("user_presence").select("user_id").in("user_id", friendIds).eq("is_online", true).gte("last_seen", oneMinuteAgo),
      ]);

      const onlineSet = new Set(presenceData?.map((p) => p.user_id) || []);

      const items: Friend[] = (profiles || []).map((p) => {
        return {
          id: p.id,
          username: p.username || "Oyuncu",
          avatar_url: p.avatar_url,
          is_online: onlineSet.has(p.id),
        };
      });

      // Online first
      items.sort((a, b) => (a.is_online === b.is_online ? 0 : a.is_online ? -1 : 1));
      setFriends(items);
    } catch (err) {
      console.error("Arkadaş listesi hatası:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      fetchFriends();
      setInvitedIds(new Set());
    }
  }, [open, fetchFriends]);

  const handleInvite = async (friend: Friend) => {
    if (!user || sendingId) return;
    setSendingId(friend.id);

    try {
      // Check if this friend has rejected an invite for this room code recently (within 10 minutes)
      const { data: rejections } = await supabase
        .from("room_invite_rejections")
        .select("id, created_at")
        .eq("room_code", roomCode)
        .eq("rejected_by", friend.id)
        .eq("rejected_from", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (rejections && rejections.length > 0) {
        const rejectedAt = new Date(rejections[0].created_at).getTime();
        const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
        if (rejectedAt > tenMinutesAgo) {
          toast.error(`${friend.username} bu oda davetini reddetti. 10 dakika bekleyin.`);
          setSendingId(null);
          return;
        }
      }

      // Get current user's username
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      const senderName = myProfile?.username || "Bir oyuncu";

      await supabase.from("notifications").insert({
        user_id: friend.id,
        type: "room_invite",
        message: `${senderName} seni özel odaya davet ediyor! Kod: ${roomCode}`,
        related_id: roomCode,
        is_read: false,
      });

      setInvitedIds((prev) => new Set(prev).add(friend.id));
      toast.success(`${friend.username} adlı arkadaşına davet gönderildi!`);
    } catch (err) {
      console.error("Davet gönderme hatası:", err);
      toast.error("Davet gönderilemedi");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-white/10 text-white max-w-md max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Users className="w-5 h-5 text-cyan-400" />
            Arkadaşını Davet Et
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Users className="w-10 h-10 mx-auto text-zinc-600" />
              <p className="text-zinc-500 text-sm">Henüz arkadaşınız yok</p>
            </div>
          ) : (
            friends.map((friend) => {
              const invited = invitedIds.has(friend.id);
              return (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
                >
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={friend.avatar_url || ""} />
                      <AvatarFallback className="bg-cyan-700 text-white text-xs font-bold">
                        {friend.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Circle
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                        friend.is_online ? "text-green-400 fill-green-400" : "text-zinc-600 fill-zinc-600"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{friend.username}</p>
                    <p className={`text-[10px] ${friend.is_online ? "text-green-400" : "text-zinc-500"}`}>
                      {friend.is_online ? "Çevrimiçi" : "Çevrimdışı"}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    disabled={invited || sendingId === friend.id}
                    onClick={() => handleInvite(friend)}
                    className={`text-xs font-bold px-3 ${
                      invited
                        ? "bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/20"
                        : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
                    }`}
                  >
                    {sendingId === friend.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : invited ? (
                      <>
                        <Check className="w-3 h-3 mr-1" /> Gönderildi
                      </>
                    ) : (
                      "Davet Et"
                    )}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FriendInviteDialog;
