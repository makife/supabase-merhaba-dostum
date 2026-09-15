
-- Fix award_disconnect_bonus: bonus puan eklerken games_played/games_won artırmamalı
-- Bu fonksiyon kelime bazlı bonus puanlarda da çağrılıyor, bu yüzden oyun sayısı şişiyor
CREATE OR REPLACE FUNCTION public.award_disconnect_bonus(p_user_id UUID, p_bonus_points INTEGER)
RETURNS void
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
  
  -- 1. PROFILE GÜNCELLE (sadece puan, oyun sayısı DEĞİL)
  UPDATE public.profiles
  SET 
    total_score = COALESCE(total_score, 0) + p_bonus_points,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- 2. HAFTALIK TABLO GÜNCELLE (sadece puan, oyun sayısı DEĞİL)
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
  
  -- 3. AYLIK TABLO GÜNCELLE (sadece puan, oyun sayısı DEĞİL)
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
  
  RAISE NOTICE '✅ Bonus puan eklendi (oyun sayısı artırılmadı): user=%, bonus=%', p_user_id, p_bonus_points;
END;
$$;
