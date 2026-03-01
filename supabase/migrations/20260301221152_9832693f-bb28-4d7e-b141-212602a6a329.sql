CREATE OR REPLACE FUNCTION public.award_disconnect_bonus(p_user_id uuid, p_bonus_points integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_week_start DATE;
  current_month_start DATE;
  v_turkey_now TIMESTAMP;
BEGIN
  -- 🇹🇷 Türkiye saatine göre hafta/ay başlangıçları
  v_turkey_now := NOW() AT TIME ZONE 'Europe/Istanbul';
  current_week_start := DATE_TRUNC('week', v_turkey_now)::DATE;
  current_month_start := DATE_TRUNC('month', v_turkey_now)::DATE;

  -- 1) profiles (sadece puan)
  UPDATE public.profiles
  SET 
    total_score = COALESCE(total_score, 0) + p_bonus_points,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- 2) weekly_stats (sadece puan)
  INSERT INTO public.weekly_stats (
    user_id, week_start, total_score, games_played, games_won,
    total_words, best_game_score, updated_at
  ) VALUES (
    p_user_id, current_week_start, p_bonus_points, 0, 0,
    0, p_bonus_points, NOW()
  )
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    total_score = weekly_stats.total_score + p_bonus_points,
    best_game_score = GREATEST(weekly_stats.best_game_score, p_bonus_points),
    updated_at = NOW();

  -- 3) monthly_stats (sadece puan)
  INSERT INTO public.monthly_stats (
    user_id, month_start, total_score, games_played, games_won,
    total_words, best_game_score, updated_at
  ) VALUES (
    p_user_id, current_month_start, p_bonus_points, 0, 0,
    0, p_bonus_points, NOW()
  )
  ON CONFLICT (user_id, month_start) DO UPDATE SET
    total_score = monthly_stats.total_score + p_bonus_points,
    best_game_score = GREATEST(monthly_stats.best_game_score, p_bonus_points),
    updated_at = NOW();
END;
$function$;

-- UTC döneme düşen mevcut kayıtları TR döneme taşı/merge et (hafta/ay sınırı farkı varsa)
DO $$
DECLARE
  v_tr_week DATE := DATE_TRUNC('week', NOW() AT TIME ZONE 'Europe/Istanbul')::DATE;
  v_utc_week DATE := DATE_TRUNC('week', NOW())::DATE;
  v_tr_month DATE := DATE_TRUNC('month', NOW() AT TIME ZONE 'Europe/Istanbul')::DATE;
  v_utc_month DATE := DATE_TRUNC('month', NOW())::DATE;
BEGIN
  IF v_tr_week <> v_utc_week THEN
    INSERT INTO public.weekly_stats (
      user_id, week_start, total_score, games_played, games_won, total_words, best_game_score, updated_at
    )
    SELECT
      ws.user_id,
      v_tr_week,
      COALESCE(ws.total_score, 0),
      COALESCE(ws.games_played, 0),
      COALESCE(ws.games_won, 0),
      COALESCE(ws.total_words, 0),
      COALESCE(ws.best_game_score, 0),
      NOW()
    FROM public.weekly_stats ws
    WHERE ws.week_start = v_utc_week
    ON CONFLICT (user_id, week_start) DO UPDATE SET
      total_score = COALESCE(public.weekly_stats.total_score, 0) + COALESCE(EXCLUDED.total_score, 0),
      games_played = COALESCE(public.weekly_stats.games_played, 0) + COALESCE(EXCLUDED.games_played, 0),
      games_won = COALESCE(public.weekly_stats.games_won, 0) + COALESCE(EXCLUDED.games_won, 0),
      total_words = COALESCE(public.weekly_stats.total_words, 0) + COALESCE(EXCLUDED.total_words, 0),
      best_game_score = GREATEST(COALESCE(public.weekly_stats.best_game_score, 0), COALESCE(EXCLUDED.best_game_score, 0)),
      updated_at = NOW();

    DELETE FROM public.weekly_stats
    WHERE week_start = v_utc_week;
  END IF;

  IF v_tr_month <> v_utc_month THEN
    INSERT INTO public.monthly_stats (
      user_id, month_start, total_score, games_played, games_won, total_words, best_game_score, updated_at
    )
    SELECT
      ms.user_id,
      v_tr_month,
      COALESCE(ms.total_score, 0),
      COALESCE(ms.games_played, 0),
      COALESCE(ms.games_won, 0),
      COALESCE(ms.total_words, 0),
      COALESCE(ms.best_game_score, 0),
      NOW()
    FROM public.monthly_stats ms
    WHERE ms.month_start = v_utc_month
    ON CONFLICT (user_id, month_start) DO UPDATE SET
      total_score = COALESCE(public.monthly_stats.total_score, 0) + COALESCE(EXCLUDED.total_score, 0),
      games_played = COALESCE(public.monthly_stats.games_played, 0) + COALESCE(EXCLUDED.games_played, 0),
      games_won = COALESCE(public.monthly_stats.games_won, 0) + COALESCE(EXCLUDED.games_won, 0),
      total_words = COALESCE(public.monthly_stats.total_words, 0) + COALESCE(EXCLUDED.total_words, 0),
      best_game_score = GREATEST(COALESCE(public.monthly_stats.best_game_score, 0), COALESCE(EXCLUDED.best_game_score, 0)),
      updated_at = NOW();

    DELETE FROM public.monthly_stats
    WHERE month_start = v_utc_month;
  END IF;
END $$;