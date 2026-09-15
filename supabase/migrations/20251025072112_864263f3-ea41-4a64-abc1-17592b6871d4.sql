-- makifergan@gmail.com hesabına moderatör rolü ver
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- E-posta adresinden kullanıcı ID'sini bul
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'makifergan@gmail.com';

  -- Eğer kullanıcı bulunursa moderatör rolü ekle
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'moderator')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Moderatör rolü başarıyla eklendi: %', v_user_id;
  ELSE
    RAISE NOTICE 'Kullanıcı bulunamadı: makifergan@gmail.com';
  END IF;
END $$;