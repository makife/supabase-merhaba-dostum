// src/utils/notifications.ts
import { supabase } from '@/integrations/supabase/client';

// Özel mesaj bildirimi
export const sendMessageNotification = async (receiverId: string, senderUsername: string, chatId?: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: receiverId,
        type: 'message',
        message: `${senderUsername} sana özel mesaj gönderdi`,
        is_read: false,
        related_id: chatId
      });

    if (error) {
      console.error('Error sending message notification:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in sendMessageNotification:', error);
    return false;
  }
};

// Mention bildirimi
export const sendMentionNotification = async (receiverId: string, senderUsername: string, message: string, messageId?: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: receiverId,
        type: 'mention',
        message: `${senderUsername} seni bir mesajda etiketledi: "${message.substring(0, 50)}..."`,
        is_read: false,
        related_id: messageId
      });

    if (error) {
      console.error('Error sending mention notification:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in sendMentionNotification:', error);
    return false;
  }
};

// Oyun daveti bildirimi
export const sendGameInviteNotification = async (receiverId: string, senderUsername: string, roomCode: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: receiverId,
        type: 'invite',
        message: `${senderUsername} sana oyun daveti gönderdi`,
        is_read: false,
        related_id: roomCode
      });

    if (error) {
      console.error('Error sending game invite notification:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in sendGameInviteNotification:', error);
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

// Kullanıcının tüm bildirimlerini getir
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
    return data;
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    return [];
  }
};
