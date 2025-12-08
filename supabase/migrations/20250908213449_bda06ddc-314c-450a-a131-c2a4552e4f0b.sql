-- Var olan fonksiyonu sil
DROP FUNCTION IF EXISTS public.refresh_user_credits();

-- Kullanıcı profili oluşturma tetikleyicisini düzelt
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    username,
    email,
    game_credits,
    bonus_credits,
    last_credit_refresh,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    5,
    0,
    NOW(),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Mevcut tetikleyiciyi sil ve yeniden oluştur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Mevcut kullanıcılar için profil oluştur (eğer yoksa)
INSERT INTO public.profiles (
  id,
  username,
  email,
  game_credits,
  bonus_credits,
  last_credit_refresh,
  created_at,
  updated_at
)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)),
  u.email,
  5,
  0,
  NOW(),
  NOW(),
  NOW()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- Oyun hakları yenileme fonksiyonu oluştur
CREATE OR REPLACE FUNCTION public.refresh_user_credits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Premium olmayan ve son yenileme 15+ dakika geçen kullanıcıları güncelle
  UPDATE public.profiles 
  SET 
    game_credits = LEAST(game_credits + 1, 5),
    last_credit_refresh = NOW(),
    updated_at = NOW()
  WHERE 
    (premium_until IS NULL OR premium_until < NOW()) -- Premium değil
    AND game_credits < 5 -- Maksimum krediye ulaşmamış
    AND (
      last_credit_refresh IS NULL OR 
      last_credit_refresh < NOW() - INTERVAL '72 minutes'
    );
END;
$$;