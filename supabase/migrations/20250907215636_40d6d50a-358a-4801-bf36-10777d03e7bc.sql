-- Fix search path for advance_tournament_round function
CREATE OR REPLACE FUNCTION public.advance_tournament_round(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    current_tournament tournaments%ROWTYPE;
    completed_matches_count INTEGER;
    total_matches_count INTEGER;
    winners_list text[];  -- Change to text[] to handle bot IDs
    next_round INTEGER;
    result json;
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
    
    -- Kazananları bir sonraki round'a yerleştir
    IF next_round = 2 THEN
        -- Yarı final: Winners 1,2 -> Match 1, Winners 3,4 -> Match 2
        UPDATE tournament_matches 
        SET player1_id = winners_list[1], 
            player2_id = winners_list[2], 
            status = 'pending',
            updated_at = NOW()
        WHERE tournament_id = p_tournament_id 
        AND round = 2 AND match_number = 1;
        
        UPDATE tournament_matches 
        SET player1_id = winners_list[3], 
            player2_id = winners_list[4], 
            status = 'pending',
            updated_at = NOW()
        WHERE tournament_id = p_tournament_id 
        AND round = 2 AND match_number = 2;
        
    ELSIF next_round = 3 THEN
        -- Final: Semi-final winners
        UPDATE tournament_matches 
        SET player1_id = winners_list[1], 
            player2_id = winners_list[2], 
            status = 'pending',
            updated_at = NOW()
        WHERE tournament_id = p_tournament_id 
        AND round = 3 AND match_number = 1;
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