
CREATE OR REPLACE FUNCTION update_profile_stats_on_game_completion()
RETURNS TRIGGER AS $$
DECLARE
    words_array JSONB;
    word_obj JSONB;
    v_total_words INTEGER := 0;
    v_total_score INTEGER := 0;
    v_longest_word TEXT := '';
    v_longest_length INTEGER := 0;
    v_best_word_score INTEGER := 0;
    v_best_word TEXT := '';
    v_is_winner BOOLEAN := FALSE;
BEGIN
    IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
        v_is_winner := (NEW.winner_id = NEW.player1_id);
        
        IF NEW.player1_id IS NOT NULL THEN
            SELECT 
                COALESCE(COUNT(gw.word), 0),
                COALESCE(SUM(gw.points), 0),
                COALESCE(MAX(LENGTH(gw.word)), 0),
                COALESCE(MAX(gw.points), 0)
            INTO v_total_words, v_total_score, v_longest_length, v_best_word_score
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id;
            
            IF v_longest_length > 0 THEN
                SELECT gw.word INTO v_longest_word
                FROM game_words gw 
                WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id 
                AND LENGTH(gw.word) = v_longest_length
                LIMIT 1;
            END IF;
            
            IF v_best_word_score > 0 THEN
                SELECT gw.word INTO v_best_word
                FROM game_words gw 
                WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id 
                AND gw.points = v_best_word_score
                LIMIT 1;
            END IF;
            
            UPDATE profiles SET
                total_games = COALESCE(profiles.total_games, 0) + 1,
                total_score = COALESCE(profiles.total_score, 0) + v_total_score,
                wins = CASE WHEN v_is_winner THEN COALESCE(profiles.wins, 0) + 1 ELSE COALESCE(profiles.wins, 0) END,
                losses = CASE WHEN NOT v_is_winner THEN COALESCE(profiles.losses, 0) + 1 ELSE COALESCE(profiles.losses, 0) END,
                win_streak = CASE WHEN v_is_winner THEN COALESCE(profiles.win_streak, 0) + 1 ELSE 0 END,
                total_words_created = COALESCE(profiles.total_words_created, 0) + v_total_words,
                longest_word = CASE 
                    WHEN v_longest_length > COALESCE(profiles.longest_word_length, 0) 
                    THEN v_longest_word 
                    ELSE profiles.longest_word 
                END,
                longest_word_length = CASE 
                    WHEN v_longest_length > COALESCE(profiles.longest_word_length, 0) 
                    THEN v_longest_length 
                    ELSE COALESCE(profiles.longest_word_length, 0) 
                END,
                highest_word = CASE 
                    WHEN v_best_word_score > COALESCE(profiles.highest_word_score, 0) 
                    THEN v_best_word 
                    ELSE profiles.highest_word 
                END,
                highest_word_score = CASE 
                    WHEN v_best_word_score > COALESCE(profiles.highest_word_score, 0) 
                    THEN v_best_word_score 
                    ELSE COALESCE(profiles.highest_word_score, 0) 
                END,
                updated_at = NOW()
            WHERE id = NEW.player1_id;
        END IF;
        
        IF NEW.player2_id IS NOT NULL THEN
            v_is_winner := (NEW.winner_id = NEW.player2_id);
            
            SELECT 
                COALESCE(COUNT(gw.word), 0),
                COALESCE(SUM(gw.points), 0),
                COALESCE(MAX(LENGTH(gw.word)), 0),
                COALESCE(MAX(gw.points), 0)
            INTO v_total_words, v_total_score, v_longest_length, v_best_word_score
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player2_id;
            
            IF v_longest_length > 0 THEN
                SELECT gw.word INTO v_longest_word
                FROM game_words gw 
                WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player2_id 
                AND LENGTH(gw.word) = v_longest_length
                LIMIT 1;
            END IF;
            
            IF v_best_word_score > 0 THEN
                SELECT gw.word INTO v_best_word
                FROM game_words gw 
                WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player2_id 
                AND gw.points = v_best_word_score
                LIMIT 1;
            END IF;
            
            UPDATE profiles SET
                total_games = COALESCE(profiles.total_games, 0) + 1,
                total_score = COALESCE(profiles.total_score, 0) + v_total_score,
                wins = CASE WHEN v_is_winner THEN COALESCE(profiles.wins, 0) + 1 ELSE COALESCE(profiles.wins, 0) END,
                losses = CASE WHEN NOT v_is_winner THEN COALESCE(profiles.losses, 0) + 1 ELSE COALESCE(profiles.losses, 0) END,
                win_streak = CASE WHEN v_is_winner THEN COALESCE(profiles.win_streak, 0) + 1 ELSE 0 END,
                total_words_created = COALESCE(profiles.total_words_created, 0) + v_total_words,
                longest_word = CASE 
                    WHEN v_longest_length > COALESCE(profiles.longest_word_length, 0) 
                    THEN v_longest_word 
                    ELSE profiles.longest_word 
                END,
                longest_word_length = CASE 
                    WHEN v_longest_length > COALESCE(profiles.longest_word_length, 0) 
                    THEN v_longest_length 
                    ELSE COALESCE(profiles.longest_word_length, 0) 
                END,
                highest_word = CASE 
                    WHEN v_best_word_score > COALESCE(profiles.highest_word_score, 0) 
                    THEN v_best_word 
                    ELSE profiles.highest_word 
                END,
                highest_word_score = CASE 
                    WHEN v_best_word_score > COALESCE(profiles.highest_word_score, 0) 
                    THEN v_best_word_score 
                    ELSE COALESCE(profiles.highest_word_score, 0) 
                END,
                updated_at = NOW()
            WHERE id = NEW.player2_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
