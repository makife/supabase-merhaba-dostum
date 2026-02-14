import { createContext, useContext, ReactNode, useEffect, useRef } from "react";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getActivePrivateChats } from "@/utils/notifications";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";

// Helper: Davet toast'ı göster
const showInviteToast = (notification: any, user: any, navigate: any) => {
  const toastId = toast.info(`🎮 ${notification.message}`, {
    duration: 30000,
    action: {
      label: "✅ Katıl",
      onClick: async () => {
        toast.dismiss(toastId);
        await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
        navigate(`/private-room/waiting/${notification.related_id}`);
      },
    },
    cancel: {
      label: "❌ Reddet",
      onClick: async () => {
        toast.dismiss(toastId);
        try {
          const { data: roomData } = await supabase
            .from("game_rooms")
            .select("host_id")
            .eq("room_code", notification.related_id)
            .maybeSingle();

          if (roomData?.host_id && user) {
            await supabase.from("room_invite_rejections").insert({
              room_code: notification.related_id,
              rejected_by: user.id,
              rejected_from: roomData.host_id,
            });
          }

          await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
          toast.info("Davet reddedildi", { duration: 2000 });
        } catch (err) {
          console.error("Davet reddetme hatası:", err);
        }
      },
    },
  });
};

interface NotificationContextType {
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const { unreadCount } = useChatNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const shownNotifications = useRef<Set<string>>(new Set());
  const hasLoadedInvites = useRef(false);

  // 🔥 Uygulama açıldığında bekleyen room_invite bildirimlerini BİR KERE göster
  useEffect(() => {
    if (!user) return;
    if (hasLoadedInvites.current) return;

    const fetchPendingInvites = async () => {
      try {
        hasLoadedInvites.current = true;
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: pendingInvites } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "room_invite")
          .eq("is_read", false)
          .gte("created_at", thirtyMinAgo)
          .order("created_at", { ascending: false })
          .limit(5);

        if (pendingInvites && pendingInvites.length > 0) {
          console.log("📬 Bekleyen davet bildirimleri bulundu:", pendingInvites.length);

          // Hepsini hemen okundu olarak işaretle (tekrar gösterilmesin)
          const ids = pendingInvites.map(n => n.id);
          await supabase
            .from("notifications")
            .update({ is_read: true })
            .in("id", ids);

          pendingInvites.forEach((notification) => {
            if (shownNotifications.current.has(notification.id)) return;
            shownNotifications.current.add(notification.id);

            if (notification.related_id) {
              showInviteToast(notification, user, navigate);
            }
          });
        }
      } catch (err) {
        console.error("Bekleyen davet bildirimleri kontrol hatası:", err);
      }
    };

    const timer = setTimeout(fetchPendingInvites, 15000);
    return () => clearTimeout(timer);
  }, [user, navigate]);

  // Realtime bildirim dinleyici
  useEffect(() => {
    if (!user) return;

    const channelName = `user-notifications-toast-${user.id}`;

    const handleNotification = (payload: any) => {
      try {
        const notification = payload.new || payload;

        if (!notification || !notification.id) return;

        if (shownNotifications.current.has(notification.id)) return;
        shownNotifications.current.add(notification.id);

        console.log("✅ Bildirim işleniyor:", notification.type);

        if (notification.type === "badge_earned") {
          toast.success(notification.message, { duration: 5000, icon: "🏆" });
        }

        if (notification.type === "friend_request") {
          toast.info(`🤝 ${notification.message}`, {
            duration: 8000,
            action: {
              label: "Git",
              onClick: () => navigate("/friends"),
            },
          });
          return;
        }

        if (notification.type === "room_invite" && notification.related_id) {
          // Hemen okundu olarak işaretle (tekrar gösterilmesin)
          supabase.from("notifications").update({ is_read: true }).eq("id", notification.id).then();
          showInviteToast(notification, user, navigate);
          return;
        }

        if (notification.type === "mention") {
          return; // useChatNotifications hallediyor
        }

        if ((notification.type === "message" || notification.type === "private_message") && notification.related_id) {
          const chatId = notification.related_id;
          const activeChats = getActivePrivateChats();
          if (activeChats.includes(chatId)) return;

          const userIds = chatId.replace("chat_", "").split("_");
          const otherUserId = userIds.find((id: string) => id !== user?.id);

          toast.info(`💬 ${notification.message}`, {
            duration: 5000,
            action: {
              label: "Git",
              onClick: () => navigate(`/chat?openPrivateChat=${otherUserId}`),
            },
          });
        }
      } catch (err) {
        console.error("Bildirim işlenirken hata:", err);
      }
    };

    try {
      autoReconnect.registerChannel(channelName, () =>
        supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${user.id}`,
            },
            handleNotification,
          )
          .subscribe()
      );

      return () => {
        autoReconnect.unregisterChannel(channelName);
      };
    } catch (err) {
      console.error("Bildirim kanalı oluşturulurken hata:", err);
    }
  }, [user, navigate]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  return <NotificationContext.Provider value={{ unreadCount, markAsRead }}>{children}</NotificationContext.Provider>;
};
