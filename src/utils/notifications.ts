// utils/notifications.ts - Raw SQL yaklaşımı (TypeScript cache bypass)
import { supabase } from '@/integrations/supabase/client';

// Raw SQL kullanarak notification ekle (TypeScript cache bypass)
export const sendMentionNotification = async (
  userId: string,
  senderUsername: string, 
  message: string
) => {
  try {
    const { data, error } = await supabase
      .rpc('exec_sql', {
        query: `
          INSERT INTO notifications (user_id, type, message, related_id, is_read)
          VALUES ($1, $2, $3, $4, $5)
        `,
        params: [
          userId,
          'mention',
          `${senderUsername} sizi sohbette etiketledi: "${message.substring(0, 50)}..."`,
          null,
          false
        ]
      });

    if (error) {
      console.error('Mention notification error:', error);
      return false;
    }

    console.log('Mention bildirimi gönderildi:', senderUsername, '->', userId);
    return true;
  } catch (error) {
    // Raw SQL çalışmazsa basit insert dene
    try {
      const result = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          type: 'mention',
          message: `${senderUsername} sizi sohbette etiketledi`,
          is_read: false
        }]);
      
      return !result.error;
    } catch (fallbackError) {
      console.error('Error sending mention notification:', error);
      return false;
    }
  }
};

// Özel mesaj bildirimi - Raw SQL
export const sendMessageNotification = async (
  userId: string,
  senderUsername: string,
  chatId: string
) => {
  try {
    const { data, error } = await supabase
      .rpc('exec_sql', {
        query: `
          INSERT INTO notifications (user_id, type, message, related_id, is_read)
          VALUES ($1, $2, $3, $4, $5)
        `,
        params: [
          userId,
          'private_message',
          `${senderUsername} size özel mesaj gönderdi`,
          chatId,
          false
        ]
      });

    if (error) {
      console.error('Private message notification error:', error);
      return false;
    }

    console.log('Özel mesaj bildirimi gönderildi:', senderUsername, '->', userId);
    return true;
  } catch (error) {
    // Raw SQL çalışmazsa basit insert dene
    try {
      const result = await supabase
        .from('notifications')
        .insert([{
          user_id: userId,
          type: 'private_message', 
          message: `${senderUsername} size özel mesaj gönderdi`,
          is_read: false
        }]);
      
      return !result.error;
    } catch (fallbackError) {
      console.error('Error sending private message notification:', error);
      return false;
    }
  }
};

// Geçici çözüm - Console log ile test
export const sendMentionNotificationTemp = async (
  userId: string,
  senderUsername: string, 
  message: string
) => {
  console.log('MENTION NOTIFICATION:', {
    userId,
    senderUsername,
    message: message.substring(0, 50),
    timestamp: new Date().toISOString()
  });
  return true;
};

export const sendMessageNotificationTemp = async (
  userId: string,
  senderUsername: string,
  chatId: string
) => {
  console.log('PRIVATE MESSAGE NOTIFICATION:', {
    userId,
    senderUsername,
    chatId,
    timestamp: new Date().toISOString()
  });
  return true;
};

// Basit okundu işaretleme
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