// src/utils/notifications.ts
import { supabase } from '@/integrations/supabase/client';

// Özel mesaj bildirimi - DÜZELTİLDİ
export const sendMentionNotification = async (
  userId: string,
  senderUsername: string, 
  message: string
) => {
  try {
    const { data, error } = await supabase
      .rpc('send_mention_notification', {
        p_user_id: userId,
        p_sender_username: senderUsername,
        p_message: message
      });

    if (error) {
      console.error('Mention notification error:', error);
      return false;
    }

    console.log('✅ Mention bildirimi gönderildi:', senderUsername, '->', userId);
    return data;
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
    const { data, error } = await supabase
      .rpc('send_private_message_notification', {
        p_user_id: userId,
        p_sender_username: senderUsername,
        p_chat_id: chatId
      });

    if (error) {
      console.error('Private message notification error:', error);
      return false;
    }

    console.log('✅ Özel mesaj bildirimi gönderildi:', senderUsername, '->', userId);
    return data;
  } catch (error) {
    console.error('Error sending private message notification:', error);
    return false;
  }
};
// Oyun daveti bildirimi - DÜZELTİLDİ
export const sendGameInviteNotification = async (receiverId: string, senderUsername: string, roomCode: string) => {
  try {
    const { error } = await supabase.rpc(
      'send_game_invite_notification' as any,
      {
        p_receiver_id: receiverId,  // ✅ Doğru parametre ismi
        p_sender_username: senderUsername,
        p_room_code: roomCode
      } as any
    );

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

// Diğer fonksiyonlar aynı kalabilir
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