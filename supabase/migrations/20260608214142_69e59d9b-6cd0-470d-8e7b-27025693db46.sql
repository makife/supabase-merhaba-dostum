CREATE OR REPLACE FUNCTION public.recalculate_user_stats(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    session_stats RECORD;
    tournament_stats RECORD;
    word_stats RECORD;
    longest_word_text TEXT;
    highest_word_text TEXT;
    avg_length NUMERIC;
    gw_count INT;
BEGIN
    SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN is_winner THEN 1 END) as wins,
        COUNT(CASE WHEN NOT is_winner THEN 1 END) as losses,
        COALESCE(SUM(score), 0) as total_score,
        COALESCE(SUM(words_count), 0) as total_words,
        COUNT(CASE WHEN game_mode = 'vs-computer' THEN 1 END) as vs_bot_games,
        COUNT(CASE WHEN game_mode LIKE 'private-room%' THEN 1 END) as private_room_games,
        COUNT(CASE WHEN game_mode LIKE 'random-match%' THEN 1 END) as random_match_games
    INTO session_stats
    FROM game_sessions
    WHERE user_id = p_user_id;

    SELECT COUNT(*) as tournament_wins
    INTO tournament_stats
    FROM tournament_matches tm
    WHERE tm.winner_id = p_user_id
      AND tm.status = 'completed'
      AND (
          SELECT COUNT(*) FROM tournament_matches tm2
          WHERE tm2.tournament_id = tm.tournament_id
            AND tm2.round = tm.round
      ) = 1
      AND tm.round = (
          SELECT MAX(round) FROM tournament_matches tm3
          WHERE tm3.tournament_id = tm.tournament_id
      );

    SELECT COUNT(*) INTO gw_count FROM game_words WHERE player_id = p_user_id;

    IF gw_count > 0 THEN
        SELECT 
            COALESCE(MAX(LENGTH(word)), 0) as longest_length,
            COALESCE(MAX(points), 0) as highest_score
        INTO word_stats
        FROM game_words
        WHERE player_id = p_user_id;

        SELECT word INTO longest_word_text
        FROM game_words
        WHERE player_id = p_user_id 
        AND LENGTH(word) = word_stats.longest_length
        LIMIT 1;

        SELECT word INTO highest_word_text
        FROM game_words
        WHERE player_id = p_user_id 
        AND points = word_stats.highest_score
        LIMIT 1;

        SELECT COALESCE(AVG(LENGTH(word)), 0) INTO avg_length
        FROM game_words
        WHERE player_id = p_user_id;

        UPDATE profiles SET
            total_games = COALESCE(session_stats.total_games, 0),
            wins = COALESCE(session_stats.wins, 0),
            losses = COALESCE(session_stats.losses, 0),
            total_score = COALESCE(session_stats.total_score, 0),
            total_words_created = COALESCE(session_stats.total_words, 0),
            longest_word = COALESCE(longest_word_text, longest_word),
            longest_word_length = GREATEST(COALESCE(word_stats.longest_length, 0), COALESCE(longest_word_length, 0)),
            highest_word = COALESCE(highest_word_text, highest_word),
            highest_word_score = GREATEST(COALESCE(word_stats.highest_score, 0), COALESCE(highest_word_score, 0)),
            average_word_length = COALESCE(avg_length, average_word_length),
            tournament_wins = COALESCE(tournament_stats.tournament_wins, 0),
            vs_bot_games = COALESCE(session_stats.vs_bot_games, 0),
            random_match_games = COALESCE(session_stats.random_match_games, 0),
            private_room_games = COALESCE(session_stats.private_room_games, 0),
            updated_at = NOW()
        WHERE id = p_user_id;
    ELSE
        -- game_words yok: kelime istatistiklerine DOKUNMA, sadece sayaçları güncelle
        UPDATE profiles SET
            total_games = COALESCE(session_stats.total_games, 0),
            wins = COALESCE(session_stats.wins, 0),
            losses = COALESCE(session_stats.losses, 0),
            total_score = COALESCE(session_stats.total_score, 0),
            total_words_created = GREATEST(COALESCE(session_stats.total_words, 0), COALESCE(total_words_created, 0)),
            tournament_wins = COALESCE(tournament_stats.tournament_wins, 0),
            vs_bot_games = COALESCE(session_stats.vs_bot_games, 0),
            random_match_games = COALESCE(session_stats.random_match_games, 0),
            private_room_games = COALESCE(session_stats.private_room_games, 0),
            updated_at = NOW()
        WHERE id = p_user_id;
    END IF;
END;
$function$;