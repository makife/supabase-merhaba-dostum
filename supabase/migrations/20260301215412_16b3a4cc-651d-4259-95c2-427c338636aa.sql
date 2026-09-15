
-- =====================================================
-- TÜM LEADERBOARD FONKSİYONLARINI TÜRKİYE SAATİNE (UTC+3) ÇEVİR
-- Böylece hafta/ay/sezon sınırları TR 00:00'da sıfırlanır
-- =====================================================

-- 1) update_game_stats: Puan yazarken week_start ve month_start'ı TR saatine göre hesapla
CREATE OR REPLACE FUNCTION public.update_game_stats(
  p_user_id UUID,
  p_score INTEGER,
  p_is_winner BOOLEAN,
  p_words JSONB,
  p_first_word_time INTEGER DEFAULT 0,
  p_game_mode TEXT DEFAULT 'vs-computer',
  p_bonus_points INTEGER DEFAULT 0
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
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
  v_total_with_bonus INTEGER;
  v_is_premium BOOLEAN;
  v_xp_multiplier NUMERIC;
  v_turkey_now TIMESTAMPTZ;
BEGIN
  -- 🇹🇷 Türkiye saati (UTC+3)
  v_turkey_now := NOW() AT TIME ZONE 'Europe/Istanbul';
  current_week_start := DATE_TRUNC('week', v_turkey_now)::DATE;
  current_month_start := DATE_TRUNC('month', v_turkey_now)::DATE;

  -- Get current profile stats
  SELECT 
    total_score, total_games, wins, losses, win_streak,
    longest_word, longest_word_length, highest_word, highest_word_score,
    total_words_created, average_word_length, average_score, fastest_word_time,
    daily_games, daily_wins, best_streak, username, avatar_url, premium_until
  INTO current_profile
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Premium kontrolü
  v_is_premium := (current_profile.premium_until IS NOT NULL AND current_profile.premium_until > NOW());
  
  IF v_is_premium THEN
    v_xp_multiplier := 2.0;
  ELSE
    v_xp_multiplier := 1.0;
  END IF;
  
  v_final_score := FLOOR(p_score * v_xp_multiplier);
  v_total_with_bonus := v_final_score + COALESCE(p_bonus_points, 0);
  
  -- Initialize variables
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
  
  -- Update fastest word time
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
  new_average_score := (COALESCE(current_profile.total_score, 0) + v_total_with_bonus) / (COALESCE(current_profile.total_games, 0) + 1);
  
  -- PROFILE GÜNCELLE
  UPDATE public.profiles
  SET 
    total_score = COALESCE(current_profile.total_score, 0) + v_total_with_bonus,
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

  -- Günlük liderlik tablosu güncelle
  PERFORM update_daily_leaderboard(
    p_user_id,
    v_total_with_bonus,
    v_username,
    v_avatar_url,
    new_highest_word,
    new_highest_score
  );

  -- HAFTALIK İSTATİSTİKLER (TR saatine göre week_start)
  INSERT INTO public.weekly_stats (
    user_id, week_start, total_score, games_played, games_won, 
    total_words, best_game_score, updated_at
  ) VALUES (
    p_user_id, current_week_start, v_total_with_bonus, 1, 
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    jsonb_array_length(p_words), v_total_with_bonus, NOW()
  )
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    total_score = weekly_stats.total_score + v_total_with_bonus,
    games_played = weekly_stats.games_played + 1,
    games_won = weekly_stats.games_won + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    total_words = weekly_stats.total_words + jsonb_array_length(p_words),
    best_game_score = GREATEST(weekly_stats.best_game_score, v_total_with_bonus),
    updated_at = NOW();

  -- AYLIK İSTATİSTİKLER (TR saatine göre month_start)
  INSERT INTO public.monthly_stats (
    user_id, month_start, total_score, games_played, games_won, 
    total_words, best_game_score, updated_at
  ) VALUES (
    p_user_id, current_month_start, v_total_with_bonus, 1, 
    CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    jsonb_array_length(p_words), v_total_with_bonus, NOW()
  )
  ON CONFLICT (user_id, month_start) DO UPDATE SET
    total_score = monthly_stats.total_score + v_total_with_bonus,
    games_played = monthly_stats.games_played + 1,
    games_won = monthly_stats.games_won + CASE WHEN p_is_winner THEN 1 ELSE 0 END,
    total_words = monthly_stats.total_words + jsonb_array_length(p_words),
    best_game_score = GREATEST(monthly_stats.best_game_score, v_total_with_bonus),
    updated_at = NOW();

  -- Rozet kontrolü
  PERFORM check_and_award_badges_simple(p_user_id);
    
  IF p_bonus_points > 0 THEN
    RAISE NOTICE '🎯 BONUS PUANLAR DAHİL: Oyuncu % için oyun puanı=%, bonus=%, toplam=%', 
      p_user_id, v_final_score, p_bonus_points, v_total_with_bonus;
  END IF;
  
  IF v_is_premium THEN
    RAISE NOTICE '⭐ VIP Çift XP: Oyuncu % için % puan -> % puan (2x)', p_user_id, p_score, v_final_score;
  END IF;
END;
$$;

-- 2) increment_weekly_score: TR saatine göre week_start hesapla
CREATE OR REPLACE FUNCTION public.increment_weekly_score(
  p_user_id UUID,
  p_week_start DATE,
  p_amount INTEGER
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.weekly_stats (user_id, week_start, total_score, updated_at)
  VALUES (p_user_id, p_week_start, p_amount, NOW())
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    total_score = weekly_stats.total_score + p_amount,
    updated_at = NOW();
END;
$$;

-- 3) get_weekly_leaderboard: TR saatine göre hafta hesapla
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(limit_count INTEGER DEFAULT 100)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  weekly_score INTEGER,
  games_played INTEGER,
  games_won INTEGER,
  rank_position INTEGER,
  rank_change INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_week_start DATE;
  prev_week_start DATE;
  v_turkey_now TIMESTAMP;
