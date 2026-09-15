-- Yeni kullanıcılara verilen 7 günlük premium paketi kaldır
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
    NULL, -- Premium paketi kaldırıldı
    5 -- Normal kredi miktarı
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;