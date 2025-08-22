// utils/chatBot.ts
import { supabase } from '@/integrations/supabase/client';

// Yasaklı kelime listesi
export const BANNED_WORDS = [
  'küfür1', 'küfür2', 'argo1', 'argo2', 
  'hakaret1', 'hakaret2', 'rasist1'
  // ... diğer yasaklı kelimeler
];

// Kullanıcı yasaklı mı kontrol et
export const isUserBanned = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('banned_users')
      .select('banned_until')
      .eq('user_id', userId)
      .gt('banned_until', new Date().toISOString())
      .single();

    return !!data;
  } catch (error) {
    return false;
  }
};

// Kullanıcıyı yasakla
export const banUser = async (
  userId: string, 
  reason: string, 
  durationHours: number = 48, // 2 gün
  bannedBy: string = 'kelimeciBot'
) => {
  try {
    const bannedUntil = new Date();
    bannedUntil.setHours(bannedUntil.getHours() + durationHours);

    const { error } = await supabase
      .from('banned_users')
      .insert({
        user_id: userId,
        reason: reason,
        banned_until: bannedUntil.toISOString(),
        banned_by: bannedBy
      });

    return !error;
  } catch (error) {
    console.error('Error banning user:', error);
    return false;
  }
};

// Hoşgeldin mesajı gönder
export const sendWelcomeMessage = async (chatId: string) => {
  try {
    const { error } = await supabase
      .from('global_chat')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Özel bot ID
        username: 'kelimeciBot',
        message: 'Hoşgeldiniz! 🎉 Lütfen kurallar çerçevesinde sohbet ediniz. Küfür, argo ve hakaret içeren mesajlar otomatik olarak tespit edilir ve 2 gün sohbet yasağı uygulanır.',
        avatar_url: '/bot-avatar.png' // Bot avatarı
      });

    return !error;
  } catch (error) {
    console.error('Error sending welcome message:', error);
    return false;
  }
};

// Mesajda yasaklı kelime kontrol et
export const containsBannedWords = (message: string): boolean => {
  const lowerMessage = message.toLowerCase();
  return BANNED_WORDS.some(word => lowerMessage.includes(word.toLowerCase()));
};

export const getBanTimeLeft = async (userId: string): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('banned_users')
      .select('banned_until')
      .eq('user_id', userId)
      .gt('banned_until', new Date().toISOString())
      .single();

    if (!data) return '';

    const bannedUntil = new Date(data.banned_until);
    const now = new Date();
    const diffMs = bannedUntil.getTime() - now.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours} saat ${minutes} dakika`;
  } catch (error) {
    return '';
  }
};
