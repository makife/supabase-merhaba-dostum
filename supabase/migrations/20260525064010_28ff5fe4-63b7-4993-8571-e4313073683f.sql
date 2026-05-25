
-- ============================================================
-- 1) add_random_match_bot: rastgele eşleşmede bot fallback
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_random_match_bot(p_room_id uuid)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_room RECORD;
  v_participant_count INTEGER;
  v_countdown_start timestamptz;
BEGIN
  -- Odayı kilitle ve doğrula
  SELECT id, host_id, status, game_mode, countdown_started_at
  INTO v_room
  FROM public.game_rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.host_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only host can add bot';
  END IF;

  IF v_room.game_mode <> 'random-match' THEN
    RAISE EXCEPTION 'Bot only allowed for random-match';
  END IF;

  IF v_room.status <> 'waiting' THEN
    RAISE EXCEPTION 'Room is not waiting';
  END IF;

  IF v_room.countdown_started_at IS NOT NULL THEN
    -- Zaten başlamış
    RETURN v_room.countdown_started_at;
  END IF;

  -- Mevcut katılımcı sayısı
  SELECT COUNT(*) INTO v_participant_count
  FROM public.game_participants
  WHERE room_id = p_room_id;

  IF v_participant_count >= 2 THEN
    RAISE EXCEPTION 'Room already has 2 participants';
  END IF;

  -- Bot katılımcısını ekle
  INSERT INTO public.game_participants (room_id, user_id, score, is_bot)
  VALUES (p_room_id, NULL, 0, true);

  -- Geri sayımı başlat
  v_countdown_start := now();
  UPDATE public.game_rooms
  SET countdown_started_at = v_countdown_start
  WHERE id = p_room_id;

  RETURN v_countdown_start;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_random_match_bot(uuid) TO authenticated;


-- ============================================================
-- 2) update_game_stats_vs_bot: bot maçı için sade istatistik
--    (Liderlik tablolarını ve rank puanını etkilemez)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_game_stats_vs_bot(
  p_user_id uuid,
  p_score integer,
  p_is_winner boolean,
  p_words jsonb,
  p_first_word_time integer DEFAULT 0,
  p_game_duration integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  new_win_streak INTEGER;
  new_fastest_time INTEGER;
  v_final_score INTEGER;
  v_is_premium BOOLEAN;
  v_has_boost BOOLEAN;
  v_xp_multiplier NUMERIC;
  v_words_count INTEGER;
BEGIN
  v_words_count := COALESCE(jsonb_array_length(p_words), 0);

  SELECT
    total_score, total_games, wins, losses, win_streak,
    longest_word, longest_word_length, highest_word, highest_word_score,
    total_words_created, fastest_word_time,
    daily_games, daily_wins, best_streak, premium_until, score_boost_until,
    total_play_time
  INTO current_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_is_premium := (current_profile.premium_until IS NOT NULL AND current_profile.premium_until > NOW());
  v_has_boost := (current_profile.score_boost_until IS NOT NULL AND current_profile.score_boost_until > NOW());

  v_xp_multiplier := 1.0;
  IF v_is_premium THEN v_xp_multiplier := v_xp_multiplier + 1.0; END IF;
  IF v_has_boost THEN v_xp_multiplier := v_xp_multiplier + 1.0; END IF;

  v_final_score := FLOOR(COALESCE(p_score, 0) * v_xp_multiplier);

  new_longest_word := current_profile.longest_word;
  new_longest_length := COALESCE(current_profile.longest_word_length, 0);
  new_highest_word := current_profile.highest_word;
  new_highest_score := COALESCE(current_profile.highest_word_score, 0);
  new_total_words := COALESCE(current_profile.total_words_created, 0) + v_words_count;
  new_fastest_time := COALESCE(current_profile.fastest_word_time, 0);

  FOR word_obj IN SELECT * FROM jsonb_array_elements(COALESCE(p_words, '[]'::jsonb))
  LOOP
    word_text := word_obj->>'word';
    word_score := COALESCE((word_obj->>'score')::INTEGER, 0);
    word_length := LENGTH(COALESCE(word_text, ''));

    IF word_length > new_longest_length THEN
      new_longest_word := word_text;
      new_longest_length := word_length;
    END IF;

    IF word_score > new_highest_score THEN
      new_highest_word := word_text;
      new_highest_score := word_score;
    END IF;
  END LOOP;

  IF p_first_word_time IS NOT NULL AND p_first_word_time > 0 THEN
    IF new_fastest_time = 0 OR p_first_word_time < new_fastest_time THEN
      new_fastest_time := p_first_word_time;
    END IF;
  END IF;

  IF p_is_winner THEN
    new_win_streak := COALESCE(current_profile.win_streak, 0) + 1;
  ELSE
    new_win_streak := 0;
  END IF;

  UPDATE public.profiles
  SET
    total_score = COALESCE(total_score, 0) + v_final_score,
    total_games = COALESCE(total_games, 0) + 1,
    wins = CASE WHEN p_is_winner THEN COALESCE(wins, 0) + 1 ELSE COALESCE(wins, 0) END,
    losses = CASE WHEN NOT p_is_winner THEN COALESCE(losses, 0) + 1 ELSE COALESCE(losses, 0) END,
    win_streak = new_win_streak,
    best_streak = CASE WHEN new_win_streak > COALESCE(best_streak, 0) THEN new_win_streak ELSE COALESCE(best_streak, 0) END,
    longest_word = new_longest_word,
    longest_word_length = new_longest_length,
    highest_word = new_highest_word,
    highest_word_score = new_highest_score,
    total_words_created = new_total_words,
    fastest_word_time = new_fastest_time,
    daily_games = COALESCE(daily_games, 0) + 1,
    daily_wins = CASE WHEN p_is_winner THEN COALESCE(daily_wins, 0) + 1 ELSE COALESCE(daily_wins, 0) END,
    total_play_time = COALESCE(total_play_time, 0) + COALESCE(p_game_duration, 0),
    vs_bot_games = COALESCE(vs_bot_games, 0) + 1,
    updated_at = NOW()
  WHERE id = p_user_id;

  PERFORM public.check_and_award_badges_simple(p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_game_stats_vs_bot(uuid, integer, boolean, jsonb, integer, integer) TO authenticated;
