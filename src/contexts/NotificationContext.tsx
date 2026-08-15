import { createContext, useContext, ReactNode, useEffect, useRef, useState } from "react";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { PremiumGiftDialog } from "@/components/PremiumGiftDialog";
import { GameInviteCard } from "@/components/GameInviteCard";

import { autoReconnect } from "@/utils/supabaseAutoReconnect";

// Helper: Davet toast'ı göster
const sendInviteResponseNotification = async (hostId: string, username: string, accepted: boolean) => {
  try {
    await supabase.from("notifications").insert({
      user_id: hostId,
      type: "invite_response",
      message: accepted ? `✅ ${username} davetini kabul etti!` : `❌ ${username} davetini reddetti.`,
      is_read: false,
    });
  } catch (err) {
    console.error("Davet yanıt bildirimi hatası:", err);
  }
};

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

interface InviteCardState {
  open: boolean;
  notification: any | null;
  hostUsername: string;
  hostAvatarUrl: string | null;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const { unreadCount } = useChatNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();
  const shownNotifications = useRef<Set<string>>(new Set());
  const hasLoadedInvites = useRef(false);
  const lastKnownCredits = useRef<number | null>(null);
  const purchaseSuppressRef = useRef(false);
  const [premiumGift, setPremiumGift] = useState<{ open: boolean; message?: string }>({ open: false });

  // 🎮 Oyun daveti kartı (eski toast bildirimi yerine)
  const [inviteCard, setInviteCard] = useState<InviteCardState>({
    open: false,
    notification: null,
    hostUsername: "",
    hostAvatarUrl: null,
  });
  const [inviteBusy, setInviteBusy] = useState(false);

