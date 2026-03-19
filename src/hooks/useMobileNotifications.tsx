import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { suppressActivityForPush } from "@/hooks/useActivityTracker";
import nativeStorage from "@/utils/nativeStorage";
import { getValidFcmToken, isApnsTokenFormat } from "@/utils/pushToken";

type LocalNotificationsType = typeof import("@capacitor/local-notifications").LocalNotifications;
type PushNotificationsType = typeof import("@capacitor/push-notifications").PushNotifications;

export const useMobileNotifications = () => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [pushToken, setPushToken] = useState<string>("");
  const { user } = useAuth();
  const { toast } = useToast();
  const listenersRegistered = useRef(false);
  const registerCalled = useRef(false);

  const isMobile = Capacitor.isNativePlatform();

  // Direct import - no SafePluginWrapper overhead for critical path
  const getPushModule = async (): Promise<PushNotificationsType | null> => {
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

  // Save push token to database - FCM only
  const savePushToken = useCallback(async (userId: string, token: string) => {
    const safeToken = getValidFcmToken(token);

    if (!safeToken) {
      console.warn(
        isApnsTokenFormat(token)
          ? "⚠️ APNs token geldi, DB'ye yazılmadı (FCM bekleniyor)"
          : "⚠️ Geçersiz push token, DB'ye yazılmadı"
      );
      return false;
    }

    try {
      const { error } = await supabase.from("profiles").update({ push_token: safeToken }).eq("id", userId);

      if (error) {
        console.error("Push token DB kayıt hatası:", error);
        await nativeStorage.setJSON("push_token_pending", { token: safeToken });
        return false;
      }

      console.log("✅ Push token DB'ye kaydedildi:", safeToken.substring(0, 30) + "...");
      await nativeStorage.removeItem("push_token_pending");
      try { localStorage.removeItem("push_token_pending"); } catch {}
      return true;
    } catch (error) {
      console.error("Push token kaydetme hatası:", error);
      await nativeStorage.setJSON("push_token_pending", { token: safeToken });
      return false;
    }
  }, []);

  // Initialize push notifications - TEK NOKTADAN listener + register yönetimi
  const initializePushNotifications = useCallback(async () => {
    if (!isMobile) {
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
      const PushNotifications = await getPushModule();
      if (!PushNotifications) {
        console.log("PushNotifications plugin not available");
        return;
      }

      console.log("📱 Push bildirimleri başlatılıyor...");
      const permissionStatus = await PushNotifications.checkPermissions();
      console.log("📱 İzin durumu:", permissionStatus.receive);

      if (permissionStatus.receive === "granted") {
        setIsPermissionGranted(true);

        // Listener'ları SADECE BİR KEZ ekle (çift listener race condition önlenir)
        if (!listenersRegistered.current) {
          listenersRegistered.current = true;

          await PushNotifications.addListener("registration", async (token) => {
            console.log("📱 Registration event geldi, raw token:", token.value?.substring(0, 40) + "...");
            
            const safeToken = getValidFcmToken(token.value);

            if (!safeToken) {
              console.warn(
                isApnsTokenFormat(token.value)
                  ? "⚠️ APNs token geldi (64-char hex), FCM token bekleniyor..."
                  : "⚠️ Geçersiz push token geldi"
              );
              // APNs token geldi — FCM henüz hazır değil, pending olarak kaydet
              // Firebase SDK birkaç ms sonra FCM token'ını verecek
              return;
            }

            console.log("✅ FCM token alındı:", safeToken.substring(0, 30) + "...");
            setPushToken(safeToken);

            // Token'ı nativeStorage'a da yedekle (OAuth recovery için)
            await nativeStorage.setJSON("push_token_pending", { token: safeToken });

            // User hazırsa hemen kaydet
            if (user?.id) {
              await savePushToken(user.id, safeToken);
            } else {
              console.log("⚠️ User henüz yok, token pending olarak saklanıyor");
            }
          });

          await PushNotifications.addListener("registrationError", (error) => {
            console.error("❌ Push registration error:", error?.error);
          });

          await PushNotifications.addListener("pushNotificationReceived", (notification) => {
            console.log("📬 Push alındı:", notification.title);
            suppressActivityForPush(15000);
            showLocalNotification(notification.title || "Kelimele", notification.body || "Yeni bildiriminiz var");
          });

          await PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
            console.log("👆 Push action:", notification);
            handleNotificationAction(notification);
          });

          console.log("📱 Tüm listener'lar eklendi");
        }

        // Register'ı SADECE BİR KEZ çağır
        if (!registerCalled.current) {
          registerCalled.current = true;
          console.log("📱 register() çağrılıyor...");
          await PushNotifications.register();
          console.log("✅ register() başarılı");
        }
      } else if (permissionStatus.receive === "prompt") {
        // İzin henüz istenmemişse iste
        const result = await PushNotifications.requestPermissions();
        if (result.receive === "granted") {
          setIsPermissionGranted(true);
          // Recursive call to set up listeners + register
          listenersRegistered.current = false;
          registerCalled.current = false;
          await initializePushNotifications();
        } else {
          setIsPermissionGranted(false);
          console.log("❌ Push notification izni reddedildi");
        }
      } else {
        setIsPermissionGranted(false);
        console.log("❌ Push notification izni:", permissionStatus.receive);
      }
    } catch (error) {
      console.error("Push notification başlatma hatası:", error);
    }
  }, [isMobile, user?.id, savePushToken]);

  // Initialize local notifications
  const initializeLocalNotifications = useCallback(async () => {
    if (!isMobile) return;

    try {
      const LocalNotifications = await getLocalNotifications();
      if (!LocalNotifications) return;

      const permissionStatus = await LocalNotifications.requestPermissions();

      if (permissionStatus.display === "granted") {
        LocalNotifications.addListener("localNotificationActionPerformed", (notification) => {
          console.log("Local notification action:", notification);
          handleNotificationAction(notification);
        });
      }
    } catch (error) {
      console.error("Error initializing local notifications:", error);
    }
  }, [isMobile]);

  // Remove push token from database
  const removePushToken = async (userId: string) => {
    try {
      const { error } = await supabase.from("profiles").update({ push_token: null }).eq("id", userId);
      if (!error) {
        console.log("Push token DB'den kaldırıldı");
        setPushToken("");
      }
      await nativeStorage.removeItem("push_token_pending");
    } catch (error) {
      console.error("Push token kaldırma hatası:", error);
    }
  };

  // Disable notifications
  const disableNotifications = async () => {
    try {
      if (user?.id) {
        await removePushToken(user.id);
      }
      setIsPermissionGranted(false);
    } catch (error) {
      console.error("Error disabling notifications:", error);
    }
  };

  // Show local notification
  const showLocalNotification = async (title: string, body: string, data?: any) => {
    try {
      if (isMobile) {
        const LocalNotifications = await getLocalNotifications();
        if (!LocalNotifications) return;
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
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body, icon: "/favicon.ico" });
          }
        } catch {}
      }
    } catch (error) {
      console.error("Error showing local notification:", error);
    }
  };

  // Handle notification tap
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

  // Send push notification via edge function
  const sendPushNotification = async (
    receiverId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    skipIfOnline: boolean = true
  ) => {
    try {
      const { error } = await supabase.functions.invoke("send-push-notification", {
        body: { receiverId, title, body, data, skipIfOnline },
      });
      if (error) {
        console.error("Push notification gönderim hatası:", error);
        return false;
      }
      return true;
    } catch (error) {
      console.error("Push notification gönderim hatası:", error);
      return false;
    }
  };

  // Send game invite notification
  const sendGameInviteNotification = async (receiverId: string, senderUsername: string, roomCode: string) => {
    return sendPushNotification(receiverId, "Oyun Daveti", `${senderUsername} sizi oyuna davet ediyor!`, {
      type: "game_invite",
      roomCode,
      senderUsername,
    });
  };

  // Send message notification
  const sendMessageNotification = async (receiverId: string, senderUsername: string, chatId: string) => {
    return sendPushNotification(receiverId, "💬 Yeni Mesaj", `${senderUsername} sana mesaj gönderdi`, {
      type: "message",
      chatId,
    });
  };

  // Send mention notification
  const sendMentionNotification = async (receiverId: string, senderUsername: string, message: string, messageId?: string) => {
    return sendPushNotification(receiverId, "📢 Senden Bahsedildi", `${senderUsername}: ${message.substring(0, 50)}...`, {
      type: "mention",
      ...(messageId ? { messageId } : {}),
    });
  };

  // Request permissions (for SettingsPage)
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!isMobile) return false;
    try {
      const PushNotifications = await getPushModule();
      if (!PushNotifications) return false;
      const result = await PushNotifications.requestPermissions();
      const granted = result.receive === "granted";
      setIsPermissionGranted(granted);
      if (granted) {
        // Re-init to set up listeners + register
        listenersRegistered.current = false;
        registerCalled.current = false;
        await initializePushNotifications();
      }
      return granted;
    } catch {
      return false;
    }
  }, [isMobile, initializePushNotifications]);

  // Check permission status (for SettingsPage foreground sync)
  const checkPermissionStatus = useCallback(async () => {
    if (!isMobile) return;
    try {
      const PushNotifications = await getPushModule();
      if (!PushNotifications) return;
      const status = await PushNotifications.checkPermissions();
      setIsPermissionGranted(status.receive === "granted");
    } catch {}
  }, [isMobile]);

  // 🔥 User login sonrası pending token'ı DB'ye yaz
  useEffect(() => {
    if (!user?.id || !isMobile) return;

    const recoverPendingToken = async () => {
      try {
        if (pushToken) {
          const safe = getValidFcmToken(pushToken);
          if (safe) {
            await savePushToken(user.id, safe);
            return;
          }
        }

        const pending = await nativeStorage.getJSON<{ token: string }>("push_token_pending");
        if (pending?.token) {
          const safe = getValidFcmToken(pending.token);
          if (safe) {
            console.log("🔄 Pending token kurtarılıyor...");
            await savePushToken(user.id, safe);
            return;
          }
        }

        try {
          const stored = localStorage.getItem("push_token_pending");
          if (stored) {
            const parsed = JSON.parse(stored);
            const safe = getValidFcmToken(parsed?.token);
            if (safe) {
              await savePushToken(user.id, safe);
              return;
            }
          }
        } catch {}
      } catch (error) {
        console.error("Pending token kurtarma hatası:", error);
      }
    };

    recoverPendingToken();
  }, [user?.id, isMobile, pushToken, savePushToken]);

  // Initialize on mount
  useEffect(() => {
    initializePushNotifications();
    initializeLocalNotifications();
  }, [initializePushNotifications, initializeLocalNotifications]);

  return {
    isPermissionGranted,
    isMobile,
    pushToken,
    initializePushNotifications,
    requestPermissions,
    checkPermissionStatus,
    disableNotifications,
    showLocalNotification,
    sendPushNotification,
    sendGameInviteNotification,
    sendMessageNotification,
    sendMentionNotification,
    savePushToken,
  };
};
