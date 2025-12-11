
-- recalculate_user_stats fonksiyonunu güncelle - tournament_wins dahil et
CREATE OR REPLACE FUNCTION public.recalculate_user_stats(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    stats_record RECORD;
    tournament_stats RECORD;
    game_mode_stats RECORD;
    longest_word_text TEXT;
    highest_word_text TEXT;
    avg_length NUMERIC;
BEGIN
    -- Genel oyun istatistiklerini al
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
    
    -- Turnuva kazanma sayısını hesapla (tournament_matches tablosundan)
    SELECT 
        COUNT(*) as tournament_wins
    INTO tournament_stats
    FROM tournament_matches tm
    WHERE tm.winner_id = p_user_id 
    AND tm.status = 'completed'
    AND tm.round = (
        SELECT MAX(round) FROM tournament_matches tm2 
        WHERE tm2.tournament_id = tm.tournament_id
    );
    
    -- Oyun modu bazlı istatistikleri hesapla
    SELECT 
        COUNT(CASE WHEN gr.game_mode = 'vs-computer' THEN 1 END) as vs_bot_games,
        COUNT(CASE WHEN gr.game_mode = 'random-match' THEN 1 END) as random_match_games,
        COUNT(CASE WHEN gr.game_mode = 'private-room' THEN 1 END) as private_room_games
    INTO game_mode_stats
    FROM game_rooms gr
    WHERE (gr.player1_id = p_user_id OR gr.player2_id = p_user_id)
    AND gr.status = 'finished';
    
    -- En uzun kelimeyi bul
    SELECT gw.word INTO longest_word_text
    FROM game_words gw
    JOIN game_rooms gr ON gr.id = gw.room_id
    WHERE gw.player_id = p_user_id 
    AND LENGTH(gw.word) = stats_record.longest_length
    LIMIT 1;
    
    -- En yüksek puanlı kelimeyi bul
    SELECT gw.word INTO highest_word_text
    FROM game_words gw
    JOIN game_rooms gr ON gr.id = gw.room_id
    WHERE gw.player_id = p_user_id 
    AND gw.points = stats_record.highest_score
    LIMIT 1;
    
    -- Ortalama kelime uzunluğunu hesapla
    SELECT calculate_average_word_length(p_user_id) INTO avg_length;
    
    -- Profili güncelle
    UPDATE profiles SET
        total_games = COALESCE(stats_record.total_games, 0),
        wins = COALESCE(stats_record.wins, 0),
        losses = COALESCE(stats_record.losses, 0),
        total_score = COALESCE(stats_record.total_score, 0),
        total_words_created = COALESCE(stats_record.total_words, 0),
        longest_word = longest_word_text,
        longest_word_length = COALESCE(stats_record.longest_length, 0),
        highest_word = highest_word_text,
        highest_word_score = COALESCE(stats_record.highest_score, 0),
        average_word_length = COALESCE(avg_length, 0),
        tournament_wins = COALESCE(tournament_stats.tournament_wins, 0),
        vs_bot_games = COALESCE(game_mode_stats.vs_bot_games, 0),
        random_match_games = COALESCE(game_mode_stats.random_match_games, 0),
        private_room_games = COALESCE(game_mode_stats.private_room_games, 0),
        updated_at = NOW()
    WHERE id = p_user_id;
END;
$function$;

-- Tüm kullanıcıların istatistiklerini yeniden hesapla
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM profiles LOOP
        PERFORM recalculate_user_stats(user_record.id);
    END LOOP;
END $$;
