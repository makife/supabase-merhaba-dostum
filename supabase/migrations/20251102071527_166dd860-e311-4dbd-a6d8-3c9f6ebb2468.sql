-- Weekly and Monthly Leaderboard RPCs built from daily_stats with SECURITY DEFINER
-- These functions aggregate scores while bypassing RLS safely

-- WEEKLY
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
WITH week_start AS (
  SELECT date_trunc('week', timezone('utc', now()))::date AS start_date
),
weekly AS (
  SELECT ds.user_id,
         COALESCE(SUM(ds.total_score),0)::int AS weekly_score,
         COALESCE(SUM(ds.games_played),0)::int AS games_played,
         COALESCE(SUM(ds.games_won),0)::int AS games_won
    FROM daily_stats ds, week_start ws
   WHERE ds.date >= ws.start_date
   GROUP BY ds.user_id
),
ranked AS (
  SELECT w.*,
         ROW_NUMBER() OVER (ORDER BY w.weekly_score DESC, w.games_won DESC, w.games_played DESC) AS rank_position
  FROM weekly w
)
SELECT r.user_id,
       p.username,
       p.avatar_url,
       r.weekly_score,
       r.games_played,
       r.games_won,
       r.rank_position,
       0::int as rank_change
FROM ranked r
LEFT JOIN profiles p ON p.id = r.user_id
ORDER BY r.rank_position
LIMIT limit_count;
$$;

-- MONTHLY
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
WITH month_start AS (
  SELECT date_trunc('month', timezone('utc', now()))::date AS start_date
),
monthly AS (
  SELECT ds.user_id,
         COALESCE(SUM(ds.total_score),0)::int AS monthly_score,
         COALESCE(SUM(ds.games_played),0)::int AS games_played,
         COALESCE(SUM(ds.games_won),0)::int AS games_won
    FROM daily_stats ds, month_start ms
   WHERE ds.date >= ms.start_date
   GROUP BY ds.user_id
),
ranked AS (
  SELECT m.*,
         ROW_NUMBER() OVER (ORDER BY m.monthly_score DESC, m.games_won DESC, m.games_played DESC) AS rank_position
  FROM monthly m
)
SELECT r.user_id,
       p.username,
       p.avatar_url,
       r.monthly_score,
       r.games_played,
       r.games_won,
       r.rank_position,
       0::int as rank_change
FROM ranked r
LEFT JOIN profiles p ON p.id = r.user_id
ORDER BY r.rank_position
LIMIT limit_count;
$$;

-- Ensure execution permissions for client roles
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_leaderboard(integer) TO anon, authenticated;