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
          console.log("🌐 Web bildirim izni:", permission);
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

      console.log("📱 Push bildirimleri başlatılıyor...");

      // Request permission to use push notifications
      const permissionStatus = await PushNotifications.requestPermissions();
      console.log("📱 İzin durumu:", permissionStatus.receive);

      if (permissionStatus.receive === "granted") {
        setIsPermissionGranted(true);

        // Önce listener'ları kur
        PushNotifications.addListener("registration", async (token) => {
          console.log("✅ Push registration success, token:", token.value.substring(0, 30) + "...");
          setPushToken(token.value);

          // Save token to database for the user
          if (user?.id) {
            await savePushToken(user.id, token.value);
          } else {
            // User yoksa localStorage'a kaydet, sonra kullanılır
            console.log("⚠️ User henüz yok, token localStorage'a kaydediliyor");
            localStorage.setItem("push_token_pending", JSON.stringify({ token: token.value }));
          }
        });

        // Some issue with the setup and push will not work
        PushNotifications.addListener("registrationError", (error: any) => {
          console.error("❌ Push registration error:", error.error);
        });

        // Show us the notification payload if the app is open on iOS
        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("📬 Push notification received:", notification);
          showLocalNotification(notification.title || "Kelimele", notification.body || "Yeni bildiriminiz var");
        });

        // Method called when tapping on a notification
        PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
          console.log("👆 Push notification action performed:", notification);
          handleNotificationAction(notification);
        });

        // Register with Apple / Google to receive push via APNS/FCM
        console.log("📱 Register çağrılıyor...");
        await PushNotifications.register();
        console.log("✅ Register başarılı");
      } else {
        setIsPermissionGranted(false);
        console.log("❌ Push notification permissions denied");
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

  // Remove push token from database (disable notifications)
  const removePushToken = async (userId: string) => {
    try {
      const { error } = await supabase.from("profiles").update({ push_token: null }).eq("id", userId);

      if (error) {
        console.error("Error removing push token from database:", error);
      } else {
        console.log("Push token removed from database - notifications disabled");
        setPushToken("");
      }

      // Also remove from localStorage
      const savedTokens = localStorage.getItem("push_tokens") || "{}";
      const tokens = JSON.parse(savedTokens);
      delete tokens[userId];
      localStorage.setItem("push_tokens", JSON.stringify(tokens));
    } catch (error) {
      console.error("Error removing push token:", error);
    }
  };

  // Disable notifications completely
  const disableNotifications = async () => {
    try {
      if (user?.id) {
        await removePushToken(user.id);
      }
      setIsPermissionGranted(false);
      console.log("Notifications disabled successfully");
    } catch (error) {
      console.error("Error disabling notifications:", error);
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

  // Request notification permissions (Butona basınca çalışan)
  const requestPermissions = async () => {
    try {
      console.log("🔔 requestPermissions çağrıldı (Manuel)");

      if (isMobile) {
        const PushNotifications = await getPushNotifications();
        if (PushNotifications) {
          // 1. Önce burada açıkça izin iste (Pencere burada açılacak)
          const permission = await PushNotifications.requestPermissions();

          if (permission.receive === "granted") {
            // 2. İzin verildiyse servisleri başlat
            await initializePushNotifications();
            await initializeLocalNotifications();
            setIsPermissionGranted(true);
          }
        }
      } else {
        // Web mantığı aynı kalabilir
        if ("Notification" in window) {
          const permission = await Notification.requestPermission();
          setIsPermissionGranted(permission === "granted");
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
        console.log("📱 İzin durumu kontrol:", permissionStatus.receive);
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

  // Bekleyen token'ı kaydet (user login olduktan sonra)
  const savePendingToken = useCallback(async () => {
    if (!user?.id) return;

    try {
      const pendingData = localStorage.getItem("push_token_pending");
      if (pendingData) {
        const { token } = JSON.parse(pendingData);
        if (token) {
          console.log("📱 Bekleyen token kaydediliyor...");
          await savePushToken(user.id, token);
          localStorage.removeItem("push_token_pending");
        }
      }
    } catch (error) {
      console.error("Bekleyen token kaydetme hatası:", error);
    }
  }, [user?.id]);

  // Initialize on mount
  useEffect(() => {
    checkPermissionStatus();
    savePendingToken();

    if (isPermissionGranted && user?.id) {
      if (isMobile) {
        initializePushNotifications();
        initializeLocalNotifications();
      }
    }
  }, [
    user?.id,
    isPermissionGranted,
    checkPermissionStatus,
    initializePushNotifications,
    initializeLocalNotifications,
    savePendingToken,
  ]);

  return {
    isPermissionGranted,
    isMobile,
    pushToken,
    requestPermissions,
    disableNotifications,
    checkPermissionStatus,
    showLocalNotification,
    sendGameInviteNotification,
    sendMessageNotification,
    sendTournamentNotification,
  };
};
