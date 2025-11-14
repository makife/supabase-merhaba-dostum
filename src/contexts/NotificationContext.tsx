import { createContext, useContext, ReactNode, useEffect, useRef } from "react";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { useNavigate } from "react-router-dom";
import { getActivePrivateChats } from "@/utils/notifications";

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
  const shownNotifications = useRef<Set<string>>(new Set()); // ← Gösterilen bildirimleri takip et

  useEffect(() => {
    if (!user) return;

    // Sayfa yenilendiğinde temizle
    shownNotifications.current.clear();

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

              // Aynı bildirimi birden fazla göstermeyi önle
              const notificationKey = `${notification.id}_${notification.created_at}`;
              if (shownNotifications.current.has(notificationKey)) {
                return; // Bu bildirim zaten gösterildi
              }

              shownNotifications.current.add(notificationKey);

              // Rozet bildirimi
              if (notification.type === "badge_earned") {
                toast.success(notification.message, {
                  duration: 5000,
                  icon: "🏆",
                });
              }

              // Mention bildirimi
              if (notification.type === "mention") {
                toast.info(`📢 ${notification.message}`, {
                  duration: 5000,
                  action: {
                    label: "Git",
                    onClick: () => navigate("/chat"),
                  },
                });
              }

              // Özel mesaj bildirimi - related_id'den userId çıkar
              if (notification.type === "message" && notification.related_id) {
                const chatId = notification.related_id;
                
                // Eğer kullanıcı bu chat'i açmışsa toast gösterme
                const activeChats = getActivePrivateChats();
                if (activeChats.includes(chatId)) {
                  console.log("🚫 TOAST GÖSTERİLMEDİ - Sohbet açık:", chatId);
                  return;
                }
                
                // chatId formatı: chat_userId1_userId2
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

              // Oyun daveti bildirimi
              if (notification.type === "invite" && notification.related_id) {
                const roomCode = notification.related_id;
                
                toast.info(`🎮 ${notification.message}`, {
                  duration: 8000,
                  action: {
                    label: "Katıl",
                    onClick: () => {
                      // Bildirimi okundu olarak işaretle
                      markAsRead(notification.id);
                      // Oyuna katıl
                      navigate(`/game/${roomCode}?mode=private-room`);
                    },
                  },
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
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  return <NotificationContext.Provider value={{ unreadCount, markAsRead }}>{children}</NotificationContext.Provider>;
};
