// utils/notifications.ts - Düzeltilmiş parametre isimleri
import { supabase } from '@/integrations/supabase/client';

// Mention bildirimi gönder
export const sendMentionNotification = async (
  userId: string,
  senderUsername: string, 
  message: string
) => {
  try {
    // Önce notifications tablosuna direkt ekle (RPC fonksiyonu yoksa)
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'mention',
        title: 'Sohbette Etiketlendiniz',
        message: `${senderUsername} sizi sohbette etiketledi`,
        data: {
          sender: senderUsername,
          message_preview: message.substring(0, 100)
        },
        is_read: false
      });

    if (error) {
      console.error('Mention notification error:', error);
      return false;
    }

    console.log('Mention bildirimi gönderildi:', senderUsername, '->', userId);
    return true;
  } catch (error) {
    console.error('Error sending mention notification:', error);
    return false;
  }
};

// Özel mesaj bildirimi gönder
export const sendMessageNotification = async (
  userId: string,
  senderUsername: string,
  chatId: string
) => {
  try {
    // Önce notifications tablosuna direkt ekle (RPC fonksiyonu yoksa)
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'private_message',
        title: 'Yeni Özel Mesaj',
        message: `${senderUsername} size özel mesaj gönderdi`,
        data: {
          sender: senderUsername,
          chat_id: chatId
        },
        is_read: false
      });

    if (error) {
      console.error('Private message notification error:', error);
      return false;
    }

    console.log('Özel mesaj bildirimi gönderildi:', senderUsername, '->', userId);
    return true;
  } catch (error) {
    console.error('Error sending private message notification:', error);
    return false;
  }
};

// Oyun daveti bildirimi
export const sendGameInviteNotification = async (
  receiverId: string, 
  senderUsername: string, 
  roomCode: string
) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: receiverId,
        type: 'game_invite',
        title: 'Oyun Daveti',
        message: `${senderUsername} sizi oyuna davet etti`,
        data: {
          sender: senderUsername,
          room_code: roomCode
        },
        is_read: false
      });

    if (error) {
      console.warn('Error sending game invite notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('Error in sendGameInviteNotification:', error);
    return false;
  }
};

// Bildirimleri okundu olarak işaretle
export const markNotificationsAsRead = async (notificationIds: string[]) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', notificationIds);

    if (error) {
      console.error('Error marking notifications as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in markNotificationsAsRead:', error);
    return false;
  }
};

// Kullanıcı bildirimlerini getir
export const getUserNotifications = async (userId: string, limit = 20) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    return [];
  }
};

// Browser notification göster (opsiyonel)
export const showBrowserNotification = (title: string, message: string, icon?: string) => {
  if (!('Notification' in window)) {
    console.log('Bu tarayıcı bildirimleri desteklemiyor');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: icon || '/favicon.ico',
      tag: 'kelimeci-chat'
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: icon || '/favicon.ico',
          tag: 'kelimeci-chat'
        });
      }
    });
  }
};