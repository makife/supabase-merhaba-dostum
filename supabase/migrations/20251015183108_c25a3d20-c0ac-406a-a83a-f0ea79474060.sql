-- advance_tournament_round fonksiyonunu güncelle: EKSIK MAÇLARI OLUŞTUR
CREATE OR REPLACE FUNCTION public.advance_tournament_round(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    current_tournament tournaments%ROWTYPE;
    completed_matches_count INTEGER;
    total_matches_count INTEGER;
    winners_list text[];
    next_round INTEGER;
    result json;
    existing_sf1 uuid;
    existing_sf2 uuid;
    existing_final uuid;
BEGIN
    -- Tournament bilgisini al
    SELECT * INTO current_tournament 
    FROM tournaments 
    WHERE id = p_tournament_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Tournament not found');
    END IF;
    
    -- Mevcut round'daki tamamlanmış maç sayısını kontrol et
    SELECT COUNT(*) INTO completed_matches_count
    FROM tournament_matches
    WHERE tournament_id = p_tournament_id 
    AND round = current_tournament.current_round 
    AND status = 'completed';
    
    -- Toplam maç sayısını hesapla
    SELECT COUNT(*) INTO total_matches_count
    FROM tournament_matches
    WHERE tournament_id = p_tournament_id 
    AND round = current_tournament.current_round;
    
    -- Tüm maçlar tamamlanmış mı kontrol et
    IF completed_matches_count < total_matches_count THEN
        RETURN json_build_object('success', false, 'error', 'Round not completed');
    END IF;
    
    -- Kazananları al (text olarak)
    SELECT ARRAY_AGG(winner_id ORDER BY match_number) INTO winners_list
    FROM tournament_matches
    WHERE tournament_id = p_tournament_id 
    AND round = current_tournament.current_round
    AND winner_id IS NOT NULL;
    
    next_round := current_tournament.current_round + 1;
    
    -- Final kontrolü
    IF current_tournament.current_round = 3 THEN
        -- Turnuva bitti
        UPDATE tournaments 
        SET status = 'completed', 
            updated_at = NOW()
        WHERE id = p_tournament_id;
        
        RETURN json_build_object(
            'success', true, 
            'tournament_completed', true,
            'winner_id', winners_list[1]
        );
    END IF;
    
    -- Bir sonraki round'un maçlarını oluştur (EĞER YOKSA)
    IF next_round = 2 THEN
        -- Yarı final maçlarını kontrol et
        SELECT id INTO existing_sf1 FROM tournament_matches 
        WHERE tournament_id = p_tournament_id AND round = 2 AND match_number = 1;
        
        SELECT id INTO existing_sf2 FROM tournament_matches 
        WHERE tournament_id = p_tournament_id AND round = 2 AND match_number = 2;
        
        -- SF1 yoksa oluştur
        IF existing_sf1 IS NULL THEN
            INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
            VALUES (p_tournament_id, 2, 1, winners_list[1], winners_list[2], 'pending');
        ELSE
            -- Varsa güncelle
            UPDATE tournament_matches 
            SET player1_id = winners_list[1], 
                player2_id = winners_list[2], 
                status = 'pending',
                updated_at = NOW()
            WHERE id = existing_sf1;
        END IF;
        
        -- SF2 yoksa oluştur
        IF existing_sf2 IS NULL THEN
            INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
            VALUES (p_tournament_id, 2, 2, winners_list[3], winners_list[4], 'pending');
        ELSE
            -- Varsa güncelle
            UPDATE tournament_matches 
            SET player1_id = winners_list[3], 
                player2_id = winners_list[4], 
                status = 'pending',
                updated_at = NOW()
            WHERE id = existing_sf2;
        END IF;
        
    ELSIF next_round = 3 THEN
        -- Final maçını kontrol et
        SELECT id INTO existing_final FROM tournament_matches 
        WHERE tournament_id = p_tournament_id AND round = 3 AND match_number = 1;
        
        -- Final yoksa oluştur
        IF existing_final IS NULL THEN
            INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
            VALUES (p_tournament_id, 3, 1, winners_list[1], winners_list[2], 'pending');
        ELSE
            -- Varsa güncelle
            UPDATE tournament_matches 
            SET player1_id = winners_list[1], 
                player2_id = winners_list[2], 
                status = 'pending',
                updated_at = NOW()
            WHERE id = existing_final;
        END IF;
    END IF;
    
    -- Tournament round'unu güncelle
    UPDATE tournaments 
    SET current_round = next_round,
        updated_at = NOW()
    WHERE id = p_tournament_id;
    
    RETURN json_build_object(
        'success', true, 
        'next_round', next_round,
        'winners_placed', array_length(winners_list, 1)
    );
END;
$function$;