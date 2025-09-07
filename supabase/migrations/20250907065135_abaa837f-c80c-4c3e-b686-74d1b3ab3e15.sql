-- Fix tournament match creation logic to properly calculate matches based on participants
-- Remove hardcoded values and calculate matches dynamically

CREATE OR REPLACE FUNCTION public.start_tournament_automatically(p_tournament_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_tournament tournaments%ROWTYPE;
    v_participant_count INTEGER;
    v_real_player_count INTEGER;
    v_bot_count INTEGER;
    v_round1_matches INTEGER;
    v_round2_matches INTEGER;
    v_round3_matches INTEGER;
BEGIN
    -- Fetch tournament
    SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
    IF v_tournament.id IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Tournament not found');
    END IF;

    IF v_tournament.status <> 'waiting' THEN
        RETURN json_build_object('success', false, 'error', 'Tournament already started');
    END IF;
    
    -- Count real players
    SELECT COUNT(*) INTO v_real_player_count 
    FROM tournament_participants 
    WHERE tournament_id = p_tournament_id 
      AND user_id IS NOT NULL 
      AND is_bot = false;
    
    IF v_real_player_count < 1 THEN
        RETURN json_build_object('success', false, 'error', 'At least 1 real player required');
    END IF;
    
    -- Fill with bots to 8
    SELECT COUNT(*) INTO v_participant_count FROM tournament_participants WHERE tournament_id = p_tournament_id;
    v_bot_count := 8 - v_participant_count;
    IF v_bot_count > 0 THEN
        FOR i IN 1..v_bot_count LOOP
            INSERT INTO tournament_participants (tournament_id, user_id, seed, is_bot, joined_at)
            VALUES (
                p_tournament_id,
                ('bot_' || p_tournament_id || '_' || i),
                v_participant_count + i,
                true,
                now()
            );
        END LOOP;
    END IF;
    
    -- Calculate match counts based on participants (always 8 after bot fill)
    -- Round 1: 8 participants / 2 = 4 matches
    v_round1_matches := 8 / 2;
    -- Round 2: 4 winners / 2 = 2 matches  
    v_round2_matches := v_round1_matches / 2;
    -- Round 3: 2 winners / 2 = 1 match
    v_round3_matches := v_round2_matches / 2;
    
    -- Create round 1 matches (pending)
    WITH participants_ordered AS (
        SELECT user_id, seed, ROW_NUMBER() OVER (ORDER BY seed) as rn
        FROM tournament_participants 
        WHERE tournament_id = p_tournament_id
        ORDER BY seed
    )
    INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
    SELECT 
        p_tournament_id,
        1,
        CEIL(p1.rn / 2.0)::INTEGER,
        p1.user_id,
        p2.user_id,
        'pending'
    FROM participants_ordered p1
    JOIN participants_ordered p2 ON p2.rn = p1.rn + 1
    WHERE p1.rn % 2 = 1;
    
    -- Create round 2 matches (semi-finals) based on calculated count
    FOR i IN 1..v_round2_matches LOOP
        INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
        VALUES (p_tournament_id, 2, i, NULL, NULL, 'pending');
    END LOOP;
    
    -- Create round 3 matches (final) based on calculated count
    FOR i IN 1..v_round3_matches LOOP
        INSERT INTO tournament_matches (tournament_id, round, match_number, player1_id, player2_id, status)
        VALUES (p_tournament_id, 3, i, NULL, NULL, 'pending');
    END LOOP;
    
    -- Start tournament
    UPDATE tournaments 
    SET status = 'in_progress', started_at = NOW(), current_round = 1, updated_at = NOW()
    WHERE id = p_tournament_id;
    
    RETURN json_build_object(
        'success', true,
        'real_players', v_real_player_count,
        'bots_added', v_bot_count,
        'total_matches_created', v_round1_matches + v_round2_matches + v_round3_matches,
        'round1_matches', v_round1_matches,
        'round2_matches', v_round2_matches, 
        'round3_matches', v_round3_matches
    );
EXCEPTION 
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Also fix the helper function
CREATE OR REPLACE FUNCTION public.start_tournament_with_bracket(p_tournament_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_participants uuid[];
  v_participant_count integer;
  v_bots_needed integer;
  v_existing_matches integer;
  v_tournament tournaments%ROWTYPE;
  v_round1_matches INTEGER;
  v_round2_matches INTEGER;
  v_round3_matches INTEGER;
BEGIN
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  IF v_tournament.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  SELECT COUNT(*) INTO v_existing_matches FROM tournament_matches WHERE tournament_id = p_tournament_id;
  IF v_existing_matches > 0 THEN
    RETURN json_build_object('success', false, 'error', 'Matches already exist');
  END IF;

  -- Count real participants
  SELECT COUNT(*) INTO v_participant_count
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
        ('bot_' || p_tournament_id || '_' || i),
        v_participant_count + i,
        true,
        now()
      );
    END LOOP;
  END IF;

  -- Calculate match counts (always 8 participants after bot fill)
  v_round1_matches := 8 / 2;  -- 4 matches
  v_round2_matches := v_round1_matches / 2;  -- 2 matches  
  v_round3_matches := v_round2_matches / 2;  -- 1 match

  -- Build participants array
  SELECT array_agg(NULLIF(user_id, '')::uuid ORDER BY seed) INTO v_participants
  FROM tournament_participants 
  WHERE tournament_id = p_tournament_id;
  
  -- Create Round 1 matches dynamically
  FOR i IN 1..v_round1_matches LOOP
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

  -- Create Round 2 matches dynamically
  FOR i IN 1..v_round2_matches LOOP
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
      NULL,
      NULL,
      0,
      0,
      'pending',
      now(),
      now()
    );
  END LOOP;

  -- Create Round 3 matches dynamically  
  FOR i IN 1..v_round3_matches LOOP
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
      i,
      NULL,
      NULL,
      0,
      0,
      'pending',
      now(),
      now()
    );
  END LOOP;

  UPDATE tournaments 
  SET status = 'in_progress', started_at = now(), current_round = 1, updated_at = now()
  WHERE id = p_tournament_id;

  RETURN json_build_object(
    'success', true, 
    'total_matches_created', v_round1_matches + v_round2_matches + v_round3_matches,
    'participants', 8,
    'round1_matches', v_round1_matches,
    'round2_matches', v_round2_matches,
    'round3_matches', v_round3_matches
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;