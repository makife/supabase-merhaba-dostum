-- En uzun kelime trigger'ını düzelt
CREATE OR REPLACE FUNCTION public.update_profile_stats_on_game_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
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
    -- Sadece oyun tamamlandığında çalış
    IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
        -- Kazananı belirle
        is_winner := (NEW.winner_id = NEW.player1_id);
        
        -- Player1 için istatistikleri güncelle
        IF NEW.player1_id IS NOT NULL THEN
            -- Kelime verilerini topla
            SELECT 
                COALESCE(COUNT(gw.word), 0),
                COALESCE(SUM(gw.points), 0),
                COALESCE(MAX(LENGTH(gw.word)), 0),
                COALESCE(MAX(gw.points), 0)
            INTO total_words, total_score, longest_length, best_word_score
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id;
            
            -- En uzun kelimeyi al
            IF longest_length > 0 THEN
                SELECT gw.word INTO longest_word
                FROM game_words gw 
                WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id 
                AND LENGTH(gw.word) = longest_length
                LIMIT 1;
            END IF;
            
            -- En yüksek puanlı kelimeyi al
            IF best_word_score > 0 THEN
                SELECT gw.word INTO best_word
                FROM game_words gw 
                WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id 
                AND gw.points = best_word_score
                LIMIT 1;
            END IF;
            
            -- Profili güncelle
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
        
        -- Player2 için aynı işlemleri tekrarla
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
        
        -- Rozet kontrollerini çağır
        PERFORM check_and_award_badges(NEW.player1_id);
        IF NEW.player2_id IS NOT NULL THEN
            PERFORM check_and_award_badges(NEW.player2_id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;