-- Eski fonksiyonu sil
DROP FUNCTION IF EXISTS public.delete_tournament_participant(uuid, uuid);

-- TEXT parametreli yeni fonksiyon (PostgREST uyumlu)
CREATE OR REPLACE FUNCTION public.delete_tournament_participant(
  p_tournament_id text,
  p_user_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM tournament_participants 
  WHERE tournament_id = p_tournament_id::uuid 
    AND user_id = p_user_id::uuid 
    AND is_bot = false;
  
  RETURN FOUND;
END;
$$;

-- PostgREST cache'i yenile
NOTIFY pgrst, 'reload schema';