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
    if (!user?.id) return;

    console.log("🔄 [ChatNotif] Badge sayacı güncelleniyor...");

    const privateCount = await loadUnreadMessages();
    const mentionCount = await loadGlobalMentions();

    console.log("📊 [ChatNotif] Yeni sayaçlar:", {
      privateCount,
      mentionCount,
      total: privateCount + mentionCount,
    });

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
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("🔔 [ChatNotif] Git butonu tıklandı, navigate:", navigateTo);
              navigateRef.current(navigateTo);
            }}
          >
            Git
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

    // İlk yükleme
    refreshUnreadCounts();

    // 🔄 Periyodik güncelleme - her 30 saniyede bir (real-time kaçırırsa diye)
    const intervalId = setInterval(() => {
      console.log("[ChatNotif] ⏰ Periyodik badge güncellemesi");
      refreshUnreadCounts();
    }, 30000); // 30 saniye

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
          const navigateUrl = `/chat?openPrivateChat=${newMsg.sender_id}`;

          console.log("🔔 [ChatNotif] Özel mesaj toast gösteriliyor:", {
            senderName,
            senderId: newMsg.sender_id,
            navigateUrl,
          });

          // 🔥 sender_id'yi URL parametresi olarak geç
          showInAppNotification("💬 Yeni Özel Mesaj", `${senderName} sana mesaj gönderdi`, navigateUrl);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "private_messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("🔄 [ChatNotif] Özel mesaj güncellendi (okundu)");
          refreshUnreadCounts();
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

          console.log("🔔 [ChatNotif] Notification alındı:", {
            type: notif.type,
            message: notif.message,
            related_id: notif.related_id,
          });

          if (notif.type === "mention") {
            refreshUnreadCounts();
            console.log("📢 [ChatNotif] Mention bildirimi gösteriliyor");
            // Global chat'i aç (mention genelde global'de olur)
            showInAppNotification("📢 Senden Bahsedildi", notif.message, "/chat");
          }

          if (notif.type === "message") {
            refreshUnreadCounts();
            console.log("💬 [ChatNotif] Message bildirimi gösteriliyor");
            // Eğer related_id varsa o kullanıcıyla sohbeti aç
            const navigateTo = notif.related_id ? `/chat?openPrivateChat=${notif.related_id}` : "/chat";
            showInAppNotification("💬 Yeni Özel Mesaj", notif.message, navigateTo);
          }

          if (notif.type === "tournament_opponent_left") {
            showInAppNotification("🏆 Hükmen Galibiyet!", notif.message);
          }

          if (notif.type === "tournament_end") {
            showInAppNotification("🏆 Turnuva Sona Erdi!", notif.message, `/tournament-bracket/${notif.related_id}`);
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

    // Cleanup - interval ve channel
    return () => {
      clearInterval(intervalId);
      console.log("[ChatNotif] Cleanup - interval temizlendi, channel korunuyor");
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
