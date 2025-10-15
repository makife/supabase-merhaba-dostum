// utils/notifications.ts - Console log versiyonu (TypeScript hatasız)
import { supabase } from '@/integrations/supabase/client';

// Mention bildirimi - Veritabanı kaydı ile
export const sendMentionNotification = async (
  userId: string,
  senderUsername: string, 
  message: string,
  messageId?: string
) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'mention',
        message: `${senderUsername} seni bir mesajda etiketledi: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
        related_id: messageId,
        is_read: false
      });

    if (error) {
      console.error('Mention notification error:', error);
      return false;
    }

    console.log('🔔 MENTION NOTIFICATION SAVED:', {
      to: userId,
      from: senderUsername,
      message: message.substring(0, 50) + '...',
      type: 'mention',
      timestamp: new Date().toLocaleString('tr-TR')
    });
    
    return true;
  } catch (error) {
    console.error('Error sending mention notification:', error);
    return false;
  }
};

// Özel mesaj bildirimi - Console log versiyonu
export const sendMessageNotification = async (
  userId: string,
  senderUsername: string,
  chatId: string
) => {
  console.log('💬 PRIVATE MESSAGE NOTIFICATION:', {
    to: userId,
    from: senderUsername,
    chatId: chatId,
    type: 'private_message',
    timestamp: new Date().toLocaleString('tr-TR')
  });
  return true;
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
        type: 'invite',
        message: `${senderUsername} sana oyun daveti gönderdi`,
        related_id: roomCode,
        is_read: false
      });

    if (error) {
      console.error('Game invite notification error:', error);
      return false;
    }

    console.log('🎮 GAME INVITE NOTIFICATION SAVED:', {
      to: receiverId,
      from: senderUsername,
      roomCode: roomCode,
      type: 'game_invite',
      timestamp: new Date().toLocaleString('tr-TR')
    });
    
    return true;
  } catch (error) {
    console.error('Error sending game invite notification:', error);
    return false;
  }
};

// Tekrar oyun bildirimi
export const sendRematchNotification = async (
  receiverId: string,
  senderUsername: string,
  roomCode: string,
  gameType: string
) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: receiverId,
        type: 'rematch',
        message: `${senderUsername} tekrar oyun istiyor`,
        related_id: roomCode,
        is_read: false
      });

    if (error) {
      console.error('Rematch notification error:', error);
      return false;
    }

    console.log('🔄 REMATCH NOTIFICATION SAVED:', {
      to: receiverId,
      from: senderUsername,
      roomCode: roomCode,
      gameType: gameType,
      type: 'rematch',
      timestamp: new Date().toLocaleString('tr-TR')
    });
    
    return true;
  } catch (error) {
    console.error('Error sending rematch notification:', error);
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

    return !error;
  } catch (error) {
    console.error('Error marking notifications as read:', error);
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

// Browser notification göster
export const showBrowserNotification = (title: string, message: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body: message,
      icon: '/favicon.ico'
    });
  }
};