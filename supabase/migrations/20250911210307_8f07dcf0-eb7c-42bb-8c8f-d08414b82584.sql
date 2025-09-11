-- Rozet sistemini turnuva verileriyle çalışacak şekilde güncelle
CREATE OR REPLACE FUNCTION public.check_and_award_badges_simple(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  user_stats RECORD;
  badge_record RECORD;
BEGIN
  -- Kullanıcı istatistiklerini al
  SELECT 
    COALESCE(total_games, 0) as total_games,
    COALESCE(total_score, 0) as total_score,
    COALESCE(win_streak, 0) as win_streak,
    COALESCE(total_words_created, 0) as total_words_created,
    COALESCE(longest_word_length, 0) as longest_word_length,
    COALESCE(tournament_wins, 0) as tournament_wins
  INTO user_stats
  FROM profiles 
  WHERE id = p_user_id;
  
  -- Her badge'i kontrol et
  FOR badge_record IN 
    SELECT b.id, b.name, b.condition_type, b.condition_value
    FROM badges b
    WHERE b.id NOT IN (
      SELECT ub.badge_id 
      FROM user_badges ub 
      WHERE ub.user_id = p_user_id
    )
  LOOP
    -- Badge koşulunu kontrol et ve ver
    IF (badge_record.condition_type = 'total_games' AND user_stats.total_games >= badge_record.condition_value) OR
       (badge_record.condition_type = 'total_score' AND user_stats.total_score >= badge_record.condition_value) OR
       (badge_record.condition_type = 'win_streak' AND user_stats.win_streak >= badge_record.condition_value) OR
       (badge_record.condition_type = 'total_words' AND user_stats.total_words_created >= badge_record.condition_value) OR
       (badge_record.condition_type = 'longest_word' AND user_stats.longest_word_length >= badge_record.condition_value) OR
       (badge_record.condition_type = 'tournament_wins' AND user_stats.tournament_wins >= badge_record.condition_value) OR
       (badge_record.condition_type = 'tournaments_won' AND user_stats.tournament_wins >= badge_record.condition_value) THEN
       
      -- Badge'i ver
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (p_user_id, badge_record.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;