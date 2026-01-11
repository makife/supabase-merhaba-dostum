-- 1. get_server_time fonksiyonu - Sunucu zamanını döndürür
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT now();
$$;

-- 2. cleanup_expired_tournaments fonksiyonu - Süresi dolmuş turnuvaları temizler
CREATE OR REPLACE FUNCTION public.cleanup_expired_tournaments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 24 saatten eski "waiting" durumundaki turnuvaları sil
  DELETE FROM public.tournaments 
  WHERE status = 'waiting' 
    AND created_at < now() - interval '24 hours';
  
  -- 48 saatten eski "completed" veya "cancelled" turnuvaları sil
  DELETE FROM public.tournaments 
  WHERE status IN ('completed', 'cancelled') 
    AND created_at < now() - interval '48 hours';
END;
$$;

-- 3. check_and_refresh_credits fonksiyonu - Kredileri kontrol eder ve yeniler
CREATE OR REPLACE FUNCTION public.check_and_refresh_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Son kredi yenilemesi 24 saatten eski olan kullanıcıların kredilerini yenile
  FOR user_record IN 
    SELECT id, credits, last_credit_refresh 
    FROM public.profiles 
    WHERE last_credit_refresh IS NULL 
       OR last_credit_refresh < now() - interval '24 hours'
  LOOP
    UPDATE public.profiles 
    SET 
      credits = GREATEST(credits, 5), -- En az 5 kredi olsun
      last_credit_refresh = now()
    WHERE id = user_record.id;
  END LOOP;
END;
$$;

-- Fonksiyonlara public erişim izni ver
GRANT EXECUTE ON FUNCTION public.get_server_time() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_tournaments() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_refresh_credits() TO anon, authenticated;