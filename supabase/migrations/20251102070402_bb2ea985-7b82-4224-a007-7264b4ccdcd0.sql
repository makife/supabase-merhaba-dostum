-- Haftalık ve aylık liderlik tablosu RPC fonksiyonlarını oluştur

-- Haftalık liderlik tablosu fonksiyonu
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard()
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  weekly_score integer,
  games_played integer,
  games_won integer,
  rank_position bigint,
  rank_change integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_week_start date;
BEGIN
  -- Haftanın başlangıcı (Pazartesi)
  current_week_start := date_trunc('week', CURRENT_DATE)::date;
  
  RETURN QUERY
  SELECT 
    ws.user_id,
    p.username,
    p.avatar_url,
    ws.total_score::integer as weekly_score,
    ws.games_played::integer,
    ws.games_won::integer,
    ROW_NUMBER() OVER (ORDER BY ws.total_score DESC, ws.games_won DESC) as rank_position,
    0 as rank_change -- Şimdilik rank değişimi 0
  FROM weekly_stats ws
  INNER JOIN profiles p ON p.id = ws.user_id
  WHERE ws.week_start = current_week_start
    AND ws.total_score > 0
  ORDER BY ws.total_score DESC, ws.games_won DESC
  LIMIT 100;
END;
$$;

-- Aylık liderlik tablosu fonksiyonu
CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard()
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  monthly_score integer,
  games_played integer,
  games_won integer,
  rank_position bigint,
  rank_change integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month_start date;
BEGIN
  -- Ayın başlangıcı
  current_month_start := date_trunc('month', CURRENT_DATE)::date;
  
  RETURN QUERY
  SELECT 
    ms.user_id,
    p.username,
    p.avatar_url,
    ms.total_score::integer as monthly_score,
    ms.games_played::integer,
    ms.games_won::integer,
    ROW_NUMBER() OVER (ORDER BY ms.total_score DESC, ms.games_won DESC) as rank_position,
    0 as rank_change -- Şimdilik rank değişimi 0
  FROM monthly_stats ms
  INNER JOIN profiles p ON p.id = ms.user_id
  WHERE ms.month_start = current_month_start
    AND ms.total_score > 0
  ORDER BY ms.total_score DESC, ms.games_won DESC
  LIMIT 100;
END;
$$;