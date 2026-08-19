import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { useSounds } from "@/hooks/useSounds";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Users, MessageCircle, Hash, Home, Dot, Mail, UserX, UserCheck, Ban, Trash2 } from "lucide-react";
import { ChatMiniMenu } from "@/components/ChatMiniMenu";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GlobalChat } from "@/components/GlobalChat";
import { PrivateChat } from "@/components/PrivateChat";
import { UserAvatar } from "@/components/UserAvatar";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { useUserBlocking } from "@/hooks/useUserBlocking";
import { usePageResync } from "@/hooks/useGlobalResync";
import { useFontReady } from "@/hooks/useFontReady";
import { IN_GAME_STATUS_POLL_MS, getInGameActivityThreshold } from "@/utils/playerActivityStatus";
import { toast } from "sonner";
import { isUserPremium } from "@/components/VipBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ViewMode = "global" | "users" | "private-chat" | "blocked-users";

interface SelectedUser {
  id: string;
  username: string;
  avatar_url?: string;
  premium_until?: string | null;
  in_game?: boolean;
}

interface BanInfo {
  is_banned: boolean;
  ban_reason: string;
  banned_until: string;
  remaining_hours: number;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const bungeeReady = useFontReady("700 1.25rem Bungee");
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { profile, onlineUsers, isUserOnline, isSystemConnected } = useUser();

