import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Dinamik import için tipler
type PushNotificationsType = typeof import("@capacitor/push-notifications").PushNotifications;
type LocalNotificationsType = typeof import("@capacitor/local-notifications").LocalNotifications;

export const useMobileNotifications = () => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [pushToken, setPushToken] = useState<string>("");
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if we're on a mobile platform
  const isMobile = Capacitor.isNativePlatform();

  // Güvenli plugin yükleme
  const getPushNotifications = async (): Promise<PushNotificationsType | null> => {
    try {
      if (!isMobile) return null;
      const module = await import("@capacitor/push-notifications");
      return module.PushNotifications;
    } catch (error) {
      console.log("PushNotifications plugin yüklenemedi:", error);
      return null;
    }
  };

  const getLocalNotifications = async (): Promise<LocalNotificationsType | null> => {
    try {
      if (!isMobile) return null;
      const module = await import("@capacitor/local-notifications");
      return module.LocalNotifications;
    } catch (error) {
      console.log("LocalNotifications plugin yüklenemedi:", error);
      return null;
    }
  };

  // Initialize push notifications
  const initializePushNotifications = useCallback(async () => {
    if (!isMobile) {
      // Web bildirim izinlerini kontrol et
      try {
        if ("Notification" in window) {
          const permission = await Notification.requestPermission();
          setIsPermissionGranted(permission === "granted");
        }
      } catch (error) {
        console.log("Web notification error:", error);
      }
      return;
    }

    try {
      const PushNotifications = await getPushNotifications();
      if (!PushNotifications) {
        console.log("PushNotifications plugin not available");
        return;
      }

      // Request permission to use push notifications
      const permissionStatus = await PushNotifications.requestPermissions();

      if (permissionStatus.receive === "granted") {
        setIsPermissionGranted(true);

        // Register with Apple / Google to receive push via APNS/FCM
        await PushNotifications.register();

        // Listen for registration events
        PushNotifications.addListener("registration", async (token) => {
          console.log("Push registration success, token: " + token.value);
          setPushToken(token.value);

          // Save token to database for the user
          if (user?.id) {
            await savePushToken(user.id, token.value);
          }
        });

        // Some issue with the setup and push will not work
        PushNotifications.addListener("registrationError", (error: any) => {
          console.error("Push registration error: ", error.error);
        });

        // Show us the notification payload if the app is open on iOS
        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("Push notification received: ", notification);
          showLocalNotification(notification.title || "Kelimele", notification.body || "Yeni bildiriminiz var");
        });

        // Method called when tapping on a notification
        PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
          console.log("Push notification action performed: ", notification);
          handleNotificationAction(notification);
        });
      } else {
        setIsPermissionGranted(false);
        console.log("Push notification permissions denied");
      }
    } catch (error) {
      console.error("Error initializing push notifications:", error);
    }
  }, [isMobile, user?.id]);

  // Initialize local notifications
  const initializeLocalNotifications = useCallback(async () => {
    if (!isMobile) return;

    try {
      const LocalNotifications = await getLocalNotifications();
      if (!LocalNotifications) {
        console.log("LocalNotifications plugin not available");
        return;
      }

      const permissionStatus = await LocalNotifications.requestPermissions();

      if (permissionStatus.display === "granted") {
        LocalNotifications.addListener("localNotificationActionPerformed", (notification) => {
          console.log("Local notification action performed: ", notification);
          handleNotificationAction(notification);
        });
      }
    } catch (error) {
      console.error("Error initializing local notifications:", error);
    }
  }, [isMobile]);

  // Save push token to database
  const savePushToken = async (userId: string, token: string) => {
    try {
      const { error } = await supabase.from("profiles").update({ push_token: token }).eq("id", userId);

      if (error) {
        console.error("Error saving push token to database:", error);
        const savedTokens = localStorage.getItem("push_tokens") || "{}";
        const tokens = JSON.parse(savedTokens);
        tokens[userId] = {
          token,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem("push_tokens", JSON.stringify(tokens));
      } else {
        console.log("Push token saved to database:", token);
      }
    } catch (error) {
      console.error("Error saving push token:", error);
    }
  };

  // Show local notification
  const showLocalNotification = async (title: string, body: string, data?: any) => {
    try {
      if (isMobile) {
        const LocalNotifications = await getLocalNotifications();
        if (!LocalNotifications) {
          console.log("LocalNotifications.schedule not available");
          return;
        }
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 1000) },
              sound: undefined,
              attachments: undefined,
              actionTypeId: "",
              extra: data,
            },
          ],
        });
      } else {
        // Web bildirimi göster
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, {
              body,
              icon: "/favicon.ico",
              badge: "/favicon.ico",
            });
          }
        } catch (webError) {
          console.log("Web notification error:", webError);
        }
      }
    } catch (error) {
      console.error("Error showing local notification:", error);
    }
  };

  // Handle notification action (tap, button press, etc.)
  const handleNotificationAction = (notification: any) => {
    try {
      const notificationData = notification.notification?.extra || notification.actionId;

      if (notificationData?.type === "game_invite") {
        window.location.href = `/game?room=${notificationData.roomCode}`;
      } else if (notificationData?.type === "private_message") {
        window.location.href = `/chat?chat=${notificationData.chatId}`;
      } else if (notificationData?.type === "tournament") {
        window.location.href = `/tournament`;
      }
    } catch (error) {
      console.error("Error handling notification action:", error);
    }
  };

  // Send game invite notification
  const sendGameInviteNotification = async (receiverId: string, senderUsername: string, roomCode: string) => {
    const title = "Oyun Daveti";
    const body = `${senderUsername} sizi oyuna davet ediyor!`;

    if (isMobile) {
      await sendPushNotification(receiverId, title, body, {
        type: "game_invite",
        roomCode,
        senderUsername,
      });
    }

    console.log("🎮 GAME INVITE NOTIFICATION SENT:", {
      to: receiverId,
      from: senderUsername,
      roomCode,
      title,
      body,
    });
  };

  // Send private message notification
  const sendMessageNotification = async (receiverId: string, senderUsername: string, chatId: string) => {
    const title = "Yeni Mesaj";
    const body = `${senderUsername} size bir mesaj gönderdi`;

    if (isMobile) {
      await sendPushNotification(receiverId, title, body, {
        type: "private_message",
        chatId,
        senderUsername,
      });
    }

    console.log("💬 MESSAGE NOTIFICATION SENT:", {
      to: receiverId,
      from: senderUsername,
      chatId,
      title,
      body,
    });
  };

  // Send tournament notification
  const sendTournamentNotification = async (receiverId: string, message: string, tournamentId?: string) => {
    const title = "Turnuva Bildirimi";

    if (isMobile) {
      await sendPushNotification(receiverId, title, message, {
        type: "tournament",
        tournamentId,
      });
    }

    console.log("🏆 TOURNAMENT NOTIFICATION SENT:", {
      to: receiverId,
      message,
      tournamentId,
      title,
    });
  };

  // Send push notification via backend
  const sendPushNotification = async (receiverId: string, title: string, body: string, data?: any) => {
    try {
      const { data: result, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          receiverId,
          title,
          body,
          data,
        },
      });

      if (error) {
        console.error("Error sending push notification:", error);
        await showLocalNotification(title, body, data);
        return false;
      }

      console.log("Push notification sent successfully:", result);
      return true;
    } catch (error) {
      console.error("Error sending push notification:", error);
      await showLocalNotification(title, body, data);
      return false;
    }
  };

  // Request notification permissions
  const requestPermissions = async () => {
    try {
      if (isMobile) {
        await initializePushNotifications();
        await initializeLocalNotifications();
      } else {
        // Web bildirimi izinleri
        if ("Notification" in window) {
          const permission = await Notification.requestPermission();
          setIsPermissionGranted(permission === "granted");

          if (permission === "granted") {
            toast({
              title: "Bildirimler Aktif",
              description: "Oyun bildirimleri artık aktif",
            });
          }
        }
      }
    } catch (error) {
      console.error("Error requesting permissions:", error);
    }
  };

  // Check current permission status
  const checkPermissionStatus = useCallback(async () => {
    try {
      if (isMobile) {
        const PushNotifications = await getPushNotifications();
        if (!PushNotifications) {
          console.log("PushNotifications.checkPermissions not available");
          return;
        }
        const permissionStatus = await PushNotifications.checkPermissions();
        setIsPermissionGranted(permissionStatus.receive === "granted");
      } else {
        if ("Notification" in window) {
          setIsPermissionGranted(Notification.permission === "granted");
        }
      }
    } catch (error) {
      console.error("Error checking permissions:", error);
    }
  }, [isMobile]);

  // Initialize on mount
  useEffect(() => {
    checkPermissionStatus();

    if (isPermissionGranted && user?.id) {
      if (isMobile) {
        initializePushNotifications();
        initializeLocalNotifications();
      }
    }
  }, [user?.id, isPermissionGranted, checkPermissionStatus, initializePushNotifications, initializeLocalNotifications]);

  return {
    isPermissionGranted,
    isMobile,
    pushToken,
    requestPermissions,
    checkPermissionStatus,
    showLocalNotification,
    sendGameInviteNotification,
    sendMessageNotification,
    sendTournamentNotification,
  };
};
