import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  PushNotifications, 
  PushNotificationSchema,
  ActionPerformed,
  Token
} from '@capacitor/push-notifications';
import { 
  LocalNotifications,
  LocalNotificationSchema
} from '@capacitor/local-notifications';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useMobileNotifications = () => {
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [pushToken, setPushToken] = useState<string>('');
  const { user } = useAuth();
  const { toast } = useToast();

  // Check if we're on a mobile platform
  const isMobile = Capacitor.isNativePlatform();

  // Initialize push notifications
  const initializePushNotifications = useCallback(async () => {
    if (!isMobile) {
      // Web bildirim izinlerini kontrol et
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setIsPermissionGranted(permission === 'granted');
      }
      return;
    }

    try {
      // Request permission to use push notifications
      const permissionStatus = await PushNotifications.requestPermissions();
      
      if (permissionStatus.receive === 'granted') {
        setIsPermissionGranted(true);
        
        // Register with Apple / Google to receive push via APNS/FCM
        await PushNotifications.register();
        
        // Listen for registration events
        PushNotifications.addListener('registration', async (token: Token) => {
          console.log('Push registration success, token: ' + token.value);
          setPushToken(token.value);
          
          // Save token to database for the user
          if (user?.id) {
            await savePushToken(user.id, token.value);
          }
        });

        // Some issue with the setup and push will not work
        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Push registration error: ', error.error);
          toast({
            title: 'Bildirim Hatası',
            description: 'Push bildirimler ayarlanamadı',
            variant: 'destructive'
          });
        });

        // Show us the notification payload if the app is open on iOS
        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('Push notification received: ', notification);
          
          // Show local notification if app is in foreground
          showLocalNotification(
            notification.title || 'Kelimeci',
            notification.body || 'Yeni bildiriminiz var'
          );
        });

        // Method called when tapping on a notification
        PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
          console.log('Push notification action performed: ', notification);
          
          // Handle notification tap actions here
          handleNotificationAction(notification);
        });
        
      } else {
        setIsPermissionGranted(false);
        console.log('Push notification permissions denied');
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }, [isMobile, user?.id, toast]);

  // Initialize local notifications
  const initializeLocalNotifications = useCallback(async () => {
    if (!isMobile) return;

    try {
      const permissionStatus = await LocalNotifications.requestPermissions();
      
      if (permissionStatus.display === 'granted') {
        // Listen for local notification actions
        LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
          console.log('Local notification action performed: ', notification);
          handleNotificationAction(notification);
        });
      }
    } catch (error) {
      console.error('Error initializing local notifications:', error);
    }
  }, [isMobile]);

  // Save push token to database
  const savePushToken = async (userId: string, token: string) => {
    try {
      // For now, we'll store tokens in localStorage until the types are updated
      const savedTokens = localStorage.getItem('push_tokens') || '{}';
      const tokens = JSON.parse(savedTokens);
      tokens[userId] = {
        token,
        platform: Capacitor.getPlatform(),
        updated_at: new Date().toISOString()
      };
      localStorage.setItem('push_tokens', JSON.stringify(tokens));
      console.log('Push token saved locally:', token);
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  };

  // Show local notification
  const showLocalNotification = async (title: string, body: string, data?: any) => {
    try {
      if (isMobile) {
        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: Date.now(),
              schedule: { at: new Date(Date.now() + 1000) }, // Show after 1 second
              sound: undefined,
              attachments: undefined,
              actionTypeId: '',
              extra: data
            }
          ]
        });
      } else {
        // Web bildirimi göster
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico'
          });
        }
      }
    } catch (error) {
      console.error('Error showing local notification:', error);
    }
  };

  // Handle notification action (tap, button press, etc.)
  const handleNotificationAction = (notification: any) => {
    try {
      const notificationData = notification.notification?.extra || notification.actionId;
      
      if (notificationData?.type === 'game_invite') {
        // Navigate to game with room code
        window.location.href = `/game?room=${notificationData.roomCode}`;
      } else if (notificationData?.type === 'private_message') {
        // Navigate to private chat
        window.location.href = `/chat?chat=${notificationData.chatId}`;
      } else if (notificationData?.type === 'tournament') {
        // Navigate to tournament
        window.location.href = `/tournament`;
      }
    } catch (error) {
      console.error('Error handling notification action:', error);
    }
  };

  // Send game invite notification
  const sendGameInviteNotification = async (
    receiverId: string,
    senderUsername: string,
    roomCode: string
  ) => {
    const title = 'Oyun Daveti';
    const body = `${senderUsername} sizi oyuna davet ediyor!`;
    
    if (isMobile) {
      // Send push notification via your backend
      await sendPushNotification(receiverId, title, body, {
        type: 'game_invite',
        roomCode,
        senderUsername
      });
    }
    
    console.log('🎮 GAME INVITE NOTIFICATION SENT:', {
      to: receiverId,
      from: senderUsername,
      roomCode,
      title,
      body
    });
  };

  // Send private message notification
  const sendMessageNotification = async (
    receiverId: string,
    senderUsername: string,
    chatId: string
  ) => {
    const title = 'Yeni Mesaj';
    const body = `${senderUsername} size bir mesaj gönderdi`;
    
    if (isMobile) {
      await sendPushNotification(receiverId, title, body, {
        type: 'private_message',
        chatId,
        senderUsername
      });
    }
    
    console.log('💬 MESSAGE NOTIFICATION SENT:', {
      to: receiverId,
      from: senderUsername,
      chatId,
      title,
      body
    });
  };

  // Send tournament notification
  const sendTournamentNotification = async (
    receiverId: string,
    message: string,
    tournamentId?: string
  ) => {
    const title = 'Turnuva Bildirimi';
    
    if (isMobile) {
      await sendPushNotification(receiverId, title, message, {
        type: 'tournament',
        tournamentId
      });
    }
    
    console.log('🏆 TOURNAMENT NOTIFICATION SENT:', {
      to: receiverId,
      message,
      tournamentId,
      title
    });
  };

  // Send push notification via backend
  const sendPushNotification = async (
    receiverId: string,
    title: string,
    body: string,
    data?: any
  ) => {
    try {
      // In a real app, you would call your backend API to send push notifications
      // For now, we'll use local notifications for testing
      await showLocalNotification(title, body, data);
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  };

  // Request notification permissions
  const requestPermissions = async () => {
    if (isMobile) {
      await initializePushNotifications();
      await initializeLocalNotifications();
    } else {
      // Web bildirimi izinleri
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setIsPermissionGranted(permission === 'granted');
        
        if (permission === 'granted') {
          toast({
            title: 'Bildirimler Aktif',
            description: 'Oyun bildirimleri artık aktif'
          });
        }
      }
    }
  };

  // Check current permission status
  const checkPermissionStatus = useCallback(async () => {
    if (isMobile) {
      try {
        const permissionStatus = await PushNotifications.checkPermissions();
        setIsPermissionGranted(permissionStatus.receive === 'granted');
      } catch (error) {
        console.error('Error checking permissions:', error);
      }
    } else {
      if ('Notification' in window) {
        setIsPermissionGranted(Notification.permission === 'granted');
      }
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
    sendTournamentNotification
  };
};