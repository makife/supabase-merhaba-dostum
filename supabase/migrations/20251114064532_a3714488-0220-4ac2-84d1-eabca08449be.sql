-- Önce yeni fonksiyon ekle: daily/weekly/monthly leaderboard güncellemesi
CREATE OR REPLACE FUNCTION public.update_daily_leaderboard(
  p_user_id UUID,
  p_game_score INTEGER,
  p_username TEXT,
  p_avatar_url TEXT,
  p_best_word TEXT DEFAULT NULL,
  p_best_word_score INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Günlük liderlik tablosunu güncelle veya ekle (bugünün tarihi için)
  INSERT INTO public.daily_leaderboard (
    user_id,
    username,
    avatar_url,
    date,
    daily_score,
    games_played,
    best_word,
    best_word_score
  ) VALUES (
    p_user_id,
    p_username,
    p_avatar_url,
    CURRENT_DATE,
    p_game_score,
    1,
    p_best_word,
    p_best_word_score
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    daily_score = public.daily_leaderboard.daily_score + p_game_score,
    games_played = public.daily_leaderboard.games_played + 1,
    best_word = CASE 
      WHEN p_best_word_score > COALESCE(public.daily_leaderboard.best_word_score, 0) 
      THEN p_best_word 
      ELSE public.daily_leaderboard.best_word 
    END,
    best_word_score = CASE 
      WHEN p_best_word_score > COALESCE(public.daily_leaderboard.best_word_score, 0) 
      THEN p_best_word_score 
      ELSE public.daily_leaderboard.best_word_score 
    END,
    updated_at = NOW();
END;
$$;

-- update_game_stats fonksiyonunu güncelle - game_mode parametresi ve daily_leaderboard güncellemesi ekle
CREATE OR REPLACE FUNCTION public.update_game_stats(
  p_user_id UUID,
  p_score INTEGER,
  p_words JSONB,
  p_game_duration INTEGER DEFAULT NULL,
  p_is_winner BOOLEAN DEFAULT FALSE,
  p_first_word_time INTEGER DEFAULT NULL,
  p_game_mode TEXT DEFAULT 'vs-computer'
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
  v_username TEXT;
  v_avatar_url TEXT;
BEGIN
  -- Get current profile stats
  SELECT 
    total_score, total_games, wins, losses, win_streak,
    longest_word, longest_word_length, highest_word, highest_word_score,
    total_words_created, average_word_length, average_score, fastest_word_time,
    daily_games, daily_wins, best_streak, username, avatar_url
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
  v_username := current_profile.username;
  v_avatar_url := current_profile.avatar_url;
  
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
  
  -- Update profile with all statistics including daily stats
  UPDATE public.profiles
  SET 
    total_score = COALESCE(current_profile.total_score, 0) + p_score,
    total_games = COALESCE(current_profile.total_games, 0) + 1,
    wins = CASE WHEN p_is_winner THEN COALESCE(current_profile.wins, 0) + 1 ELSE COALESCE(current_profile.wins, 0) END,
    losses = CASE WHEN NOT p_is_winner THEN COALESCE(current_profile.losses, 0) + 1 ELSE COALESCE(current_profile.losses, 0) END,
    win_streak = new_win_streak,
    best_streak = CASE WHEN new_win_streak > COALESCE(current_profile.best_streak, 0) THEN new_win_streak ELSE COALESCE(current_profile.best_streak, 0) END,
    longest_word = new_longest_word,
    longest_word_length = new_longest_length,
    highest_word = new_highest_word,
    highest_word_score = new_highest_score,
    total_words_created = new_total_words,
    average_word_length = new_avg_length,
    average_score = new_average_score,
    fastest_word_time = new_fastest_time,
    -- Günlük istatistikler
    daily_games = COALESCE(current_profile.daily_games, 0) + 1,
    daily_wins = CASE WHEN p_is_winner THEN COALESCE(current_profile.daily_wins, 0) + 1 ELSE COALESCE(current_profile.daily_wins, 0) END,
    -- Oyun moduna göre sayaçları güncelle
    vs_bot_games = CASE WHEN p_game_mode = 'vs-computer' THEN COALESCE(vs_bot_games, 0) + 1 ELSE COALESCE(vs_bot_games, 0) END,
    random_match_games = CASE WHEN p_game_mode = 'random-match' THEN COALESCE(random_match_games, 0) + 1 ELSE COALESCE(random_match_games, 0) END,
    private_room_games = CASE WHEN p_game_mode = 'private-room' THEN COALESCE(private_room_games, 0) + 1 ELSE COALESCE(private_room_games, 0) END,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- 🎯 TÜM OYUN MODLARI İÇİN daily_leaderboard güncelle
  PERFORM update_daily_leaderboard(
    p_user_id,
    p_score,
    v_username,
    v_avatar_url,
    new_highest_word,
    new_highest_score
  );

  -- 🎯 Haftalık istatistik güncelleme (weekly_stats tablosu varsa)
  -- Bu fonksiyon henüz yok ama ileride eklenebilir

  -- 🎯 Aylık istatistik güncelleme (monthly_stats)
  INSERT INTO public.monthly_stats (
    user_id,
    month_start,
    total_score,
    games_played,
    games_won,
    total_words
  ) VALUES (
    p_user_id,
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    p_score,
    1,
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    jsonb_array_length(p_words)
  )
  ON CONFLICT (user_id, month_start)
  DO UPDATE SET
    total_score = public.monthly_stats.total_score + p_score,
    games_played = public.monthly_stats.games_played + 1,
    games_won = public.monthly_stats.games_won + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    total_words = public.monthly_stats.total_words + jsonb_array_length(p_words),
    updated_at = NOW();
END;
$$;