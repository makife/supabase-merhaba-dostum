import { createContext, useContext, ReactNode, useEffect, useRef } from "react";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getActivePrivateChats } from "@/utils/notifications";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";
// NativeRealtime kaldırıldı - Supabase JS SDK yeterli

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

  useEffect(() => {
    if (!user) return;

    shownNotifications.current.clear();

    const channelName = `user-notifications-toast-${user.id}`;

    // 🔥 Bildirim işleyici fonksiyonu
    const handleNotification = (payload: any) => {
      try {
        const notification = payload.new || payload;
        
        console.log("🔔 Realtime bildirim alındı:", notification);

        if (!notification || !notification.id) {
          console.log("🚫 Geçersiz bildirim payload");
          return;
        }

        const notificationKey = notification.id;
        if (shownNotifications.current.has(notificationKey)) {
          console.log("🚫 Bildirim zaten gösterildi:", notificationKey);
          return;
        }

        shownNotifications.current.add(notificationKey);
        console.log("✅ Bildirim işleniyor:", notification.type);

        if (notification.type === "badge_earned") {
          toast.success(notification.message, {
            duration: 5000,
            icon: "🏆",
          });
        }

        if (notification.type === "mention") {
          console.log("📢 Mention toast gösteriliyor");
          toast.info(`📢 ${notification.message}`, {
            duration: 5000,
            action: {
              label: "Git",
              onClick: () => navigate("/chat"),
            },
          });
        }

        if ((notification.type === "message" || notification.type === "private_message") && notification.related_id) {
          const chatId = notification.related_id;
          const activeChats = getActivePrivateChats();
          if (activeChats.includes(chatId)) {
            console.log("🚫 TOAST GÖSTERİLMEDİ - Sohbet açık:", chatId);
            return;
          }

          const userIds = chatId.replace("chat_", "").split("_");
          const otherUserId = userIds.find((id: string) => id !== user?.id);

          console.log("💬 Private message toast gösteriliyor");
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
      console.log("🔔 NotificationContext: Realtime subscription başlatılıyor, user:", user.id);

      // JS SDK channel - Supabase realtime yeterli
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
          .subscribe((status) => {
            console.log("🔔 Notification channel status:", status);
            if (status === "SUBSCRIBED") {
              console.log("✅ Bildirim kanalı başarıyla bağlandı");
            }
          })
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
