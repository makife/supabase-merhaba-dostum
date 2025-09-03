// utils/notifications.ts - Mevcut tablo yapısına uygun versiyon
import { supabase } from '@/integrations/supabase/client';

// Mention bildirimi gönder
export const sendMentionNotification = async (
  userId: string,
  senderUsername: string, 
  message: string
) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'mention',
        message: `${senderUsername} sizi sohbette etiketledi: "${message.substring(0, 50)}..."`,
        related_id: null, // Chat message id olabilir
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
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'private_message',
        message: `${senderUsername} size özel mesaj gönderdi`,
        related_id: chatId, // Chat ID'yi related_id'de saklıyoruz
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
        message: `${senderUsername} sizi oyuna davet etti (Kod: ${roomCode})`,
        related_id: roomCode, // Room code'u related_id'de saklıyoruz
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

// Belirli türdeki bildirimleri okundu yap
export const markNotificationsByType = async (userId: string, type: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('type', type)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking notifications by type:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in markNotificationsByType:', error);
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

// Okunmamış bildirim sayısını getir
export const getUnreadNotificationCount = async (userId: string, type?: string) => {
  try {
    let query = supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (type) {
      query = query.eq('type', type);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error getting unread notification count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getUnreadNotificationCount:', error);
    return 0;
  }
};