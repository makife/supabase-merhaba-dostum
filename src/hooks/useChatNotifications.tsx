import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { getIsAppInForeground, subscribeToRecoveryComplete } from "./useAppForegroundState";
import { getActivePrivateChats } from "@/utils/notifications";
import { registerForegroundCleanup } from "@/utils/foregroundOrchestrator";

export function useChatNotifications() {
  const { user } = useAuth();
  const { profile } = useUser();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalMentionCount, setGlobalMentionCount] = useState(0);
  
  // Refs
  const channelRef = useRef<any>(null);
  const navigateRef = useRef(navigate);
  const isMountedRef = useRef(true);
  navigateRef.current = navigate;

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

    if (!error && isMountedRef.current) {
      setUnreadCount(0);
    }
  };

  const markAllAsRead = async () => {
    await markPrivateMessagesAsRead();
    await markGlobalMessagesAsRead();
    if (isMountedRef.current) {
      setGlobalMentionCount(0);
    }
  };

  const markGlobalMessagesAsRead = async () => {
    if (!user?.id) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("type", "mention")
      .eq("is_read", false);

    if (isMountedRef.current) {
      setGlobalMentionCount(0);
    }
  };

  const refreshUnreadCounts = useCallback(async () => {
    if (!isMountedRef.current) return;
    const privateCount = await loadUnreadMessages();
    const mentionCount = await loadGlobalMentions();
    if (isMountedRef.current) {
      setUnreadCount(privateCount);
      setGlobalMentionCount(mentionCount);
    }
  }, [user?.id, profile?.username]);

  // Uygulama içi bildirim gösterme
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
          <Button variant="outline" size="sm" onClick={() => navigateRef.current(navigateTo)}>
            Görüntüle
          </Button>
        ) : undefined,
      });
    },
    [],
  );

  // 🔥 Subscription'ı kapat
  const closeSubscription = useCallback(() => {
    console.log("[ChatNotif] 🧹 Subscription kapatılıyor...");
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  // 🔥 Subscription'ı aç
  const openSubscription = useCallback(() => {
    if (!user?.id || channelRef.current) return;

    console.log("[ChatNotif] 🔌 Subscription açılıyor:", user.id.slice(-8));

    const channel = supabase
      .channel(`notifications-channel-${user.id}-${Date.now()}`)
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
          showInAppNotification("💬 Yeni Özel Mesaj", `${senderName} sana mesaj gönderdi`, "/chat");
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
            showInAppNotification("📢 Senden Bahsedildi", notif.message, "/chat");
          }

          if (notif.type === "message") {
            refreshUnreadCounts();
            showInAppNotification("💬 Yeni Özel Mesaj", notif.message, "/chat");
          }

          if (notif.type === "tournament_opponent_left") {
            toast({
              title: "🏆 Hükmen Galibiyet!",
              description: notif.message,
              duration: 6000,
            });
          }

          if (notif.type === "tournament_end") {
            toast({
              title: "🏆 Turnuva Sona Erdi!",
              description: notif.message,
              duration: 8000,
              action: (
                <Button variant="outline" size="sm" onClick={() => navigateRef.current(`/tournament-bracket/${notif.related_id}`)}>
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
    
    channelRef.current = channel;
  }, [user?.id, refreshUnreadCounts, showInAppNotification]);

  // Ana effect
  useEffect(() => {
    isMountedRef.current = true;

    if (!user?.id) return;

    // İlk yükleme
    refreshUnreadCounts();

    // Native platformda orchestrator'a kayıt ol
    if (Capacitor.isNativePlatform()) {
      const unregisterCleanup = registerForegroundCleanup(closeSubscription);
      
      const unsubscribeRecovery = subscribeToRecoveryComplete(() => {
        console.log("[ChatNotif] 🔄 Recovery complete - subscription yeniden açılıyor");
        openSubscription();
        refreshUnreadCounts();
      });

      openSubscription();

      return () => {
        isMountedRef.current = false;
        unregisterCleanup();
        unsubscribeRecovery();
        closeSubscription();
      };
    } else {
      // Web platformda normal davranış
      openSubscription();

      return () => {
        isMountedRef.current = false;
        closeSubscription();
      };
    }
  }, [user?.id, refreshUnreadCounts, openSubscription, closeSubscription]);

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
