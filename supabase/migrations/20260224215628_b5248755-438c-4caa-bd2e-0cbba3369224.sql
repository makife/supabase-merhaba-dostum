
CREATE OR REPLACE FUNCTION get_season_leaderboard(limit_count INTEGER DEFAULT 50, season_start_date TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  season_score BIGINT,
  games_played BIGINT,
  games_won BIGINT,
  rank_position BIGINT
) AS $$
DECLARE
  v_season_start DATE;
BEGIN
  -- Sezon başlangıç tarihini hesapla (Ocak-Nisan, Mayıs-Ağustos, Eylül-Aralık)
  IF season_start_date IS NOT NULL THEN
    v_season_start := season_start_date::DATE;
  ELSE
    v_season_start := CASE 
      WHEN EXTRACT(MONTH FROM now()) < 5 THEN date_trunc('year', now())::DATE
      WHEN EXTRACT(MONTH FROM now()) < 9 THEN (date_trunc('year', now()) + interval '4 months')::DATE
      ELSE (date_trunc('year', now()) + interval '8 months')::DATE
    END;
  END IF;

  RETURN QUERY
  WITH season_months AS (
    SELECT 
      ms.user_id AS uid,
      SUM(ms.total_score) AS total,
      SUM(ms.games_played) AS played,
      SUM(ms.games_won) AS won
    FROM public.monthly_stats ms
    WHERE ms.month_start >= v_season_start
      AND ms.total_score > 0
    GROUP BY ms.user_id
  )
  SELECT
    sm.uid AS user_id,
    COALESCE(p.username, 'Anonim')::TEXT AS username,
    p.avatar_url,
    sm.total AS season_score,
    sm.played AS games_played,
    sm.won AS games_won,
    ROW_NUMBER() OVER (ORDER BY sm.total DESC, sm.won DESC, sm.played ASC) AS rank_position
  FROM season_months sm
  JOIN public.profiles p ON p.id = sm.uid
  ORDER BY sm.total DESC, sm.won DESC, sm.played ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
