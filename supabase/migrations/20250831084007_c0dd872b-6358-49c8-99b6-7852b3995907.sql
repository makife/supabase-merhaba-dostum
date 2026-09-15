-- Update tournament start function to create full bracket structure
CREATE OR REPLACE FUNCTION public.start_tournament_with_bracket(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_participants uuid[];
  v_participant_count integer;
  v_bots_needed integer;
BEGIN
  -- Count real participants
  SELECT COUNT(*) 
  INTO v_participant_count
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id
  AND user_id IS NOT NULL;
  
  -- Add bots to reach 8
  v_bots_needed := 8 - v_participant_count;
  IF v_bots_needed > 0 THEN
    FOR i IN 1..v_bots_needed LOOP
      INSERT INTO tournament_participants (
        tournament_id,
        user_id,
        seed,
        is_bot,
        joined_at
      ) VALUES (
        p_tournament_id,
        NULL,
        v_participant_count + i,
        true,
        now()
      );
    END LOOP;
  END IF;

  -- Ordered list of user IDs; bots become NULLs
  SELECT array_agg(
    CASE WHEN user_id IS NOT NULL THEN user_id ELSE NULL END 
    ORDER BY seed
  ) INTO v_participants
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id;
  
  -- Create FULL BRACKET: Round 1 (4 matches)
  FOR i IN 1..4 LOOP
    INSERT INTO tournament_matches (
      tournament_id,
      round,
      match_number,
      player1_id,
      player2_id,
      player1_score,
      player2_score,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_tournament_id,
      1,
      i,
      v_participants[i * 2 - 1],
      v_participants[i * 2],
      0,
      0,
      'pending',
      now(),
      now()
    );
  END LOOP;

  -- Create Round 2 (Semi-finals, 2 matches) - EMPTY SLOTS
  FOR i IN 1..2 LOOP
    INSERT INTO tournament_matches (
      tournament_id,
      round,
      match_number,
      player1_id,
      player2_id,
      player1_score,
      player2_score,
      status,
      created_at,
      updated_at
    ) VALUES (
      p_tournament_id,
      2,
      i,
      NULL, -- Will be filled by round 1 winners
      NULL, -- Will be filled by round 1 winners
      0,
      0,
      'waiting', -- Not pending yet, waiting for players
      now(),
      now()
    );
  END LOOP;

  -- Create Round 3 (Final, 1 match) - EMPTY SLOT
  INSERT INTO tournament_matches (
    tournament_id,
    round,
    match_number,
    player1_id,
    player2_id,
    player1_score,
    player2_score,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_tournament_id,
    3,
    1,
    NULL, -- Will be filled by round 2 winners
    NULL, -- Will be filled by round 2 winners
    0,
    0,
    'waiting', -- Not pending yet, waiting for players
    now(),
    now()
  );

  -- Activate tournament
  UPDATE tournaments 
  SET status = 'active', started_at = now(), current_round = 1
  WHERE id = p_tournament_id;

  RETURN json_build_object('success', true, 'matches_created', 7, 'participants', 8);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Update advancement function to just move winners to next round
CREATE OR REPLACE FUNCTION public.advance_tournament_round(p_tournament_id uuid)
RETURNS json
LANGUAGE plpgsql
AS $function$
DECLARE
    current_tournament tournaments%ROWTYPE;
    completed_matches_count INTEGER;
    total_matches_count INTEGER;
    winners_list uuid[];
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
    
    -- Kazananları al
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
            winner_id = winners_list[1],
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