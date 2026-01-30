-- ============================================
-- SECURITY FIX #4: Remaining Functions Search Path
-- ============================================

-- notify_global_chat_insert
CREATE OR REPLACE FUNCTION public.notify_global_chat_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  PERFORM pg_notify(
    'supabase_realtime',
    json_build_object(
      'schema', 'public',
      'table', 'global_chat',
      'event', 'INSERT',
      'new', row_to_json(NEW)
    )::text
  );
  RETURN NEW;
END;
$function$;

-- notify_private_message_insert
CREATE OR REPLACE FUNCTION public.notify_private_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  PERFORM pg_notify(
    'supabase_realtime',
    json_build_object(
      'schema', 'public',
      'table', 'private_messages',
      'event', 'INSERT',
      'new', row_to_json(NEW)
    )::text
  );
  RETURN NEW;
END;
$function$;

-- notify_private_message_update
CREATE OR REPLACE FUNCTION public.notify_private_message_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  PERFORM pg_notify(
    'supabase_realtime', 
    json_build_object(
      'schema', 'public',
      'table', 'private_messages',
      'event', 'UPDATE',
      'new', row_to_json(NEW),
      'old', row_to_json(OLD)
    )::text
  );
  RETURN NEW;
END;
$function$;

-- generate_random_grid
CREATE OR REPLACE FUNCTION public.generate_random_grid()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  letters TEXT[] := ARRAY[
    'A','A','A','A','A','A','A','A',
    'E','E','E','E','E','E','E',
    'İ','İ','İ','İ','İ','İ',
    'I','I','I','I','I',
    'O','O','O','O','O',
    'U','U','U','U',
    'L','L','L','L','L',
    'N','N','N','N','N',
    'R','R','R','R','R',
    'K','K','K','K',
    'M','M','M','M',
    'T','T','T','T',
    'S','S','S','S',
    'D','D','D',
    'Y','Y','Y',
    'B','B','B',
    'C','C','Ç','Ç',
    'F','F','G','G',
    'Ğ','Ğ','H','H',
    'J','P','P',
    'Ş','Ş','V','V',
    'Z','Ü','Ü','Ü',
    'Ö','Ö','Ö'
  ];
  grid JSONB := '[]'::JSONB;
  i INTEGER;
BEGIN
  FOR i IN 1..16 LOOP
    grid := grid || to_jsonb(letters[1 + random() * (array_length(letters, 1) - 1)]);
  END LOOP;
  
  RETURN grid;
END;
$function$;

-- get_frequent_disconnectors
CREATE OR REPLACE FUNCTION public.get_frequent_disconnectors(limit_count integer DEFAULT 10)
RETURNS TABLE(user_id uuid, username text, disconnect_count integer, win_count integer, disconnect_ratio double precision)
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.disconnect_count,
    p.win_count,
    CASE 
      WHEN (p.win_count + p.disconnect_count) > 0 
      THEN p.disconnect_count::FLOAT / (p.win_count + p.disconnect_count)::FLOAT
      ELSE 0
    END as disconnect_ratio
  FROM profiles p
  WHERE p.disconnect_count >= limit_count
  ORDER BY p.disconnect_count DESC, disconnect_ratio DESC;
END;
$function$;

-- cleanup_expired_rematch_requests
CREATE OR REPLACE FUNCTION public.cleanup_expired_rematch_requests()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  DELETE FROM rematch_requests
  WHERE expires_at < NOW() AND status = 'pending';
END;
$function$;

-- update_user_stats
CREATE OR REPLACE FUNCTION public.update_user_stats()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  current_week_start DATE;
  current_month_start DATE;
