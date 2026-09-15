-- Fix weekly leaderboard to work under RLS and add monthly leaderboard function
-- Both functions run as SECURITY DEFINER and set search_path to public

-- Weekly leaderboard
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(
  target_week_start date DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  username text,
  avatar_url text,
  weekly_score integer,
  games_played integer,
  games_won integer,
  rank_position integer,
  rank_change integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  week_start_date DATE;
  prev_week_start DATE;
BEGIN
  -- If no date provided, use current week (starting Monday)
  week_start_date := COALESCE(target_week_start, DATE_TRUNC('week', CURRENT_DATE)::DATE + 1);
  prev_week_start := week_start_date - INTERVAL '7 days';

  RETURN QUERY
  WITH current_week AS (
    SELECT 
      ws.user_id,
      p.username,
      p.avatar_url,
      ws.total_score AS total_score,
      ws.games_played AS games_played,
      ws.games_won AS games_won,
      ROW_NUMBER() OVER (ORDER BY ws.total_score DESC, ws.games_played DESC) AS current_rank
    FROM public.weekly_stats ws
    JOIN public.profiles p ON p.id = ws.user_id
    WHERE ws.week_start = week_start_date
  ),
  previous_week AS (
    SELECT 
      ws.user_id,
      ROW_NUMBER() OVER (ORDER BY ws.total_score DESC, ws.games_played DESC) AS prev_rank
    FROM public.weekly_stats ws
    WHERE ws.week_start = prev_week_start
  )
  SELECT 
    cw.user_id,
    cw.username,
    cw.avatar_url,
    cw.total_score::INTEGER AS weekly_score,
    cw.games_played::INTEGER AS games_played,
    cw.games_won::INTEGER AS games_won,
    cw.current_rank::INTEGER AS rank_position,
    COALESCE(pw.prev_rank::INTEGER - cw.current_rank::INTEGER, 0) AS rank_change
  FROM current_week cw
  LEFT JOIN previous_week pw ON pw.user_id = cw.user_id
  ORDER BY cw.current_rank;
END;
$$;

-- Monthly leaderboard
CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(
  target_month_start date DEFAULT NULL
)
RETURNS TABLE(
  user_id uuid,
  username text,
  avatar_url text,
  monthly_score integer,
  games_played integer,
  games_won integer,
  rank_position integer,
  rank_change integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  month_start_date DATE;
  prev_month_start DATE;
BEGIN
  -- If no date provided, use current month
  month_start_date := COALESCE(target_month_start, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  prev_month_start := (month_start_date - INTERVAL '1 month')::DATE;

  RETURN QUERY
  WITH current_month AS (
    SELECT 
      ms.user_id,
      p.username,
      p.avatar_url,
      ms.total_score AS total_score,
      ms.games_played AS games_played,
      ms.games_won AS games_won,
      ROW_NUMBER() OVER (ORDER BY ms.total_score DESC, ms.games_played DESC) AS current_rank
    FROM public.monthly_stats ms
    JOIN public.profiles p ON p.id = ms.user_id
    WHERE ms.month_start = month_start_date
  ),
  previous_month AS (
    SELECT 
      ms.user_id,
      ROW_NUMBER() OVER (ORDER BY ms.total_score DESC, ms.games_played DESC) AS prev_rank
    FROM public.monthly_stats ms
    WHERE ms.month_start = prev_month_start
  )
  SELECT 
    cm.user_id,
    cm.username,
    cm.avatar_url,
    cm.total_score::INTEGER AS monthly_score,
    cm.games_played::INTEGER AS games_played,
    cm.games_won::INTEGER AS games_won,
    cm.current_rank::INTEGER AS rank_position,
    COALESCE(pm.prev_rank::INTEGER - cm.current_rank::INTEGER, 0) AS rank_change
  FROM current_month cm
  LEFT JOIN previous_month pm ON pm.user_id = cm.user_id
  ORDER BY cm.current_rank;
END;
$$;