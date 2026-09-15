-- Update update_game_stats function to handle fastest_word_time
CREATE OR REPLACE FUNCTION public.update_game_stats(
  p_user_id UUID,
  p_score INTEGER,
  p_words JSONB,
  p_game_duration INTEGER DEFAULT NULL,
  p_is_winner BOOLEAN DEFAULT FALSE,
  p_first_word_time INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  word_obj JSONB;
  word_text TEXT;
  word_score INTEGER;
  word_length INTEGER;
  current_profile RECORD;
  new_longest_word TEXT;
  new_longest_length INTEGER;
  new_highest_word TEXT;
  new_highest_score INTEGER;
  new_total_words INTEGER;
  new_avg_length NUMERIC;
  new_win_streak INTEGER;
  new_average_score NUMERIC;
  new_fastest_time INTEGER;
BEGIN
  -- Get current profile stats
  SELECT 
    total_score, total_games, wins, losses, win_streak,
    longest_word, longest_word_length, highest_word, highest_word_score,
    total_words_created, average_word_length, average_score, fastest_word_time
  INTO current_profile
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Initialize variables with current values
  new_longest_word := current_profile.longest_word;
  new_longest_length := COALESCE(current_profile.longest_word_length, 0);
  new_highest_word := current_profile.highest_word;
  new_highest_score := COALESCE(current_profile.highest_word_score, 0);
  new_total_words := COALESCE(current_profile.total_words_created, 0);
  new_avg_length := COALESCE(current_profile.average_word_length, 0);
  new_fastest_time := COALESCE(current_profile.fastest_word_time, 0);
  
  -- Process each word
  FOR word_obj IN SELECT * FROM jsonb_array_elements(p_words)
  LOOP
    word_text := word_obj->>'word';
    word_score := (word_obj->>'score')::INTEGER;
    word_length := LENGTH(word_text);
    
    -- Update longest word
    IF word_length > new_longest_length THEN
      new_longest_word := word_text;
      new_longest_length := word_length;
    END IF;
    
    -- Update highest scoring word
    IF word_score > new_highest_score THEN
      new_highest_word := word_text;
      new_highest_score := word_score;
    END IF;
    
    new_total_words := new_total_words + 1;
  END LOOP;
  
  -- Update fastest word time (only if faster than current record or first time)
  IF p_first_word_time IS NOT NULL AND p_first_word_time > 0 THEN
    IF new_fastest_time = 0 OR p_first_word_time < new_fastest_time THEN
      new_fastest_time := p_first_word_time;
    END IF;
  END IF;
  
  -- Calculate new average word length
  IF new_total_words > 0 THEN
    SELECT AVG(LENGTH(word))::NUMERIC(4,2)
    INTO new_avg_length
    FROM public.game_history
    WHERE player_id = p_user_id;
  END IF;
  
  -- Calculate win streak
  IF p_is_winner THEN
    new_win_streak := COALESCE(current_profile.win_streak, 0) + 1;
  ELSE
    new_win_streak := 0;
  END IF;
  
  -- Calculate new average score
  new_average_score := (COALESCE(current_profile.total_score, 0) + p_score) / (COALESCE(current_profile.total_games, 0) + 1);
  
  -- Update profile with all statistics including fastest_word_time
  UPDATE public.profiles
  SET 
    total_score = COALESCE(current_profile.total_score, 0) + p_score,
    total_games = COALESCE(current_profile.total_games, 0) + 1,
    wins = CASE WHEN p_is_winner THEN COALESCE(current_profile.wins, 0) + 1 ELSE COALESCE(current_profile.wins, 0) END,
    losses = CASE WHEN NOT p_is_winner THEN COALESCE(current_profile.losses, 0) + 1 ELSE COALESCE(current_profile.losses, 0) END,
    win_streak = new_win_streak,
    longest_word = new_longest_word,
    longest_word_length = new_longest_length,
    highest_word = new_highest_word,
    highest_word_score = new_highest_score,
    total_words_created = new_total_words,
    average_word_length = new_avg_length,
    average_score = new_average_score,
    fastest_word_time = new_fastest_time,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;