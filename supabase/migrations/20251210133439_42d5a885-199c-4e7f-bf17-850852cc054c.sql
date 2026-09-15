-- check_and_refresh_credits fonksiyonunu güncelle
-- 1. 72 dakika interval kullan
-- 2. Krediler 5/5 olunca last_credit_refresh'i NULL yap

CREATE OR REPLACE FUNCTION check_and_refresh_credits(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_record RECORD;
  new_credits INTEGER;
  credit_increment INTEGER;
BEGIN
  -- Kullanıcı bilgilerini al
  SELECT * INTO user_record 
  FROM public.profiles 
  WHERE id = user_id;
  
  -- Kullanıcı yoksa çıkış yap
  IF user_record IS NULL THEN
    RETURN;
  END IF;
  
  -- Premium kullanıcılar için kredi yenileme yapma
  IF user_record.premium_until IS NOT NULL AND user_record.premium_until > NOW() THEN
    RETURN;
  END IF;
  
  -- Unlimited lives aktifse kredi yenileme yapma
  IF user_record.unlimited_lives_until IS NOT NULL AND user_record.unlimited_lives_until > NOW() THEN
    RETURN;
  END IF;
  
  -- Kredi zaten 5/5 ise timer'ı sıfırla ve çık
  IF user_record.game_credits >= 5 THEN
    -- last_credit_refresh'i temizle (timer dursun)
    IF user_record.last_credit_refresh IS NOT NULL THEN
      UPDATE public.profiles 
      SET last_credit_refresh = NULL
      WHERE id = user_id;
    END IF;
    RETURN;
  END IF;
  
  -- Kredi artışı hesapla (offline süre göz önünde bulundurarak)
  credit_increment := 0;
  
  -- Son refresh'ten bu yana geçen süreyi hesapla
  IF user_record.last_credit_refresh IS NULL THEN
    -- Timer başlamamış, şu anı başlangıç olarak ayarla
    UPDATE public.profiles 
    SET last_credit_refresh = NOW()
    WHERE id = user_id;
    RETURN;
  ELSE
    -- 72 dakikalık periyotları say
    credit_increment := FLOOR(
      EXTRACT(EPOCH FROM (NOW() - user_record.last_credit_refresh)) / (72 * 60)
    )::INTEGER;
  END IF;
  
  -- Eğer kredi artışı yoksa çık
  IF credit_increment <= 0 THEN
    RETURN;
  END IF;
  
  -- En fazla 5'e kadar kredi ekle
  new_credits := LEAST(user_record.game_credits + credit_increment, 5);
  
  -- Eğer kredi artışı varsa güncelle
  IF new_credits > user_record.game_credits THEN
    -- Krediler 5'e ulaştıysa last_credit_refresh'i NULL yap (timer dursun)
    IF new_credits >= 5 THEN
      UPDATE public.profiles 
      SET 
        game_credits = new_credits,
        last_credit_refresh = NULL,
        updated_at = NOW()
      WHERE id = user_id;
    ELSE
      -- Hala 5'in altında, timer devam etsin (yeni başlangıç noktası)
      UPDATE public.profiles 
      SET 
        game_credits = new_credits,
        last_credit_refresh = NOW(),
        updated_at = NOW()
      WHERE id = user_id;
    END IF;
  END IF;
END;
$$;