  const { playSound } = useSounds();
  const [viewMode, setViewMode] = useState<ViewMode>("global");
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<SelectedUser[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [isMiniMenuOpen, setIsMiniMenuOpen] = useState(false);
  const { unreadCount, markAllAsRead, markPrivateMessagesAsRead, markGlobalMessagesAsRead, refreshUnreadCounts } =
    useChatNotifications();
  const { blockedUsers, blockUser, unblockUser, isUserBlocked } = useUserBlocking();

  // 🔄 Global Resync Hook - bağlantı geri geldiğinde otomatik veri tazeleme
  const handleChatResync = useCallback(() => {
    if (user?.id) {
      console.log("🔄 [ChatPage] Resync triggered - veriler yeniden yükleniyor...");
      fetchAllUsers();
      fetchUnreadCounts();
      refreshUnreadCounts();
    }
  }, [user?.id]);

  // PrivateChat kritik sayfa - öncelikli resync
  usePageResync(handleChatResync, "ChatPage", true);

  // Yasak kontrolü
  useEffect(() => {
    const checkBanStatus = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase.rpc("check_user_ban_status", {
          p_user_id: user.id,
        });

        if (error) {
          console.error("Ban check error:", error);
          return;
        }

        if (data && data.length > 0 && data[0].is_banned) {
          setBanInfo(data[0]);
          setShowBanDialog(true);
        }
      } catch (err) {
        console.error("Ban status check failed:", err);
      }
    };

    checkBanStatus();
  }, [user?.id]);

  const formatBanDuration = (hours: number): string => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes} dakika`;
    } else if (hours < 24) {
      return `${Math.round(hours)} saat`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      if (remainingHours > 0) {
        return `${days} gün ${remainingHours} saat`;
      }
      return `${days} gün`;
    }
  };

  const fetchAllUsers = async () => {
    try {
      console.log("🔍 DEBUG: fetchAllUsers başladı, user.id:", user?.id);

      const { data: messages, error: messagesError } = await supabase
        .from("private_messages")
        .select("sender_id, recipient_id")
        .or(`sender_id.eq.${user?.id},recipient_id.eq.${user?.id}`)
        .not("sender_id", "is", null)
        .not("recipient_id", "is", null);

      if (messagesError) {
        console.error("🔍 DEBUG: Messages query error:", messagesError);
        return;
      }

      const userIDs = new Set<string>();
      messages?.forEach((msg) => {
        if (msg.sender_id && msg.sender_id !== user?.id) {
          userIDs.add(msg.sender_id);
        }
        if (msg.recipient_id && msg.recipient_id !== user?.id) {
          userIDs.add(msg.recipient_id);
        }
      });

      if (userIDs.size === 0) {
        setAllUsers([]);
        return;
      }

      const validUserIDs = Array.from(userIDs).filter((id) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return id && uuidRegex.test(id);
      });

      if (validUserIDs.length === 0) {
        setAllUsers([]);
        return;
      }

      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, premium_until")
        .in("id", validUserIDs);

      if (usersError) {
        console.error("🔍 DEBUG: Users query error:", usersError);
        return;
      }

      // Maç durumu sadece taze heartbeat ile geçerli; eski in_game=true değerine takılmasın
      const activeSince = getInGameActivityThreshold();
      const { data: activityData } = await supabase
        .from("player_activities")
        .select("player_id")
        .in("player_id", validUserIDs)
        .gte("last_action_time", activeSince);
      const activeSet = new Set((activityData || []).map((a) => a.player_id).filter(Boolean));

      const merged = (users || []).map((u) => ({
        ...u,
        in_game: activeSet.has(u.id),
      }));

      setAllUsers(merged);
    } catch (error) {
      console.error("🔍 DEBUG: fetchAllUsers error:", error);
    }
  };

  const fetchUnreadCounts = async () => {
    if (!user) return;
    try {
      const { data: unreadMessages, error } = await supabase
        .from("private_messages")
        .select("sender_id")
        .eq("recipient_id", user.id)
        .eq("is_read", false);

      if (error) {
        console.error("Unread count fetch error:", error);
        setUnreadCounts({});
        return;
      }

      const counts: { [key: string]: number } = {};
      unreadMessages?.forEach((msg) => {
        const senderId = msg.sender_id;
        if (senderId) {
          counts[senderId] = (counts[senderId] || 0) + 1;
        }
      });

      setUnreadCounts(counts);
    } catch (error) {
      console.error("Error with unread counts:", error);
      setUnreadCounts({});
    }
  };

  useEffect(() => {
    if (viewMode === "users" && user?.id) {
      fetchAllUsers();
      fetchUnreadCounts();
    }
  }, [viewMode, user?.id]);

  useEffect(() => {
    if (viewMode !== "users" || !user?.id) return;

    const interval = window.setInterval(fetchAllUsers, IN_GAME_STATUS_POLL_MS);

    return () => window.clearInterval(interval);
  }, [viewMode, user?.id]);

  useEffect(() => {
    if (viewMode !== "users" || !user?.id) return;

    const channel = supabase
      .channel(`chat-in-game-status-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_activities" },
        () => fetchAllUsers(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        () => fetchAllUsers(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewMode, user?.id]);

  // URL'den openPrivateChat parametresini kontrol et
  useEffect(() => {
    const openPrivateChatUserId = searchParams.get("openPrivateChat");
    if (openPrivateChatUserId && user?.id) {
      const openChatFromNotification = async () => {
        try {
          const { data: targetUserData, error } = await supabase
            .from("profiles")
            .select("id, username, avatar_url")
            .eq("id", openPrivateChatUserId)
            .single();

          if (!error && targetUserData) {
            await startPrivateChat(targetUserData);
            // URL parametresini temizle
            setSearchParams({});
          }
        } catch (err) {
          console.error("Error opening private chat from notification:", err);
        }
      };
      openChatFromNotification();
    }
  }, [searchParams, user?.id]);

  const handleBackToMenu = () => {
    navigate("/");
  };

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode !== "private-chat") {
      setSelectedUser(null);
      setActiveChatId(null);
    }

    // Badge temizleme
    if (mode === "global") {
      markGlobalMessagesAsRead();
    }
  };

  const startPrivateChat = async (targetUser: SelectedUser) => {
    // Engellenen kullanıcı kontrolü
    if (isUserBlocked(targetUser.id)) {
      toast.error("Bu kullanıcıyı engellemişsiniz");
      return;
    }
    if (!user) return;

    try {
      playSound("buttonClick");

      const participants = [user.id, targetUser.id].sort();
      const chatId = `chat_${participants.join("_")}`;

      const { data: existingChat, error: chatError } = await supabase
        .from("private_chats")
        .select("*")
        .eq("id", chatId)
        .single();

      if (chatError && chatError.code !== "PGRST116") {
        throw chatError;
      }

      if (!existingChat) {
        const { error: createError } = await supabase.from("private_chats").insert({
          id: chatId,
          user1_id: participants[0],
          user2_id: participants[1],
        });

        if (createError) throw createError;
      }

      setSelectedUser(targetUser);
      setActiveChatId(chatId);

      // Özel sohbete girildiğinde badge'leri temizle
      markPrivateMessagesAsRead();
      setViewMode("private-chat");
    } catch (error) {
      console.error("Error starting private chat:", error);
    }
  };

  const deletePrivateChat = async (otherUserId: string) => {
    if (!user) return;

    try {
      const chatId = `chat_${[user.id, otherUserId].sort().join("_")}`;

      const { data: existingMessages } = await supabase.from("private_messages").select("id").eq("chat_id", chatId);

      const { error: reactionsError } = await supabase
        .from("message_reactions")
        .delete()
        .in("message_id", existingMessages?.map((m) => m.id) || []);

      const { error: messagesError } = await supabase.from("private_messages").delete().eq("chat_id", chatId);

      if (messagesError) throw messagesError;

      const { error: chatError } = await supabase.from("private_chats").delete().eq("id", chatId);

      setAllUsers((prev) => prev.filter((u) => u.id !== otherUserId));
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        delete updated[otherUserId];
        return updated;
      });

      toast.success("Özel sohbet silindi");
    } catch (error) {
      console.error("Error deleting private chat:", error);
      toast.error("Sohbet silinirken hata oluştu");
    }
  };

  // Ortak header bileşeni - Mini floating menü ile güncellenmiş versiyon
  const renderHeader = (title: string, subtitle: string, showBackButton: boolean = false) => (
    <div className="bg-gradient-to-r from-[#2D3436] via-[#3d4548] to-[#636E72] text-white p-6 border-b border-white/10 h-[120px]">
      <div className="flex flex-col h-full justify-end">
        {/* Alt kısım - Başlık ve Butonlar aynı hizada */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {showBackButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  playSound("buttonClick");
                  if (viewMode === "private-chat") {
                    handleViewChange("users");
                  } else {
                    handleViewChange("global");
                  }
                }}
                className="px-2 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 text-white border-2 border-orange-300 font-semibold"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                {title === "KELİMELE SOHBET" && (
                  <img src="/icons/sohbet-gorsel.svg" alt="" className="w-9 h-9 object-contain drop-shadow-md" />
                )}
                {title === "Özel Sohbet" && (
                  <img src="/icons/ozelsohbet-gorsel.svg" alt="" className="w-9 h-9 object-contain drop-shadow-md" />
                )}
                {title === "Yasaklı" && (
                  <img src="/icons/engellediklerim-gorsel.svg" alt="" className="w-9 h-9 object-contain drop-shadow-md" />
                )}
                <h1
                  className="text-xl font-bold font-bungee tracking-wider uppercase bg-gradient-to-r from-yellow-300 via-white to-yellow-300 bg-clip-text text-transparent drop-shadow-lg"
                  style={{ visibility: bungeeReady ? "visible" : "hidden" }}
                >
                  {title}
                </h1>
              </div>
            </div>
          </div>

          {/* Mini Floating Menu - Sadece global view'da göster */}
          {viewMode === "global" && (
            <ChatMiniMenu
              onViewChange={handleViewChange}
              onGoHome={handleBackToMenu}
              currentView={viewMode}
              onOpenChange={setIsMiniMenuOpen}
              privateUnreadCount={unreadCount}
            />

          )}

          {/* Diğer view'larda sadece Ana Sayfa butonu */}
          {viewMode !== "global" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                playSound("buttonClick");
                handleBackToMenu();
              }}
              className="px-2 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white border-2 border-purple-300 font-semibold sm:px-3"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5 sm:mr-1" />
              <span className="text-xs hidden sm:inline">Ana Sayfa</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const renderUsersList = () => {
    return (
      <div className="h-full overflow-y-auto bg-gradient-to-b from-[#2D3436] to-[#3d4548] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:!hidden [&::-webkit-scrollbar]:!w-0 [&::-webkit-scrollbar]:!h-0">
        <div className="p-4 space-y-3">
          {allUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="bg-white/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-white/80">Henüz özel mesajınız yok</p>
              <p className="text-sm text-gray-400">Global sohbetten birine özel mesaj gönderin</p>
            </div>
          ) : (
            allUsers
              .filter((user) => !isUserBlocked(user.id))
              .map((targetUser) => {
                const unreadCount = unreadCounts[targetUser.id] || 0;
                const hasHistory = Object.keys(unreadCounts).includes(targetUser.id) || unreadCount > 0;

                return (
                  <Card
                    key={targetUser.id}
                    className={`p-4 cursor-pointer border rounded-xl ${
                      unreadCount > 0
                        ? "border-green-400/50 bg-white/15"
                        : hasHistory
                          ? "border-white/20 bg-white/10"
                          : "border-white/10 bg-white/5"
                    }`}
                    onClick={() => startPrivateChat(targetUser)}
                  >
                    <div className="flex items-center space-x-3">
                      <UserAvatar
                        src={targetUser.avatar_url}
                        alt={targetUser.username}
                        fallback={targetUser.username.charAt(0).toUpperCase()}
                        size="sm"
                        isPremium={isUserPremium(targetUser.premium_until)}
                      className={`${unreadCount > 0 ? "ring-2 ring-chat-500 ring-offset-2" : ""} border-2 ${
                          isUserOnline(targetUser.id) || targetUser.in_game
                            ? "border-green-400"
                            : "border-gray-300"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate text-lg">{targetUser.username}</p>
                        {unreadCount > 0 ? (
                          <p className="text-sm text-green-400 font-bold">{unreadCount} okunmamış mesaj</p>
                        ) : hasHistory ? (
                          <p className="text-sm text-gray-300 font-medium">Mesaj geçmişi var</p>
                        ) : (
                          <p className="text-sm text-gray-400">Özel mesaj gönder</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {isUserOnline(targetUser.id) || targetUser.in_game ? (
                          <div
                            className={`w-4 h-4 rounded-full border border-white ${
                              targetUser.in_game
                                ? "bg-blue-500 shadow-[0_0_6px_rgba(96,165,250,0.9)]"
                                : "bg-green-500 shadow-sm"
                            }`}
                            title={targetUser.in_game ? "Maçta" : "Çevrimiçi"}
                          />
                        ) : null}
                        {unreadCount > 0 && (
                          <div className="w-7 h-7 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center text-xs text-white font-bold">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isUserBlocked(targetUser.id)) {
                              unblockUser(targetUser.id);
                              toast.success("Kullanıcı engeli kaldırıldı");
                            } else {
                              blockUser(targetUser.id);
                              toast.success("Kullanıcı engellendi");
                            }
                          }}
                          className={`p-1 h-7 w-7 ${isUserBlocked(targetUser.id) ? "text-green-500 hover:text-green-600" : "text-red-500 hover:text-red-600"}`}
                          title={isUserBlocked(targetUser.id) ? "Engeli Kaldır" : "Kullanıcıyı Engelle"}
                        >
                          {isUserBlocked(targetUser.id) ? (
                            <UserCheck className="w-4 h-4" />
                          ) : (
                            <UserX className="w-4 h-4" />
                          )}
                        </Button>
                        {/* 🗑️ SİL BUTONU - Sağ üstte */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePrivateChat(targetUser.id);
                          }}
                          className="p-1 h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          title="Sohbeti Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
          )}
        </div>
      </div>
    );
  };

  const renderBlockedUsersList = () => (
    <div className="h-full overflow-y-auto p-4 bg-gradient-to-b from-[#2D3436] to-[#3d4548] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:!hidden [&::-webkit-scrollbar]:!w-0 [&::-webkit-scrollbar]:!h-0">
      <div className="space-y-3">
        {blockedUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <UserX className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
            <h3 className="text-lg font-medium mb-2 text-white/80">Engellenen kullanıcı yok</h3>
            <p className="text-sm text-gray-400">Kullanıcıları engellemek için kullanıcılar listesini kullanın</p>
          </div>
        ) : (
          allUsers
            .filter((user) => blockedUsers.includes(user.id))
            .map((blockedUser) => (
              <Card
                key={blockedUser.id}
                className="p-4 border-red-500/30 bg-red-500/10 hover:bg-red-500/15 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className="cursor-pointer"
                    onClick={() => navigate(`/profile/${blockedUser.id}`, { state: { from: "/chat" } })}
                  >
                    <UserAvatar
                      src={blockedUser.avatar_url}
                      alt={blockedUser.username}
                      fallback={blockedUser.username.charAt(0).toUpperCase()}
                      size="md"
                      className="border-2 border-red-300 opacity-60"
                    />
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/profile/${blockedUser.id}`, { state: { from: "/chat" } })}
                  >
                    <p className="font-medium text-red-300 truncate hover:text-red-200 transition-colors">
                      {blockedUser.username}
                    </p>
                    <p className="text-sm text-red-400 flex items-center">
                      <UserX className="w-3 h-3 mr-1" />
                      Engellendi
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      unblockUser(blockedUser.id);
                      toast.success(`${blockedUser.username} engellemeden kaldırıldı`);
                    }}
                    className="text-xs px-3 py-1 h-8 text-green-400 border-green-400/50 hover:bg-green-500/20"
                  >
                    <UserCheck className="w-3 h-3 mr-1" />
                    Engeli Kaldır
                  </Button>
                </div>
              </Card>
            ))
        )}
      </div>
    </div>
  );

  // ── RENDER CONTENT
  // Header blur almaz (ChatMiniMenu orada), sadece altındaki içerik blur alır
  const renderContent = () => {
    if (viewMode === "private-chat" && selectedUser && activeChatId) {
      return (
        <div className="h-full flex flex-col">
          {/* Header — blur almaz */}
          {renderHeader(`KELİMELE - ${selectedUser.username}`, "Özel Sohbet", true)}
          <div className="flex-1 min-h-0">
            <PrivateChat chatId={activeChatId} otherUser={selectedUser} onBack={() => handleViewChange("users")} />
          </div>
        </div>
      );
    }

    if (viewMode === "users") {
      return (
        <div className="h-full flex flex-col">
          {/* Header — blur almaz */}
          {renderHeader("Özel Sohbet", `${onlineUsers.length} kişi çevrimiçi`, true)}
          <div className="flex-1 min-h-0">
            {renderUsersList()}
          </div>
        </div>
      );
    }

    if (viewMode === "blocked-users") {
      return (
        <div className="h-full flex flex-col">
          {/* Header — blur almaz */}
          {renderHeader("Yasaklı", `${blockedUsers.length} kişi engellendi`, true)}
          <div className="flex-1 min-h-0">
            {renderBlockedUsersList()}
          </div>
        </div>
      );
    }

    // Global chat (default)
    return (
      <div className="h-full flex flex-col">
        {/* Header — ChatMiniMenu burada, blur almaz */}
        {renderHeader("KELİMELE SOHBET", `${onlineUsers.length} kişi çevrimiçi`)}
        <div className="flex-1 min-h-0">
          <GlobalChat isOpen={true} onClose={() => {}} isFullPage={true} onStartPrivateChat={startPrivateChat} />
        </div>
      </div>
    );
  };

  // Real-time subscription (aynı kalacak)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("chatpage-private-messages", {
        config: {
          broadcast: { self: true },
        },
      })
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
        },
        (payload) => {
          const newMessage = payload.new as any;

          if (newMessage.sender_id === user.id || newMessage.recipient_id === user.id) {
            setTimeout(() => {
              fetchAllUsers();
              fetchUnreadCounts();
            }, 1000);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-[#2D3436] via-[#434d50] to-[#636E72]">
      {/* Ana wrapper — blur YOK burada, blur renderContent içinde içerik div'ine veriliyor */}
      <div className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto bg-[#2D3436]/80 border-x border-white/10 overflow-hidden">
        {/* Content Area */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{renderContent()}</div>
      </div>

      {/* Ban Dialog */}
      <AlertDialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Ban className="w-6 h-6" />
              Sohbet Yasağı
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-2">
                <p className="font-semibold text-red-800 mb-2">Yasak Sebebi:</p>
                <p className="text-red-700">{banInfo?.ban_reason || "Uygunsuz davranış"}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="font-semibold text-orange-800 mb-2">Kalan Süre:</p>
                <p className="text-orange-700 text-lg font-bold">
                  {banInfo ? formatBanDuration(banInfo.remaining_hours) : ""}
                </p>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Yasak süreniz dolana kadar sohbet özelliklerini kullanamazsınız!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowBanDialog(false);
                navigate("/");
              }}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
            >
              Anladım
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
