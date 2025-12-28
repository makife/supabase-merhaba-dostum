import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast"; // veya "sonner" kullanıyorsan onu import et
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { getIsAppInForeground } from "./useAppForegroundState";
import { activePrivateChat } from "@/utils/notifications"; // PrivateChat'te kullandığın util

export function useChatNotifications() {
  const { user } = useAuth();
  const { profile } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalMentionCount, setGlobalMentionCount] = useState(0);

  // Okunmamış mesaj sayılarını çek
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

  // Global mention sayılarını çek
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

  // Okundu olarak işaretleme fonksiyonları
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

  // --- KRİTİK NOKTA: BİLDİRİM GÖSTERME MANTIĞI ---
  const showInAppNotification = useCallback(
    (title: string, description: string, navigateTo?: string, relatedChatId?: string) => {
      // 1. KURAL: Uygulama arka planda ise veya görünür değilse TOAST GÖSTERME.
      // Bu durumda sunucu (edge function) Push Notification gönderecektir.
      if (!getIsAppInForeground()) {
        console.log("App arka planda, toast engellendi (Push bekleniyor).");
        return;
      }

      // 2. KURAL: Eğer kullanıcı şu an o sohbetin içindeyse TOAST GÖSTERME.
      // activePrivateChat değişkeni PrivateChat component'inden yönetilir.
      if (relatedChatId && activePrivateChat === relatedChatId) {
        console.log("Kullanıcı aktif sohbette, toast engellendi.");
        return;
      }

      // Ekstra Güvenlik: URL kontrolü
      if (relatedChatId && location.pathname.includes("/chat") && location.search.includes(relatedChatId)) {
        return;
      }

      // 3. KURAL: Tüm şartlar sağlandıysa (Oyunda, Menüde vb.) TOAST GÖSTER.
      toast({
        title,
        description,
        duration: 3000, // Seri olması için 3sn
        action: navigateTo ? (
          <Button variant="outline" size="sm" onClick={() => navigate(navigateTo)}>
            Görüntüle
          </Button>
        ) : undefined,
      });
    },
    [navigate, location.pathname, location.search],
  );

  // Real-time listener
  useEffect(() => {
    if (!user?.id) return;

    refreshUnreadCounts();

    const channel = supabase
      .channel("notifications-global-listener")
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

          // Sayacı güncelle
          refreshUnreadCounts();

          // Gönderen ismini bul
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

          // Bildirim fonksiyonunu çağır (Filtreler orada yapılacak)
          showInAppNotification(
            "💬 Yeni Mesaj",
            `${senderName}: ${msgPreview}`,
            `/chat?uid=${newMsg.sender_id}`, // Linki kendi yapına göre düzenleyebilirsin
            newMsg.chat_id,
          );
        },
      )
      // 2. BİLDİRİMLERİ (Mention, Oyun Daveti vb.) DİNLE
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

          if (notif.type === "tournament_opponent_left") {
            toast({
              title: "🏆 Hükmen Galibiyet!",
              description: notif.message,
              duration: 4000,
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
