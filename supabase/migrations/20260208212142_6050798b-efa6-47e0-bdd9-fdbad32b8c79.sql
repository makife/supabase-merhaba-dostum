-- Disconnect/ayrılma bonuslarını TÜM tablolara atomik şekilde ekleyen fonksiyon
CREATE OR REPLACE FUNCTION public.award_disconnect_bonus(
  p_user_id UUID,
  p_bonus_points INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_week_start DATE;
  current_month_start DATE;
BEGIN
  -- Hafta ve ay başlangıçlarını hesapla
  current_week_start := DATE_TRUNC('week', NOW())::DATE;
  current_month_start := DATE_TRUNC('month', NOW())::DATE;
  
  -- 1. PROFILE GÜNCELLE
  UPDATE public.profiles
  SET 
    total_score = COALESCE(total_score, 0) + p_bonus_points,
    win_count = COALESCE(win_count, 0) + 1,
    last_win = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- 2. HAFTALIK TABLO GÜNCELLE
  INSERT INTO public.weekly_stats (
    user_id, week_start, total_score, games_played, games_won, 
    total_words, best_game_score, updated_at
  ) VALUES (
    p_user_id, current_week_start, p_bonus_points, 1, 1,
    0, p_bonus_points, NOW()
  )
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    total_score = weekly_stats.total_score + p_bonus_points,
    games_played = weekly_stats.games_played + 1,
    games_won = weekly_stats.games_won + 1,
    updated_at = NOW();
  
  -- 3. AYLIK TABLO GÜNCELLE
  INSERT INTO public.monthly_stats (
    user_id, month_start, total_score, games_played, games_won, 
    total_words, best_game_score, updated_at
  ) VALUES (
    p_user_id, current_month_start, p_bonus_points, 1, 1,
    0, p_bonus_points, NOW()
  )
  ON CONFLICT (user_id, month_start) DO UPDATE SET
    total_score = monthly_stats.total_score + p_bonus_points,
    games_played = monthly_stats.games_played + 1,
    games_won = monthly_stats.games_won + 1,
    updated_at = NOW();
  
  RAISE NOTICE '✅ Disconnect bonus eklendi: user=%, bonus=%', p_user_id, p_bonus_points;
END;
$$;

-- Hayda kullanıcısının puanlarını senkronize et (330 puan fark)
UPDATE weekly_stats 
SET total_score = 3888, updated_at = now()
WHERE user_id = (SELECT id FROM profiles WHERE username = 'Hayda');

UPDATE monthly_stats 
SET total_score = 3888, updated_at = now()
WHERE user_id = (SELECT id FROM profiles WHERE username = 'Hayda');