BEGIN
  current_week_start := DATE_TRUNC('week', NEW.created_at)::DATE + 1;
  current_month_start := DATE_TRUNC('month', NEW.created_at)::DATE;
  
  INSERT INTO weekly_stats (
    user_id, week_start, total_score, games_played, games_won, 
    total_words, best_game_score, updated_at
  ) VALUES (
    NEW.user_id, current_week_start, NEW.score, 1, 
    CASE WHEN NEW.is_winner THEN 1 ELSE 0 END,
    NEW.words_count, NEW.score, NOW()
  )
  ON CONFLICT (user_id, week_start) DO UPDATE SET
    total_score = weekly_stats.total_score + NEW.score,
    games_played = weekly_stats.games_played + 1,
    games_won = weekly_stats.games_won + CASE WHEN NEW.is_winner THEN 1 ELSE 0 END,
    total_words = weekly_stats.total_words + NEW.words_count,
    best_game_score = GREATEST(weekly_stats.best_game_score, NEW.score),
    avg_score = ROUND((weekly_stats.total_score + NEW.score)::DECIMAL / (weekly_stats.games_played + 1), 2),
    updated_at = NOW();
  
  INSERT INTO monthly_stats (
    user_id, month_start, total_score, games_played, games_won, 
    total_words, best_game_score, updated_at
  ) VALUES (
    NEW.user_id, current_month_start, NEW.score, 1, 
    CASE WHEN NEW.is_winner THEN 1 ELSE 0 END,
    NEW.words_count, NEW.score, NOW()
  )
  ON CONFLICT (user_id, month_start) DO UPDATE SET
    total_score = monthly_stats.total_score + NEW.score,
    games_played = monthly_stats.games_played + 1,
    games_won = monthly_stats.games_won + CASE WHEN NEW.is_winner THEN 1 ELSE 0 END,
    total_words = monthly_stats.total_words + NEW.words_count,
    best_game_score = GREATEST(monthly_stats.best_game_score, NEW.score),
    avg_score = ROUND((monthly_stats.total_score + NEW.score)::DECIMAL / (monthly_stats.games_played + 1), 2),
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;

-- send_mention_notification
CREATE OR REPLACE FUNCTION public.send_mention_notification(p_receiver_id uuid, p_sender_username text, p_message text, p_message_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    message,
    is_read,
    related_id,
    created_at
  ) VALUES (
    p_receiver_id,
    'mention',
    p_sender_username || ' seni bir mesajda etiketledi: "' || substring(p_message, 1, 50) || '..."',
    false,
    p_message_id,
    NOW()
  );
  
  RETURN TRUE;
EXCEPTION 
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$function$;

-- send_game_invite_notification
CREATE OR REPLACE FUNCTION public.send_game_invite_notification(p_receiver_id uuid, p_sender_username text, p_room_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO notifications (
    user_id,
    type,
    message,
    is_read,
    related_id,
    created_at
  ) VALUES (
    p_receiver_id,
    'invite',
    p_sender_username || ' sana oyun daveti gönderdi',
    false,
    p_room_code,
    NOW()
  );
  
  RETURN TRUE;
EXCEPTION 
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$function$;

-- create_notification
CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_message text, p_related_id text DEFAULT NULL::text)
RETURNS notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_row public.notifications;
BEGIN
  INSERT INTO public.notifications (user_id, type, message, related_id, is_read)
  VALUES (p_user_id, p_type, p_message, p_related_id, false)
  RETURNING * INTO new_row;
  RETURN new_row;
END;
$function$;

-- start_game_countdown
CREATE OR REPLACE FUNCTION public.start_game_countdown(p_room_id uuid)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    v_countdown_time timestamptz;
BEGIN
    v_countdown_time := NOW() + interval '3 seconds';
    
    UPDATE game_rooms 
    SET 
        countdown_started_at = v_countdown_time,
        status = 'active',
        updated_at = NOW()
    WHERE id = p_room_id;
    
    RETURN v_countdown_time;
END;
$function$;

-- test_game_completion
CREATE OR REPLACE FUNCTION public.test_game_completion(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM update_game_stats(
    p_user_id,
    120,
    '[
      {"word": "DENEME", "score": 50},
      {"word": "TEST", "score": 40},
      {"word": "OYUN", "score": 30}
    ]'::jsonb,
    true,
    120
  );
  
  RAISE NOTICE 'Test oyunu tamamlandı!';
