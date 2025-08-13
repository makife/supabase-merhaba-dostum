-- Add more badges for a complete badge system
INSERT INTO public.badges (name, description, icon, condition_type, condition_value) VALUES
('Hızlı Başlangıç', 'İlk 5 dakikada oyuna başladınız', '🚀', 'quick_start', 1),
('Kelime Kahramanı', 'Tek oyunda 10 kelime yaptınız', '🦸', 'words_per_game', 10),
('Puan Kralı', '5000 puan topladınız', '👑', 'total_score', 5000),
('Süper Seri', '5 oyun üst üste kazandınız', '🔥', 'win_streak', 5),
('Kelime Makinesi', 'Toplam 500 kelime oluşturdunuz', '⚙️', 'total_words', 500),
('Uzun Kelime Ustası', '8 harfli kelime yaptınız', '📏', 'longest_word', 8),
('Çok Oyuncu', '500 oyun tamamladınız', '🎮', 'total_games', 500),
('Efsane Oyuncu', '10000 puan topladınız', '🏆', 'total_score', 10000),
('Hız Şampiyonu', '5 saniyede kelime yaptınız', '⚡', 'fast_typing', 5),
('Kelime Tanrısı', '1000 oyun tamamladınız', '🌟', 'total_games', 1000);

-- Create function to check and award badges
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id UUID)
RETURNS TABLE(new_badge_id UUID, new_badge_name TEXT, new_badge_icon TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  badge_record RECORD;
  user_stats RECORD;
  badge_earned BOOLEAN;
BEGIN
  -- Get user statistics
  SELECT 
    total_games, 
    total_score, 
    win_streak, 
    total_words_created,
    longest_word_length,
    fastest_word_time
  INTO user_stats
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Check each badge
  FOR badge_record IN 
    SELECT id, name, icon, condition_type, condition_value
    FROM public.badges
    WHERE id NOT IN (
      SELECT badge_id 
      FROM public.user_badges 
      WHERE user_id = p_user_id
    )
  LOOP
    badge_earned := FALSE;
    
    -- Check badge conditions
    CASE badge_record.condition_type
      WHEN 'total_games' THEN
        badge_earned := COALESCE(user_stats.total_games, 0) >= badge_record.condition_value;
      WHEN 'total_score' THEN
        badge_earned := COALESCE(user_stats.total_score, 0) >= badge_record.condition_value;
      WHEN 'win_streak' THEN
        badge_earned := COALESCE(user_stats.win_streak, 0) >= badge_record.condition_value;
      WHEN 'total_words' THEN
        badge_earned := COALESCE(user_stats.total_words_created, 0) >= badge_record.condition_value;
      WHEN 'longest_word' THEN
        badge_earned := COALESCE(user_stats.longest_word_length, 0) >= badge_record.condition_value;
      WHEN 'fast_typing' THEN
        badge_earned := COALESCE(user_stats.fastest_word_time, 999) <= badge_record.condition_value AND COALESCE(user_stats.fastest_word_time, 0) > 0;
      WHEN 'quick_start' THEN
        badge_earned := user_stats.total_games >= 1; -- Simple condition for quick start
      WHEN 'words_per_game' THEN
        -- This needs to be checked per game, we'll handle it separately
        badge_earned := FALSE;
      WHEN 'tournament_wins' THEN
        -- Will be implemented when tournament system is active
        badge_earned := FALSE;
    END CASE;
    
    -- Award badge if earned
    IF badge_earned THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (p_user_id, badge_record.id);
      
      -- Return the new badge info
      new_badge_id := badge_record.id;
      new_badge_name := badge_record.name;
      new_badge_icon := badge_record.icon;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- Create function to check words per game badge specifically
CREATE OR REPLACE FUNCTION public.check_words_per_game_badge(p_user_id UUID, p_words_count INTEGER)
RETURNS TABLE(new_badge_id UUID, new_badge_name TEXT, new_badge_icon TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  badge_record RECORD;
BEGIN
  -- Check for words per game badge
  SELECT id, name, icon, condition_value
  INTO badge_record
  FROM public.badges
  WHERE condition_type = 'words_per_game'
    AND id NOT IN (
      SELECT badge_id 
      FROM public.user_badges 
      WHERE user_id = p_user_id
    );
  
  -- Award badge if earned
  IF FOUND AND p_words_count >= badge_record.condition_value THEN
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (p_user_id, badge_record.id);
    
    new_badge_id := badge_record.id;
    new_badge_name := badge_record.name;
    new_badge_icon := badge_record.icon;
    RETURN NEXT;
  END IF;
END;
$$;