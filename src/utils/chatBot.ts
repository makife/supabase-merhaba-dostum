// utils/chatBot.ts
import { supabase } from '@/integrations/supabase/client';

// Yasaklı kelime listesi
export const BANNED_WORDS = [
  // Küfürler
  'am', 'çük', 'sik','yarak', 'göt', 'amına','koduğum', 'goduğum', 'ibne','ibine', 'ipne', 'gavat','kavat', 'oç', 'o.ç','kahpe', 'piç', 'pic','orospu', 'orosbu', 'orusbu',
  // Argo kelimeler
  'yavşak', 'yavsak', 'it','lan', 'aptal', 'mal','hayvan', 'pipi', 'öküz','manyak', 'yalarım', 'sokarım',
  // Hakaretler
  'şerefsiz', 'beyinsiz','salak', 'zalak', 'mal','it', 'köpek', 'orusbu',
  // Bypass attempt'leri
  'sikti*r', 'sikti-r', 's i k t i r',
];

// Kullanıcı yasaklı mı kontrol et - user_bans tablosunu kullan
export const isUserBanned = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('user_bans')
      .select('banned_until')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gt('banned_until', new Date().toISOString())
      .single();

    return !!data;
  } catch (error) {
    return false;
  }
};

// Kullanıcıyı yasakla - user_bans tablosunu kullan  
export const banUser = async (
  userId: string, 
  reason: string, 
  durationHours: number = 48, // 2 gün
  bannedBy: string = 'kelimeciBot'
) => {
  try {
    const bannedUntil = new Date();
    bannedUntil.setHours(bannedUntil.getHours() + durationHours);

    // Önce eski aktif banları deaktive et
    await supabase
      .from('user_bans')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Yeni ban ekle
    const { error } = await supabase
      .from('user_bans')
      .insert({
        user_id: userId,
        reason: reason,
        banned_until: bannedUntil.toISOString(),
        banned_by: userId, // Sistem banı
        is_active: true
      });

    return !error;
  } catch (error) {
    console.error('Error banning user:', error);
    return false;
  }
};

// Hoşgeldin mesajı gönder
export const sendWelcomeMessage = async (chatId?: string) => {
  try {
    const { error } = await supabase
      .from('global_chat')
      .insert({
        user_id: null,
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
      .from('user_bans')
      .select('banned_until')
      .eq('user_id', userId)
      .eq('is_active', true)
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
