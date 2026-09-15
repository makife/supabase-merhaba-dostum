
ALTER TABLE public.tournament_participants
  ADD COLUMN IF NOT EXISTS score_finalized boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.finalize_tournament_score(
  p_user_id uuid,
  p_tournament_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_already_finalized boolean;
  v_matches_played integer := 0;
  v_total_with_winner_mult bigint := 0;
  v_is_premium boolean;
  v_has_boost boolean;
  v_xp_mult numeric := 1.0;
  v_already_added bigint;
  v_desired bigint;
  v_delta bigint;
  v_turkey_now timestamp;
  v_week_start date;
  v_month_start date;
  v_today date;
BEGIN
  -- Idempotency check
  SELECT score_finalized INTO v_already_finalized
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id AND user_id = p_user_id AND is_bot = false
  LIMIT 1;

  IF v_already_finalized IS TRUE THEN
    RETURN jsonb_build_object('status', 'already_finalized');
  END IF;

  -- Sum raw scores * winner multiplier (5x if won match else 1x)
  SELECT
    COUNT(*),
    COALESCE(SUM(
      CASE WHEN tm.player1_id = p_user_id THEN COALESCE(tm.player1_score, 0)
           ELSE COALESCE(tm.player2_score, 0) END
      * CASE WHEN tm.winner_id = p_user_id THEN 5 ELSE 1 END
    ), 0)
  INTO v_matches_played, v_total_with_winner_mult
  FROM public.tournament_matches tm
  WHERE tm.tournament_id = p_tournament_id
    AND tm.status = 'completed'
    AND (tm.player1_id = p_user_id OR tm.player2_id = p_user_id);

  IF v_matches_played IS NULL OR v_matches_played <= 1 THEN
    -- Tek maç oynayan için bölme gereksiz
    UPDATE public.tournament_participants
    SET score_finalized = true
    WHERE tournament_id = p_tournament_id AND user_id = p_user_id AND is_bot = false;
    RETURN jsonb_build_object('status', 'no_adjustment', 'matches', COALESCE(v_matches_played, 0));
  END IF;

  -- Read multipliers from profile (approximation: snapshot at finalize time)
  SELECT
    (premium_until IS NOT NULL AND premium_until > NOW()),
    (score_boost_until IS NOT NULL AND score_boost_until > NOW())
  INTO v_is_premium, v_has_boost
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_is_premium THEN v_xp_mult := v_xp_mult + 1.0; END IF;
  IF v_has_boost THEN v_xp_mult := v_xp_mult + 1.0; END IF;

  v_already_added := FLOOR(v_total_with_winner_mult * v_xp_mult);
  v_desired := FLOOR((v_total_with_winner_mult::numeric / v_matches_played) * v_xp_mult);
  v_delta := v_desired - v_already_added;

  IF v_delta = 0 THEN
    UPDATE public.tournament_participants
    SET score_finalized = true
    WHERE tournament_id = p_tournament_id AND user_id = p_user_id AND is_bot = false;
    RETURN jsonb_build_object('status', 'zero_delta');
  END IF;

  v_turkey_now := NOW() AT TIME ZONE 'Europe/Istanbul';
  v_week_start := DATE_TRUNC('week', v_turkey_now)::date;
  v_month_start := DATE_TRUNC('month', v_turkey_now)::date;
  v_today := v_turkey_now::date;

  -- Apply delta to profile total_score (clamp at 0)
  UPDATE public.profiles
  SET total_score = GREATEST(0, COALESCE(total_score, 0) + v_delta),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Apply delta to weekly_stats
  UPDATE public.weekly_stats
  SET total_score = GREATEST(0, total_score + v_delta),
      updated_at = NOW()
  WHERE user_id = p_user_id AND week_start = v_week_start;

  -- Apply delta to monthly_stats
  UPDATE public.monthly_stats
  SET total_score = GREATEST(0, total_score + v_delta),
      updated_at = NOW()
  WHERE user_id = p_user_id AND month_start = v_month_start;

  -- Apply delta to daily_leaderboard
  UPDATE public.daily_leaderboard
  SET daily_score = GREATEST(0, daily_score + v_delta),
      updated_at = NOW()
  WHERE user_id = p_user_id AND date = v_today;

  -- Mark finalized
  UPDATE public.tournament_participants
  SET score_finalized = true
  WHERE tournament_id = p_tournament_id AND user_id = p_user_id AND is_bot = false;

  RETURN jsonb_build_object(
    'status', 'finalized',
    'matches', v_matches_played,
    'total_before', v_already_added,
    'total_after', v_desired,
    'delta', v_delta
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_tournament_score(uuid, uuid) TO authenticated, anon;
