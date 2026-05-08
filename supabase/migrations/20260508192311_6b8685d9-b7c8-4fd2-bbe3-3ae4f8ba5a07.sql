CREATE OR REPLACE FUNCTION public.award_kelime_avi_boost()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'success', false,
    'is_first', false,
    'error', 'kelime_avi_boost_awarded_at_midnight_only'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_kelime_avi_boost() TO authenticated;