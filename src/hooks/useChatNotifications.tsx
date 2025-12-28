import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner"; // Eğer hata verirse burayı tekrar use-toast yap
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { getIsAppInForeground } from "./useAppForegroundState";
// "activePrivateChat" importunu kaldırdık çünkü hata veriyordu

export function useChatNotifications() {
  const { user } = useAuth();
  const { profile } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
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
    if (!user?.id) return 0;
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

    if (!error) setUnreadCount(0);
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

  const markAllAsRead = async () => {
    await markPrivateMessagesAsRead();
    await markGlobalMessagesAsRead();
  };

  const refreshUnreadCounts = async () => {
    const privateCount = await loadUnreadMessages();
    const mentionCount = await loadGlobalMentions();
    setUnreadCount(privateCount);
    setGlobalMentionCount(mentionCount);
  };

  const showInAppNotification = useCallback(
    (title: string, description: string, navigateTo?: string, relatedChatId?: string) => {
      // 1. Uygulama arka planda ise bildirim gösterme
      if (!getIsAppInForeground()) {
        return;
      }

      // URL kontrolü ile o anki sohbette miyiz anlamaya çalışalım (Yedek Yöntem)
      if (relatedChatId && location.pathname.includes("/chat") && location.search.includes(relatedChatId)) {
        return;
      }

      toast(title, {
        description,
        duration: 3000,
        action: navigateTo
          ? {
              label: "Görüntüle",
              onClick: () => navigate(navigateTo),
            }
          : undefined,
      });
    },
    [navigate, location.pathname, location.search],
  );

  useEffect(() => {
    if (!user?.id) return;

    refreshUnreadCounts();

    const channel = supabase
      .channel("notifications-global-listener")
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

          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", newMsg.sender_id)
            .single();

          const senderName = senderProfile?.username || "Birisi";
          const msgPreview = newMsg.message
            ? newMsg.message.length > 30
              ? newMsg.message.substring(0, 30) + "..."
              : newMsg.message
            : "Fotoğraf";

          showInAppNotification(
            "💬 Yeni Mesaj",
            `${senderName}: ${msgPreview}`,
            `/chat?uid=${newMsg.sender_id}`, // Burayı kendi link yapına göre ayarla
            newMsg.chat_id,
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

          if (notif.type === "mention") {
            refreshUnreadCounts();
            showInAppNotification("📢 Global Sohbet", notif.message, "/chat");
          }

          if (notif.type === "game_invite") {
            showInAppNotification("🎮 Oyun Daveti", notif.message, `/game-join/${notif.related_id}`);
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
  }, [user?.id, showInAppNotification]);

  return {
    unreadCount,
    globalMentionCount,
    totalNotifications: unreadCount + globalMentionCount,
    markAllAsRead,
    markPrivateMessagesAsRead,
    markGlobalMessagesAsRead,
    refreshUnreadCounts,
  };
}
