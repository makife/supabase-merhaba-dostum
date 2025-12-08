-- Bonus kredi alanı ekle
ALTER TABLE public.profiles ADD COLUMN bonus_credits INTEGER DEFAULT 0;

-- Hak yenilenme fonksiyonunu güncelle
CREATE OR REPLACE FUNCTION public.refresh_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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

-- Trigger oluştur (varsa güncelle)
DROP TRIGGER IF EXISTS refresh_credits_trigger ON public.profiles;
CREATE TRIGGER refresh_credits_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_user_credits();

-- Aktif kredi yenilenme fonksiyonu (her kullanıcı için çağrılabilir)
CREATE OR REPLACE FUNCTION public.check_and_refresh_credits(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  UPDATE public.profiles 
  SET updated_at = NOW()
  WHERE id = user_id;
END;
$function$;