// utils/chatBot.ts
import { supabase } from '@/integrations/supabase/client';

// Kapsamlı yasaklı kelime listesi - kategorize edilmiş
export const BANNED_WORDS = [
  // === AĞIR KÜFÜRLER (Direkt ban) ===
  'am', 'amcık', 'amcik', 'amına', 'amina', 'amk', 'aq', 'a.q',
  'yarrak', 'yarak', 'yarraq', 'yaraq', 'yrrk', 'yrk',
  'sik', 'sikik', 'sikim', 'sikti', 'siktir', 'sikerim', 'sikim', 'skm', 'sktir', 'siktr',
  'göt', 'got', 'götün', 'gotun', 'götten', 'gotten',
  'orospu', 'orosbu', 'oruspu', 'orusbu', 'orspı', 'orspu', 'orsp',
  'piç', 'pic', 'piçlik',
  'ibne', 'ibine', 'ipne', 'ipine',
  'gavat', 'kavat', 'gavad',
  'pezevenk', 'pezeveng', 'pzvnk',
  'kahpe', 'kaltak', 'sürtük', 'surtuk', 'fahişe', 'fahise',
  'çük', 'cuk', 'çüklü', 'cuklu',
  'taşak', 'tasak', 'taşşak', 'tassak', 'daşak', 'dasak',
  'meme', 'memeler',
  'döl', 'dol',
  'saksocı', 'saksoci', 'saksocu',
  'boşalmak', 'bosalmak',
  'zıkkım', 'zikkim',

  // === KÖTÜ KELİMELER ===
  'ananı', 'anani', 'anan', 'anneni', 'ananızı', 'ananizi',
  'babanı', 'babani', 'baban',
  'sülalen', 'sulalen', 'soyunu', 
  'koduğum', 'kodugum', 'kodum',
  'oç', 'o.ç', 'oc', 'o.c', 'oğlancı', 'oglanci',
  'yavşak', 'yavsak', 'yawsak', 'yvsak',
  'şerefsiz', 'serefsiz', 'serefisz', 'şrfsz',
  'haysiyetsiz', 'namussuz', 'alçak', 'alcak',
  'köpek', 'kopek', 'it',
  'domuz', 'hınzır', 'hinzir', 'hanzır',
  'salak', 'zalak', 'slak', 'slk',
  'aptal', 'aptl', 'ahmak',
  'gerizekalı', 'gerizekali', 'gerzek', 'geri zekalı',
  'mal', 'mâl',
  'dangalak', 'dangal', 'andaval',
  'embesil', 'imbecil',
  'beyinsiz', 'kafasız', 'kafasiz',
  'enayi', 'enai',
  'öküz', 'okuz', 'eşek', 'esek', 'merkep',
  'kıç', 'kic', 'popo', 'makat',

  // === ARGO TEHDITLER ===
  'sinkaf', 'skim', 's2m', 's2k', 's2ş',
  'yalarım', 'yalarim', 'yal',
  'sokarım', 'sokarim', 'sokayım', 'sokayim',
  'keserim', 'koparırım',
  'geber', 'gebertir', 'geberesin', 'öl', 'ölücek',
  
  // === AYRIMCILIK / IRKÇILIK ===
  'zenci', 'nigga', 'negro', 
  'yahudi', 'ermeni', 'kürt', 'arap', // sadece hakaret bağlamında
  'gay', 'lezbiyen', 'homo', 'trans', 'travesti', // hakaret bağlamında

  // === BYPASS DENEMELERI ===
  // Boşluklu versiyonlar
  's i k', 'a m', 'y a r a k', 'o r o s p u', 'p i ç',
  // Noktalı versiyonlar  
  's.i.k', 'a.m', 'y.a.r.a.k', 'o.r.o.s.p.u',
  // Tireli versiyonlar
  's-i-k', 'a-m', 'y-a-r-a-k',
  // Yıldızlı versiyonlar
  'sik*r', 'am*k', 'p*ç', 's*k',
  // Sayı ile değiştirilmiş
  's1k', 's!k', '@m', 'am1na', 'p1ç', 'p!c',
  '4m', 'y4r4k', '0rospu', '0ç', 'g0t', 's!kt!r',
  // Türkçe karakterlerin değiştirilmesi
  'sikis', 'sikişmek', 'sikismek', 'gotten', 'piclik',
];

// Leet speak ve karakter değişimleri için mapping
const CHAR_REPLACEMENTS: { [key: string]: string[] } = {
  'a': ['4', '@', 'α', 'а'],
  'e': ['3', '€', 'е'],
  'i': ['1', '!', '|', 'ı', 'í'],
  'o': ['0', 'ο', 'о'],
  's': ['5', '$', 'ş', 'š'],
  'g': ['9', 'ğ'],
  'c': ['ç', '(', '<'],
  'u': ['ü', 'µ', 'υ'],
};

