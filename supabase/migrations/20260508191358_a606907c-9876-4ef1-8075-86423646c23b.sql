
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pending_boost_minutes INTEGER NOT NULL DEFAULT 0;

-- RPC: claim accumulated boost minutes — adds them on top of current score_boost_until (or now)
CREATE OR REPLACE FUNCTION public.claim_score_boost()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pending integer;
  v_current_until timestamptz;
  v_base timestamptz;
  v_new_until timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT COALESCE(pending_boost_minutes, 0), score_boost_until
    INTO v_pending, v_current_until
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_pending IS NULL OR v_pending <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_boost');
  END IF;

  v_base := GREATEST(COALESCE(v_current_until, NOW()), NOW());
  v_new_until := v_base + (v_pending || ' minutes')::interval;

  UPDATE public.profiles
     SET score_boost_until = v_new_until,
         pending_boost_minutes = 0,
         updated_at = NOW()
   WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'score_boost_until', v_new_until,
    'minutes_added', v_pending
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_score_boost() TO authenticated;
