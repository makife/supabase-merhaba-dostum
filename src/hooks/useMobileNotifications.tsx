import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SafePushNotifications } from "@/utils/safePluginWrapper";
import { suppressActivityForPush } from "@/hooks/useActivityTracker";
import nativeStorage from "@/utils/nativeStorage";

// Dinamik import için tipler
type LocalNotificationsType = typeof import("@capacitor/local-notifications").LocalNotifications;

export const useMobileNotifications = () => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [pushToken, setPushToken] = useState<string>("");
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if we're on a mobile platform
  const isMobile = Capacitor.isNativePlatform();

  // getPushNotifications KALDIRILDI - SafePushNotifications kullanılıyor

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

  // Initialize push notifications - SafePushNotifications kullanılıyor
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
      console.log("📱 Push bildirimleri başlatılıyor (SafePushNotifications)...");

      // SafePushNotifications kullanarak izin kontrolü
      const permissionStatus = await SafePushNotifications.checkPermissions();
      if (!permissionStatus) {
        console.log("PushNotifications plugin not available");
        return;
      }
      console.log("📱 İzin durumu:", permissionStatus.receive);

      if (permissionStatus.receive === "granted") {
        setIsPermissionGranted(true);

        // 🔥 KRİTİK: SafePushNotifications.addListener kullan - .then() YOK!
        SafePushNotifications.addListener("registration", async (token: any) => {
          console.log("✅ Push registration success, token:", token.value?.substring(0, 30) + "...");
          setPushToken(token.value);

          // Save token to database for the user
          if (user?.id) {
            await savePushToken(user.id, token.value);
          } else {
            console.log("⚠️ User henüz yok, token nativeStorage'a kaydediliyor");
            await nativeStorage.setJSON("push_token_pending", { token: token.value });
          }
        });

        SafePushNotifications.addListener("registrationError", (error: any) => {
          console.error("❌ Push registration error:", error?.error);
        });

        SafePushNotifications.addListener("pushNotificationReceived", (notification: any) => {
          console.log("📬 Push notification received:", notification);
          // Push alındığında activity tracker'ı 15sn bastır (yanlış "online" bildirimi önleme)
          suppressActivityForPush(15000);
          showLocalNotification(notification.title || "Kelimele", notification.body || "Yeni bildiriminiz var");
        });

        SafePushNotifications.addListener("pushNotificationActionPerformed", (notification: any) => {
          console.log("👆 Push notification action performed:", notification);
          handleNotificationAction(notification);
        });

        // Register - SafePushNotifications ile
        console.log("📱 Register çağrılıyor...");
        await SafePushNotifications.register();
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
        const savedTokens = await nativeStorage.getJSON<Record<string, any>>("push_tokens") || {};
        savedTokens[userId] = {
          token,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString(),
        };
        await nativeStorage.setJSON("push_tokens", savedTokens);
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

      // Also remove from nativeStorage
      const savedTokens = await nativeStorage.getJSON<Record<string, any>>("push_tokens") || {};
      delete savedTokens[userId];
      await nativeStorage.setJSON("push_tokens", savedTokens);
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

    console.log("🎮 GAME INVITE NOTIFICATION - Sending push to:", receiverId);
    
    // Her zaman sunucu taraflı bildirim gönder
    const success = await sendPushNotification(receiverId, title, body, {
      type: "game_invite",
      roomCode,
      senderUsername,
    });

    console.log("🎮 GAME INVITE NOTIFICATION SENT:", {
      to: receiverId,
      from: senderUsername,
      roomCode,
      title,
      body,
      success,
    });
    
    return success;
  };

  // Send private message notification
  const sendMessageNotification = async (receiverId: string, senderUsername: string, chatId: string) => {
    const title = "Yeni Mesaj";
    const body = `${senderUsername} size bir mesaj gönderdi`;

    console.log("💬 MESSAGE NOTIFICATION - Sending push to:", receiverId);
    
    // Her zaman sunucu taraflı bildirim gönder (sunucu token kontrolü yapacak)
    const success = await sendPushNotification(receiverId, title, body, {
      type: "private_message",
      chatId,
      senderUsername,
    });

    console.log("💬 MESSAGE NOTIFICATION SENT:", {
      to: receiverId,
      from: senderUsername,
      chatId,
      title,
      body,
      success,
    });
    
    return success;
  };

  // Send tournament notification
  const sendTournamentNotification = async (receiverId: string, message: string, tournamentId?: string) => {
    const title = "Turnuva Bildirimi";

    console.log("🏆 TOURNAMENT NOTIFICATION - Sending push to:", receiverId);
    
    // Her zaman sunucu taraflı bildirim gönder
    const success = await sendPushNotification(receiverId, title, message, {
      type: "tournament",
      tournamentId,
    });

    console.log("🏆 TOURNAMENT NOTIFICATION SENT:", {
      to: receiverId,
      message,
      tournamentId,
      title,
      success,
    });
    
    return success;
  };
  
  // Mention Bildirimi - SADECE Push gönder (DB kaydı GlobalChat.tsx'te yapılıyor)
  const sendMentionNotification = async (receiverId: string, senderUsername: string, message: string, messageId: string) => {
    const title = "Biri senden bahsetti!";
    // Mesaj çok uzunsa keselim
    const shortMessage = message.length > 50 ? message.substring(0, 47) + "..." : message;
    const body = `${senderUsername}: "${shortMessage}"`;

    console.log("📢 MENTION NOTIFICATION - Sending push only to:", receiverId);
    
    try {
      // Push bildirim gönder (sunucu token kontrolü yapacak)
      // DB kaydı GlobalChat.tsx'te yapılıyor - duplicate önlemek için burada yapmıyoruz
      const success = await sendPushNotification(receiverId, title, body, {
        type: "mention",
        messageId,
        roomId: "global"
      });

      console.log("📢 MENTION PUSH SENT:", {
        to: receiverId,
        from: senderUsername,
        message: shortMessage,
        pushSent: success,
      });
      
      return success;
    } catch (error) {
      console.error("❌ Mention notification error:", error);
      return false;
    }
  };

  // Send push notification via backend
  // skipIfOnline: true ise, kullanıcı son 30 saniyede aktifse push gönderilmez
  const sendPushNotification = async (receiverId: string, title: string, body: string, data?: any, skipIfOnline: boolean = true) => {
    try {
      const { data: result, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          receiverId,
          title,
          body,
          data,
          skipIfOnline, // Kullanıcı online ise push gönderme
        },
      });

      if (error) {
        console.error("Error sending push notification:", error);
        // Online olmayan kullanıcıya local notification göstermeye gerek yok
        return false;
      }

      console.log("Push notification result:", result);
      return true;
    } catch (error) {
      console.error("Error sending push notification:", error);
      return false;
    }
  };

  // Request notification permissions (Butona basınca çalışan)
  // Returns: true if permission granted, false otherwise
  const requestPermissions = async (): Promise<boolean> => {
    try {
      console.log("🔔 requestPermissions çağrıldı (Manuel)");
      console.log("📱 Platform:", isMobile ? "Native" : "Web");

      if (isMobile) {
        // SafePushNotifications ile izin kontrolü
        const currentStatus = await SafePushNotifications.checkPermissions();
        console.log("📱 Mevcut izin durumu:", currentStatus?.receive);
        
        if (!currentStatus) {
          console.error("❌ PushNotifications plugin yüklenemedi!");
          return false;
        }
        
        // İzin iste
        console.log("📱 İzin isteniyor...");
        const permission = await SafePushNotifications.requestPermissions();
        console.log("📱 İzin sonucu:", permission?.receive);

        if (permission?.receive === "granted") {
          console.log("✅ İzin verildi, servisler başlatılıyor...");
          await initializePushNotifications();
          await initializeLocalNotifications();
          setIsPermissionGranted(true);
          return true;
        } else {
          console.log("❌ İzin reddedildi veya prompt kapatıldı");
          setIsPermissionGranted(false);
          return false;
        }
      } else {
        // Web mantığı
        if ("Notification" in window) {
          console.log("🌐 Web bildirim izni isteniyor...");
          const permission = await Notification.requestPermission();
          console.log("🌐 Web izin sonucu:", permission);
          const granted = permission === "granted";
          setIsPermissionGranted(granted);
          return granted;
        }
        return false;
      }
    } catch (error) {
      console.error("❌ İzin isteme hatası:", error);
      return false;
    }
  };

  // Check current permission status - SafePushNotifications ile
  const checkPermissionStatus = useCallback(async () => {
    try {
      if (isMobile) {
        const permissionStatus = await SafePushNotifications.checkPermissions();
        if (!permissionStatus) {
          console.log("PushNotifications.checkPermissions not available");
          return;
        }
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
  // OAuth (Google/Apple) ile giriş yapan kullanıcılar için de token'ı kaydet
  const savePendingToken = useCallback(async () => {
    if (!user?.id) return;

    try {
      // 1. localStorage'daki bekleyen token'ı kontrol et
      const pendingData = localStorage.getItem("push_token_pending");
      if (pendingData) {
        const { token } = JSON.parse(pendingData);
        if (token) {
          console.log("📱 Bekleyen token kaydediliyor...");
          await savePushToken(user.id, token);
          localStorage.removeItem("push_token_pending");
          return; // Token kaydedildi, devam etmeye gerek yok
        }
      }

      // 2. State'teki mevcut token'ı kontrol et (OAuth kullanıcıları için kritik)
      // Registration eventi önceki oturumda tetiklenmiş olabilir,
      // yeni user ile tekrar tetiklenmeyebilir
      if (pushToken) {
        console.log("📱 Mevcut token yeni kullanıcıya kaydediliyor (OAuth fix)...");
        await savePushToken(user.id, pushToken);
        return;
      }

      // 3. localStorage'daki eski token'ları kontrol et
      const savedTokens = localStorage.getItem("push_tokens") || "{}";
      const tokens = JSON.parse(savedTokens);
      // Herhangi bir kaydedilmiş token varsa yeni kullanıcıya ata
      const anyToken = Object.values(tokens).find((t: any) => t?.token);
      if (anyToken && (anyToken as any).token) {
        console.log("📱 localStorage'daki token yeni kullanıcıya kaydediliyor...");
        await savePushToken(user.id, (anyToken as any).token);
      }
    } catch (error) {
      console.error("Bekleyen token kaydetme hatası:", error);
    }
  }, [user?.id, pushToken]);

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
	sendMentionNotification,
  };
};
