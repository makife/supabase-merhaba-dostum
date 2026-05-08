
CREATE OR REPLACE FUNCTION public.award_kelime_avi_boost()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_my_score numeric;
  v_top_score numeric;
  v_current_boost timestamptz;
  v_new_until timestamptz;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauth');
  END IF;

  SELECT score INTO v_my_score
    FROM public.challenge_scores
   WHERE user_id = v_user
     AND challenge_type = 'kelime_avi'
     AND date = v_today;

  IF v_my_score IS NULL OR v_my_score <= 0 THEN
    RETURN jsonb_build_object('success', false, 'is_first', false, 'error', 'no_score');
  END IF;

  SELECT MAX(score) INTO v_top_score
    FROM public.challenge_scores
   WHERE challenge_type = 'kelime_avi'
     AND date = v_today;

  IF v_my_score < COALESCE(v_top_score, 0) THEN
    RETURN jsonb_build_object('success', false, 'is_first', false);
  END IF;

  SELECT score_boost_until INTO v_current_boost
    FROM public.profiles WHERE id = v_user;

  v_new_until := now() + interval '1 hour';
  IF v_current_boost IS NOT NULL AND v_current_boost > v_new_until THEN
    v_new_until := v_current_boost;
  END IF;

  UPDATE public.profiles
     SET score_boost_until = v_new_until,
         updated_at = now()
   WHERE id = v_user;

  RETURN jsonb_build_object('success', true, 'is_first', true, 'boost_until', v_new_until);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_kelime_avi_boost() TO authenticated;
