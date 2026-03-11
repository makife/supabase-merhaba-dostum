import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner"; // Eğer proje ayarlarında "use-toast" varsa onu kullan
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

/**
 * Akıllı Bildirim Sistemi:
 * - Bu hook GENELLİKLE BAŞKALARINA bildirim göndermek için kullanılır.
 * - Uygulama içi (kendine) bildirim göstermek için `showInAppToast` kullanılır.
 */
export function useSmartNotifications() {
  const navigate = useNavigate();

  // 1. Basit Uygulama İçi Toast Gösterici (useChatNotifications içinde kullanılıyor)
  const showInAppToast = useCallback(
    (title: string, description: string, navigateTo?: string) => {
      toast(title, {
        description,
        duration: 4000,
        action: navigateTo
          ? {
              label: "Görüntüle",
              onClick: () => navigate(navigateTo),
            }
          : undefined,
      });
    },
    [navigate],
  );

  // 2. Sunucuya Push İsteği Gönderme (Edge Function)
  // skipIfOnline = true ise: Sunucu alıcının last_seen değerine bakar.
  // Alıcı aktifse Push GÖNDERMEZ (Çünkü alıcı Toast görecektir).
  const sendPushNotification = useCallback(
    async (
      receiverId: string,
      title: string,
      body: string,
      data?: Record<string, string>,
      skipIfOnline: boolean = true, // VARSAYILAN: TRUE (Bizim hibrit mantık için şart)
    ) => {
      try {
        const { error } = await supabase.functions.invoke("send-push-notification", {
          body: {
            receiverId: receiverId,
            title,
            body,
            data,
            skipIfOnline, // Bu bayrak sunucudaki push filtresini çalıştırır
          },
        });

        if (error) {
          console.error("[SmartNotif] Push isteği hatası:", error);
          return false;
        }

        // Başarılı olsa bile konsola basmaya gerek yok, sessizce çalışsın
        return true;
      } catch (error) {
        console.error("[SmartNotif] Push fonksiyonu hatası:", error);
        return false;
      }
    },
    [],
  );

  // --- ÖZEL FONKSİYONLAR ---

  // Mesaj gönderirken çağrılır
  const sendMessageNotification = useCallback(
    async (receiverId: string, senderUsername: string, chatId: string) => {
      // skipIfOnline: true (varsayılan)
      // Alıcı oyundaysa Push gitmez, Toast görür.
      // Alıcı offline ise Push gider.
      await sendPushNotification(
        receiverId,
        "💬 Yeni Mesaj",
        `${senderUsername} sana mesaj gönderdi`,
        { type: "message", chatId },
        true,
      );
    },
    [sendPushNotification],
  );

  // Biri seni etiketlediğinde
  const sendMentionNotification = useCallback(
    async (receiverId: string, senderUsername: string, message: string) => {
      await sendPushNotification(
        receiverId,
        "📢 Senden Bahsedildi",
        `${senderUsername}: ${message.substring(0, 50)}...`,
        { type: "mention" },
        true,
      );
    },
    [sendPushNotification],
  );

  // Oyun daveti (Bunu biraz daha agresif yapabiliriz ama şimdilik hibrit kalsın)
  const sendGameInviteNotification = useCallback(
    async (receiverId: string, senderUsername: string, roomCode: string) => {
      await sendPushNotification(
        receiverId,
        "🎮 Oyun Daveti",
        `${senderUsername} seni oyuna davet etti!`,
        { type: "game_invite", roomCode },
        true,
      );
    },
    [sendPushNotification],
  );

  // Turnuva bildirimleri (Genelde herkese gider)
  const sendTournamentNotification = useCallback(
    async (receiverId: string, message: string) => {
      await sendPushNotification(receiverId, "🏆 Turnuva Bildirimi", message, { type: "tournament" }, true);
    },
    [sendPushNotification],
  );

  // Arkadaşlık isteği bildirimi
  const sendFriendRequestNotification = useCallback(
    async (receiverId: string, senderUsername: string) => {
      await sendPushNotification(
        receiverId,
        "🤝 Arkadaşlık Daveti",
        `${senderUsername} sana arkadaşlık daveti gönderdi!`,
        { type: "friend_request" },
        true,
      );
    },
    [sendPushNotification],
  );

  // Arkadaşlık kabul bildirimi
  const sendFriendAcceptedNotification = useCallback(
    async (receiverId: string, accepterUsername: string) => {
      await sendPushNotification(
        receiverId,
        "🎉 Arkadaşlık Kabul Edildi",
        `${accepterUsername} arkadaşlık davetini kabul etti!`,
        { type: "friend_request_accepted" },
        true,
      );
    },
    [sendPushNotification],
  );

  return {
    showInAppToast,
    sendPushNotification,
    sendMessageNotification,
    sendMentionNotification,
    sendGameInviteNotification,
    sendTournamentNotification,
    sendFriendRequestNotification,
    sendFriendAcceptedNotification,
  };
}
