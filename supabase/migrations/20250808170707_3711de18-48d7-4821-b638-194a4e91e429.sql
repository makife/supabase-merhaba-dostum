-- Yeni kullanıcı fonksiyonunu güncelle - 1 haftalık hediye premium ekle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    username,
    premium_until,
    game_credits
  )
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NOW() + INTERVAL '7 days', -- 1 haftalık hediye premium
    5 -- Normal kredi miktarı (premium olduğu için sınırsız olacak)
  );
  RETURN NEW;
END;
$function$