CREATE OR REPLACE FUNCTION public.check_and_award_badges_simple(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_stats RECORD;
  badge_record RECORD;
  badge_name TEXT;
BEGIN
  -- Kullanıcı istatistiklerini al
  SELECT 
    COALESCE(total_games, 0) as total_games,
    COALESCE(total_score, 0) as total_score,
    COALESCE(win_streak, 0) as win_streak,
    COALESCE(total_words_created, 0) as total_words_created,
    COALESCE(longest_word_length, 0) as longest_word_length,
    COALESCE(tournament_wins, 0) as tournament_wins,
    COALESCE(degistir_joker_used, 0) as degistir_joker_used,
    COALESCE(fisilida_joker_used, 0) as fisilida_joker_used,
    COALESCE(senyaz_joker_used, 0) as senyaz_joker_used,
    COALESCE(vs_bot_games, 0) as vs_bot_games,
    COALESCE(private_room_games, 0) as private_room_games,
    COALESCE(random_match_games, 0) as random_match_games,
    COALESCE(wins, 0) as wins,
    COALESCE(fastest_word_time, 0) as fastest_word_time
  INTO user_stats
  FROM profiles 
  WHERE id = p_user_id;
  
  -- Her badge'i kontrol et
  FOR badge_record IN 
    SELECT b.id, b.name, b.condition_type, b.condition_value
    FROM badges b
    WHERE b.id NOT IN (
      SELECT ub.badge_id 
      FROM user_badges ub 
      WHERE ub.user_id = p_user_id
    )
  LOOP
    -- Badge koşulunu kontrol et ve ver
    IF (badge_record.condition_type = 'total_games' AND user_stats.total_games >= badge_record.condition_value) OR
       (badge_record.condition_type = 'total_score' AND user_stats.total_score >= badge_record.condition_value) OR
       (badge_record.condition_type = 'win_streak' AND user_stats.win_streak >= badge_record.condition_value) OR
       (badge_record.condition_type = 'total_words' AND user_stats.total_words_created >= badge_record.condition_value) OR
       (badge_record.condition_type = 'longest_word' AND user_stats.longest_word_length >= badge_record.condition_value) OR
       (badge_record.condition_type = 'tournament_wins' AND user_stats.tournament_wins >= badge_record.condition_value) OR
       (badge_record.condition_type = 'tournaments_won' AND user_stats.tournament_wins >= badge_record.condition_value) OR
       (badge_record.condition_type = 'degistir_joker_used' AND user_stats.degistir_joker_used >= badge_record.condition_value) OR
       (badge_record.condition_type = 'fisilida_joker_used' AND user_stats.fisilida_joker_used >= badge_record.condition_value) OR
       (badge_record.condition_type = 'senyaz_joker_used' AND user_stats.senyaz_joker_used >= badge_record.condition_value) OR
       (badge_record.condition_type = 'vs_bot_games' AND user_stats.vs_bot_games >= badge_record.condition_value) OR
       (badge_record.condition_type = 'private_room_games' AND user_stats.private_room_games >= badge_record.condition_value) OR
       (badge_record.condition_type = 'random_match_games' AND user_stats.random_match_games >= badge_record.condition_value) OR
       (badge_record.condition_type = 'wins' AND user_stats.wins >= badge_record.condition_value) OR
       (badge_record.condition_type = 'fast_typing' AND user_stats.fastest_word_time > 0 AND user_stats.fastest_word_time <= badge_record.condition_value) THEN
       
      -- Badge'i ver
      INSERT INTO user_badges (user_id, badge_id)
      VALUES (p_user_id, badge_record.id)
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      -- Hemen bildirim gönder (doğrudan INSERT ile)
      INSERT INTO notifications (user_id, type, message, related_id)
      VALUES (
        p_user_id,
        'badge_earned',
        'Yeni rozet kazandınız: ' || badge_record.name,
        badge_record.id::text
      );
      
      -- Log
      RAISE NOTICE '✅ Badge earned: % for user %', badge_record.name, p_user_id;
    END IF;
  END LOOP;
END;
$function$;