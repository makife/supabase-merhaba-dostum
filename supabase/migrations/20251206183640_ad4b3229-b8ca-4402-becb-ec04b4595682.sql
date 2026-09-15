-- create_matches_for_active_tournament fonksiyonunu SECURITY DEFINER olarak güncelle
-- Bu, bot katılımcılarını eklerken RLS'yi bypass edecek

CREATE OR REPLACE FUNCTION public.create_matches_for_active_tournament(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_participant_count integer;
    v_real_player_count integer;
    v_max_participants integer;
    v_current_status text;
    v_bot_count integer;
    i integer;
    v_bot_id uuid;
BEGIN
    -- Turnuva durumunu kontrol et
    SELECT status, max_participants INTO v_current_status, v_max_participants
    FROM tournaments WHERE id = p_tournament_id;
    
    IF v_current_status != 'waiting' THEN
        RAISE NOTICE 'Turnuva waiting durumunda değil, matches oluşturulmayacak';
        RETURN;
    END IF;
    
    -- Mevcut katılımcı sayısını al
    SELECT COUNT(*) INTO v_participant_count
    FROM tournament_participants WHERE tournament_id = p_tournament_id;
    
    -- Gerçek oyuncu sayısını kontrol et
    SELECT COUNT(*) INTO v_real_player_count
    FROM tournament_participants 
    WHERE tournament_id = p_tournament_id AND is_bot = false;
    
    -- En az 2 gerçek oyuncu olmalı
    IF v_real_player_count < 2 THEN
        RAISE NOTICE 'En az 2 gerçek oyuncu gerekli, sadece % oyuncu var', v_real_player_count;
        RETURN;
    END IF;
    
    -- Mevcut maçları kontrol et (duplicate prevention)
    IF EXISTS (SELECT 1 FROM tournament_matches WHERE tournament_id = p_tournament_id AND round = 1) THEN
        RAISE NOTICE 'Round 1 maçları zaten mevcut';
        RETURN;
    END IF;
    
    -- Eksik slotları botlarla doldur
    v_bot_count := v_max_participants - v_participant_count;
    
    FOR i IN 1..v_bot_count LOOP
        v_bot_id := gen_random_uuid();
        INSERT INTO tournament_participants (tournament_id, user_id, is_bot, seed)
        VALUES (p_tournament_id, v_bot_id, true, v_participant_count + i);
    END LOOP;
    
    -- Turnuva durumunu güncelle
    UPDATE tournaments 
    SET status = 'in_progress', 
        started_at = now(),
        current_round = 1
    WHERE id = p_tournament_id;
    
    -- Quarter-final maçlarını oluştur (4 maç, 8 oyuncu)
    WITH ordered_participants AS (
        SELECT user_id, is_bot, ROW_NUMBER() OVER (ORDER BY seed, joined_at) as rn
        FROM tournament_participants
        WHERE tournament_id = p_tournament_id
    )
    INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
    SELECT 
        p_tournament_id,
        1,
        match_num,
        p1.user_id,
        p2.user_id,
        'pending'
    FROM (VALUES (1), (2), (3), (4)) AS matches(match_num)
    JOIN ordered_participants p1 ON p1.rn = (match_num * 2) - 1
    JOIN ordered_participants p2 ON p2.rn = (match_num * 2)
    ON CONFLICT (tournament_id, round, match_number) DO NOTHING;
    
    RAISE NOTICE 'Turnuva % için maçlar oluşturuldu', p_tournament_id;
END;
$$;