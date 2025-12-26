import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getIsAppInForeground } from "./useAppForegroundState";

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

  // Show in-app toast notification (only when app is in foreground)
  const showInAppNotification = useCallback((
    title: string,
    description: string,
    navigateTo?: string
  ) => {
    // Only show toast if app is in foreground
    if (!getIsAppInForeground()) {
      console.log("[ChatNotif] App in background, skipping in-app toast");
      return;
    }

    toast({
      title,
      description,
      duration: 5000,
      action: navigateTo ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(navigateTo)}
        >
          Görüntüle
        </Button>
      ) : undefined,
    });
  }, [navigate]);

  // Real-time notification listener
  // Only shows in-app toasts - push notifications are handled by the server
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
        async (payload) => {
          const newMsg: any = payload.new;
          if (!newMsg) return;

          // Update unread count
          refreshUnreadCounts();

          // Get sender info
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", newMsg.sender_id)
            .single();

          const senderName = senderProfile?.username || "Birisi";

          // Show in-app toast (only if app is in foreground)
          // Push notification is already handled by the message sender
          showInAppNotification(
            "💬 Yeni Özel Mesaj",
            `${senderName} sana mesaj gönderdi`,
            "/chat"
          );
        },
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

          // Mention notification
          if (notif.type === "mention") {
            refreshUnreadCounts();
            showInAppNotification(
              "📢 Senden Bahsedildi",
              notif.message,
              "/chat"
            );
          }

          // Private message notification (from notifications table)
          if (notif.type === "message") {
            refreshUnreadCounts();
            showInAppNotification(
              "💬 Yeni Özel Mesaj",
              notif.message,
              "/chat"
            );
          }

          // Tournament opponent left notification
          if (notif.type === "tournament_opponent_left") {
            toast({
              title: "🏆 Turnuva Zaferi!",
              description: notif.message,
              duration: 6000,
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
