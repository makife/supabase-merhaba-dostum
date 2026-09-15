-- User blocking sistemi için tablo güncelleme
-- user_blocks tablosu zaten var, sadece eksik indexleri ekleyelim

-- Performans için indexler
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_id ON user_blocks(blocked_id);

-- Moderate message fonksiyonunu geliştirelim
CREATE OR REPLACE FUNCTION public.moderate_message_advanced(p_user_id uuid, p_message text)
 RETURNS TABLE(is_appropriate boolean, reason text, should_ban boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  banned_words TEXT[] := ARRAY[
    'orospu', 'piç', 'amcık', 'yarrak', 'siktir', 'götün', 'amına', 'sikim', 
    'sikeyim', 'götüne', 'fuck', 'shit', 'bitch', 'asshole'
  ];
  mild_words TEXT[] := ARRAY[
    'amk', 'amq', 'oç', 'sik', 'aptal', 'salak', 'gerizekalı', 'mal'
  ];
  word TEXT;
  lower_message TEXT := LOWER(TRIM(p_message));
  word_count INTEGER;
  banned_word_count INTEGER := 0;
  mild_word_count INTEGER := 0;
BEGIN
  -- Çok kısa mesajlar için özel durum
  word_count := array_length(string_to_array(lower_message, ' '), 1);
  
  -- Tek kelimelik masum mesajlar için (selam, merhaba, etc)
  IF word_count = 1 AND length(lower_message) <= 10 THEN
    -- Sadece çok ağır küfürler için ban
    FOREACH word IN ARRAY banned_words
    LOOP
      IF lower_message = word THEN
        RETURN QUERY SELECT false, 'Ağır küfür: ' || word, true;
        RETURN;
      END IF;
    END LOOP;
    
    -- Hafif kelimeler tek başına kullanılırsa sadece uyarı
    FOREACH word IN ARRAY mild_words
    LOOP
      IF lower_message = word THEN
        RETURN QUERY SELECT false, 'Uygunsuz kelime: ' || word, false;
        RETURN;
      END IF;
    END LOOP;
  ELSE
    -- Normal mesajlar için tam kontrol
    FOREACH word IN ARRAY banned_words
    LOOP
      IF lower_message LIKE '%' || word || '%' THEN
        banned_word_count := banned_word_count + 1;
      END IF;
    END LOOP;
    
    FOREACH word IN ARRAY mild_words
    LOOP
      IF lower_message LIKE '%' || word || '%' THEN
        mild_word_count := mild_word_count + 1;
      END IF;
    END LOOP;
    
    -- Ban kararı
    IF banned_word_count > 0 THEN
      RETURN QUERY SELECT false, 'Ağır küfür tespit edildi', true;
      RETURN;
    ELSIF mild_word_count > 2 THEN
      RETURN QUERY SELECT false, 'Çoklu uygunsuz kelime', true;
      RETURN;
    ELSIF mild_word_count > 0 THEN
      RETURN QUERY SELECT false, 'Uygunsuz kelime tespit edildi', false;
      RETURN;
    END IF;
  END IF;
  
  -- Mesaj uygun
  RETURN QUERY SELECT true, 'Mesaj uygun'::TEXT, false;
END;
$function$;

-- Global chat'e is_read kolonu ekleyelim (eğer yoksa)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'global_chat' AND column_name = 'is_read') THEN
        ALTER TABLE public.global_chat ADD COLUMN is_read boolean DEFAULT true;
    END IF;
END $$;