END;
$function$;

-- calculate_profile_stats
CREATE OR REPLACE FUNCTION public.calculate_profile_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  total_games_count INTEGER;
  total_wins_count INTEGER;
  total_score_sum INTEGER;
  longest_word_data RECORD;
  fastest_time INTEGER;
  current_streak_count INTEGER;
  best_streak_count INTEGER;
  total_words_count INTEGER;
  avg_score NUMERIC;
  daily_games_today INTEGER;
  daily_wins_today INTEGER;
  favorite_letter_data TEXT;
  total_play_time_mins INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_games_count
  FROM game_participants gp
  JOIN game_rooms gr ON gr.id = gp.room_id
  WHERE gp.user_id = p_user_id AND gr.status = 'finished';

  SELECT COUNT(*) INTO total_wins_count
  FROM game_rooms gr
  WHERE (gr.player1_id = p_user_id OR gr.player2_id = p_user_id)
  AND gr.winner_id = p_user_id
  AND gr.status = 'finished';

  SELECT COALESCE(SUM(gw.points), 0) INTO total_score_sum
  FROM game_words gw
  WHERE gw.player_id = p_user_id;

  SELECT word, LENGTH(word) as word_length INTO longest_word_data
  FROM game_words gw
  WHERE gw.player_id = p_user_id
  ORDER BY LENGTH(word) DESC, points DESC
  LIMIT 1;

  SELECT COUNT(*) INTO total_words_count
  FROM game_words gw
  WHERE gw.player_id = p_user_id;

  SELECT CASE 
    WHEN total_games_count > 0 THEN total_score_sum::NUMERIC / total_games_count 
    ELSE 0 
  END INTO avg_score;

  SELECT COALESCE(games_played, 0), COALESCE(games_won, 0) 
  INTO daily_games_today, daily_wins_today
  FROM daily_stats 
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  current_streak_count := 0;
  best_streak_count := 0;
  favorite_letter_data := '';
  total_play_time_mins := 0;

  UPDATE profiles SET
    total_games = total_games_count,
    wins = total_wins_count,
    losses = total_games_count - total_wins_count,
    total_score = total_score_sum,
    longest_word = COALESCE(longest_word_data.word, ''),
    longest_word_length = COALESCE(longest_word_data.word_length, 0),
    total_words_created = total_words_count,
    average_word_length = CASE 
      WHEN total_words_count > 0 
      THEN (SELECT AVG(LENGTH(word)) FROM game_words WHERE player_id = p_user_id)
      ELSE 0 
    END,
    win_streak = current_streak_count,
    best_streak = best_streak_count,
    daily_games = daily_games_today,
    daily_wins = daily_wins_today,
    average_score = avg_score,
    total_words = total_words_count,
    favorite_letter = favorite_letter_data,
    total_play_time = total_play_time_mins,
    updated_at = now()
  WHERE id = p_user_id;
END;
$function$;

-- update_profile_stats_on_game_completion
CREATE OR REPLACE FUNCTION public.update_profile_stats_on_game_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    words_array JSONB;
    word_obj JSONB;
    total_words INTEGER := 0;
    total_score INTEGER := 0;
    longest_word TEXT := '';
    longest_length INTEGER := 0;
    best_word_score INTEGER := 0;
    best_word TEXT := '';
    is_winner BOOLEAN := FALSE;
