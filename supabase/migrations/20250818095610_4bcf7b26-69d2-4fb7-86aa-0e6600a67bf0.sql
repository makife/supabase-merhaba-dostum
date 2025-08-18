
-- Profil güncellemelerinde updated_at'i otomatik güncelle
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Profiles tablosuna updated_at trigger'ı ekle
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Game statistics güncellemesi için trigger
CREATE OR REPLACE FUNCTION update_profile_stats_on_game_completion()
RETURNS TRIGGER AS $$
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
                COALESCE(array_length(array_agg(gw.word), 1), 0),
                COALESCE(SUM(gw.points), 0),
                COALESCE(MAX(LENGTH(gw.word)), 0),
                COALESCE(MAX(gw.points), 0)
            INTO total_words, total_score, longest_length, best_word_score
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id;
            
            -- En uzun kelimeyi al
            SELECT gw.word INTO longest_word
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id 
            AND LENGTH(gw.word) = longest_length
            LIMIT 1;
            
            -- En yüksek puanlı kelimeyi al
            SELECT gw.word INTO best_word
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player1_id 
            AND gw.points = best_word_score
            LIMIT 1;
            
            -- Profili güncelle
            UPDATE profiles SET
                total_games = COALESCE(total_games, 0) + 1,
                total_score = COALESCE(total_score, 0) + total_score,
                wins = CASE WHEN is_winner THEN COALESCE(wins, 0) + 1 ELSE COALESCE(wins, 0) END,
                losses = CASE WHEN NOT is_winner THEN COALESCE(losses, 0) + 1 ELSE COALESCE(losses, 0) END,
                win_streak = CASE WHEN is_winner THEN COALESCE(win_streak, 0) + 1 ELSE 0 END,
                total_words_created = COALESCE(total_words_created, 0) + total_words,
                longest_word = CASE WHEN LENGTH(COALESCE(longest_word, '')) > COALESCE(longest_word_length, 0) THEN longest_word ELSE profiles.longest_word END,
                longest_word_length = CASE WHEN longest_length > COALESCE(longest_word_length, 0) THEN longest_length ELSE longest_word_length END,
                highest_word = CASE WHEN best_word_score > COALESCE(highest_word_score, 0) THEN best_word ELSE highest_word END,
                highest_word_score = CASE WHEN best_word_score > COALESCE(highest_word_score, 0) THEN best_word_score ELSE highest_word_score END,
                updated_at = NOW()
            WHERE id = NEW.player1_id;
        END IF;
        
        -- Player2 için aynı işlemleri tekrarla
        IF NEW.player2_id IS NOT NULL THEN
            is_winner := (NEW.winner_id = NEW.player2_id);
            
            SELECT 
                COALESCE(array_length(array_agg(gw.word), 1), 0),
                COALESCE(SUM(gw.points), 0),
                COALESCE(MAX(LENGTH(gw.word)), 0),
                COALESCE(MAX(gw.points), 0)
            INTO total_words, total_score, longest_length, best_word_score
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player2_id;
            
            SELECT gw.word INTO longest_word
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player2_id 
            AND LENGTH(gw.word) = longest_length
            LIMIT 1;
            
            SELECT gw.word INTO best_word
            FROM game_words gw 
            WHERE gw.room_id = NEW.id AND gw.player_id = NEW.player2_id 
            AND gw.points = best_word_score
            LIMIT 1;
            
            UPDATE profiles SET
                total_games = COALESCE(total_games, 0) + 1,
                total_score = COALESCE(total_score, 0) + total_score,
                wins = CASE WHEN is_winner THEN COALESCE(wins, 0) + 1 ELSE COALESCE(wins, 0) END,
                losses = CASE WHEN NOT is_winner THEN COALESCE(losses, 0) + 1 ELSE COALESCE(losses, 0) END,
                win_streak = CASE WHEN is_winner THEN COALESCE(win_streak, 0) + 1 ELSE 0 END,
                total_words_created = COALESCE(total_words_created, 0) + total_words,
                longest_word = CASE WHEN LENGTH(COALESCE(longest_word, '')) > COALESCE(longest_word_length, 0) THEN longest_word ELSE profiles.longest_word END,
                longest_word_length = CASE WHEN longest_length > COALESCE(longest_word_length, 0) THEN longest_length ELSE longest_word_length END,
                highest_word = CASE WHEN best_word_score > COALESCE(highest_word_score, 0) THEN best_word ELSE highest_word END,
                highest_word_score = CASE WHEN best_word_score > COALESCE(highest_word_score, 0) THEN best_word_score ELSE highest_word_score END,
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Game rooms tablosuna trigger ekle
DROP TRIGGER IF EXISTS update_stats_on_game_finish ON game_rooms;
CREATE TRIGGER update_stats_on_game_finish
    AFTER UPDATE ON game_rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_stats_on_game_completion();

-- Ortalama kelime uzunluğunu hesaplayan fonksiyon
CREATE OR REPLACE FUNCTION calculate_average_word_length(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    avg_length NUMERIC;
BEGIN
    SELECT AVG(LENGTH(word))::NUMERIC(4,2)
    INTO avg_length
    FROM game_history
    WHERE player_id = p_user_id;
    
    RETURN COALESCE(avg_length, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profil istatistiklerini yeniden hesaplayan fonksiyon
CREATE OR REPLACE FUNCTION recalculate_user_stats(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    stats_record RECORD;
BEGIN
    -- Mevcut oyun verilerinden istatistikleri hesapla
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
    
    -- En uzun kelimeyi al
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
        
        -- Profili güncelle
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
