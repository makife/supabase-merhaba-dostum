
-- 1. Mevcut weekly_stats verilerini düzelt (Salı -> Pazartesi)
UPDATE weekly_stats 
SET week_start = week_start - INTERVAL '1 day'
WHERE EXTRACT(dow FROM week_start) = 2; -- Salı olanları düzelt

-- 2. update_game_stats fonksiyonunu düzelt (hafta başlangıcı hesaplaması)
CREATE OR REPLACE FUNCTION public.update_game_stats(
  p_user_id uuid, 
  p_score integer, 
  p_words jsonb, 
  p_game_duration integer DEFAULT NULL::integer, 
  p_is_winner boolean DEFAULT false, 
  p_first_word_time integer DEFAULT NULL::integer, 
  p_game_mode text DEFAULT 'vs-computer'::text
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
BEGIN
  -- Hafta ve ay başlangıçlarını hesapla (DÜZELTİLDİ: +1 kaldırıldı)
  current_week_start := DATE_TRUNC('week', NOW())::DATE;  -- Pazartesi (ISO week)
  current_month_start := DATE_TRUNC('month', NOW())::DATE;

  -- Get current profile stats
  SELECT 
    total_score, total_games, wins, losses, win_streak,
    longest_word, longest_word_length, highest_word, highest_word_score,
    total_words_created, average_word_length, average_score, fastest_word_time,
    daily_games, daily_wins, best_streak, username, avatar_url, premium_until
  INTO current_profile
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Premium kontrolü - Çift XP için
  v_is_premium := (current_profile.premium_until IS NOT NULL AND current_profile.premium_until > NOW());
  
  -- XP çarpanı: Premium ise 2x, değilse 1x
  IF v_is_premium THEN
    v_xp_multiplier := 2.0;
  ELSE
    v_xp_multiplier := 1.0;
  END IF;
  
  -- Final skor hesapla (premium için 2x)
  v_final_score := FLOOR(p_score * v_xp_multiplier);
  
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
  
  -- Calculate new average score (using final score with multiplier)
  new_average_score := (COALESCE(current_profile.total_score, 0) + v_final_score) / (COALESCE(current_profile.total_games, 0) + 1);
  
  -- Update profile with all statistics including daily stats (using final score with XP multiplier)
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
    vs_bot_games = CASE WHEN p_game_mode = 'vs-computer' THEN COALESCE(vs_bot_games, 0) + 1 ELSE COALESCE(vs_bot_games, 0) END,
    random_match_games = CASE WHEN p_game_mode = 'random-match' THEN COALESCE(random_match_games, 0) + 1 ELSE COALESCE(random_match_games, 0) END,
    private_room_games = CASE WHEN p_game_mode = 'private-room' THEN COALESCE(private_room_games, 0) + 1 ELSE COALESCE(private_room_games, 0) END,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Günlük liderlik tablosu güncelle (final score ile)
  PERFORM update_daily_leaderboard(
    p_user_id,
    v_final_score,
    v_username,
    v_avatar_url,
    new_highest_word,
    new_highest_score
  );

  -- Haftalık istatistikleri güncelle (final score ile)
  INSERT INTO public.weekly_stats (
    user_id, week_start, total_score, games_played, games_won, 
    total_words, best_game_score, updated_at
  ) VALUES (
    p_user_id, current_week_start, v_final_score, 1, 
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    jsonb_array_length(p_words), v_final_score, NOW()
  )
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    total_score = weekly_stats.total_score + v_final_score,
    games_played = weekly_stats.games_played + 1,
    games_won = weekly_stats.games_won + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    total_words = weekly_stats.total_words + jsonb_array_length(p_words),
    best_game_score = GREATEST(weekly_stats.best_game_score, v_final_score),
    updated_at = NOW();

  -- Aylık istatistikleri güncelle (final score ile)
  INSERT INTO public.monthly_stats (
    user_id, month_start, total_score, games_played, games_won, 
    total_words, best_game_score, updated_at
  ) VALUES (
    p_user_id, current_month_start, v_final_score, 1, 
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    jsonb_array_length(p_words), v_final_score, NOW()
  )
  ON CONFLICT (user_id, month_start) DO UPDATE SET
    total_score = monthly_stats.total_score + v_final_score,
    games_played = monthly_stats.games_played + 1,
    games_won = monthly_stats.games_won + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    total_words = monthly_stats.total_words + jsonb_array_length(p_words),
    best_game_score = GREATEST(monthly_stats.best_game_score, v_final_score),
    updated_at = NOW();
    
  -- Premium için log
  IF v_is_premium THEN
    RAISE NOTICE '⭐ VIP Çift XP: Oyuncu % için % puan -> % puan (2x)', p_user_id, p_score, v_final_score;
  END IF;
END;
$function$;

-- 3. get_weekly_leaderboard fonksiyonunu düzelt (tutarlı hafta hesaplaması)
DROP FUNCTION IF EXISTS get_weekly_leaderboard(integer);
DROP FUNCTION IF EXISTS get_weekly_leaderboard(date);
DROP FUNCTION IF EXISTS get_weekly_leaderboard();

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(limit_count integer DEFAULT 100)
RETURNS TABLE(
  user_id uuid, 
  username text, 
  avatar_url text, 
  weekly_score integer, 
  games_played integer, 
  games_won integer, 
  rank_position integer, 
  rank_change integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_week_start DATE;
  prev_week_start DATE;
BEGIN
  -- Mevcut haftanın başlangıcı (Pazartesi - ISO week)
  current_week_start := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  prev_week_start := current_week_start - INTERVAL '7 days';

  RETURN QUERY
  WITH current_week AS (
    SELECT 
      ws.user_id,
      p.username,
      p.avatar_url,
      ws.total_score,
      ws.games_played,
      ws.games_won,
      ROW_NUMBER() OVER (ORDER BY ws.total_score DESC, ws.games_won DESC, ws.games_played ASC) AS current_rank
    FROM public.weekly_stats ws
    JOIN public.profiles p ON p.id = ws.user_id
    WHERE ws.week_start = current_week_start
      AND ws.total_score > 0
  ),
  previous_week AS (
    SELECT 
      ws.user_id,
      ROW_NUMBER() OVER (ORDER BY ws.total_score DESC, ws.games_won DESC, ws.games_played ASC) AS prev_rank
    FROM public.weekly_stats ws
    WHERE ws.week_start = prev_week_start
      AND ws.total_score > 0
  )
  SELECT 
    cw.user_id,
    cw.username,
    cw.avatar_url,
    cw.total_score::INTEGER AS weekly_score,
    cw.games_played::INTEGER,
    cw.games_won::INTEGER,
    cw.current_rank::INTEGER AS rank_position,
    COALESCE(pw.prev_rank::INTEGER - cw.current_rank::INTEGER, 0) AS rank_change
  FROM current_week cw
  LEFT JOIN previous_week pw ON pw.user_id = cw.user_id
  ORDER BY cw.current_rank
  LIMIT limit_count;
END;
$function$;

-- 4. get_monthly_leaderboard fonksiyonunu düzelt
DROP FUNCTION IF EXISTS get_monthly_leaderboard(integer);
DROP FUNCTION IF EXISTS get_monthly_leaderboard(date);
DROP FUNCTION IF EXISTS get_monthly_leaderboard();

CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(limit_count integer DEFAULT 100)
RETURNS TABLE(
  user_id uuid, 
  username text, 
  avatar_url text, 
  monthly_score integer, 
  games_played integer, 
  games_won integer, 
  rank_position integer, 
  rank_change integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_month_start DATE;
  prev_month_start DATE;
BEGIN
  -- Mevcut ayın başlangıcı
  current_month_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  prev_month_start := (current_month_start - INTERVAL '1 month')::DATE;

  RETURN QUERY
  WITH current_month AS (
    SELECT 
      ms.user_id,
      p.username,
      p.avatar_url,
      ms.total_score,
      ms.games_played,
      ms.games_won,
      ROW_NUMBER() OVER (ORDER BY ms.total_score DESC, ms.games_won DESC, ms.games_played ASC) AS current_rank
    FROM public.monthly_stats ms
    JOIN public.profiles p ON p.id = ms.user_id
    WHERE ms.month_start = current_month_start
      AND ms.total_score > 0
  ),
  previous_month AS (
    SELECT 
      ms.user_id,
      ROW_NUMBER() OVER (ORDER BY ms.total_score DESC, ms.games_won DESC, ms.games_played ASC) AS prev_rank
    FROM public.monthly_stats ms
    WHERE ms.month_start = prev_month_start
      AND ms.total_score > 0
  )
  SELECT 
    cm.user_id,
    cm.username,
    cm.avatar_url,
    cm.total_score::INTEGER AS monthly_score,
    cm.games_played::INTEGER,
    cm.games_won::INTEGER,
    cm.current_rank::INTEGER AS rank_position,
    COALESCE(pm.prev_rank::INTEGER - cm.current_rank::INTEGER, 0) AS rank_change
  FROM current_month cm
  LEFT JOIN previous_month pm ON pm.user_id = cm.user_id
  ORDER BY cm.current_rank
  LIMIT limit_count;
END;
$function$;