BEGIN
    IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
        is_winner := (NEW.winner_id = NEW.player1_id);
        
        IF NEW.player1_id IS NOT NULL THEN
            SELECT 
                COALESCE(COUNT(gw.word), 0),
                COALESCE(SUM(gw.points), 0),
                COALESCE(MAX(LENGTH(gw.word)), 0),
                COALESCE(MAX(gw.points), 0)
            INTO total_words, total_score, longest_length, best_word_score
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id;
            
            IF longest_length > 0 THEN
                SELECT gw.word INTO longest_word
                FROM game_words gw 
                WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id 
                AND LENGTH(gw.word) = longest_length
                LIMIT 1;
            END IF;
            
            IF best_word_score > 0 THEN
                SELECT gw.word INTO best_word
                FROM game_words gw 
                WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id 
                AND gw.points = best_word_score
                LIMIT 1;
            END IF;
            
            UPDATE profiles SET
                total_games = COALESCE(total_games, 0) + 1,
                total_score = COALESCE(total_score, 0) + total_score,
                wins = CASE WHEN is_winner THEN COALESCE(wins, 0) + 1 ELSE COALESCE(wins, 0) END,
                losses = CASE WHEN NOT is_winner THEN COALESCE(losses, 0) + 1 ELSE COALESCE(losses, 0) END,
                win_streak = CASE WHEN is_winner THEN COALESCE(win_streak, 0) + 1 ELSE 0 END,
                total_words_created = COALESCE(total_words_created, 0) + total_words,
                longest_word = CASE 
                    WHEN longest_length > COALESCE(longest_word_length, 0) 
                    THEN longest_word 
                    ELSE profiles.longest_word 
                END,
                longest_word_length = CASE 
                    WHEN longest_length > COALESCE(longest_word_length, 0) 
                    THEN longest_length 
                    ELSE COALESCE(longest_word_length, 0) 
                END,
                highest_word = CASE 
                    WHEN best_word_score > COALESCE(highest_word_score, 0) 
                    THEN best_word 
                    ELSE profiles.highest_word 
                END,
                highest_word_score = CASE 
                    WHEN best_word_score > COALESCE(highest_word_score, 0) 
                    THEN best_word_score 
                    ELSE COALESCE(highest_word_score, 0) 
                END,
                updated_at = NOW()
            WHERE id = NEW.player1_id;
        END IF;
        
        IF NEW.player2_id IS NOT NULL THEN
            is_winner := (NEW.winner_id = NEW.player2_id);
            
            SELECT 
                COALESCE(COUNT(gw.word), 0),
                COALESCE(SUM(gw.points), 0),
                COALESCE(MAX(LENGTH(gw.word)), 0),
                COALESCE(MAX(gw.points), 0)
            INTO total_words, total_score, longest_length, best_word_score
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player2_id;
            
            IF longest_length > 0 THEN
                SELECT gw.word INTO longest_word
                FROM game_words gw 
                WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player2_id 
                AND LENGTH(gw.word) = longest_length
                LIMIT 1;
            END IF;
            
            IF best_word_score > 0 THEN
                SELECT gw.word INTO best_word
                FROM game_words gw 
                WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player2_id 
                AND gw.points = best_word_score
                LIMIT 1;
            END IF;
            
            UPDATE profiles SET
                total_games = COALESCE(total_games, 0) + 1,
                total_score = COALESCE(total_score, 0) + total_score,
                wins = CASE WHEN is_winner THEN COALESCE(wins, 0) + 1 ELSE COALESCE(wins, 0) END,
                losses = CASE WHEN NOT is_winner THEN COALESCE(losses, 0) + 1 ELSE COALESCE(losses, 0) END,
                win_streak = CASE WHEN is_winner THEN COALESCE(win_streak, 0) + 1 ELSE 0 END,
                total_words_created = COALESCE(total_words_created, 0) + total_words,
                longest_word = CASE 
                    WHEN longest_length > COALESCE(longest_word_length, 0) 
                    THEN longest_word 
                    ELSE profiles.longest_word 
                END,
                longest_word_length = CASE 
                    WHEN longest_length > COALESCE(longest_word_length, 0) 
                    THEN longest_length 
                    ELSE COALESCE(longest_word_length, 0) 
                END,
                highest_word = CASE 
                    WHEN best_word_score > COALESCE(highest_word_score, 0) 
                    THEN best_word 
                    ELSE profiles.highest_word 
                END,
                highest_word_score = CASE 
                    WHEN best_word_score > COALESCE(highest_word_score, 0) 
                    THEN best_word_score 
                    ELSE COALESCE(highest_word_score, 0) 
                END,
                updated_at = NOW()
            WHERE id = NEW.player2_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;