-- refresh_user_credits fonksiyonunu güncelle
CREATE OR REPLACE FUNCTION public.refresh_user_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Sadece premium olmayan kullanıcılar için kredi yenile
  IF NEW.premium_until IS NULL OR NEW.premium_until <= NOW() THEN
    -- Eğer game_credits 5'ten az ise ve son yenilemeden 15 dakika geçmişse
    IF NEW.game_credits < 5 AND (NEW.last_credit_refresh IS NULL OR NEW.last_credit_refresh <= NOW() - INTERVAL '72 minutes') THEN
      -- Kredileri 1 artır ama 5'i geçmesin
      NEW.game_credits = LEAST(NEW.game_credits + 1, 5);
      NEW.last_credit_refresh = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- check_and_refresh_credits fonksiyonunu güncelle
CREATE OR REPLACE FUNCTION public.check_and_refresh_credits(user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  
  -- Kredi artışı hesapla (offline süre göz önünde bulundurarak)
  credit_increment := 0;
  
  IF user_record.game_credits < 5 THEN
    -- Son refresh'ten bu yana geçen süreyi hesapla
    IF user_record.last_credit_refresh IS NULL THEN
      -- İlk kez refresh yapılıyorsa
      credit_increment := 1;
    ELSE
      -- 15 dakikalık periyotları say
      credit_increment := FLOOR(
        EXTRACT(EPOCH FROM (NOW() - user_record.last_credit_refresh)) / (15 * 60)
      )::INTEGER;
    END IF;
    
    -- En fazla 5'e kadar kredi ekle
    new_credits := LEAST(user_record.game_credits + credit_increment, 5);
    
    -- Eğer kredi artışı varsa güncelle
    IF credit_increment > 0 AND new_credits > user_record.game_credits THEN
      UPDATE public.profiles 
      SET 
        game_credits = new_credits,
        last_credit_refresh = NOW(),
        updated_at = NOW()
      WHERE id = user_id;
    END IF;
  END IF;
END;
$function$;