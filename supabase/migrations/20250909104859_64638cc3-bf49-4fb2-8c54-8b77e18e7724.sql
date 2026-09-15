-- Aylık liderlik tablosu için RPC fonksiyonu
CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(target_month_start date DEFAULT NULL::date)
 RETURNS TABLE(user_id uuid, username text, avatar_url text, monthly_score integer, games_played integer, games_won integer, rank_position integer, rank_change integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  month_start_date DATE;
  prev_month_start DATE;
BEGIN
  -- Eğer tarih verilmemişse, bu ayı kullan
  month_start_date := COALESCE(target_month_start, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  prev_month_start := month_start_date - INTERVAL '1 month';
  
  RETURN QUERY
  WITH current_month AS (
    SELECT 
      ms.user_id,
      p.username,
      p.avatar_url,
      ms.total_score,
      ms.games_played,
      ms.games_won,
      ROW_NUMBER() OVER (ORDER BY ms.total_score DESC, ms.games_played DESC) as current_rank
    FROM monthly_stats ms
    JOIN profiles p ON ms.user_id = p.id
    WHERE ms.month_start = month_start_date
  ),
  previous_month AS (
    SELECT 
      ms.user_id,
      ROW_NUMBER() OVER (ORDER BY ms.total_score DESC, ms.games_played DESC) as prev_rank
    FROM monthly_stats ms
    WHERE ms.month_start = prev_month_start
  )
  SELECT 
    cm.user_id,
    cm.username,
    cm.avatar_url,
    cm.total_score::INTEGER,
    cm.games_played::INTEGER,
    cm.games_won::INTEGER,
    cm.current_rank::INTEGER,
    COALESCE(pm.prev_rank::INTEGER - cm.current_rank::INTEGER, 0) as rank_change
  FROM current_month cm
  LEFT JOIN previous_month pm ON cm.user_id = pm.user_id
  ORDER BY cm.current_rank;
END;
$function$;