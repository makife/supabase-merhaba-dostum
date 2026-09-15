-- Basit katılımcı silme fonksiyonu
CREATE OR REPLACE FUNCTION public.delete_tournament_participant(
  p_tournament_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM tournament_participants 
  WHERE tournament_id = p_tournament_id 
    AND user_id = p_user_id 
    AND is_bot = false;
  
  RETURN FOUND;
END;
$$;

-- PostgREST cache'i yenile
NOTIFY pgrst, 'reload schema';