import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getIsAppInForeground } from "./useAppForegroundState";
import { getActivePrivateChats } from "@/utils/notifications";
import { autoReconnect } from "@/utils/supabaseAutoReconnect";

export function useChatNotifications() {
  const { user } = useAuth();
  const { profile } = useUser();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalMentionCount, setGlobalMentionCount] = useState(0);

  // navigate'i ref'te tut - dependency'den çıkar
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const loadUnreadMessages = useCallback(async () => {
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
  }, [user?.id]);

  const loadGlobalMentions = useCallback(async () => {
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
  }, [user?.id, profile?.username]);

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

  const refreshUnreadCounts = useCallback(async () => {
    const privateCount = await loadUnreadMessages();
    const mentionCount = await loadGlobalMentions();
    setUnreadCount(privateCount);
    setGlobalMentionCount(mentionCount);
  }, [loadUnreadMessages, loadGlobalMentions]);

  // Uygulama içi bildirim gösterme
  const showInAppNotification = useCallback((title: string, description: string, navigateTo?: string) => {
    if (!getIsAppInForeground()) {
      console.log("[ChatNotif] App in background, skipping in-app toast");
      return;
    }

    toast.info(title, {
      description,
      duration: 5000,
      action: navigateTo
        ? {
            label: "Git",
            onClick: () => navigateRef.current(navigateTo),
          }
        : undefined,
    });
  }, []);

  // --- REAL-TIME LISTENER (autoReconnect ile) ---
  useEffect(() => {
    if (!user?.id) return;

    console.log("[ChatNotif] 🔌 Setting up notification subscription:", user.id.slice(-8));

    // İlk yükleme
    refreshUnreadCounts();

    // Unique channel name for this user
    const channelName = `chat-notifications-${user.id}`;

    // autoReconnect ile kaydet
    autoReconnect.registerChannel(channelName, () =>
      supabase
        .channel(channelName, {
          config: {
            broadcast: { self: false },
          },
        })
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

            console.log("📨 [ChatNotif] Yeni özel mesaj alındı:", newMsg.chat_id);

            refreshUnreadCounts();

            const activeChats = getActivePrivateChats();
            const isInActiveChat = activeChats.includes(newMsg.chat_id);

            if (isInActiveChat) {
              console.log("💬 [ChatNotif] Kullanıcı zaten bu sohbette, toast gösterilmiyor");
              return;
            }

            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("username")
              .eq("id", newMsg.sender_id)
              .single();

            const senderName = senderProfile?.username || "Birisi";
            // Doğru özel sohbete yönlendir
            showInAppNotification(
              "💬 Yeni Özel Mesaj",
              `${senderName} sana mesaj gönderdi`,
              `/chat?openPrivateChat=${newMsg.sender_id}`,
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
          async (payload) => {
            const notif: any = payload.new;
            if (!notif) return;

            console.log("📢 [ChatNotif] Yeni bildirim alındı:", notif.type, notif);

            if (notif.type === "mention") {
              refreshUnreadCounts();

              // 👇 KULLANICI GLOBAL CHAT'TE Mİ KONTROLÜ
              const isInGlobalChat = window.location.pathname === "/chat";

              if (isInGlobalChat && getIsAppInForeground()) {
                console.log("💬 [ChatNotif] Kullanıcı zaten global chat'te, toast gösterilmiyor");
                // Sadece count'u güncelle, toast gösterme
                return;
              }

              // Toast göster
              showInAppNotification("📢 Senden Bahsedildi", notif.message, "/chat");
            }

            if (notif.type === "message" && notif.related_id) {
              // 🔥 DUPLICATE FIX: Toast'ı private_messages listener'ı zaten gösteriyor.
              // Burada sadece unread count'u güncelle, ikinci toast atma.
              refreshUnreadCounts();
              return;
            }

            if (notif.type === "tournament_opponent_left") {
              toast.success("🏆 Hükmen Galibiyet!", {
                description: notif.message,
                duration: 6000,
              });
            }

            // friend_request ve friend_request_accepted NotificationContext tarafından gösteriliyor
            // Burada tekrar gösterme - duplicate toast önlenir
            if (notif.type === "friend_request" || notif.type === "friend_request_accepted") {
              return;
            }

            if (notif.type === "tournament_end") {
              toast.success("🏆 Turnuva Sona Erdi!", {
                description: notif.message,
                duration: 8000,
                action: {
                  label: "Sonuçlar",
                  onClick: () => navigateRef.current(`/tournament-bracket/${notif.related_id}`),
                },
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
          () => {
            refreshUnreadCounts();
          },
        )
        .subscribe((status) => {
          console.log("[ChatNotif] 📡 Subscription status:", status);
        }),
    );

    // Cleanup - autoReconnect'ten kayıt sil
    return () => {
      console.log("[ChatNotif] 🧹 Cleaning up notification channel");
      autoReconnect.unregisterChannel(channelName);
    };
  }, [user?.id, refreshUnreadCounts, showInAppNotification]);

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
