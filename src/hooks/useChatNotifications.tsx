import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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
      // notifications tablosundan mention bildirimlerini kontrol et
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

    // Mention notification'larını read olarak işaretle
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("type", "mention")
      .eq("is_read", false);

    // Global chat mention sayacını sıfırla
    setGlobalMentionCount(0);
  };

  const refreshUnreadCounts = async () => {
    const privateCount = await loadUnreadMessages();
    const mentionCount = await loadGlobalMentions();
    setUnreadCount(privateCount);
    setGlobalMentionCount(mentionCount);
  };

  // NOT: Rematch kabul/ret fonksiyonları App.tsx'e taşındı (global dinleyici için)
  useEffect(() => {
    if (!user?.id) return;

    refreshUnreadCounts();

    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "private_messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        refreshUnreadCounts,
      )
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

          if (notif.type === "mention") {
            refreshUnreadCounts();
          }

          // Turnuva rakip ayrıldı bildirimi
          if (notif.type === "tournament_opponent_left") {
            toast({
              title: "🏆 Turnuva Zaferi!",
              description: notif.message,
              duration: 6000,
            });
          }

          // NOT: Rematch toast'ları App.tsx'te gösteriliyor (global)
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
  }, [user?.id, profile?.username]);

  // useChatNotifications.tsx dosyasına şu useEffect'i ekleyin:

  useEffect(() => {
    if (!user?.id) return;

    // Real-time bildirim dinleyicisi
    const notificationChannel = supabase
      .channel("real-time-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification: any = payload.new;

          // Anında toast bildirimi göster
          if (newNotification.type === "mention") {
            toast({
              title: "📢 Senden bahsedildi!",
              description: newNotification.message,
              duration: 5000,
              action: (
                <Button variant="outline" size="sm" onClick={() => navigate("/chat")}>
                  Mesaja Git
                </Button>
              ),
            });
          }

          if (newNotification.type === "message") {
            toast({
              title: "💬 Yeni Özel Mesaj",
              description: newNotification.message,
              duration: 5000,
              action: (
                <Button variant="outline" size="sm" onClick={() => navigate("/private-chat")}>
                  Mesajları Gör
                </Button>
              ),
            });
          }

          // Sayacı güncelle
          refreshUnreadCounts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
  }, [user?.id, navigate]);

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
