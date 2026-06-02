import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
// tournament invite push uses sendPushNotification directly for proper text
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Circle, Loader2, Users, Check } from "lucide-react";
import { IN_GAME_STATUS_POLL_MS, getInGameActivityThreshold } from "@/utils/playerActivityStatus";
import { toast } from "sonner";

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  in_game: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  tournamentName: string;
}

const TournamentInviteDialog = ({ open, onOpenChange, tournamentId, tournamentName }: Props) => {
  const { user } = useAuth();
  const { sendPushNotification } = useSmartNotifications();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchFriends = useCallback(async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setLoading(true);
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
      const twoMinutesAgo = new Date(Date.now() - 120 * 1000).toISOString();
      const activeSince = getInGameActivityThreshold();
      const [{ data: profiles }, { data: presenceData }, { data: activityData }] = await Promise.all([
        supabase.from("profiles").select("id, username, avatar_url, in_game").in("id", friendIds),
        supabase.from("user_presence").select("user_id").in("user_id", friendIds).gte("last_seen", twoMinutesAgo),
        supabase.from("player_activities").select("player_id").in("player_id", friendIds).gte("last_action_time", activeSince),
      ]);

      const onlineSet = new Set(presenceData?.map((p) => p.user_id) || []);
      const inGameSet = new Set<string>((activityData || []).map((a) => a.player_id).filter(Boolean) as string[]);

      const items: Friend[] = (profiles || []).map((p) => ({
        id: p.id,
        username: p.username || "Oyuncu",
        avatar_url: p.avatar_url,
        is_online: onlineSet.has(p.id),
        in_game: inGameSet.has(p.id),
      }));
      items.sort((a, b) => (a.is_online === b.is_online ? 0 : a.is_online ? -1 : 1));
      setFriends(items);
    } catch (err) {
      console.error("Arkadaş listesi hatası:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (open) {
      fetchFriends();
      setInvitedIds(new Set());
    }
  }, [open, fetchFriends]);

  useEffect(() => {
    if (!open) return;
    const i = window.setInterval(() => fetchFriends(false), IN_GAME_STATUS_POLL_MS);
    return () => window.clearInterval(i);
  }, [open, fetchFriends]);

  const handleInvite = async (friend: Friend) => {
    if (!user || sendingId) return;
    if (friend.in_game) {
      toast.error(`${friend.username} şu anda maçta, davet edilemez.`);
      return;
    }
    setSendingId(friend.id);
    try {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      const senderName = myProfile?.username || "Bir oyuncu";
      const cleanName = (tournamentName || "")
        .replace(/\s*[-–—]?\s*\d{1,2}[:.]\d{2}\s*$/u, "")
        .trim();

      await supabase.from("notifications").insert({
        user_id: friend.id,
        type: "tournament_invite",
        message: `${senderName} seni "${cleanName}" turnuvasına davet ediyor!`,
        related_id: tournamentId,
        is_read: false,
      });

      await sendPushNotification(
        friend.id,
        "🏆 Turnuva Daveti",
        `${senderName} seni "${cleanName}" turnuvasına davet ediyor!`,
        { type: "tournament_invite", tournamentId },
        true,
      );

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
            <Users className="w-5 h-5 text-amber-400" />
            Turnuvaya Davet Et
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
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
                      <AvatarFallback className="bg-amber-700 text-white text-xs font-bold">
                        {friend.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Circle
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                        friend.in_game
                          ? "text-blue-400 fill-blue-400"
                          : friend.is_online
                            ? "text-green-400 fill-green-400"
                            : "text-zinc-600 fill-zinc-600"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{friend.username}</p>
                    <p className={`text-[10px] ${friend.in_game ? "text-blue-400" : friend.is_online ? "text-green-400" : "text-zinc-500"}`}>
                      {friend.in_game ? "Maçta" : friend.is_online ? "Çevrimiçi" : "Çevrimdışı"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    disabled={invited || sendingId === friend.id || friend.in_game}
                    onClick={() => handleInvite(friend)}
                    className={`text-xs font-bold px-3 ${
                      friend.in_game
                        ? "bg-zinc-700/40 text-zinc-400 border border-zinc-600/30 cursor-not-allowed hover:bg-zinc-700/40"
                        : invited
                        ? "bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/20"
                        : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
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

export default TournamentInviteDialog;
