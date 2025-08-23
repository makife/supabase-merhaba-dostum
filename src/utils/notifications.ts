// src/utils/notifications.ts
import { supabase } from '@/integrations/supabase/client';

// Özel mesaj bildirimi (Güncellenmiş versiyon)
export const sendMessageNotification = async (receiverId: string, senderUsername: string, chatId?: string) => {
  try {
    const { error } = await supabase.rpc('send_private_message_notification', {
      p_receiver_id: receiverId,
      p_sender_username: senderUsername,
      p_chat_id: chatId
    });

    if (error) {
      console.error('Error sending message notification via RPC:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error in sendMessageNotification:', error);
    return false;
  }
};

// Diğer fonksiyonlar için de benzer şekilde RPC function'ları oluşturabilirsiniz
// Mention bildirimi için
export const sendMentionNotification = async (receiverId: string, senderUsername: string, message: string, messageId?: string) => {
  try {
    // Önce Supabase'de benzer bir function oluşturmanız gerekecek
    const { error } = await supabase.rpc('send_mention_notification', {
      p_receiver_id: receiverId,
      p_sender_username: senderUsername,
      p_message: message,
      p_message_id: messageId
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

// Oyun daveti bildirimi için
export const sendGameInviteNotification = async (receiverId: string, senderUsername: string, roomCode: string) => {
  try {
    // Önce Supabase'de benzer bir function oluşturmanız gerekecek
    const { error } = await supabase.rpc('send_game_invite_notification', {
      p_receiver_id: receiverId,
      p_sender_username: senderUsername,
      p_room_code: roomCode
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

// Diğer fonksiyonlar aynı kalabilir (getUserNotifications, markNotificationsAsRead)
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