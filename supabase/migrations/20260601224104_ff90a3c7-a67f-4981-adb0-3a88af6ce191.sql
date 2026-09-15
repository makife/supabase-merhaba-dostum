
CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text;
  v_taken boolean;
  v_banned boolean;
BEGIN
  v_clean := btrim(coalesce(p_username, ''));
  IF length(v_clean) < 2 THEN
    RETURN 'invalid';
  END IF;

  -- Banned word check (case-insensitive, substring match)
  SELECT EXISTS (
    SELECT 1 FROM public.banned_words
    WHERE lower(v_clean) LIKE '%' || lower(word) || '%'
  ) INTO v_banned;
  IF v_banned THEN
    RETURN 'banned';
  END IF;

  -- Uniqueness (case-insensitive), exclude current user
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(v_clean)
      AND id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  ) INTO v_taken;
  IF v_taken THEN
    RETURN 'taken';
  END IF;

  RETURN 'ok';
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(username));