  // Bir room_invite bildirimi geldiğinde host bilgilerini çekip kartı açar
  const openInviteCard = async (notification: any) => {
    if (!notification?.related_id) return;
    try {
      const { data: roomData } = await supabase
        .from("game_rooms")
        .select("host_id")
        .eq("room_code", notification.related_id)
        .maybeSingle();

      let hostUsername = "Oyuncu";
      let hostAvatarUrl: string | null = null;

      if (roomData?.host_id) {
        const { data: hostProfile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", roomData.host_id)
          .maybeSingle();
        hostUsername = hostProfile?.username || "Oyuncu";
        // NOT: "avatar_url" kolon adı profiles tablonuzdaki gerçek kolon adıyla
        // eşleşmiyorsa burayı kendi kolon adınızla değiştirin.
        hostAvatarUrl = (hostProfile as any)?.avatar_url || null;
      }

      setInviteCard({ open: true, notification, hostUsername, hostAvatarUrl });
    } catch (err) {
      console.error("Davet kartı açma hatası:", err);
    }
  };

  const closeInviteCard = () => {
    setInviteCard({ open: false, notification: null, hostUsername: "", hostAvatarUrl: null });
  };

  const handleAcceptInvite = async () => {
    const notification = inviteCard.notification;
    if (!notification || !user || inviteBusy) return;
    setInviteBusy(true);
    try {
      // 🔒 Kredi kontrolü (premium/sınırsız akış dahil)
      const { data: profile } = await supabase
        .from("profiles")
        .select("game_credits, bonus_credits, premium_until, unlimited_lives_until")
        .eq("id", user.id)
        .single();

      const now = new Date();
      const hasUnlimitedAccess =
        (profile?.premium_until && new Date(profile.premium_until) > now) ||
        (profile?.unlimited_lives_until && new Date(profile.unlimited_lives_until) > now);

      const totalCredits = (profile?.game_credits || 0) + (profile?.bonus_credits || 0);
      if (!hasUnlimitedAccess && totalCredits < 1) {
        toast.error("Yetersiz Hak! Oyun hakkınız bulunmamaktadır.", { duration: 3000 });
        closeInviteCard();
        navigate("/market");
        return;
      }

      await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);

      // Davet edene kabul bildirimi gönder
      const { data: roomData } = await supabase
        .from("game_rooms")
        .select("host_id")
        .eq("room_code", notification.related_id)
        .maybeSingle();

      if (roomData?.host_id) {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        await sendInviteResponseNotification(roomData.host_id, userProfile?.username || "Oyuncu", true);
      }

      const roomCode = notification.related_id;
      closeInviteCard();
      navigate(`/private-room/waiting/${roomCode}`);
    } catch (err) {
      console.error("Davet kabul hatası:", err);
      toast.error("Davet kabul edilemedi");
      closeInviteCard();
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRejectInvite = async () => {
    const notification = inviteCard.notification;
    if (!notification || !user || inviteBusy) return;
    setInviteBusy(true);
    try {
      const { data: roomData } = await supabase
        .from("game_rooms")
        .select("host_id")
        .eq("room_code", notification.related_id)
        .maybeSingle();

      if (roomData?.host_id) {
        await supabase.from("room_invite_rejections").insert({
          room_code: notification.related_id,
          rejected_by: user.id,
          rejected_from: roomData.host_id,
        });

        // Davet edene ret bildirimi gönder
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        await sendInviteResponseNotification(roomData.host_id, profile?.username || "Oyuncu", false);
      }

      await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
      toast.info("Davet reddedildi", { duration: 2000 });
    } catch (err) {
      console.error("Davet reddetme hatası:", err);
    } finally {
      closeInviteCard();
      setInviteBusy(false);
    }
  };

  // Satın alma sırasında toast'u bastırmak için global event dinle
  useEffect(() => {
    const suppressOn = () => {
      purchaseSuppressRef.current = true;
      // 5 saniye sonra otomatik kapat (güvenlik)
      setTimeout(() => {
        purchaseSuppressRef.current = false;
      }, 5000);
    };
    window.addEventListener("purchaseStarted", suppressOn);
    return () => {
      window.removeEventListener("purchaseStarted", suppressOn);
    };
  }, []);

  // 🔔 Online iken +1 kredi artışını toast ile göster
  useEffect(() => {
    if (!user) return;

    const channelName = `credit-change-${user.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          const newCredits = payload.new?.game_credits;
          const oldCredits = lastKnownCredits.current;

          // Satın alma sırasında bu toast'u gösterme
          if (purchaseSuppressRef.current) {
            if (newCredits !== null && newCredits !== undefined) {
              lastKnownCredits.current = newCredits;
            }
            return;
          }

          if (oldCredits !== null && newCredits !== null && newCredits > oldCredits && newCredits <= 5) {
            toast.success(`❤️ +1 Oyun Hakkın Yenilendi! (${newCredits}/5)`, {
              duration: 3000,
            });
          }

          if (newCredits !== null && newCredits !== undefined) {
            lastKnownCredits.current = newCredits;
          }
        },
      )
      .subscribe();

    // İlk değeri set et
    supabase
      .from("profiles")
      .select("game_credits")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) lastKnownCredits.current = data.game_credits ?? 0;
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 🔥 Uygulama açıldığında bekleyen room_invite bildirimlerini BİR KERE göster
  useEffect(() => {
    if (!user) return;
    if (hasLoadedInvites.current) return;

    const fetchPendingInvites = async () => {
      try {
        hasLoadedInvites.current = true;
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { data: pendingInvites } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "room_invite")
          .eq("is_read", false)
          .gte("created_at", thirtyMinAgo)
          .order("created_at", { ascending: false })
          .limit(5);

        if (pendingInvites && pendingInvites.length > 0) {
          console.log("📬 Bekleyen davet bildirimleri bulundu:", pendingInvites.length);

          // Hepsini hemen okundu olarak işaretle (tekrar gösterilmesin)
          const ids = pendingInvites.map((n) => n.id);
          await supabase.from("notifications").update({ is_read: true }).in("id", ids);

          // Aynı anda tek bir davet kartı gösterebiliriz: en güncel olanı seçip aç,
          // geri kalanlar zaten okundu işaretlendi.
          const toShow = pendingInvites.find((n) => n.related_id && !shownNotifications.current.has(n.id));
          if (toShow) {
            shownNotifications.current.add(toShow.id);
            openInviteCard(toShow);
          }
        }
      } catch (err) {
        console.error("Bekleyen davet bildirimleri kontrol hatası:", err);
      }
    };

    const timer = setTimeout(fetchPendingInvites, 11000);
    return () => clearTimeout(timer);
  }, [user, navigate]);

  // Realtime bildirim dinleyici
  useEffect(() => {
    if (!user) return;

    const channelName = `user-notifications-toast-${user.id}`;

    const handleNotification = (payload: any) => {
      try {
        const notification = payload.new || payload;

        if (!notification || !notification.id) return;

        if (shownNotifications.current.has(notification.id)) return;
        shownNotifications.current.add(notification.id);

        console.log("✅ Bildirim işleniyor:", notification.type);

        if (notification.type === "badge_earned") {
          toast.success(notification.message, {
            duration: 5000,
            icon: <img src="/icons/badge.svg" alt="rozet" style={{ width: 20, height: 20 }} />,
          });
        }

        if (notification.type === "premium_gift") {
          supabase.from("notifications").update({ is_read: true }).eq("id", notification.id).then();
          setPremiumGift({ open: true, message: notification.message });
          return;
        }

        if (notification.type === "friend_request") {
          toast.info(`🤝 ${notification.message}`, {
            duration: 8000,
            action: {
              label: "Git",
              onClick: () => navigate("/friends"),
            },
          });
          return;
        }

        if (notification.type === "friend_request_accepted") {
          toast.success(`🎉 ${notification.message}`, {
            duration: 8000,
            action: {
              label: "Profile Git",
              onClick: () => navigate(`/profile/${notification.related_id}`),
            },
          });
          return;
        }

        if (notification.type === "room_invite" && notification.related_id) {
          // Hemen okundu olarak işaretle (tekrar gösterilmesin)
          supabase.from("notifications").update({ is_read: true }).eq("id", notification.id).then();
          openInviteCard(notification);
          return;
        }

        if (notification.type === "tournament_invite" && notification.related_id) {
          supabase.from("notifications").update({ is_read: true }).eq("id", notification.id).then();
          toast.info(`🏆 ${notification.message}`, {
            duration: 10000,
            action: {
              label: "Katıl",
              onClick: () => navigate(`/tournament/waiting/${notification.related_id}`),
            },
          });
          return;
        }

        if (notification.type === "invite_response") {
          supabase.from("notifications").update({ is_read: true }).eq("id", notification.id).then();
          const isAccepted = notification.message?.includes("kabul");
          toast(isAccepted ? "✅ Davet Kabul Edildi" : "❌ Davet Reddedildi", {
            description: notification.message,
            duration: 5000,
          });
          return;
        }

        // mention ve message bildirimleri useChatNotifications tarafından gösteriliyor
        if (notification.type === "mention") {
          return;
        }

        if (notification.type === "message" || notification.type === "private_message") {
          return;
        }
      } catch (err) {
        console.error("Bildirim işlenirken hata:", err);
      }
    };

    try {
      autoReconnect.registerChannel(channelName, () =>
        supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${user.id}`,
            },
            handleNotification,
          )
          .subscribe(),
      );

      return () => {
        autoReconnect.unregisterChannel(channelName);
      };
    } catch (err) {
      console.error("Bildirim kanalı oluşturulurken hata:", err);
    }
  }, [user, navigate]);

  // Bekleyen premium_gift bildirimini girişte yakala
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("notifications")
          .select("id, message")
          .eq("user_id", user.id)
          .eq("type", "premium_gift")
          .eq("is_read", false)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data && data[0]) {
          await supabase.from("notifications").update({ is_read: true }).eq("id", data[0].id);
          setPremiumGift({ open: true, message: data[0].message });
        }
      } catch (err) {
        console.error("premium_gift kontrol hatası:", err);
      }
    })();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  return (
    <NotificationContext.Provider value={{ unreadCount, markAsRead }}>
      {children}
      <PremiumGiftDialog
        open={premiumGift.open}
        message={premiumGift.message}
        onClose={() => setPremiumGift({ open: false })}
      />
      <GameInviteCard
        open={inviteCard.open}
        avatarUrl={inviteCard.hostAvatarUrl}
        username={inviteCard.hostUsername}
        busy={inviteBusy}
        onAccept={handleAcceptInvite}
        onReject={handleRejectInvite}
      />
    </NotificationContext.Provider>
  );
};
