
CREATE OR REPLACE FUNCTION public.get_season_leaderboard(limit_count integer DEFAULT 50, season_start_date timestamp with time zone DEFAULT NULL)
RETURNS TABLE(
  user_id uuid,
  username text,
  avatar_url text,
  season_score bigint,
  games_played bigint,
  games_won bigint,
  rank_position bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH season_data AS (
    SELECT
      gs.user_id,
      SUM(gs.score) AS season_score,
      COUNT(*) AS games_played,
      SUM(CASE WHEN gs.is_winner THEN 1 ELSE 0 END) AS games_won
    FROM game_sessions gs
    WHERE gs.created_at >= COALESCE(season_start_date, 
      CASE 
        WHEN EXTRACT(MONTH FROM now()) < 5 THEN date_trunc('year', now())
        WHEN EXTRACT(MONTH FROM now()) < 9 THEN (date_trunc('year', now()) + interval '4 months')
        ELSE (date_trunc('year', now()) + interval '8 months')
      END
    )
    GROUP BY gs.user_id
  )
  SELECT
    sd.user_id,
    COALESCE(p.username, 'Anonim') AS username,
    p.avatar_url,
    sd.season_score,
    sd.games_played,
    sd.games_won,
    ROW_NUMBER() OVER (ORDER BY sd.season_score DESC) AS rank_position
  FROM season_data sd
  JOIN profiles p ON p.id = sd.user_id
  ORDER BY sd.season_score DESC
  LIMIT limit_count;
$$;
