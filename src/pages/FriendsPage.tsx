import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, UserMinus, Circle, UserPlus, Check, X, Bell, Users } from "lucide-react";
import { useSounds } from "@/hooks/useSounds";
import { useSmartNotifications } from "@/hooks/useSmartNotifications";
import { VipBadge, isUserPremium } from "@/components/VipBadge";
import { IN_GAME_STATUS_POLL_MS, getInGameActivityThreshold } from "@/utils/playerActivityStatus";
import Lottie from "lottie-react";
import friendsSayfaAnim from "@/assets/friendsSayfa.json";

interface FriendItem {
  friendship_id: string;
  friend_id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  in_game: boolean;
  status: string;
  is_sender: boolean;
  isPremium: boolean;
}

const FriendsPage = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playSound } = useSounds();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"friends" | "pending">("friends");
  const [friendOnlineNotify, setFriendOnlineNotify] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const { sendFriendAcceptedNotification } = useSmartNotifications();

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    let startY = 0;
    const handleTouchStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
    };
    const handleTouchMove = (event: TouchEvent) => {
      const currentY = event.touches[0]?.clientY ?? startY;
      const pullingPastTop = container.scrollTop <= 0 && currentY > startY;
      const pullingPastBottom =
        container.scrollTop + container.clientHeight >= container.scrollHeight - 1 && currentY < startY;

      if (pullingPastTop || pullingPastBottom) event.preventDefault();
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  // Fetch friend online notify preference
  useEffect(() => {
    if (!user) return;
    const fetchNotifPref = async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("friend_online_notify")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setFriendOnlineNotify(data.friend_online_notify ?? false);
    };
    fetchNotifPref();
  }, [user]);

  const toggleFriendOnlineNotify = async (checked: boolean) => {
    if (!user) return;
    setNotifyLoading(true);
    try {
      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          friend_online_notify: checked,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;
      setFriendOnlineNotify(checked);
      toast(checked ? "Arkadaş online bildirimleri açıldı 🔔" : "Arkadaş online bildirimleri kapatıldı");
    } catch {
      toast.error("Ayar güncellenemedi");
    } finally {
      setNotifyLoading(false);
    }
  };

  const fetchFriends = useCallback(async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setLoading(true);

    try {
      // Fetch all friendships involving current user
      const { data, error } = await supabase
        .from("friendships")
        .select("id, user_id, friend_id, status, created_at")
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      if (error) throw error;
      if (!data || data.length === 0) {
        setFriends([]);
        setPendingRequests([]);
        setLoading(false);
        return;
      }

      // Get unique friend IDs
      const friendIds = data.map((f) => (f.user_id === user.id ? f.friend_id : f.user_id));

      const oneMinuteAgo = new Date(Date.now() - 120 * 1000).toISOString();
      const activeSince = getInGameActivityThreshold();
      const [{ data: profiles }, { data: presenceData }, { data: activityData }] = await Promise.all([
        supabase.from("profiles").select("id, username, avatar_url, premium_until").in("id", friendIds),
        supabase.from("user_presence").select("user_id, last_seen").in("user_id", friendIds).gte("last_seen", oneMinuteAgo),
        supabase.from("player_activities").select("player_id").in("player_id", friendIds).gte("last_action_time", activeSince),
      ]);

      const onlineSet = new Set(presenceData?.map((p) => p.user_id) || []);
      const inGameSet = new Set((activityData || []).map((a) => a.player_id).filter(Boolean));
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const items: FriendItem[] = data.map((f) => {
        const friendId = f.user_id === user.id ? f.friend_id : f.user_id;
        const profile = profileMap.get(friendId);

        return {
          friendship_id: f.id,
          friend_id: friendId,
          username: profile?.username || "Oyuncu",
          avatar_url: profile?.avatar_url || null,
          is_online: onlineSet.has(friendId),
          in_game: inGameSet.has(friendId),
          status: f.status,
          is_sender: f.user_id === user.id,
          isPremium: isUserPremium((profile as any)?.premium_until),
        };
      });

      setFriends(items.filter((i) => i.status === "accepted"));
      setPendingRequests(items.filter((i) => i.status === "pending"));
    } catch (err) {
      console.error("Arkadaş listesi hatası:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => fetchFriends(false), IN_GAME_STATUS_POLL_MS);
    return () => window.clearInterval(interval);
  }, [user, fetchFriends]);

  // Realtime subscription - friendships + presence changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("friendships-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
        },
        () => {
          fetchFriends();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_presence",
        },
        () => {
          // Arkadaşın online durumu değiştiğinde listeyi yenile
          fetchFriends();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchFriends]);

  const handleAccept = async (friendshipId: string, senderId: string) => {
    console.log("🤝 handleAccept - friendshipId:", friendshipId, "senderId:", senderId);

    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", friendshipId);

    console.log("✅ update error:", error);

    if (error) {
      toast.error("Kabul edilemedi");
    } else {
      const { data: myProfile } = await supabase.from("profiles").select("username").eq("id", user!.id).single();

      console.log("👤 myProfile:", myProfile);
      const accepterName = myProfile?.username || "Bir oyuncu";

      const { error: notifError } = await supabase.from("notifications").insert({
        user_id: senderId,
        type: "friend_request_accepted",
        message: `${accepterName} arkadaşlık davetini kabul etti! 🎉`,
        related_id: user!.id,
      });

      console.log("🔔 notifError:", notifError);

      await sendFriendAcceptedNotification(senderId, accepterName);

      fetchFriends();
    }
  };

  const handleReject = async (friendshipId: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);

    if (error) {
      toast.error("Reddedilemedi");
    } else {
      toast("Davet reddedildi");
      fetchFriends();
    }
  };

  const handleRemoveFriend = async (friendshipId: string, username: string) => {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);

    if (error) {
      toast.error("Arkadaş çıkarılamadı");
    } else {
      toast(`${username} arkadaş listenizden çıkarıldı`);
      fetchFriends();
    }
  };

  const handleMessage = async (friendId: string) => {
    if (!user) return;
    const participants = [user.id, friendId].sort();
    const chatId = `chat_${participants.join("_")}`;

    try {
      const { data: existingChat, error: chatError } = await supabase
        .from("private_chats")
        .select("id")
        .eq("id", chatId)
        .maybeSingle();

      if (chatError) throw chatError;

      if (!existingChat) {
        await supabase.from("private_chats").insert({
          id: chatId,
          user1_id: participants[0],
          user2_id: participants[1],
        });
      }

      navigate(`/chat?openPrivateChat=${friendId}`);
    } catch (err) {
      toast.error("Sohbet açılırken hata oluştu");
    }
  };

  const onlineFriends = friends.filter((f) => f.is_online);
  const offlineFriends = friends.filter((f) => !f.is_online);

  return (
    <div
      ref={scrollContainerRef}
      className="h-screen h-[100dvh] overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white"
      style={{ overscrollBehavior: "none", WebkitOverflowScrolling: "auto", touchAction: "pan-y" }}
    >
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#1e2d45] border-b border-indigo-500/20 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playSound("buttonClick");
              navigate("/");
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
  <img src="/icons/arkadaslar-gorsel.svg" alt="" className="w-9 h-9 object-contain drop-shadow-md" />
  <img src="/icons/arkadaslar-text.svg" alt="Arkadaşlarım" className="h-7 object-contain" />
</div>
          {pendingRequests.length > 0 && (
            <div className="ml-auto bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center animate-pulse">
              {pendingRequests.length}
            </div>
          )}
        </div>

        {/* Friend Online Notify Toggle */}
        <div className="flex items-center justify-between mt-3 px-1 py-2 rounded-xl bg-[#1e2d45] border border-indigo-500/20">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-zinc-300">Arkadaş online bildirimi</span>
          </div>
          <Switch checked={friendOnlineNotify} onCheckedChange={toggleFriendOnlineNotify} disabled={notifyLoading} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              playSound("buttonClick");
              setTab("friends");
            }}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors ${
              tab === "friends" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-white/5 text-zinc-400"
            }`}
          >
            Arkadaşlar ({friends.length})
          </button>
          <button
            onClick={() => {
              playSound("buttonClick");
              setTab("pending");
            }}

            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors relative ${
              tab === "pending"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                : "bg-white/5 text-zinc-400"
            }`}
          >
            Davetler ({pendingRequests.length})
            {pendingRequests.filter((p) => !p.is_sender).length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-28 space-y-2">
        {/* Friends page Lottie */}
        <div className="w-screen -ml-4 -mr-4 -mt-4 mb-2">
          <Lottie
            animationData={friendsSayfaAnim}
            loop={true}
            autoplay={true}
            style={{ width: '100%', height: 140 }}
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === "friends" ? (
          friends.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Users className="w-12 h-12 mx-auto text-zinc-600" />
              <p className="text-zinc-500 text-sm">Henüz arkadaşınız yok</p>
              <p className="text-zinc-600 text-xs">Diğer oyuncuların profillerinden arkadaşlık daveti gönderin</p>
            </div>
          ) : (
            <>
              {/* Online Friends */}
              {onlineFriends.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-green-400 uppercase tracking-wider px-1">
                    Çevrimiçi — {onlineFriends.length}
                  </p>
                  {onlineFriends.map((friend) => (
                    <FriendCard
                      key={friend.friendship_id}
                      friend={friend}
                      onMessage={() => handleMessage(friend.friend_id)}
                      onRemove={() => handleRemoveFriend(friend.friendship_id, friend.username)}
                      onProfile={() => navigate(`/profile/${friend.friend_id}`, { state: { from: "/friends" } })}
                    />
                  ))}
                </div>
              )}
              {/* Offline Friends */}
              {offlineFriends.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">
                    Çevrimdışı — {offlineFriends.length}
                  </p>
                  {offlineFriends.map((friend) => (
                    <FriendCard
                      key={friend.friendship_id}
                      friend={friend}
                      onMessage={() => handleMessage(friend.friend_id)}
                      onRemove={() => handleRemoveFriend(friend.friendship_id, friend.username)}
                      onProfile={() => navigate(`/profile/${friend.friend_id}`, { state: { from: "/friends" } })}
                    />
                  ))}
                </div>
              )}
            </>
          )
        ) : /* Pending tab */
        pendingRequests.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <UserPlus className="w-12 h-12 mx-auto text-zinc-600" />
            <p className="text-zinc-500 text-sm">Bekleyen davet yok</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Gelen davetler */}
            {pendingRequests.filter((p) => !p.is_sender).length > 0 && (
              <>
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider px-1">Gelen Davetler</p>
                {pendingRequests
                  .filter((p) => !p.is_sender)
                  .map((req) => (
                    <div
                      key={req.friendship_id}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-[#1e2d45] border border-indigo-500/20"
                    >
                      <button onClick={() => navigate(`/profile/${req.friend_id}`, { state: { from: "/friends" } })}>
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={req.avatar_url || ""} />
                          <AvatarFallback className="bg-amber-600 text-white text-xs">
                            {req.username[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{req.username}</p>
                        <p className="text-[10px] text-zinc-500">Arkadaşlık daveti gönderdi</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAccept(req.friendship_id, req.friend_id)}
                          className="p-2 rounded-xl bg-green-600 hover:bg-green-500 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReject(req.friendship_id)}
                          className="p-2 rounded-xl bg-red-600/30 hover:bg-red-600/50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </>
            )}
            {/* Gönderilen davetler */}
            {pendingRequests.filter((p) => p.is_sender).length > 0 && (
              <>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1 mt-4">
                  Gönderilen Davetler
                </p>
                {pendingRequests
                  .filter((p) => p.is_sender)
                  .map((req) => (
                    <div
                      key={req.friendship_id}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-[#1e2d45] border border-indigo-500/20 opacity-70"
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={req.avatar_url || ""} />
                        <AvatarFallback className="bg-zinc-600 text-white text-xs">
                          {req.username[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{req.username}</p>
                        <p className="text-[10px] text-zinc-500">Yanıt bekleniyor...</p>
                      </div>
                      <button
                        onClick={() => handleReject(req.friendship_id)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors text-[10px]"
                      >
                        İptal
                      </button>
                    </div>
                  ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Friend Card component
const FriendCard = ({
  friend,
  onMessage,
  onRemove,
  onProfile,
}: {
  friend: FriendItem;
  onMessage: () => void;
  onRemove: () => void;
  onProfile: () => void;
}) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#1e2d45] border border-indigo-500/20 hover:bg-white/[0.07] transition-colors">
      <button onClick={onProfile} className="relative">
        <Avatar className="w-11 h-11">
          <AvatarImage src={friend.avatar_url || ""} />
          <AvatarFallback className="bg-cyan-700 text-white text-sm font-bold">
            {friend.username[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <Circle
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${
            friend.in_game
              ? "text-blue-400 fill-blue-400 drop-shadow-[0_0_4px_rgba(96,165,250,0.8)]"
              : friend.is_online
                ? "text-green-400 fill-green-400"
                : "text-zinc-600 fill-zinc-600"
          }`}
        />
        {friend.isPremium && (
          <div className="absolute -top-1 -left-1 z-20">
            <VipBadge size="xs" />
          </div>
        )}
      </button>

      <button onClick={onProfile} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-semibold truncate">{friend.username}</p>
        <p className={`text-[10px] ${friend.in_game ? "text-blue-400" : friend.is_online ? "text-green-400" : "text-zinc-500"}`}>
          {friend.in_game ? "Maçta" : friend.is_online ? "Çevrimiçi" : "Çevrimdışı"}
        </p>
      </button>

      <div className="flex gap-1.5">
        <button
          onClick={onMessage}
          className="p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
        <button
          onClick={onRemove}
          className="p-2 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 transition-colors"
        >
          <UserMinus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FriendsPage;
