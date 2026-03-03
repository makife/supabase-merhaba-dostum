CREATE OR REPLACE FUNCTION public.update_game_stats(
  p_user_id uuid,
  p_score integer,
  p_words jsonb,
  p_is_winner boolean,
  p_game_duration integer DEFAULT 0,
  p_first_word_time integer DEFAULT NULL::integer,
  p_game_mode text DEFAULT 'vs-computer'::text,
  p_bonus_points integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  current_week_start DATE;
  current_month_start DATE;
  v_final_score INTEGER;
  v_is_premium BOOLEAN;
  v_xp_multiplier NUMERIC;
  v_turkey_now TIMESTAMP;
BEGIN
  v_turkey_now := NOW() AT TIME ZONE 'Europe/Istanbul';
  current_week_start := DATE_TRUNC('week', v_turkey_now)::DATE;
  current_month_start := DATE_TRUNC('month', v_turkey_now)::DATE;

  SELECT
    total_score, total_games, wins, losses, win_streak,
    longest_word, longest_word_length, highest_word, highest_word_score,
    total_words_created, average_word_length, average_score, fastest_word_time,
    daily_games, daily_wins, best_streak, username, avatar_url, premium_until,
    total_play_time
  INTO current_profile
  FROM public.profiles
  WHERE id = p_user_id;

  v_is_premium := (current_profile.premium_until IS NOT NULL AND current_profile.premium_until > NOW());

  IF v_is_premium THEN
    v_xp_multiplier := 2.0;
  ELSE
    v_xp_multiplier := 1.0;
  END IF;

  v_final_score := FLOOR(p_score * v_xp_multiplier);

  new_longest_word := current_profile.longest_word;
  new_longest_length := COALESCE(current_profile.longest_word_length, 0);
  new_highest_word := current_profile.highest_word;
  new_highest_score := COALESCE(current_profile.highest_word_score, 0);
  new_total_words := COALESCE(current_profile.total_words_created, 0);
  new_avg_length := COALESCE(current_profile.average_word_length, 0);
  new_fastest_time := COALESCE(current_profile.fastest_word_time, 0);
  v_username := current_profile.username;
  v_avatar_url := current_profile.avatar_url;

  FOR word_obj IN SELECT * FROM jsonb_array_elements(p_words)
  LOOP
    word_text := word_obj->>'word';
    word_score := (word_obj->>'score')::INTEGER;
    word_length := LENGTH(word_text);

    IF word_length > new_longest_length THEN
      new_longest_word := word_text;
      new_longest_length := word_length;
    END IF;

    IF word_score > new_highest_score THEN
      new_highest_word := word_text;
      new_highest_score := word_score;
    END IF;

    new_total_words := new_total_words + 1;
  END LOOP;

  IF p_first_word_time IS NOT NULL AND p_first_word_time > 0 THEN
    IF new_fastest_time = 0 OR p_first_word_time < new_fastest_time THEN
      new_fastest_time := p_first_word_time;
    END IF;
  END IF;

  IF new_total_words > 0 THEN
    SELECT AVG(LENGTH(word))::NUMERIC(4,2)
    INTO new_avg_length
    FROM public.game_history
    WHERE player_id = p_user_id;
  END IF;

  IF p_is_winner THEN
    new_win_streak := COALESCE(current_profile.win_streak, 0) + 1;
  ELSE
    new_win_streak := 0;
  END IF;

  new_average_score := (COALESCE(current_profile.total_score, 0) + v_final_score) / (COALESCE(current_profile.total_games, 0) + 1);

  UPDATE public.profiles
  SET
    total_score = COALESCE(current_profile.total_score, 0) + v_final_score,
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
    daily_games = COALESCE(current_profile.daily_games, 0) + 1,
    daily_wins = CASE WHEN p_is_winner THEN COALESCE(current_profile.daily_wins, 0) + 1 ELSE COALESCE(current_profile.daily_wins, 0) END,
    total_play_time = COALESCE(current_profile.total_play_time, 0) + p_game_duration,
    updated_at = NOW()
  WHERE id = p_user_id;

  INSERT INTO public.weekly_stats (user_id, week_start, total_score, games_played, games_won, total_words, avg_score, best_game_score)
  VALUES (
    p_user_id,
    current_week_start,
    v_final_score,
    1,
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    jsonb_array_length(p_words),
    v_final_score,
    v_final_score
  )
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    total_score = weekly_stats.total_score + v_final_score,
    games_played = weekly_stats.games_played + 1,
    games_won = weekly_stats.games_won + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    total_words = weekly_stats.total_words + jsonb_array_length(p_words),
    avg_score = (weekly_stats.total_score + v_final_score) / (weekly_stats.games_played + 1),
    best_game_score = GREATEST(weekly_stats.best_game_score, v_final_score),
    updated_at = NOW();

  INSERT INTO public.monthly_stats (user_id, month_start, total_score, games_played, games_won, total_words, avg_score, best_game_score)
  VALUES (
    p_user_id,
    current_month_start,
    v_final_score,
    1,
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    jsonb_array_length(p_words),
    v_final_score,
    v_final_score
  )
  ON CONFLICT (user_id, month_start) DO UPDATE SET
    total_score = monthly_stats.total_score + v_final_score,
    games_played = monthly_stats.games_played + 1,
    games_won = monthly_stats.games_won + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    total_words = monthly_stats.total_words + jsonb_array_length(p_words),
    avg_score = (monthly_stats.total_score + v_final_score) / (monthly_stats.games_played + 1),
    best_game_score = GREATEST(monthly_stats.best_game_score, v_final_score),
    updated_at = NOW();

  INSERT INTO public.daily_leaderboard (user_id, username, avatar_url, daily_score, games_played, best_word, best_word_score, date)
  VALUES (
    p_user_id,
    v_username,
    v_avatar_url,
    v_final_score,
    1,
    new_highest_word,
    new_highest_score,
    (v_turkey_now::DATE)
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    daily_score = daily_leaderboard.daily_score + v_final_score,
    games_played = daily_leaderboard.games_played + 1,
    best_word = CASE WHEN v_final_score > daily_leaderboard.best_word_score THEN new_highest_word ELSE daily_leaderboard.best_word END,
    best_word_score = GREATEST(daily_leaderboard.best_word_score, new_highest_score),
    username = v_username,
    avatar_url = v_avatar_url,
    updated_at = NOW();
END;
$function$;