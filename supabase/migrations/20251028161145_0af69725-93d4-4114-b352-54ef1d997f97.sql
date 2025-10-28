-- ============================================
-- Hesap Silme İşlevi - KVKK Gereksinimi
-- ============================================

-- Kullanıcı kendi hesabını silebilsin
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_uuid UUID;
BEGIN
  -- Mevcut kullanıcının ID'sini al
  user_uuid := auth.uid();
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'Kullanıcı oturum açmamış';
  END IF;
  
  -- Kullanıcının tüm verilerini sil (CASCADE ile ilişkili tablolar da silinir)
  DELETE FROM public.profiles WHERE id = user_uuid;
  
  -- Auth kullanıcısını sil (bu kısım auth.users tablosuna erişim gerektirir)
  -- NOT: Bu işlem için Supabase Dashboard'dan manuel yapılması gerekebilir
  -- Veya service_role key ile edge function'dan yapılmalıdır
  
  RAISE NOTICE 'Kullanıcı hesabı silindi: %', user_uuid;
END;
$function$;

-- Veri dışa aktarma fonksiyonu (GDPR/KVKK uyumluluk)
CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_uuid UUID;
  user_data JSONB;
BEGIN
  user_uuid := auth.uid();
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'Kullanıcı oturum açmamış';
  END IF;
  
  -- Kullanıcının tüm verilerini topla
  SELECT json_build_object(
    'profile', (SELECT row_to_json(p.*) FROM public.profiles p WHERE p.id = user_uuid),
    'game_sessions', (SELECT json_agg(gs.*) FROM public.game_sessions gs WHERE gs.user_id = user_uuid),
    'game_history', (SELECT json_agg(gh.*) FROM public.game_history gh WHERE gh.player_id = user_uuid),
    'daily_stats', (SELECT json_agg(ds.*) FROM public.daily_stats ds WHERE ds.user_id = user_uuid),
    'weekly_stats', (SELECT json_agg(ws.*) FROM public.weekly_stats ws WHERE ws.user_id = user_uuid),
    'monthly_stats', (SELECT json_agg(ms.*) FROM public.monthly_stats ms WHERE ms.user_id = user_uuid),
    'purchases', (SELECT json_agg(up.*) FROM public.user_purchases up WHERE up.user_id = user_uuid),
    'inventory', (SELECT json_agg(ui.*) FROM public.user_inventory ui WHERE ui.user_id = user_uuid),
    'badges', (SELECT json_agg(ub.*) FROM public.user_badges ub WHERE ub.user_id = user_uuid),
    'exported_at', NOW()
  ) INTO user_data;
  
  RETURN user_data;
END;
$function$;