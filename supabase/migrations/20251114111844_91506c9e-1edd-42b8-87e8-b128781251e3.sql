-- Drop existing functions and recreate with fixed schema
DROP FUNCTION IF EXISTS public.get_weekly_leaderboard(integer);
DROP FUNCTION IF EXISTS public.get_monthly_leaderboard(integer);

-- Create weekly leaderboard function sourcing from weekly_stats table
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(limit_count integer DEFAULT 100)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  weekly_score integer,
  games_played integer,
  games_won integer,
  rank_position integer,
  rank_change integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH latest_week AS (
  SELECT MAX(week_start) AS week_start FROM public.weekly_stats
),
current_period AS (
  SELECT ws.user_id, ws.total_score, ws.games_played, ws.games_won
  FROM public.weekly_stats ws
  JOIN latest_week lw ON ws.week_start = lw.week_start
),
current_ranked AS (
  SELECT
    c.user_id,
    c.total_score,
    c.games_played,
    c.games_won,
    DENSE_RANK() OVER (ORDER BY c.total_score DESC, c.games_won DESC, c.games_played ASC) AS rank_position
  FROM current_period c
),
prev_week AS (
  SELECT MAX(week_start) AS week_start
  FROM public.weekly_stats
  WHERE week_start < (SELECT week_start FROM latest_week)
),
previous_ranked AS (
  SELECT
    ws.user_id,
    DENSE_RANK() OVER (ORDER BY ws.total_score DESC, ws.games_won DESC, ws.games_played ASC) AS prev_rank
  FROM public.weekly_stats ws
  JOIN prev_week pw ON ws.week_start = pw.week_start
)
SELECT
  cr.user_id,
  p.username,
  p.avatar_url,
  cr.total_score::int AS weekly_score,
  cr.games_played,
  cr.games_won,
  cr.rank_position,
  COALESCE(previous_ranked.prev_rank - cr.rank_position, 0) AS rank_change
FROM current_ranked cr
LEFT JOIN previous_ranked ON previous_ranked.user_id = cr.user_id
LEFT JOIN public.profiles p ON p.id = cr.user_id
ORDER BY weekly_score DESC, games_won DESC, games_played ASC
LIMIT limit_count;
$$;

-- Create monthly leaderboard function sourcing from monthly_stats table
CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(limit_count integer DEFAULT 100)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  monthly_score integer,
  games_played integer,
  games_won integer,
  rank_position integer,
  rank_change integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH latest_month AS (
  SELECT MAX(month_start) AS month_start FROM public.monthly_stats
),
current_period AS (
  SELECT ms.user_id, ms.total_score, ms.games_played, ms.games_won
  FROM public.monthly_stats ms
  JOIN latest_month lm ON ms.month_start = lm.month_start
),
current_ranked AS (
  SELECT
    c.user_id,
    c.total_score,
    c.games_played,
    c.games_won,
    DENSE_RANK() OVER (ORDER BY c.total_score DESC, c.games_won DESC, c.games_played ASC) AS rank_position
  FROM current_period c
),
prev_month AS (
  SELECT MAX(month_start) AS month_start
  FROM public.monthly_stats
  WHERE month_start < (SELECT month_start FROM latest_month)
),
previous_ranked AS (
  SELECT
    ms.user_id,
    DENSE_RANK() OVER (ORDER BY ms.total_score DESC, ms.games_won DESC, ms.games_played ASC) AS prev_rank
  FROM public.monthly_stats ms
  JOIN prev_month pm ON ms.month_start = pm.month_start
)
SELECT
  cr.user_id,
  p.username,
  p.avatar_url,
  cr.total_score::int AS monthly_score,
  cr.games_played,
  cr.games_won,
  cr.rank_position,
  COALESCE(previous_ranked.prev_rank - cr.rank_position, 0) AS rank_change
FROM current_ranked cr
LEFT JOIN previous_ranked ON previous_ranked.user_id = cr.user_id
LEFT JOIN public.profiles p ON p.id = cr.user_id
ORDER BY monthly_score DESC, games_won DESC, games_played ASC
LIMIT limit_count;
$$;