// Normalize fonksiyonu - tüm bypass denemelerini yakala
const normalizeText = (text: string): string => {
  let normalized = text.toLowerCase();
  
  // 1. Özel karakterleri kaldır (tire, nokta, boşluk, yıldız vb.)
  normalized = normalized.replace(/[-_.* ]/g, '');
  
  // 2. Leet speak dönüşümü
  normalized = normalized
    .replace(/4/g, 'a')
    .replace(/@/g, 'a')
    .replace(/3/g, 'e')
    .replace(/€/g, 'e')
    .replace(/1/g, 'i')
    .replace(/!/g, 'i')
    .replace(/\|/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/\$/g, 's')
    .replace(/9/g, 'g');
  
  // 3. Türkçe karakterleri normalize et
  normalized = normalized
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
  
  // 4. Tekrarlanan harfleri teke indir (yaaraaak -> yarak)
  normalized = normalized.replace(/(.)\1+/g, '$1');
  
  return normalized;
};

// Kısa yasaklı kelimeler için beyaz liste (bu kelimelerin içinde geçebilir)
const SHORT_WORD_WHITELIST: { [key: string]: string[] } = {
  'am': ['selam', 'tamam', 'adam', 'madam', 'hamam', 'imam', 'meram', 'bayram', 'curam', 'keram', 'salam', 'aman', 'zaman', 'derman', 'ferman', 'yaman', 'canan', 'hamamı', 'imamı', 'selamı', 'selamlar', 'salamlar', 'program', 'dram', 'tram', 'kram'],
  'it': ['kitap', 'site', 'bitki', 'yitik', 'ziyafet', 'itibar', 'itibaren', 'kritik', 'politik', 'pratik', 'otomatik', 'bitir', 'yitir', 'gitme', 'gitti', 'bitti', 'itti'],
  'mal': ['normal', 'optimal', 'minimal', 'maksimal', 'animal', 'terminal', 'final', 'orijinal', 'nominal', 'malatya', 'malta'],
  'got': ['forgot', 'ergot'],
  'sik': ['klasik', 'müzik', 'fizik', 'basik', 'eksik', 'kesik', 'bisiklet'],
  'yal': ['yayla', 'yalan', 'yalamak', 'yalı', 'yalın', 'kayal', 'mayal'],
  'öl': ['ölçü', 'ölçek', 'bölüm', 'bölge', 'bölmek', 'gölge', 'köle', 'döllenme'],
};

// Beyaz listedeki kelimeleri kontrol et
const isInWhitelist = (text: string, word: string): boolean => {
  const whitelist = SHORT_WORD_WHITELIST[word.toLowerCase()];
  if (!whitelist) return false;
  
  const lowerText = text.toLowerCase();
  for (const safeWord of whitelist) {
    if (lowerText.includes(safeWord.toLowerCase())) {
      return true;
    }
  }
  return false;
};

