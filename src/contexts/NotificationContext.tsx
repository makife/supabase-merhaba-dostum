import { createContext, useContext, ReactNode, useEffect } from "react";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";

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

  useEffect(() => {
    if (!user) return;

    try {
      const channel = supabase
        .channel("comprehensive-notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            try {
              const notification = payload.new as any;

              // Rozet bildirimi
              if (notification.type === "badge_earned") {
                toast.success(notification.message, {
                  duration: 5000,
                  icon: "🏆",
                });
              }

              // Mention bildirimi - Butonsuz (sayfa yenileme sorununu önlemek için)
              if (notification.type === "mention") {
                toast.info(`📢 ${notification.message}`, {
                  duration: 5000,
                });
              }

              // Özel mesaj bildirimi - Butonsuz
              if (notification.type === "message") {
                toast.info(`💬 ${notification.message}`, {
                  duration: 5000,
                });
              }
            } catch (err) {
              console.error("Bildirim işlenirken hata:", err);
            }
          },
        )
        .subscribe();

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (err) {
          console.error("Channel kapatılırken hata:", err);
        }
      };
    } catch (err) {
      console.error("Bildirim kanalı oluşturulurken hata:", err);
    }
  }, [user]); // navigate'i kaldırdık çünkü artık buton yok

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  return <NotificationContext.Provider value={{ unreadCount, markAsRead }}>{children}</NotificationContext.Provider>;
};
