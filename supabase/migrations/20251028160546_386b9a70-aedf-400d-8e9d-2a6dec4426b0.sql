-- ============================================
-- SECURITY FIX #1: RLS Policies for banned_words
-- ============================================

-- Adminler banned_words ekleyip silebilir
CREATE POLICY "Admins can manage banned words"
ON public.banned_words
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Moderatörler banned_words'leri görebilir
CREATE POLICY "Moderators can view banned words"
ON public.banned_words
FOR SELECT
USING (
  has_role(auth.uid(), 'moderator'::app_role) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- ============================================
-- SECURITY FIX #2: RLS Policies for player_activities
-- ============================================

-- Kullanıcılar kendi aktivitelerini görebilir
CREATE POLICY "Users can view their own activities"
ON public.player_activities
FOR SELECT
USING (auth.uid() = player_id);

-- Sistem tüm aktiviteleri yönetebilir
CREATE POLICY "System can manage all activities"
ON public.player_activities
FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- SECURITY FIX #3: Function Search Path - SQL Injection Prevention
-- ============================================

-- check_memory_game_cooldown
CREATE OR REPLACE FUNCTION public.check_memory_game_cooldown(p_user_id uuid, p_hours_ago integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  play_count integer;
BEGIN
  SELECT COUNT(*)
  INTO play_count
  FROM memory_game_plays
  WHERE user_id = p_user_id
    AND played_at >= (NOW() - INTERVAL '1 hour' * p_hours_ago);
  
  RETURN play_count;
END;
$function$;

-- save_memory_game_play
CREATE OR REPLACE FUNCTION public.save_memory_game_play(p_user_id uuid, p_moves integer, p_joker_given text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO memory_game_plays (user_id, moves, joker_given, played_at)
  VALUES (p_user_id, p_moves, p_joker_given, NOW());
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$function$;

-- check_report_rate_limit
CREATE OR REPLACE FUNCTION public.check_report_rate_limit(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  report_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM public.message_reports
  WHERE reporter_id = p_user_id
  AND created_at > NOW() - INTERVAL '1 hour';
  
  RETURN report_count < 10;
END;
$function$;

-- calculate_average_word_length
CREATE OR REPLACE FUNCTION public.calculate_average_word_length(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    avg_length NUMERIC;
BEGIN
    SELECT AVG(LENGTH(word))::NUMERIC(4,2)
    INTO avg_length
    FROM game_history
    WHERE player_id = p_user_id;
    
    RETURN COALESCE(avg_length, 0);
END;
$function$;

-- recalculate_user_stats
CREATE OR REPLACE FUNCTION public.recalculate_user_stats(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    stats_record RECORD;
BEGIN
    SELECT 
        COUNT(DISTINCT gr.id) as total_games,
        COUNT(CASE WHEN gr.winner_id = p_user_id THEN 1 END) as wins,
        COUNT(CASE WHEN gr.winner_id != p_user_id AND gr.winner_id IS NOT NULL THEN 1 END) as losses,
        COALESCE(SUM(CASE WHEN gw.player_id = p_user_id THEN gw.points ELSE 0 END), 0) as total_score,
        COUNT(CASE WHEN gw.player_id = p_user_id THEN 1 END) as total_words,
        COALESCE(MAX(CASE WHEN gw.player_id = p_user_id THEN LENGTH(gw.word) ELSE 0 END), 0) as longest_length,
        COALESCE(MAX(CASE WHEN gw.player_id = p_user_id THEN gw.points ELSE 0 END), 0) as highest_score
    INTO stats_record
    FROM game_rooms gr
    LEFT JOIN game_words gw ON gw.room_id = gr.id
    WHERE (gr.player1_id = p_user_id OR gr.player2_id = p_user_id)
    AND gr.status = 'finished';
    
    DECLARE
        longest_word_text TEXT;
        highest_word_text TEXT;
        avg_length NUMERIC;
    BEGIN
        SELECT gw.word INTO longest_word_text
        FROM game_words gw
        JOIN game_rooms gr ON gr.id = gw.room_id
        WHERE gw.player_id = p_user_id 
        AND LENGTH(gw.word) = stats_record.longest_length
        LIMIT 1;
        
        SELECT gw.word INTO highest_word_text
        FROM game_words gw
        JOIN game_rooms gr ON gr.id = gw.room_id
        WHERE gw.player_id = p_user_id 
        AND gw.points = stats_record.highest_score
        LIMIT 1;
        
        SELECT calculate_average_word_length(p_user_id) INTO avg_length;
        
        UPDATE profiles SET
            total_games = stats_record.total_games,
            wins = stats_record.wins,
            losses = stats_record.losses,
            total_score = stats_record.total_score,
            total_words_created = stats_record.total_words,
            longest_word = longest_word_text,
            longest_word_length = stats_record.longest_length,
            highest_word = highest_word_text,
            highest_word_score = stats_record.highest_score,
            average_word_length = avg_length,
            updated_at = NOW()
        WHERE id = p_user_id;
    END;
END;
$function$;

-- get_room_participants
CREATE OR REPLACE FUNCTION public.get_room_participants(room_id uuid)
RETURNS TABLE(user_id uuid, is_bot boolean, score integer, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    gp.user_id,
    gp.is_bot, 
    gp.score,
    gp.created_at
  FROM game_participants gp
  WHERE gp.room_id = get_room_participants.room_id;
END;
$function$;

-- get_room_participants_with_profiles
CREATE OR REPLACE FUNCTION public.get_room_participants_with_profiles(room_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'user_id', gp.user_id,
      'is_bot', gp.is_bot,
      'score', gp.score,
      'created_at', gp.created_at,
      'profiles', CASE 
        WHEN gp.is_bot THEN NULL
        ELSE json_build_object(
          'username', p.username,
          'avatar_url', p.avatar_url
        )
      END
    )
  )
  INTO result
  FROM game_participants gp
  LEFT JOIN profiles p ON gp.user_id = p.id AND NOT gp.is_bot
  WHERE gp.room_id = get_room_participants_with_profiles.room_id;
  
  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- moderate_message_advanced
CREATE OR REPLACE FUNCTION public.moderate_message_advanced(p_user_id uuid, p_message text)
RETURNS TABLE(is_appropriate boolean, reason text, should_ban boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  banned_words TEXT[] := ARRAY[
    'orospu', 'piç', 'amcık', 'yarrak', 'siktir', 'götün', 'amına', 'sikim', 
    'sikeyim', 'götüne', 'fuck', 'shit', 'bitch', 'asshole'
  ];
  mild_words TEXT[] := ARRAY[
    'amk', 'amq', 'oç', 'sik', 'aptal', 'salak', 'gerizekalı', 'mal'
  ];
  word TEXT;
  lower_message TEXT := LOWER(TRIM(p_message));
  word_count INTEGER;
  banned_word_count INTEGER := 0;
  mild_word_count INTEGER := 0;
BEGIN
  word_count := array_length(string_to_array(lower_message, ' '), 1);
  
  IF word_count = 1 AND length(lower_message) <= 10 THEN
    FOREACH word IN ARRAY banned_words
    LOOP
      IF lower_message = word THEN
        RETURN QUERY SELECT false, 'Ağır küfür: ' || word, true;
        RETURN;
      END IF;
    END LOOP;
    
    FOREACH word IN ARRAY mild_words
    LOOP
      IF lower_message = word THEN
        RETURN QUERY SELECT false, 'Uygunsuz kelime: ' || word, false;
        RETURN;
      END IF;
    END LOOP;
  ELSE
    FOREACH word IN ARRAY banned_words
    LOOP
      IF lower_message LIKE '%' || word || '%' THEN
        banned_word_count := banned_word_count + 1;
      END IF;
    END LOOP;
    
    FOREACH word IN ARRAY mild_words
    LOOP
      IF lower_message LIKE '%' || word || '%' THEN
        mild_word_count := mild_word_count + 1;
      END IF;
    END LOOP;
    
    IF banned_word_count > 0 THEN
      RETURN QUERY SELECT false, 'Ağır küfür tespit edildi', true;
      RETURN;
    ELSIF mild_word_count > 2 THEN
      RETURN QUERY SELECT false, 'Çoklu uygunsuz kelime', true;
      RETURN;
    ELSIF mild_word_count > 0 THEN
      RETURN QUERY SELECT false, 'Uygunsuz kelime tespit edildi', false;
      RETURN;
    END IF;
  END IF;
  
  RETURN QUERY SELECT true, 'Mesaj uygun'::TEXT, false;
END;
$function$;

-- moderate_message_simple
CREATE OR REPLACE FUNCTION public.moderate_message_simple(p_user_id uuid, p_message text)
RETURNS TABLE(is_appropriate boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  banned_words TEXT[] := ARRAY[
    'amk', 'amq', 'oç', 'orospu', 'piç', 'sik', 'götün', 'anan', 'sikim', 
    'sikeyim', 'götüne', 'amına', 'fuck', 'shit', 'bitch', 'asshole',
    'aptal', 'salak', 'gerizekalı', 'mal'
  ];
  word TEXT;
  lower_message TEXT := LOWER(p_message);
BEGIN
  FOREACH word IN ARRAY banned_words
  LOOP
    IF lower_message LIKE '%' || word || '%' THEN
      RETURN QUERY SELECT false, 'Yasaklı kelime: ' || word;
      RETURN;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT true, 'Mesaj uygun'::TEXT;
END;
$function$;

-- ban_user_for_inappropriate_content
CREATE OR REPLACE FUNCTION public.ban_user_for_inappropriate_content(p_user_id uuid, p_reason text DEFAULT 'Uygunsuz içerik'::text, p_ban_duration_hours integer DEFAULT 48)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE user_bans 
  SET is_active = false 
  WHERE user_id = p_user_id AND is_active = true;
  
  INSERT INTO user_bans (user_id, reason, banned_until, banned_by)
  VALUES (
    p_user_id, 
    p_reason, 
    NOW() + (p_ban_duration_hours || ' hours')::INTERVAL,
    p_user_id
  );
  
  RAISE NOTICE 'User % banned for % until %', p_user_id, p_reason, NOW() + (p_ban_duration_hours || ' hours')::INTERVAL;
END;
$function$;

-- check_user_ban_status
CREATE OR REPLACE FUNCTION public.check_user_ban_status(p_user_id uuid)
RETURNS TABLE(is_banned boolean, ban_reason text, banned_until timestamp with time zone, remaining_hours integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN ub.banned_until > NOW() THEN true
      ELSE false
    END as is_banned,
    ub.reason as ban_reason,
    ub.banned_until,
    CASE 
      WHEN ub.banned_until > NOW() THEN 
        EXTRACT(EPOCH FROM (ub.banned_until - NOW())) / 3600
      ELSE 0
    END::INTEGER as remaining_hours
  FROM user_bans ub
  WHERE ub.user_id = p_user_id 
    AND ub.is_active = true 
    AND ub.banned_until > NOW()
  ORDER BY ub.banned_until DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TIMESTAMPTZ, 0;
  END IF;
END;
$function$;

-- cleanup_expired_bans
CREATE OR REPLACE FUNCTION public.cleanup_expired_bans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE user_bans 
  SET is_active = false 
  WHERE is_active = true 
    AND banned_until < NOW();
    
  RAISE NOTICE 'Expired bans cleaned up at %', NOW();
END;
$function$;

-- cleanup_expired_rooms
CREATE OR REPLACE FUNCTION public.cleanup_expired_rooms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM game_rooms 
  WHERE expires_at < NOW() 
    AND status != 'active';
    
  DELETE FROM game_participants
  WHERE room_id NOT IN (SELECT id FROM game_rooms);
  
  RAISE NOTICE 'Expired rooms cleaned up';
END;
$function$;

-- get_tournament_status
CREATE OR REPLACE FUNCTION public.get_tournament_status(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_tournament tournaments%ROWTYPE;
  v_total_matches integer;
  v_completed_matches integer;
  v_active_matches integer;
  v_remaining_players integer;
  v_result json;
BEGIN
  SELECT * INTO v_tournament
  FROM tournaments 
  WHERE id = p_tournament_id;
  
  IF v_tournament.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;
  
  SELECT 
    COUNT(*),
    COUNT(CASE WHEN status = 'completed' THEN 1 END),
    COUNT(CASE WHEN status = 'active' THEN 1 END)
  INTO v_total_matches, v_completed_matches, v_active_matches
  FROM tournament_matches 
  WHERE tournament_id = p_tournament_id;
  
  SELECT COUNT(*)
  INTO v_remaining_players
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id 
  AND eliminated_at IS NULL;
  
  RETURN json_build_object(
    'success', true,
    'tournament', row_to_json(v_tournament),
    'total_matches', v_total_matches,
    'completed_matches', v_completed_matches,
    'active_matches', v_active_matches,
    'remaining_players', v_remaining_players
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;

-- send_private_message_notification
CREATE OR REPLACE FUNCTION public.send_private_message_notification(p_user_id uuid, p_sender_username text, p_chat_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    p_user_id,
    'private_message', 
    'Yeni Özel Mesaj',
    p_sender_username || ' size özel mesaj gönderdi',
    json_build_object(
      'sender', p_sender_username,
      'chat_id', p_chat_id
    )
  );
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error sending private message notification: %', SQLERRM;
    RETURN FALSE;
END;
$function$;