// Kelime sınırları ile kontrol (daha hassas)
const containsWordBoundary = (text: string, word: string): boolean => {
  // Kısa kelimeler için (3 harf veya az) beyaz liste kontrolü
  if (word.length <= 3 && isInWhitelist(text, word)) {
    return false;
  }
  
  // Kelime sınırı ile kontrol (regex kullanarak) - sadece bağımsız kelime olarak geçiyorsa
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^a-zçğıöşü])${escapedWord}([^a-zçğıöşü]|$)`, 'i');
  return regex.test(text);
};

// @mention'ları mesajdan çıkar (kullanıcı adları yasaklı kelime kontrolüne takılmamalı)
const removeMentions = (text: string): string => {
  // @kullanıcıadı formatındaki tüm mention'ları kaldır
  return text.replace(/@\w+/g, '');
};

// Mesajda yasaklı kelime kontrol et - GELİŞMİŞ
export const containsBannedWords = (message: string): { found: boolean; word?: string; severity: 'high' | 'medium' | 'low' } => {
  // Önce @mention'ları çıkar - kullanıcı adları yasaklı kelime kontrolüne takılmamalı
  const messageWithoutMentions = removeMentions(message);
  
  const originalLower = messageWithoutMentions.toLowerCase();
  const normalizedMessage = normalizeText(messageWithoutMentions);
  
  // Ağır küfürler (ilk 30 kelime) - direkt ban
  const highSeverityWords = BANNED_WORDS.slice(0, 30);
  
  for (const word of highSeverityWords) {
    const normalizedWord = normalizeText(word);
    
    // Kısa kelimeler için (3 harf veya az) beyaz liste kontrolü - ÖNCE kontrol et
    if (word.length <= 3 && isInWhitelist(messageWithoutMentions, word)) {
      continue; // Beyaz listedeyse bu kelimeyi atla
    }
    
    // Tüm kelimeler için kelime sınırı kontrolü yap (uzun kelimelerde bile,
    // yoksa "tuzlayarak" gibi masum kelimeler "yarak" yüzünden banlanır)
    if (containsWordBoundary(originalLower, word) || containsWordBoundary(normalizedMessage, normalizedWord)) {
      console.log(`🚫 Ağır küfür tespit edildi: "${word}" mesajda: "${message}"`);
      return { found: true, word, severity: 'high' };
    }
  }
  
  // Diğer yasaklı kelimeler
  for (const word of BANNED_WORDS.slice(30)) {
    const normalizedWord = normalizeText(word);
    
    if (containsWordBoundary(originalLower, word) || 
        containsWordBoundary(normalizedMessage, normalizedWord)) {
      console.log(`⚠️ Yasaklı kelime tespit edildi: "${word}" mesajda: "${message}"`);
      return { found: true, word, severity: 'medium' };
    }
  }
  
  // Bypass pattern'leri kontrol et (mention'sız metinde)
  // Not: Kelime sınırı (başta/sonda harf olmamalı) eklenir ki
  // "tuzlayarak", "siklet", "götür" gibi masum kelimeler yakalanmasın.
  const BOUNDARY_START = '(^|[^a-zçğıöşüA-ZÇĞİÖŞÜ])';
  const BOUNDARY_END = '([^a-zçğıöşüA-ZÇĞİÖŞÜ]|$)';
  const bypassPatterns = [
    new RegExp(`${BOUNDARY_START}s+[^a-z]{0,2}i+[^a-z]{0,2}k${BOUNDARY_END}`, 'i'),
    new RegExp(`${BOUNDARY_START}a+[^a-z]{0,2}m+[^a-z]{0,2}[ck]${BOUNDARY_END}`, 'i'),
    new RegExp(`${BOUNDARY_START}y+[^a-z]{0,2}a+[^a-z]{0,2}r+[^a-z]{0,2}a+[^a-z]{0,2}k${BOUNDARY_END}`, 'i'),
    new RegExp(`${BOUNDARY_START}o+[^a-z]{0,2}r+[^a-z]{0,2}o+[^a-z]{0,2}s+[^a-z]{0,2}p`, 'i'),
    new RegExp(`${BOUNDARY_START}p+[^a-z]{0,2}[iı1!]+[^a-z]{0,2}[cç]${BOUNDARY_END}`, 'i'),
    new RegExp(`${BOUNDARY_START}g+[^a-z]{0,2}[oö0]+[^a-z]{0,2}t${BOUNDARY_END}`, 'i'),
  ];
  
  for (const pattern of bypassPatterns) {
    if (pattern.test(messageWithoutMentions)) {
      // Tek harfli normal kelime aralıklarında false positive olmaması için
      // pattern içinde gerçekten karakter atlama (boşluk/nokta/yıldız) varsa şüpheli say
      const hasSeparators = /[\s.\-_*]/.test(messageWithoutMentions);
      const matchedRaw = messageWithoutMentions.match(pattern)?.[0] || '';
      const looksLikeBypass = /[\s.\-_*0-9!@$]/.test(matchedRaw);
      if (looksLikeBypass) {
        console.log(`🔍 Bypass pattern tespit edildi: ${pattern} mesajda: "${message}"`);
        return { found: true, word: 'bypass-pattern', severity: 'high' };
      }
    }
  }
  
  return { found: false, severity: 'low' };
};

// Basit boolean döndüren eski fonksiyon (geriye uyumluluk için)
export const containsBannedWordsSimple = (message: string): boolean => {
  return containsBannedWords(message).found;
};

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
        avatar_url: '/bot-avatar.png'
      });

    return !error;
  } catch (error) {
    console.error('Error sending welcome message:', error);
    return false;
  }
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

// === AI SOHBET BOTU ===
export const AI_BOT_NAME = 'kelimele';
export const BOT_USERNAMES = ['kelimeciBot', AI_BOT_NAME];

// Mesaj bot tarafından mı gönderildi?
export const isBotUsername = (username?: string | null): boolean =>
  !!username && BOT_USERNAMES.some((b) => b.toLowerCase() === username.toLowerCase());

// Mesajda @kelimele etiketi var mı?
export const mentionsAiBot = (message: string): boolean =>
  new RegExp(`@${AI_BOT_NAME}\\b`, 'i').test(message);
