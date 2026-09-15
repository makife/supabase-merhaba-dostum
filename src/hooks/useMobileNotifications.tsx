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

// iOS cold-start retry intervals (ms) — progressive backoff
const IOS_RETRY_DELAYS = [2500, 5000, 10000];

// 🔥 Global singleton flags — tüm hook instance'ları arasında paylaşılır
// Böylece birden fazla hook instance'ı aynı anda register/listener eklemez
let _globalListenersRegistered = false;
let _globalRegisterCalled = false;
let _globalPermissionRequesting = false;

export const useMobileNotifications = () => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [pushToken, setPushToken] = useState<string>("");
  const { user } = useAuth();
  const { toast } = useToast();
  const latestPushTokenRef = useRef("");
  const retryTimeoutsRef = useRef<number[]>([]);
  const pushModuleRef = useRef<PushNotificationsType | null>(null);
  // 🔥 FIX: user.id'yi ref'te tut — listener closure'ı her zaman güncel değere erişsin
  const userIdRef = useRef<string | null>(null);

  const isMobile = Capacitor.isNativePlatform();
  const isIos = isMobile && Capacitor.getPlatform() === "ios";

  // 🔥 FIX: user.id değiştiğinde ref'i güncelle
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    latestPushTokenRef.current = pushToken;
  }, [pushToken]);

  const getPushModule = async (): Promise<PushNotificationsType | null> => {
    if (pushModuleRef.current) return pushModuleRef.current;
    try {
      if (!isMobile) return null;
      const module = await import("@capacitor/push-notifications");
      pushModuleRef.current = module.PushNotifications;
      return pushModuleRef.current;
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

  const clearAllRetries = useCallback(() => {
    retryTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    retryTimeoutsRef.current = [];
  }, []);

  // Schedule progressive iOS retries for FCM token
  const scheduleIosRetries = useCallback(
    async (PushNotifications: PushNotificationsType) => {
      if (!isIos) return;
      clearAllRetries();

      for (const delay of IOS_RETRY_DELAYS) {
        const id = window.setTimeout(async () => {
          try {
            // Token already obtained — skip
            if (latestPushTokenRef.current) return;

            // Check pending storage
            const pending = await nativeStorage.getJSON<{ token: string }>("push_token_pending");
            if (getValidFcmToken(pending?.token)) {
              console.log(`📱 [Push] iOS retry@${delay}ms: pending token zaten mevcut`);
              return;
            }

            console.log(`📱 [Push] iOS retry@${delay}ms: FCM token henüz gelmedi, register() tekrar çağrılıyor...`);
            await PushNotifications.register();
          } catch (error) {
            console.error(`iOS push register retry@${delay}ms hatası:`, error);
          }
        }, delay);

        retryTimeoutsRef.current.push(id);
      }
    },
    [clearAllRetries, isIos],
  );

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

  // Core registration logic — assumes permission is already granted
  // 🔥 FIX: user?.id'yi dependency'den kaldırdık — listener closure'da ref kullanıyoruz
  const registerAndListen = useCallback(async (PushNotifications: PushNotificationsType) => {
    // Listener'ları SADECE BİR KEZ ekle (GLOBAL flag)
    if (!_globalListenersRegistered) {
      _globalListenersRegistered = true;

      await PushNotifications.addListener("registration", async (token) => {
        console.log("📱 Registration event geldi, raw token:", token.value?.substring(0, 40) + "...");

        const safeToken = getValidFcmToken(token.value);

        if (!safeToken) {
          console.warn(
            isApnsTokenFormat(token.value)
              ? "⚠️ APNs token geldi (64-char hex), FCM token bekleniyor..."
              : "⚠️ Geçersiz push token geldi, length=" + (token.value?.length ?? 0)
          );
          return;
        }

        console.log("✅ FCM token alındı:", safeToken.substring(0, 30) + "...");
        clearAllRetries();
        latestPushTokenRef.current = safeToken;
        setPushToken(safeToken);

        // Token'ı nativeStorage'a yedekle (OAuth recovery için)
        await nativeStorage.setJSON("push_token_pending", { token: safeToken });

        // 🔥 FIX: closure'daki user?.id yerine REF kullan — her zaman güncel
        const currentUserId = userIdRef.current;
        if (currentUserId) {
          console.log("📱 [Push] Token alındı, hemen DB'ye kaydediliyor (userId:", currentUserId.substring(0, 8) + "...)");
          await savePushToken(currentUserId, safeToken);
        } else {
          console.log("⚠️ User henüz yok, token pending olarak saklanıyor");
        }
      });

      await PushNotifications.addListener("registrationError", (error) => {
        console.error("❌ Push registration error:", JSON.stringify(error));
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

      console.log("📱 Tüm listener'lar eklendi (global)");
    }

    // Register'ı SADECE BİR KEZ çağır (GLOBAL flag)
    if (!_globalRegisterCalled) {
      _globalRegisterCalled = true;
      console.log("📱 register() çağrılıyor...");
      await PushNotifications.register();
      await scheduleIosRetries(PushNotifications);
      console.log("✅ register() başarılı");
    }
  }, [clearAllRetries, savePushToken, scheduleIosRetries]);

  // Initialize push notifications
  // 🔥 FIX: "prompt" durumunda izin İSTEMEZ — sadece zaten granted ise register yapar
  // İzin isteme işi OnboardingPermissions veya SettingsPage'den yapılır
  const initializePushNotifications = useCallback(async () => {
    if (!isMobile) {
      // Web'de sadece mevcut izni kontrol et, isteme
      try {
        if ("Notification" in window) {
          setIsPermissionGranted(Notification.permission === "granted");
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

      console.log("📱 Push bildirimleri kontrol ediliyor...");
      const permissionStatus = await PushNotifications.checkPermissions();
      console.log("📱 İzin durumu:", permissionStatus.receive);

      if (permissionStatus.receive === "granted") {
        setIsPermissionGranted(true);
        await registerAndListen(PushNotifications);
      } else {
        // 🔥 "prompt" veya "denied" → izin İSTEME, sadece state güncelle
        setIsPermissionGranted(false);
        console.log("📱 Push izni henüz verilmemiş:", permissionStatus.receive, "— onboarding/ayarlar'dan istenecek");
      }
    } catch (error) {
      console.error("Push notification başlatma hatası:", error);
    }
  }, [isMobile, registerAndListen]);

  // iOS foreground resume: re-register to refresh token
  useEffect(() => {
    if (!isIos) return;

    let appModule: typeof import("@capacitor/app").App | null = null;
    let listenerId: { remove: () => Promise<void> } | null = null;

    const setup = async () => {
      try {
        const mod = await import("@capacitor/app");
        appModule = mod.App;

        listenerId = await appModule.addListener("appStateChange", async ({ isActive }) => {
          if (!isActive) return;
          // 🔥 FIX: ref kullan — closure'daki eski user?.id yerine
          if (!userIdRef.current) return;

          // App foreground'a döndü — FCM token'ı yenile
          const PushNotifications = await getPushModule();
          if (!PushNotifications) return;

          const permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive !== "granted") return;

          console.log("📱 [Push] iOS foreground resume: token yenileme kontrolü...");
          await PushNotifications.register();
        });
      } catch (e) {
        console.log("App plugin yüklenemedi:", e);
      }
    };

    setup();

    return () => {
      listenerId?.remove();
    };
  }, [isIos]); // 🔥 FIX: user?.id dependency kaldırıldı, ref kullanılıyor

  // Initialize local notifications
  // 🔧 FIX: Android'de requestPermissions() çağırmıyoruz — bu bildirim izni penceresini açıyor
  // İzin zaten OnboardingPermissions'ta push için isteniyor, local notifications da aynı izni kullanıyor
  const initializeLocalNotifications = useCallback(async () => {
    if (!isMobile) return;

    try {
      const LocalNotifications = await getLocalNotifications();
      if (!LocalNotifications) return;

      // 🔧 FIX: requestPermissions yerine checkPermissions kullan
      // Android 13+'da requestPermissions() native dialog açıyordu (KVKK'dan önce)
      const permissionStatus = await LocalNotifications.checkPermissions();

      if (permissionStatus.display === "granted") {
        LocalNotifications.addListener("localNotificationActionPerformed", (notification) => {
          console.log("Local notification action:", notification);
          handleNotificationAction(notification);
        });
      } else {
        console.log("📱 Local notification izni henüz verilmemiş:", permissionStatus.display);
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
        latestPushTokenRef.current = "";
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
        _globalListenersRegistered = false;
        _globalRegisterCalled = false;
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

  // 🔥 NEW: User login olduğunda ve token yoksa re-register yap
  useEffect(() => {
    if (!user?.id || !isMobile) return;
    if (latestPushTokenRef.current) return; // zaten token var

    const reRegister = async () => {
      try {
        const PushNotifications = await getPushModule();
        if (!PushNotifications) return;

        const permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive !== "granted") return;

        console.log("📱 [Push] User login sonrası token yok, re-register yapılıyor...");
        // Listener'lar zaten ekli, sadece register çağır
        await PushNotifications.register();

        // iOS için ek retry
        if (isIos) {
          await scheduleIosRetries(PushNotifications);
        }
      } catch (error) {
        console.error("Re-register hatası:", error);
      }
    };

    // Biraz bekle ki auth tam yerleşsin
    const timer = window.setTimeout(reRegister, 1500);
    return () => window.clearTimeout(timer);
  }, [user?.id, isMobile, isIos, scheduleIosRetries]);

  // Initialize on mount
  useEffect(() => {
    initializePushNotifications();
    initializeLocalNotifications();
  }, [initializePushNotifications, initializeLocalNotifications]);

  useEffect(() => {
    return () => {
      clearAllRetries();
    };
  }, [clearAllRetries]);

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
