import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
  
  // 🔥 Subscription guard - aynı user için tekrar oluşturma
  const subscriptionUserIdRef = useRef<string | null>(null);
  const channelRef = useRef<any>(null);
  // navigate'i ref'te tut - dependency'den çıkar
  const navigateRef = useRef(navigate);
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
  }, [user?.id, profile?.username]);

  // Uygulama içi bildirim gösterme - ref kullan
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
    [], // 🔥 Boş dependency - navigateRef kullandığımız için
  );

  // --- REAL-TIME LISTENER ---
  useEffect(() => {
    if (!user?.id) return;

    // 🔥 GUARD: Aynı user için zaten subscription varsa atla
    if (subscriptionUserIdRef.current === user.id && channelRef.current) {
      console.log("[ChatNotif] ⏭️ Subscription zaten aktif, atlanıyor...");
      refreshUnreadCounts(); // Sadece count'ları yenile
      return;
    }

    console.log("[ChatNotif] 🔌 Yeni subscription oluşturuluyor:", user.id.slice(-8));
    subscriptionUserIdRef.current = user.id;

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
                <Button variant="outline" size="sm" onClick={() => navigateRef.current(`/tournament/bracket/${notif.related_id}`)}>
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

    // Cleanup - channel'ı koruyoruz
    return () => {
      // Channel korunuyor, sadece log
      console.log("[ChatNotif] Cleanup - channel korunuyor");
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
