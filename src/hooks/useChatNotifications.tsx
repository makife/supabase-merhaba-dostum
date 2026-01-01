import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast"; // Projende hangisi varsa: "sonner" veya "use-toast"
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getIsAppInForeground } from "./useAppForegroundState";
import { getActivePrivateChats } from "@/utils/notifications";

export function useChatNotifications() {
  const { user } = useAuth();
  const { profile } = useUser();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalMentionCount, setGlobalMentionCount] = useState(0);

  const loadUnreadMessages = async () => {
    if (!user?.id) return 0;
    try {
      const { count } = await supabase
        .from("private_messages")
        .select("*", { count: "exact" })
        .eq("recipient_id", user.id)
        .eq("is_read", false);

      return count || 0;
    } catch (error) {
      console.error("Error loading unread messages:", error);
      return 0;
    }
  };

  const loadGlobalMentions = async () => {
    if (!user?.id || !profile?.username) return 0;
    try {
      const { data } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "mention")
        .eq("is_read", false);

      return data?.length || 0;
    } catch (error) {
      console.error("Error loading global mentions:", error);
      return 0;
    }
  };

  const markPrivateMessagesAsRead = async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("private_messages")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    if (!error) {
      setUnreadCount(0);
    }
  };

  const markAllAsRead = async () => {
    await markPrivateMessagesAsRead();
    await markGlobalMessagesAsRead();
    setGlobalMentionCount(0);
  };

  const markGlobalMessagesAsRead = async () => {
    if (!user?.id) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("type", "mention")
      .eq("is_read", false);

    setGlobalMentionCount(0);
  };

  const refreshUnreadCounts = async () => {
    const privateCount = await loadUnreadMessages();
    const mentionCount = await loadGlobalMentions();
    setUnreadCount(privateCount);
    setGlobalMentionCount(mentionCount);
  };

  // Uygulama içi bildirim gösterme (Sadece app öndeyse)
  const showInAppNotification = useCallback(
    (title: string, description: string, navigateTo?: string) => {
      if (!getIsAppInForeground()) {
        console.log("[ChatNotif] App in background, skipping in-app toast");
        return;
      }

      toast({
        title,
        description,
        duration: 5000,
        action: navigateTo ? (
          <Button variant="outline" size="sm" onClick={() => navigate(navigateTo)}>
            Görüntüle
          </Button>
        ) : undefined,
      });
    },
    [navigate],
  );

  // --- REAL-TIME LISTENER ---
  useEffect(() => {
    if (!user?.id) return;

    refreshUnreadCounts();

    const channel = supabase
      .channel("notifications-channel")
      // 1. ÖZEL MESAJLARI DİNLE
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          const newMsg: any = payload.new;
          if (!newMsg) return;

          refreshUnreadCounts();

          // 🔴 AKTİF SOHBET KONTROLÜ - Eğer kullanıcı zaten bu sohbetteyse toast gösterme
          const activeChats = getActivePrivateChats();
          const isInActiveChat = activeChats.includes(newMsg.chat_id);
          
          if (isInActiveChat) {
            console.log("💬 [ChatNotif] Kullanıcı zaten bu sohbette, toast gösterilmiyor:", newMsg.chat_id);
            return; // Toast gösterme, sadece unread count güncellendi
          }

          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", newMsg.sender_id)
            .single();

          const senderName = senderProfile?.username || "Birisi";

          showInAppNotification("💬 Yeni Özel Mesaj", `${senderName} sana mesaj gönderdi`, "/chat");
        },
      )
      // 2. GENEL BİLDİRİMLERİ DİNLE (Notifications Tablosu)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif: any = payload.new;
          if (!notif) return;

          // Mention (Etiketlenme)
          if (notif.type === "mention") {
            refreshUnreadCounts();
            showInAppNotification("📢 Senden Bahsedildi", notif.message, "/chat");
          }

          // Özel Mesaj (Notifications tablosu üzerinden gelirse)
          if (notif.type === "message") {
            refreshUnreadCounts();
            showInAppNotification("💬 Yeni Özel Mesaj", notif.message, "/chat");
          }

          // Rakip Oyundan Ayrıldı
          if (notif.type === "tournament_opponent_left") {
            toast({
              title: "🏆 Hükmen Galibiyet!",
              description: notif.message,
              duration: 6000,
            });
          }

          // 🏆 TURNUVA SONA ERDİ (Buraya ekledik)
          if (notif.type === "tournament_end") {
            toast({
              title: "🏆 Turnuva Sona Erdi!",
              description: notif.message,
              duration: 8000, // Kutlama için biraz uzun kalsın
              action: (
                <Button variant="outline" size="sm" onClick={() => navigate(`/tournament-bracket/${notif.related_id}`)}>
                  Sonuçlar
                </Button>
              ),
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        refreshUnreadCounts,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.username, navigate, showInAppNotification]);

  const totalNotifications = unreadCount + globalMentionCount;

  return {
    unreadCount,
    globalMentionCount,
    totalNotifications,
    markAllAsRead,
    markPrivateMessagesAsRead,
    markGlobalMessagesAsRead,
    refreshUnreadCounts,
  };
}