BEGIN
  -- 🇹🇷 Türkiye saatine göre hafta başlangıcı
  v_turkey_now := NOW() AT TIME ZONE 'Europe/Istanbul';
  current_week_start := DATE_TRUNC('week', v_turkey_now)::DATE;
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
$$;

-- 4) get_monthly_leaderboard: TR saatine göre ay hesapla
CREATE OR REPLACE FUNCTION public.get_monthly_leaderboard(limit_count INTEGER DEFAULT 100)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  monthly_score INTEGER,
  games_played INTEGER,
  games_won INTEGER,
  rank_position INTEGER,
  rank_change INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_month_start DATE;
  prev_month_start DATE;
  v_turkey_now TIMESTAMP;
BEGIN
  -- 🇹🇷 Türkiye saatine göre ay başlangıcı
  v_turkey_now := NOW() AT TIME ZONE 'Europe/Istanbul';
  current_month_start := DATE_TRUNC('month', v_turkey_now)::DATE;
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
$$;

-- 5) get_season_leaderboard: TR saatine göre sezon hesapla
CREATE OR REPLACE FUNCTION public.get_season_leaderboard(
  limit_count INTEGER DEFAULT 100,
  season_start_date TEXT DEFAULT NULL
)
RETURNS TABLE(
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  season_score BIGINT,
  games_played BIGINT,
  games_won BIGINT,
  rank_position BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_season_start DATE;
  v_turkey_now TIMESTAMP;
  v_turkey_month INTEGER;
BEGIN
  -- 🇹🇷 Türkiye saatine göre sezon hesapla
  v_turkey_now := NOW() AT TIME ZONE 'Europe/Istanbul';
  v_turkey_month := EXTRACT(MONTH FROM v_turkey_now);

  IF season_start_date IS NOT NULL THEN
    v_season_start := season_start_date::DATE;
  ELSE
    v_season_start := CASE 
      WHEN v_turkey_month < 5 THEN DATE_TRUNC('year', v_turkey_now)::DATE
      WHEN v_turkey_month < 9 THEN (DATE_TRUNC('year', v_turkey_now) + interval '4 months')::DATE
      ELSE (DATE_TRUNC('year', v_turkey_now) + interval '8 months')::DATE
    END;
  END IF;

  RETURN QUERY
  WITH season_months AS (
    SELECT 
      ms.user_id AS uid,
      SUM(ms.total_score) AS total,
      SUM(ms.games_played) AS played,
      SUM(ms.games_won) AS won
    FROM public.monthly_stats ms
    WHERE ms.month_start >= v_season_start
      AND ms.total_score > 0
    GROUP BY ms.user_id
  )
  SELECT
    sm.uid AS user_id,
    COALESCE(p.username, 'Anonim')::TEXT AS username,
    p.avatar_url,
    sm.total AS season_score,
    sm.played AS games_played,
    sm.won AS games_won,
    ROW_NUMBER() OVER (ORDER BY sm.total DESC, sm.won DESC, sm.played ASC) AS rank_position
  FROM season_months sm
  JOIN public.profiles p ON p.id = sm.uid
  ORDER BY sm.total DESC, sm.won DESC, sm.played ASC
  LIMIT limit_count;
END;
$$;
