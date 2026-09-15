-- Önce mevcut fonksiyonu düşür
DROP FUNCTION IF EXISTS public.check_words_per_game_badge(uuid, integer);

-- Rozet sistemini tam olarak çalışacak şekilde düzelt
CREATE OR REPLACE FUNCTION public.check_and_award_badges(p_user_id uuid)
RETURNS json[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    user_stats RECORD;
    badge_record RECORD;
    new_badges JSON[] := '{}';
    new_badge JSON;
    tournament_stats RECORD;
BEGIN
    -- Kullanıcının mevcut istatistiklerini al
    SELECT 
        total_games,
        wins,
        losses,
        total_score,
        win_streak,
        longest_word,
        longest_word_length,
        total_words_created,
        fastest_word_time,
        average_score,
        tournament_wins
    INTO user_stats
    FROM profiles 
    WHERE id = p_user_id;
    
    -- Turnuva istatistiklerini hesapla
    SELECT 
        COUNT(*) FILTER (WHERE winner_id = p_user_id::text) as tournaments_won,
        COUNT(*) FILTER (WHERE winner_id != p_user_id::text) as tournaments_lost,
        COUNT(*) as tournaments_played
    INTO tournament_stats
    FROM tournament_matches 
    WHERE (player1_id = p_user_id::text OR player2_id = p_user_id::text) 
    AND status = 'completed';
    
    -- Tüm rozetleri kontrol et
    FOR badge_record IN 
        SELECT b.* FROM badges b
        LEFT JOIN user_badges ub ON b.id = ub.badge_id AND ub.user_id = p_user_id
        WHERE ub.badge_id IS NULL -- Henüz kazanılmamış rozetler
    LOOP
        -- Rozet koşulunu kontrol et
        IF (badge_record.condition_type = 'total_games' AND COALESCE(user_stats.total_games, 0) >= badge_record.condition_value) OR
           (badge_record.condition_type = 'wins' AND COALESCE(user_stats.wins, 0) >= badge_record.condition_value) OR
           (badge_record.condition_type = 'total_score' AND COALESCE(user_stats.total_score, 0) >= badge_record.condition_value) OR
           (badge_record.condition_type = 'win_streak' AND COALESCE(user_stats.win_streak, 0) >= badge_record.condition_value) OR
           (badge_record.condition_type = 'total_words' AND COALESCE(user_stats.total_words_created, 0) >= badge_record.condition_value) OR
           (badge_record.condition_type = 'longest_word' AND COALESCE(user_stats.longest_word_length, 0) >= badge_record.condition_value) OR
           (badge_record.condition_type = 'fast_typing' AND COALESCE(user_stats.fastest_word_time, 999) <= badge_record.condition_value) OR
           (badge_record.condition_type = 'tournament_wins' AND COALESCE(user_stats.tournament_wins, 0) >= badge_record.condition_value) OR
           (badge_record.condition_type = 'tournaments_won' AND COALESCE(tournament_stats.tournaments_won, 0) >= badge_record.condition_value) THEN
            
            -- Rozeti kullanıcıya ver
            INSERT INTO user_badges (user_id, badge_id, earned_at)
            VALUES (p_user_id, badge_record.id, NOW())
            ON CONFLICT (user_id, badge_id) DO NOTHING;
            
            -- Yeni rozet listesine ekle
            new_badge := json_build_object(
                'new_badge_id', badge_record.id,
                'new_badge_name', badge_record.name,
                'new_badge_icon', badge_record.icon
            );
            new_badges := new_badges || new_badge;
        END IF;
    END LOOP;
    
    RETURN new_badges;
END;
$$;

-- words_per_game badge kontrolü için fonksiyon (oyun başına kelime sayısı - oyun bitince çağrılır)
CREATE OR REPLACE FUNCTION public.check_words_per_game_badge(p_user_id uuid, p_words_count integer)
RETURNS json[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    badge_record RECORD;
    new_badges JSON[] := '{}';
    new_badge JSON;
BEGIN
    -- words_per_game rozetlerini kontrol et
    FOR badge_record IN 
        SELECT b.* FROM badges b
        LEFT JOIN user_badges ub ON b.id = ub.badge_id AND ub.user_id = p_user_id
        WHERE ub.badge_id IS NULL 
        AND b.condition_type = 'words_per_game'
        AND p_words_count >= b.condition_value
    LOOP
        -- Rozeti kullanıcıya ver
        INSERT INTO user_badges (user_id, badge_id, earned_at)
        VALUES (p_user_id, badge_record.id, NOW())
        ON CONFLICT (user_id, badge_id) DO NOTHING;
        
        -- Yeni rozet listesine ekle
        new_badge := json_build_object(
            'new_badge_id', badge_record.id,
            'new_badge_name', badge_record.name,
            'new_badge_icon', badge_record.icon
        );
        new_badges := new_badges || new_badge;
    END LOOP;
    
    RETURN new_badges;
END;
$$;