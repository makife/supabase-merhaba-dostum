-- Add missing columns to profiles table for statistics tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS longest_word TEXT,
ADD COLUMN IF NOT EXISTS longest_word_length INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS highest_word_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS highest_word TEXT,
ADD COLUMN IF NOT EXISTS total_words_created INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_word_length NUMERIC(4,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fastest_word_time INTEGER DEFAULT 0;

-- Update existing data to have default values
UPDATE public.profiles 
SET 
  longest_word_length = COALESCE(longest_word_length, 0),
  highest_word_score = COALESCE(highest_word_score, 0),
  total_words_created = COALESCE(total_words_created, 0),
  average_word_length = COALESCE(average_word_length, 0),
  fastest_word_time = COALESCE(fastest_word_time, 0)
WHERE longest_word_length IS NULL 
   OR highest_word_score IS NULL 
   OR total_words_created IS NULL 
   OR average_word_length IS NULL 
   OR fastest_word_time IS NULL;

-- Create function to update game statistics
CREATE OR REPLACE FUNCTION public.update_game_statistics(
  p_user_id UUID,
  p_game_score INTEGER,
  p_words JSONB,
  p_is_winner BOOLEAN DEFAULT FALSE
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
BEGIN
  -- Get current profile stats
  SELECT 
    total_score, total_games, wins, losses, win_streak,
    longest_word, longest_word_length, highest_word, highest_word_score,
    total_words_created, average_word_length
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
  
  -- Process each word
  FOR word_obj IN SELECT * FROM jsonb_array_elements(p_words)
  LOOP
    word_text := word_obj->>'word';
    word_score := (word_obj->>'score')::INTEGER;
    word_length := LENGTH(word_text);
    
    -- Insert into game_history
    INSERT INTO public.game_history (player_id, word, score)
    VALUES (p_user_id, word_text, word_score);
    
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
  
  -- Update profile with all statistics
  UPDATE public.profiles
  SET 
    total_score = COALESCE(current_profile.total_score, 0) + p_game_score,
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
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;