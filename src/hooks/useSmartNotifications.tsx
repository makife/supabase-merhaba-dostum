import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getIsAppInForeground } from "./useAppForegroundState";

/**
 * Smart notification system:
 * - App in foreground: Show in-app toast only (no push)
 * - App in background/closed: Send push notification only
 */
export function useSmartNotifications() {
  const navigate = useNavigate();

  // Show in-app toast notification
  const showInAppToast = useCallback(
    (title: string, description: string, navigateTo?: string) => {
      toast({
        title,
        description,
        duration: 5000,
        action: navigateTo ? (
          <Button variant="outline" size="sm" onClick={() => navigate(navigateTo)}>
            Görüntüle
          </Button>
        ) : undefined,
      });
    },
    [navigate],
  );

  // Send push notification via edge function
  // skipIfOnline: if true, server will skip push if user was recently active
  const sendPushNotification = useCallback(
    async (
      receiverId: string,
      title: string,
      body: string,
      data?: Record<string, string>,
      skipIfOnline: boolean = true, // Default: skip push if user is online (they'll see in-app toast)
    ) => {
      try {
        const { error } = await supabase.functions.invoke("send-push-notification", {
          body: {
            receiver_id: receiverId,
            title,
            body,
            data,
            skipIfOnline, // Server checks if user was active recently
          },
        });

        if (error) {
          console.error("[SmartNotif] Push notification error:", error);
          return false;
        }

        console.log("[SmartNotif] Push notification sent successfully");
        return true;
      } catch (error) {
        console.error("[SmartNotif] Push notification failed:", error);
        return false;
      }
    },
    [],
  );

  // Smart notification: decides between in-app toast or push
  const sendSmartNotification = useCallback(
    async (options: {
      receiverId: string;
      title: string;
      body: string;
      navigateTo?: string;
      data?: Record<string, string>;
      // If true, always send push (for when receiver is different user)
      alwaysPush?: boolean;
    }) => {
      const { receiverId, title, body, navigateTo, data, alwaysPush } = options;

      const isInForeground = getIsAppInForeground();

      console.log("[SmartNotif] Sending notification:", {
        isInForeground,
        alwaysPush,
        title,
      });

      // If alwaysPush is true (notification for another user), always send push
      // The receiving user's app will handle whether to show it based on their app state
      if (alwaysPush) {
        await sendPushNotification(receiverId, title, body, data);
        return;
      }

      // For current user notifications:
      // If app is in foreground, show in-app toast
      // If app is in background, the realtime listener won't work anyway
      // Push notifications are handled by the server-side when messages are created
      if (isInForeground) {
        showInAppToast(title, body, navigateTo);
      }
    },
    [sendPushNotification, showInAppToast],
  );

  // Specific notification types
  const sendMessageNotification = useCallback(
    async (receiverId: string, senderUsername: string, chatId: string) => {
      // skipIfOnline: true (varsayılan) olduğu için,
      // karşı taraf ONLİNE ise Push gitmeyecek, sadece uygulama içi soket bildirimi alacak.
      // Karşı taraf OFFLİNE ise Push gidecek.
      await sendPushNotification(
        receiverId,
        "💬 Yeni Özel Mesaj",
        `${senderUsername} sana mesaj gönderdi`,
        { type: "message", chatId },
        true, // Explicitly true
      );
    },
    [sendPushNotification],
  );

  const sendMentionNotification = useCallback(
    async (receiverId: string, senderUsername: string, message: string) => {
      await sendPushNotification(
        receiverId,
        "📢 Senden Bahsedildi",
        `${senderUsername}: ${message.substring(0, 50)}...`,
        { type: "mention" },
        true, // Explicitly true
      );
    },
    [sendPushNotification],
  );

  const sendGameInviteNotification = useCallback(
    async (receiverId: string, senderUsername: string, roomCode: string) => {
      await sendPushNotification(receiverId, "🎮 Oyun Daveti", `${senderUsername} seni oyuna davet etti!`, {
        type: "game_invite",
        roomCode,
      });
    },
    [sendPushNotification],
  );

  const sendTournamentNotification = useCallback(
    async (receiverId: string, message: string) => {
      await sendPushNotification(receiverId, "🏆 Turnuva Bildirimi", message, { type: "tournament" });
    },
    [sendPushNotification],
  );

  return {
    showInAppToast,
    sendPushNotification,
    sendSmartNotification,
    sendMessageNotification,
    sendMentionNotification,
    sendGameInviteNotification,
    sendTournamentNotification,
  };
}
